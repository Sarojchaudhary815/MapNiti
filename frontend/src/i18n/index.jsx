// English / Nepali interface text.
//
// The English sentence is the key: t('Run analysis') returns the Nepali text
// when the visitor picked नेपाली and a translation exists, otherwise the English
// itself. So untranslated strings never break, and adding a language only means
// adding entries to NE below. The choice is remembered in localStorage.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const NE = {
  // public navigation
  Home: 'गृहपृष्ठ',
  'About Us': 'हाम्रो बारेमा',
  Services: 'सेवाहरू',
  Contact: 'सम्पर्क',
  'Learn & Resources': 'सिकाइ र स्रोतहरू',
  'Learn GIS — courses': 'GIS सिक्नुहोस् — कोर्सहरू',
  'Zero to advanced, with runnable code': 'सुरुदेखि उन्नत तहसम्म, चलाउन मिल्ने कोडसहित',
  'Learn Programming': 'प्रोग्रामिङ सिक्नुहोस्',
  'Python for GIS, step by step, run every cell': 'GIS का लागि Python, चरणबद्ध रूपमा',
  'Code Lab': 'कोड ल्याब',
  'Run HTML, Python, JS & SQL in the browser': 'ब्राउजरमै HTML, Python, JS र SQL चलाउनुहोस्',
  'GIS Guide': 'GIS गाइड',
  'What GIS can do, tools & analysis guides': 'GIS ले के गर्न सक्छ, टुल र विश्लेषण गाइड',
  "What's New in GIS": 'GIS मा नयाँ के छ',
  'Data Sources': 'डाटा स्रोतहरू',
  'Nepal & global data portals': 'नेपाल र विश्वका डाटा पोर्टलहरू',
  'Case Studies': 'केस स्टडीहरू',
  'Real analyses: data, steps & results': 'वास्तविक विश्लेषण: डाटा, चरण र नतिजा',
  'AI Assistant': 'AI सहायक',
  'MapNiti Tool': 'MapNiti टुल',
  Login: 'लगइन',
  Logout: 'लगआउट',
  Register: 'दर्ता',
  'Get Started': 'सुरु गर्नुहोस्',
  "Hello, Engineer's": 'नमस्ते, इन्जिनियरहरू',
  'Welcome to': 'स्वागत छ',
  'A complete GIS and remote sensing platform for hydrology, disaster risk, urban planning, and agriculture analysis, powered by Google Earth Engine.':
    'जलविज्ञान, विपद् जोखिम, सहरी योजना र कृषि विश्लेषणका लागि Google Earth Engine मा आधारित पूर्ण GIS तथा रिमोट सेन्सिङ प्लेटफर्म।',

  // tool sidebar / modules
  Overview: 'सारांश',
  'Urban Planning': 'सहरी योजना',
  'Disaster Risk': 'विपद् जोखिम',
  'Hydrology Tool': 'जलविज्ञान टुल',
  'Agriculture Tool': 'कृषि टुल',
  'Data Management': 'डाटा व्यवस्थापन',
  'GEE Data Hub': 'GEE डाटा हब',
  'Engineer Toolkit': 'इन्जिनियर टुलकिट',
  'Data Download': 'डाटा डाउनलोड',
  'Live Nepal': 'लाइभ नेपाल',
  'Field Collect': 'फिल्ड सङ्कलन',
  'Use my GPS': 'मेरो GPS प्रयोग',
  'Pick on map': 'नक्सामा छान्नुहोस्',
  'Save record': 'रेकर्ड सेभ गर्नुहोस्',
  'Sync now': 'अहिले सिंक गर्नुहोस्',
  'New survey': 'नयाँ सर्वेक्षण',
  'Online': 'अनलाइन',
  'Offline': 'अफलाइन',
  'Location': 'स्थान',
  'Details': 'विवरण',
  'Photo': 'फोटो',
  Admin: 'एडमिन',
  'Learn & Guides': 'सिकाइ र गाइड',
  'Choose project': 'प्रोजेक्ट छान्नुहोस्',
  History: 'इतिहास',

  // AOI picker
  Draw: 'कोर्नुहोस्',
  Nepal: 'नेपाल',
  'Nepal boundaries': 'नेपालका सिमानाहरू',
  'Search a palika or district…': 'पालिका वा जिल्ला खोज्नुहोस्…',
  'Province…': 'प्रदेश…',
  'District…': 'जिल्ला…',
  'Palika (local level)…': 'पालिका (स्थानीय तह)…',
  'Area of interest selected': 'अध्ययन क्षेत्र छानियो',
  'Clear AOI': 'क्षेत्र हटाउनुहोस्',
  'Upload a GeoJSON polygon.': 'GeoJSON बहुभुज अपलोड गर्नुहोस्।',

  // analysis runner
  'How to use · data sources': 'कसरी प्रयोग गर्ने · डाटा स्रोत',
  'Run analysis': 'विश्लेषण चलाउनुहोस्',
  'Select an AOI first': 'पहिले क्षेत्र छान्नुहोस्',
  'Running on Earth Engine…': 'Earth Engine मा चल्दैछ…',
  'PDF report': 'PDF रिपोर्ट',
  'Publish as article & share': 'लेखको रूपमा प्रकाशित गरी सेयर गर्नुहोस्',
  'Before / after swipe': 'पहिले / पछि तुलना',
  'Run again': 'फेरि चलाउनुहोस्',
  Opacity: 'पारदर्शिता',
  'Analysis history': 'विश्लेषणको इतिहास',
  Open: 'खोल्नुहोस्',
  'is ready': 'तयार भयो',
  failed: 'असफल भयो',
  running: 'चलिरहेको',

  // live nepal
  'River levels': 'नदीको सतह',
  Rainfall: 'वर्षा',
  'Disaster incidents': 'विपद्का घटनाहरू',
  stations: 'स्टेसन',
  warning: 'चेतावनी',
  danger: 'खतरा',
  incidents: 'घटना',
  deaths: 'मृत्यु',
  injured: 'घाइते',
  missing: 'बेपत्ता',
  'All rivers are below their warning level.': 'सबै नदी चेतावनी तहभन्दा तल छन्।',

  // auth
  Email: 'इमेल',
  Password: 'पासवर्ड',
  'Sign in': 'साइन इन',
  'Create account': 'खाता बनाउनुहोस्',
};

