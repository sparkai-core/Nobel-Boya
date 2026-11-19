import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, same, TODAY } from "../../../ops/dates";
import { me } from "../../../ops/people";
import type { RecoveryScenario, Txt } from "../../../ops/types";

/** What a suggestion pre-fills; everything stays editable. */
export type ScenarioDraft = { name?: Txt; daysRecovered?: number; risk?: RecoveryScenario["risk"]; summary?: Txt; assumptions?: Txt[]; action?: Txt; due?: string };

const RISKS: RecoveryScenario["risk"][] = ["low", "medium", "high"];
const RISK_LABEL: Record<RecoveryScenario["risk"], string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };

/** New recovery scenario: the user enters the days it wins back, what it costs and who acts on it. */
export function ScenarioDialog({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: ScenarioDraft; onSaved?: (id: string) => void }) {
  const { t, x } = useL();
  const addScenario = useOps((s) => s.addScenario);
  const [name, setName] = useState("");
  const [days, setDays] = useState(1);
  const [cost, setCost] = useState("");
  const [risk, setRisk] = useState<RecoveryScenario["risk"]>("medium");
  const [summary, setSummary] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [action, setAction] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState(addDays(TODAY, 7));
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ? x(initial.name) : "");
    setDays(initial?.daysRecovered ?? 1);
    setCost("");
    setRisk(initial?.risk ?? "medium");
    setSummary(initial?.summary ? x(initial.summary) : "");
    setAssumptions((initial?.assumptions ?? []).map((a) => x(a)).join("\n"));
    setAction(initial?.action ? x(initial.action) : "");
    setOwner(me());
    setDue(initial?.due ?? addDays(TODAY, 7));
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Keeps the bilingual text of a suggestion when the user did not change it. */
  const keep = (value: string, orig: Txt | undefined): Txt => (orig && x(orig) === value ? orig : same(value));
  const costNum = Number(cost.replace(",", "."));
  const costOk = cost.trim() !== "" && Number.isFinite(costNum) && costNum >= 0;

  const save = () => {
    setTried(true);
    if (!name.trim() || days <= 0 || !costOk) return;
    const lines = assumptions.split("\n").map((l) => l.trim()).filter(Boolean);
    const origA = initial?.assumptions ?? [];
    const id = addScenario({
      name: keep(name.trim(), initial?.name),
      daysRecovered: days,
      cost: Math.round(costNum),
      risk,
      summary: keep(summary.trim(), initial?.summary),
      assumptions: lines.map((l) => origA.find((a) => x(a) === l) ?? same(l)),
      actions: action.trim() ? [{ title: keep(action.trim(), initial?.action), owner: owner.trim() || me(), due, days }] : [],
    });
    toast(t("{id} created: {n} days back", { id, n: days }));
    onSaved?.(id);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={600}
      kicker={t("Recovery")}
      title={t("New recovery scenario")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            <PlayCircle size={15} />
            {t("Create scenario")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Name")} wide error={tried && !name.trim() ? t("Give the scenario a name.") : undefined}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Second crew on the frame")} autoFocus />
        </Field>
        <Field label={t("Days won back")} error={tried && days <= 0 ? t("At least one day.") : undefined}>
          <input className="input num-inline" type="number" min={1} value={days} onChange={(e) => setDays(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
        </Field>
        <Field label={t("Cost (AZN)")} error={tried && !costOk ? t("Enter the cost, 0 if none.") : undefined}>
          <input className="input num-inline" type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
        </Field>
        <Field label={t("Risk")}>
          <select className="input select" value={risk} onChange={(e) => setRisk(e.target.value as RecoveryScenario["risk"])}>
            {RISKS.map((r) => (
              <option key={r} value={r}>
                {t(RISK_LABEL[r])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("What it means")} wide>
          <textarea className="input" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <Field label={t("Assumptions")} wide hint={t("One per line.")}>
          <textarea className="input" rows={2} value={assumptions} onChange={(e) => setAssumptions(e.target.value)} />
        </Field>
        <Field label={t("First action")} wide>
          <input className="input" value={action} onChange={(e) => setAction(e.target.value)} placeholder={t("What has to happen first")} />
        </Field>
        <Field label={t("Owner")}>
          <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
        <Field label={t("Due")}>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value || TODAY)} />
        </Field>
      </div>
    </Dialog>
  );
}
