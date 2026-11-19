import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { data } from "../../../data";
import { useOps } from "../../../ops/store";
import { createWbsNode, deleteWbsNode, updateWbsNode, wbsOptions } from "../../../ops/ext/planning-client";
import type { WbsNode } from "../../../ops/types";

/** Add or edit a WBS item: where it sits (parent), its code, its name and, optionally, the building it covers. */
export function WbsDialog({ open, onClose, node, parentId, onSaved }: { open: boolean; onClose: () => void; node?: WbsNode | null; parentId?: string | null; onSaved?: (id: string) => void }) {
  const { t, x, lang } = useL();
  const wbs = useOps((s) => s.wbs);
  const activities = useOps((s) => s.activities);
  const options = useMemo(() => wbsOptions(wbs), [wbs]);
  const editing = !!node;
  const [parent, setParent] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [building, setBuilding] = useState("");
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A node cannot move under itself or one of its own sub-items.
  const below = useMemo(() => {
    const out = new Set<string>();
    if (!node) return out;
    const stack = [node.id];
    while (stack.length) {
      const cur = stack.pop()!;
      out.add(cur);
      for (const w of wbs) if (w.parentId === cur && !out.has(w.id)) stack.push(w.id);
    }
    return out;
  }, [node, wbs]);

  const suggest = (pid: string) => {
    const p = wbs.find((w) => w.id === pid);
    const siblings = wbs.filter((w) => (w.parentId ?? "") === pid);
    const prefix = p ? `${p.code}.` : "";
    return `${prefix}${siblings.length + 1}`;
  };

  useEffect(() => {
    if (!open) return;
    setTried(false);
    setConfirmDelete(false);
    if (node) {
      setParent(node.parentId ?? "");
      setCode(node.code);
      setName(x(node.name));
      setBuilding(node.building ?? "");
    } else {
      const root = wbs.find((w) => w.parentId === null);
      const pid = parentId ?? root?.id ?? "";
      setParent(pid);
      setCode(suggest(pid));
      setName("");
      setBuilding(wbs.find((w) => w.id === pid)?.building ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.id, parentId]);

  const hasRoot = wbs.some((w) => w.parentId === null && w.id !== node?.id);
  const codeTaken = wbs.some((w) => w.code.trim() === code.trim() && w.id !== node?.id);
  const errors = {
    code: !code.trim() ? t("Give the item a code.") : codeTaken ? t("Another WBS item already has this code.") : null,
    name: !name.trim() ? t("Give the item a name.") : null,
    parent: !parent && hasRoot && !(node && node.parentId === null) ? t("Choose where it sits: the project already has a top item.") : null,
  };
  const ok = !Object.values(errors).some(Boolean);
  const kids = node ? wbs.filter((w) => w.parentId === node.id).length : 0;
  const acts = node ? activities.filter((a) => a.wbsId === node.id).length : 0;

  const save = () => {
    setTried(true);
    if (!ok) return;
    const input = { parentId: parent || null, code, name, building: building || null };
    if (node) {
      const id = updateWbsNode(node.id, input);
      toast(t("WBS item saved"));
      if (id) onSaved?.(id);
    } else {
      const id = createWbsNode(input);
      toast(t("WBS item added"));
      onSaved?.(id);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={560}
      kicker={t("Work breakdown")}
      title={editing ? t("Edit WBS item") : t("Add a WBS item")}
      footer={
        confirmDelete ? (
          <>
            <span className="small k-text-bad pp-foot-note">{acts ? t("Delete this item? Its {n} activities move up to the item above.", { n: acts }) : t("Delete this item?")}</span>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              {t("Keep it")}
            </button>
            <button
              type="button"
              className="btn pp-danger"
              onClick={() => {
                if (node && deleteWbsNode(node.id)) toast(t("WBS item deleted"), "muted");
                onClose();
              }}
            >
              <Trash2 size={15} /> {t("Delete")}
            </button>
          </>
        ) : (
          <>
            {editing ? (
              <button type="button" className="btn btn-ghost k-text-bad pp-foot-left" onClick={() => setConfirmDelete(true)} disabled={kids > 0} title={kids ? t("Delete or move its sub-items first.") : undefined}>
                <Trash2 size={15} /> {t("Delete")}
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={tried && !ok}>
              {editing ? t("Save changes") : t("Add item")}
            </button>
          </>
        )
      }
    >
      <div className="k-form">
        <Field label={t("Sits under")} error={tried ? errors.parent : null}>
          <select
            className="input select"
            value={parent}
            onChange={(e) => {
              setParent(e.target.value);
              if (!editing) setCode(suggest(e.target.value));
            }}
          >
            <option value="">{hasRoot ? t("Choose an item") : t("Nothing: this is the top item")}</option>
            {options
              .filter((o) => !below.has(o.node.id))
              .map(({ node: w, depth }) => (
                <option key={w.id} value={w.id}>
                  {"  ".repeat(depth)}
                  {w.code} · {x(w.name)}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t("Code")} error={tried ? errors.code : null}>
          <input className="input k-mono" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label={t("Name")} error={tried ? errors.name : null}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Superstructure")} autoFocus={!editing} />
        </Field>
        <Field label={t("Building (optional)")}>
          <select className="input select" value={building} onChange={(e) => setBuilding(e.target.value)}>
            <option value="">{t("None")}</option>
            {(data.buildings ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {lang === "az" ? b.az : b.en}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Dialog>
  );
}
