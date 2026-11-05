export type Language = "en" | "az";

export const I18N = {
  // Navigation & Shell
  navOverview: { en: "Overview", az: "Ümumi İcmal" },
  navOverviewHint: { en: "Executive project dashboard", az: "İcraçı layihə paneli" },
  navDrawings: { en: "Drawing Register", az: "Çertyoj Reyestri" },
  navDrawingsHint: { en: "205 sheets with detected tags", az: "205 vərəq və aşkarlanan işarələr" },
  navBill: { en: "Bill of Quantities", az: "Həcmlər Cədvəli (BOQ)" },
  navBillHint: { en: "Tree hierarchy takeoff & rates", az: "İyerarxik smeta strukturu və qiymətlər" },
  navChecks: { en: "Discipline Audits", az: "Sahələrarası Yoxlamalar" },
  navChecksHint: { en: "Cross-checks & conflicts", az: "Çarpaz yoxlama və uyğunsuzluqlar" },
  navRates: { en: "Rates & Mark-ups", az: "Vahid Qiymətlər və Əlavələr" },
  navRatesHint: { en: "Unit rates & commercial chain", az: "Smeta vahid qiymətləri və zəncir" },
  navExport: { en: "PDF & Excel Reports", az: "PDF və Excel Hesabatlar" },
  navExportHint: { en: "Executive report & workbook", az: "Rəsmi hesabat və iş kitabı" },

  // Shell metrics & labels
  contractValuation: { en: "Contract Valuation", az: "Müqavilə Qiymətləndirməsi" },
  contractValuationSub: { en: "18% VAT & 4 mark-up tiers", az: "18% ƏDV və 4 əlavə pilləsi" },
  norms: { en: "Norms", az: "Normalar" },
  signIn: { en: "Sign In", az: "Daxil ol" },
  signOut: { en: "Sign Out", az: "Çıxış" },
  leadQs: { en: "Lead Quantity Surveyor", az: "Baş Smetaçı Mühəndis" },
  leadQsShort: { en: "Lead QS", az: "Baş Smetaçı" },

  // Overview Dashboard
  projectDashboard: { en: "Project Dashboard", az: "Layihə İdarəetmə Paneli" },
  searchPlaceholder: {
    en: "Search bill lines, drawing sheets, specifications...",
    az: "Smeta bəndləri, çertyoj vərəqləri və spesifikasiyalar üzrə axtarış...",
  },
  actionQueue: { en: "Action Queue", az: "Fəaliyyət Növbəsi" },
  itemsCount: { en: "Items", az: "Bənd" },
  pending: { en: "Pending", az: "Gözləmədə" },
  approved: { en: "Approved", az: "Təsdiqləndi" },
  requiredReconciliations: { en: "Required Reconciliations", az: "Tələb Olunan Uyğunlaşdırmalar" },
  verifiedApprovals: { en: "Verified Approvals", az: "Təsdiqlənmiş Uyğunluqlar" },

  projectsOverview: { en: "Projects Overview", az: "Layihələr İcmalı" },
  directWorks: { en: "DIRECT WORKS", az: "BİRBAŞA İŞLƏR" },
  incomeVsExpense: { en: "Commercial Progression", az: "Kommersiya Dinamikası" },
  directBaseline: { en: "Direct", az: "Birbaşa" },
  grossTotal: { en: "Gross", az: "Cəmi" },

  invoiceOverview: { en: "Invoice Overview", az: "Smeta Əlavələri İcmalı" },
  statutoryMarkupsSequence: { en: "Statutory Markups Sequence", az: "Dövlət Tikinti Əlavələri Zənciri" },
  directWorksScope: { en: "Direct Works Scope", az: "Birbaşa Tikinti İşləri" },
  overheadsName: { en: "Site Overheads & Preliminaries", az: "Ümumi Tikinti Əlavələri" },
  profitName: { en: "Contractor Profit Margin", az: "Podratçının Plan Qazancı" },
  contingencyName: { en: "Unforeseen Contingency Reserve", az: "Nəzərdə Tutulmamış Xərclər" },
  vatName: { en: "Statutory State VAT", az: "Dövlət Əlavə Dəyər Vergisi (ƏDV)" },

  drawingPackages: { en: "Drawing Packages", az: "Çertyoj Paketləri" },
  packagesCount: { en: "4 Packages", az: "4 Paket" },
  disciplineAudits: { en: "Discipline Audits", az: "Sahələrarası Yoxlamalar" },
  activeFindings: { en: "Active", az: "Aktiv" },
  seeAllSheets: { en: "See All 205 Sheets >", az: "Bütün 205 Vərəqə Bax >" },
  checkBtn: { en: "Check >", az: "Yoxla >" },
  reviewBtn: { en: "Review >", az: "Baxış >" },
  applyFix: { en: "Apply Fix", az: "Düzəliş Et" },
  inspect: { en: "Inspect", az: "Yoxla" },

  // Modals & Controls
  platformSettings: { en: "Platform Settings", az: "Platforma Parametrləri" },
  settingsSub: {
    en: "Commercial Mark-up Tiers & Working Design Parameters",
    az: "Kommersiya Əlavə Pillələri və İşçi Layihə Parametrləri",
  },
  resetDefaults: { en: "Reset Defaults", az: "İlkin Halına Qaytar" },
  commercialStructure: { en: "Commercial Mark-up Structure", az: "Smeta Qiymətqoyma Strukturu" },
  languageNorms: { en: "Language & Nomenclature Norms", az: "Dil və Nomenklatura Normaları" },
  surveyorProfile: { en: "Surveyor Profile & Designer Organization", az: "Mühəndis Profili və Layihəçi Təşkilat" },
  done: { en: "Done", az: "Tamam" },

  shortcutsTitle: { en: "Keyboard Shortcuts & Surveyor Guide", az: "Qaynar Düymələr və Bələdçi" },
  shortcutsSub: { en: "Storm Takeoff Productivity Cheatsheet", az: "Storm Takeoff Sürətli İş Təlimatı" },
  globalSearch: { en: "Global Search & Omnibox", az: "Qlobal Axtarış və Keçid" },
  quickNav: { en: "Quick Navigation", az: "Sürətli Keçid" },
  surveyorActions: { en: "Surveyor Takeoff Actions", az: "Smetaçı Əməliyyatları" },
  evidenceLegend: { en: "Verification Evidence Methodology", az: "Aşkarlama Metodologiyası İzahı" },
  auditLegend: { en: "Discipline Audits & Discrepancy Severity", az: "Sahələrarası Yoxlama Dərəcələri" },
  gotIt: { en: "Got It", az: "Aydındır" },

  // Drawing Register & Project Folders
  projectFoldersTitle: { en: "Project Drawing Folders", az: "Layihə Çertyoj Qovluqları" },
  projectFoldersSub: {
    en: "Complete working design package for Qobu Logistics & Admin Hub (205 sheets across 4 packages)",
    az: "Qobu Logistika və İnzibati Mərkəz üçün tam işçi layihə paketi (4 qovluqda 205 vərəq)",
  },
  activeProject: { en: "Active Project", az: "Aktiv Layihə" },
  client: { en: "Client", az: "Sifarişçi" },
  designer: { en: "Design Organization", az: "Layihə Təşkilatı" },
  stage: { en: "Project Stage", az: "Layihə Mərhələsi" },
  stageVal: { en: "Working Design (İşçi Layihə), 2026", az: "İşçi Layihə (İşçi Layihə), 2026" },
  location: { en: "Location", az: "Ünvan" },
  locationVal: { en: "Qobu Settlement, Absheron District, Baku", az: "Qobu qəsəbəsi, Abşeron rayonu, Bakı" },
  openBoqBtn: { en: "Open Bill of Quantities (BOQ)", az: "Həcmlər Cədvəlini Aç (BOQ)" },
  openAuditsBtn: { en: "Open Discipline Audits", az: "Sahələrarası Yoxlamaları Aç" },
  openViewerBtn: { en: "Browse Drawing Sheets", az: "Çertyoj Vərəqlərini İncələ" },
  backToFolders: { en: "Back to Project Folders", az: "Layihə Qovluqlarına Qayıt" },
  viewFolders: { en: "Project Folders", az: "Layihə Qovluqları" },
  viewViewer: { en: "Interactive Sheet Viewer", az: "İnteraktiv Çertyoj Baxışı" },
  drawingSheets: { en: "Drawing Sheets", az: "Çertyoj Vərəqləri" },
  onlyWithTakeoff: { en: "Only sheets with takeoff quantities", az: "Yalnız həcmlər olan vərəqlər" },
  searchSheetsPlaceholder: { en: "Search by code, title, building...", az: "Kod, ad və bina üzrə axtarış..." },
  exploreFolder: { en: "Explore Sheets", az: "Vərəqlərə Bax" },
  sheetsCount: { en: "sheets", az: "vərəq" },

  // Bill & Takeoff
  billTitle: { en: "Bill of Quantities", az: "Həcmlər Cədvəli (BOQ)" },
  billLead: {
    en: "Hierarchical Work Breakdown Structure (WBS) for Qobu Logistics Hub • Measured works before mark-ups. Click any line to inspect pixel-level drawing coordinates, adjust dimensions, or sign off.",
    az: "Qobu Logistika Mərkəzi üçün iyerarxik smeta strukturu (WBS) • Əlavələrdən əvvəl birbaşa işlər. Hər hansı sətrə klikləyərək çertyoj koordinatlarını yoxlayın, ölçüləri düzəldin və ya təsdiqləyin.",
  },
  searchBillPlaceholder: {
    en: "Search item description, element mark, or drawing sheet...",
    az: "İşin təsviri, element markası və ya çertyoj vərəqi üzrə axtarış...",
  },
  allStructures: { en: "All Structures (Warehouse, Admin, Pump)", az: "Bütün Binalar (Anbar, Ofis, Nasosxana)" },
  expandAll: { en: "Expand All", az: "Hamısını Aç" },
  collapseTrades: { en: "Collapse Trades", az: "Bölmələr Üzrə Yığ" },
  collapseAll: { en: "Collapse All", az: "Hamısını Bağla" },
  filterAll: { en: "All Items", az: "Bütün Bəndlər" },
  filterSchedule: { en: "Schedules", az: "Spesifikasiyalar" },
  filterDerived: { en: "Parametric", az: "Parametrik Hesab" },
  filterImage: { en: "Plan Takeoff", az: "Plandan Ölçü" },
  filterFindings: { en: "Audit Issues", az: "Audit Uyğunsuzluqları" },
  filterAdjusted: { en: "Adjusted", az: "Düzəliş Edilən" },
  wbsCode: { en: "WBS Code", az: "WBS Kodu" },
  itemDescription: { en: "Work Breakdown / Item Description", az: "İşin Adı və Xarakteristikası" },
  unit: { en: "Unit", az: "Ölçü Vahidi" },
  quantity: { en: "Quantity", az: "Həcm" },
  rate: { en: "Rate (AZN)", az: "Qiymət (AZN)" },
  amount: { en: "Amount (AZN)", az: "Məbləğ (AZN)" },
  evidence: { en: "Drawing Evidence", az: "Çertyoj Əsası" },
  action: { en: "Action", az: "Əməliyyat" },
  noMatchingItems: { en: "No takeoff items match your search filters", az: "Axtarış filtrinə uyğun bənd tapılmadı" },
  noMatchingLead: {
    en: "Try adjusting your search query, or select another building asset from the dropdown.",
    az: "Axtarış sorğusunu dəyişin və ya menyudan başqa binanı seçin.",
  },

  // Discipline Audits
  auditsTitle: { en: "Discipline Audits", az: "Sahələrarası Yoxlamalar" },
  auditsLead: {
    en: "Automated cross-check engine compares schedules, plans, and cross-discipline quantities across all 205 sheets.",
    az: "Avtomatlaşdırılmış çarpaz yoxlama mühərriki 205 vərəq üzrə spesifikasiyaları, planları və sahələrarası həcmləri müqayisə edir.",
  },
  auditGroupErrors: { en: "Cross-Discipline Conflicts & Errors", az: "Sahələrarası Ziddiyyətlər və Xətalar" },
  auditGroupNotes: { en: "Engineering Notes & Tolerances", az: "Mühəndis Qeydləri və Toleranslar" },
  auditGroupAgreements: { en: "Verified Cross-Document Agreements", az: "Təsdiqlənmiş Çarpaz Uyğunluqlar" },
  fixed: { en: "Fixed", az: "Düzəldildi" },
  citations: { en: "citations", az: "istinad" },
  correctionApplied: { en: "Correction Applied", az: "Düzəliş Tətbiq Olundu" },
  revertCorrection: { en: "Revert Correction", az: "Düzəlişi Geri Qaytar" },

  // PDF & Excel Reports
  exportTitle: { en: "Exports & Reports", az: "Hesabatlar və İxrac" },
  exportLead: {
    en: "Audit-grade commercial outputs for quantity surveyors, project directors, and clients. Download verified Excel workbooks or print executive PDF packages.",
    az: "Smetaçılar, layihə rəhbərləri və sifarişçilər üçün rəsmi hesabatlar. Təsdiqlənmiş Excel faylını endirin və ya rəsmi PDF paketini çap edin.",
  },
  executivePdfReport: { en: "Executive PDF Report", az: "Rəsmi İcraçı PDF Hesabatı" },
  excelWorkbook: { en: "Audit-Grade Excel Workbook", az: "Tam Auditli Excel Faylı" },
  printPdf: { en: "Print or Save as PDF", az: "Çap Et və ya PDF Saxla" },
  standardA4: { en: "A4 Standard • Official Cost Estimation Package", az: "A4 Standartı • Rəsmi Smeta Sənədi" },
  totalContractValuation: { en: "Total Contract Valuation", az: "Yekun Müqavilə Qiymətləndirməsi" },
  measuredDirectWorks: { en: "Measured Direct Works", az: "Ölçülmüş Birbaşa İşlər" },
  drawingPackageScope: { en: "Drawing Package Scope", az: "Çertyoj Paketi Həcmi" },
  verificationQuality: { en: "Verification Quality", az: "Yoxlama Keyfiyyəti" },
  commercialValuationChain: { en: "Commercial Valuation Chain", az: "Kommersiya Qiymətləndirmə Zənciri" },
  valuationChainNote: {
    en: "Statutory Azerbaijani construction estimating markup sequence",
    az: "Dövlət tikinti norma və qaydalarına uyğun smeta əlavələri ardıcıllığı",
  },
  completeBoqSchedule: { en: "Complete Bill of Quantities Schedule", az: "Tam Həcmlər Cədvəli (Bütün Bəndlər)" },
  completeBoqNote: {
    en: "Full 117 verified bill lines with quantities, rates, amounts, and drawing sheet citations",
    az: "Bütün 117 yoxlanılmış smeta bəndi: həcmlər, vahid qiymətlər, məbləğlər və çertyoj istinadları",
  },
  buildingStructure: { en: "Building Structure / Asset", az: "Bina Qurğusu / Obyekt" },
  share: { en: "Share", az: "Pay" },
  linesCount: { en: "Lines", az: "Sətir" },
  citation: { en: "Citation", az: "İstinad" },
  preparedBy: { en: "Prepared & Audited By", az: "Tərtib və Audit Etdi" },
  surveyorStamp: { en: "Surveyor Seal & Signature", az: "Mühəndis Möhürü və İmza" },
  executiveAcceptance: { en: "Executive Acceptance", az: "Sifarişçi Qəbulu" },

  // Rates & Mark-ups
  ratesTitle: { en: "Commercial Rates & Statutory Mark-ups", az: "Kommersiya Qiymətləri və Dövlət Əlavələri" },
  ratesLead: {
    en: "Working design packages do not contain commercial pricing. These verified AZN unit rates establish the contract baseline. Edit any rate or mark-up tier and the entire valuation recalculates in real-time.",
    az: "İşçi layihə paketlərində smeta qiymətləri qeyd olunmur. Bu təsdiqlənmiş AZN vahid qiymətləri müqavilə bazasını təşkil edir. İstənilən qiyməti və ya əlavə pilləsini dəyişdikdə bütün smeta canlı yenilənir.",
  },
  resetPricingBtn: { en: "Reset to Base Rates", az: "İlkin Qiymətlərə Qaytar" },
  statutoryTiersHead: { en: "Statutory Mark-up Hierarchy (AZ Law)", az: "Dövlət Tikinti Əlavələri İyerarxiyası" },
  statutoryTiersSub: {
    en: "Sequential commercial tiers applied cumulatively to the direct works baseline",
    az: "Birbaşa tikinti işlərinə ardıcıl və mərhələli tətbiq olunan kommersiya pillələri",
  },
  rateGroup: { en: "Commercial Work Discipline", az: "Tikinti İş Sahəsi" },
  colRateDesc: { en: "Work Description / Unit Rate Specification", az: "İşin Təsviri və Vahid Qiymət Spesifikasiyası" },
  colUnit: { en: "Unit", az: "Ölçü Vahidi" },
  colLinesCount: { en: "Lines", az: "Sətir Sayı" },
  colTotalQty: { en: "Total Quantity", az: "Ümumi Həcm" },
  colBaseRate: { en: "Base Rate (AZN)", az: "Baza Qiyməti (AZN)" },
  colActiveRate: { en: "Active Rate (AZN)", az: "Tətbiq Edilən Qiymət (AZN)" },
  colSubtotal: { en: "Total Subtotal (AZN)", az: "Cəmi Məbləğ (AZN)" },
  customRateActive: { en: "Custom Rate Applied", az: "Fərdi Qiymət Tətbiq Olundu" },
  standardLibraryRate: { en: "Standard Rate Library", az: "Standart Qiymət Bazası" },
} as const;

export function t(key: keyof typeof I18N, lang: Language): string {
  const entry = I18N[key];
  if (!entry) return key;
  return entry[lang] || entry.en;
}
