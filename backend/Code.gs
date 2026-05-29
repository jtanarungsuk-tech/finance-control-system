/**
 * Finance Control System - Google Apps Script Backend
 * Production-ready baseline with strict validation and audit logging.
 */

const SYSTEM = {
  SPREADSHEET_NAME: 'Finance_Control_System_DB',
  ROOT_FOLDER_ID: '1HO5qx7M4aDd9wTfKJheji6RIOF3_SlIZ',
  SHEETS: [
    'DAILY_SALES',
    'EXPENSES',
    'DEPOSITS',
    'RECEIVABLES',
    'CANCEL_REQUESTS',
    'CASH_RECON',
    'ATTACHMENTS',
    'SETTINGS',
    'OWNER_ADJUSTMENTS',
    'AUDIT_LOG'
  ],
  DRIVE_FOLDERS: [
    'SalesProof',
    'ExpenseReceipt',
    'DepositSlip',
    'CancelRequest',
    'CustomerPayment',
    'SystemBackup'
  ],
  ROLES: {
    EMPLOYEE: 'employee',
    OWNER: 'owner'
  },
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['jpg', 'jpeg', 'png', 'pdf']
};

function doGet(e) {
  return handleRequest_('GET', e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    return handleRequest_('POST', body);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'Invalid JSON body' }, 400);
  }
}

function handleRequest_(method, data) {
  try {
    const action = String(data.action || '').trim();
    const publicActions = ['login'];
    const user = publicActions.includes(action) ? null : getUserContext_(data);

    if (!action) return jsonResponse_({ ok: false, error: 'Missing action' }, 400);
    if (method === 'POST' && action === 'login') {
      return jsonResponse_({ ok: true, data: login_(data) });
    }

    // GET actions
    if (method === 'GET' && action === 'getEmployeeDailyDashboard') {
      requireRole_(user, [SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER]);
      return jsonResponse_({ ok: true, data: getEmployeeDailyDashboard_(user, data) });
    }
    if (method === 'GET' && action === 'getOwnerDashboard') {
      requireRole_(user, [SYSTEM.ROLES.OWNER]);
      return jsonResponse_({ ok: true, data: getOwnerDashboard_(user, data) });
    }
    if (method === 'GET' && action === 'getPendingCancelRequests') {
      requireRole_(user, [SYSTEM.ROLES.OWNER]);
      return jsonResponse_({ ok: true, data: getPendingCancelRequests_() });
    }
    if (method === 'GET' && action === 'getAuditLogs') {
      requireRole_(user, [SYSTEM.ROLES.OWNER]);
      return jsonResponse_({ ok: true, data: getAuditLogs_(data) });
    }

    // POST actions
    if (method === 'POST' && action === 'createDailySales') return jsonResponse_({ ok: true, data: createDailySales_(user, data) });
    if (method === 'POST' && action === 'createExpense') return jsonResponse_({ ok: true, data: createExpense_(user, data) });
    if (method === 'POST' && action === 'createDeposit') return jsonResponse_({ ok: true, data: createDeposit_(user, data) });
    if (method === 'POST' && action === 'createReceivable') return jsonResponse_({ ok: true, data: createReceivable_(user, data) });
    if (method === 'POST' && action === 'createCancelRequest') return jsonResponse_({ ok: true, data: createCancelRequest_(user, data) });
    if (method === 'POST' && action === 'createCashRecon') return jsonResponse_({ ok: true, data: createCashRecon_(user, data) });
    if (method === 'POST' && action === 'approveCancelRequest') return jsonResponse_({ ok: true, data: approveCancelRequest_(user, data) });
    if (method === 'POST' && action === 'rejectCancelRequest') return jsonResponse_({ ok: true, data: rejectCancelRequest_(user, data) });
    if (method === 'POST' && action === 'uploadAttachment') return jsonResponse_({ ok: true, data: uploadAttachment_(user, data) });

    return jsonResponse_({ ok: false, error: 'Unknown action' }, 404);
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message || 'Server error' }, 400);
  }
}

