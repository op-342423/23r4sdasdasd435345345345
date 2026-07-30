function nextUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('next') || 'index.html';
}

const authCard = document.getElementById('authCard');
const loginBtn = document.getElementById('loginBtn');

function shakeCard() {
  authCard.classList.remove('is-shaking');
  // eslint-disable-next-line no-unused-expressions
  authCard.offsetWidth; // force reflow so the animation can replay
  authCard.classList.add('is-shaking');
}

loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) {
    showToast('Please enter your email and password.', 'error');
    shakeCard();
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="btn__spinner"></span>Logging in…';

  try {
    const me = await apiLogin(email, password);
    loginBtn.innerHTML = 'Welcome back!';
    showToast('Welcome back!', 'success');
    setTimeout(() => { location.href = me.isAdmin ? 'admin.html' : nextUrl(); }, 500);
  } catch (e) {
    showToast(e.message || 'Could not log in.', 'error');
    shakeCard();
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log in';
  }
});

document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});
