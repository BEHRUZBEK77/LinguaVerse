(() => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const memory = Number(navigator.deviceMemory) || 0;
  const cores = Number(navigator.hardwareConcurrency) || 0;
  const slowNetwork = connection?.saveData ||
    ['slow-2g', '2g'].includes(connection?.effectiveType);
  const simpleDevice = slowNetwork || memory > 0 && memory <= 2 ||
    cores > 0 && cores <= 2 || memory > 0 && memory <= 4 && cores > 0 && cores <= 4;
  const powerfulDevice = !simpleDevice && memory >= 6 && cores >= 8;
  const performanceTier = simpleDevice ? 'simple' : powerfulDevice ? 'powerful' : 'medium';
  document.documentElement.dataset.lvPerformance = performanceTier;
  window.lvPerformance = Object.freeze({ tier: performanceTier, memory: memory || null, cores: cores || null });

  const drawings = {
    arrowLeft: '<path d="m15 18-6-6 6-6"/><path d="M20 12H9"/>',
    arrowRight: '<path d="M4 12h11"/><path d="m13 6 6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    bars: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    bag: '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20"/>',
    bot: '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    chart: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    coins: '<circle cx="8" cy="8" r="5"/><path d="M3 8v3a5 5 0 0 0 8.5 3.5M13 11h3a5 5 0 1 1-4.9 6"/>',
    crown: '<path d="m3 8 5 4 4-7 4 7 5-4-2 12H5L3 8Z"/><path d="M6 17h12"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    creditCard: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
    flame: '<path d="M12 22c4.4 0 7-3.1 7-7 0-2.7-1.6-5.3-4-7-.2 2.1-1 3.2-2 4-1-3.6-2.7-6.1-5-8-0.1 3-1 5-2 6.5C4.8 12.2 5 14 5 15c0 4 2.8 7 7 7Z"/><path d="M10 18c0-1.5.8-2.7 2-3.7 1.4 1.2 2 2.3 2 3.7a2 2 0 0 1-4 0Z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v5c0 4-2 7-6 7h-2c-2 0-3.5-1-4.5-2.5L5 15a1.6 1.6 0 0 1 2.5-2z"/>',
    heart: '<path d="M20.8 8.8c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.2 1.6c-1.2 1.1-1.9 1.5-1.9 3.1M12 17h.01"/>',
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 3 3-2 2 2 2-3 3-2-2-3 3"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    lightbulb: '<path d="M9 18h6M10 22h4M8.2 14.5A6 6 0 1 1 15.8 14.5c-.9.7-1.3 1.7-1.3 3.5h-5c0-1.8-.4-2.8-1.3-3.5Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2A5 5 0 0 0 12 3.9l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M9 22h6"/>',
    moon: '<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.7 8.7 0 1 0 20.5 14Z"/>',
    pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
    pen: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15v5Z"/>',
    play: '<path d="m8 5 12 7-12 7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3"/>',
    rocket: '<path d="M12 15 9 12c.5-4 3.5-7 10-9-.5 6.5-3.5 9.5-7 10Z"/><path d="m9 12-4 1-2 4 6-1M12 15l-1 4 4 2 1-6"/><circle cx="15" cy="8" r="1"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.6a8 8 0 0 1-1.7 1l-.3 1.9h-2.8l-.3-1.9a8 8 0 0 1-1.7-1l-1.8.6-1.4-2.4 1.5-1.1a7 7 0 0 1 0-2l-1.5-1.1 1.4-2.4 1.8.6a8 8 0 0 1 1.7-1l.3-1.9h2.8l.3 1.9a8 8 0 0 1 1.7 1l1.8-.6 1.4 2.4-1.5 1.1a7 7 0 0 1 0 1.9Z"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5ZM5 2l.8 2.2L8 5l-2.2.8L5 8l-.8-2.2L2 5l2.2-.8L5 2Z"/>',
    spinner: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9H4ZM17 9a5 5 0 0 1 0 6M19.5 6.5a9 9 0 0 1 0 11"/>',
    wifi: '<path d="M5 12.5a11 11 0 0 1 14 0M8 15.5a6.5 6.5 0 0 1 8 0M11 18.5a2 2 0 0 1 2 0M12 22h.01"/>',
    x: '<path d="m18 6-12 12M6 6l12 12"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    alert: '<path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>'
  };

  const aliases = {
    'arrow-left': 'arrowLeft', 'arrow-right': 'arrowRight', 'arrow-up': 'arrowUp',
    'arrow-trend-up': 'chart', 'arrow-right-arrow-left': 'refresh',
    'arrow-up-right-from-square': 'arrowRight', 'arrow-right-to-bracket': 'arrowRight',
    'arrow-down-short-wide': 'layers', 'circle-arrow-right': 'arrowRight',
    'arrow-left-right': 'refresh', 'chevron-down': 'chevronDown',
    'rotate': 'refresh', 'rotate-right': 'refresh', 'repeat': 'refresh',
    'shuffle': 'refresh', 'clock-rotate-left': 'refresh', 'rotate-left': 'refresh',
    'circle-check': 'checkCircle', 'check-circle': 'checkCircle',
    'heart': 'heart',
    'circle-xmark': 'xCircle', 'circle-exclamation': 'alert', 'exclamation-circle': 'alert',
    'triangle-exclamation': 'alert', 'circle-question': 'help', 'circle-info': 'info',
    'circle-arrow-right': 'arrowRight', 'circle': 'circle',
    'magnifying-glass': 'search', 'search': 'search',
    'book-open': 'book', 'book-open-reader': 'book', 'book-bookmark': 'book',
    'spell-check': 'book', 'chalkboard-user': 'book', 'language': 'globe', 'earth-europe': 'globe',
    'earth-americas': 'globe', 'globe': 'globe',
    'microphone-lines': 'mic', 'microphone': 'mic', 'microphone-slash': 'mic',
    'ear-listen': 'volume', 'headphones': 'volume', 'volume-high': 'volume', 'volume-low': 'volume',
    'volume-xmark': 'volume', 'waveform-lines': 'volume', 'signal': 'wifi', 'wifi-slash': 'wifi',
    'bag-shopping': 'bag', 'box': 'layers', 'box-open': 'layers', 'boxes-stacked': 'layers',
    'layer-group': 'layers', 'store': 'bag', 'ticket': 'star', 'ticket-simple': 'star',
    'gem': 'star', 'medal': 'trophy', 'trophy': 'trophy', 'crown': 'crown', 'star': 'star',
    'coins': 'coins', 'sack-dollar': 'coins', 'money-check-dollar': 'creditCard',
    'money-bill-wave': 'creditCard', 'credit-card': 'creditCard', 'file-invoice': 'book',
    'clipboard-list': 'book', 'list-check': 'check', 'list-ol': 'book', 'list': 'book',
    'pen-nib': 'pen', 'pen-to-square': 'pen', 'pen': 'pen', 'font': 'book',
    'paper-plane': 'send', 'telegram': 'send', 'send': 'send', 'share-nodes': 'send',
    'gear': 'settings', 'sliders': 'settings', 'wrench': 'settings',
    'lock': 'lock', 'lock-keyhole': 'lock', 'lock-open': 'lock', 'user-lock': 'lock', 'shield-halved': 'shield', 'user-xmark': 'user',
    'user-plus': 'user', 'user-minus': 'user', 'user-pen': 'user', 'user-group': 'users',
    'users': 'users', 'user': 'user', 'user-astronaut': 'user',
    'house': 'home', 'bars': 'bars', 'xmark': 'x',
    'robot': 'bot', 'brain': 'bot', 'sparkles': 'sparkles', 'wand-magic-sparkles': 'sparkles',
    'rocket': 'rocket', 'bolt': 'sparkles', 'lightbulb': 'lightbulb',
    'spinner': 'spinner',
    'sun': 'sparkles', 'moon': 'moon', 'fire': 'flame', 'seedling': 'sparkles',
    'play': 'play', 'stop': 'pause', 'pause': 'pause', 'forward': 'arrowRight',
    'key': 'key', 'lock': 'lock', 'link': 'link', 'external-link-alt': 'arrowRight',
    'copy': 'copy', 'trash': 'x', 'image': 'image', 'images': 'image', 'camera': 'image',
    'calendar': 'calendar', 'calendar-days': 'calendar', 'clock': 'clock', 'stopwatch': 'clock',
    'hourglass-half': 'clock', 'power-off': 'x', 'right-from-bracket': 'arrowRight',
    'right-to-bracket': 'arrowRight', 'right-to-left': 'arrowLeft',
    'inbox': 'book', 'database': 'layers', 'code': 'book', 'bullseye': 'star',
    'graduation-cap': 'book', 'comment': 'book', 'comments': 'book', 'comment-dots': 'book',
    'message': 'book', 'face-smile': 'user', 'face-laugh': 'user', 'hands-praying': 'hand',
    'hand-holding-heart': 'heart', 'hand-pointer': 'hand', 'hand-fist': 'hand',
    'champagne-glasses': 'star', 'gift': 'star', 'palette': 'sparkles',
    'wifi': 'wifi', 'tree': 'sparkles', 'mountain-sun': 'sparkles', 'water': 'sparkles',
    'snowflake': 'sparkles', 'rainbow': 'sparkles', 'dragon': 'sparkles',
    'infinity': 'link', 'bell': 'info', 'flask': 'book', 'dice': 'star',
    'flag': 'star', 'flag-checkered': 'star', 'flag-usa': 'globe',
    'tower-broadcast': 'wifi', 'satellite-dish': 'wifi', 'phone-slash': 'x',
    'eraser': 'x', 'ban': 'xCircle', 'stopwatch': 'clock', 'chart-line': 'chart',
    'chart-pie': 'chart', 'chart-bar': 'chart', 'chart-simple': 'chart',
    'gauge-high': 'chart', 'gauge-simple': 'chart', 'bullhorn': 'send',
    'file': 'book', 'receipt': 'book', 'wallet': 'creditCard', 'door-open': 'arrowRight',
    'door-closed': 'lock', 'person-military-pointing': 'user', 'exclamation': 'alert',
    'plus': 'plus', 'plus-circle': 'plus', 'minus': 'x', 'align-left': 'book',
    'tag': 'star', 'thumbs-up': 'check', 'circle-question': 'help'
  };

  function nameFrom(element) {
    return [...element.classList].find(name =>
      name.startsWith('fa-') &&
      !['fa-solid', 'fa-regular', 'fa-brands', 'fa-light', 'fa-spin', 'fa-fw',
        'fa-lg', 'fa-sm', 'fa-xs', 'fa-2x', 'fa-3x'].includes(name)
    )?.slice(3);
  }

  function resolveIcon(name) {
    return aliases[name] || (
      name.includes('arrow') ? 'arrowRight' :
      name.includes('user') ? 'user' :
      name.includes('book') || name.includes('list') ? 'book' :
      name.includes('chart') || name.includes('gauge') ? 'chart' :
      name.includes('check') ? 'checkCircle' :
      name.includes('circle') && name.includes('x') ? 'xCircle' :
      name.includes('clock') ? 'clock' : 'sparkles'
    );
  }

  function refreshSvgIcon(svg) {
    const name = nameFrom(svg);
    if (!name) return;
    const icon = resolveIcon(name);
    const retainedClasses = [...svg.classList].filter(className =>
      !/^fa(?:-|$)/.test(className) &&
      !['fas', 'far', 'fab', 'fal', 'fad', 'fat'].includes(className) &&
      className !== 'lv-icon-spin'
    );
    if (svg.classList.contains('fa-spin')) retainedClasses.push('lv-icon-spin');
    const className = [...retainedClasses, 'lv-icon'].join(' ');
    if (svg.getAttribute('class') !== className) svg.setAttribute('class', className);
    svg.dataset.lvIcon = 'true';
    svg.innerHTML = drawings[icon] || drawings.sparkles;
  }

  function iconify(element) {
    if (element instanceof SVGElement && element.dataset.lvIcon === 'true') {
      refreshSvgIcon(element);
      return;
    }
    if (!(element instanceof HTMLElement) || element.dataset.lvIcon === 'true') return;
    const name = nameFrom(element);
    if (!name) return;
    const icon = resolveIcon(name);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const retainedClasses = [...element.classList].filter(name =>
      !/^fa(?:-|$)/.test(name) && !['fas', 'far', 'fab', 'fal', 'fad', 'fat'].includes(name)
    );
    svg.setAttribute('class', [...retainedClasses, 'lv-icon'].join(' '));
    svg.setAttribute('aria-hidden', element.getAttribute('aria-hidden') || 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '1em');
    svg.setAttribute('height', '1em');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    if (element.id) svg.id = element.id;
    svg.dataset.lvIcon = 'true';
    svg.innerHTML = drawings[icon] || drawings.sparkles;
    if (element.hasAttribute('style')) svg.setAttribute('style', element.getAttribute('style'));
    if (element.classList.contains('fa-spin')) svg.style.animation = 'lv-icon-spin 1s linear infinite';
    if (element.title) svg.setAttribute('title', element.title);
    element.replaceWith(svg);
  }

  function scan(root) {
    if (root instanceof Element) iconify(root);
    root.querySelectorAll?.('[class*="fa-"]').forEach(iconify);
  }

  const start = () => {
    const style = document.createElement('style');
    style.textContent = `
      .lv-icon {
        display: inline-block;
        flex: 0 0 auto;
        overflow: visible;
        box-sizing: border-box;
        width: 1.32em;
        height: 1.32em;
        padding: .2em;
        vertical-align: -.3em;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        border-radius: .42em;
        background: color-mix(in srgb, currentColor 10%, transparent);
        transition: transform .16s ease, background-color .16s ease;
      }
      @keyframes lv-icon-spin { to { transform: rotate(360deg); } }
      .lv-icon.lv-icon-spin { animation: lv-icon-spin 1s linear infinite; }
      @media (hover: hover) {
        .lv-icon:hover,
        button:hover .lv-icon,
        a:hover .lv-icon,
        [role="button"]:hover .lv-icon,
        [onclick]:hover .lv-icon {
          transform: scale(1.06);
        }
      }
      button:active .lv-icon,
      a:active .lv-icon,
      [role="button"]:active .lv-icon,
      [onclick]:active .lv-icon {
        transform: scale(.94);
      }
      @media (prefers-reduced-motion: reduce) {
        .lv-icon { transition: none !important; }
      }
    `;
    document.head.appendChild(style);
    scan(document.body);
    new MutationObserver(records => records.forEach(record => {
      if (record.type === 'childList') record.addedNodes.forEach(node => {
        if (node instanceof Element) scan(node);
      });
      else if (record.target instanceof Element) iconify(record.target);
    })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
