import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, Coins, Gauge, RotateCcw, Scale, Send, ShieldCheck, SlidersHorizontal, Sparkles, Table2, Zap } from "lucide-react";
import { Empty, FlowRail, PageHero, StatTiles, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { budgetOf, FACTOR_LABEL, FACTORS, PRESETS, R, scoreQuotes, type Weights } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { Quotation, Rfq } from "../../../ops/types";
import { ApprovalState, LineGrid, VendorCard } from "./CompareParts";
import { approvalFor, liveQuotes, pickStory, rfqOrder, TypedText } from "./shared";

type PresetKey = keyof typeof PRESETS;
type Scope = { key: string; kind: "rfq" | "quote"; rfq: Rfq | null; quotes: Quotation[]; group: "ready" | "loose" | "waiting" };

const PRESET_ORDER: { key: PresetKey; icon: typeof Scale }[] = [
  { key: "best", icon: Scale },
  { key: "cost", icon: Coins },
  { key: "fast", icon: Zap },
  { key: "safe", icon: ShieldCheck },
];

/** AI vendor comparison: pick what to compare, set priorities, see the ranked vendors and why the top pick wins. */
export function ComparePage() {
  const { t, x } = useL();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const s = useOps();
  const [preset, setPreset] = useState<PresetKey | "custom">("best");
  const [weights, setWeights] = useState<Weights>(PRESETS.best.weights);
  const [tune, setTune] = useState(false);
  const [grid, setGrid] = useState(false);
  const [run, setRun] = useState(0);

  const scopes = useMemo(() => {
    const out: Scope[] = [];
    for (const r of rfqOrder(s.rfqs)) {
      if (r.status === "CANCELLED") continue;
      const lq = liveQuotes(s.quotes, r.id);
      if (lq.length >= 2) out.push({ key: `rfq:${r.id}`, kind: "rfq", rfq: r, quotes: lq, group: "ready" });
    }
    for (const q of s.quotes) if (!q.rfqId && !q.duplicate) out.push({ key: `quote:${q.id}`, kind: "quote", rfq: null, quotes: [q], group: "loose" });
    for (const r of rfqOrder(s.rfqs)) {
      if (r.status !== "OPEN" && r.status !== "CLOSED") continue;
      const lq = liveQuotes(s.quotes, r.id);
      if (lq.length === 1) out.push({ key: `rfq:${r.id}`, kind: "rfq", rfq: r, quotes: lq, group: "waiting" });
    }
    return out;
  }, [s.rfqs, s.quotes]);

  const wanted = params.get("rfq") ? `rfq:${params.get("rfq")}` : params.get("quote") ? `quote:${params.get("quote")}` : null;
  const scope = scopes.find((sc) => sc.key === wanted) ?? scopes[0];
  const rows = useMemo(() => (scope ? scoreQuotes({ vendors: s.vendors }, scope.quotes, weights) : []), [scope, s.vendors, weights]);
  const story = useMemo(() => pickStory(rows, t, x), [rows, t, x]);

  const pick = (key: string) => {
    const [kind, id] = key.split(":");
    setParams(kind === "rfq" ? { rfq: id! } : { quote: id! }, { replace: true });
    setRun((n) => n + 1);
  };
  const choosePreset = (k: PresetKey) => {
    setPreset(k);
    setWeights(PRESETS[k].weights);
    setRun((n) => n + 1);
  };

  const hero = (
    <PageHero
      eyebrow={t("Procurement · Comparison")}
      title={t("AI vendor comparison")}
      subtitle={t("Quotes scored on price, delivery, vendor record, reliability, risk and completeness. Set what matters and the pick explains itself.")}
      flow={["Pick the RFQ", "Set priorities", "Read the pick", "Send for approval"]}
      art="compare"
    />
  );
  if (!scope) {
    return (
      <div className="k-page ps-page">
        {hero}
        <FlowRail current="compare" />
        <Empty icon={<Scale size={20} />} title={t("Nothing to compare yet")} action={<Link className="btn btn-primary" to={R.rfqs}>{t("Open the RFQs")}</Link>}>
          {t("Comparisons appear once vendors have quoted.")}
        </Empty>
      </div>
    );
  }

  const top = rows[0];
  const appr = approvalFor(s.approvals, s.quotes.filter((q) => (scope.rfq ? q.rfqId === scope.rfq.id : q.id === scope.quotes[0]!.id)).map((q) => q.id));
  const blockingAppr = appr && appr.status !== "REJECTED" ? appr : undefined;
  const lowest = rows.length ? Math.min(...rows.map((r) => r.total)) : 0;
  const highest = rows.length ? Math.max(...rows.map((r) => r.total)) : 0;
  const budget = scope.rfq ? budgetOf(s, scope.rfq.lines) * 1.18 : 0;
  const lines = scope.rfq?.lines.length ? scope.rfq.lines : (scope.quotes[0]?.lines ?? []);
  const presetIdx = PRESET_ORDER.findIndex((p) => p.key === preset);

  const send = () => {
    if (!top) return;
    const id = s.sendForApproval(top.quote.id, t("Picked in the comparison: {vendor}, score {score}.", { vendor: top.vendor.name, score: top.score }));
    toast(t("{ref} raised for {vendor}", { ref: id, vendor: top.vendor.name }));
    navigate(R.approval(id));
  };

  const groups: { key: Scope["group"]; label: string }[] = [
    { key: "ready", label: t("Ready to compare") },
    { key: "loose", label: t("Quotes without an RFQ") },
    { key: "waiting", label: t("Waiting for a second quote") },
  ];
  const scopeLabel = (sc: Scope) => {
    if (sc.rfq) return `${sc.rfq.ref} · ${x(sc.rfq.title)} (${sc.quotes.length === 1 ? t("1 quote") : t("{n} quotes", { n: sc.quotes.length })})`;
    const q = sc.quotes[0]!;
    return `${q.id} · ${s.vendors.find((v) => v.id === q.vendorId)?.name ?? ""}`;
  };

  return (
    <div className="k-page ps-page">
      {hero}
      <FlowRail current="compare" />

      <section className="ps-strip" aria-label={t("What to compare and how")}>
        <div className="ps-strip-row">
          <label className="ps-scope">
            <span className="ps-strip-label">{t("What to compare")}</span>
            <select className="input select" value={scope.key} onChange={(e) => pick(e.target.value)}>
              {groups.map((g) => {
                const list = scopes.filter((sc) => sc.group === g.key);
                return list.length ? (
                  <optgroup key={g.key} label={g.label}>
                    {list.map((sc) => (
                      <option key={`${g.key}-${sc.key}`} value={sc.key}>
                        {scopeLabel(sc)}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
            <small className="muted">
              {rows.length > 1 ? t("{n} quotes · {a} to {b} AZN", { n: rows.length, a: fmtMoneyShort(lowest), b: fmtMoneyShort(highest) }) : t("1 quote · {a} AZN", { a: fmtMoneyShort(lowest) })}
              {scope.rfq ? (
                <>
                  {" · "}
                  <Link to={R.rfq(scope.rfq.id)} className="k-link-btn">
                    {t("Open the RFQ")}
                  </Link>
                </>
              ) : null}
            </small>
          </label>

          <div className="ps-prio">
            <span className="ps-strip-label">{t("What matters most")}</span>
            <div className="ps-switch" role="radiogroup" aria-label={t("What matters most")}>
              {presetIdx >= 0 ? <span className="ps-switch-mark" style={{ transform: `translateX(${presetIdx * 100}%)` }} aria-hidden="true" /> : null}
              {PRESET_ORDER.map((p) => {
                const Icon = p.icon;
                return (
                  <button key={p.key} type="button" role="radio" aria-checked={preset === p.key} className={preset === p.key ? "on" : undefined} onClick={() => choosePreset(p.key)}>
                    <Icon size={14} />
                    <span>{x(PRESETS[p.key].label)}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className={`k-link-btn ps-tune-btn${tune ? " on" : ""}`} onClick={() => setTune((v) => !v)} aria-expanded={tune}>
              <SlidersHorizontal size={13} />
              {preset === "custom" ? t("Custom weights") : t("Fine-tune the weights")}
              <ChevronDown size={13} className={tune ? "flip" : undefined} />
            </button>
          </div>
        </div>
        {tune ? (
          <div className="ps-weights k-rise">
            {FACTORS.map((f) => {
              const sum = FACTORS.reduce((a, k) => a + weights[k], 0) || 1;
              return (
                <label key={f} className="ps-weight">
                  <span>
                    {x(FACTOR_LABEL[f])}
                    <b className="num-inline">{Math.round((weights[f] / sum) * 100)}%</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={weights[f]}
                    onChange={(e) => {
                      setWeights({ ...weights, [f]: Number(e.target.value) });
                      setPreset("custom");
                    }}
                  />
                </label>
              );
            })}
            {preset === "custom" ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => choosePreset("best")}>
                <RotateCcw size={13} />
                {t("Back to best overall")}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="ps-compare">
        <div className="ps-cards">
          {top ? (
            <VendorCard row={top} weights={weights} big run={run} lowest={lowest}>
              <footer className="ps-vcard-foot">
                {blockingAppr ? (
                  <ApprovalState appr={blockingAppr} />
                ) : (
                  <>
                    <p className="small muted">{rows.length > 1 ? t("Send {vendor}'s quote for approval. The other quotes stay on record.", { vendor: top.vendor.name }) : t("Only one quote: approval will see it on its own.")}</p>
                    <button type="button" className="btn btn-primary" onClick={send}>
                      <Send size={14} />
                      {t("Send for approval")}
                    </button>
                  </>
                )}
              </footer>
            </VendorCard>
          ) : null}
          {rows.length > 1 ? (
            <div className="ps-cards-rest">
              {rows.slice(1).map((r) => (
                <VendorCard key={r.quote.id} row={r} weights={weights} run={run} lowest={lowest} />
              ))}
            </div>
          ) : null}
        </div>

        <aside className="k-ai ps-why">
          <div className="ps-ai-head">
            <span className="k-ai-tag">
              <Sparkles size={13} />
              {t("Why this pick")}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRun((n) => n + 1)}>
              <RotateCcw size={13} />
              {t("Score again")}
            </button>
          </div>
          <TypedText text={story.summary} runKey={`${run}-${scope.key}`} className="ps-why-text" />
          {story.wins.length ? (
            <div className="ps-why-chips">
              <span className="ps-ai-label">{t("Wins on")}</span>
              {story.wins.map((w) => (
                <span key={w} className="ps-chip win">
                  <Check size={11} strokeWidth={3} />
                  {w}
                </span>
              ))}
            </div>
          ) : null}
          {story.gives.length ? (
            <div className="ps-why-chips">
              <span className="ps-ai-label">{t("Gives up")}</span>
              {story.gives.map((w) => (
                <span key={w} className="ps-chip give">
                  {w}
                </span>
              ))}
            </div>
          ) : null}
          <div className="ps-why-weights">
            <span className="ps-ai-label">
              <Gauge size={12} /> {preset === "custom" ? t("Custom weights") : x(PRESETS[preset].label)}
            </span>
            <div className="ps-wbar" aria-hidden="true">
              {FACTORS.map((f, i) => (
                <i key={f} style={{ flexGrow: weights[f], opacity: 1 - i * 0.13 }} title={x(FACTOR_LABEL[f])} />
              ))}
            </div>
            <div className="ps-wkey">
              {FACTORS.filter((f) => weights[f] > 0).map((f) => (
                <span key={f}>
                  {x(FACTOR_LABEL[f])} <b className="num-inline">{weights[f]}</b>
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {top ? (
        <StatTiles
          items={[
            { label: t("Top pick total"), value: <span className="num-inline">{fmtMoneyShort(top.total)} <small className="k-cur">AZN</small></span>, sub: t("incl. VAT and shipping") },
            budget > 0
              ? { label: t("Against the BOQ budget"), value: <span className={top.total <= budget ? "k-up" : "k-down"}>{top.total <= budget ? "−" : "+"}{fmtMoneyShort(Math.abs(budget - top.total))} <small className="k-cur">AZN</small></span>, sub: top.total <= budget ? t("{p}% under the BOQ", { p: Math.round((1 - top.total / budget) * 100) }) : t("{p}% over the BOQ", { p: Math.round((top.total / budget - 1) * 100) }), tone: top.total <= budget ? "ok" : "bad" }
              : { label: t("Against the BOQ budget"), value: "—", sub: t("No BOQ lines on this quote") },
            top.total > lowest + 0.005
              ? { label: t("Paid over the cheapest quote"), value: <span className="num-inline">+{fmtMoneyShort(top.total - lowest)} <small className="k-cur">AZN</small></span>, sub: t("{p}% more, for a better overall score", { p: Math.round((top.total / Math.max(1, lowest) - 1) * 100) }), tone: "warn" }
              : { label: t("Saved against the highest quote"), value: <span className="num-inline">{fmtMoneyShort(highest - top.total)} <small className="k-cur">AZN</small></span>, sub: rows.length > 1 ? t("{p}% less than the dearest", { p: Math.round((1 - top.total / Math.max(1, highest)) * 100) }) : t("Only one quote"), tone: highest - top.total > 0 ? "ok" : "neutral" },
            { label: t("Spread between quotes"), value: <span className="num-inline">{rows.length > 1 ? `${Math.round((highest / Math.max(1, lowest) - 1) * 100)}%` : "—"}</span>, sub: t("from lowest to highest") },
          ]}
        />
      ) : null}

      <section className="k-panel ps-fold">
        <button type="button" className="ps-fold-head" onClick={() => setGrid((g) => !g)} aria-expanded={grid}>
          <Table2 size={15} />
          <strong>{t("Line by line")}</strong>
          <small className="muted">{t("{n} lines × {m} vendors, best unit price highlighted", { n: lines.length, m: rows.length })}</small>
          <ChevronDown size={16} className={grid ? "flip" : undefined} />
        </button>
        {grid ? <LineGrid rows={rows} lines={lines} /> : null}
      </section>
    </div>
  );
}
