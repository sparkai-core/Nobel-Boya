import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, SlidersHorizontal, Trophy } from "lucide-react";
import { Avatar, Badge, Empty, FilterChips, Money, PageHero, Register, SearchBox, StatusBadge, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { initials, R, statusMeta, tradeName, vendorStats } from "../../../ops/select";
import type { Risk, Trade, Vendor, VendorStatus } from "../../../ops/types";
import { VisualHead } from "./shared";
import { hasScore } from "../../../ops/ext/proc-client";

type Part = "quality" | "price" | "delivery" | "reliability";
const PARTS: { key: Part; label: string }[] = [
  { key: "quality", label: "Quality" },
  { key: "price", label: "Price" },
  { key: "delivery", label: "Delivery" },
  { key: "reliability", label: "Reliability" },
];
const DEFAULT_W: Record<Part, number> = { quality: 30, price: 20, delivery: 20, reliability: 30 };

/** Vendor intelligence: every vendor on a 0–10 score line, a live ranking per trade with adjustable weights, and the register. */
export function VendorsPage() {
  const { t, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [status, setStatus] = useState<VendorStatus | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [q, setQ] = useState("");
  const [w, setW] = useState(DEFAULT_W);
  const trades = useMemo(() => [...new Set(s.vendors.map((v) => v.trade))].sort(), [s.vendors]);
  const [rankPick, setRankTrade] = useState<Trade | null>(null);
  const rankTrade: Trade | null = rankPick && trades.includes(rankPick) ? rankPick : (trades[0] ?? null);
  const scoredVendors = s.vendors.filter(hasScore);

  const matches = (v: Vendor) => (!status || v.status === status) && (!risk || v.risk === risk) && (!trade || v.trade === trade || v.trades.includes(trade));
  const filtered = s.vendors.filter(matches);
  const rows = useSearch(filtered, q, (v) => [v.name, v.city, v.contact, v.trn, v.trade]);
  const stats = useMemo(() => new Map(s.vendors.map((v) => [v.id, vendorStats(s, v.id)])), [s]);

  // Score line: stack blocks that would overlap.
  const placed = useMemo(() => {
    const sorted = s.vendors.filter(hasScore).sort((a, b) => a.overall - b.overall);
    const levels: number[][] = [];
    return sorted.map((v) => {
      const pos = v.overall / 10;
      let lv = 0;
      while ((levels[lv] ?? []).some((p) => Math.abs(p - pos) < 0.036)) lv++;
      (levels[lv] ??= []).push(pos);
      return { v, pos, lv };
    });
  }, [s.vendors]);
  const maxLv = Math.max(0, ...placed.map((p) => p.lv));

  const wsum = PARTS.reduce((a, p) => a + w[p.key], 0) || 1;
  const ranking = useMemo(
    () =>
      scoredVendors
        .filter((v) => v.trade === rankTrade || (rankTrade != null && v.trades.includes(rankTrade)))
        .map((v) => {
          const score = PARTS.reduce((a, p) => a + v.scores[p.key] * w[p.key], 0) / wsum / 10;
          const weakest = PARTS.reduce((a, p) => (v.scores[p.key] < v.scores[a.key] ? p : a), PARTS[0]!);
          return { v, score, weakest };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [scoredVendors, rankTrade, w, wsum],
  );

  const columns: Column<Vendor>[] = [
    {
      key: "name",
      header: t("Vendor"),
      sort: (v) => v.name,
      render: (v) => (
        <span className="k-row" style={{ gap: 10, flexWrap: "nowrap" }}>
          <Avatar name={v.name} size={30} />
          <span className="k-cell-title">
            <strong className="truncate">{v.name}</strong>
            <small>{[tradeName(v.trade, lang), v.city].filter(Boolean).join(" · ")}</small>
          </span>
        </span>
      ),
    },
    {
      key: "score",
      header: t("Score"),
      sort: (v) => v.overall,
      render: (v) => !hasScore(v) ? <span className="muted small">{t("Not scored")}</span> : (
        <span className="po-vscore">
          <b className={`num-inline po-vscore-n ${v.overall >= 8 ? "hi" : v.overall >= 6.5 ? "mid" : "lo"}`}>{v.overall.toFixed(1)}</b>
          <span className="po-minibars" aria-hidden="true">
            {(["quality", "price", "delivery"] as Part[]).map((k) => (
              <i key={k} title={`${t(PARTS.find((p) => p.key === k)!.label)} ${v.scores[k]}`}>
                <em style={{ height: `${v.scores[k]}%` }} />
              </i>
            ))}
          </span>
        </span>
      ),
    },
    {
      key: "papers",
      header: t("Papers"),
      hideBelow: 1100,
      render: (v) => (
        <span className="k-cell-title">
          {v.trn ? (
            <small className="k-mono">
              {t("TRN")} {v.trn}
            </small>
          ) : (
            <small className="muted">{t("No TRN")}</small>
          )}
          {v.licence ? <small className="k-mono">{v.licence}</small> : <Badge tone="bad">{t("No licence")}</Badge>}
        </span>
      ),
    },
    {
      key: "record",
      header: t("On record"),
      align: "right",
      hideBelow: 900,
      sort: (v) => stats.get(v.id)?.ordered ?? 0,
      render: (v) => {
        const st = stats.get(v.id)!;
        return (
          <span className="k-cell-title" style={{ justifyItems: "end" }}>
            <strong className="num-inline">{t("{n} orders", { n: st.pos.length })}</strong>
            <small>
              {t("quoted")} <Money value={st.quoted} short />
            </small>
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("Status"),
      sort: (v) => v.status,
      render: (v) => (
        <span className="k-cell-title">
          <StatusBadge kind="vendor" status={v.status} />
          <small className={`k-text-${statusMeta("risk", v.risk).tone}`}>{statusMeta("risk", v.risk).label[lang]}</small>
        </span>
      ),
    },
  ];

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Vendors")}
        title={t("Vendor intelligence")}
        subtitle={t("Every supplier you buy from, scored by you on reliability, quality, price and delivery.")}
        flow={["Registered", "Invited", "Quoted", "Ordered", "Scored"]}
        art="vendor"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate(R.newVendor)}>
            <Plus size={15} />
            {t("Add vendor")}
          </button>
        }
      />

      {!s.vendors.length ? (
        <Empty
          title={t("No vendors yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate(R.newVendor)}>
              <Plus size={15} />
              {t("Add vendor")}
            </button>
          }
        >
          {t("Add the suppliers you buy from. They can then be invited to RFQs, receive orders and use the vendor portal.")}
        </Empty>
      ) : (
      <>
      <div className="po-vtop">
        <section className="po-visual" aria-label={t("Score line")}>
          <VisualHead title={t("Score line")} sentence={scoredVendors.length ? t("{a} of {b} vendors match the filters. Highlighted blocks are the ones in view.", { a: filtered.length, b: s.vendors.length }) : t("No vendor has been scored yet. Score a vendor on its page.")} />
          <div className="po-sline-scroll">
            <div className="po-scoreline" style={{ height: 70 + (maxLv + 1) * 34 }}>
              <span className="po-band lo" style={{ left: 0, width: "65%" }}>
                <em>{t("Review required")}</em>
              </span>
              <span className="po-band mid" style={{ left: "65%", width: "15%" }}>
                <em>{t("Qualified")}</em>
              </span>
              <span className="po-band hi" style={{ left: "80%", width: "20%" }}>
                <em>{t("Highly qualified")}</em>
              </span>
              {placed.map(({ v, pos, lv }, i) => (
                <Link key={v.id} to={R.vendor(v.id)} className={`po-vblock${matches(v) ? " on" : ""}`} style={{ left: `${pos * 100}%`, bottom: 30 + lv * 34, animationDelay: `${i * 30}ms` }} title={`${v.name} · ${v.overall.toFixed(1)}`}>
                  <span>{initials(v.name)}</span>
                  <b className="num-inline">{v.overall.toFixed(1)}</b>
                </Link>
              ))}
              <div className="po-scoreaxis">
                {Array.from({ length: 11 }, (_, i) => (
                  <span key={i} style={{ left: `${i * 10}%` }}>
                    {i}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="po-visual po-rank" aria-label={t("Ranking")}>
          <VisualHead title={t("Top 5 in the trade")} sentence={t("Move the weights and the ranking re-sorts.")}>
            <select className="input select po-rank-trade" value={rankTrade ?? ""} onChange={(e) => setRankTrade(e.target.value as Trade)} aria-label={t("Trade")}>
              {trades.map((tr) => (
                <option key={tr} value={tr}>
                  {tradeName(tr, lang)}
                </option>
              ))}
            </select>
          </VisualHead>
          <div className="po-rank-body">
          <ol className="po-rank-list">
            {ranking.map((r, i) => (
              <li key={r.v.id} className={i === 0 ? "top" : undefined}>
                <span className="po-rank-no">{i === 0 ? <Trophy size={13} /> : i + 1}</span>
                <Link to={R.vendor(r.v.id)} className="po-rank-name">
                  <strong className="truncate">{r.v.name}</strong>
                  <small>
                    {t("weakest: {p} {n}", { p: t(r.weakest.label).toLowerCase(), n: r.v.scores[r.weakest.key] })}
                  </small>
                </Link>
                <span className="po-rank-bar">
                  <i style={{ width: `${r.score * 10}%` }} />
                </span>
                <b className="num-inline">{r.score.toFixed(1)}</b>
              </li>
            ))}
            {!ranking.length ? <li className="muted small">{t("No scored vendors in this trade.")}</li> : null}
          </ol>
          <div className="po-weights">
            <span className="po-weights-h">
              <SlidersHorizontal size={13} /> {t("Weights")}
              <button type="button" className="k-link-btn" onClick={() => setW(DEFAULT_W)}>
                {t("Reset")}
              </button>
            </span>
            {PARTS.map((p) => (
              <label key={p.key}>
                <span>{t(p.label)}</span>
                <input type="range" min={0} max={60} step={5} value={w[p.key]} onChange={(e) => setW((o) => ({ ...o, [p.key]: Number(e.target.value) }))} />
                <b className="num-inline">{Math.round((w[p.key] / wsum) * 100)}%</b>
              </label>
            ))}
          </div>
          </div>
        </section>
      </div>

      <Register
        rows={rows}
        columns={columns}
        rowKey={(v) => v.id}
        onRowClick={(v) => navigate(R.vendor(v.id))}
        initialSort={{ key: "score", dir: "desc" }}
        rowClass={(v) => (v.status !== "APPROVED" ? "po-row-dim" : undefined)}
        toolbar={
          <>
            <Toolbar
              end={
                <FilterChips
                  value={status}
                  onChange={setStatus}
                  options={(["APPROVED", "ON_HOLD", "DISQUALIFIED"] as VendorStatus[]).map((st) => ({ value: st, label: statusMeta("vendor", st).label[lang], count: s.vendors.filter((v) => v.status === st).length }))}
                />
              }
            >
              <SearchBox value={q} onChange={setQ} placeholder="Search vendors, cities, TRN" />
              <FilterChips
                value={risk}
                onChange={setRisk}
                options={(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Risk[]).filter((r) => s.vendors.some((v) => v.risk === r)).map((r) => ({ value: r, label: statusMeta("risk", r).label[lang], count: s.vendors.filter((v) => v.risk === r).length }))}
              />
            </Toolbar>
            <div className="po-tradechips">
              <FilterChips value={trade} onChange={setTrade} options={trades.map((tr) => ({ value: tr, label: tradeName(tr, lang), count: s.vendors.filter((v) => v.trade === tr || v.trades.includes(tr)).length }))} />
            </div>
          </>
        }
      />
      </>
      )}
    </div>
  );
}
