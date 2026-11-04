import { buildingById, data, docByCode, sectionById, sheetById } from "../data";
import type { Boq } from "./boq";
import { unitLabel } from "./format";
import { METHOD_LABEL } from "../components/ui";

const INK = "FF1E2227";
const STAMP = "FF2D4A9A";
const BAND = "FFEFEFEB";
const SECTION = "FFF7F7F4";
const MONEY = "#,##0.00";

export async function exportWorkbook(boq: Boq, fixes: Record<string, boolean>) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Storm Takeoff";
  wb.created = new Date();
  const font = { name: "Calibri", size: 10, color: { argb: INK } };

  const header = (ws: import("exceljs").Worksheet, row: number) => {
    const r = ws.getRow(row);
    r.font = { ...font, bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STAMP } };
    r.alignment = { vertical: "middle" };
    r.height = 20;
  };

  // Summary
  const sum = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  sum.columns = [{ width: 8 }, { width: 58 }, { width: 46 }, { width: 18 }];
  sum.getCell("A1").value = data.project.nameEn;
  sum.getCell("A1").font = { ...font, size: 14, bold: true };
  sum.getCell("A2").value = `${data.project.name}. ${data.project.place}.`;
  sum.getCell("A3").value = `Client: ${data.project.client}. Designer: ${data.project.designer}. Working design issued ${data.project.issued}.`;
  sum.getCell("A4").value = "Quantities from the four PDF files of the package. Rates are a sample AZN library, not part of the package.";
  sum.getCell("A4").font = { ...font, italic: true, color: { argb: "FF6A6E74" } };
  sum.getRow(6).values = ["Code", "Structure (AZ)", "Structure (EN)", "Amount, AZN"];
  header(sum, 6);
  let r = 7;
  for (const b of boq.buildings) {
    sum.getRow(r).values = [b.code, b.az, b.en, b.total];
    sum.getCell(`D${r}`).numFmt = MONEY;
    r++;
  }
  r++;
  for (const c of boq.chain) {
    sum.getRow(r).values = ["", c.rate != null ? `${c.label} ${(c.rate * 100).toFixed(1)}%` : c.label, "", c.amount];
    sum.getCell(`D${r}`).numFmt = MONEY;
    r++;
  }
  sum.getRow(r).values = ["", "Total including VAT", "", boq.total];
  sum.getRow(r).font = { ...font, bold: true };
  sum.getCell(`D${r}`).numFmt = MONEY;
  sum.getRow(r).border = { top: { style: "thin", color: { argb: INK } } };

  // Bill
  const bill = wb.addWorksheet("Bill", { views: [{ state: "frozen", ySplit: 1 }] });
  bill.columns = [
    { header: "Code", width: 9 },
    { header: "Description (AZ)", width: 62 },
    { header: "Description (EN)", width: 58 },
    { header: "Unit", width: 7 },
    { header: "Quantity", width: 12 },
    { header: "Rate, AZN", width: 11 },
    { header: "Amount, AZN", width: 15 },
    { header: "Evidence", width: 17 },
    { header: "Sheets", width: 20 },
    { header: "Note", width: 40 },
  ];
  header(bill, 1);
  let row = 2;
  for (const b of boq.buildings) {
    const br = bill.getRow(row);
    br.values = [b.code, b.az, b.en, "", "", "", b.total];
    br.font = { ...font, bold: true };
    br.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } };
    bill.getCell(`G${row}`).numFmt = MONEY;
    row++;
    for (const s of b.sections) {
      const sr = bill.getRow(row);
      const sRow = row;
      sr.values = [s.code, s.az, s.en];
      sr.font = { ...font, bold: true };
      sr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION } };
      row++;
      const first = row;
      for (const l of s.lines) {
        const sheets = [...new Set(l.items.flatMap((i) => i.src.map((x) => x.sheet)))].join(", ");
        const note = [
          l.items.map((i) => i.formula).filter(Boolean).join("; "),
          l.adjusted === "fix" ? "Corrected after check" : l.adjusted === "override" ? "Quantity overridden" : "",
          l.checks.filter((c) => c.severity !== "ok").map((c) => `${c.id}: ${c.title}`).join("; "),
        ]
          .filter(Boolean)
          .join(". ");
        const lr = bill.getRow(row);
        lr.values = [l.code, l.az, l.en, unitLabel(l.unit, "az"), l.qty, l.rate, { formula: `E${row}*F${row}`, result: l.amount }, METHOD_LABEL[l.method], sheets, note];
        lr.font = font;
        lr.alignment = { vertical: "top", wrapText: true };
        bill.getCell(`E${row}`).numFmt = l.unit === "ədəd" || l.unit === "dəst" || l.unit === "komp" ? "#,##0" : MONEY;
        bill.getCell(`F${row}`).numFmt = MONEY;
        bill.getCell(`G${row}`).numFmt = MONEY;
        row++;
      }
      bill.getCell(`G${sRow}`).value = { formula: `SUM(G${first}:G${row - 1})`, result: s.total };
      bill.getCell(`G${sRow}`).numFmt = MONEY;
    }
  }
  bill.getRow(row + 1).values = ["", "Measured works", "", "", "", "", boq.works];
  bill.getRow(row + 1).font = { ...font, bold: true };
  bill.getCell(`G${row + 1}`).numFmt = MONEY;

  // Takeoff with sources
  const tk = wb.addWorksheet("Takeoff and sources", { views: [{ state: "frozen", ySplit: 1 }] });
  tk.columns = [
    { header: "Item", width: 18 },
    { header: "Bill line", width: 9 },
    { header: "Structure", width: 16 },
    { header: "Section", width: 24 },
    { header: "Description (AZ)", width: 54 },
    { header: "Unit", width: 7 },
    { header: "Quantity", width: 12 },
    { header: "Evidence", width: 16 },
    { header: "Formula", width: 36 },
    { header: "Sheet", width: 9 },
    { header: "File", width: 40 },
    { header: "Page", width: 6 },
    { header: "Printed text on the sheet", width: 70 },
    { header: "Located", width: 12 },
  ];
  header(tk, 1);
  for (const it of data.items) {
    it.src.forEach((s, i) => {
      const sh = sheetById.get(s.sheet);
      tk.addRow([
        i === 0 ? it.id : "",
        i === 0 ? boq.lineByItem.get(it.id)?.code ?? "" : "",
        i === 0 ? buildingById.get(it.building)?.short ?? "" : "",
        i === 0 ? sectionById.get(it.section)?.en ?? "" : "",
        i === 0 ? it.az : "",
        i === 0 ? unitLabel(it.unit, "az") : "",
        i === 0 ? it.qty : null,
        i === 0 ? METHOD_LABEL[it.method] : "",
        i === 0 ? it.formula ?? "" : "",
        s.sheet,
        sh ? docByCode.get(sh.doc)?.file : "",
        sh?.page ?? "",
        s.quote,
        s.how === "text" ? "Text layer" : "From image",
      ]).font = font;
    });
  }

  // Checks
  const ck = wb.addWorksheet("Checks", { views: [{ state: "frozen", ySplit: 1 }] });
  ck.columns = [
    { header: "Check", width: 7 },
    { header: "Result", width: 10 },
    { header: "Structure", width: 16 },
    { header: "Finding", width: 56 },
    { header: "Detail", width: 100 },
    { header: "Sheets", width: 26 },
    { header: "In the bill", width: 22 },
  ];
  header(ck, 1);
  for (const c of data.checks) {
    const rr = ck.addRow([
      c.id,
      { error: "Error", warn: "Conflict", info: "Note", ok: "Agrees" }[c.severity],
      buildingById.get(c.building)?.short ?? "",
      c.title,
      c.detail,
      [...new Set(c.sources.map((s) => s.sheet))].join(", "),
      c.fix ? (fixes[c.id] ? "Correction applied" : "Printed value used") : "",
    ]);
    rr.font = font;
    rr.alignment = { vertical: "top", wrapText: true };
  }

  // Rates
  const rt = wb.addWorksheet("Rates");
  rt.columns = [
    { header: "Rate", width: 14 },
    { header: "Group", width: 20 },
    { header: "Description", width: 60 },
    { header: "Unit", width: 7 },
    { header: "Sample rate", width: 12 },
    { header: "Rate used", width: 12 },
  ];
  header(rt, 1);
  const used = new Map(boq.lines.map((l) => [l.rateKey, l.rate]));
  for (const [key, v] of Object.entries(data.rates)) {
    if (!used.has(key)) continue;
    const rr = rt.addRow([key, v.group, v.en, unitLabel(v.unit, "en"), v.rate, used.get(key)]);
    rr.font = font;
    rr.getCell(5).numFmt = MONEY;
    rr.getCell(6).numFmt = MONEY;
  }

  // Gaps
  const gp = wb.addWorksheet("Not in the package");
  gp.columns = [{ header: "Item", width: 34 }, { header: "AZ", width: 40 }, { header: "Why it is not billed", width: 110 }];
  header(gp, 1);
  for (const g of data.gaps) gp.addRow([g.en, g.az, g.detail]).font = font;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Qobu-BOQ-Storm.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
