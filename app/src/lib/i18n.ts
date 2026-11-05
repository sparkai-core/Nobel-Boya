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
  directWorks: { en: "Direct Works", az: "Birbaşa işlər" },
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

export const CHECK_AZ: Record<string, { title: string; detail: string }> = {
  "C-01": {
    title: "Şr-2 bağlarında 400 kq artıq hesablama",
    detail: "Şr-2 spesifikasiyasının hər sətrində cəmi 404.40 kq çap olunub, lakin 4 × 51.10 kq və 8 × 25.55 kq hər ikisi 204.40 kq verir. Spesifikasiyanın 808.80 kq cəmi 408.80 kq olmalıdır. Əvvəlki vərəqdə Şr-1 eyni tərtibatdan istifadə edir və düzgün toplanır.",
  },
  "C-02": {
    title: "Konstruksiya və memarlıq arasında anbar döşəmə sahəsi fərqi",
    detail: "Konstruksiya spesifikasiyası döşəmə tavasını 1,109.10 m² (150 mm-də 166.37 m³) ölçür. Memarlıq döşəmə tərtibatı isə 1,122 m² otaq sahəsindən istifadə edir ki, bu da 168.3 m³ tava və 561 m³ karbonat verir. Smeta betonu konstruksiya vərəqindən, döşəmə örtüyünü isə memarlıq vərəqindən götürür.",
  },
  "C-03": {
    title: "İnzibati bina döşəmə tavası konstruksiyada 100 mm, memarlıqda 150 mm",
    detail: "KS-49 konstruksiya vərəqində 18.1 m³ B15 betonu ilə 100 mm qalınlıqlı tava göstərilir. Memarlıq otaq tərtibatı cədvəlində isə hər növ döşəmə altında 150 mm dəmir-beton tava qeyd olunub: 10.84 + 12.43 + 2.23 = 25.50 m³. Layihəçi təsdiq edənə qədər smetada konstruktiv dəyər əsas götürülür.",
  },
  "C-04": {
    title: "MR-2 tirinin həcmi yuxarı yuvarlaqlaşdırılıb",
    detail: "Bir MR-2 tiri 0.84 m³-dir və cəmi 6 ədəddir, bu da 5.04 m³ edir. Spesifikasiyada isə 5.1 m³ çap edilib.",
  },
  "C-05": {
    title: "Elektrik sayğacının sayı göstərilməyib",
    detail: "Anbarın elektrik spesifikasiyasının 4-cü sətrində 380 V, 3 × 25 A sayğac qeyd olunub, lakin say xanası boş buraxılıb. Dəqiq say təqdim edilənə qədər smetaya daxil edilmir.",
  },
  "C-06": {
    title: "Torpaqlama materiallarının çəkiləri uzunluqlarına uyğun gəlmir",
    detail: "40 × 4 mm zolağın xüsusi çəkisi 1.256 kq/m təşkil edir. Sətir 14 (25 m, 32 kq) uyğundur, lakin sətir 16-da 20 m və 15 kq yazılıb (halbuki 20 m = 25.1 kq olmalıdır). Sətir 15-də Ø16 dairəvi polad üçün 3 m-ə 36 kq yazılıb (1.58 kq/m ilə 4.7 kq olmalıdır). Smeta torpaqlamanı uzunluq üzrə ölçür.",
  },
  "C-07": {
    title: "İnzibati binanın üç elektrik vərəqində başlıq səhvi",
    detail: "MEP-42 üzrə çertyoj siyahısında 2, 4 və 5-ci vərəqlər ümumi qeydlər, işıqlandırma planı və güc/torpaqlama planı kimi göstərilib. Əsas başlıqlarında isə CCTV və rabitə planı yazılıb. Reyestrdə siyahıdakı düzgün adlar istifadə olunur.",
  },
  "C-08": {
    title: "Anbar havalandırma vərəqləri inzibati bina kimi adlandırılıb",
    detail: "10-dan 14-dək olan vərəqlər anbar dəstinə aiddir (MEP-8 üzlüyü 'ANBAR BİNASININ İŞÇİ LAYİHƏSİ' adlanır) və 48 m-lik anbarı əks etdirir, lakin başlıqlarında 'İnzibati bina' yazılıb. Reyestr onları anbar bölməsində təsnif edir.",
  },
  "C-09": {
    title: "Fasad örtüyü sahəsi divar hörgüsündən böyükdür",
    detail: "Dörd fasad üzrə 1,245.0 m² suvaq və boya göstərilib. Ümumi qeydlərdə isə 400 mm mişar daşı divarları 787.4 m² ölçülür. Fasad sahəsinin frontonları və +7.00 səviyyəsindən yuxarı zolağı əhatə edib-etmədiyi dəqiqləşdirilməlidir.",
  },
  "A-01": {
    title: "Sütunların sayı bünövrə başmaqlarının sayına tam uyğundur",
    detail: "Ms-1-dən Ms-4-dək sütunların cəmi 21 + 4 + 4 + 2 = 31 ədəddir ki, bu da 31 ədəd MB-1 bünövrə başmağına tam bərabərdir.",
  },
  "A-02": {
    title: "Planda pəncərələrin sayı spesifikasiya ilə tam uyğundur",
    detail: "Tərtibat planında 21 ədəd P-1 pəncərəsi (uzun tərəflərdə 8 + 5, frontonlarda 4 + 4) və 3 ədəd Q-1 qapısı göstərilir. Qapı və pəncərə cədvəlində də eynilə 21 və 3 qeyd edilib.",
  },
  "A-03": {
    title: "F-1 fermasının spesifikasiya cəmi tam düzgündür",
    detail: "On altı profil sətri cəmi 828.26 kq və səkkiz lövhə sətri cəmi 253.36 kq təşkil edir, spesifikasiyada yazıldığı kimidir.",
  },
  "A-04": {
    title: "Otaq sahələri, döşəmə tərtibatı və yekun cəm tam uyğundur",
    detail: "Yeddi otağın sahələri cəmi 170.1 m² təşkil edir, bu da otaq cədvəlindəki və ümumi qeydlərdəki cəmlə tam eynidir. Otaqlar 1 + 5 = 72.32 m², otaqlar 2 + 3 + 4 = 82.88 m² və otaqlar 6 + 7 = 14.9 m² olmaqla döşəmə tərtibatı ilə üst-üstə düşür.",
  },
  "A-05": {
    title: "Suaxıdan borular memarlıq və konstruksiya arasında tam uyğundur",
    detail: "Həm dam planında, həm də taxta dam spesifikasiyasında 21.8 m Ø100 suaxıdan boru və 6 ədəd suqəbuledici qıf göstərilib.",
  },
  "A-06": {
    title: "Sahə layları öz sahələri və qalınlıqları ilə tam mütənasibdir",
    detail: "Qırmadaş sahəsi 8,485.3 m² = qazon 2,532.3 + asfalt 5,549.0 + tamet 404.0. Bütün həcmlər sahə × lay qalınlığı düsturuna bərabərdir: qırmadaş 200 mm, iri dənəli asfalt 60 mm, xırda dənəli asfalt 40 mm, karbonat 100 mm, bitki torpağı 300 mm, sement-qum qatı 100 mm.",
  },
  "A-07": {
    title: "Mişar daşı hörgüsü ümumi qeydlər və divar planı arasında tam eynidir",
    detail: "Xarici mişar daşı 187.73 m², 200 mm arakəsmələr 149.27 m² və 50 mm arakəsmələr 13.7 m² həm ümumi qeydlərdə, həm də divar növləri cədvəlində tam eyni göstərilib.",
  },
};

