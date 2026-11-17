import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BarChart3, CalendarClock, FileStack, Pencil, Send, StickyNote, Table2, Users, XCircle } from "lucide-react";
import {
  Badge,
  DetailHeader,
  Dialog,
  Empty,
  Field,
  Kebab,
  KeyFigure,
  LineItemsEditor,
  Meter,
  Money,
  NextBar,
  Panel,
  StatusBadge,
  StatusSteps,
  toast,
  Trail,
  useL,
  type DraftLine,
  Breadcrumbs,
} from "../../../components/kit";
import { ChainLife } from "../purchasing/parts";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { budgetOf, PATHS, quoteTotal, R, statusMeta, trailOf, tradeName } from "../../../ops/select";
import { buildingShort } from "../../../lib/loc";
import { fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import type { MaterialRequest, Priority } from "../../../ops/types";
import { AnswerChip, approvalFor, liveQuotes } from "./shared";

export function RequestDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, rel, stamp, lang } = useL();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const s = useOps();
  const mr = s.mrs.find((m) => m.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (params.get("edit") === "1" && mr) {
      setEditOpen(true);
      params.delete("edit");
      setParams(params, { replace: true });
    }
  }, [params, setParams, mr]);

  const rfqs = useMemo(() => s.rfqs.filter((r) => r.mrId === id), [s.rfqs, id]);
  const quotes = useMemo(() => s.quotes.filter((q) => q.rfqId && rfqs.some((r) => r.id === q.rfqId)), [s.quotes, rfqs]);
  const po = s.pos.find((p) => p.mrId === id);

  if (!mr) {
    return (
      <div className="k-page">
        <Empty title={t("Request not found")} action={<Link className="btn btn-ghost" to={R.requests}>{t("Back to requests")}</Link>}>
          {t("{id} is not in this project.", { id })}
        </Empty>
      </div>
    );
  }

  const late = mr.neededBy < TODAY && mr.status !== "FULFILLED" && mr.status !== "CANCELLED";
  const value = budgetOf(s, mr.lines);
  const act = mr.activityId ? s.activities.find((a) => a.id === mr.activityId) : undefined;
  const openRfq = rfqs.find((r) => r.status === "OPEN") ?? rfqs[0];
  const editable = mr.status === "DRAFT" || mr.status === "SUBMITTED";

  // ---- next step
  let next: { text: string; action?: { label: string; onClick: () => void; icon?: ReactNode }; tone?: "brand" | "ok" | "warn" | "bad" | "muted" } = { text: "" };
  if (mr.status === "DRAFT")
    next = {
      text: t("This request is a draft. Submit it so procurement can send it to vendors."),
      action: {
        label: t("Submit"),
        icon: <Send size={14} />,
        onClick: () => {
          s.submitMr(mr.id);
          toast(t("{ref} submitted to procurement", { ref: mr.ref }));
        },
      },
    };
  else if (mr.status === "SUBMITTED") next = { text: t("Submitted {when}. Ask vendors for prices with an RFQ.", { when: rel(mr.submittedAt ?? mr.createdAt) }), action: { label: t("Create RFQ"), icon: <Send size={14} />, onClick: () => navigate(R.newRfq(mr.id)) } };
  else if (mr.status === "SOURCING") {
    const lq = openRfq ? liveQuotes(s.quotes, openRfq.id) : [];
    const appr = approvalFor(s.approvals, lq.map((q) => q.id));
    if (appr?.status === "PENDING") next = { text: t("{ref} is waiting for approval.", { ref: appr.ref }), action: { label: t("Open the approval"), onClick: () => navigate(R.approval(appr.id)) }, tone: "warn" };
    else if (lq.length >= 2) next = { text: t("{n} quotes are in on {rfq}. Compare them and pick a vendor.", { n: lq.length, rfq: openRfq!.ref }), action: { label: t("Compare quotes"), onClick: () => navigate(R.compare(openRfq!.id)) } };
    else next = { text: openRfq ? t("{rfq} is out with {n} vendors. {q} quoted so far.", { rfq: openRfq.ref, n: openRfq.invitations.length, q: lq.length }) : t("Sourcing has started."), action: openRfq ? { label: t("Open the RFQ"), onClick: () => navigate(R.rfq(openRfq.id)) } : undefined };
  } else if (mr.status === "FULFILLED") next = { text: t("Delivered and received in full."), action: po ? { label: t("Open the order"), onClick: () => navigate(R.order(po.id)) } : undefined, tone: "ok" };
  else next = { text: t("This request was cancelled."), tone: "muted" };

  const pMeta = statusMeta("priority", mr.priority);
  const usedElsewhere = (key: string) => s.mrs.filter((m) => m.id !== mr.id && m.status !== "CANCELLED").reduce((a, m) => a + m.lines.filter((l) => l.material === key).reduce((b, l) => b + l.qty, 0), 0);

  return (
    <div className="k-page ps-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Material requests"), to: R.requests }, { label: mr.ref }]} />
      <DetailHeader
        refCode={mr.ref}
        badges={
          <>
            <StatusBadge kind="mr" status={mr.status} />
            <Badge tone={pMeta.tone}>{x(pMeta.label)}</Badge>
            <Badge tone="muted" dot={false}>
              {t(mr.source === "BOQ" ? "From the BOQ" : mr.source === "PROGRAMME" ? "From the programme" : mr.source === "STOCK" ? "From stock" : "Typed in")}
            </Badge>
          </>
        }
        title={x(mr.title)}
        meta={
          <>
            <span>{buildingShort(mr.building, lang)}</span>
            <span>{tradeName(mr.trade, lang)}</span>
            <span>{t("Requested by {name}", { name: mr.requestedBy })}</span>
            <span>{t("Created {when}", { when: stamp(mr.createdAt) })}</span>
          </>
        }
        aside={<KeyFigure label={t("Needed by")} value={d(mr.neededBy)} sub={mr.status === "FULFILLED" ? t("fulfilled") : rel(mr.neededBy)} tone={late ? "bad" : undefined} />}
      >
        <StatusSteps kind="mr" path={PATHS.mr} status={mr.status} rejected={mr.status === "CANCELLED"} />
      </DetailHeader>

      <NextBar text={next.text} tone={next.tone}>
        {next.action ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={next.action.onClick}>
            {next.action.icon}
            {next.action.label}
          </button>
        ) : null}
        {mr.status === "SOURCING" && openRfq && liveQuotes(s.quotes, openRfq.id).length >= 2 ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.rfq(openRfq.id))}>
            {t("Open the RFQ")}
          </button>
        ) : null}
        <Kebab
          items={[
            { label: t("Edit"), icon: <Pencil size={14} />, disabled: !editable, onClick: () => setEditOpen(true) },
            { label: t("Create another RFQ"), icon: <Send size={14} />, disabled: mr.status === "DRAFT" || mr.status === "CANCELLED", onClick: () => navigate(R.newRfq(mr.id)) },
            { label: t("Cancel request"), icon: <XCircle size={14} />, danger: true, disabled: mr.status === "FULFILLED" || mr.status === "CANCELLED", onClick: () => setCancelOpen(true) },
          ]}
        />
      </NextBar>

      <Trail steps={trailOf(s, "MR", mr.id)} current={mr.id} />
      <ChainLife kind="MR" id={mr.id} />

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Line items")} icon={<Table2 size={15} />} count={mr.lines.length} pad={false} actions={<span className="muted small">≈ <Money value={value} short /></span>}>
            <div className="k-table-wrap">
              <table className="k-table ps-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("Description")}</th>
                    <th className="hide-900">{t("Spec")}</th>
                    <th style={{ textAlign: "right" }}>{t("Qty")}</th>
                    <th>{t("Unit")}</th>
                    <th style={{ textAlign: "right" }} className="hide-900">
                      {t("BOQ budget qty")}
                    </th>
                    <th style={{ textAlign: "right" }}>{t("Value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {mr.lines.map((l, i) => {
                    const m = l.material ? s.materials.find((mm) => mm.key === l.material) : undefined;
                    return (
                      <tr key={l.key}>
                        <td className="muted num-inline">{i + 1}</td>
                        <td>
                          <strong className="ps-strong">{x(l.description)}</strong>
                        </td>
                        <td className="hide-900 muted">{l.spec ?? "—"}</td>
                        <td style={{ textAlign: "right" }} className="num-inline">
                          {fmtQty(l.qty, l.unit)}
                        </td>
                        <td className="muted">{unitLabel(l.unit, lang)}</td>
                        <td style={{ textAlign: "right" }} className="num-inline hide-900 muted">
                          {m && m.budgetQty > 0 ? fmtQty(m.budgetQty, m.unit) : "—"}
                        </td>
                        <td style={{ textAlign: "right" }} className="num-inline">
                          {m ? fmtMoneyShort(l.qty * m.rate) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title={t("Against the BOQ")} icon={<BarChart3 size={15} />} sub={t("How much of each line's BOQ quantity this request takes, next to what other requests already asked for.")}>
            <ul className="ps-boqbars">
              {mr.lines.map((l) => {
                const m = l.material ? s.materials.find((mm) => mm.key === l.material) : undefined;
                if (!m || m.budgetQty <= 0)
                  return (
                    <li key={l.key}>
                      <span className="ps-boq-name truncate">{x(l.description)}</span>
                      <span className="ps-boq-none">{t("Not a measured BOQ item")}</span>
                      <span className="ps-boq-fig muted">—</span>
                    </li>
                  );
                const other = usedElsewhere(m.key);
                const scale = Math.max(m.budgetQty, other + l.qty);
                const over = other + l.qty > m.budgetQty * 1.0001;
                const share = l.qty / m.budgetQty;
                return (
                  <li key={l.key}>
                    <span className="ps-boq-name truncate" title={x(l.description)}>
                      {x(l.description)}
                    </span>
                    <span className="ps-boq-track" title={`${t("BOQ")} ${fmtQty(m.budgetQty, m.unit)} · ${t("Other requests")} ${fmtQty(other, m.unit)} · ${t("This request")} ${fmtQty(l.qty, l.unit)}`}>
                      <i className="ps-boq-other k-grow-x" style={{ width: `${(other / scale) * 100}%` }} />
                      <i className={`ps-boq-this k-grow-x${over ? " over" : ""}`} style={{ left: `${(other / scale) * 100}%`, width: `${(l.qty / scale) * 100}%` }} />
                      <b className="ps-boq-limit" style={{ left: `${(m.budgetQty / scale) * 100}%` }} />
                    </span>
                    <span className={`ps-boq-fig num-inline${over ? " k-text-bad" : ""}`}>
                      {Math.round(share * 100)}%<small> {t("of BOQ")}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="k-legend">
              <span style={{ ["--lc" as string]: "#cfc4ee" }}>{t("Other requests")}</span>
              <span style={{ ["--lc" as string]: "var(--stamp)" }}>{t("This request")}</span>
              <span style={{ ["--lc" as string]: "var(--redline)" }}>{t("Over the BOQ quantity")}</span>
            </div>
          </Panel>

          <Panel title={t("Supplier RFQs")} icon={<Users size={15} />} count={rfqs.length} pad={false}>
            {rfqs.length ? (
              <ul className="ps-list">
                {rfqs.map((r) => (
                  <li key={r.id}>
                    <Link to={R.rfq(r.id)} className="ps-list-row">
                      <span className="ps-list-main">
                        <span className="k-row" style={{ gap: 8 }}>
                          <span className="k-ref">{r.ref}</span>
                          <StatusBadge kind="rfq" status={r.status} />
                        </span>
                        <span className="ps-chips">
                          {r.invitations.map((inv) => (
                            <AnswerChip key={inv.vendorId} vendor={s.vendors.find((v) => v.id === inv.vendorId)} inv={inv} />
                          ))}
                        </span>
                      </span>
                      <small className="muted">{d(r.dueDate)}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-panel-body muted">
                {mr.status === "SUBMITTED" ? (
                  <button type="button" className="k-link-btn" onClick={() => navigate(R.newRfq(mr.id))}>
                    {t("No RFQ yet. Create one")}
                  </button>
                ) : (
                  t("No RFQ yet.")
                )}
              </p>
            )}
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Quotations received")} icon={<FileStack size={15} />} count={quotes.length} pad={false}>
            {quotes.length ? (
              <ul className="ps-list">
                {quotes.map((q) => {
                  const v = s.vendors.find((vv) => vv.id === q.vendorId);
                  return (
                    <li key={q.id}>
                      <Link to={R.quote(q.id)} className="ps-list-row">
                        <span className="ps-list-main">
                          <strong className="truncate">{v?.name}</strong>
                          <small className="muted">
                            {q.id} · {t("{n} days delivery", { n: q.deliveryDays })}
                            {q.duplicate ? ` · ${t("Duplicate")}` : ""}
                          </small>
                        </span>
                        <span className="ps-list-fig">
                          <Money value={quoteTotal(q)} short />
                          {q.outcome ? <Badge tone={q.outcome === "WON" ? "ok" : "muted"}>{t(q.outcome === "WON" ? "Won" : "Lost")}</Badge> : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="k-panel-body muted">{t("No quotes yet.")}</p>
            )}
          </Panel>

          <Panel title={t("Linked programme activity")} icon={<CalendarClock size={15} />}>
            {act ? (
              <div className="ps-act">
                <Link to={R.programme(act.id)} className="ps-act-title">
                  <span className="k-ref">{act.code}</span>
                  <strong>{x(act.name)}</strong>
                </Link>
                <div className="ps-act-dates">
                  <span>
                    {d(act.start, false)} → {d(act.end)}
                  </span>
                  <StatusBadge kind="activity" status={act.status} />
                </div>
                <Meter value={act.pct / 100} tone={act.status === "BLOCKED" ? "bad" : "brand"} label={t("Progress")} />
                <small className="muted">
                  {t("{p}% done", { p: act.pct })} · {mr.neededBy <= act.start ? t("arrives {n} days before the work starts", { n: diffDays(mr.neededBy, act.start) }) : t("needed {n} days after the work starts", { n: diffDays(act.start, mr.neededBy) })}
                </small>
              </div>
            ) : (
              <p className="muted">{t("Not linked to an activity.")}</p>
            )}
          </Panel>

          <Panel title={t("Notes")} icon={<StickyNote size={15} />}>
            {mr.notes ? <p className="k-note">{x(mr.notes)}</p> : <p className="muted">{t("No notes.")}</p>}
          </Panel>
        </div>
      </div>

      <EditDialog key={editOpen ? "open" : "closed"} mr={mr} open={editOpen} onClose={() => setEditOpen(false)} />

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t("Cancel {ref}?", { ref: mr.ref })}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCancelOpen(false)}>
              {t("Keep it")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                s.cancelMr(mr.id);
                setCancelOpen(false);
                toast(t("{ref} cancelled", { ref: mr.ref }), "muted");
              }}
            >
              {t("Cancel request")}
            </button>
          </>
        }
      >
        <p>{t("The request stays on record as cancelled. Open RFQs for it are not closed automatically.")}</p>
      </Dialog>
    </div>
  );
}

function EditDialog({ mr, open, onClose }: { mr: MaterialRequest; open: boolean; onClose: () => void }) {
  const { t, x } = useL();
  const updateMr = useOps((s) => s.updateMr);
  const [title, setTitle] = useState(x(mr.title));
  const [priority, setPriority] = useState<Priority>(mr.priority);
  const [neededBy, setNeededBy] = useState(mr.neededBy);
  const [notes, setNotes] = useState(x(mr.notes));
  const [lines, setLines] = useState<DraftLine[]>(() => mr.lines.map((l) => ({ id: l.key, material: l.material, description: l.description, spec: l.spec, qty: l.qty, unit: l.unit })));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={760}
      kicker={mr.ref}
      title={t("Edit request")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!title.trim() || !lines.length}
            onClick={() => {
              updateMr(mr.id, { title: title.trim(), priority, neededBy, notes: notes.trim(), lines: lines.map(({ id: _id, ...l }) => l) });
              toast(t("{ref} updated", { ref: mr.ref }));
              onClose();
            }}
          >
            {t("Save changes")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Title")} wide>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t("Priority")}>
          <select className="input select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((p) => (
              <option key={p} value={p}>
                {x(statusMeta("priority", p).label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Needed on site by")}>
          <input className="input" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
        </Field>
        <Field label={t("Lines")} wide>
          <div className="ps-lines-scroll">
            <LineItemsEditor lines={lines} onChange={setLines} trade={mr.trade} />
          </div>
        </Field>
        <Field label={t("Note for procurement")} wide>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
