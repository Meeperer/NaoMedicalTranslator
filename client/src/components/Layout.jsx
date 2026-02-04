import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import LoadingScreen, { LOADING_FILL_DURATION_MS } from './LoadingScreen';

const iconSize = 18;

const IconConversations = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconSearch = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

export default function Layout({ children }) {
  const navigate = useNavigate();
  const [isNavigatingHome, setIsNavigatingHome] = useState(false);

  function handleLogoClick(e) {
    e.preventDefault();
    setIsNavigatingHome(true);
    setTimeout(() => {
      navigate('/');
      setIsNavigatingHome(false);
    }, LOADING_FILL_DURATION_MS);
  }

  return (
    <div style={styles.wrapper}>
      {isNavigatingHome && <LoadingScreen />}
      <header style={styles.header}>
        <Link to="/" style={styles.logo} aria-label="NaoMedical home" onClick={handleLogoClick}>
          <img
            src="/images/Nao-Medical-Logo.svg"
            alt="NaoMedical"
            style={styles.logoImg}
          />
        </Link>
        <nav className="layout-nav" style={styles.nav}>
          <NavLink
            to="/conversations"
            style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
            aria-label="Conversations"
          >
            <span className="layout-nav-icon"><IconConversations /></span>
            <span className="layout-nav-text">Conversations</span>
          </NavLink>
          <NavLink
            to="/search"
            style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
            aria-label="Search"
          >
            <span className="layout-nav-icon"><IconSearch /></span>
            <span className="layout-nav-text">Search</span>
          </NavLink>
        </nav>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    padding: '14px 24px',
    background: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
  },
  logoImg: {
    height: 28,
    width: 'auto',
    display: 'block',
  },
  nav: { display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 },
  navLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  navLinkActive: { color: 'var(--accent)', fontWeight: 600 },
  main: { flex: 1, padding: 24, maxWidth: 900, margin: '0 auto', width: '100%', background: 'var(--bg)' },
};
