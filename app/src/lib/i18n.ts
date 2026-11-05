import { useCallback } from "react";
import { useApp } from "./store";

export type Lang = "az" | "en";
type Vars = Record<string, string | number>;

/** Azerbaijani interface strings, keyed by the English text. Placeholders use {name}. */
const AZ: Record<string, string> = {
  // shell and navigation
  "Nobel BOQ": "Nobel BOQ",
  "Quantity takeoff platform": "Həcmlərin hesablanması platforması",
  Projects: "Layihələr",
  Project: "Layihə",
  "Bill of quantities": "Həcmlər cədvəli",
  Drawings: "Cizgilər",
  Checks: "Yoxlamalar",
  Overview: "İcmal",
  "Rates and mark-ups": "Qiymətlər və əlavələr",
  Export: "İxrac",
  Settings: "Parametrlər",
  Language: "Dil",
  "Interface language": "İnterfeys dili",
  "Sign out": "Çıxış",
  "Main navigation": "Əsas naviqasiya",
  "Bill total incl. VAT": "Yekun, ƏDV daxil",
  "{c}, sample rates": "{c}, nümunə qiymətlər",
  "4 files, 205 sheets": "4 fayl, 205 vərəq",
  "Close panel": "Paneli bağla",

  // login
  "Sign in": "Daxil ol",
  "Open your projects, their drawings and the bills built from them.": "Layihələrinizi, onların cizgilərini və onlardan qurulan həcmlər cədvəllərini açın.",
  Email: "E-poçt",
  Password: "Şifrə",
  "Enter an email address, for example demo@nobel.az.": "E-poçt ünvanını daxil edin, məsələn demo@nobel.az.",
  "Enter a password.": "Şifrəni daxil edin.",
  "Demo workspace. The demo account is filled in; any password works.": "Demo iş sahəsi. Demo hesab doldurulub, istənilən şifrə qəbul olunur.",
  "Nobel BOQ demo": "Nobel BOQ demo",
  "Every quantity traced to its sheet": "Hər miqdar öz vərəqinə bağlıdır",
  "Drawings read, cross-checked and priced into a bill of quantities.": "Cizgilər oxunur, qarşılıqlı yoxlanılır və qiymətləndirilmiş həcmlər cədvəlinə çevrilir.",

  // projects
  "Each project is one drawing package. Open a project to see its bill, drawings and checks.":
    "Hər layihə bir cizgi paketidir. Həcmlər cədvəlini, cizgiləri və yoxlamaları görmək üçün layihəni açın.",
  "Bill generated": "Cədvəl hazırlanıb",
  "Ready to generate": "Hazırlamağa hazırdır",
  Client: "Sifarişçi",
  Designer: "Layihəçi",
  Issue: "Buraxılış",
  "Working design, {d}": "İşçi layihə, {d}",
  "Not generated": "Hazırlanmayıb",
  "Drawing package": "Cizgi paketi",
  "Open project": "Layihəni aç",
  "Generate again": "Yenidən hazırla",
  "Generate the bill of quantities": "Həcmlər cədvəlini hazırla",
  "New project": "Yeni layihə",
  "Add a drawing package: PDF or DWG sets, with an optional rate list and bill.": "Cizgi paketi əlavə edin: PDF və ya DWG dəstləri, istəyə görə qiymət siyahısı və smeta ilə.",
  "Uploading is switched off in this demo.": "Bu demoda yükləmə söndürülüb.",
  "Open the drawings of this project": "Bu layihənin cizgilərini aç",
  "Text layer": "Mətn qatı",
  "Image only": "Yalnız təsvir",
  "Partly text": "Qismən mətn",

  // generate
  Skip: "Keç",
  "Generating the bill": "Cədvəl hazırlanır",
  "The bill is ready": "Cədvəl hazırdır",
  "All stages complete": "Bütün mərhələlər tamamlandı",
  "Reading the package": "Paket oxunur",
  "Sorting sheets by structure and discipline": "Vərəqlər tikili və bölmə üzrə çeşidlənir",
  "Reading schedules and tables": "Cədvəllər oxunur",
  "Marking each value on its sheet": "Hər dəyər öz vərəqində işarələnir",
  "Cross-checking the drawings": "Cizgilər qarşılıqlı yoxlanılır",
  "Building and pricing the bill": "Cədvəl qurulur və qiymətləndirilir",
  "{n} of 205 sheets in 4 files": "4 faylda 205 vərəqdən {n}",
  "{b} structures, {d} disciplines": "{b} tikili, {d} bölmə",
  "{q} quantities from {s} sheets": "{s} vərəqdən {q} miqdar",
  "{n} of {t} values marked": "{t} dəyərdən {n} işarələndi",
  "{t} values marked, {x} on the text layer, {h} by hand": "{t} dəyər işarələndi: {x} mətn qatında, {h} əl ilə",
  "{e} error, {w} conflicts, {i} notes, {o} agreements": "{e} xəta, {w} ziddiyyət, {i} qeyd, {o} uyğunluq",
  "Arithmetic, counts and cross-discipline values": "Hesab, saylar və bölmələrarası dəyərlər",
  "{l} bill lines, {a} AZN": "{l} sətir, {a} AZN",
  "Total including VAT": "Yekun, ƏDV daxil",
  "Open the bill": "Cədvəli aç",
  "Sheets in the package": "Paketdəki vərəqlər",
  "{n} sheets": "{n} vərəq",
  "{n}% complete": "{n}% tamamlandı",

  // overview
  "Bill total including VAT": "Yekun, ƏDV daxil",
  "Measured works": "Ölçülmüş işlər",
  "Mark-ups and VAT": "Əlavələr və ƏDV",
  "Bill lines": "Cədvəl sətirləri",
  "Sheets used": "İstifadə olunan vərəqlər",
  "of 205": "/ 205",
  "Review {n} findings": "{n} nəticəyə bax",
  "Summary by structure": "Tikililər üzrə yekun",
  "AZN, sample rates": "AZN, nümunə qiymətlər",
  "Evidence behind the value": "Dəyərin mənbəyi",
  "Share of bill value by evidence type": "Mənbə növü üzrə dəyər payı",
  printed: "çap olunub",
  "Findings in the drawings": "Cizgilərdə aşkar olunanlar",
  "All checks": "Bütün yoxlamalar",
  Applied: "Tətbiq olunub",
  "{n} more notes, and {a} places where two documents agree.": "Daha {n} qeyd və iki sənədin uyğun gəldiyi {a} yer.",
  "By trade": "İş növləri üzrə",
  "All structures, before mark-ups": "Bütün tikililər, əlavələrdən əvvəl",
  "Not in the package": "Paketdə olmayanlar",
  "Left out rather than guessed": "Təxmin edilmədi, cədvələ daxil edilmədi",
  "Open the drawings": "Cizgiləri aç",
  "Total including VAT, AZN": "Yekun, ƏDV daxil, AZN",

  // bill
  "{n} lines": "{n} sətir",
  "{v} of {n} lines": "{n} sətirdən {v}",
  "measured works": "ölçülmüş işlər",
  "AZN before mark-ups. Select a line to see the sheet it was read from.": "AZN, əlavələrdən əvvəl. Sətri seçin, oxunduğu vərəq açılacaq.",
  "Search description, sheet or printed text": "Təsvir, vərəq və ya çap olunmuş mətn üzrə axtar",
  "Search the bill": "Cədvəldə axtar",
  Structure: "Tikili",
  "All structures": "Bütün tikililər",
  "Filter lines": "Sətirləri süz",
  All: "Hamısı",
  Printed: "Çap olunub",
  Derived: "Hesablanıb",
  "From image": "Təsvirdən",
  "With findings": "Nəticəli",
  Adjusted: "Dəyişdirilib",
  "No lines match": "Uyğun sətir yoxdur",
  "Clear the search or choose another filter.": "Axtarışı təmizləyin və ya başqa süzgəc seçin.",
  Code: "Kod",
  Description: "Təsvir",
  Unit: "Vahid",
  Quantity: "Miqdar",
  Rate: "Qiymət",
  Amount: "Məbləğ",
  Source: "Mənbə",
  Error: "Xəta",
  Conflict: "Ziddiyyət",
  Corrected: "Düzəldilib",
  Overridden: "Əl ilə dəyişdirilib",

  // inspector
  "Rate, AZN per {u}": "Qiymət, AZN / {u}",
  "Amount, AZN": "Məbləğ, AZN",
  "Printed {q}, {how}": "Çap olunan {q}, {how}",
  "corrected from a check": "yoxlama əsasında düzəldilib",
  "overridden by hand": "əl ilə dəyişdirilib",
  "Edited. Sample rate {r}": "Dəyişdirilib. Nümunə qiymət {r}",
  "Sample rate, not from the package": "Nümunə qiymət, paketdən deyil",
  "Back to sample rate {r}": "Nümunə qiymətə qayıt: {r}",
  "Where the number comes from": "Rəqəm haradan gəlir",
  Formula: "Düstur",
  Save: "Saxla",
  Cancel: "Ləğv et",
  Reason: "Səbəb",
  "Reason for override": "Dəyişiklik səbəbi",
  "Edited by reviewer": "Yoxlayan tərəfindən dəyişdirilib",
  "Overridden to {q}: {r}": "{q} olaraq dəyişdirilib: {r}",
  "Restore printed value": "Çap olunan dəyəri qaytar",
  "Override quantity": "Miqdarı dəyiş",
  "Open {s} at the marked value": "{s} vərəqini işarələnmiş dəyərdə aç",
  "{f}, page {p}": "{f}, səhifə {p}",

  // drawings
  "Only sheets with quantities": "Yalnız miqdarı olan vərəqlər",
  "Search sheets": "Vərəqlərdə axtar",
  "Floor plans and drawings": "Planlar və cizgilər",
  Schedules: "Cədvəllər",
  "Source files and notes": "Mənbə faylları və qeydlər",
  "4 PDF files, 205 sheets, issue {d}": "4 PDF fayl, 205 vərəq, buraxılış {d}",
  "Previous sheet": "Əvvəlki vərəq",
  "Next sheet": "Növbəti vərəq",
  "Read from this sheet": "Bu vərəqdən oxunanlar",
  "No quantities are taken from this sheet.": "Bu vərəqdən miqdar götürülməyib.",
  "It is a cover, title or general sheet.": "Bu üz, titul və ya ümumi vərəqdir.",
  "Its content is covered by the schedules on other sheets.": "Onun məzmunu digər vərəqlərdəki cədvəllərlə əhatə olunur.",
  "Bill quantity": "Cədvəldəki miqdar",
  ", derived": ", hesablanıb",
  "Line {c} in the bill": "Cədvəldə {c} sətri",
  "Checks on this sheet": "Bu vərəqdəki yoxlamalar",
  "Loading sheet": "Vərəq yüklənir",
  "Zoom in": "Böyüt",
  "Zoom out": "Kiçilt",
  "Fit sheet": "Vərəqi sığdır",
  Length: "Uzunluq",
  Count: "Say",
  Area: "Sahə",
  Thickness: "Qalınlıq",
  Profiles: "Profillər",
  Plates: "Lövhələr",
  "Also in": "Həmçinin",
  Spec: "Spesifikasiya",

  // checks
  "Every schedule was added up again and compared with the same quantity on other sheets. Nothing in the bill was changed silently.":
    "Hər cədvəl yenidən toplanıb və digər vərəqlərdəki eyni miqdarla müqayisə olunub. Cədvəldə heç nə xəbərsiz dəyişdirilməyib.",
  "Errors and conflicts": "Xətalar və ziddiyyətlər",
  Notes: "Qeydlər",
  Agreements: "Uyğunluqlar",
  ", correction applied": ", düzəliş tətbiq olunub",
  Arithmetic: "Hesab",
  "Two documents disagree": "İki sənəd uyğun gəlmir",
  "Missing value": "Çatışmayan dəyər",
  "Sheet identity": "Vərəqin eyniləşdirilməsi",
  "Needs review": "Yoxlama tələb edir",
  "Cross-check": "Qarşılıqlı yoxlama",
  "Rows add up to": "Sətirlərin cəmi",
  Difference: "Fərq",
  "Correction applied to the bill": "Düzəliş cədvələ tətbiq olunub",
  "Correction available": "Düzəliş mümkündür",
  "{l}. Bill line {c} changes by {d} AZN before mark-ups.": "{l}. Cədvəlin {c} sətri əlavələrdən əvvəl {d} AZN dəyişir.",
  "Use the printed value": "Çap olunan dəyəri istifadə et",
  "Apply to the bill": "Cədvələ tətbiq et",
  Evidence: "Sübutlar",
  "Bill lines affected": "Təsir olunan sətirlər",
  "Open on the sheet": "Vərəqdə aç",

  // rates
  "The package has no prices. These are sample AZN rates so the bill can be totalled. Edit any rate and every line that uses it updates. Changes stay in this browser.":
    "Paketdə qiymət yoxdur. Cədvəlin yekunlaşdırılması üçün nümunə AZN qiymətləri verilib. İstənilən qiyməti dəyişin, onu istifadə edən bütün sətirlər yenilənəcək. Dəyişikliklər bu brauzerdə saxlanılır.",
  "Reset to sample rates": "Nümunə qiymətlərə qaytar",
  "Mark-ups, in calculation order": "Əlavələr, hesablama ardıcıllığı ilə",
  "Each step applies to the running total above it": "Hər addım yuxarıdakı cari yekuna tətbiq olunur",
  Lines: "Sətirlər",
  Sample: "Nümunə",
  "Rate used": "Tətbiq olunan qiymət",

  // export
  "One Excel workbook for the quantity surveyor. Every number keeps its sheet reference, so it can be checked without this app.":
    "Smetaçı üçün bir Excel faylı. Hər rəqəm vərəq istinadını saxlayır, ona görə bu proqram olmadan da yoxlana bilər.",
  Summary: "Yekun",
  Bill: "Cədvəl",
  "Takeoff and sources": "Miqdarlar və mənbələr",
  Rates: "Qiymətlər",
  "Collection by structure and the mark-up chain to {t} AZN.": "Tikililər üzrə yekun və {t} AZN-ə qədər əlavələr zənciri.",
  "{n} lines in Azerbaijani and English with unit, quantity, rate, amount as a live formula, evidence type and sheet numbers.":
    "Azərbaycan və ingilis dillərində {n} sətir: vahid, miqdar, qiymət, düstur kimi məbləğ, mənbə növü və vərəq nömrələri.",
  "{q} quantities and {s} sources: file, page and the printed text each number was read from.": "{q} miqdar və {s} mənbə: hər rəqəmin oxunduğu fayl, səhifə və çap olunmuş mətn.",
  "{n} findings and agreements, with what the bill uses for each.": "{n} nəticə və uyğunluq, hər biri üçün cədvəldə nəyin istifadə olunduğu.",
  "The sample rate library and the rates used, including your edits.": "Nümunə qiymətlər və tətbiq olunan qiymətlər, dəyişiklikləriniz daxil.",
  "{n} items the drawings do not quantify.": "Cizgilərin miqdarlaşdırmadığı {n} bənd.",
  "Includes {c}.": "Daxildir: {c}.",
  "{n} edited rates": "{n} dəyişdirilmiş qiymət",
  "{n} quantity overrides": "{n} dəyişdirilmiş miqdar",
  "{n} corrections from checks": "yoxlamalardan {n} düzəliş",
  "Uses the printed quantities and the sample rates.": "Çap olunan miqdarlar və nümunə qiymətlər istifadə olunur.",
  "Building the workbook": "Fayl hazırlanır",
  "Download {f}": "{f} yüklə",
  "Print or save the bill as PDF": "Cədvəli çap et və ya PDF kimi saxla",
  "Downloaded.": "Yükləndi.",
  "The workbook could not be built. Reload the page and try again.": "Fayl hazırlana bilmədi. Səhifəni yeniləyin və yenidən cəhd edin.",

  // settings
  "Account, language and the data kept in this browser.": "Hesab, dil və bu brauzerdə saxlanan məlumatlar.",
  Account: "Hesab",
  "Signed in as": "Daxil olan istifadəçi",
  "The whole platform switches language. Line descriptions and source quotes keep the original Azerbaijani text where it is printed.":
    "Bütün platformanın dili dəyişir. Çap olunmuş mətnlər və mənbə sitatları orijinal Azərbaycan dilində qalır.",
  English: "English",
  Azerbaijani: "Azərbaycanca",
  "Project data": "Layihə məlumatları",
  "Rates, mark-ups, quantity overrides and applied corrections are saved in this browser.":
    "Qiymətlər, əlavələr, dəyişdirilmiş miqdarlar və tətbiq olunan düzəlişlər bu brauzerdə saxlanılır.",
  "{r} edited rates, {q} quantity overrides, {f} corrections": "{r} dəyişdirilmiş qiymət, {q} dəyişdirilmiş miqdar, {f} düzəliş",
  "Reset all edits": "Bütün dəyişiklikləri sıfırla",
  "Edits were reset.": "Dəyişikliklər sıfırlandı.",
  "Run the generation again": "Hazırlamanı yenidən işə sal",
  "Plays the generation sequence and opens the bill.": "Hazırlama ardıcıllığını göstərir və cədvəli açır.",
  "Plays the generation sequence and opens the project.": "Hazırlama ardıcıllığını göstərir və layihəni açır.",
  About: "Haqqında",
  "Quantities come from the four PDF files of the Qobu package. Rates are a sample AZN library, not part of the package.":
    "Miqdarlar Qobu paketinin dörd PDF faylından götürülüb. Qiymətlər nümunə AZN siyahısıdır, paketə daxil deyil.",
};

