(() => {
  const VIEWS = {
    dashboard:  { label: 'Dashboard',   icon: '⬢', render: (c) => DashboardView.render(c) },
    portfolio:  { label: 'Portfolio',   icon: '◫', render: (c) => PortfolioView.render(c) },
    trades:     { label: 'Trades',      icon: '↕', render: (c) => TradesView.render(c) },
    analytics:  { label: 'Analytics',   icon: '◈', render: (c) => AnalyticsView.render(c) },
    cashflow:   { label: 'Cashflow',    icon: '◌', render: (c) => CashflowView.render(c) },
    performance:{ label: 'Performance', icon: '◭', render: (c) => PerformanceView.render(c) },
    comparison: { label: 'Comparison',  icon: '◪', render: (c) => ComparisonView.render(c) },
    dailypl:    { label: 'Daily P/L',   icon: '◉', render: (c) => DailyPLView.render(c) },
    datacenter: { label: 'Data Center', icon: '⌁', render: (c) => DataCenterView.render(c) },
    settings:   { label: 'Settings',    icon: '⚙', render: (c) => SettingsView.render(c) },
  };

  const ORDER = ['dashboard','portfolio','trades','analytics','cashflow','performance','comparison','dailypl','datacenter','settings'];
  let currentViewId = null;

  function boot() {
    buildSidebar(); buildTopbar(); ensureSidebarOverlay();
    PmsState.subscribe(({ view }) => navigateTo(view));
    ['pms-cash-updated','pms-portfolio-updated','pms-data-restored','storage'].forEach(evt => window.addEventListener(evt, () => refreshCurrentView()));
    const initial = location.hash.replace('#','') || 'dashboard';
    navigateTo(VIEWS[initial] ? initial : 'dashboard');
    window.addEventListener('hashchange', () => {
      const target = location.hash.replace('#', '');
      if (target && target !== currentViewId && VIEWS[target]) PmsState.setView(target);
    });
  }

  function ensureSidebarOverlay() {
    if (document.getElementById('pms-sidebar-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pms-sidebar-overlay';
    overlay.className = 'pms-sidebar-overlay';
    overlay.addEventListener('click', () => document.getElementById('pms-app')?.classList.remove('sidebar-open'));
    document.body.appendChild(overlay);
  }

  function buildSidebar() {
    const sidebar = document.getElementById('pms-sidebar');
    sidebar.innerHTML = `<button class="sidebar-close-btn" id="sidebar-close-btn" type="button">✕</button><div class="sidebar-brand"><div class="sidebar-brand-name">NEPSE Terminal</div><div class="sidebar-brand-sub">Visual Trading Workspace</div></div><nav class="sidebar-nav" id="sidebar-nav"></nav>`;
    const nav = sidebar.querySelector('#sidebar-nav');
    ORDER.forEach(id => {
      const item = document.createElement('button');
      item.className = 'nav-item';
      item.dataset.view = id;
      item.innerHTML = `<span class="nav-item-icon">${VIEWS[id].icon}</span><span>${VIEWS[id].label}</span>`;
      item.onclick = () => PmsState.setView(id);
      nav.appendChild(item);
    });
    sidebar.querySelector('#sidebar-close-btn')?.addEventListener('click', toggleSidebar);
  }

  function buildTopbar() {
    const topbar = document.getElementById('pms-topbar');
    topbar.innerHTML = `<button class="sidebar-toggle-btn" id="sidebar-toggle-btn" type="button">☰</button><span class="topbar-title" id="topbar-view-title">Dashboard</span><div class="topbar-right"><div class="topbar-cash-pill" onclick="PmsState.setView('cashflow')">Cash: <strong data-cash-display>Rs 0</strong></div><div id="topbar-market"><span id="topbar-market-text">NEPSE --:--:--</span></div></div>`;
    PmsUI.startMarketTimer('topbar-market-text');
    topbar.querySelector('#sidebar-toggle-btn').onclick = toggleSidebar;
  }

  function toggleSidebar() {
    const app = document.getElementById('pms-app');
    if (!app) return;
    const isMobile = window.matchMedia('(max-width: 960px)').matches;
    app.classList.toggle(isMobile ? 'sidebar-open' : 'sidebar-collapsed');
  }

  function navigateTo(viewId) {
    if (!VIEWS[viewId]) return;
    currentViewId = viewId;
    location.hash = viewId;
    document.getElementById('pms-app')?.classList.remove('sidebar-open');
    const titleEl = document.getElementById('topbar-view-title');
    if (titleEl) titleEl.textContent = VIEWS[viewId].label;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === viewId));
    const container = document.getElementById('pms-view');
    container.innerHTML = '';
    VIEWS[viewId].render(container);
    PmsCapital.updateWidgets();
  }

  function refreshCurrentView() {
    if (!currentViewId) return;
    navigateTo(currentViewId);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
