function AppHeader({ tabs, activeTab, setActiveTab, onLogout, mobileMenuOpen, setMobileMenuOpen }) {
  function onSelectTab(tab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }

  return (
    <header className="card topbar header">
      <div className="header-row">
        <button className="hamburger" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Toggle menu">
          ☰
        </button>
        <h1 className="header-title">Mini IPL Turf Manager</h1>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>

      <nav className={`tabs ${mobileMenuOpen ? "mobile-open" : ""}`}>
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => onSelectTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>
    </header>
  );
}

export default AppHeader;
