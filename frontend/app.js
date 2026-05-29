function getSession() {
  const raw = localStorage.getItem('fcs_session');
  if (raw) {
    try { return JSON.parse(raw); } catch (_) { localStorage.removeItem('fcs_session'); }
  }
  const guest = { email: 'employee@local', role: 'employee', branch: 'MAIN' };
  localStorage.setItem('fcs_session', JSON.stringify(guest));
  return guest;
}

function requireSession(roles = []) {
  const s = getSession();
  if (roles.length && !roles.includes(s.role)) {
    return null;
  }
  return s;
}

function logout() {
  localStorage.removeItem('fcs_session');
  window.location.href = 'employee-dashboard.html';
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDateStr(baseDate, days) {
  const d = new Date(baseDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function findLatestDataDate(session, maxBackDays = 14) {
  const base = todayStr();
  for (let i = 0; i <= maxBackDays; i++) {
    const date = shiftDateStr(base, -i);
    try {
      const d = await API.get('getEmployeeDailyDashboard', {
        role: session.role,
        user: session.email,
        branch: session.branch || 'MAIN',
        date
      });
      const t = d && d.totals ? d.totals : {};
      const hasTotals = Number(t.total_sales || 0) > 0 || Number(t.expense || 0) > 0 || Number(t.deposit || 0) > 0;
      const e = d && d.entries ? d.entries : {};
      const hasRows = (e.sales || []).length || (e.expenses || []).length || (e.deposits || []).length || (e.cash_recon || []).length;
      if (hasTotals || hasRows) return date;
    } catch (_) {}
  }
  return base;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function thb(n) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(n || 0));
}

async function submitForm(action, formId, extra = {}) {
  const session = getSession();
  const form = document.getElementById(formId);
  const data = Object.fromEntries(new FormData(form).entries());
  if (action === 'createExpense') {
    if (data.payment_source === 'เงินสด') data.payment_source = 'cash';
    if (data.payment_source === 'ธนาคาร') data.payment_source = 'bank';
  }
  const payload = {
    ...data,
    ...extra,
    branch: data.branch || session.branch || 'MAIN',
    role: session.role,
    user: session.email,
    submitted_by: data.submitted_by || session.email
  };
  const result = await API.post(action, payload);
  alert('บันทึกสำเร็จ: ' + (result.record_id || 'OK'));
  form.reset();
}

function wireDefaultDate() {
  document.querySelectorAll('input[type="date"]').forEach((el) => {
    if (!el.value) el.value = todayStr();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireDefaultDate();
});
