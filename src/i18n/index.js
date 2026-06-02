import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import da from './da';
import de from './de';
import fr from './fr';
import es from './es';

const LANGUAGE_KEY = 'freezely_language';
const DATE_FORMAT_KEY = 'freezely_date_format';

const dictionaries = { en, da, de, fr, es };

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'da', label: 'Dansk', flag: '\u{1F1E9}\u{1F1F0}' },
  { code: 'de', label: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'fr', label: 'Fran\u00e7ais', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'es', label: 'Espa\u00f1ol', flag: '\u{1F1EA}\u{1F1F8}' },
];

// Device-local date display preference. 'european' keeps the original
// DD-MM-YYYY layout (default, so existing users see no change); 'american'
// switches to MM/DD/YYYY. The example pattern doubles as the Pill label.
export const SUPPORTED_DATE_FORMATS = [
  { code: 'european', pattern: 'DD-MM-YYYY' },
  { code: 'american', pattern: 'MM/DD/YYYY' },
];

// Default date layout per language, used until the user explicitly picks one.
// All bundled languages default to European (day-first) — including English,
// since most English-speaking regions (UK, AU, IE) write day-first and only
// the US uses month-first. American (MM/DD/YYYY) is therefore opt-in via
// Settings. The map stays per-language so a future locale can default
// differently without touching the rest of the logic.
const LOCALE_DATE_FORMAT = {
  en: 'european',
  da: 'european',
  de: 'european',
  fr: 'european',
  es: 'european',
};

const localeDefaultDateFormat = (locale) => LOCALE_DATE_FORMAT[locale] || 'european';

// Format an ISO-ish date string for display in the user's chosen layout.
// Only display order/separator changes here \u2014 stored dates stay YYYY-MM-DD.
const formatDateWith = (dateString, dateFormat) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return dateFormat === 'american' ? `${mm}/${dd}/${yyyy}` : `${dd}-${mm}-${yyyy}`;
};

const resolve = (obj, path) => {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
};

const interpolate = (str, params) => {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => (params[key] !== undefined ? params[key] : `{${key}}`));
};

const translate = (locale, key, params) => {
  const dict = dictionaries[locale] || dictionaries.en;
  let value = resolve(dict, key);

  // Plural support: if params.count exists and count !== 1, try _plural key
  if (params && params.count !== undefined && params.count !== 1) {
    const pluralValue = resolve(dict, key + '_plural');
    if (pluralValue) value = pluralValue;
    // Also check English fallback for plural
    if (!value) {
      const enPlural = resolve(dictionaries.en, key + '_plural');
      if (enPlural) value = enPlural;
    }
  }

  // Fallback to English
  if (value === undefined) {
    value = resolve(dictionaries.en, key);
    if (params && params.count !== undefined && params.count !== 1) {
      const enPlural = resolve(dictionaries.en, key + '_plural');
      if (enPlural) value = enPlural;
    }
  }

  if (value === undefined) return key; // Last resort: return the key itself
  return interpolate(String(value), params);
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [locale, setLocaleState] = useState('en');
  // null = no explicit choice yet, so the date format follows the language.
  const [dateFormatPref, setDateFormatPref] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(LANGUAGE_KEY),
      AsyncStorage.getItem(DATE_FORMAT_KEY),
    ]).then(([savedLocale, savedDateFormat]) => {
      if (savedLocale && dictionaries[savedLocale]) {
        setLocaleState(savedLocale);
      }
      if (savedDateFormat === 'european' || savedDateFormat === 'american') {
        setDateFormatPref(savedDateFormat);
      }
      setReady(true);
    });
  }, []);

  const setLocale = async (code) => {
    if (dictionaries[code]) {
      setLocaleState(code);
      await AsyncStorage.setItem(LANGUAGE_KEY, code);
    }
  };

  const setDateFormat = async (code) => {
    if (code === 'european' || code === 'american') {
      setDateFormatPref(code);
      await AsyncStorage.setItem(DATE_FORMAT_KEY, code);
    }
  };

  // Effective format: the user's explicit choice if they made one, otherwise
  // the default implied by their language.
  const dateFormat = dateFormatPref || localeDefaultDateFormat(locale);

  const t = (key, params) => translate(locale, key, params);
  const formatDate = (dateString) => formatDateWith(dateString, dateFormat);
  const dateFormatPattern =
    SUPPORTED_DATE_FORMATS.find((f) => f.code === dateFormat)?.pattern || 'DD-MM-YYYY';

  return (
    <LanguageContext.Provider
      value={{
        t,
        locale,
        setLocale,
        languages: SUPPORTED_LANGUAGES,
        ready,
        dateFormat,
        setDateFormat,
        dateFormats: SUPPORTED_DATE_FORMATS,
        formatDate,
        dateFormatPattern,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
