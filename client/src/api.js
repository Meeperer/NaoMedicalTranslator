// When deploying frontend on Vercel with backend elsewhere, set VITE_API_URL to your backend URL
const BACKEND_ORIGIN = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '') : '';
const BASE = BACKEND_ORIGIN ? `${BACKEND_ORIGIN}/api` : '/api';

export function getBackendOrigin() {
  return BACKEND_ORIGIN;
}

/**
 * Read response as text and parse as JSON. Avoids "unexpected character" when
 * server returns HTML (e.g. 404/500 page) instead of JSON.
 */
async function parseJsonResponse(res) {
  const text = await res.text();
  const status = res.status;
  if (!res.ok) {
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text);
      if (j && typeof j.error === 'string') msg = j.error;
    } catch (_) {}
    // Include status so UI can show "404: API not reachable" etc.
    const statusPrefix = status ? `[${status}] ` : '';
    throw new Error(statusPrefix + (msg || 'Request failed'));
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(
      text.startsWith('<')
        ? '[API unreachable] Server returned a page instead of JSON. On Vercel, check that the api folder is deployed and try /api/health.'
        : `Invalid JSON from API: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`
    );
  }
}

export async function getConversations() {
  const r = await fetch(`${BASE}/conversations`);
  return parseJsonResponse(r);
}

export async function createConversation(doctorLanguage = 'en', patientLanguage = 'es') {
  const r = await fetch(`${BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctorLanguage, patientLanguage }),
  });
  return parseJsonResponse(r);
}

export async function getConversation(id) {
  const r = await fetch(`${BASE}/conversations/${id}`);
  return parseJsonResponse(r);
}

/** Like getConversation but aborts after ms. Use for initial load to avoid hanging forever. */
export async function getConversationWithTimeout(id, ms = 25000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(`${BASE}/conversations/${id}`, { signal: controller.signal });
    return parseJsonResponse(r);
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendMessage(conversationId, role, content, { fromLang, toLang } = {}) {
  const body = { role, content };
  if (fromLang) body.fromLang = fromLang;
  if (toLang) body.toLang = toLang;
  const r = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJsonResponse(r);
}

export async function uploadAudio(conversationId, role, blob, duration) {
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  form.append('role', role);
  form.append('duration', String(duration || 0));
  const r = await fetch(`${BASE}/conversations/${conversationId}/audio`, {
    method: 'POST',
    body: form,
  });
  return parseJsonResponse(r);
}

export async function searchConversations(q) {
  const r = await fetch(`${BASE}/conversations/search?q=${encodeURIComponent(q)}`);
  return parseJsonResponse(r);
}

export async function generateSummary(conversationId) {
  const r = await fetch(`${BASE}/ai/summarize/${conversationId}`, { method: 'POST' });
  return parseJsonResponse(r);
}

export async function translatePreview(text, fromLang, toLang) {
  const r = await fetch(`${BASE}/ai/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text || '', fromLang: fromLang || 'en', toLang: toLang || 'en' }),
  });
  const data = await parseJsonResponse(r);
  return data;
}

export async function detectLanguage(text) {
  const r = await fetch(`${BASE}/ai/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text || '' }),
  });
  const data = await parseJsonResponse(r);
  return data.lang || 'en';
}

export async function updateConversationName(conversationId, name) {
  const r = await fetch(`${BASE}/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return parseJsonResponse(r);
}
