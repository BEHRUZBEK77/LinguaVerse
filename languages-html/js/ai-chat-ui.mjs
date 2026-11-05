const STORAGE_KEY = 'lv_ai_thinking_mode';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatInline(value) {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function formatAIResponse(text) {
  const lines = escapeHtml(text).replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let listType = '';

  const closeParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${paragraph.map(formatInline).join('<br>')}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = '';
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      output.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
    } else if (item) {
      closeParagraph();
      const nextType = /^\s*\d+[.)]/.test(line) ? 'ol' : 'ul';
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${formatInline(item[1])}</li>`);
    } else if (!line.trim()) {
      closeParagraph();
      closeList();
    } else {
      closeList();
      paragraph.push(line);
    }
  }
  closeParagraph();
  closeList();

  return `<div class="lv-ai-response"><div class="lv-ai-response-heading"><span class="lv-ai-response-icon"><i class="fa-solid fa-sparkles" aria-hidden="true"></i></span><span>LinguaVerse AI</span><span class="lv-ai-response-tag">Javob</span></div><div class="lv-ai-response-body">${output.join('')}</div></div>`;
}

export function getAIThinkingMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'balanced' ? 'balanced' : 'deep';
  } catch {
    return window.__lvAIThinkingMode === 'balanced' ? 'balanced' : 'deep';
  }
}

export function initializeAIChatUI(targetSelector = '#chatInput') {
  const mount = () => {
    const target = document.querySelector(targetSelector);
    const area = target?.matches('.chat-input-area, .controls, .setup')
      ? target
      : target?.closest('.chat-input-area')
        || target?.closest('.chat-input-row')?.parentElement
        || target?.parentElement;
    if (!area || area.querySelector('.lv-ai-thinking-control')) return;

    if (!document.getElementById('lv-ai-chat-ui-styles')) {
      const style = document.createElement('style');
      style.id = 'lv-ai-chat-ui-styles';
      style.textContent = `
        .lv-ai-thinking-control{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;margin:0 0 10px;border:1px solid var(--border,rgba(148,163,184,.2));border-radius:12px;background:linear-gradient(120deg,rgba(99,102,241,.08),rgba(56,189,248,.05));}
        .lv-ai-thinking-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
        .lv-ai-thinking-title{font-size:.72rem;font-weight:800;color:var(--text2,#e2e8f0)}
        .lv-ai-thinking-hint{font-size:.64rem;color:var(--text3,#94a3b8)}
        .lv-ai-thinking-toggle{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:6px 11px;border:1px solid rgba(129,140,248,.35);border-radius:10px;background:rgba(99,102,241,.1);color:var(--text,#f8fafc);font:700 .69rem var(--font-body,inherit);cursor:pointer;white-space:nowrap;transition:background .2s,border-color .2s,transform .2s}
        .lv-ai-thinking-toggle:hover{transform:translateY(-1px);background:rgba(99,102,241,.18)}
        .lv-ai-thinking-toggle[aria-pressed=true]{border-color:rgba(45,212,191,.55);background:linear-gradient(120deg,rgba(79,70,229,.2),rgba(20,184,166,.16))}
        .lv-ai-response{min-width:0}
        .lv-ai-response-heading{display:flex;align-items:center;gap:7px;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid rgba(148,163,184,.16);font-size:.68rem;font-weight:800;letter-spacing:.02em;color:var(--text2,#e2e8f0)}
        .lv-ai-response-icon{display:grid;place-items:center;width:22px;height:22px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#14b8a6);color:white}
        .lv-ai-response-tag{margin-left:auto;padding:3px 7px;border-radius:99px;background:rgba(20,184,166,.1);color:#5eead4;font-size:.58rem}
        .lv-ai-response-body{font-size:inherit;line-height:1.75;overflow-wrap:anywhere}
        .lv-ai-response-body p{margin:0 0 9px}
        .lv-ai-response-body p:last-child{margin-bottom:0}
        .lv-ai-response-body h2,.lv-ai-response-body h3,.lv-ai-response-body h4{margin:12px 0 6px;color:var(--text,#f8fafc);font-size:1em;font-weight:800}
        .lv-ai-response-body ul,.lv-ai-response-body ol{margin:5px 0 10px;padding-left:1.35rem}
        .lv-ai-response-body li{padding-left:2px;margin:3px 0}
        .lv-ai-response-body li::marker{color:#5eead4}
        .lv-ai-response-body strong{color:var(--text,#fff);font-weight:800}
        .lv-ai-response-body code{padding:2px 5px;border:1px solid rgba(148,163,184,.15);border-radius:5px;background:rgba(15,23,42,.35);font-size:.9em}
        .lv-ai-response-body a{color:#7dd3fc;text-decoration:underline;text-underline-offset:2px}
        @media(max-width:480px){.lv-ai-thinking-control{align-items:flex-start;flex-direction:column}.lv-ai-thinking-toggle{width:100%}}
      `;
      document.head.appendChild(style);
    }

    const control = document.createElement('div');
    control.setAttribute('class', 'lv-ai-thinking-control');
    const copy = document.createElement('div');
    copy.setAttribute('class', 'lv-ai-thinking-copy');
    copy.innerHTML = '<span class="lv-ai-thinking-title">Javob uslubi</span><span class="lv-ai-thinking-hint">Chuqur rejim ko‘proq vaqt va AI resursi talab qilishi mumkin.</span>';
    const button = document.createElement('button');
    button.setAttribute('class', 'lv-ai-thinking-toggle');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(getAIThinkingMode() === 'deep'));

    const updateButton = () => {
      const deep = getAIThinkingMode() === 'deep';
      button.setAttribute('aria-pressed', String(deep));
      button.innerHTML = `<i class="fa-solid ${deep ? 'fa-brain' : 'fa-bolt'}" aria-hidden="true"></i><span>${deep ? 'Juda chuqur' : 'Muvozanatli'}</span>`;
      button.title = deep
        ? 'Juda chuqur fikrlash yoqilgan. O‘chirish uchun bosing.'
        : 'Juda chuqur fikrlashni yoqish uchun bosing.';
    };
    button.addEventListener('click', () => {
      const next = getAIThinkingMode() === 'deep' ? 'balanced' : 'deep';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        button.title = 'Brauzer sozlamalari rejimni saqlashga ruxsat bermadi; u shu sahifada amal qiladi.';
        window.__lvAIThinkingMode = next;
      }
      updateButton();
    });
    updateButton();
    control.append(copy, button);
    area.insertBefore(control, target?.id === 'essay' ? target : area.firstChild);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
}
