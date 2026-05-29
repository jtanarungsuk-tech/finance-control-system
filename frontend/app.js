function getSession() {
  const raw = localStorage.getItem('fcs_session');
  if (raw) return JSON.parse(raw);
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
