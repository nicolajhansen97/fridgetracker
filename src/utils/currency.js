// Money formatting for the price / waste-value features.
//
// Deliberately a small hand-rolled table rather than Intl.NumberFormat: the
// currency list here is short, the formatting rules are simple, and this keeps
// the behaviour identical on every device regardless of which ICU data the
// JS engine happens to ship. It also mirrors how SUPPORTED_DATE_FORMATS works
// in src/i18n/index.js — a user-facing display preference with a
// per-language default, overridable in Settings.
//
//   symbol   what to show
//   position 'before' (£4.50) or 'after' (4,50 kr)
//   decimal  separator used between major and minor units

export const SUPPORTED_CURRENCIES = [
  { code: 'DKK', symbol: 'kr',  position: 'after',  decimal: ',' },
  { code: 'EUR', symbol: '€',   position: 'after',  decimal: ',' },
  { code: 'GBP', symbol: '£',   position: 'before', decimal: '.' },
  { code: 'USD', symbol: '$',   position: 'before', decimal: '.' },
  { code: 'SEK', symbol: 'kr',  position: 'after',  decimal: ',' },
  { code: 'NOK', symbol: 'kr',  position: 'after',  decimal: ',' },
  { code: 'CHF', symbol: 'CHF', position: 'before', decimal: '.' },
  { code: 'PLN', symbol: 'zł',  position: 'after',  decimal: ',' },
  { code: 'CZK', symbol: 'Kč',  position: 'after',  decimal: ',' },
  { code: 'AUD', symbol: '$',   position: 'before', decimal: '.' },
];

// Default currency per app language, used until the user picks one in
// Settings. Same reasoning as LOCALE_DATE_FORMAT: a sensible guess that is
// always overridable, never a guess the user is stuck with.
const LOCALE_CURRENCY = {
  en: 'GBP',
  da: 'DKK',
  de: 'EUR',
  fr: 'EUR',
  es: 'EUR',
};

export const localeDefaultCurrency = (locale) => LOCALE_CURRENCY[locale] || 'EUR';

export const findCurrency = (code) =>
  SUPPORTED_CURRENCIES.find((c) => c.code === code) || SUPPORTED_CURRENCIES[0];

// Format an amount for display. Whole amounts drop the decimals ("45 kr", not
// "45,00 kr") because most grocery prices read better short, but anything with
// minor units keeps both digits.
export const formatMoneyWith = (amount, currencyCode, { compact = false } = {}) => {
  const n = Number(amount);
  if (amount === null || amount === undefined || !isFinite(n)) return '';
  const cur = findCurrency(currencyCode);

  const rounded = Math.round(n * 100) / 100;
  const isWhole = Math.abs(rounded % 1) < 0.005;

  // Compact is for tight spots (stat tiles): 1.2k rather than 1.234,50.
  let body;
  if (compact && Math.abs(rounded) >= 1000) {
    const thousands = rounded / 1000;
    body = `${thousands.toFixed(thousands >= 10 ? 0 : 1).replace('.', cur.decimal)}k`;
  } else {
    body = isWhole
      ? String(Math.round(rounded))
      : rounded.toFixed(2).replace('.', cur.decimal);
  }

  return cur.position === 'before' ? `${cur.symbol}${body}` : `${body} ${cur.symbol}`;
};

// Parse what the user typed into a price field. Accepts both separators, since
// someone on a Danish keyboard types "45,50" and the numeric keypad on iOS
// offers a full stop. Returns null for anything unusable, which is the same
// thing as "no price" everywhere downstream.
export const parseMoney = (text) => {
  if (text === null || text === undefined) return null;
  const cleaned = String(text).replace(/[^0-9.,-]/g, '').replace(',', '.');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  const n = Number(cleaned);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
};
