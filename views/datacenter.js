const DataCenterView = (() => {
  function render(container) {
    const lastUpload = localStorage.getItem('ltpLastUploadAt') || 'Never';
    container.innerHTML = `<div class="view-enter"><div class="view-header"><div><div class="view-title">Data Center</div><div class="view-subtitle">CSV ingest, backup/restore, status, and storage controls</div></div></div>
      <div class="grid-2">
        ${TerminalUI.card('CSV LTP Upload', `<label class="pms-btn pms-btn-primary" style="cursor:pointer;">Upload CSV<input type="file" id="dc-csv" accept=".csv,.txt" style="display:none"></label><div id="dc-status" style="margin-top:10px;font-size:12px;color:var(--text-muted);">Last upload: ${lastUpload}</div>`) }
        ${TerminalUI.card('Backup & Restore', `<button class="pms-btn pms-btn-ghost" id="dc-backup">Download Backup</button><label class="pms-btn pms-btn-ghost" style="cursor:pointer;">Restore<input type="file" id="dc-restore" accept=".json" style="display:none"></label><div style="margin-top:8px;font-size:12px;color:var(--text-muted);">Status: ${dataStatus()}</div>`) }
      </div>
    </div>`;
    bind(container);
  }

  function bind(container) {
    container.querySelector('#dc-csv').onchange = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const raw = await file.text();
      const parsed = PmsUI.parseLtpCsv(raw);
      if (!parsed.parsed) { PmsUI.toast('Invalid CSV', 'error'); return; }
      askDailyPL(() => {
        const updated = PmsUI.applyLtpUpdates(parsed.updates);
        localStorage.setItem('ltpLastUploadAt', new Date().toISOString());
        container.querySelector('#dc-status').textContent = `Last upload: ${new Date().toLocaleString()} | Parsed ${parsed.parsed} | Updated ${updated}`;
      });
      e.target.value = '';
    };

    container.querySelector('#dc-backup').onclick = () => {
      const snap = PmsState.createSnapshot();
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `NEPSE_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
      PmsUI.toast('Backup downloaded', 'success');
    };

    container.querySelector('#dc-restore').onchange = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      try { PmsState.restoreSnapshot(JSON.parse(await file.text())); PmsUI.toast('Restore complete', 'success'); }
      catch { PmsUI.toast('Invalid restore file', 'error'); }
      e.target.value = '';
    };
  }

  function askDailyPL(onDone) {
    const { card, close } = PmsUI.modal({
      title: 'Include upload in Daily P/L?',
      subtitle: 'Do you want to include this in daily P/L?',
      actions: '<button class="pms-btn pms-btn-ghost" data-no="1">No</button><button class="pms-btn pms-btn-primary" data-yes="1">Yes</button>'
    });
    card.querySelector('[data-no]').onclick = () => { onDone(); close(); };
    card.querySelector('[data-yes]').onclick = () => { onDone(); PmsUI.capturePortfolioSnapshot('csv_upload'); close(); PmsUI.toast('Snapshot stored in daily P/L history', 'success'); };
  }

  function dataStatus() {
    const t = PmsState.readTrades().length; const l = PmsState.readLongterm().length; const e = PmsState.readExited().length;
    return `Trades ${t} | Long ${l} | Exited ${e}`;
  }

  return { render };
})();
