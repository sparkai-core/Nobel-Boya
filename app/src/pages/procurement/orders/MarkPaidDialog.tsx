import { useState } from "react";
import { Dialog, Field, Money, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import type { Payment } from "../../../ops/types";
import { vendorName } from "./shared";

const METHODS: NonNullable<Payment["method"]>[] = ["Bank transfer", "Cheque", "Cash"];

/** Records a payment as paid: method and bank / cheque reference. */
export function MarkPaidDialog({ payment, onClose, onDone }: { payment: Payment | null; onClose: () => void; onDone?: () => void }) {
  const { t } = useL();
  const s = useOps();
  const [method, setMethod] = useState<NonNullable<Payment["method"]>>("Bank transfer");
  const [ref, setRef] = useState("");
  if (!payment) return null;
  const needsRef = method !== "Cash";
  const save = () => {
    if (needsRef && !ref.trim()) return;
    s.markPaid(payment.id, method, ref.trim());
    toast(t("{ref} paid to {v}", { ref: payment.ref, v: vendorName(s, payment.vendorId) }));
    setRef("");
    onClose();
    onDone?.();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      kicker={payment.ref}
      title={t("Mark as paid")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={needsRef && !ref.trim()}>
            {t("Mark paid")}
          </button>
        </>
      }
    >
      <p className="po-dialog-lead">
        {t("Pay {v}", { v: vendorName(s, payment.vendorId) })} · <Money value={payment.amount} />
      </p>
      <div className="k-form">
        <Field label={t("Method")} wide>
          <div className="segmented" role="group">
            {METHODS.map((m) => (
              <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>
                {t(m)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={method === "Cheque" ? t("Cheque number") : t("Bank reference")} wide hint={needsRef ? undefined : t("No reference needed for cash.")}>
          <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={method === "Cheque" ? "CH-004512" : "KB-2611…"} disabled={!needsRef} />
        </Field>
      </div>
    </Dialog>
  );
}
