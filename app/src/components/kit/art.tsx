import type { ReactNode } from "react";

/**
 * Animated line art for page headers (300 × 132). Strokes use the brand violet; `.k-art-flow` lines
 * march, `.k-art-pulse` dots breathe, `.k-art-grow` bars rise once. All motion stops under
 * prefers-reduced-motion (see kit.css).
 */
export type ArtName =
  | "request"
  | "rfq"
  | "quotes"
  | "compare"
  | "approve"
  | "order"
  | "receipt"
  | "stock"
  | "exception"
  | "pay"
  | "vendor"
  | "budget"
  | "procurement"
  | "programme"
  | "wbs"
  | "milestone"
  | "critical"
  | "network"
  | "calendar"
  | "risk"
  | "delay"
  | "live"
  | "recovery"
  | "health"
  | "progress"
  | "report"
  | "ai"
  | "rfi"
  | "change"
  | "inspection"
  | "billing"
  | "parties"
  | "subs"
  | "portal"
  | "pm";

const S = "var(--stamp-text)";

const Sheet = ({ x, y, w = 70, h = 88, rows = 5, check = false }: { x: number; y: number; w?: number; h?: number; rows?: number; check?: boolean }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={6} className="k-art-paper" />
    {Array.from({ length: rows }, (_, i) => (
      <g key={i}>
        {check ? <rect x={x + 10} y={y + 14 + i * 14} width={7} height={7} rx={1.5} className={i < 3 ? "k-art-fill" : "k-art-line"} /> : null}
        <line x1={x + (check ? 22 : 10)} x2={x + w - 10 - (i % 2) * 14} y1={y + 18 + i * 14} y2={y + 18 + i * 14} className="k-art-line" />
      </g>
    ))}
  </g>
);

