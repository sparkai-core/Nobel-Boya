import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, ClipboardList, Cpu, LineChart, PiggyBank, Scale, TrendingDown, TrendingUp, Warehouse } from "lucide-react";
import { Badge, Field, Money, PageHero, Panel, Sparkline, StatTiles, toast, useL, type Stat } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { addDays, TODAY } from "../../../ops/dates";
import { R, type Tone } from "../../../ops/select";
import type { Material, OpsData, PriceSeries } from "../../../ops/types";
import { fmtMoney, fmtNum } from "../../../lib/format";
import { buildPackages, monthLabel, type Pkg } from "./shared";
import { PriceChart } from "./PriceChart";

type Call = PriceSeries["call"];
const CALL: Record<Call, { label: string; tone: Tone; sub: string }> = {
  BUY_NOW: { label: "Buy now", tone: "warn", sub: "Prices likely to rise" },
  WAIT: { label: "Wait", tone: "ok", sub: "No rush to order" },
  HOLD: { label: "Hold", tone: "neutral", sub: "Order to the programme" },
};
const CALL_ORDER: Call[] = ["BUY_NOW", "WAIT", "HOLD"];

type Row = {
  ps: PriceSeries;
  mat: Material | undefined;
  now: number;
  p3: number;
  change3: number;
  /** BOQ quantity still to buy, in the price series unit. */
  remaining: number;
  /** Stock on hand, in the price series unit (null when not stocked). */
  stock: number | null;
  /** Saving from buying the remaining quantity today (positive for rising prices). */
  saving: number;
  pkg: Pkg | undefined;
};

/** Converts a BOQ material quantity into the price series unit (kg → t, 50 kg bags → t). */
function factorOf(ps: PriceSeries, m: Material | undefined) {
  if (!m) return 1;
  if (ps.unit === "t" && m.unit === "kg") return 0.001;
  if (ps.unit === "t" && m.unit === "ədəd") return 0.05;
  return 1;
}

function rowsOf(s: OpsData, pkgs: Pkg[]): Row[] {
  return s.priceSeries.map((ps) => {
    const mat = ps.material ? s.materials.find((m) => m.key === ps.material) : undefined;
    const f = factorOf(ps, mat);
    const ordered = ps.material ? s.pos.filter((p) => p.status !== "CANCELLED").reduce((a, p) => a + p.lines.filter((l) => l.material === ps.material).reduce((b, l) => b + l.qty, 0), 0) : 0;
    const remaining = mat ? Math.max(0, mat.budgetQty - ordered) * f : 0;
    const st = ps.material ? s.stock.filter((x) => x.key === ps.material) : [];
    const now = ps.history[ps.history.length - 1]?.price ?? 0;
    const p3 = ps.forecast[2]?.price ?? now;
    return {
      ps,
      mat,
      now,
      p3,
      change3: now ? (p3 - now) / now : 0,
      remaining,
      stock: st.length ? st.reduce((a, x) => a + x.onHand, 0) * f : null,
      saving: ps.call === "BUY_NOW" ? remaining * (p3 - now) : 0,
      pkg: ps.material ? pkgs.find((p) => p.materials.includes(ps.material!) && p.status !== "DELIVERED") : undefined,
    };
  });
}

