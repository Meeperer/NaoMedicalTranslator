/**
 * Detect language from text (for "auto" language selection).
 * Maps franc ISO 639-3 codes to our supported codes: en, es, fr, de, zh, ar, hi, pt.
 */
import { franc } from 'franc';

const FRANC_TO_CODE = {
  eng: 'en', spa: 'es', fra: 'fr', deu: 'de', zho: 'zh', arb: 'ar', ara: 'ar',
  hin: 'hi', por: 'pt', cmn: 'zh', nan: 'zh', tgl: 'tl', // Tagalog/Filipino
};

const SUPPORTED = new Set(Object.values(FRANC_TO_CODE));

/** Normalize for franc: strip accents so "cómo" doesn't get misdetected as Esperanto. */
function normalizeForDetection(str) {
  return str
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '');
}

export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'en';
  const trimmed = text.trim();
  if (trimmed.length < 2) return 'en';
  const normalized = normalizeForDetection(trimmed);
  const iso = franc(normalized, { minLength: 2 }) || 'eng';
  if (iso === 'und') return 'en';
  const code = FRANC_TO_CODE[iso] || (SUPPORTED.has(iso) ? iso : 'en');
  return code;
}
