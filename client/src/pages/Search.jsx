import { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchConversations } from '../api';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await searchConversations(q);
      setResults(data.results || []);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function highlight(text, term) {
    if (!text || !term) return text;
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(re).map((part, i) =>
      re.test(term) && part.toLowerCase() === term.toLowerCase()
        ? `<mark style="background: var(--accent); color: white; padding: 0 2px;">${part}</mark>`
        : part
    );
  }

  // Simple highlight: wrap matching substring in <mark>
  function highlightExcerpt(excerpt, term) {
    if (!excerpt || !term) return excerpt;
    const lower = excerpt.toLowerCase();
    const t = term.toLowerCase();
    const idx = lower.indexOf(t);
    if (idx === -1) return excerpt;
    const before = excerpt.slice(0, idx);
    const match = excerpt.slice(idx, idx + term.length);
    const after = excerpt.slice(idx + term.length);
    return (
      <>
        {before}
        <mark style={markStyle}>{match}</mark>
        {after}
      </>
    );
  }

  const markStyle = { background: 'var(--accent)', color: 'white', padding: '0 2px', borderRadius: 2 };

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>Search conversations</h1>
      <p style={styles.muted}>Search by keyword or phrase across all messages. Matches show highlighted excerpt and link to the conversation.</p>
      <form className="search-form" onSubmit={handleSearch} style={styles.form}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter keyword or phrase…"
          style={styles.input}
          autoFocus
        />
        <button type="submit" disabled={loading} style={styles.btn}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {results && (
        <div style={styles.results}>
          {results.length === 0 ? (
            <p style={styles.muted}>No matches found.</p>
          ) : (
            <ul style={styles.list}>
              {results.map((r) => (
                <li key={r.conversationId} style={styles.item}>
                  <Link to={`/chat/${r.conversationId}`} style={styles.link}>
                    Open conversation
                  </Link>
                  <span style={styles.date}>
                    {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {r.matches?.map((m, i) => (
                    <div key={i} style={styles.match}>
                      <span style={styles.role}>{m.role}</span>
                      <span className="search-result-excerpt" style={styles.excerpt}>{highlightExcerpt(m.excerpt, query)}</span>
                      <span style={styles.time}>
                        {m.timestamp ? new Date(m.timestamp).toLocaleTimeString(undefined, { timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 640 },
  h1: { margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700 },
  muted: { color: 'var(--text-muted)', margin: '0 0 20px', fontSize: '0.9rem' },
  form: { display: 'flex', gap: 12, marginBottom: 24 },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '1rem',
  },
  btn: {
    padding: '12px 24px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)',
  },
  results: { background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  item: {
    padding: '16px 0',
    borderBottom: '1px solid var(--border)',
  },
  link: { color: 'var(--accent)', fontWeight: 500, textDecoration: 'none', marginRight: 12 },
  date: { color: 'var(--text-muted)', fontSize: '0.85rem' },
  match: { marginTop: 10, padding: 10, background: 'var(--bg)', borderRadius: 8 },
  role: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: 8 },
  excerpt: { fontSize: '0.9rem' },
  time: { fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 },
};