function setupSystem() {
  const ss = SpreadsheetApp.create(SYSTEM.SPREADSHEET_NAME);

  const defaultSheet = ss.getSheets()[0];
  defaultSheet.setName(SYSTEM.SHEETS[0]);

  for (let i = 1; i < SYSTEM.SHEETS.length; i++) {
    ss.insertSheet(SYSTEM.SHEETS[i]);
  }

  initHeaders_(ss);

  const root = DriveApp.getFolderById(SYSTEM.ROOT_FOLDER_ID);
  const systemFolder = root.createFolder('FinanceSystem');
  const folderMap = {};

  SYSTEM.DRIVE_FOLDERS.forEach((name) => {
    const f = systemFolder.createFolder(name);
    folderMap[name] = f.getId();
  });

  const settingsSheet = ss.getSheetByName('SETTINGS');
  const settings = [
    ['key', 'value'],
    ['SPREADSHEET_ID', ss.getId()],
    ['SYSTEM_FOLDER_ID', systemFolder.getId()],
    ['SALES_PROOF_FOLDER_ID', folderMap.SalesProof],
    ['EXPENSE_RECEIPT_FOLDER_ID', folderMap.ExpenseReceipt],
    ['DEPOSIT_SLIP_FOLDER_ID', folderMap.DepositSlip],
    ['CANCEL_REQUEST_FOLDER_ID', folderMap.CancelRequest],
    ['CUSTOMER_PAYMENT_FOLDER_ID', folderMap.CustomerPayment],
    ['SYSTEM_BACKUP_FOLDER_ID', folderMap.SystemBackup],
    ['ALLOW_SELF_REGISTER', 'true'],
    ['OWNER_EMAILS', 'owner@example.com,owner@local'],
    ['EMPLOYEE_EMAILS', 'employee@example.com,employee@local']
  ];
  settingsSheet.clearContents();
  settingsSheet.getRange(1, 1, settings.length, 2).setValues(settings);
  PropertiesService.getScriptProperties().setProperty('DB_SPREADSHEET_ID', ss.getId());

  return {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    rootFolderId: SYSTEM.ROOT_FOLDER_ID,
    systemFolderId: systemFolder.getId(),
    folders: folderMap
  };
}

function initHeaders_(ss) {
  const headers = {
    DAILY_SALES: ['record_id', 'created_at', 'created_by', 'role', 'entry_date', 'branch', 'cash_amount', 'transfer_amount', 'credit_amount', 'total_sales', 'drawer_balance', 'sales_proof', 'note'],
    EXPENSES: ['record_id', 'created_at', 'created_by', 'role', 'entry_date', 'branch', 'expense_name', 'category', 'amount', 'payment_source', 'receipt', 'note'],
    DEPOSITS: ['record_id', 'created_at', 'created_by', 'role', 'entry_date', 'branch', 'cash_before_deposit', 'deposit_amount', 'coin_balance', 'bank_account', 'deposit_slip', 'note'],
    RECEIVABLES: ['record_id', 'created_at', 'created_by', 'role', 'entry_date', 'branch', 'customer_name', 'credit_amount', 'paid_amount', 'balance_amount', 'due_date', 'payment_status', 'payment_proof', 'note'],
    CANCEL_REQUESTS: ['record_id', 'created_at', 'created_by', 'role', 'entry_date', 'branch', 'cancel_amount', 'reason', 'detail', 'proof', 'approval_status', 'approved_by', 'approved_at', 'rejected_by', 'rejected_at'],
    CASH_RECON: ['record_id', 'created_at', 'created_by', 'role', 'entry_date', 'branch', 'expected_cash', 'actual_cash', 'difference', 'recon_status', 'difference_reason', 'note'],
    ATTACHMENTS: ['attachment_id', 'created_at', 'created_by', 'role', 'table_name', 'record_id', 'file_name', 'mime_type', 'size', 'drive_file_id', 'drive_url'],
    SETTINGS: ['key', 'value'],
    OWNER_ADJUSTMENTS: ['record_id', 'created_at', 'created_by', 'role', 'table_name', 'target_record_id', 'old_value', 'new_value', 'reason'],
    AUDIT_LOG: ['log_id', 'timestamp', 'user', 'role', 'action', 'table', 'record_id', 'old_value', 'new_value', 'note']
  };

  Object.keys(headers).forEach((name) => {
    const sh = ss.getSheetByName(name);
    sh.clearContents();
    sh.getRange(1, 1, 1, headers[name].length).setValues([headers[name]]);
  });
}