export const RATE_GROUP_AZ: Record<string, string> = {
  Concrete: "Beton və Dəmir-Beton İşləri",
  Rebar: "Armatur və Polad Təchizatı",
  Formwork: "Qəlib və Dayaq İşləri",
  Earthworks: "Torpaq və Qazıntı İşləri",
  Masonry: "Mişar Daşı və Hörgü İşləri",
  Finishes: "Daxili və Xarici Tərtibat",
  Roofing: "Dam və İzolyasiya İşləri",
  Metals: "Metal Konstruksiyalar və Fermalar",
  Services: "Mühəndis Kommunikasiya Sistemləri",
  Site: "Abadlıq və Sahə Yolları",
};

export function getCheckTitle(checkId: string, defaultTitle: string, lang: Language): string {
  if (lang === "az" && CHECK_AZ[checkId]) return CHECK_AZ[checkId].title;
  return defaultTitle;
}

export function getCheckDetail(checkId: string, defaultDetail: string, lang: Language): string {
  if (lang === "az" && CHECK_AZ[checkId]) return CHECK_AZ[checkId].detail;
  return defaultDetail;
}

export function getRateGroup(group: string, lang: Language): string {
  if (lang === "az" && RATE_GROUP_AZ[group]) return RATE_GROUP_AZ[group];
  return group;
}

export function t(key: keyof typeof I18N, lang: Language): string {
  const entry = I18N[key];
  if (!entry) return key;
  return entry[lang] || entry.en;
}
