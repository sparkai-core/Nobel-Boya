# Visual Design System: Drafting-Film Precision

The Tutulan design language rejects generic SaaS templates, neon gradients, and "AI slop" in favor of an **architectural drafting-room aesthetic**: tactile paper, graphite rules, the designer's blue stamp, and the surveyor's red pencil.

---

## 🎨 Color Palette & Design Tokens

| Token | Hex Value | Semantic Usage |
|---|---|---|
| **Ground (Paper)** | `#F4F4F1` | Background canvas simulating architectural drafting vellum. |
| **Surface (Sheet)** | `#FFFFFF` | Work surfaces, table panels, inspector sheets. Structured by clean 1px borders (`#E1E2DC`). |
| **Graphite** | `#1E2227` | Primary typography, structural borders, active navigation states. |
| **Stamp Blue** | `#2D4A9A` | Brand identity, primary interactive selections, active table focus. |
| **Redline Pencil** | `#D63F28` | **Signature element:** Evidence bounding boxes and discrepancy alerts only. |
| **Verified Green** | `#2E7A4E` | Audit matches, verified quantities, confirmed schedules. |
| **Review Amber** | `#A2670F` | Items requiring human verification, missing specs. |
| **Light-Table** | `#2A2E33` | Deep neutral stage background for the blueprint canvas viewer. |

---

## 🚫 The "No AI Slop" Manifesto

The dashboard strictly eliminates patterns associated with low-quality AI-generated UIs:

1. **Zero Gratuitous Gradients:** No purple-to-blue gradient cards, gradient buttons, or glowing outlines. All surfaces use crisp solid fills with 1px border definition.
2. **Zero Decorative Emojis:** No 🚀, 💡, 🔥, or 📊 icons scattered in headers or table headers. Clean, utilitarian, engineering-grade line icons (Lucide) used with intent.
3. **No Em-Dashes or Fluff:** Concise, technical prose written in sentence case with clear, actionable engineering verbs.
4. **Structured Tabular Hierarchy:** No arbitrary floating cards. Data is arranged in rigid, high-density structural grids with synchronized scrolling.
5. **Color Discipline:** Red (`#D63F28`) is exclusively reserved for redline evidence highlights and calculated discrepancies. It is never used decoratively.

---

## 🔤 Typography & Numerical Scannability

- **Interface & Prose:** **IBM Plex Sans** (400 Regular, 500 Medium, 600 SemiBold). Clean, neutral sans-serif designed for technical documentation with native glyph support for Azerbaijani Latin characters (`ə`, `ı`, `ş`, `ç`, `ğ`, `ö`, `ü`).
- **Codes & Numerics:** **IBM Plex Sans Condensed** with tabular figures (`font-variant-numeric: tabular-nums`). This guarantees that multi-million AZN valuations, section codes (`03.20.10`), and decimal quantities align with mathematical precision down the column.

---

## 🎬 Motion & Micro-Interactions

1. **The Redline Signature:** When a quantity is selected in any view, an SVG bounding box animates onto the drawing sheet with a single crisp stroke pass (`stroke-dashoffset` transition), evoking a quantity surveyor circling a number in red pencil.
2. **Staged Generation:** During the "Generate Bill" sequence, drawing thumbnails tile smoothly into the grid as extraction phases advance sequentially (Master Plan $\rightarrow$ Architecture $\rightarrow$ Structure $\rightarrow$ MEP).
3. **Physics-Based Drawers:** The Line Inspector slides in smoothly from the right with a spring damping curve, without layout thrashing.
4. **Light-Table Blueprint Canvas:** The drawing viewer features inertial pan and smooth exponential zoom, centering directly on evidence coordinates when requested from the BOQ table.