function createDailySales_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER]);
  validateBackdate_(user, payload.entry_date);

  const createdBy = String(payload.submitted_by || user.email).trim();
  const cash = toNumber_(payload.cash_amount);
  const transfer = toNumber_(payload.transfer_amount);
  const credit = toNumber_(payload.credit_amount);
  const total = toNumber_(payload.total_sales);
  const drawer = toNumber_(payload.drawer_balance || getSettingOrDefault_('DRAWER_BALANCE', 0));

  if (Math.abs((cash + transfer + credit) - total) > 0.001) {
    throw new Error('total_sales must equal cash_amount + transfer_amount + credit_amount');
  }

  const row = [
    genId_('SAL'), nowISO_(), createdBy, user.role,
    payload.entry_date, req_(payload.branch), cash, transfer, credit, total,
    drawer, payload.sales_proof || '', payload.note || ''
  ];
  appendRow_('DAILY_SALES', row);
  upsertSetting_('DRAWER_BALANCE', String(drawer));
  audit_('CREATE', 'DAILY_SALES', row[0], '', JSON.stringify(row), 'Create daily sales', user);
  return { record_id: row[0] };
}

function createExpense_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER]);
  validateBackdate_(user, payload.entry_date);

  const createdBy = String(payload.submitted_by || user.email).trim();
  const amount = toNumber_(payload.amount);
  const paymentSource = normalizePaymentSource_(payload.payment_source);
  if (!['cash', 'bank'].includes(paymentSource)) throw new Error('payment_source must be cash or bank');

  const row = [
    genId_('EXP'), nowISO_(), createdBy, user.role,
    payload.entry_date, req_(payload.branch), req_(payload.expense_name), req_(payload.category), amount,
    paymentSource, payload.receipt || '', payload.note || ''
  ];
  appendRow_('EXPENSES', row);
  audit_('CREATE', 'EXPENSES', row[0], '', JSON.stringify(row), 'Create expense', user);
  return { record_id: row[0] };
}

function createDeposit_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER]);
  validateBackdate_(user, payload.entry_date);

  const createdBy = String(payload.submitted_by || user.email).trim();
  const cashBefore = toNumber_(payload.cash_before_deposit);
  const deposit = toNumber_(payload.deposit_amount);
  const coin = cashBefore - deposit;

  const row = [
    genId_('DEP'), nowISO_(), createdBy, user.role,
    payload.entry_date, req_(payload.branch), cashBefore, deposit, coin, req_(payload.bank_account), payload.deposit_slip || '', payload.note || ''
  ];
  appendRow_('DEPOSITS', row);
  audit_('CREATE', 'DEPOSITS', row[0], '', JSON.stringify(row), 'Create deposit', user);
  return { record_id: row[0], coin_balance: coin };
}

function createReceivable_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER]);
  validateBackdate_(user, payload.entry_date);

  const createdBy = String(payload.submitted_by || user.email).trim();
  const credit = toNumber_(payload.credit_amount);
  const paid = toNumber_(payload.paid_amount || 0);
  const balance = credit - paid;
  let status = 'unpaid';
  if (balance <= 0) status = 'paid';
  else if (paid > 0) status = 'partial';

  const row = [
    genId_('REC'), nowISO_(), createdBy, user.role,
    payload.entry_date, req_(payload.branch), req_(payload.customer_name), credit, paid, balance,
    req_(payload.due_date), status, payload.payment_proof || '', payload.note || ''
  ];
  appendRow_('RECEIVABLES', row);
  audit_('CREATE', 'RECEIVABLES', row[0], '', JSON.stringify(row), 'Create receivable', user);
  return { record_id: row[0], balance_amount: balance, payment_status: status };
}

function createCancelRequest_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER]);
  validateBackdate_(user, payload.entry_date);

  const createdBy = String(payload.submitted_by || user.email).trim();
  const row = [
    genId_('CAN'), nowISO_(), createdBy, user.role,
    payload.entry_date, req_(payload.branch), toNumber_(payload.cancel_amount), req_(payload.reason), payload.detail || '', payload.proof || '',
    'pending', '', '', '', ''
  ];
  appendRow_('CANCEL_REQUESTS', row);
  audit_('CREATE', 'CANCEL_REQUESTS', row[0], '', JSON.stringify(row), 'Create cancel request', user);
  return { record_id: row[0], approval_status: 'pending' };
}

