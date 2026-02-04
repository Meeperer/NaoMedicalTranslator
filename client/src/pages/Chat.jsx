import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getConversation, getConversationWithTimeout, sendMessage, uploadAudio, generateSummary, translatePreview, updateConversationName } from '../api';
import ChatMessage from '../components/ChatMessage';
import AudioRecorder from '../components/AudioRecorder';

// Only call translate API after user stops typing for this long (ms)
const TRANSLATE_DEBOUNCE_MS = 500;

const ROLE_STORAGE_KEY = 'naomedical_role';

function getStoredRole() {
  const r = typeof localStorage !== 'undefined' ? localStorage.getItem(ROLE_STORAGE_KEY) : null;
  return r === 'doctor' || r === 'patient' ? r : null;
}

function setStoredRole(role) {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  } catch (_) {}
}

const LANGUAGES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  zh: 'Chinese', ar: 'Arabic', hi: 'Hindi', pt: 'Portuguese', tl: 'Tagalog',
};

const LANGUAGES_LIST = [
  { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' }, { code: 'zh', label: 'Chinese' }, { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' }, { code: 'pt', label: 'Portuguese' }, { code: 'tl', label: 'Tagalog' },
];

export default function Chat() {
  const { id } = useParams();
  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [role, setRole] = useState(() => getStoredRole() || 'doctor');
  const [showRolePicker, setShowRolePicker] = useState(() => !getStoredRole());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryHidden, setSummaryHidden] = useState(true);
  const [translatedPreview, setTranslatedPreview] = useState('');
  const [translatedPreviewLoading, setTranslatedPreviewLoading] = useState(false);
  const [myLanguage, setMyLanguage] = useState('en');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const menuRef = useRef(null);
  const nameInputRef = useRef(null);
  const syncedLangForConvRef = useRef({ id: null, role: null });

  // Sync "Your language" to what was selected on Home for this conversation (doctor/patient language)
  useEffect(() => {
    if (!conv?._id) return;
    if (syncedLangForConvRef.current.id === conv._id && syncedLangForConvRef.current.role === role) return;
    syncedLangForConvRef.current = { id: conv._id, role };
    const langForRole = role === 'doctor' ? conv.doctorLanguage : conv.patientLanguage;
    setMyLanguage(langForRole || 'en');
  }, [conv, role]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpen]);

  function getFromLang() {
    return myLanguage || 'en';
  }
  function getToLang() {
    return role === 'doctor' ? conv?.patientLanguage : conv?.doctorLanguage;
  }

  useEffect(() => {
    setLoadError(null);
    let cancelled = false;
    (async () => {
      try {
        const data = await getConversationWithTimeout(id, 25000);
        if (!cancelled) {
          setConv(data);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const msg =
            e?.name === 'AbortError'
              ? 'Request timed out. The server may be slow or unreachable.'
              : (e?.message ?? 'Failed to load conversation.');
          setLoadError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, retryKey]);

  // Poll for conversation updates (new messages, audio, summary from other party)
  useEffect(() => {
    if (!id || !conv) return;
    const interval = setInterval(async () => {
      try {
        const data = await getConversation(id);
        setConv((prev) => {
          if (!prev || prev.messages?.length !== data.messages?.length) return data;
          const prevLast = prev.messages[prev.messages.length - 1];
          const nextLast = data.messages[data.messages.length - 1];
          if (prevLast?._id !== nextLast?._id || prevLast?.translatedContent !== nextLast?.translatedContent) return data;
          return prev;
        });
      } catch (e) {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, conv?.messages?.length]);

  useEffect(() => {
    if (conv?.summary) {
      setSummary(conv.summary);
      setSummaryHidden(true);
    }
  }, [conv?.summary]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv?.messages?.length]);

  // Translate only after user stops typing (debounce: no API call until delay has passed with no new input)
  useEffect(() => {
    const text = input.trim();
    if (!text || !conv) {
      setTranslatedPreview('');
      setTranslatedPreviewLoading(false);
      return;
    }
    const fromLang = getFromLang();
    const toLang = getToLang();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setTranslatedPreviewLoading(true);
      try {
        const { translated } = await translatePreview(text, fromLang, toLang);
        if (!cancelled) setTranslatedPreview(translated ?? '');
      } catch (e) {
        if (!cancelled) setTranslatedPreview('');
      } finally {
        if (!cancelled) setTranslatedPreviewLoading(false);
      }
    }, TRANSLATE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, role, myLanguage, conv?.doctorLanguage, conv?.patientLanguage, conv?._id]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !conv) return;
    setSending(true);
    setInput('');
    try {
      const fromLang = getFromLang();
      const toLang = getToLang();
      const added = await sendMessage(id, role, text, { fromLang, toLang });
      setConv((c) => (c ? { ...c, messages: [...c.messages, added], updatedAt: new Date() } : c));
    } catch (e) {
      setInput(text);
      alert(e?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function handleAudioReady(blob, duration) {
    if (sending) return;
    setSending(true);
    try {
      const added = await uploadAudio(id, role, blob, duration);
      setConv((c) => (c ? { ...c, messages: [...c.messages, added], updatedAt: new Date() } : c));
    } catch (e) {
      console.error(e);
      alert('Failed to upload audio');
    } finally {
      setSending(false);
    }
  }

  async function handleGenerateSummary() {
    setSummaryLoading(true);
    try {
      const { summary: s, name: generatedName } = await generateSummary(id);
      setSummary(s);
      setSummaryHidden(false);
      setConv((c) => (c ? { ...c, summary: s, name: generatedName || c.name } : c));
    } catch (e) {
      alert(e?.message || 'Failed to generate summary');
    } finally {
      setSummaryLoading(false);
    }
  }

  function startEditingName() {
    setNameInput(conv?.name || '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  async function saveName() {
    if (nameSaving) return;
    const newName = nameInput.trim();
    setNameSaving(true);
    try {
      await updateConversationName(id, newName);
      setConv((c) => (c ? { ...c, name: newName } : c));
      setEditingName(false);
    } catch (e) {
      alert(e?.message || 'Failed to save name');
    } finally {
      setNameSaving(false);
    }
  }

  function cancelEditingName() {
    setEditingName(false);
    setNameInput(conv?.name || '');
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    } else if (e.key === 'Escape') {
      cancelEditingName();
    }
  }

  if (loading && !conv) {
    if (loadError) {
      const is404OrUnreachable =
        /\[404\]|\[API unreachable\]|NOT_FOUND|page could not be found/i.test(loadError);
      return (
        <div style={styles.center}>
          <p style={styles.loadErrorText}>{loadError}</p>
          {is404OrUnreachable && (
            <p style={styles.loadErrorHint}>
              Check if the API is deployed: open <strong>/api/health</strong> in a new tab. If that also fails, the api routes are not running on this deployment.
            </p>
          )}
          <button type="button" onClick={() => { setRetryKey((k) => k + 1); setLoading(true); }} style={styles.retryBtn}>
            Retry
          </button>
        </div>
      );
    }
    return (
      <div style={styles.center}>
        <p style={styles.muted}>Loading conversation…</p>
        <p style={styles.loadingHint}>First load may take a few seconds.</p>
      </div>
    );
  }

  if (!conv) {
    const is404OrUnreachable =
      loadError && /\[404\]|\[API unreachable\]|NOT_FOUND|page could not be found/i.test(loadError);
    return (
      <div style={styles.center}>
        <p style={styles.loadErrorText}>{loadError || 'Conversation not found.'}</p>
        {is404OrUnreachable && (
          <p style={styles.loadErrorHint}>
            Check if the API is deployed: open <strong>/api/health</strong> in a new tab.
          </p>
        )}
        <button type="button" onClick={() => { setRetryKey((k) => k + 1); setLoading(true); }} style={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  function chooseRole(r) {
    setRole(r);
    setStoredRole(r);
    setShowRolePicker(false);
  }

  function handleMenuGenerateSummary() {
    setMenuOpen(false);
    handleGenerateSummary();
  }

  const myLangLabel = LANGUAGES[myLanguage] || myLanguage;
  const doctorLabel = role === 'doctor' ? myLangLabel : (LANGUAGES[conv.doctorLanguage] || conv.doctorLanguage);
  const patientLabel = role === 'patient' ? myLangLabel : (LANGUAGES[conv.patientLanguage] || conv.patientLanguage);

  return (
    <div className="chat-container" style={styles.container}>
      {showRolePicker && (
        <div style={styles.rolePickerBanner}>
          <span style={styles.rolePickerLabel}>Choose your role:</span>
          <button type="button" onClick={() => chooseRole('doctor')} style={styles.rolePickerBtn}>
            Doctor
          </button>
          <button type="button" onClick={() => chooseRole('patient')} style={styles.rolePickerBtn}>
            Patient
          </button>
        </div>
      )}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          {editingName ? (
            <div style={styles.nameEditRow}>
              <input
                ref={nameInputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={() => { if (!nameSaving) cancelEditingName(); }}
                placeholder="Conversation name…"
                style={styles.nameInput}
                disabled={nameSaving}
              />
              <button type="button" onClick={saveName} disabled={nameSaving} style={styles.nameSaveBtn}>
                {nameSaving ? '…' : '✓'}
              </button>
              <button type="button" onClick={cancelEditingName} disabled={nameSaving} style={styles.nameCancelBtn}>
                ✕
              </button>
            </div>
          ) : (
            <div style={styles.nameRow}>
              {conv?.name ? (
                <h2 style={styles.conversationName} onClick={startEditingName} title="Click to edit name">
                  {conv.name}
                </h2>
              ) : (
                <button type="button" onClick={startEditingName} style={styles.addNameBtn}>
                  + Add name
                </button>
              )}
            </div>
          )}
          <p className="chat-header-info" style={styles.muted}>
            Doctor: {doctorLabel} · Patient: {patientLabel}
          </p>
        </div>
        <div style={styles.headerActions} ref={menuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            style={styles.menuTrigger}
            aria-label="More options"
            aria-expanded={menuOpen}
          >
            ⋯
          </button>
          {menuOpen && (
            <div style={styles.menuDropdown}>
              <button
                type="button"
                onClick={handleMenuGenerateSummary}
                disabled={summaryLoading}
                style={styles.menuItem}
              >
                {summaryLoading ? 'Generating…' : 'Generate summary'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={listRef} style={styles.messages}>
        <img
          src="/images/naomedicallogo.svg"
          alt=""
          aria-hidden
          style={styles.messagesLogo}
        />
        <div style={styles.messagesContent}>
          {conv.messages.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>No messages yet</p>
              <p style={styles.emptyText}>Type below or record audio. Messages are translated into the other role&apos;s language in real time.</p>
            </div>
          ) : (
            conv.messages.map((m) => (
              <ChatMessage key={m._id || m.timestamp} message={m} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <section style={styles.summarySection} aria-label="Summary">
        <div style={styles.languageRow}>
          <label style={styles.languageLabel}>
            Your language
            <select
              value={myLanguage}
              onChange={(e) => setMyLanguage(e.target.value)}
              style={styles.languageSelect}
            >
              {LANGUAGES_LIST.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
          {summary && (
            <button
              type="button"
              onClick={() => setSummaryHidden((h) => !h)}
              style={styles.summaryDropdownBtn}
              aria-label={summaryHidden ? 'Show summary' : 'Hide summary'}
              aria-expanded={!summaryHidden}
              title={summaryHidden ? 'Show summary' : 'Hide summary'}
            >
              <span style={styles.summaryDropdownLabel}>Summary</span>
              <span style={{ ...styles.summaryDropdownIcon, transform: summaryHidden ? 'rotate(0deg)' : 'rotate(180deg)' }} aria-hidden>▼</span>
            </button>
          )}
        </div>
        {(input.trim() || translatedPreview || translatedPreviewLoading) && (
          <div style={styles.previewBox}>
            <span style={styles.previewLabel}>
              {translatedPreviewLoading ? 'Translating…' : 'Preview (translated):'}
            </span>
            <span style={styles.previewText}>
              {translatedPreviewLoading && !translatedPreview ? '…' : translatedPreview}
            </span>
          </div>
        )}
        {summary && (
          <div
            style={{
              ...styles.summaryBoxWrap,
              maxHeight: summaryHidden ? 0 : 800,
              opacity: summaryHidden ? 0 : 1,
              marginTop: summaryHidden ? 0 : 12,
            }}
            aria-hidden={summaryHidden}
          >
            <div style={styles.summaryBox}>
              <pre style={styles.summaryText}>{summary}</pre>
            </div>
          </div>
        )}
      </section>

      <div className="chat-input-row" style={styles.inputRow}>
        <input
          type="text"
          dir="ltr"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !translatedPreviewLoading && handleSend()}
          placeholder="Type a message…"
          style={{ ...styles.input, direction: 'ltr' }}
          disabled={sending}
        />
        <div className="chat-send-wrap" style={styles.sendWrap}>
          <AudioRecorder onRecordingReady={handleAudioReady} disabled={sending} />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim() || translatedPreviewLoading}
            style={{
              ...styles.sendBtn,
              ...((sending || !input.trim() || translatedPreviewLoading) ? styles.sendBtnDisabled : {}),
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100dvh - 100px)',
    minHeight: 400,
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
  },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8 },
  loadingHint: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 },
  loadErrorText: { margin: 0, fontSize: '0.9rem', color: 'var(--text)', textAlign: 'center', maxWidth: 360 },
  loadErrorHint: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360 },
  retryBtn: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rolePickerBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: 'var(--surface-hover)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  rolePickerLabel: { fontSize: '0.9rem', color: 'var(--text)', fontWeight: 500 },
  rolePickerBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  conversationName: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  addNameBtn: {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px dashed var(--border)',
    borderRadius: 6,
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  nameEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--accent)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  nameSaveBtn: {
    padding: '6px 10px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
  nameCancelBtn: {
    padding: '6px 10px',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  muted: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' },
  headerActions: { position: 'relative', flexShrink: 0 },
  menuTrigger: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-muted)',
    fontSize: '1.25rem',
    lineHeight: 1,
    cursor: 'pointer',
    fontWeight: 600,
  },
  menuDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    minWidth: 180,
    padding: 4,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    zIndex: 10,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  messages: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: 16,
    position: 'relative',
  },
  messagesLogo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 160,
    height: 'auto',
    opacity: 0.08,
    pointerEvents: 'none',
    zIndex: 0,
  },
  messagesContent: {
    position: 'relative',
    zIndex: 1,
  },
  summarySection: { padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0 },
  languageRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  languageLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem', color: 'var(--text)' },
  languageSelect: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    minWidth: 160,
    fontSize: '0.9rem',
  },
  previewBox: {
    marginBottom: 10,
    padding: '8px 12px',
    background: 'var(--bg)',
    borderRadius: 8,
    border: '1px solid var(--border)',
  },
  previewLabel: { fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: 8 },
  previewText: { fontSize: '0.9rem', color: 'var(--text)' },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: 'var(--text-muted)',
  },
  emptyTitle: { margin: '0 0 8px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' },
  emptyText: { margin: 0, fontSize: '0.9rem' },
  summaryDropdownBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  summaryDropdownLabel: {},
  summaryDropdownIcon: {
    fontSize: '0.65rem',
    lineHeight: 1,
    display: 'inline-block',
    transition: 'transform 0.25s ease',
  },
  summaryBoxWrap: {
    overflow: 'hidden',
    transition: 'max-height 0.35s ease, opacity 0.3s ease, margin-top 0.3s ease',
  },
  summaryBox: {
    padding: 12,
    background: 'var(--bg)',
    borderRadius: 8,
    border: '1px solid var(--border)',
  },
  summaryText: {
    margin: 0,
    fontSize: '0.85rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'var(--font)',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    alignItems: 'center',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  sendWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '16px', // Prevents iOS zoom
  },
  sendBtn: {
    padding: '12px 16px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    boxShadow: 'var(--shadow-sm)',
  },
  sendBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    background: 'var(--border)',
    color: 'var(--text-muted)',
  },
};