const DICTS = { en: {}, ne: NE };
const KEY = 'mn_lang';
const I18nContext = createContext({ lang: 'en', setLang: () => {}, t: (s) => s });

// The site is English-only for now: the language switch is hidden and an
// earlier saved choice of Nepali is ignored. The Nepali dictionary stays for later.
const initialLang = () => {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  return 'en';
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* not remembered */ }
  };
  useEffect(() => { document.documentElement.lang = lang === 'ne' ? 'ne' : 'en'; }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: (s) => (s && DICTS[lang][s]) || s }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;

/** Small EN | नेपाली switch. `dark` for blue/dark backgrounds. */
export function LanguageToggle({ dark = false, compact = false }) {
  const { lang, setLang } = useI18n();
  const base = 'px-2 py-1 text-[11px] font-bold rounded-md transition-colors';
  const on = dark ? 'bg-white text-[#0047AB]' : 'bg-theme-700 text-white';
  const off = dark ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-800';
  return (
    <div role="group" aria-label="Language" className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'bg-slate-100'}`}>
      <button type="button" onClick={() => setLang('en')} aria-pressed={lang === 'en'} className={`${base} ${lang === 'en' ? on : off}`}>EN</button>
      <button type="button" onClick={() => setLang('ne')} aria-pressed={lang === 'ne'} className={`${base} ${lang === 'ne' ? on : off}`}>{compact ? 'ने' : 'नेपाली'}</button>
    </div>
  );
}
