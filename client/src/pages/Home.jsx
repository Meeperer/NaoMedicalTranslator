import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getConversations, createConversation } from '../api';
import LoadingScreen, { LOADING_FILL_DURATION_MS } from '../components/LoadingScreen';

const ROLE_STORAGE_KEY = 'naomedical_role';

function getStoredRole() {
  if (typeof localStorage === 'undefined') return null;
  const r = localStorage.getItem(ROLE_STORAGE_KEY);
  return r === 'doctor' || r === 'patient' ? r : null;
}

// Map browser locale to our language codes (en, es, fr, de, zh, ar, hi, pt)
const BROWSER_TO_CODE = {
  en: 'en', es: 'es', fr: 'fr', de: 'de', zh: 'zh', ar: 'ar', hi: 'hi', pt: 'pt',
  'en-US': 'en', 'en-GB': 'en', 'es-ES': 'es', 'es-MX': 'es', 'pt-BR': 'pt', 'zh-CN': 'zh', 'zh-TW': 'zh',
};

function getDetectedLanguage() {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || navigator.languages?.[0] || 'en';
  const base = lang.split('-')[0].toLowerCase();
  return BROWSER_TO_CODE[lang] ?? BROWSER_TO_CODE[base] ?? 'en';
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'tl', label: 'Tagalog' },
];

function getDefaultLanguages(role) {
  const detected = getDetectedLanguage();
  const other = detected === 'en' ? 'es' : 'en';
  if (role === 'doctor') return { doctorLang: detected, patientLang: other };
  return { doctorLang: other, patientLang: detected };
}

const CONVERSATIONS_PER_PAGE = 5;

function getPageNumbers(currentPage, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const middle = [];
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(total - 1, currentPage + 1); i++) {
    middle.push(i);
  }
  const result = [1];
  if (middle.length && middle[0] > 2) result.push('…');
  result.push(...middle);
  if (middle.length && middle[middle.length - 1] < total - 1) result.push('…');
  if (total > 1) result.push(total);
  return result;
}