function art(name: ArtName): ReactNode {
  switch (name) {
    case "request":
      return (
        <>
          <Sheet x={40} y={22} check />
          <path d="M120 66 H205" className="k-art-flow" />
          <path d="M198 59 l9 7 -9 7" className="k-art-line" />
          <circle cx={238} cy={66} r={22} className="k-art-paper" />
          <path d="M228 66 l7 7 13 -14" className="k-art-strong" />
          <circle cx={120} cy={66} r={3.5} className="k-art-pulse" />
        </>
      );
    case "rfq":
      return (
        <>
          <Sheet x={30} y={30} w={58} h={72} rows={4} />
          {[22, 54, 86, 112].map((y, i) => (
            <g key={i}>
              <path d={`M92 66 C140 66 150 ${y + 8} 200 ${y + 8}`} className="k-art-flow" style={{ animationDelay: `${i * 0.2}s` }} />
              <rect x={204} y={y} width={60} height={16} rx={8} className={i === 1 ? "k-art-fill-soft" : "k-art-paper"} />
              <circle cx={214} cy={y + 8} r={3.5} className={i === 1 ? "k-art-pulse" : "k-art-dot"} />
            </g>
          ))}
        </>
      );
    case "quotes":
      return (
        <>
          {[0, 1, 2].map((i) => (
            <Sheet key={i} x={30 + i * 14} y={18 + i * 10} w={64} h={80} rows={4} />
          ))}
          {[30, 56, 82].map((y, i) => (
            <g key={i}>
              <path d={`M128 ${y + 20} H170`} className="k-art-flow" />
              <rect x={176} y={y + 13} width={[78, 96, 64][i]} height={14} rx={4} className={i === 2 ? "k-art-fill k-art-grow" : "k-art-fill-soft k-art-grow"} style={{ animationDelay: `${i * 0.15}s` }} />
            </g>
          ))}
        </>
      );
    case "compare":
      return (
        <>
          {[0, 1, 2].map((c) => (
            <g key={c}>
              <rect x={50 + c * 72} y={16} width={60} height={100} rx={8} className={c === 1 ? "k-art-fill-soft k-art-win" : "k-art-paper"} />
              {[0, 1, 2, 3].map((r) => (
                <rect key={r} x={60 + c * 72} y={30 + r * 20} width={[34, 40, 26, 38][(r + c) % 4]} height={7} rx={3.5} className={c === 1 ? "k-art-fill" : "k-art-line-fill"} />
              ))}
            </g>
          ))}
          <path d="M152 124 l8 -6 8 6" className="k-art-strong" />
        </>
      );
    case "approve":
      return (
        <>
          <Sheet x={44} y={20} w={76} h={92} rows={5} />
          <circle cx={108} cy={92} r={20} className="k-art-stamp" />
          <path d="M100 92 l6 6 11 -12" className="k-art-strong" />
          <path d="M140 66 H190" className="k-art-flow" />
          {[0, 1].map((i) => (
            <g key={i}>
              <circle cx={206 + i * 44} cy={66} r={12} className={i ? "k-art-paper" : "k-art-fill-soft"} />
              <circle cx={206 + i * 44} cy={66} r={4} className={i ? "k-art-dot" : "k-art-pulse"} />
            </g>
          ))}
          <line x1={218} x2={238} y1={66} y2={66} className="k-art-line" strokeDasharray="3 3" />
        </>
      );
    case "order":
      return (
        <>
          <Sheet x={30} y={22} w={68} h={88} rows={5} />
          <rect x={72} y={78} width={34} height={20} rx={4} className="k-art-stamp" transform="rotate(-12 89 88)" />
          <path d="M112 74 H160" className="k-art-flow" />
          <rect x={168} y={50} width={62} height={38} rx={5} className="k-art-paper" />
          <path d="M230 62 h22 l14 14 v12 h-36z" className="k-art-paper" />
          <circle cx={188} cy={94} r={8} className="k-art-fill-soft" />
          <circle cx={248} cy={94} r={8} className="k-art-fill-soft" />
          <circle cx={112} cy={74} r={3.5} className="k-art-pulse" />
        </>
      );
    case "receipt":
      return (
        <>
          <rect x={20} y={56} width={52} height={30} rx={4} className="k-art-paper" />
          <path d="M72 64 h16 l10 10 v12 h-26z" className="k-art-paper" />
          <circle cx={36} cy={90} r={6} className="k-art-fill-soft" />
          <circle cx={84} cy={90} r={6} className="k-art-fill-soft" />
          <path d="M106 80 H140" className="k-art-flow" />
          <rect x={146} y={34} width={10} height={66} rx={2} className="k-art-fill" />
          <path d="M162 80 H186" className="k-art-flow" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={194 + (i % 3) * 28} y={50 + Math.floor(i / 3) * 26} width={24} height={22} rx={3} className={i < 4 ? "k-art-fill-soft k-art-grow" : "k-art-paper"} style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </>
      );
    case "stock":
      return (
        <>
          {[62, 38, 84, 20, 54, 74].map((h, i) => (
            <g key={i}>
              <rect x={30 + i * 42} y={20} width={30} height={92} rx={5} className="k-art-paper" />
              <rect x={30 + i * 42} y={112 - h} width={30} height={h} rx={5} className={h < 40 ? "k-art-warn k-art-grow" : "k-art-fill-soft k-art-grow"} style={{ animationDelay: `${i * 0.08}s` }} />
            </g>
          ))}
          <line x1={22} x2={282} y1={74} y2={74} className="k-art-flow" />
        </>
      );
    case "exception":
      return (
        <>
          <path d="M20 66 H280" className="k-art-line" />
          {[50, 110, 170, 230].map((x, i) => (
            <g key={i}>
              <circle cx={x} cy={66} r={10} className={i === 2 ? "k-art-stamp" : "k-art-paper"} />
              {i === 2 ? <path d={`M${x} 60 v7 M${x} 71 v1`} className="k-art-strong" /> : <circle cx={x} cy={66} r={3} className="k-art-dot" />}
            </g>
          ))}
          {[24, 40, 30].map((h, i) => (
            <rect key={i} x={160 + i * 8} y={52 - h} width={6} height={h} rx={2} className="k-art-warn k-art-grow" />
          ))}
          <path d="M60 66 H100" className="k-art-flow" />
        </>
      );
    case "pay":
      return (
        <>
          <line x1={20} x2={280} y1={104} y2={104} className="k-art-line" />
          {[[40, 60, 1], [80, 40, 1], [120, 72, 1], [160, 50, 0], [200, 82, 0], [240, 34, 2]].map(([x, h, k], i) => (
            <g key={i}>
              <line x1={x} x2={x} y1={104} y2={104 - h!} className="k-art-line" />
              <circle cx={x} cy={104 - h!} r={7} className={k === 1 ? "k-art-fill k-art-grow" : k === 2 ? "k-art-paper" : "k-art-fill-soft k-art-grow"} />
            </g>
          ))}
          <circle cx={160} cy={54} r={3} className="k-art-pulse" />
        </>
      );
    case "vendor":
      return (
        <>
          <line x1={20} x2={280} y1={100} y2={100} className="k-art-line" />
          {[[48, 3], [84, 5], [120, 6], [150, 7], [178, 8], [214, 9], [252, 6]].map(([x, h], i) => (
            <rect key={i} x={x! - 10} y={100 - h! * 9} width={20} height={h! * 9} rx={4} className={i === 5 ? "k-art-fill k-art-grow" : "k-art-fill-soft k-art-grow"} style={{ animationDelay: `${i * 0.06}s` }} />
          ))}
          <path d="M204 10 l10 8 10 -8" className="k-art-strong" />
        </>
      );
    case "budget":
    case "billing":
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect x={40} y={18 + i * 20} width={220} height={12} rx={6} className="k-art-paper" />
              <rect x={40} y={18 + i * 20} width={[180, 120, 200, 90, 150][i]} height={12} rx={6} className="k-art-fill-soft k-art-grow" style={{ animationDelay: `${i * 0.1}s` }} />
              <rect x={40} y={18 + i * 20} width={[120, 60, 170, 30, 90][i]} height={12} rx={6} className="k-art-fill k-art-grow" style={{ animationDelay: `${i * 0.1 + 0.2}s` }} />
            </g>
          ))}
          <line x1={210} x2={210} y1={10} y2={122} className="k-art-flow" />
        </>
      );
    case "procurement":
      return (
        <>
          {["M", "R", "Q", "A", "O", "G", "P"].map((l, i) => (
            <g key={l}>
              <circle cx={30 + i * 40} cy={66} r={13} className={i < 4 ? "k-art-fill-soft" : "k-art-paper"} />
              <text x={30 + i * 40} y={70} textAnchor="middle" className="k-art-text">
                {l}
              </text>
              {i ? <path d={`M${-4 + i * 40} 66 H${16 + i * 40}`} className="k-art-flow" /> : null}
            </g>
          ))}
          <circle cx={150} cy={66} r={18} className="k-art-ring" />
        </>
      );
    case "programme":
    case "pm":
      return (
        <>
          {[[20, 70], [60, 90], [110, 60], [150, 100], [190, 70]].map(([x, w], i) => (
            <rect key={i} x={x} y={18 + i * 20} width={w} height={11} rx={5.5} className={i === 2 || i === 3 ? "k-art-fill k-art-grow" : "k-art-fill-soft k-art-grow"} style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
          <path d="M90 24 v14 h20" className="k-art-line" />
          <path d="M150 44 v14 h0" className="k-art-line" />
          <line x1={132} x2={132} y1={8} y2={124} className="k-art-flow" />
          <path d="M252 88 l8 -8 v16z" className="k-art-warn" />
        </>
      );
    case "wbs":
    case "parties":
    case "subs":
      return (
        <>
          <rect x={120} y={10} width={60} height={22} rx={6} className="k-art-fill-soft" />
          <path d="M150 32 v12 M60 44 H240 M60 44 v12 M150 44 v12 M240 44 v12" className="k-art-line" />
          {[30, 120, 210].map((x, i) => (
            <g key={i}>
              <rect x={x} y={56} width={60} height={20} rx={6} className={i === 1 ? "k-art-fill" : "k-art-paper"} />
              <path d={`M${x + 30} 76 v10`} className="k-art-line" />
              <rect x={x + 8} y={86} width={44} height={14} rx={5} className="k-art-paper" />
              <rect x={x + 8} y={104} width={44} height={14} rx={5} className="k-art-paper" />
            </g>
          ))}
          <circle cx={150} cy={21} r={3.5} className="k-art-pulse" />
        </>
      );
    case "milestone":
      return (
        <>
          <line x1={20} x2={280} y1={66} y2={66} className="k-art-line" />
          {[[50, 50], [110, 120], [170, 186], [230, 252]].map(([a, b], i) => (
            <g key={i}>
              <path d={`M${a} 66 H${b}`} className={b! - a! > 12 ? "k-art-warn-line" : "k-art-strong"} />
              <path d={`M${a} 56 l10 10 -10 10 -10 -10z`} className="k-art-paper" />
              <path d={`M${b} 58 l8 8 -8 8 -8 -8z`} className={i === 0 ? "k-art-fill" : "k-art-fill-soft"} />
            </g>
          ))}
          <line x1={140} x2={140} y1={20} y2={112} className="k-art-flow" />
        </>
      );
    case "critical":
    case "network":
      return (
        <>
          {[[40, 40], [40, 96], [110, 66], [180, 30], [180, 100], [250, 66]].map(([x, y], i) => (
            <rect key={i} x={x! - 18} y={y! - 10} width={36} height={20} rx={5} className={[0, 2, 3, 5].includes(i) ? "k-art-fill-soft" : "k-art-paper"} />
          ))}
          <path d="M58 40 L92 62 M58 96 L92 70 M128 62 L162 34 M128 70 L162 96 M198 30 L232 62 M198 100 L232 70" className="k-art-line" />
          <path d="M58 40 L92 62 M128 62 L162 34 M198 30 L232 62" className="k-art-flow-hot" />
        </>
      );
    case "calendar":
      return (
        <>
          {Array.from({ length: 35 }, (_, i) => (
            <rect key={i} x={50 + (i % 7) * 30} y={12 + Math.floor(i / 7) * 22} width={24} height={17} rx={4} className={i % 7 === 6 ? "k-art-line-fill" : [9, 10, 23].includes(i) ? "k-art-fill" : i === 17 ? "k-art-ring" : "k-art-paper"} />
          ))}
        </>
      );
    case "risk":
    case "health":
    case "progress":
      return (
        <>
          <path d="M20 112 C80 112 100 100 140 70 C180 40 220 24 280 20" className="k-art-line" />
          <path d="M20 112 C80 112 110 106 140 84" className="k-art-strong" />
          <path d="M140 84 C170 64 220 46 280 40" className="k-art-flow" />
          <line x1={140} x2={140} y1={10} y2={122} className="k-art-line" strokeDasharray="2 4" />
          <circle cx={140} cy={84} r={5} className="k-art-pulse" />
          {name === "risk"
            ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={186 + i * 11} y={112 - [10, 22, 36, 48, 40, 28, 16, 8][i]!} width={8} height={[10, 22, 36, 48, 40, 28, 16, 8][i]} rx={2} className="k-art-fill-soft k-art-grow" />)
            : null}
        </>
      );
    case "delay":
    case "live":
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={20} y={20 + i * 26} width={260} height={10} rx={5} className="k-art-paper" />
          ))}
          {[[20, 120], [60, 160], [100, 130], [140, 110]].map(([x, w], i) => (
            <rect key={i} x={x} y={20 + i * 26} width={w} height={10} rx={5} className={i === 2 ? "k-art-warn k-art-grow" : "k-art-fill-soft k-art-grow"} />
          ))}
          <line x1={176} x2={176} y1={12} y2={124} className="k-art-flow" />
          <path d="M196 64 l10 -16 10 16z" className="k-art-stamp" />
          <circle cx={206} cy={60} r={1.6} className="k-art-dot" />
        </>
      );
    case "recovery":
      return (
        <>
          {[[30, 90], [80, 70], [130, 52], [180, 40], [230, 30]].map(([x, h], i) => (
            <rect key={i} x={x} y={112 - h!} width={34} height={i === 0 ? h : 14} rx={4} className={i === 0 ? "k-art-warn k-art-grow" : "k-art-fill k-art-grow"} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
          <path d="M64 22 H264" className="k-art-line" strokeDasharray="4 4" />
          <path d="M47 22 C120 30 200 70 247 82" className="k-art-flow" />
        </>
      );
    case "report":
    case "rfi":
    case "change":
    case "inspection":
      return (
        <>
          <Sheet x={56} y={14} w={86} h={104} rows={6} check={name === "inspection" || name === "report"} />
          <path d="M150 66 H190" className="k-art-flow" />
          <circle cx={222} cy={66} r={28} className="k-art-fill-soft" />
          {name === "rfi" ? <text x={222} y={76} textAnchor="middle" className="k-art-text-lg">?</text> : name === "change" ? <path d="M210 74 l12 -18 12 18 M216 64 h12" className="k-art-strong" /> : <path d="M208 66 l9 9 17 -18" className="k-art-strong" />}
        </>
      );
    case "ai":
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={20} y={18 + i * 26} width={260} height={16} rx={4} className="k-art-paper" />
              <rect x={30 + ((i * 47) % 120)} y={20 + i * 26} width={[60, 80, 50, 90][i]} height={12} rx={3} className={i === 2 ? "k-art-fill k-art-grow" : "k-art-fill-soft k-art-grow"} />
            </g>
          ))}
          <rect x={176} y={70} width={50} height={12} rx={3} className="k-art-ghost" />
          <path d="M226 76 C246 76 246 104 214 102" className="k-art-flow" />
          <path d="M256 12 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" className="k-art-fill k-art-twinkle" />
        </>
      );
    case "portal":
      return (
        <>
          <rect x={60} y={14} width={180} height={104} rx={10} className="k-art-paper" />
          <rect x={60} y={14} width={180} height={18} rx={10} className="k-art-fill-soft" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={74 + i * 10} cy={23} r={2.5} className="k-art-dot" />
          ))}
          <rect x={74} y={44} width={70} height={60} rx={6} className="k-art-fill-soft" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={156} y={46 + i * 20} width={[70, 54, 62][i]} height={10} rx={5} className={i === 0 ? "k-art-fill k-art-grow" : "k-art-line-fill"} />
          ))}
          <path d="M20 66 H58" className="k-art-flow" />
          <circle cx={20} cy={66} r={4} className="k-art-pulse" />
        </>
      );
  }
}

export function HeaderArt({ name }: { name: ArtName }) {
  return (
    <svg viewBox="0 0 300 132" className="k-art" role="presentation" style={{ color: S }}>
      {art(name)}
    </svg>
  );
}
