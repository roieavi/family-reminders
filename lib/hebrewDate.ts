// Self-contained Gregorian -> Hebrew calendar conversion and Hebrew numeral
// (gematira) formatting. No external dependency — this is the public-domain
// Fourmilab `calendar.js` algorithm, reimplemented and round-trip verified.

const GREGORIAN_EPOCH = 1721425.5;
const HEBREW_EPOCH = 347995.5;

function mod(a: number, b: number): number {
  return a - b * Math.floor(a / b);
}

function leapGregorian(year: number): boolean {
  return year % 4 === 0 && !(year % 100 === 0 && year % 400 !== 0);
}

function gregorianToJd(year: number, month: number, day: number): number {
  return (
    GREGORIAN_EPOCH -
    1 +
    365 * (year - 1) +
    Math.floor((year - 1) / 4) -
    Math.floor((year - 1) / 100) +
    Math.floor((year - 1) / 400) +
    Math.floor(
      (367 * month - 362) / 12 +
        (month <= 2 ? 0 : leapGregorian(year) ? -1 : -2) +
        day
    )
  );
}

function hebrewLeap(year: number): boolean {
  return mod(7 * year + 1, 19) < 7;
}

function hebrewYearMonths(year: number): number {
  return hebrewLeap(year) ? 13 : 12;
}

function hebrewDelay1(year: number): number {
  const months = Math.floor((235 * year - 234) / 19);
  const parts = 12084 + 13753 * months;
  let day = months * 29 + Math.floor(parts / 25920);
  if (mod(3 * (day + 1), 7) < 3) day++;
  return day;
}

function hebrewDelay2(year: number): number {
  const last = hebrewDelay1(year - 1);
  const present = hebrewDelay1(year);
  const next = hebrewDelay1(year + 1);
  if (next - present === 356) return 2;
  if (present - last === 382) return 1;
  return 0;
}

function hebrewYearDays(year: number): number {
  return hebrewToJd(year + 1, 7, 1) - hebrewToJd(year, 7, 1);
}

function hebrewMonthDays(year: number, month: number): number {
  if ([2, 4, 6, 10, 13].includes(month)) return 29;
  if (month === 12 && !hebrewLeap(year)) return 29;
  if (month === 8 && mod(hebrewYearDays(year), 10) !== 5) return 29;
  if (month === 9 && mod(hebrewYearDays(year), 10) === 3) return 29;
  return 30;
}

function hebrewToJd(year: number, month: number, day: number): number {
  let jd = HEBREW_EPOCH + hebrewDelay1(year) + hebrewDelay2(year) + day + 1;
  if (month < 7) {
    for (let m = 7; m <= hebrewYearMonths(year); m++) jd += hebrewMonthDays(year, m);
    for (let m = 1; m < month; m++) jd += hebrewMonthDays(year, m);
  } else {
    for (let m = 7; m < month; m++) jd += hebrewMonthDays(year, m);
  }
  return jd;
}

function jdToHebrew(jd: number): { year: number; month: number; day: number } {
  jd = Math.floor(jd) + 0.5;
  const count = Math.floor(((jd - HEBREW_EPOCH) * 98496.0) / 35975351.0);
  let i = count;
  while (jd >= hebrewToJd(i, 7, 1)) i++;
  const year = i - 1;

  let month = jd < hebrewToJd(year, 1, 1) ? 7 : 1;
  while (jd > hebrewToJd(year, month, hebrewMonthDays(year, month))) month++;

  const day = jd - hebrewToJd(year, month, 1) + 1;
  return { year, month, day };
}

// Standard Hebrew numeral (gematria) formatting, including the 15/16
// exception (ט״ו / ט״ז instead of י״ה / י״ו) and geresh/gershayim marks.
function hebrewNumeral(num: number): string {
  let n = num;
  const letters: string[] = [];
  while (n >= 400) {
    letters.push("ת");
    n -= 400;
  }
  if (n >= 300) {
    letters.push("ש");
    n -= 300;
  } else if (n >= 200) {
    letters.push("ר");
    n -= 200;
  } else if (n >= 100) {
    letters.push("ק");
    n -= 100;
  }

  if (n === 15) {
    letters.push("ט", "ו");
    n = 0;
  } else if (n === 16) {
    letters.push("ט", "ז");
    n = 0;
  } else {
    const TENS: [number, string][] = [
      [90, "צ"], [80, "פ"], [70, "ע"], [60, "ס"], [50, "נ"],
      [40, "מ"], [30, "ל"], [20, "כ"], [10, "י"],
    ];
    for (const [v, l] of TENS) {
      if (n >= v) {
        letters.push(l);
        n -= v;
        break;
      }
    }
    const UNITS: [number, string][] = [
      [9, "ט"], [8, "ח"], [7, "ז"], [6, "ו"], [5, "ה"],
      [4, "ד"], [3, "ג"], [2, "ב"], [1, "א"],
    ];
    for (const [v, l] of UNITS) {
      if (n >= v) {
        letters.push(l);
        n -= v;
        break;
      }
    }
  }

  if (letters.length === 0) return "";
  if (letters.length === 1) return letters[0] + "׳"; // geresh
  return letters.slice(0, -1).join("") + "״" + letters[letters.length - 1]; // gershayim before last letter
}

const MONTH_NAMES: Record<number, string> = {
  1: "ניסן", 2: "אייר", 3: "סיוון", 4: "תמוז", 5: "אב", 6: "אלול",
  7: "תשרי", 8: "חשוון", 9: "כסלו", 10: "טבת", 11: "שבט",
  12: "אדר", 13: "אדר ב׳",
};

function hebrewMonthName(year: number, month: number): string {
  if (month === 12 && hebrewLeap(year)) return "אדר א׳";
  return MONTH_NAMES[month];
}

// Formats a Date (read in its local/system time) as a Hebrew date string,
// e.g. "י״ד באלול תשפ״ו".
export function formatHebrewDate(date: Date): string {
  const jd = gregorianToJd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { year, month, day } = jdToHebrew(jd);
  const dayStr = hebrewNumeral(day);
  const monthStr = hebrewMonthName(year, month);
  const yearStr = hebrewNumeral(mod(year, 1000));
  return `${dayStr} ב${monthStr} ${yearStr}`;
}
