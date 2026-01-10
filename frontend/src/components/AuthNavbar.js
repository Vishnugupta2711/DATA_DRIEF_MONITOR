import "./AuthNavbar.css";

export default function AuthNavbar() {
  return (
    <div className="auth-navbar">
      <div className="auth-navbar-left">
        <div className="logo-icon-small">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="brand-text">Drift Monitor Pro</span>
      </div>

      <div className="auth-navbar-right">
        <a
          href="https://github.com/vishnugupta2711/data-drift-monitor"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <a href="#features">Features</a>
        <a href="#about">About</a>
      </div>
    </div>
  );
}
