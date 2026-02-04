/**
 * Translation service using MyMemory free API (no API key required).
 * https://mymemory.translated.net/
 *
 * Improves precision by:
 * - Translating sentence-by-sentence (better context, respects 500-byte limit)
 * - Preferring highest-quality match from API when multiple options exist
 * - Normalizing input (NFC, trim, strip stray quotes)
 */

const MAX_BYTES_PER_REQUEST = 500;

/** MyMemory prefers some locale codes for better engine selection. */
const LANGPAIR_MAP = {
  zh: 'zh-CN',
  // en, es, fr, de, ar, hi, pt, tl left as-is (2-letter is fine)
};

function toLangPair(code) {
  return LANGPAIR_MAP[code] || code;
}

/**
 * Split text into segments for translation. Each segment is at most MAX_BYTES_PER_REQUEST
 * bytes (UTF-8). Prefer sentence boundaries (. ! ? and newlines) for better precision.
 */
function splitIntoChunks(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const segments = [];
  // Split on sentence boundaries, keeping the delimiter with the previous part
  const parts = trimmed.split(/(?<=[.!?])\s+|\n+/);
  let current = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const candidate = current ? `${current} ${part}` : part;
    const bytes = new TextEncoder().encode(candidate).length;

    if (bytes <= MAX_BYTES_PER_REQUEST) {
      current = candidate;
    } else {
      if (current) {
        segments.push(current);
        current = '';
      }
      // Single part exceeds limit: split by middle space or use whole thing and let API handle
      const partBytes = new TextEncoder().encode(part).length;
      if (partBytes <= MAX_BYTES_PER_REQUEST) {
        current = part;
      } else {
        // Split long sentence by commas or mid-string to stay under limit
        let rest = part;
        while (rest) {
          const enc = new TextEncoder().encode(rest);
          if (enc.length <= MAX_BYTES_PER_REQUEST) {
            segments.push(rest);
            rest = '';
            break;
          }
          let splitAt = Math.floor(MAX_BYTES_PER_REQUEST / 2);
          const chunk = rest.slice(0, splitAt);
          const lastComma = chunk.lastIndexOf(',');
          const lastSpace = chunk.lastIndexOf(' ');
          const cut = lastSpace > lastComma * 0.5 ? lastSpace : lastComma > 0 ? lastComma : splitAt;
          segments.push(rest.slice(0, cut + 1).trim());
          rest = rest.slice(cut + 1).trim();
        }
      }
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * Single-segment translation. Picks best result from responseData or matches[] by quality.
 */
async function translateSegment(segment, fromLang, toLang) {
  const from = toLangPair(fromLang);
  const to = toLangPair(toLang);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(segment)}&langpair=${from}|${to}&mt=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const data = await res.json();

  const main = data?.responseData?.translatedText;
  const mainStr = main && typeof main === 'string' && !main.startsWith('MYMEMORY WARNING')
    ? main.trim()
    : null;

  const matches = data?.matches || [];
  const alternatives = matches
    .filter((m) => m.translation && String(m.translation).trim())
    .map((m) => ({ text: String(m.translation).trim(), quality: Number(m.quality) || 0 }))
    .filter((m) => m.text.toLowerCase() !== segment.toLowerCase());

  // Prefer main API result when it's a real translation (often best MT result)
  if (mainStr && mainStr.toLowerCase() !== segment.toLowerCase()) {
    const bestOther = alternatives.length > 0 ? Math.max(...alternatives.map((a) => a.quality)) : 0;
    alternatives.push({ text: mainStr, quality: bestOther + 1 });
  }

  if (alternatives.length === 0) throw new Error('MyMemory: no translation');
  alternatives.sort((a, b) => b.quality - a.quality);
  return alternatives[0].text;
}

function normalizeInput(text) {
  let s = (text || '').trim();
  if (typeof s.normalize === 'function') s = s.normalize('NFC');
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('"') && s.endsWith('""'))) {
    s = s.replace(/^"+/, '').replace(/"+$/, '').trim();
  }
  return s;
}

export async function translateText(text, fromLang, toLang) {
  const trimmed = normalizeInput(text);
  if (!trimmed) return '';
  if (fromLang === toLang) return trimmed;

  try {
    const chunks = splitIntoChunks(trimmed);
    if (chunks.length === 0) return '';

    if (chunks.length === 1) {
      const result = await translateSegment(chunks[0], fromLang, toLang);
      return result.toLowerCase() === trimmed.toLowerCase() ? '' : result;
    }

    const translated = [];
    for (const chunk of chunks) {
      const t = await translateSegment(chunk, fromLang, toLang);
      translated.push(t);
    }
    const result = translated.join(' ').trim();
    return result.toLowerCase() === trimmed.toLowerCase() ? '' : result;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('MyMemory translation failed:', err?.message ?? err);
    }
  }

  return '';
}
