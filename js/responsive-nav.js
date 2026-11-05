for (const toggle of document.querySelectorAll('[data-nav-toggle]')) {
  const menuId = toggle.getAttribute('aria-controls');
  const menu = menuId ? document.getElementById(menuId) : null;

  if (!menu) {
    console.error('Responsive navigation menu was not found.', { toggle, menuId });
    continue;
  }

  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Menyuni ochish');
    menu.classList.remove('open');
  };

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Menyuni ochish' : 'Menyuni yopish');
    menu.classList.toggle('open', !isOpen);
  });

  menu.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });

  window.matchMedia('(min-width: 701px)').addEventListener('change', closeMenu);
}
