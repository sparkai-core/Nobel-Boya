import { data } from "../data";
import type { Boq } from "./boq";
import { fmtMoney, fmtQty, pct, unitLabel } from "./format";
import { translate } from "./i18n";
import { buildingName, chainLabel, projectName, projectPlace } from "./loc";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Opens a print-ready bill (save as PDF from the print dialog). */
export function printBill(boq: Boq, lang: "az" | "en") {
  const win = window.open("", "_blank");
  if (!win) return false;
  const logo = new URL("./brand/nobel-logo.png", window.location.href).href;
  const p = data.project;
  const tr = (s: string) => translate(lang, s);
  const rows = boq.buildings
    .map((b) => {
      const sections = b.sections
        .map(
          (s) =>
            `<tr class="sec"><td>${s.code}</td><td colspan="4">${esc(lang === "az" ? s.az : s.en)}</td><td class="n">${fmtMoney(s.total)}</td></tr>` +
            s.lines
              .map(
                (l) =>
                  `<tr><td>${l.code}</td><td>${esc(lang === "az" ? l.az : l.en)}</td><td>${unitLabel(l.unit, lang)}</td><td class="n">${fmtQty(l.qty, l.unit)}</td><td class="n">${fmtMoney(l.rate)}</td><td class="n">${fmtMoney(l.amount)}</td></tr>`,
              )
              .join(""),
        )
        .join("");
      return `<tr class="bld"><td>${b.code}</td><td colspan="4">${esc(buildingName(b.id, lang))}</td><td class="n">${fmtMoney(b.total)}</td></tr>${sections}`;
    })
    .join("");
  const chain = boq.chain
    .map((c) => `<tr><td>${esc(chainLabel(c.key, c.label, lang))}${c.rate != null ? ` ${pct(c.rate, 0)}` : ""}</td><td class="n">${fmtMoney(c.amount)}</td></tr>`)
    .join("");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(tr("Bill of quantities"))}, Nobel BOQ</title>
<style>
@page{size:A4;margin:14mm}
body{font-family:"Segoe UI",Arial,sans-serif;color:#111114;font-size:10px;margin:0}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5px solid #111114;padding-bottom:10px;margin-bottom:14px}
header img{height:46px}
h1{font-size:17px;margin:0 0 2px}
.meta{color:#6e6e78;font-size:10px;line-height:1.5}
table{width:100%;border-collapse:collapse}
td,th{padding:4px 6px;border-bottom:.5px solid #dedee5;vertical-align:top}
th{text-align:left;font-size:9px;color:#6e6e78;border-bottom:1px solid #111114}
.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.bld td{background:#f1f1f4;font-weight:700;font-size:11px}
.sec td{font-weight:600;color:#3f3f47}
.summary{width:50%;margin:0 0 16px auto}
.summary tr:last-child td{font-weight:700;font-size:12px;border-top:1.5px solid #111114}
thead{display:table-header-group}
tr{page-break-inside:avoid}
.note{color:#6e6e78;margin-top:12px}
</style></head><body>
<header><div><h1>${esc(projectName(lang))}</h1><div class="meta">${esc(tr("Bill of quantities"))}<br>${esc(projectPlace(lang))}<br>${esc(tr("Client"))}: ${esc(p.client)}. ${esc(tr("Designer"))}: ${esc(p.designer)}. ${esc(tr("Issue"))}: ${esc(p.issued)}.</div></div><img src="${logo}" alt="Nobel"></header>
<table class="summary"><tbody>${chain}<tr><td>${esc(tr("Total including VAT, AZN"))}</td><td class="n">${fmtMoney(boq.total)}</td></tr></tbody></table>
<table><thead><tr><th>${tr("Code")}</th><th>${tr("Description")}</th><th>${tr("Unit")}</th><th class="n">${tr("Quantity")}</th><th class="n">${tr("Rate")}</th><th class="n">${tr("Amount")}</th></tr></thead><tbody>${rows}</tbody></table>
<p class="note">${esc(tr("Quantities come from the four PDF files of the Qobu package. Rates are a sample AZN library, not part of the package."))} Nobel BOQ.</p>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`);
  win.document.close();
  return true;
}
