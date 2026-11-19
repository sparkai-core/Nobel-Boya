import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, ClipboardList, PackageMinus, Plus, Ruler, ScanLine } from "lucide-react";
import { Badge, Dialog, Field, FilterChips, PageHero, Register, SearchBox, StatTiles, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { Drawer, Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { R, tradeName } from "../../../ops/select";
import { fmtQty, unitLabel } from "../../../lib/format";
import type { Movement, StockItem, Store } from "../../../ops/types";
import { VisualHead } from "./shared";

const STORES: Store[] = ["Main store", "Warehouse site", "Admin site"];
/** The store type has three fixed slots; they are shown neutrally (goods receipts go into the main store). */
const STORE_LABEL: Record<Store, string> = { "Main store": "Main store", "Warehouse site": "Second store", "Admin site": "Third store" };

type Level = "out" | "empty" | "below" | "at" | "ok";
const levelOf = (i: StockItem): Level => {
  if (i.onHand <= 0) return i.reorder > 0 ? "out" : "empty";
  if (i.onHand < i.reorder) return "below";
  if (i.reorder > 0 && i.onHand <= i.reorder * 1.2) return "at";
  return "ok";
};
const fill = (i: StockItem) => {
  const scale = Math.max(i.onHand, 2 * i.reorder, 1e-6);
  return { h: i.onHand / scale, line: i.reorder / scale };
};

type Act = "issue" | "transfer" | "count" | "reorder";

/** Site stores: every stock item drawn as a bin against its reorder line, the register, and a drawer to move stock. */
export function InventoryPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [store, setStore] = useState<Store | null>(null);
  const [below, setBelow] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => s.stock.filter((i) => (!store || i.store === store) && (!below || i.onHand < i.reorder || (i.onHand <= 0 && i.reorder > 0))), [s.stock, store, below]);
  const shelf = useMemo(() => [...visible].sort((a, b) => fill(a).h - fill(b).h || a.onHand - b.onHand), [visible]);
  const rows = useSearch(visible, q, (i) => [i.name, i.key, i.store, i.trade]);
  const low = s.stock.filter((i) => i.reorder > 0 && i.onHand < i.reorder);
  const lastMv = [...s.movements].sort((a, b) => b.at.localeCompare(a.at) || Number(b.id.slice(3)) - Number(a.id.slice(3)))[0];
  const item = sel ? s.stock.find((i) => i.key === sel) : undefined;

  const stateText = (i: StockItem) => {
    const lv = levelOf(i);
    if (i.onHand <= 0) return { text: t("Out of stock"), tone: i.reorder > 0 ? "bad" : "muted" };
    if (lv === "below") return { text: t("{q} {u} short", { q: fmtQty(i.reorder - i.onHand, i.unit), u: unitLabel(i.unit, lang) }), tone: "bad" };
    if (lv === "at") return { text: t("At the line"), tone: "warn" };
    return { text: t("Above the line"), tone: "ok" };
  };

  const columns: Column<StockItem>[] = [
    {
      key: "mat",
      header: t("Material"),
      sort: (i) => x(i.name),
      render: (i) => (
        <div className="k-cell-title">
          <strong>{x(i.name)}</strong>
          <small>{tradeName(i.trade, lang)}</small>
        </div>
      ),
    },
    { key: "store", header: t("Store"), sort: (i) => i.store, hideBelow: 900, render: (i) => t(STORE_LABEL[i.store]) },
    {
      key: "on",
      header: t("On hand"),
      align: "right",
      sort: (i) => fill(i).h,
      render: (i) => {
        const st = stateText(i);
        return (
          <span className="po-when" style={{ justifyItems: "end" }}>
            <b className="num-inline">
              {fmtQty(i.onHand, i.unit)} <small className="muted">{unitLabel(i.unit, lang)}</small>
            </b>
            <small className={`k-text-${st.tone}`}>{st.text}</small>
          </span>
        );
      },
    },
    { key: "re", header: t("Reorder level"), align: "right", sort: (i) => i.reorder, hideBelow: 900, render: (i) => (i.reorder > 0 ? <span className="num-inline">{fmtQty(i.reorder, i.unit)}</span> : <span className="muted">—</span>) },
    { key: "upd", header: t("Last change"), sort: (i) => i.updatedAt, render: (i) => <span className="num-inline">{d(i.updatedAt)}</span> },
  ];

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Inventory")}
        title={t("Inventory")}
        subtitle={t("What is in the site stores, what is running low, and every movement in and out.")}
        flow={["Received", "In store", "Issued to site", "Reordered"]}
        art="stock"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} />
            {t("Add stock item")}
          </button>
        }
      />

      <StatTiles
        items={[
          { label: t("SKUs"), value: s.stock.length, sub: t("{n} with a reorder level", { n: s.stock.filter((i) => i.reorder > 0).length }) },
          { label: t("Low stock"), value: low.length, tone: low.length ? "bad" : "ok", sub: t("below the reorder line"), onClick: () => setBelow(true) },
          { label: t("Stores"), value: new Set(s.stock.map((i) => i.store)).size || "—", sub: STORES.filter((st) => s.stock.some((i) => i.store === st)).map((st) => `${t(STORE_LABEL[st])} ${s.stock.filter((i) => i.store === st).length}`).join(" · ") || t("nothing in stock yet") },
          { label: t("Last movement"), value: lastMv ? d(lastMv.at, false) : "—", sub: lastMv ? `${lastMv.ref} · ${x(s.stock.find((i) => i.key === lastMv.key)?.name)}` : undefined },
        ]}
      />

      <section className="po-visual" aria-label={t("Stock shelf")}>
        <VisualHead title={t("Stock shelf")} sentence={!s.stock.length ? t("nothing in stock yet") : low.length ? t("{n} items below the reorder line, emptiest on the left.", { n: low.length }) : t("Every item is above its reorder line.")}>
          <label className="po-switch">
            <input type="checkbox" checked={below} onChange={(e) => setBelow(e.target.checked)} />
            <span />
            {t("Below the line only")}
          </label>
        </VisualHead>
        <FilterChips value={store} onChange={setStore} options={STORES.map((st) => ({ value: st, label: t(STORE_LABEL[st]), count: s.stock.filter((i) => i.store === st).length }))} />
        <div className="po-shelf-scroll">
          <div className="po-shelf">
            <div className="po-shelf-line" aria-hidden="true">
              <span>{t("Reorder line")}</span>
            </div>
            {shelf.length ? (
              shelf.map((i, k) => {
                const f = fill(i);
                const lv = levelOf(i);
                return (
                  <button key={i.key} type="button" className={`po-bin lv-${lv}${sel === i.key ? " on" : ""}`} style={{ animationDelay: `${k * 30}ms` }} onClick={() => setSel(i.key)} title={`${x(i.name)} · ${fmtQty(i.onHand, i.unit)} ${unitLabel(i.unit, lang)}`}>
                    <span className="po-bin-box">
                      <i className="po-bin-fill k-grow-y" style={{ height: `${f.h * 100}%` }} />
                      {i.reorder > 0 ? <b className="po-bin-line" style={{ bottom: `${f.line * 100}%` }} /> : null}
                      <em className="num-inline">{fmtQty(i.onHand, i.unit)}</em>
                    </span>
                    <span className="po-bin-name">{x(i.name)}</span>
                  </button>
                );
              })
            ) : (
              <p className="po-bay-empty">{t("Nothing matches these filters.")}</p>
            )}
          </div>
        </div>
        <p className="po-legend-line">
          <i className="po-sw bad" /> {t("Below the line")} <i className="po-sw amber" /> {t("At the line")} <i className="po-sw violet" /> {t("Above the line")} <i className="po-sw tick" /> {t("Reorder level")}
        </p>
      </section>

      <Register
        rows={rows}
        columns={columns}
        rowKey={(i) => i.key}
        empty={s.stock.length ? t("Nothing matches these filters.") : t("Nothing in stock yet. Posted goods receipts add stock; you can also add an item by hand.")}
        onRowClick={(i) => setSel(i.key)}
        initialSort={{ key: "on", dir: "asc" }}
        rowClass={(i) => (i.reorder > 0 && i.onHand < i.reorder ? "po-row-late" : undefined)}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search materials" />
          </Toolbar>
        }
      />

      <Drawer open={!!item} onClose={() => setSel(null)} kicker={item ? `${t(STORE_LABEL[item.store])} · ${tradeName(item.trade, lang)}` : undefined} title={item ? x(item.name) : ""}>
        {item ? <StockDrawer key={item.key} item={item} onRequest={() => navigate(R.newRequest)} /> : null}
      </Drawer>

      <AddStockDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function StockDrawer({ item, onRequest }: { item: StockItem; onRequest: () => void }) {
  const { t, x, d, lang } = useL();
  const s = useOps();
  const [act, setAct] = useState<Act>("issue");
  const [qty, setQty] = useState("");
  const [activity, setActivity] = useState("");
  const [note, setNote] = useState("");
  const [to, setTo] = useState<Store>(STORES.find((st) => st !== item.store) ?? "Main store");
  const [counted, setCounted] = useState(String(item.onHand));
  const [reorder, setReorder] = useState(String(item.reorder));
  const moves = s.movements.filter((m) => m.key === item.key).sort((a, b) => b.at.localeCompare(a.at));
  const acts = s.activities.filter((a) => a.status !== "COMPLETED" && !a.isMilestone).sort((a, b) => a.code.localeCompare(b.code));
  const f = fill(item);
  const u = unitLabel(item.unit, lang);
  const n = Number(qty);

  const reset = () => {
    setQty("");
    setNote("");
  };
  const run = () => {
    if (act === "issue") {
      if (!(n > 0) || n > item.onHand) return;
      s.issueStock(item.key, n, activity || null, note.trim());
      toast(t("{q} {u} issued to site", { q: fmtQty(n, item.unit), u }));
      reset();
    } else if (act === "transfer") {
      s.transferStock(item.key, to);
      toast(t("Moved to {s}", { s: t(STORE_LABEL[to]) }));
    } else if (act === "count") {
      const c = Number(counted);
      if (!(c >= 0)) return;
      s.countStock(item.key, c, note.trim());
      toast(t("Count recorded: {q} {u}", { q: fmtQty(c, item.unit), u }));
      setNote("");
    } else {
      const r = Number(reorder);
      if (!(r >= 0)) return;
      s.setReorder(item.key, r);
      toast(t("Reorder level set to {q} {u}", { q: fmtQty(r, item.unit), u }));
    }
  };

  const mvTone: Record<Movement["type"], "ok" | "brand" | "warn" | "neutral"> = { RECEIPT: "ok", ISSUE: "brand", ADJUSTMENT: "warn", TRANSFER: "neutral" };
  const mvLabel: Record<Movement["type"], string> = { RECEIPT: "Receipt", ISSUE: "Issue", ADJUSTMENT: "Adjustment", TRANSFER: "Transfer" };

  return (
    <div className="po-drawer">
      <div className="po-drawer-bin">
        <span className={`po-bin-box lv-${levelOf(item)}`}>
          <i className="po-bin-fill" style={{ height: `${f.h * 100}%` }} />
          {item.reorder > 0 ? <b className="po-bin-line" style={{ bottom: `${f.line * 100}%` }} /> : null}
        </span>
        <div>
          <strong className="num-inline">
            {fmtQty(item.onHand, item.unit)} {u}
          </strong>
          <small>{item.reorder > 0 ? t("Reorder at {q} {u}", { q: fmtQty(item.reorder, item.unit), u }) : t("No reorder level")}</small>
          <small>{t("Last change {d}", { d: d(item.updatedAt) })}</small>
        </div>
      </div>

      <Segmented<Act>
        label={t("Action")}
        value={act}
        onChange={setAct}
        options={[
          { value: "issue", label: <><PackageMinus size={13} /> {t("Issue")}</> },
          { value: "transfer", label: <><ArrowLeftRight size={13} /> {t("Transfer")}</> },
          { value: "count", label: <><ScanLine size={13} /> {t("Count")}</> },
          { value: "reorder", label: <><Ruler size={13} /> {t("Reorder")}</> },
        ]}
      />

      <div className="po-drawer-form">
        {act === "issue" ? (
          <>
            <Field label={t("Quantity ({u})", { u })} error={n > item.onHand ? t("Only {q} on hand", { q: fmtQty(item.onHand, item.unit) }) : undefined}>
              <input className="input num" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label={t("For programme activity")}>
              <select className="input select" value={activity} onChange={(e) => setActivity(e.target.value)}>
                <option value="">{t("Not linked")}</option>
                {acts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {x(a.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Note")}>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. footings Ms-4")} />
            </Field>
          </>
        ) : act === "transfer" ? (
          <Field label={t("Move to")}>
            <select className="input select" value={to} onChange={(e) => setTo(e.target.value as Store)}>
              {STORES.filter((st) => st !== item.store).map((st) => (
                <option key={st} value={st}>
                  {t(STORE_LABEL[st])}
                </option>
              ))}
            </select>
          </Field>
        ) : act === "count" ? (
          <>
            <Field label={t("Counted ({u})", { u })} hint={t("The difference is booked as an adjustment.")}>
              <input className="input num" type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} />
            </Field>
            <Field label={t("Note")}>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </>
        ) : (
          <Field label={t("Reorder level ({u})", { u })} hint={t("Below this the item shows red on the shelf.")}>
            <input className="input num" type="number" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} />
          </Field>
        )}
        <div className="k-row">
          <button type="button" className="btn btn-primary" onClick={run} disabled={act === "issue" && (!(n > 0) || n > item.onHand)}>
            {act === "issue" ? t("Issue to site") : act === "transfer" ? t("Transfer") : act === "count" ? t("Record count") : t("Set reorder level")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onRequest}>
            <ClipboardList size={14} />
            {t("Request more")}
          </button>
        </div>
      </div>

      <h3 className="po-drawer-h">{t("Movements")}</h3>
      {moves.length ? (
        <ul className="po-moves">
          {moves.map((m) => {
            const a = m.activityId ? s.activities.find((v) => v.id === m.activityId) : undefined;
            return (
              <li key={m.id}>
                <Badge tone={mvTone[m.type]}>{t(mvLabel[m.type])}</Badge>
                <span className="po-moves-main">
                  <b className={`num-inline ${m.qty >= 0 ? "k-text-ok" : ""}`}>
                    {m.qty >= 0 ? "+" : "−"}
                    {fmtQty(Math.abs(m.qty), item.unit)} {u}
                  </b>
                  <small>
                    {m.ref.startsWith("GRN") ? <Link to={R.receipt(m.ref)}>{m.ref}</Link> : <span className="k-mono">{m.ref}</span>}
                    {a ? (
                      <>
                        {" · "}
                        <Link to={R.programme(a.id)}>{a.code}</Link>
                      </>
                    ) : null}
                    {m.note ? ` · ${x(m.note)}` : ""}
                  </small>
                </span>
                <small className="num-inline muted">{d(m.at, false)}</small>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">{t("No movements recorded.")}</p>
      )}
    </div>
  );
}

function AddStockDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, x, lang } = useL();
  const s = useOps();
  const options = useMemo(() => s.materials.filter((m) => !s.stock.some((i) => i.key === m.key)).sort((a, b) => a.trade.localeCompare(b.trade) || a.name.en.localeCompare(b.name.en)), [s.materials, s.stock]);
  const [key, setKey] = useState("");
  const [store, setStore] = useState<Store>("Main store");
  const [onHand, setOnHand] = useState("0");
  const [reorder, setReorder] = useState("0");
  const mat = s.materials.find((m) => m.key === key);
  const save = () => {
    if (!mat) return;
    s.addStockItem({ key: mat.key, name: mat.name, unit: mat.unit, trade: mat.trade, store, onHand: Math.max(0, Number(onHand) || 0), reorder: Math.max(0, Number(reorder) || 0) });
    toast(t("{m} added to {s}", { m: x(mat.name), s: t(STORE_LABEL[store]) }));
    setKey("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Add stock item")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!mat}>
            {t("Add to stock")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Material")} wide>
          <select className="input select" value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">{t("Choose from the BOQ catalogue")}</option>
            {options.map((m) => (
              <option key={m.key} value={m.key}>
                {tradeName(m.trade, lang)} · {x(m.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Store")}>
          <select className="input select" value={store} onChange={(e) => setStore(e.target.value as Store)}>
            {STORES.map((st) => (
              <option key={st} value={st}>
                {t(STORE_LABEL[st])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={mat ? t("On hand ({u})", { u: unitLabel(mat.unit, lang) }) : t("On hand")}>
          <input className="input num" type="number" min={0} value={onHand} onChange={(e) => setOnHand(e.target.value)} />
        </Field>
        <Field label={t("Reorder level")}>
          <input className="input num" type="number" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
