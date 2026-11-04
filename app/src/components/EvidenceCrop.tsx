import { sheetById, sheetImage } from "../data";
import type { Box, Source } from "../data/types";

type Props = {
  source: Source;
  aspect?: number;
  minWidth?: number;
  tone?: "red" | "blue";
  className?: string;
};

/** A window onto the real sheet, centred on the cited box, with the box drawn in red pencil. */
export function EvidenceCrop({ source, aspect = 0.42, minWidth = 320, tone = "red", className }: Props) {
  const sheet = sheetById.get(source.sheet);
  if (!sheet) return null;
  const view = cropView(source.box, sheet.w, sheet.h, aspect, minWidth);
  const [x0, y0, x1, y1] = source.box;
  return (
    <svg
      className={`crop${className ? ` ${className}` : ""}`}
      viewBox={view.join(" ")}
      role="img"
      aria-label={`${source.sheet}: ${source.quote}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <image href={sheetImage(sheet.id)} width={sheet.w} height={sheet.h} preserveAspectRatio="none" />
      <rect
        key={`${source.sheet}-${source.box.join("-")}`}
        className={`mark mark-${tone}`}
        x={x0}
        y={y0}
        width={x1 - x0}
        height={y1 - y0}
        rx={view[2] / 260}
        pathLength={1}
        style={{ strokeWidth: view[2] / 190 }}
      />
    </svg>
  );
}

export function cropView(box: Box, w: number, h: number, aspect: number, minWidth: number): Box {
  const [x0, y0, x1, y1] = box;
  const bw = x1 - x0;
  const bh = y1 - y0;
  let cw = Math.max(bw + 90, minWidth);
  let ch = cw * aspect;
  if (bh + 50 > ch) {
    ch = bh + 50;
    cw = ch / aspect;
  }
  cw = Math.min(cw, w);
  ch = Math.min(ch, h);
  const cx = clamp((x0 + x1) / 2 - cw / 2, 0, w - cw);
  const cy = clamp((y0 + y1) / 2 - ch / 2, 0, h - ch);
  return [round(cx), round(cy), round(cw), round(ch)];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number) {
  return Math.round(v * 10) / 10;
}
