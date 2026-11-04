# Zero-Black-Box Takeoff Methodology

Conventional estimating platforms output flat numbers with unverified provenance. Tutulan enforces a **zero-black-box standard**: every single quantity in the Bill of Quantities must demonstrate mathematical transparency and link directly to visual evidence on the original construction drawings.

---

## 🔍 Classification of Quantities

Quantities in the Qobu Logistics Complex package are grouped into three rigorous evidence categories:

| Category | Method | Confidence | Provenance in Audit Trail |
|---|---|---|---|
| **Schedule / Table** | Extracted from ruled vector schedules | **High** (Deterministic) | Word coordinates, table bounding box, exact textual row citation |
| **Derived Parametric** | Evaluated via explicit formula | **High** (Transparent) | Explicit mathematical formula with each input citing its own drawing evidence |
| **Visual / Image** | Read from high-resolution rasterized sheets | **Medium** (Audited) | Explicit bounding box crop on sheet with human review verification flag |

---

## 🧮 Parametric Formula Engine

Derived items are never hardcoded totals. Each derived item exposes its variable parameters:

### Example 1: Isolated Pad Footings Concrete Volume
- **Structural Plan:** Sheet `KS-03`
- **Schedule:** 31 individual RC pad footings, single footing unit volume = $1.80\text{ m}^3$
- **Formula:** 
  $$\text{Volume} = 31 \times 1.80\text{ m}^3 = 55.80\text{ m}^3$$
- **Evidence:** Both the count (31) and the single footing volume ($1.80\text{ m}^3$) carry independent coordinate bounding boxes.

### Example 2: Structural Steel Truss F-1
- **Structural Plan:** Sheet `KS-19`
- **Schedule:** 9 truss frames, single truss steel weight = $2,425.60\text{ kg}$
- **Formula:**
  $$\text{Total Steel} = 9 \times 2,425.60\text{ kg} = 21,830.40\text{ kg} = 21.83\text{ t}$$

---

## ⚖️ Automated Cross-Discipline Audit Checks

The platform includes 16 automated engineering checks comparing architectural, structural, and MEP disclosures. The system caught major real-world discrepancies in the Qobu tender package:

### Discrepancy 1: Bracing Profile Calculation Error (Arithmetic Error)
- **Sheet:** `KS-21` (Roof Bracing Schedule)
- **Problem:** Printed schedule total for bracing element **Özr-2** indicates **$808.80\text{ kg}$**.
- **Engine Audit:** Summing the individual member line items ($4 \times 102.20\text{ kg}$) yields exactly **$408.80\text{ kg}$**.
- **Impact:** An immediate $400.00\text{ kg}$ ($0.4\text{ t}$) contractor overcharge if accepted without validation.

### Discrepancy 2: Warehouse Ground Slab Area (Discipline Conflict)
- **Architecture (`AR-05`):** Warehouse internal hall dimension is $48.0\text{ m} \times 24.0\text{ m} - \text{admin recesses} = \mathbf{1,122.00\text{ m}^2}$.
- **Structure (`KS-12`):** Ground slab layout schedule specifies concrete finish area as $\mathbf{1,109.10\text{ m}^2}$.
- **Variance:** $\Delta = 12.90\text{ m}^2$ ($1.15\%$).
- **Handling:** Both quantities are presented in the Checks view with side-by-side crops; the surveyor can toggle either value with one click.

### Discrepancy 3: Administrative Building Ground Slab Thickness
- **Architecture (`AR-11`):** Floor build-up schedule details a $150\text{ mm}$ reinforced concrete slab ($\mathbf{25.50\text{ m}^3}$).
- **Structure (`KS-42`):** Structural foundation section specifies a $100\text{ mm}$ slab on grade ($\mathbf{18.10\text{ m}^3}$).
- **Variance:** $\Delta = 7.40\text{ m}^3$ ($29.0\%$ difference in concrete and associated formwork).

---

## 🇦🇿 Azerbaijani Construction Nomenclature

All descriptions and citations preserve original Azerbaijani engineering terminology alongside verified English translations:

| Azerbaijani (Original) | English | Trade / Section |
|---|---|---|
| *Dəmir-beton təməl tirələri* | Reinforced concrete ground beams | Substructure Concrete |
| *Monolit dəmir-beton sütunlar* | Monolithic RC columns | Superstructure Concrete |
| *Metal ferma F-1* | Steel roof truss F-1 | Structural Steelwork |
| *Keramzit-beton blok divarlar* | Expanded clay lightweight block walls | Masonry |
| *Hamar suvaq və emulsiya* | Smooth plaster and emulsion paint | Internal Finishes |
| *Özüaxan epoksid döşəmə örtüyü* | Self-leveling epoxy floor coating | Floor Finishes |
| *Polipropilen borular PN20* | Polypropylene pipes PN20 | Domestic Plumbing |
| *Yanğınsöndürmə nasos qurğusu* | Firefighting pump skid system | Fire Suppression |
| *Optik paylayıcı qutu (ODF)* | Optical distribution frame (ODF) | Telecommunications / LAN |

---

## 💰 Cascading Mark-Up Chain

The financial valuation engine computes commercial totals using the Azerbaijani standard contracting cascade:

1. **Direct Cost (Subtotal):** Sum of all 323 line item amounts $(\text{Quantity} \times \text{Unit Rate AZN})$.
2. **Overhead Expenses (*Əlavə xərclər*):** $+10.0\%$ on Direct Cost.
3. **Contractor Profit (*Plan yığımları*):** $+8.0\%$ on (Direct Cost + Overhead).
4. **Contingency / Unforeseen (*Gözlənilməz xərclər*):** $+5.0\%$ on cumulative base.
5. **Value Added Tax (*ƏDV*):** $+18.0\%$ statutory Azerbaijani VAT.

