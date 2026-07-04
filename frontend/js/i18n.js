const I18N_KEY = 'murmur_lang';
let currentLang = 'zh-CN';
let translations = {};

function getBrowserLang() {
  const lang = navigator.language || navigator.userLanguage;
  if (lang.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

async function loadLang(lang) {
  try {
    const r = await fetch(`${API}/static/js/i18n/${lang}.json`);
    if (r.ok) {
      translations = await r.json();
      currentLang = lang;
      localStorage.setItem(I18N_KEY, lang);
      return true;
    }
  } catch (e) {
    console.error('Failed to load language:', e);
  }
  return false;
}

function t(key) {
  const keys = key.split('.');
  let val = translations;
  for (const k of keys) {
    if (val && typeof val === 'object' && k in val) {
      val = val[k];
    } else {
      return key;
    }
  }
  return val || key;
}

async function initI18n() {
  const saved = localStorage.getItem(I18N_KEY);
  const lang = saved || getBrowserLang();
  await loadLang(lang);
  return currentLang;
}

function setLang(lang) {
  localStorage.setItem(I18N_KEY, lang);
  location.reload();
}
