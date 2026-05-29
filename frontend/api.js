/* global API_URL */
(function () {
  const PLACEHOLDER = 'PUT_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
  const PROD_API_URL = 'https://script.google.com/macros/s/AKfycbwcVB9c7hm80jT2gIgYN9U1pG0uLgp3hsJ6XSyQ3Bo43LgDNTVs0eIaktt9K6zBOz2q/exec';
  const configuredUrl = localStorage.getItem('fcs_api_url') || '';
  const baseUrl = configuredUrl || (typeof API_URL === 'string' ? API_URL : '') || PROD_API_URL;
  const useRemote = !!baseUrl && !baseUrl.includes(PLACEHOLDER);

  const DB_KEY = 'fcs_db_v1';
  function loadDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
    const db = {
      DAILY_SALES: [], EXPENSES: [], DEPOSITS: [], RECEIVABLES: [], CANCEL_REQUESTS: [], CASH_RECON: [], ATTACHMENTS: [], AUDIT_LOG: [],
      SETTINGS: { ALLOW_SELF_REGISTER: 'true', OWNER_EMAILS: '', EMPLOYEE_EMAILS: '', DRAWER_BALANCE: '0' }
    };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }
  function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function id(p) { return p + '-' + Math.random().toString(36).slice(2, 10).toUpperCase(); }
  function n(v) { const x = Number(v || 0); if (Number.isNaN(x)) throw new Error('Invalid number'); return x; }
  function dToday() { return new Date().toISOString().slice(0, 10); }
  function daysDiff(a, b) { return Math.floor((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000); }
  function audit(db, s, action, table, record, note, oldv, newv) {
    db.AUDIT_LOG.push({ log_id: id('LOG'), timestamp: new Date().toISOString(), user: s.user, role: s.role, action, table, record_id: record, old_value: oldv || '', new_value: newv || '', note: note || '' });
  }
  function roleGuard(s, allowed) { if (!allowed.includes(s.role)) throw new Error('Unauthorized role'); }
  function backdateGuard(s, entry_date) {
    if (s.role === 'owner') return;
    const diff = daysDiff(dToday(), entry_date);
    if (diff < 0) throw new Error('Future date is not allowed');
    if (diff > 3) throw new Error('Employee can backdate up to 3 days only');
  }
  function rowsByDateBranch(rows, date, branch) { return rows.filter(r => r.entry_date === date && r.branch === branch); }
  function sum(rows, key) { return rows.reduce((a, r) => a + n(r[key]), 0); }
  function reconStatus(diff) { if (diff === 0) return 'MATCHED'; if (diff < 0) return 'SHORT'; return 'OVER'; }
  function getDrawerBalance(db) { return n((db.SETTINGS || {}).DRAWER_BALANCE || 0); }
  function calcExpectedCash(db, entryDate, branch) {
    const sales = rowsByDateBranch(db.DAILY_SALES, entryDate, branch);
    const expenses = rowsByDateBranch(db.EXPENSES, entryDate, branch);
    const deposits = rowsByDateBranch(db.DEPOSITS, entryDate, branch);
    return sum(sales, 'cash_amount') - sum(expenses, 'amount') - sum(deposits, 'deposit_amount');
  }

  async function localPost(action, payload = {}) {
    const db = loadDB();
    const s = { role: String(payload.role || '').toLowerCase(), user: String(payload.user || payload.email || '').toLowerCase(), branch: payload.branch || 'MAIN' };

    if (action === 'login') {
      if (!s.user || !s.role) throw new Error('Missing email or role');
      if (!['employee', 'owner'].includes(s.role)) throw new Error('Invalid role');
      return { email: s.user, role: s.role, branch: payload.branch || 'MAIN' };
    }

    if (action === 'uploadAttachment') {
      roleGuard(s, ['employee', 'owner']);
      const base64 = String(payload.base64 || '');
      const approx = Math.floor(base64.length * 0.75);
      if (approx > 10 * 1024 * 1024) throw new Error('File too large, max 10MB');
      const ext = String(payload.file_name || '').split('.').pop().toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) throw new Error('Unsupported file type');
      const rec = { attachment_id: id('ATT'), created_at: new Date().toISOString(), created_by: s.user, role: s.role, table_name: payload.table_name, record_id: payload.record_id || '', file_name: payload.file_name, mime_type: payload.mime_type || '', size: approx, drive_file_id: id('FILE'), drive_url: 'local://' + payload.file_name };
      db.ATTACHMENTS.push(rec); audit(db, s, 'UPLOAD', 'ATTACHMENTS', rec.attachment_id, 'Upload attachment', '', JSON.stringify(rec)); saveDB(db);
      return { attachment_id: rec.attachment_id, drive_url: rec.drive_url, drive_file_id: rec.drive_file_id };
    }

    if (action === 'createDailySales') {
      roleGuard(s, ['employee', 'owner']); backdateGuard(s, payload.entry_date);
      const cash = n(payload.cash_amount), transfer = n(payload.transfer_amount), credit = n(payload.credit_amount), total = n(payload.total_sales);
      if (Math.abs(cash + transfer + credit - total) > 0.001) throw new Error('total_sales must equal cash+transfer+credit');
      const drawer_balance = n(payload.drawer_balance || getDrawerBalance(db));
      db.SETTINGS.DRAWER_BALANCE = String(drawer_balance);
      const rec = { record_id: id('SAL'), created_at: new Date().toISOString(), created_by: payload.submitted_by || s.user, role: s.role, ...payload, cash_amount: cash, transfer_amount: transfer, credit_amount: credit, total_sales: total, drawer_balance };
      db.DAILY_SALES.push(rec); audit(db, s, 'CREATE', 'DAILY_SALES', rec.record_id, 'Create daily sales', '', JSON.stringify(rec)); saveDB(db); return { record_id: rec.record_id };
    }

    if (action === 'createExpense') {
      roleGuard(s, ['employee', 'owner']); backdateGuard(s, payload.entry_date);
      const rec = { record_id: id('EXP'), created_at: new Date().toISOString(), created_by: payload.submitted_by || s.user, role: s.role, ...payload, amount: n(payload.amount), payment_source: String(payload.payment_source || '').toLowerCase() === 'ธนาคาร' ? 'bank' : 'cash' };
      db.EXPENSES.push(rec); audit(db, s, 'CREATE', 'EXPENSES', rec.record_id, 'Create expense', '', JSON.stringify(rec)); saveDB(db); return { record_id: rec.record_id };
    }

    if (action === 'createDeposit') {
      roleGuard(s, ['employee', 'owner']); backdateGuard(s, payload.entry_date);
      const cash_before_deposit = n(payload.cash_before_deposit), deposit_amount = n(payload.deposit_amount);
      const rec = { record_id: id('DEP'), created_at: new Date().toISOString(), created_by: payload.submitted_by || s.user, role: s.role, ...payload, cash_before_deposit, deposit_amount, coin_balance: cash_before_deposit - deposit_amount };
      db.DEPOSITS.push(rec); audit(db, s, 'CREATE', 'DEPOSITS', rec.record_id, 'Create deposit', '', JSON.stringify(rec)); saveDB(db); return { record_id: rec.record_id, coin_balance: rec.coin_balance };
    }

    if (action === 'createReceivable') {
      roleGuard(s, ['employee', 'owner']); backdateGuard(s, payload.entry_date);
      const credit_amount = n(payload.credit_amount), paid_amount = n(payload.paid_amount || 0), balance_amount = credit_amount - paid_amount;
      const payment_status = balance_amount <= 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'unpaid';
      const rec = { record_id: id('REC'), created_at: new Date().toISOString(), created_by: payload.submitted_by || s.user, role: s.role, ...payload, credit_amount, paid_amount, balance_amount, payment_status };
      db.RECEIVABLES.push(rec); audit(db, s, 'CREATE', 'RECEIVABLES', rec.record_id, 'Create receivable', '', JSON.stringify(rec)); saveDB(db); return { record_id: rec.record_id, balance_amount, payment_status };
    }

    if (action === 'createCancelRequest') {
      roleGuard(s, ['employee', 'owner']); backdateGuard(s, payload.entry_date);
      const rec = { record_id: id('CAN'), created_at: new Date().toISOString(), created_by: payload.submitted_by || s.user, role: s.role, ...payload, cancel_amount: n(payload.cancel_amount), approval_status: 'pending' };
      db.CANCEL_REQUESTS.push(rec); audit(db, s, 'CREATE', 'CANCEL_REQUESTS', rec.record_id, 'Create cancel request', '', JSON.stringify(rec)); saveDB(db); return { record_id: rec.record_id, approval_status: 'pending' };
    }

    if (action === 'createCashRecon') {
      roleGuard(s, ['employee', 'owner']); backdateGuard(s, payload.entry_date);
      const expected_cash = calcExpectedCash(db, payload.entry_date, payload.branch || s.branch || 'MAIN');
      const actual_cash = n(payload.actual_cash);
      const difference = actual_cash - expected_cash;
      const difference_reason = String(payload.difference_reason || '').trim();
      if (difference !== 0 && !difference_reason) throw new Error('difference_reason is required when difference != 0');
      const rec = { record_id: id('RECASH'), created_at: new Date().toISOString(), created_by: payload.submitted_by || s.user, role: s.role, entry_date: payload.entry_date, branch: payload.branch || s.branch || 'MAIN', expected_cash, actual_cash, difference, recon_status: reconStatus(difference), difference_reason, note: payload.note || '' };
      db.CASH_RECON.push(rec);
      audit(db, s, 'CREATE', 'CASH_RECON', rec.record_id, 'Create cash recon', '', JSON.stringify({ expected_cash: rec.expected_cash, actual_cash: rec.actual_cash, difference: rec.difference, recon_status: rec.recon_status, difference_reason: rec.difference_reason, submitted_by: s.user, timestamp: rec.created_at }));
      saveDB(db);
      return { record_id: rec.record_id, expected_cash: rec.expected_cash, difference: rec.difference, recon_status: rec.recon_status };
    }

    if (action === 'approveCancelRequest' || action === 'rejectCancelRequest') {
      roleGuard(s, ['owner']);
      const x = db.CANCEL_REQUESTS.find(r => r.record_id === payload.record_id);
      if (!x) throw new Error('Cancel request not found');
      if (x.approval_status !== 'pending') throw new Error('Cancel request already processed');
      const old = JSON.stringify(x);
      x.approval_status = action === 'approveCancelRequest' ? 'approved' : 'rejected';
      x.updated_by = s.user; x.updated_at = new Date().toISOString();
      audit(db, s, x.approval_status === 'approved' ? 'APPROVE' : 'REJECT', 'CANCEL_REQUESTS', x.record_id, 'Update cancel request', old, JSON.stringify(x)); saveDB(db);
      return { record_id: x.record_id, status: x.approval_status };
    }

    throw new Error('Unknown action');
  }

  async function localGet(action, params = {}) {
    const db = loadDB();
    const s = { role: String(params.role || '').toLowerCase(), user: String(params.user || '').toLowerCase(), branch: params.branch || 'MAIN' };

    if (action === 'getEmployeeDailyDashboard') {
      roleGuard(s, ['employee', 'owner']);
      const date = params.date || dToday(), branch = params.branch || 'MAIN';
      const sales = rowsByDateBranch(db.DAILY_SALES, date, branch);
      const expenses = rowsByDateBranch(db.EXPENSES, date, branch);
      const deposits = rowsByDateBranch(db.DEPOSITS, date, branch);
      const recons = rowsByDateBranch(db.CASH_RECON, date, branch);
      const cash = sum(sales, 'cash_amount'), transfer = sum(sales, 'transfer_amount'), credit = sum(sales, 'credit_amount');
      const expense = sum(expenses, 'amount'), deposit = sum(deposits, 'deposit_amount'), expected = cash - expense - deposit;
      const lastRecon = recons.length ? recons[recons.length - 1] : null;
      const actual = lastRecon ? n(lastRecon.actual_cash) : 0;
      const difference = lastRecon ? n(lastRecon.difference) : 0;
      const status = lastRecon ? String(lastRecon.recon_status || reconStatus(difference)) : reconStatus(difference);
      const reason = lastRecon ? String(lastRecon.difference_reason || '') : '';
      return { date, branch, totals: { total_sales: sum(sales, 'total_sales'), cash, transfer, credit, expense, deposit, drawer_balance: getDrawerBalance(db), expected_cash: expected, actual_cash: actual, difference, recon_status: status, difference_reason: reason }, entries: { sales, expenses, deposits, cash_recon: recons } };
    }

    if (action === 'getOwnerDashboard') {
      roleGuard(s, ['owner']);
      const date = params.date || dToday(), branch = params.branch || '';
      const filterBranch = rows => (branch ? rows.filter(r => r.branch === branch) : rows);
      const salesAll = filterBranch(db.DAILY_SALES), expAll = filterBranch(db.EXPENSES), depAll = filterBranch(db.DEPOSITS), recAll = filterBranch(db.RECEIVABLES), canAll = filterBranch(db.CANCEL_REQUESTS), reconAll = filterBranch(db.CASH_RECON);
      const todaySales = salesAll.filter(r => r.entry_date === date);
      const cash = sum(todaySales, 'cash_amount'), transfer = sum(todaySales, 'transfer_amount'), credit = sum(todaySales, 'credit_amount');
      const expenses = sum(expAll.filter(r => r.entry_date === date), 'amount');
      const deposits = sum(depAll.filter(r => r.entry_date === date), 'deposit_amount');
      const coins = sum(depAll.filter(r => r.entry_date === date), 'coin_balance');
      const expected = cash - expenses - deposits;
      const recon = reconAll.filter(r => r.entry_date === date);
      const actual = recon.length ? n(recon[recon.length - 1].actual_cash) : 0;
      const difference = recon.length ? n(recon[recon.length - 1].difference) : 0;
      const status = recon.length ? String(recon[recon.length - 1].recon_status || reconStatus(difference)) : reconStatus(difference);
      const reason = recon.length ? String(recon[recon.length - 1].difference_reason || '') : '';
      const latestReconVariances = reconAll.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).filter(r => n(r.difference) !== 0).slice(0, 10).map(r => ({ entry_date: r.entry_date, branch: r.branch, employee: r.created_by, expected_cash: n(r.expected_cash), actual_cash: n(r.actual_cash), difference: n(r.difference), recon_status: r.recon_status, difference_reason: r.difference_reason || '' }));
      return {
        date, branch: branch || 'ALL', sales_today: sum(todaySales, 'total_sales'), sales_week: sum(salesAll.filter(r => daysDiff(date, r.entry_date) >= 0 && daysDiff(date, r.entry_date) <= 6), 'total_sales'), sales_month: sum(salesAll.filter(r => String(r.entry_date || '').slice(0, 7) === String(date).slice(0, 7)), 'total_sales'),
        cash, transfer, credit, receivables: sum(recAll, 'balance_amount'), expenses, deposits, coins, drawer_balance: getDrawerBalance(db), expected_cash: expected, actual_cash: actual, difference, recon_status: status, difference_reason: reason,
        pending_cancel_requests: canAll.filter(r => r.approval_status === 'pending').length, approved_cancel_requests: canAll.filter(r => r.approval_status === 'approved').length,
        latest_recon_variances: latestReconVariances,
        money_flow: { total_sales: sum(todaySales, 'total_sales'), cash, cash_expenses: expenses, deposits, remaining_cash: expected, bank_transfer: transfer, receivables: credit, cancel_requests: canAll.filter(r => r.approval_status === 'pending').length, difference }
      };
    }

    if (action === 'getPendingCancelRequests') { roleGuard(s, ['owner']); return db.CANCEL_REQUESTS.filter(r => r.approval_status === 'pending'); }
    if (action === 'getAuditLogs') { roleGuard(s, ['owner']); const limit = Math.max(1, Math.min(500, Number(params.limit || 100))); return db.AUDIT_LOG.slice(-limit).reverse().map(r => [r.log_id, r.timestamp, r.user, r.role, r.action, r.table, r.record_id, r.old_value, r.new_value, r.note]); }

    throw new Error('Unknown action');
  }

  window.API = {
    mode: useRemote ? 'remote' : 'local',
    baseUrl,
    setRemoteUrl(url) {
      const v = String(url || '').trim();
      if (!v) localStorage.removeItem('fcs_api_url');
      else localStorage.setItem('fcs_api_url', v);
      location.reload();
    },
    async get(action, params = {}) {
      if (!useRemote) return localGet(action, params);
      const query = new URLSearchParams({ action, ...params }).toString();
      const res = await fetch(`${baseUrl}?${query}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'API Error');
      return json.data;
    },
    async post(action, payload = {}) {
      if (!useRemote) return localPost(action, payload);
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'API Error');
      return json.data;
    }
  };
})();
