/** Dates are `YYYY-MM-DD` strings throughout, so they compare correctly as plain strings. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** India Standard Time is UTC+5:30. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** First month (April) of the Indian financial year. */
const FY_FIRST_MONTH = 4;

/** `"2025-05-12"` becomes `"12 May 2025"`. */
export const longDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
};

/** `"2025-05-12"` becomes `"12/05/2025"`. */
export const slashDate = (isoDate: string): string => isoDate.split('-').reverse().join('/');

/** Calendar year in which the Indian financial year (1 April to 31 March) containing `isoDate` starts. */
export const fyStartYear = (isoDate: string): number => {
  const year = Number(isoDate.slice(0, 4));
  return Number(isoDate.slice(5, 7)) >= FY_FIRST_MONTH ? year : year - 1;
};

/** `2026` becomes `"2026-27"`. */
export const fyLabel = (startYear: number): string => `${startYear}-${String(startYear + 1).slice(2)}`;

/** Today's date in India (IST) as `YYYY-MM-DD`. */
export const istDate = (now: Date): string => new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Gregorian leap-year rule: divisible by 4, except centuries not divisible by 400. */
export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** True only for a real calendar date written `YYYY-MM-DD`: `2026-99-99` and `2025-02-29` are not. */
export function isRealDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  const days = month === 2 && isLeapYear(year) ? 29 : (MONTH_DAYS[month - 1] ?? 0);
  return day <= days;
}
