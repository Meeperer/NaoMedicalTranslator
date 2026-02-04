import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen, { LOADING_FILL_DURATION_MS } from '../components/LoadingScreen';

const ROLE_STORAGE_KEY = 'naomedical_role';

function setStoredRole(role) {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  } catch (_) {}
}

export default function Landing() {
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);

  function chooseRole(role) {
    setStoredRole(role);
    setIsRedirecting(true);
    setTimeout(() => navigate('/conversations'), LOADING_FILL_DURATION_MS);
  }

  if (isRedirecting) return <LoadingScreen />;

  return (
    <div className="landing-wrapper" style={styles.wrapper}>
      <div className="landing-card" style={styles.card}>
        <img
          src="/images/Nao-Medical-Logo.svg"
          alt="NaoMedical"
          style={styles.logo}
        />
        <p style={styles.tagline}>Doctor–patient translation</p>
        <p style={styles.prompt}>Choose your role to continue</p>
        <div style={styles.buttons}>
          <button
            type="button"
            onClick={() => chooseRole('doctor')}
            style={styles.doctorBtn}
          >
            I&apos;m the Doctor
          </button>
          <button
            type="button"
            onClick={() => chooseRole('patient')}
            style={styles.patientBtn}
          >
            I&apos;m the Patient
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 120px)',
    padding: 24,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    padding: 48,
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
  },
  logo: {
    height: 56,
    width: 'auto',
    marginBottom: 12,
  },
  tagline: {
    margin: '0 0 24px',
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  prompt: {
    margin: '0 0 24px',
    fontSize: '1rem',
    color: 'var(--text)',
    fontWeight: 600,
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  doctorBtn: {
    padding: '16px 24px',
    background: 'var(--doctor)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  patientBtn: {
    padding: '16px 24px',
    background: 'var(--patient)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
};