function createCashRecon_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER]);
  validateBackdate_(user, payload.entry_date);

  const createdBy = String(payload.submitted_by || user.email).trim();
  const branch = req_(payload.branch);
  const expected = calcExpectedCash_(payload.entry_date, branch);
  const actual = toNumber_(payload.actual_cash);
  const diff = actual - expected;
  const status = getReconStatus_(diff);
  const reason = String(payload.difference_reason || '').trim();
  if (diff !== 0 && !reason) throw new Error('difference_reason is required when difference != 0');

  const row = [
    genId_('RECASH'), nowISO_(), createdBy, user.role,
    payload.entry_date, branch, expected, actual, diff, status, reason, payload.note || ''
  ];
  appendRow_('CASH_RECON', row);
  audit_(
    'CREATE',
    'CASH_RECON',
    row[0],
    '',
    JSON.stringify({
      expected_cash: expected,
      actual_cash: actual,
      difference: diff,
      recon_status: status,
      difference_reason: reason,
      submitted_by: user.email,
      timestamp: row[1]
    }),
    'Create cash recon',
    user
  );
  return { record_id: row[0], expected_cash: expected, difference: diff, recon_status: status };
}

function approveCancelRequest_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.OWNER]);
  return setCancelRequestStatus_(payload.record_id, 'approved', user);
}

function rejectCancelRequest_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.OWNER]);
  return setCancelRequestStatus_(payload.record_id, 'rejected', user);
}

function setCancelRequestStatus_(recordId, status, user) {
  const sh = getSheet_('CANCEL_REQUESTS');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === recordId) {
      const old = data[i].slice();
      if (data[i][10] !== 'pending') throw new Error('Cancel request already processed');
      data[i][10] = status;
      if (status === 'approved') {
        data[i][11] = user.email;
        data[i][12] = nowISO_();
      } else {
        data[i][13] = user.email;
        data[i][14] = nowISO_();
      }
      sh.getRange(i + 1, 1, 1, data[i].length).setValues([data[i]]);
      audit_(status === 'approved' ? 'APPROVE' : 'REJECT', 'CANCEL_REQUESTS', recordId, JSON.stringify(old), JSON.stringify(data[i]), 'Update cancel request status', user);
      return { record_id: recordId, status: status };
    }
  }
  throw new Error('Cancel request not found');
}

function uploadAttachment_(user, payload) {
  requireRole_(user, [SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER]);

  const table = req_(payload.table_name);
  const ext = String(payload.file_name || '').split('.').pop().toLowerCase();
  if (!SYSTEM.ALLOWED_FILE_TYPES.includes(ext)) throw new Error('Unsupported file type');

  const bytes = Utilities.base64Decode(req_(payload.base64));
  if (bytes.length > SYSTEM.MAX_UPLOAD_SIZE) throw new Error('File too large, max 10MB');

  const folderId = getFolderIdByTable_(table);
  const folder = DriveApp.getFolderById(folderId);
  const blob = Utilities.newBlob(bytes, payload.mime_type || 'application/octet-stream', payload.file_name);
  const file = folder.createFile(blob);

  const row = [
    genId_('ATT'), nowISO_(), user.email, user.role,
    table, payload.record_id || '', payload.file_name, payload.mime_type || '', bytes.length, file.getId(), file.getUrl()
  ];
  appendRow_('ATTACHMENTS', row);
  audit_('UPLOAD', 'ATTACHMENTS', row[0], '', JSON.stringify(row), 'Upload attachment', user);
  return { attachment_id: row[0], drive_url: file.getUrl(), drive_file_id: file.getId() };
}

