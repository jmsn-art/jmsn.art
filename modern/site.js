(() => {
  const toggle = document.querySelector('.m-menu');
  const navigation = document.querySelector('#modern-navigation');
  function setMenu(open) {
    navigation.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  navigation.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false); toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.m-header')) setMenu(false);
  });
  matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
  document.querySelectorAll('[data-modern-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
