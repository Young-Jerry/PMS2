/**
 * Settings View
 * Data management: backup, restore, reset. LTP bulk update.
 * Portfolio preferences and system info.
 */
const SettingsView = (() => {
  function render(container) {
    container.innerHTML = `
      <div class="view-enter">
        <div class="view-header">
          <div>
            <div class="view-title">Settings</div>
            <div class="view-subtitle">Data management, LTP updates &amp; preferences</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Backup & Restore -->
          <div class="pms-card">
            <div class="pms-card-header"><span class="pms-card-title">Backup &amp; Restore</span></div>
            <div class="pms-card-body" style="display:flex;flex-direction:column;gap:12px;">
              <p style="font-size:12px;color:var(--text-secondary);">
                Export your entire portfolio to a JSON file and restore it anytime.
                Your data is stored only in your browser's local storage.
              </p>
              <button class="pms-btn pms-btn-primary" id="settings-download">⬇ Download Backup</button>
              <label class="pms-btn pms-btn-ghost" style="cursor:pointer;text-align:center;">
                ⬆ Restore from File
                <input type="file" id="settings-restore-input" accept=".json" style="display:none;">
              </label>
              <div id="settings-backup-status" style="font-size:11px;color:var(--text-muted);min-height:16px;"></div>
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="pms-card" style="border-color:rgba(239,68,68,0.3);">
            <div class="pms-card-header" style="border-color:rgba(239,68,68,0.2);">
              <span class="pms-card-title" style="color:var(--loss);">⚠ Danger Zone</span>
            </div>
            <div class="pms-card-body" style="display:flex;flex-direction:column;gap:10px;">
              <p style="font-size:12px;color:var(--text-secondary);">Destructive actions. These cannot be undone. Backup first.</p>
              <button class="pms-btn pms-btn-danger" id="settings-clear-trades">Clear Active Trades</button>
              <button class="pms-btn pms-btn-danger" id="settings-clear-longterm">Clear Long-Term Holdings</button>
              <button class="pms-btn pms-btn-danger" id="settings-clear-exited">Clear Trade History</button>
              <button class="pms-btn pms-btn-danger" id="settings-reset-all" style="border-width:2px;">💥 Reset All Data</button>
            </div>
          </div>
        </div>

        <!-- Small LTP Update -->
        <div class="pms-card section-gap">
          <div class="pms-card-header">
            <span class="pms-card-title">Small Update LTP</span>
            <span style="font-size:11px;color:var(--text-muted);">Upload CSV: SCRIPT,LTP</span>
          </div>
          <div class="pms-card-body">
            <div style="display:flex;flex-direction:column;gap:12px;">
              <label class="pms-btn pms-btn-ghost" style="width:max-content;cursor:pointer;">
                ⬆ Upload LTP CSV
                <input type="file" id="ltp-file-input" accept=".csv,.txt" style="display:none;">
              </label>
              <div id="ltp-status" style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);min-height:16px;"></div>
            </div>
          </div>
        </div>

        <!-- System Info -->
        <div class="pms-card section-gap">
          <div class="pms-card-header"><span class="pms-card-title">System Information</span></div>
          <div class="pms-card-body" id="settings-sysinfo"></div>
        </div>
      </div>
    `;

    bindEvents(container);
    renderSysInfo(container);
  }

  function bindEvents(container) {
    // Backup
    container.querySelector('#settings-download').onclick = () => {
      const snap = PmsState.createSnapshot();
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `NEPSE_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      container.querySelector('#settings-backup-status').textContent = '✓ Backup downloaded';
      PmsUI.toast('Backup saved ✓', 'success');
    };

    container.querySelector('#settings-restore-input').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        PmsState.restoreSnapshot(data);
        PmsUI.toast('Portfolio restored ✓', 'success');
        container.querySelector('#settings-backup-status').textContent = '✓ Restored from ' + file.name;
        renderSysInfo(container);
        window.dispatchEvent(new CustomEvent('pms-data-restored'));
      } catch {
        PmsUI.toast('Invalid backup file', 'error');
      }
      e.target.value = '';
    };

    // Danger zone
    const dangers = [
      { id: '#settings-clear-trades',   key: 'trades',          label: 'active trades' },
      { id: '#settings-clear-longterm', key: 'longterm',        label: 'long-term holdings' },
      { id: '#settings-clear-exited',   key: 'exitedTradesV2',  label: 'trade history' },
    ];
    dangers.forEach(({ id, key, label }) => {
      container.querySelector(id).onclick = () => {
        PmsUI.confirm({
          title: `Clear ${label}?`,
          message: `All ${label} data will be permanently deleted. This cannot be undone.`,
          confirmText: `Clear ${label}`,
          danger: true,
          onConfirm: () => {
            localStorage.removeItem(key);
            PmsUI.toast(`${label} cleared`, 'info');
            window.dispatchEvent(new CustomEvent('pms-data-restored'));
            renderSysInfo(container);
          },
        });
      };
    });

    container.querySelector('#settings-reset-all').onclick = () => {
      PmsUI.confirm({
        title: '⚠ Reset ALL Data',
        message: 'This will permanently delete EVERYTHING — trades, holdings, cash, history. This cannot be undone.',
        confirmText: '💥 Delete Everything',
        danger: true,
        onConfirm: () => {
          const keys = ['trades','longterm','exitedTradesV2','sipStateV4','cashBalanceV1','cashLedgerV1'];
          keys.forEach(k => localStorage.removeItem(k));
          PmsUI.toast('All data cleared', 'info');
          window.dispatchEvent(new CustomEvent('pms-data-restored'));
          renderSysInfo(container);
        },
      });
    };

    // LTP CSV Update
    container.querySelector('#ltp-file-input').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await applyLTPBulk(container, file);
      e.target.value = '';
    };
  }

  async function applyLTPBulk(container, file) {
    const raw = await file.text();
    const { updates, parsed, errors } = PmsUI.parseLtpCsv(raw);
    if (!parsed) {
      container.querySelector('#ltp-status').textContent = '✕ No valid entries found.';
      PmsUI.toast('Invalid CSV format', 'error');
      return;
    }
    const updated = PmsUI.applyLtpUpdates(updates);
    container.querySelector('#ltp-status').textContent =
      `✓ File: ${file.name} | Parsed ${parsed} | Updated ${updated}${errors ? ` | ${errors} errors` : ''}`;
    PmsUI.toast(`LTP updated: ${updated} positions`, 'success');
  }

  function renderSysInfo(container) {
    const trades   = safeJson('trades',   []).length;
    const longterm = safeJson('longterm', []).length;
    const exited   = safeJson('exitedTradesV2', []).length;
    const cash     = PmsCapital.readCash();
    const used     = new Blob([JSON.stringify(localStorage)]).size;

    container.querySelector('#settings-sysinfo').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;font-size:12px;">
        ${[
          ['Active Trade Positions', trades],
          ['Long-Term Positions',    longterm],
          ['Exited Trades',          exited],
          ['Cash Balance',           PmsUI.currencyRound(cash)],
          ['Storage Used',           `~${(used/1024).toFixed(1)} KB`],
          ['Browser Storage',        'localStorage (in-browser)'],
          ['App Version',            '2.0 Terminal'],
          ['NEPSE Commission',       'Tiered (0.24–0.36%)'],
          ['SEBON Rate',             '0.015%'],
          ['Short-Term CGT',         '7.5%'],
          ['Long-Term CGT',          '5% (>365 days)'],
          ['DP Charge',              'Rs 25 per trade'],
        ].map(([l,v]) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);">
            <div style="color:var(--text-muted);margin-bottom:2px;">${l}</div>
            <div style="font-family:var(--font-mono);color:var(--text-primary);font-weight:600;">${v}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function safeJson(key, fb) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fb; } catch { return fb; }
  }

  return { render };
})();