export function translate(lang: Lang, en: string, vars?: Vars) {
  let s = lang === "az" ? (AZ[en] ?? en) : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useT() {
  const lang = useApp((s) => s.lang);
  return useCallback((en: string, vars?: Vars) => translate(lang, en, vars), [lang]);
}

export const SHORT_AZ: Record<string, string> = {
  WH: "Anbar",
  AD: "İnzibati bina",
  PS: "Nasosxana",
  TK: "Su anbarları",
  SITE: "Abadlaşdırma",
};

export const DISCIPLINE_AZ: Record<string, string> = {
  general: "Ümumi",
  site: "Baş plan",
  arch: "Memarlıq",
  struct: "Konstruksiya",
  elec: "Elektrik təchizatı",
  hvac: "İstilik və ventilyasiya",
  plumb: "Su təchizatı və kanalizasiya",
  fire: "Yanğınsöndürmə",
  alarm: "Yanğın siqnalizasiyası",
  lowcur: "Rabitə və videomüşahidə",
  pa: "Səsli xəbərvermə",
};

export const CHAIN_AZ: Record<string, string> = {
  works: "Ölçülmüş işlər",
  overheads: "Qaimə xərcləri",
  profit: "Mənfəət",
  contingency: "Gözlənilməz xərclər",
  vat: "ƏDV",
};

export const CHECK_AZ: Record<string, { title: string; detail: string; fix?: string }> = {
  "C-01": {
    title: "Şr-2 şaquli rabitəsinin profil cəmi 400 kq artıq göstərilib",
    detail:
      "Şr-2 cədvəlinin hər sətrində cəm 404.40 kq yazılıb, lakin 4 × 51.10 kq və 8 × 25.55 kq hər ikisi 204.40 kq edir. 808.80 kq cəm 408.80 kq olmalıdır. Əvvəlki vərəqdəki Şr-1 eyni quruluşdadır və düzgün toplanır.",
    fix: "408.80 kq + 140.6 kq = 549.40 kq istifadə et",
  },
  "C-02": {
    title: "Anbarın döşəmə sahəsi konstruksiya və memarlıqda fərqlidir",
    detail:
      "Konstruksiya cədvəlində döşəmə tavası 1,109.10 m² ölçülüb (150 mm-də 166.37 m³). Memarlıq döşəmə quruluşu 1,122 m² otaq sahəsindən istifadə edir: 168.3 m³ tava və 561 m³ karbonat. Cədvəl betonu konstruksiya vərəqindən, döşəmə örtüyünü isə memarlıq vərəqindən götürür.",
  },
  "C-03": {
    title: "İnzibati binanın döşəmə tavası konstruksiyada 100 mm, memarlıqda 150 mm-dir",
    detail:
      "KS-49 konstruksiya vərəqində 100 mm tava və 18.1 m³ B15 göstərilib. Memarlıq bəzək cədvəlində hər döşəmə növünün altında 150 mm dəmir-beton tava var: 10.84 + 12.43 + 2.23 = 25.50 m³. Layihəçi təsdiq edənədək cədvəl konstruksiya dəyərindən istifadə edir.",
  },
  "C-04": {
    title: "MR-2 rigelinin həcmi yuxarı yuvarlaqlaşdırılıb",
    detail: "Bir MR-2 rigeli 0.84 m³-dir və altı ədəd var, bu 5.04 m³ edir. Cədvəldə 5.1 m³ yazılıb.",
    fix: "6 × 0.84 = 5.04 m³ istifadə et",
  },
  "C-05": {
    title: "Elektrik sayğacının miqdarı yoxdur",
    detail: "Anbarın elektrik cədvəlinin 4-cü sətrində 380 V, 3 × 25 A sayğac göstərilib, miqdar xanası boşdur. Say verilənədək cədvəl onu daxil etmir.",
  },
  "C-06": {
    title: "Torpaqlama materiallarının çəkisi uzunluqlarına uyğun deyil",
    detail:
      "40 × 4 mm zolaq 1.256 kq/m çəkir. 14-cü sətir (25 m, 32 kq) uyğundur, lakin 16-cı sətirdə 20 m və 15 kq yazılıb, 20 m isə 25.1 kq çəkir. 15-ci sətirdə 3 m Ø16 dairəvi polad 36 kq göstərilib; 1.58 kq/m ilə bu 4.7 kq edir. Cədvəl torpaqlamanı uzunluq üzrə ölçür.",
  },
  "C-07": {
    title: "İnzibati binanın üç elektrik vərəqinin adı səhvdir",
    detail:
      "MEP-42 cizgilər siyahısında 2, 4 və 5-ci vərəqlər ümumi məlumat, işıqlanma planı və güc və torpaqlama planı kimi verilib. Onların ştamplarında videomüşahidə planı və rabitə planı yazılıb. Reyestr siyahıdakı adlardan istifadə edir.",
  },
  "C-08": {
    title: "Anbarın ventilyasiya vərəqləri inzibati bina adı ilə verilib",
    detail:
      "10–14-cü vərəqlər anbar dəstindədir (MEP-8 üz vərəqi: ANBAR BİNASININ İŞÇİ LAYİHƏSİ) və 48 m anbarı göstərir, lakin ştamplarda İnzibati bina yazılıb. Reyestr onları anbara aid edir.",
  },
  "C-09": {
    title: "Fasad bəzəyinin sahəsi divar hörgüsündən böyükdür",
    detail:
      "Dörd fasadda 1,245.0 m² suvaq və boya göstərilib. Ümumi göstərişlərdə 400 mm əhəng daşı divarları 787.4 m² ölçülüb. Fasad sahəsinə frontonların və +7.00-dan yuxarı zolağın daxil olub-olmadığını təsdiq edin.",
  },
  "A-01": { title: "Sütunların sayı başmaqların sayına uyğundur", detail: "Ms-1–Ms-4 sütunları cəmi 21 + 4 + 4 + 2 = 31 ədəddir, bu da 31 MB-1 başmağına bərabərdir." },
  "A-02": {
    title: "Plandakı pəncərələrin sayı spesifikasiyaya uyğundur",
    detail: "Bəzək planında 21 P-1 pəncərə (uzun tərəflərdə 8 + 5, frontonlarda 4 + 4) və 3 Q-1 qapı var. Qapı və pəncərə spesifikasiyasında 21 və 3 göstərilib.",
  },
  "A-03": { title: "F-1 fermasının cədvəli düzgün toplanır", detail: "On altı profil sətri 828.26 kq, səkkiz lövhə sətri 253.36 kq edir, yazıldığı kimi." },
  "A-04": {
    title: "Otaq sahələri, bəzək cədvəli və yekun uyğundur",
    detail: "Yeddi otaq cəmi 170.1 m²-dir: otaqlar cədvəlinin və ümumi göstərişlərin yekunu. 1 + 5 otaqları 72.32 m², 2 + 3 + 4 otaqları 82.88 m², 6 + 7 otaqları 14.9 m²-dir: bəzək cədvəlindəki üç döşəmə sahəsi.",
  },
  "A-05": { title: "Su axıdan borular memarlıq və konstruksiyada uyğundur", detail: "Həm dam planı, həm ağac çatı cədvəli 21.8 m Ø100 su axıdan boru və 6 qıf göstərir." },
  "A-06": {
    title: "Ərazi qatları sahələrinə uyğundur",
    detail:
      "Çınqıl sahəsi 8,485.3 m² = qazon 2,532.3 + asfalt 5,549.0 + səki 404.0. Hər həcm sahə × qat qalınlığına bərabərdir: çınqıl 200 mm, iri dənəli asfalt 60 mm, xırda dənəli asfalt 40 mm, karbonat 100 mm, qara torpaq 300 mm, sement-qum qatı 100 mm.",
  },
  "A-07": {
    title: "Hörgü sahələri ümumi göstərişlər və hörgü planında uyğundur",
    detail: "Xarici əhəng daşı 187.73 m², 200 mm arakəsmələr 149.27 m² və 50 mm arakəsmələr 13.7 m² həm ümumi göstərişlərdə, həm də divar növləri cədvəlində var.",
  },
};

export const GAP_AZ: Record<string, string> = {
  Earthworks: "Qazma və ya torpaq balansı miqdarları yoxdur. Çalanın planları (KS-4, KS-41) kontur verir, həcm vermir; relyef planı isə təsvirdir.",
  "Tank and pump station structure": "İki 100 m³ su anbarı və nasosxana üçün yalnız mühəndis sistemləri vərəqləri verilib. Beton, armatur və hidroizolyasiya üçün konstruksiya cizgiləri lazımdır.",
  Formwork: "Ayrıca ölçülməyib. Bünövrə və karkas üçün nümunə beton qiymətlərinə qəlib daxildir.",
  "Blinding under foundations": "Qalınlıq verilib (100 mm, B7.5), sahə verilməyib, ona görə cədvələ daxil edilməyib.",
  Waterproofing: "Bünövrə kəsiklərində göstərilib (isti bitumda 2 qat ruberoid), miqdar verilməyib.",
  "External networks": "Paketdə xarici su, kanalizasiya və elektrik şəbəkələrinin planları yoxdur.",
  Prices: "Paketdə smeta, qiymət və qiymət bazası yoxdur. Demo dəyişdirilə bilən nümunə AZN qiymətlərindən istifadə edir.",
};

export const RATE_GROUP_AZ: Record<string, string> = {
  Concrete: "Beton",
  Reinforcement: "Armatur",
  Steel: "Metal konstruksiyalar",
  "Earthworks and bases": "Torpaq işləri və əsaslar",
  Masonry: "Hörgü",
  Finishes: "Bəzək işləri",
  Roofing: "Dam örtüyü",
  "Doors and windows": "Qapı və pəncərələr",
  "External works": "Abadlaşdırma",
  "Building services": "Mühəndis sistemləri",
};

export const RATE_AZ: Record<string, string> = {
  conc_fdn: "Bünövrədə B25 beton, qəliblə birlikdə",
  conc_slab_grd: "Döşəmə tavasında B15 beton, tökülmüş və hamarlanmış",
  conc_blind: "B7.5 beton hazırlıq qatı",
  conc_col: "Sütunlarda B25 beton, qəliblə birlikdə",
  conc_beam: "Rigel və kəmərlərdə B25 beton, qəliblə birlikdə",
  conc_slab: "Örtük tavasında B25 beton, qəliblə birlikdə",
  rebar_a500: "A500C armatur, kəsilmiş, əyilmiş və quraşdırılmış",
  rebar_ai: "A-I (A240) armatur, kəsilmiş, əyilmiş və quraşdırılmış",
  steel_struct: "Metal konstruksiya, hazırlanmış, astarlanmış və quraşdırılmış",
  steel_embed: "Qoyma detallar və ankerlər",
  crushed_stone: "Qırmadaş qatı, döşənmiş və kipləşdirilmiş",
  fill_carbonate: "Karbonat qatı, laylarla kipləşdirilmiş",
  wall_limestone: "400 mm mişar daşı divar, sement məhlulunda",
  wall_brick200: "200 mm boşluqlu kərpic arakəsmə",
  wall_brick50: "50 mm kərpic arakəsmə",
  int_paint: "Daxili suvaq, şpatlovka və 3 qat boya",
  facade_paint: "Xarici suvaq və 3 qat fasad boyası",
  polished_conc: "50 mm cilalanmış beton",
  floor_porcelain: "Yapışdırıcı və məhlul üzərində keramoqranit",
  floor_laminate: "Dikt və reyka üzərində laminat, məhlulla",
  floor_tile: "Məhlul üzərində metlax",
  ceil_gypsum: "Alçipan tavan, şpatlovka və boya",
  ceil_metal: "Metal asma tavan",
  wall_wallpaper: "Suvaq, şpatlovka, rənglənən divar kağızı, 3 qat boya",
  wall_tile: "Suvaq və kafel",
  roof_sheet: "Profnastil dam örtüyü, bərkidilmiş",
  timber_roof: "Ağac çatı elementləri, emal olunmuş və quraşdırılmış",
  flashing: "Metal lövhə (palan)",
  gutter: "Su aparan nov Ø100",
  downpipe: "Su axıdan boru Ø100",
  rain_elbow: "Dirsək",
  rain_funnel: "Su qəbuledici qıf",
  rain_clamp: "Metal xamut",
  door_roller: "Hermetik jalüz qapı",
  window_pvc: "PVC pəncərə, ikiqat şüşəli",
  door_mdf: "MDF daxili qapı, çərçivə və furnitura ilə",
  door_pvc: "PVC qapı, çərçivə ilə",
  door_alu: "Alüminium giriş qapı-pəncərə",
  lawn: "Rulon qazon, döşənmiş",
  paving: "80 mm səki daşı",
  kerb: "Bordyur daşı, quraşdırılmış",
  gravel: "Çınqıl əsas, kipləşdirilmiş",
  asphalt_coarse: "İri dənəli asfaltbeton, döşənmiş və vərdənələnmiş",
  asphalt_fine: "Xırda dənəli asfaltbeton, döşənmiş və vərdənələnmiş",
  topsoil: "Qara torpaq, yayılmış və hamarlanmış",
  sand_cement: "Quru sement-qum qatı",
};
