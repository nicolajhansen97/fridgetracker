import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import da from './da';
import de from './de';
import fr from './fr';
import es from './es';

const LANGUAGE_KEY = 'freezely_language';

const dictionaries = { en, da, de, fr, es };

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'da', label: 'Dansk', flag: '\u{1F1E9}\u{1F1F0}' },
  { code: 'de', label: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'fr', label: 'Fran\u00e7ais', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'es', label: 'Espa\u00f1ol', flag: '\u{1F1EA}\u{1F1F8}' },
];

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      if (saved && dictionaries[saved]) {
        setLocaleState(saved);
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

  const t = (key, params) => translate(locale, key, params);

  return (
    <LanguageContext.Provider value={{ t, locale, setLocale, languages: SUPPORTED_LANGUAGES, ready }}>
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
