const UNIT_EN: Record<string, string> = { "ədəd": "no.", "dəst": "set", komp: "set", kg: "kg", m: "m", "m²": "m²", "m³": "m³" };
const UNIT_AZ: Record<string, string> = { "ədəd": "ədəd", "dəst": "dəst", komp: "komp.", kg: "kq", m: "m", "m²": "m²", "m³": "m³" };

export function unitLabel(unit: string, lang: "az" | "en") {
  return (lang === "az" ? UNIT_AZ : UNIT_EN)[unit] ?? unit;
}

const nf = new Map<number, Intl.NumberFormat>();
function fmtr(digits: number) {
  let f = nf.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    nf.set(digits, f);
  }
  return f;
}

export function qtyDigits(unit: string) {
  return unit === "ədəd" || unit === "dəst" || unit === "komp" ? 0 : 2;
}

export function fmtQty(v: number, unit: string) {
  return fmtr(qtyDigits(unit)).format(v);
}

export function fmtNum(v: number, digits = 2) {
  return fmtr(digits).format(v);
}

export function fmtMoney(v: number) {
  return fmtr(2).format(v);
}

export function fmtMoneyShort(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${fmtr(2).format(v / 1_000_000)} m`;
  if (Math.abs(v) >= 10_000) return `${fmtr(1).format(v / 1_000)} k`;
  return fmtr(0).format(v);
}

export function pct(v: number, digits = 1) {
  return `${fmtr(digits).format(v * 100)}%`;
}
