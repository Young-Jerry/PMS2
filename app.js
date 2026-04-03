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
    calculator: { label: 'Trade Calculator',   icon: '⌗', render: (c) => CalculatorView.render(c) },
    settings:   { label: 'Settings',           icon: '◌', render: (c) => SettingsView.render(c)   },
  };

  const NAV_SECTIONS = [
    { label: 'Overview',  items: ['dashboard', 'portfolio'] },
    { label: 'Analysis',  items: ['trades', 'analytics', 'risk'] },
    { label: 'Finance',   items: ['cashflow', 'calculator'] },
    { label: 'System',    items: ['settings'] },
  ];

  let currentViewId = null;

  function boot() {
    buildSidebar();
    buildTopbar();
    ensureSidebarOverlay();

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

    // Handle manual hash navigation (e.g., user returns from other pages/files)
    window.addEventListener('hashchange', () => {
      const target = location.hash.replace('#', '');
      if (!target || !VIEWS[target]) return;
      if (target === currentViewId) return;
      PmsState.setView(target);
    });
  }

  function ensureSidebarOverlay() {
    if (document.getElementById('pms-sidebar-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pms-sidebar-overlay';
    overlay.className = 'pms-sidebar-overlay';
    overlay.addEventListener('click', () => {
      document.getElementById('pms-app')?.classList.remove('sidebar-open');
    });
    document.body.appendChild(overlay);
  }

  function buildSidebar() {
    const sidebar = document.getElementById('pms-sidebar');
    sidebar.innerHTML = `
      <button class="sidebar-close-btn" id="sidebar-close-btn" type="button" aria-label="Close menu">✕</button>
      <div class="sidebar-brand">
        <div class="sidebar-brand-name">NEPSE Terminal</div>
        <div class="sidebar-brand-sub">Portfolio Management System</div>
      </div>
      <nav class="sidebar-nav" id="sidebar-nav"></nav>
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

    sidebar.querySelector('#sidebar-close-btn')?.addEventListener('click', () => {
      document.getElementById('pms-app')?.classList.remove('sidebar-open');
    });

  }

  function buildTopbar() {
    const topbar = document.getElementById('pms-topbar');
    topbar.innerHTML = `
      <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" type="button" aria-label="Toggle menu">☰</button>
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
    topbar.querySelector('#sidebar-toggle-btn')?.addEventListener('click', toggleSidebar);
  }

  function toggleSidebar() {
    const app = document.getElementById('pms-app');
    app?.classList.toggle('sidebar-open');
  }

  function navigateTo(viewId) {
    if (!VIEWS[viewId]) return;
    currentViewId = viewId;
    location.hash = viewId;
    document.getElementById('pms-app')?.classList.remove('sidebar-open');

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