function getEmployeeDailyDashboard_(user, query) {
  const date = query.date || todayStr_();
  const branch = req_(query.branch || 'MAIN');

  const sales = filterByDateBranch_('DAILY_SALES', date, branch);
  const expenses = filterByDateBranch_('EXPENSES', date, branch);
  const deposits = filterByDateBranch_('DEPOSITS', date, branch);
  const recons = filterByDateBranch_('CASH_RECON', date, branch);

  const totalSales = sumIndex_(sales, 9);
  const cash = sumIndex_(sales, 6);
  const transfer = sumIndex_(sales, 7);
  const credit = sumIndex_(sales, 8);
  const expense = sumIndex_(expenses, 8);
  const deposit = sumIndex_(deposits, 7);
  const expected = cash - expense - deposit;
  const lastRecon = recons.length ? recons[recons.length - 1] : null;
  const actual = lastRecon ? toNumber_(lastRecon[7]) : 0;
  const diff = lastRecon ? toNumber_(lastRecon[8]) : 0;
  const reconStatus = lastRecon ? String(lastRecon[9]) : getReconStatus_(diff);
  const differenceReason = lastRecon ? String(lastRecon[10] || '') : '';

  return {
    date: date,
    branch: branch,
    totals: {
      total_sales: totalSales,
      cash: cash,
      transfer: transfer,
      credit: credit,
      expense: expense,
      deposit: deposit,
      drawer_balance: Number(getSettingOrDefault_('DRAWER_BALANCE', 0)) || 0,
      expected_cash: expected,
      actual_cash: actual,
      difference: diff,
      recon_status: reconStatus,
      difference_reason: differenceReason
    },
    entries: {
      sales: sales,
      expenses: expenses,
      deposits: deposits,
      cash_recon: recons
    }
  };
}

function getOwnerDashboard_(user, query) {
  const branch = query.branch || '';
  const date = query.date || todayStr_();
  const weekStart = startOfWeek_(new Date(date));
  const monthStart = new Date(new Date(date).getFullYear(), new Date(date).getMonth(), 1);

  const sales = getRows_('DAILY_SALES');
  const expenses = getRows_('EXPENSES');
  const deposits = getRows_('DEPOSITS');
  const receivables = getRows_('RECEIVABLES');
  const cancels = getRows_('CANCEL_REQUESTS');
  const recons = getRows_('CASH_RECON');

  const scopedSales = scopedByBranch_(sales, 5, branch);
  const salesToday = sumByDate_(scopedSales, 4, 9, date);
  const salesWeek = sumByDateRange_(scopedSales, 4, 9, weekStart, new Date(date));
  const salesMonth = sumByDateRange_(scopedSales, 4, 9, monthStart, new Date(date));

  const cash = sumByDate_(scopedSales, 4, 6, date);
  const transfer = sumByDate_(scopedSales, 4, 7, date);
  const credit = sumByDate_(scopedSales, 4, 8, date);
  const expenseToday = sumByDate_(scopedByBranch_(expenses, 5, branch), 4, 8, date);
  const depositToday = sumByDate_(scopedByBranch_(deposits, 5, branch), 4, 7, date);
  const coinToday = sumByDate_(scopedByBranch_(deposits, 5, branch), 4, 8, date);
  const receivableBalance = scopedByBranch_(receivables, 5, branch).reduce((a, r) => a + toNumber_(r[9]), 0);
  const expected = cash - expenseToday - depositToday;

  const targetDate = normalizeDate_(date);
  const reconsToday = filterRows_(recons, (r) => normalizeDate_(r[4]) === targetDate && (!branch || r[5] === branch));
  const actual = reconsToday.length ? toNumber_(reconsToday[reconsToday.length - 1][7]) : 0;
  const diff = reconsToday.length ? toNumber_(reconsToday[reconsToday.length - 1][8]) : 0;
  const reconStatus = reconsToday.length ? String(reconsToday[reconsToday.length - 1][9]) : getReconStatus_(diff);
  const differenceReason = reconsToday.length ? String(reconsToday[reconsToday.length - 1][10] || '') : '';

  const latestReconRows = filterRows_(recons, (r) => !branch || r[5] === branch)
    .sort((a, b) => String(b[1]).localeCompare(String(a[1])))
    .slice(0, 10)
    .map((r) => ({
      entry_date: r[4],
      branch: r[5],
      employee: r[2],
      expected_cash: toNumber_(r[6]),
      actual_cash: toNumber_(r[7]),
      difference: toNumber_(r[8]),
      recon_status: r[9],
      difference_reason: r[10] || ''
    }))
    .filter((r) => r.difference !== 0);

  const pending = filterRows_(cancels, (r) => r[10] === 'pending' && (!branch || r[5] === branch)).length;
  const approved = filterRows_(cancels, (r) => r[10] === 'approved' && (!branch || r[5] === branch)).length;

  return {
    date,
    branch: branch || 'ALL',
    sales_today: salesToday,
    sales_week: salesWeek,
    sales_month: salesMonth,
    cash,
    transfer,
    credit,
    receivables: receivableBalance,
    expenses: expenseToday,
    deposits: depositToday,
    coins: coinToday,
    drawer_balance: Number(getSettingOrDefault_('DRAWER_BALANCE', 0)) || 0,
    expected_cash: expected,
    actual_cash: actual,
    difference: diff,
    recon_status: reconStatus,
    difference_reason: differenceReason,
    pending_cancel_requests: pending,
    approved_cancel_requests: approved,
    latest_recon_variances: latestReconRows,
    money_flow: {
      total_sales: salesToday,
      cash: cash,
      cash_expenses: expenseToday,
      deposits: depositToday,
      remaining_cash: expected,
      bank_transfer: transfer,
      receivables: credit,
      cancel_requests: pending,
      difference: diff
    }
  };
}

