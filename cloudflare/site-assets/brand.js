/* LinguaVerse Cloudflare-only unified brand navigation, v2. Safe and idempotent. */
(() => {
  'use strict';
  const MARK = '/media/linguaverse-mark.webp';
  const LINK = '/languages-html/partners.html';
  const isPartner = /\/languages-html\/partners\.html\/?$/i.test(location.pathname);
  const brandText = (s) => /lingua\s*verse|lingua\s*verce/i.test(s || '');

  function enhanceLogos() {
    const selectors = 'a.logo, .logo, a.nav-logo, .nav-logo, a.brand, .brand-logo, a[class*="site-logo"], .footer-brand';
    for (const el of document.querySelectorAll(selectors)) {
      if (el.dataset.lvBrandReady === 'true') continue;
      if (!brandText(el.textContent) || el.closest('#lv-partner-dock')) continue;
      if (!el.querySelector('img[src*="linguaverse-mark.webp"]')) {
        const image = document.createElement('img');
        image.src = MARK;
        image.alt = '';
        image.width = 30;
        image.height = 30;
        image.decoding = 'async';
        image.className = 'lv-global-logo';
        el.prepend(image);
      } else {
        const image = el.querySelector('img[src*="linguaverse-mark.webp"]');
        image.classList.add('lv-global-logo');
        image.removeAttribute('style');
      }
      el.classList.add('lv-global-brand');
      el.dataset.lvBrandReady = 'true';
    }
  }

  function addPartnerEntry() {
    if (isPartner) return;
    // Existing fixed CTA was removed during the Cloudflare build, so only one dock is created.
    if (!document.querySelector('#lv-partner-dock')) {
      const a = document.createElement('a');
      a.id = 'lv-partner-dock';
      a.className = 'lv-partner-dock';
      a.href = LINK;
      a.setAttribute('aria-label', 'LinguaVerse hamkorlik dasturiga kirish');
      const icon = document.createElement('span');
      icon.className = 'lv-partner-dock-icon';
      icon.textContent = '🤝';
      const label = document.createElement('span');
      label.className = 'lv-partner-dock-label';
      label.textContent = 'Hamkorlik';
      a.append(icon, label);
      document.body.append(a);
    }
    const footer = document.querySelector('footer');
    if (footer && !footer.querySelector('a[href*="partners.html"]')) {
      const a = document.createElement('a');
      a.href = LINK;
      a.className = 'lv-partner-footer';
      a.textContent = '🤝 Hamkorlik va kontent yaratuvchilar';
      footer.append(a);
    }
  }

  function apply() {
    enhanceLogos();
    addPartnerEntry();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {once: true});
  else apply();
  // Dynamically rendered headers on profile/learning pages receive the same logo.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; enhanceLogos(); });
  });
  const observe = () => observer.observe(document.body, {childList: true, subtree: true});
  if (document.body) observe(); else document.addEventListener('DOMContentLoaded', observe, {once: true});
})();
