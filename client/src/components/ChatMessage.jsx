import { getBackendOrigin } from '../api';

/**
 * Top: translated text (e.g. Bonjour).
 * Bottom: original/untranslated text (e.g. Hello).
 */
export default function ChatMessage({ message }) {
  const backendOrigin = getBackendOrigin();
  const audioSrc = message.type === 'audio' && message.audioUrl
    ? (backendOrigin && message.audioUrl.startsWith('/') ? backendOrigin + message.audioUrl : message.audioUrl)
    : '';
  const isDoctor = message.role === 'doctor';
  const translatedText = message.translatedContent || '';
  const originalText = message.content || '';

  const styles = {
    wrapper: {
      display: 'flex',
      justifyContent: isDoctor ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    },
    bubble: {
      maxWidth: '85%',
      padding: '12px 16px',
      borderRadius: 12,
      background: isDoctor ? 'var(--doctor-bg)' : 'var(--patient-bg)',
      border: `1px solid ${isDoctor ? 'var(--doctor)' : 'var(--patient)'}`,
      boxShadow: 'var(--shadow-sm)',
    },
    role: {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: isDoctor ? 'var(--doctor)' : 'var(--patient)',
      marginBottom: 8,
      textTransform: 'capitalize',
    },
    label: {
      fontSize: '0.65rem',
      fontWeight: 600,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 4,
    },
    content: {
      fontSize: '0.95rem',
      lineHeight: 1.4,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      marginBottom: 10,
      color: 'var(--text)',
    },
    originalBlock: {
      marginTop: 8,
      paddingTop: 8,
      borderTop: '1px solid var(--border)',
    },
    original: {
      fontSize: '0.875rem',
      lineHeight: 1.4,
      color: 'var(--text-muted)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
    time: {
      fontSize: '0.7rem',
      color: 'var(--text-muted)',
      marginTop: 10,
      paddingTop: 6,
      borderTop: '1px solid var(--border)',
    },
    audio: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    audioPlayer: { maxWidth: 240, height: 36 },
  };

  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString(undefined, { timeStyle: 'short' })
    : '';

  return (
    <div style={styles.wrapper}>
      <div className="chat-message-bubble" style={styles.bubble}>
        <div style={styles.role}>{message.role}</div>
        {message.type === 'audio' ? (
          <div style={styles.audio}>
            <audio controls style={styles.audioPlayer} src={audioSrc || message.audioUrl} />
            {message.audioDuration ? (
              <span style={styles.time}>{Math.round(message.audioDuration)}s</span>
            ) : null}
          </div>
        ) : (
          <>
            <div style={styles.label}>Translated:</div>
            <div style={styles.content}>{translatedText || '—'}</div>
            <div style={styles.originalBlock}>
              <div style={styles.label}>Original:</div>
              <div style={styles.original}>{originalText || '—'}</div>
            </div>
          </>
        )}
        {timeStr ? <div style={styles.time}>{timeStr}</div> : null}
      </div>
    </div>
  );
}