function getPendingCancelRequests_() {
  return filterRows_(getRows_('CANCEL_REQUESTS'), (r) => r[10] === 'pending');
}

function getAuditLogs_(query) {
  const rows = getRows_('AUDIT_LOG');
  const limit = Math.max(1, Math.min(500, Number(query.limit || 100)));
  return rows.slice(-limit).reverse();
}

function getUserContext_(data) {
  const role = String(data.role || '').toLowerCase();
  const email = String(data.user || '').toLowerCase();
  if (!role || !email) throw new Error('Missing user or role');
  if (![SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER].includes(role)) throw new Error('Invalid role');
  validateUserRoleMapping_(email, role);
  return { role, email };
}

function login_(data) {
  const email = String(data.user || data.email || '').toLowerCase().trim();
  const role = String(data.role || '').toLowerCase().trim();
  const branch = String(data.branch || 'MAIN').trim();
  if (!email || !role) throw new Error('Missing email or role');
  if (![SYSTEM.ROLES.EMPLOYEE, SYSTEM.ROLES.OWNER].includes(role)) throw new Error('Invalid role');

  validateUserRoleMapping_(email, role);
  return { email, role, branch };
}

function validateUserRoleMapping_(email, role) {
  const allowSelfRegister = String(getSettingOrDefault_('ALLOW_SELF_REGISTER', 'false')).toLowerCase() === 'true';
  if (allowSelfRegister) return true;

  const owners = splitCsv_(getSettingOrDefault_('OWNER_EMAILS', ''));
  const employees = splitCsv_(getSettingOrDefault_('EMPLOYEE_EMAILS', ''));

  if (role === SYSTEM.ROLES.OWNER && owners.includes(email)) return true;
  if (role === SYSTEM.ROLES.EMPLOYEE && employees.includes(email)) return true;
  throw new Error('User is not allowed for this role');
}

function requireRole_(user, allowed) {
  if (!allowed.includes(user.role)) throw new Error('Unauthorized role');
}

function validateBackdate_(user, dateStr) {
  req_(dateStr);
  if (user.role === SYSTEM.ROLES.OWNER) return;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today - d) / (24 * 3600 * 1000));
  if (diff < 0) throw new Error('Future date is not allowed');
  if (diff > 3) throw new Error('Employee can backdate up to 3 days only');
}

function req_(v) {
  if (v === null || v === undefined || String(v).trim() === '') throw new Error('Missing required field');
  return String(v).trim();
}

function toNumber_(v) {
  const n = Number(v || 0);
  if (Number.isNaN(n)) throw new Error('Invalid number');
  return n;
}

function normalizePaymentSource_(value) {
  const x = String(value || '').trim().toLowerCase();
  if (x === 'เงินสด' || x === 'cash') return 'cash';
  if (x === 'ธนาคาร' || x === 'bank') return 'bank';
  return x;
}

function appendRow_(sheetName, row) {
  const sh = getSheet_(sheetName);
  sh.appendRow(row);
}

function getRows_(sheetName) {
  const vals = getSheet_(sheetName).getDataRange().getValues();
  return vals.length > 1 ? vals.slice(1) : [];
}

function filterByDateBranch_(sheetName, date, branch) {
  const targetDate = normalizeDate_(date);
  return filterRows_(getRows_(sheetName), (r) => normalizeDate_(r[4]) === targetDate && String(r[5] || '') === String(branch || ''));
}

