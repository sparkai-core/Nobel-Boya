# Information required for automatic bill of quantities

**Purpose:** Define the project data required before the platform can produce a priced building bill from the drawings.

## The bill required

A building-works bill of quantities, as used on these contracts.

Lines are grouped by building or zone, then by trade: preliminaries, substructure, concrete frame, reinforcement, masonry, finishes, openings, roofing, services and external works. Each line has an item code kept as text, a description in the contract language, a unit (m, m², m³, kg, t or number), a quantity, a unit rate and an amount.

The summary is rebuilt in the order written on the bill: measured work, temporary buildings, contingency, then VAT. Overhead and profit sit inside the unit rate, through the rate analysis, where that is how the bill is built.

Descriptions stay in the original language. Azerbaijani, Arabic and English are all in scope.

## Requirement

**3 to 5 complete projects.**

Each project is one building contract from one revision: villa, mid-rise, or industrial or depot. The set should include more than one of these types and more than one drawing office. Drawings, schedules, specification, bill and prices must be the same issue.

| Item | File |
|---|---|
| CAD drawings | DWG or DXF for architecture, structure and services, with units, layers, hatches and title blocks, plus the matching PDF |
| Schedules | Doors, windows, finishes, columns, beams, footings, bar bending and equipment, in the CAD or as Excel |
| Bill | Excel bill in the form above: code, description, unit, quantity, rate, amount, trade and building, preliminaries, and the summary page |
| Rates | Excel list of materials, labour and plant: unit, rate, currency, price date, location, VAT and delivery |
| Rate analyses | One per main work type, showing how the unit rate is built, including waste, overhead and profit |
| Summary chain | Temporary buildings, contingency and VAT, with the percentage and the base each one applies to, in calculation order |
| Checked calculation | One verified quantity calculation per trade, for concrete, masonry, finishes and services |
| Measurement rules | The norm used on the bill, local or otherwise; openings; waste; whether the concrete rate includes formwork |
| Specification | Sections named by the bill, and approved brands where a line names a product |

A PDF set alone, a scanned set, a totals-only bill, or a bill from another revision does not count. A BIM model may be added where one exists. It does not replace the CAD and the bill.

## Questionnaire

1. Can you provide 3 to 5 building contracts, each with its bill and drawings from one revision, covering more than one building type?
2. Is each bill in Excel, with item codes, descriptions in the contract language, units, quantities, rates and amounts, grouped by building and trade, including preliminaries and the summary?
3. For each bill, what is the summary chain: temporary buildings, contingency and VAT, and in which order are they applied?
4. Can you provide the rate list and the rate analyses that produce the unit rates on those bills?
5. Which measurement norm was used, and do the concrete rates include formwork?
