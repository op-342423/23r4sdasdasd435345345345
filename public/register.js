function nextUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('next') || 'index.html';
}

document.getElementById('registerBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || password.length < 6) {
    showToast('Please enter an email and a password of at least 6 characters.', 'error');
    return;
  }
  try {
    await apiRegister(email, password);
    showToast('Account created!', 'success');
    setTimeout(() => { location.href = nextUrl(); }, 500);
  } catch (e) {
    showToast(e.message || 'Could not create account.', 'error');
  }
});

document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('registerBtn').click();
});
