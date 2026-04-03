/**
 * NEPSE Terminal — SPA Router & App Bootstrap
 * Wires sidebar navigation, state transitions, and view rendering.
 * Single source of truth: PmsState.getView()
 */
(() => {
  const VIEWS = {
    dashboard:  { label: 'Dashboard',         icon: '⬡', render: (c) => DashboardView.render(c)  },
    portfolio:  { label: 'Portfolio',          icon: '◧', render: (c) => PortfolioView.render(c)  },
    trades:     { label: 'Trade History',      icon: '↕', render: (c) => TradesView.render(c)     },
    analytics:  { label: 'Analytics',          icon: '◈', render: (c) => AnalyticsView.render(c)  },
    risk:       { label: 'Risk Analysis',      icon: '◬', render: (c) => RiskView.render(c)       },
    cashflow:   { label: 'Cashflow',           icon: '⬡', render: (c) => CashflowView.render(c)   },
    settings:   { label: 'Settings',           icon: '◌', render: (c) => SettingsView.render(c)   },
  };

  const NAV_SECTIONS = [
    { label: 'Overview',  items: ['dashboard', 'portfolio'] },
    { label: 'Analysis',  items: ['trades', 'analytics', 'risk'] },
    { label: 'Finance',   items: ['cashflow'] },
    { label: 'System',    items: ['settings'] },
  ];

  let currentViewId = null;

  function boot() {
    buildSidebar();
    buildTopbar();

    // Subscribe to state changes
    PmsState.subscribe(({ view }) => {
      navigateTo(view);
    });

    // External data changes -> refresh current view if needed
    window.addEventListener('pms-cash-updated',      () => refreshCurrentView());
    window.addEventListener('pms-portfolio-updated', () => refreshCurrentView());
    window.addEventListener('pms-data-restored',     () => refreshCurrentView());
    window.addEventListener('storage',               () => refreshCurrentView());

    // Initial navigation
    const initial = location.hash.replace('#','') || 'dashboard';
    navigateTo(VIEWS[initial] ? initial : 'dashboard');
  }

  function buildSidebar() {
    const sidebar = document.getElementById('pms-sidebar');
    sidebar.innerHTML = `
      <div class="sidebar-brand">
        <div class="sidebar-brand-name">NEPSE Terminal</div>
        <div class="sidebar-brand-sub">Portfolio Management System</div>
      </div>
      <div class="sidebar-market" id="sidebar-market">
        <span class="market-dot dot-red"></span>
        <span id="sidebar-market-text">NEPSE --:--:--</span>
      </div>
      <nav class="sidebar-nav" id="sidebar-nav"></nav>
      <div class="sidebar-cash">
        <div class="sidebar-cash-label">Cash Balance</div>
        <div class="sidebar-cash-value" data-cash-display>Rs 0</div>
      </div>
    `;

    const nav = sidebar.querySelector('#sidebar-nav');
    NAV_SECTIONS.forEach(section => {
      const sectionEl = document.createElement('div');
      sectionEl.innerHTML = `<div class="nav-section-label">${section.label}</div>`;
      section.items.forEach(id => {
        const view = VIEWS[id];
        const item = document.createElement('div');
        item.className = 'nav-item';
        item.dataset.view = id;
        item.innerHTML = `<span class="nav-item-icon">${view.icon}</span><span>${view.label}</span>`;
        item.onclick = () => PmsState.setView(id);
        sectionEl.appendChild(item);
      });
      nav.appendChild(sectionEl);
    });

    PmsUI.startMarketTimer('sidebar-market-text');
  }

  function buildTopbar() {
    const topbar = document.getElementById('pms-topbar');
    topbar.innerHTML = `
      <span class="topbar-title" id="topbar-view-title">Dashboard</span>
      <div class="topbar-right">
        <div class="topbar-cash-pill" onclick="PmsState.setView('cashflow')" title="Go to Cashflow">
          Cash: <strong data-cash-display>Rs 0</strong>
        </div>
        <div id="topbar-market" style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">
          <span class="market-dot dot-red"></span>
          <span id="topbar-market-text">NEPSE --:--:--</span>
        </div>
      </div>
    `;
    PmsUI.startMarketTimer('topbar-market-text');
  }

  function navigateTo(viewId) {
    if (!VIEWS[viewId]) return;
    currentViewId = viewId;
    location.hash = viewId;

    // Update topbar title
    const titleEl = document.getElementById('topbar-view-title');
    if (titleEl) titleEl.textContent = VIEWS[viewId].label;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewId);
    });

    // Render the view
    const container = document.getElementById('pms-view');
    container.innerHTML = '';
    VIEWS[viewId].render(container);

    // Update cash widgets
    PmsCapital.updateWidgets();
  }

  function refreshCurrentView() {
    if (!currentViewId) return;
    PmsCapital.updateWidgets();
    // If dashboard is active, also refresh its charts
    if (currentViewId === 'dashboard') {
      const container = document.getElementById('pms-view');
      if (container && DashboardView.refresh) DashboardView.refresh(container);
    }
  }

  // Boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
