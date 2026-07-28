function nextUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('next') || 'index.html';
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) { showToast('Please enter your email and password.', 'error'); return; }

  try {
    const me = await apiLogin(email, password);
    showToast('Welcome back!', 'success');
    setTimeout(() => { location.href = me.isAdmin ? 'admin.html' : nextUrl(); }, 500);
  } catch (e) {
    showToast(e.message || 'Could not log in.', 'error');
  }
});

document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});