function filterRows_(rows, predicate) {
  return rows.filter(predicate);
}

function scopedByBranch_(rows, branchIndex, branch) {
  if (!branch) return rows;
  return rows.filter((r) => r[branchIndex] === branch);
}

function sumIndex_(rows, index) {
  return rows.reduce((acc, r) => acc + toNumber_(r[index]), 0);
}

function sumByDate_(rows, dateIndex, valueIndex, date) {
  const targetDate = normalizeDate_(date);
  return rows.reduce((acc, r) => (normalizeDate_(r[dateIndex]) === targetDate ? acc + toNumber_(r[valueIndex]) : acc), 0);
}

function sumByDateRange_(rows, dateIndex, valueIndex, startDate, endDate) {
  const start = startOfDay_(startDate);
  const end = endOfDay_(endDate);
  return rows.reduce((acc, r) => {
    const d = parseDate_(r[dateIndex]);
    if (d && d >= start && d <= end) return acc + toNumber_(r[valueIndex]);
    return acc;
  }, 0);
}

function calcExpectedCash_(entryDate, branch) {
  const sales = filterByDateBranch_('DAILY_SALES', entryDate, branch);
  const expenses = filterByDateBranch_('EXPENSES', entryDate, branch);
  const deposits = filterByDateBranch_('DEPOSITS', entryDate, branch);
  const cashSales = sumIndex_(sales, 6);
  const cashExpenses = sumIndex_(expenses, 8);
  const depositAmount = sumIndex_(deposits, 7);
  return cashSales - cashExpenses - depositAmount;
}

function getReconStatus_(difference) {
  if (difference === 0) return 'MATCHED';
  if (difference < 0) return 'SHORT';
  return 'OVER';
}

function startOfWeek_(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDate_(v) {
  if (v instanceof Date) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  const s = String(v || '').trim();
  if (!s) return null;
  const datePart = s.slice(0, 10);
  const d = new Date(datePart + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function normalizeDate_(v) {
  const d = parseDate_(v);
  if (!d) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function startOfDay_(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay_(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getFolderIdByTable_(table) {
  const map = {
    DAILY_SALES: 'SALES_PROOF_FOLDER_ID',
    EXPENSES: 'EXPENSE_RECEIPT_FOLDER_ID',
    DEPOSITS: 'DEPOSIT_SLIP_FOLDER_ID',
    CANCEL_REQUESTS: 'CANCEL_REQUEST_FOLDER_ID',
    RECEIVABLES: 'CUSTOMER_PAYMENT_FOLDER_ID'
  };
  const key = map[table];
  if (!key) throw new Error('Unknown table for attachment');
  return getSetting_(key);
}

function getSetting_(key) {
  const rows = getRows_('SETTINGS');
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) return rows[i][1];
  }
  throw new Error('Setting not found: ' + key);
}

function getSettingOrDefault_(key, defaultValue) {
  const rows = getRows_('SETTINGS');
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) return rows[i][1];
  }
  return defaultValue;
}

function splitCsv_(raw) {
  return String(raw || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function upsertSetting_(key, value) {
  const sh = getSheet_('SETTINGS');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

function getSheet_(name) {
  const ss = getDatabase_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

function getDatabase_() {
  const prop = PropertiesService.getScriptProperties();
  const dbId = prop.getProperty('DB_SPREADSHEET_ID');
  if (dbId) {
    return SpreadsheetApp.openById(dbId);
  }

  const files = DriveApp.getFilesByName(SYSTEM.SPREADSHEET_NAME);
  if (files.hasNext()) {
    const file = files.next();
    const ss = SpreadsheetApp.openById(file.getId());
    prop.setProperty('DB_SPREADSHEET_ID', ss.getId());
    return ss;
  }

  throw new Error('Database not initialized. Please run setupSystem() once.');
}

function audit_(action, table, recordId, oldVal, newVal, note, user) {
  const row = [
    genId_('LOG'), nowISO_(), user.email, user.role, action, table, recordId,
    oldVal || '', newVal || '', note || ''
  ];
  appendRow_('AUDIT_LOG', row);
}

function genId_(prefix) {
  return prefix + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function nowISO_() {
  return new Date().toISOString();
}

function todayStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function jsonResponse_(obj, code) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
