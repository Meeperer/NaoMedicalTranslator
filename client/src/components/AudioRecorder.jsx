import { useState, useRef, useCallback } from 'react';

export default function AudioRecorder({ onRecordingReady, disabled }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          onRecordingReady(blob, duration);
        }
        setDuration(0);
      };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      alert(err?.message || 'Microphone access is required to record audio.');
    }
  }, [onRecordingReady, duration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  }, []);

  return (
    <div style={styles.wrapper}>
      {recording ? (
        <>
          <span style={styles.duration}>{duration}s</span>
          <button type="button" onClick={stopRecording} style={styles.stopBtn} aria-label="Stop recording">
            Stop
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          style={{ ...styles.recordBtn, opacity: disabled ? 0.6 : 1 }}
          aria-label="Start recording"
        >
          Record
        </button>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: 'flex', alignItems: 'center', gap: 12 },
  recordBtn: {
    padding: '8px 16px',
    background: 'var(--danger)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 500,
    boxShadow: 'var(--shadow-sm)',
  },
  stopBtn: {
    padding: '8px 16px',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontWeight: 500,
  },
  duration: { color: 'var(--text-muted)', fontSize: '0.9rem' },
};
