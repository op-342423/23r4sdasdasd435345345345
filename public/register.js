function nextUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('next') || 'index.html';
}

const authCard = document.getElementById('authCard');
const registerBtn = document.getElementById('registerBtn');

function shakeCard() {
  authCard.classList.remove('is-shaking');
  // eslint-disable-next-line no-unused-expressions
  authCard.offsetWidth; // force reflow so the animation can replay
  authCard.classList.add('is-shaking');
}

registerBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || password.length < 6) {
    showToast('Please enter an email and a password of at least 6 characters.', 'error');
    shakeCard();
    return;
  }

  registerBtn.disabled = true;
  registerBtn.innerHTML = '<span class="btn__spinner"></span>Creating account…';

  try {
    await apiRegister(email, password);
    registerBtn.innerHTML = 'Account created!';
    showToast('Account created!', 'success');
    setTimeout(() => { location.href = nextUrl(); }, 500);
  } catch (e) {
    showToast(e.message || 'Could not create account.', 'error');
    shakeCard();
    registerBtn.disabled = false;
    registerBtn.textContent = 'Create account';
  }
});

document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') registerBtn.click();
});
