/** Time (ms) until the loading bar reaches 100% – matches CSS animation (60% of 1.6s) */
export const LOADING_FILL_DURATION_MS = 960;

export default function LoadingScreen() {
  return (
    <div className="loading-screen" style={styles.overlay}>
      <div style={styles.content}>
        <img
          src="/images/Nao-Medical-Logo.svg"
          alt="NaoMedical"
          style={styles.logo}
        />
        <div className="loading-screen-bar" style={styles.barTrack}>
          <div className="loading-screen-bar-fill" style={styles.barFill} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  logo: {
    height: 56,
    width: 'auto',
    display: 'block',
  },
  barTrack: {
    width: 240,
    height: 6,
    borderRadius: 3,
    background: 'var(--surface-hover)',
    overflow: 'hidden',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 0,
  },
};