/** Price forecast: a rule-based buy-now / wait call per tracked material, with the money it makes or saves. */
export function ForecastPage() {
  const { t, x } = useL();
  const s = useOps();
  const pkgs = useMemo(() => buildPackages(s), [s]);
  const rows = useMemo(() => rowsOf(s, pkgs), [s, pkgs]);
  const [key, setKey] = useState<string>(() => rows.find((r) => r.ps.call === "BUY_NOW")?.ps.key ?? rows[0]?.ps.key ?? "");
  const [range, setRange] = useState<"6" | "12">("12");
  const [group, setGroup] = useState<"call" | "cat" | "all">("call");
  const sel = rows.find((r) => r.ps.key === key) ?? rows[0];

  const buy = rows.filter((r) => r.ps.call === "BUY_NOW");
  const wait = rows.filter((r) => r.ps.call === "WAIT");
  const savings = buy.reduce((a, r) => a + Math.max(0, r.saving), 0);

  const tiles: Stat[] = [
    { label: t("Buy now"), value: buy.length, sub: t("Prices likely to rise"), tone: "warn", icon: <TrendingUp size={14} />, onClick: () => buy[0] && setKey(buy[0].ps.key) },
    { label: t("Wait"), value: wait.length, sub: t("No rush to order"), tone: "ok", icon: <TrendingDown size={14} />, onClick: () => wait[0] && setKey(wait[0].ps.key) },
    { label: t("Materials tracked"), value: rows.length, sub: t("12 months back, 6 months ahead"), tone: "brand", icon: <LineChart size={14} /> },
    { label: t("Potential savings"), value: <Money value={savings} short />, sub: t("buying the rest of the BOQ on every Buy-now call"), tone: "ok", icon: <PiggyBank size={14} /> },
  ];

  const groups = useMemo(() => {
    if (group === "all") return [{ key: "all", label: "", rows }];
    if (group === "call") return CALL_ORDER.map((c) => ({ key: c, label: t(CALL[c].label), rows: rows.filter((r) => r.ps.call === c) })).filter((g) => g.rows.length);
    const cats = [...new Set(rows.map((r) => r.ps.category.en))];
    return cats.map((c) => ({ key: c, label: x(rows.find((r) => r.ps.category.en === c)!.ps.category), rows: rows.filter((r) => r.ps.category.en === c) }));
  }, [group, rows, t, x]);

  return (
    <div className="k-page ppl-page">
      <PageHero
        eyebrow={t("Procurement · Plan")}
        title={t("Price forecast")}
        subtitle={t("Where material prices are heading over the next six months, and whether to buy now or wait for the quantities still left in the BOQ.")}
        flow={["Price history", "Forecast", "The call", "Material request"]}
        art="budget"
      >
        <span className="ppl-engine">
          <Cpu size={13} />
          {t("Rule-based forecast (demo)")}
        </span>
      </PageHero>

      <StatTiles items={tiles} />

      {sel ? (
        <div className="k-grid-main ppl-fc-main">
          <Panel
            title={t("Selected trend")}
            icon={<LineChart size={16} />}
            actions={
              <div className="k-row ppl-fc-controls">
                <select className="input select ppl-fc-pick" value={sel.ps.key} onChange={(e) => setKey(e.target.value)} aria-label={t("Material")}>
                  {rows.map((r) => (
                    <option key={r.ps.key} value={r.ps.key}>
                      {x(r.ps.name)}
                    </option>
                  ))}
                </select>
                <Segmented<"6" | "12"> label={t("Range")} value={range} onChange={setRange} options={[{ value: "6", label: t("6M") }, { value: "12", label: t("1Y") }]} />
              </div>
            }
          >
            <div className="ppl-fc-title">
              <div>
                <strong>{x(sel.ps.name)}</strong>
                <small>
                  {x(sel.ps.category)} · AZN / {sel.ps.unit}
                </small>
              </div>
              <Badge tone={CALL[sel.ps.call].tone}>{t(CALL[sel.ps.call].label)}</Badge>
            </div>
            <PriceChart series={sel.ps} months={range === "6" ? 6 : 12} />
            <JumpStrip row={sel} />
          </Panel>
          <Decision key={sel.ps.key} row={sel} />
        </div>
      ) : null}

      <Panel
        title={t("Tracked materials")}
        icon={<Scale size={16} />}
        count={rows.length}
        actions={<Segmented<"call" | "cat" | "all"> label={t("Group")} value={group} onChange={setGroup} options={[{ value: "call", label: t("By call") }, { value: "cat", label: t("By category") }, { value: "all", label: t("One list") }]} />}
        pad={false}
      >
        <div className="ppl-mt" role="table">
          <div className="ppl-mt-row ppl-mt-head" role="row">
            <span role="columnheader">{t("Material")}</span>
            <span role="columnheader">{t("Category")}</span>
            <span role="columnheader">{t("Call")}</span>
            <span role="columnheader" className="r">
              {t("Price today")}
            </span>
            <span role="columnheader" className="r">
              {t("3-month change")}
            </span>
            <span role="columnheader" className="r">
              {t("Lead time")}
            </span>
            <span role="columnheader" />
          </div>
          {groups.map((g) => (
            <div key={g.key} role="rowgroup">
              {g.label ? (
                <div className="ppl-mt-group">
                  {g.label} <b className="num-inline">{g.rows.length}</b>
                </div>
              ) : null}
              {g.rows.map((r) => (
                <MaterialRow key={r.ps.key} r={r} on={r.ps.key === sel?.ps.key} onPick={() => setKey(r.ps.key)} />
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function MaterialRow({ r, on, onPick }: { r: Row; on: boolean; onPick: () => void }) {
  const { t, x } = useL();
  const navigate = useNavigate();
  const up = r.change3 > 0.001;
  const down = r.change3 < -0.001;
  const digits = r.now < 100 ? 2 : 0;
  return (
    <div role="row" tabIndex={0} className={`ppl-mt-row${on ? " on" : ""}`} onClick={onPick} onKeyDown={(e) => e.key === "Enter" && onPick()}>
      <span role="cell" className="ppl-mt-name">
        <Sparkline values={r.ps.history.map((h) => h.price)} width={64} height={24} tone={r.ps.call === "BUY_NOW" ? "warn" : r.ps.call === "WAIT" ? "ok" : "neutral"} />
        <span className="k-cell-title">
          <strong className="truncate">{x(r.ps.name)}</strong>
          <small>{r.mat ? x(r.mat.name) : t("Not in the BOQ")}</small>
        </span>
      </span>
      <span role="cell" className="ppl-mt-cat muted">
        {x(r.ps.category)}
      </span>
      <span role="cell">
        <Badge tone={CALL[r.ps.call].tone}>{t(CALL[r.ps.call].label)}</Badge>
      </span>
      <span role="cell" className="r num-inline">
        {fmtNum(r.now, digits)} <small className="muted">/{r.ps.unit}</small>
      </span>
      <span role="cell" className={`r num-inline ${up ? "k-text-warn" : down ? "k-text-ok" : "muted"}`}>
        {up ? <TrendingUp size={12} /> : down ? <TrendingDown size={12} /> : null} {up ? "+" : ""}
        {(r.change3 * 100).toFixed(1)}%
      </span>
      <span role="cell" className="r num-inline">
        {t("{n} d", { n: r.ps.leadDays })}
      </span>
      <span role="cell" className="r">
        {r.ps.call === "BUY_NOW" ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              toast(t("New request for {m}.", { m: x(r.ps.name) }), "brand");
              navigate(r.pkg ? `${R.newRequest}?activity=${r.pkg.act.id}` : R.newRequest);
            }}
          >
            {t("Request")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onPick();
            }}
          >
            {t("View")}
          </button>
        )}
      </span>
    </div>
  );
}

/** Today's price, the move and the price in three months, side by side. */
function JumpStrip({ row }: { row: Row }) {
  const { t, lang } = useL();
  const digits = row.now < 100 ? 2 : 0;
  const up = row.change3 > 0.001;
  const down = row.change3 < -0.001;
  return (
    <div className={`ppl-jump ${up ? "up" : down ? "down" : "flat"}`}>
      <div>
        <small>{t("Today")}</small>
        <b className="num-inline">
          {fmtNum(row.now, digits)} <span>AZN/{row.ps.unit}</span>
        </b>
      </div>
      <span className="ppl-jump-pill num-inline">
        {up ? <TrendingUp size={12} /> : down ? <TrendingDown size={12} /> : null}
        {up ? "+" : ""}
        {(row.change3 * 100).toFixed(1)}%
        <ArrowRight size={11} />
      </span>
      <div className="r">
        <small>{t("In 3 months · {m}", { m: monthLabel(row.ps.forecast[2]?.month ?? TODAY.slice(0, 7), lang, true) })}</small>
        <b className="num-inline">
          {fmtNum(row.p3, digits)} <span>AZN/{row.ps.unit}</span>
        </b>
      </div>
    </div>
  );
}

/** The call: buy now or wait, for a quantity, with stock, lead time and the programme in view. */
function Decision({ row }: { row: Row }) {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const startQty = row.remaining > 0 ? row.remaining : row.stock != null ? Math.max(1, row.stock) : 10;
  const digits = row.ps.unit === "t" ? 1 : 0;
  const [qty, setQty] = useState(() => String(Number(startQty.toFixed(digits))));
  const q = Math.max(0, Number(qty) || 0);
  const diff = q * (row.p3 - row.now);
  const meta = CALL[row.ps.call];
  const onSite = addDays(TODAY, row.ps.leadDays);
  const threeMonths = `${row.ps.forecast[2]?.month ?? TODAY.slice(0, 7)}-01`;
  const pkg = row.pkg;
  const pkgOrdered = pkg && (pkg.status === "ORDERED" || pkg.status === "DELIVERED");
  const waitMisses = pkg && !pkgOrdered && row.ps.call === "WAIT" && pkg.latestPo < threeMonths;
  const headline =
    row.ps.call === "BUY_NOW"
      ? t("Buy now: prices likely to rise {p}% in 3 months.", { p: (row.change3 * 100).toFixed(1) })
      : row.ps.call === "WAIT"
        ? t("Wait: prices expected to ease {p}% in 3 months.", { p: (Math.abs(row.change3) * 100).toFixed(1) })
        : t("Hold: no clear move. Order to the programme.");

  return (
    <Panel className={`ppl-call ppl-call-${row.ps.call.toLowerCase()}`} title={t("The call")} icon={<Scale size={16} />} actions={<Badge tone={meta.tone}>{t(meta.label)}</Badge>}>
      <p className="ppl-call-head">{headline}</p>
      <Field label={t("Quantity to buy")} hint={row.remaining > 0 ? t("Defaults to the BOQ quantity not yet ordered.") : t("Not measured in the BOQ; enter the quantity.")}>
        <span className="ppl-qty">
          <input className="input" type="number" min={0} step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label={t("Quantity to buy")} />
          <span>{row.ps.unit}</span>
        </span>
      </Field>

      <div className={`ppl-save ${diff > 0.5 ? "buy" : diff < -0.5 ? "wait" : "flat"}`}>
        <small>{diff > 0.5 ? t("Buying today saves") : diff < -0.5 ? t("Waiting 3 months saves") : t("No difference expected")}</small>
        <strong className="num-inline">
          {fmtMoney(Math.abs(diff))} <span>AZN</span>
        </strong>
        <span className="muted small num-inline">
          {fmtNum(q, digits)} {row.ps.unit} × {fmtNum(Math.abs(row.p3 - row.now), 2)} AZN
        </span>
      </div>

      <ul className="ppl-facts">
        <li>
          <Warehouse size={14} />
          <span>{t("Stock on site")}</span>
          <b className="num-inline">{row.stock != null ? `${fmtNum(row.stock, digits)} ${row.ps.unit}` : t("Not stocked")}</b>
        </li>
        <li>
          <ClipboardList size={14} />
          <span>{t("Supplier lead time")}</span>
          <b className="num-inline">{t("{n} days", { n: row.ps.leadDays })}</b>
        </li>
        <li>
          <ArrowRight size={14} />
          <span>{t("Ordered today, on site by")}</span>
          <b className="num-inline">{d(onSite)}</b>
        </li>
        {pkg ? (
          <li>
            <LineChart size={14} />
            <span>{pkgOrdered ? t("Programme package") : t("Latest PO for {code}", { code: pkg.act.code })}</span>
            <b className={`num-inline${pkg.late ? " k-text-bad" : ""}`}>{pkgOrdered ? t("Ordered") : d(pkg.latestPo)}</b>
          </li>
        ) : null}
      </ul>

      {waitMisses && pkg ? (
        <div className="k-callout k-tone-warn">
          <TrendingDown size={16} />
          <span>{t("Waiting 3 months runs past the latest PO date for {code} ({d}). Buy to the programme, not the market.", { code: pkg.act.code, d: d(pkg.latestPo) })}</span>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-primary ppl-call-cta"
        onClick={() => {
          toast(t("New request for {m}.", { m: x(row.ps.name) }), "brand");
          navigate(pkg ? `${R.newRequest}?activity=${pkg.act.id}` : R.newRequest);
        }}
      >
        <ClipboardList size={15} />
        {t("Create material request")}
      </button>

      <div className="ppl-faq">
        <span className="ppl-faq-title">
          <BookOpen size={13} />
          {t("How this works")}
        </span>
        <details>
          <summary>{t("Where do the prices come from?")}</summary>
          <p>{t("Twelve months of prices paid on Nobel projects and supplier price lists in Baku, averaged per month. Units are the market units (tonnes for steel), converted from the BOQ.")}</p>
        </details>
        <details>
          <summary>{t("How are Buy now and Wait decided?")}</summary>
          <p>{t("A demo rule looks at the trend of the last year and projects it six months ahead with a widening range. If the price three months out is clearly higher, the call is Buy now; clearly lower, Wait; otherwise Hold.")}</p>
        </details>
        <details>
          <summary>{t("Should I always follow the call?")}</summary>
          <p>{t("No. The programme comes first: never wait past a package's latest PO date, and check storage on site before buying early.")}</p>
        </details>
      </div>
    </Panel>
  );
}
