/**
 * PMS State Manager
 * Single source of truth for the entire SPA.
 * All view rendering is driven from this state object.
 */
const PmsState = (() => {
  let _currentView = 'dashboard';
  const _listeners = new Set();

  function getView()       { return _currentView; }
  function setView(view)   {
    if (_currentView === view) return;
    _currentView = view;
    _listeners.forEach((fn) => fn({ type: 'navigation', view }));
  }

  function subscribe(fn)   { _listeners.add(fn); return () => _listeners.delete(fn); }

  // Unified data readers – all views use these
  function readTrades()    { return safeJson('trades', []); }
  function readLongterm()  { return safeJson('longterm', []); }
  function readExited()    { return safeJson('exitedTradesV2', []); }
  function readSip()       {
    const s = safeJson('sipStateV4', null);
    if (!s || !Array.isArray(s.sips)) return { sips: [], records: {}, currentNav: {}, registeredAt: {} };
    return { sips: s.sips, records: s.records || {}, currentNav: s.currentNav || {}, registeredAt: s.registeredAt || {} };
  }

  function persistTrades(rows)   { localStorage.setItem('trades',          JSON.stringify(rows)); }
  function persistLongterm(rows) { localStorage.setItem('longterm',        JSON.stringify(rows)); }
  function persistExited(rows)   { localStorage.setItem('exitedTradesV2',  JSON.stringify(rows)); }
  function persistSip(state)     { localStorage.setItem('sipStateV4',      JSON.stringify(state)); }

  function safeJson(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
  }

  // Portfolio snapshot for backup
  function createSnapshot() {
    return {
      version:        '2.0',
      exportedAt:     new Date().toISOString(),
      trades:         readTrades(),
      longterm:       readLongterm(),
      exitedTradesV2: readExited(),
      sipStateV4:     readSip(),
      cashBalanceV1:  localStorage.getItem('cashBalanceV1') || '0',
      cashLedgerV1:   safeJson('cashLedgerV1', []),
    };
  }

  function restoreSnapshot(payload) {
    const keys = ['trades','longterm','exitedTradesV2','sipStateV4','cashBalanceV1','cashLedgerV1'];
    keys.forEach((k) => {
      if (payload[k] !== undefined) {
        localStorage.setItem(k, typeof payload[k] === 'string' ? payload[k] : JSON.stringify(payload[k]));
      }
    });
    window.dispatchEvent(new CustomEvent('pms-data-restored'));
  }

  return {
    getView, setView, subscribe,
    readTrades, readLongterm, readExited, readSip,
    persistTrades, persistLongterm, persistExited, persistSip,
    createSnapshot, restoreSnapshot,
  };
})();