export default function Home() {
  const role = getStoredRole();
  const defaults = getDefaultLanguages(role || 'doctor');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [doctorLang, setDoctorLang] = useState(defaults.doctorLang);
  const [patientLang, setPatientLang] = useState(defaults.patientLang);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil(list.length / CONVERSATIONS_PER_PAGE));
  const start = (page - 1) * CONVERSATIONS_PER_PAGE;
  const paginatedList = list.slice(start, start + CONVERSATIONS_PER_PAGE);

  // Redirect to landing if no role chosen
  useEffect(() => {
    if (!role) navigate('/', { replace: true });
  }, [role, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getConversations();
        if (!cancelled) setList(data);
      } catch (e) {
        if (!cancelled) console.error(e?.message ?? 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reset to page 1 if current page is out of range (e.g. after list shrinks)
  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1);
  }, [list.length, totalPages, page]);

  async function handleNewConversation() {
    setCreating(true);
    try {
      const [conv] = await Promise.all([
        createConversation(doctorLang, patientLang),
        new Promise((r) => setTimeout(r, LOADING_FILL_DURATION_MS)),
      ]);
      navigate(`/chat/${conv._id}`);
    } catch (e) {
      alert(e?.message || 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  }

  function formatDate(d) {
    return new Date(d).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  if (!role) return null; // redirecting to landing

  return (
    <>
      {creating && <LoadingScreen />}
      <div style={styles.container}>
      <h1 style={styles.pageTitle}>Conversations</h1>
      <p style={styles.pageSubtitle}>
        You’re participating as <strong>{role === 'doctor' ? 'Doctor' : 'Patient'}</strong>. Your language is auto-detected; you can change it below.
      </p>

      <section style={styles.card}>
        <h2 style={styles.h2}>New conversation</h2>
        <p style={styles.muted}>Languages are set from your browser by default. Messages are translated in real time.</p>
        <div className="home-row" style={styles.row}>
          <label className="home-label" style={styles.label}>
            Doctor language
            <select value={doctorLang} onChange={(e) => setDoctorLang(e.target.value)} style={styles.select}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
          <label className="home-label" style={styles.label}>
            Patient language
            <select value={patientLang} onChange={(e) => setPatientLang(e.target.value)} style={styles.select}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
        </div>
        <button onClick={handleNewConversation} disabled={creating} style={styles.primaryBtn}>
          {creating ? 'Creating…' : 'Start conversation'}
        </button>
      </section>

      <section className="recent-conversations-card" style={{ ...styles.card, ...styles.recentConversationsCard }}>
        <h2 style={styles.h2}>Recent conversations</h2>
        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : list.length === 0 ? (
          <p style={styles.muted}>No conversations yet. Start one above.</p>
        ) : (
          <>
            <div key={page} className="conversations-list-wrap" style={styles.listWrap}>
              <ul style={styles.list}>
                {paginatedList.map((c) => {
                  const langInfo = `${LANGUAGES.find((l) => l.code === c.doctorLanguage)?.label || c.doctorLanguage} → ${LANGUAGES.find((l) => l.code === c.patientLanguage)?.label || c.patientLanguage}`;
                  return (
                    <li key={c._id} style={styles.listItem}>
                      <Link to={`/chat/${c._id}`} className="conversation-link" style={styles.link}>
                        <div style={styles.linkContent}>
                          <span className="conversation-link-title" style={styles.linkTitle}>
                            {c.name || 'Untitled conversation'}
                          </span>
                          <span style={styles.linkLangInfo}>{langInfo}</span>
                        </div>
                        <span style={styles.linkDate}>{formatDate(c.updatedAt)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            {list.length > CONVERSATIONS_PER_PAGE && (
              <div style={styles.pagination}>
                <span style={styles.paginationInfo}>
                  {start + 1}–{Math.min(start + CONVERSATIONS_PER_PAGE, list.length)} of {list.length}
                </span>
                <div style={styles.paginationButtons}>
                  <div style={styles.pageNumbers}>
                    {getPageNumbers(page, totalPages).map((n, idx) =>
                      n === '…' ? (
                        <span key={`ellipsis-${idx}`} style={styles.pageEllipsis}>…</span>
                      ) : (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPage(n)}
                          style={{
                            ...styles.pageNumBtn,
                            ...(page === n ? styles.pageNumBtnActive : {}),
                          }}
                          aria-label={`Page ${n}`}
                          aria-current={page === n ? 'page' : undefined}
                        >
                          {n}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      </div>
    </>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 24 },
  pageTitle: { margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700 },
  pageSubtitle: { margin: '0 0 20px', fontSize: '0.95rem', color: 'var(--text-muted)' },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: 24,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
  },
  recentConversationsCard: {
    minHeight: 436,
    display: 'flex',
    flexDirection: 'column',
  },
  h2: { margin: '0 0 8px', fontSize: '1.125rem', fontWeight: 600 },
  muted: { color: 'var(--text-muted)', margin: '0 0 16px', fontSize: '0.9rem' },
  row: { display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.875rem' },
  select: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    minWidth: 160,
  },
  primaryBtn: {
    padding: '12px 24px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)',
  },
  listWrap: { minHeight: 1, flex: 1 },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  listItem: { borderBottom: '1px solid var(--border)' },
  link: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 0',
    color: 'var(--text)',
    textDecoration: 'none',
    gap: 16,
  },
  linkContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  linkTitle: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  linkLangInfo: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  linkDate: { color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 },
  pagination: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
    alignItems: 'center',
  },
  paginationInfo: { fontSize: '0.875rem', color: 'var(--text-muted)' },
  paginationButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pageBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontWeight: 500,
    cursor: 'pointer',
  },
  pageBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    background: 'var(--text-muted)',
  },
  pageNumbers: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  pageNumBtn: {
    width: 36,
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  pageNumBtnActive: {
    background: 'var(--accent)',
    color: 'white',
    borderColor: 'var(--accent)',
    fontWeight: 600,
  },
  pageEllipsis: { padding: '0 4px', color: 'var(--text-muted)', fontSize: '0.875rem' },
};
