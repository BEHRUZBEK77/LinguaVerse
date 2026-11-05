const SKILLS = ['reading', 'writing', 'speaking', 'listening', 'grammar'];
const LEVEL_LABELS = {
  beginner: 'A1 beginner',
  elementary: 'A2 elementary',
  preintermediate: 'A2-B1 pre-intermediate',
  intermediate: 'B1 intermediate',
  upperintermediate: 'B2 upper-intermediate',
  advanced: 'C1 advanced',
  proficient: 'C2 proficient',
  principiante: 'A1 beginner',
  elemental: 'A2 elementary',
  preintermedio: 'A2-B1 pre-intermediate',
  intermedio: 'B1 intermediate',
  avanzado: 'C1 advanced'
};

function getWeakestSkill({ skills = {}, skillKeys = {} }) {
  const scores = SKILLS.map(skill => {
    const storedKey = skillKeys[skill] || skill;
    const score = Number(skills?.[storedKey]);
    return { skill, score: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0 };
  });
  scores.sort((left, right) => left.score - right.score);
  return { ...scores[0], hasAssessment: scores.some(item => item.score > 0) };
}

function buildRecommendation(input) {
  const weakest = getWeakestSkill(input);
  const levelKey = String(input.level || '').toLowerCase().replace(/[^a-z]/g, '');
  const level = LEVEL_LABELS[levelKey] || 'A1 beginner';
  const skillName = input.skillLabels?.[weakest.skill] || weakest.skill;
  const language = String(input.language || '').trim();
  const exam = String(input.exam || '').trim();
  const query = [language, skillName, 'language learning practice', level, exam]
    .filter(Boolean)
    .join(' ')
    .slice(0, 180);
  return { ...weakest, skillName, level, language, exam, query };
}

function addPlaceholder(grid, message, searchUrl) {
  const card = document.createElement('div');
  card.className = 'video-placeholder';
  const text = document.createElement('div');
  text.textContent = message;
  card.appendChild(text);
  if (searchUrl) {
    const link = document.createElement('a');
    link.href = searchUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'YouTube’da qidiruv natijalarini ko‘rish';
    link.style.cssText = 'display:inline-block;margin-top:12px;color:var(--accent);font-weight:700';
    card.appendChild(link);
  }
  grid.replaceChildren(card);
}

function renderVideos(grid, videos) {
  const fragment = document.createDocumentFragment();
  for (const video of videos) {
    const card = document.createElement('a');
    card.href = video.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.style.cssText = 'display:block;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:inherit;text-decoration:none';

    if (video.thumbnail) {
      const image = document.createElement('img');
      image.src = video.thumbnail;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.style.cssText = 'width:100%;height:160px;object-fit:cover';
      card.appendChild(image);
    }

    const content = document.createElement('div');
    content.style.cssText = 'padding:12px';
    const title = document.createElement('div');
    title.textContent = video.title;
    title.style.cssText = 'font-weight:700;font-size:.85rem;color:var(--text);margin-bottom:5px';
    const channel = document.createElement('div');
    channel.textContent = video.channel || 'YouTube';
    channel.style.cssText = 'font-size:.75rem;color:var(--text3)';
    content.append(title, channel);
    card.appendChild(content);
    fragment.appendChild(card);
  }
  grid.replaceChildren(fragment);
}

async function findSkillVideos(input, fetchImpl = globalThis.fetch) {
  const grid = document.getElementById('videosGrid');
  const button = document.querySelector('.find-video-btn');
  if (!grid) return;

  const recommendation = buildRecommendation(input);
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(recommendation.query)}`;
  if (!fetchImpl) {
    addPlaceholder(grid, 'Video qidiruv xizmati brauzerda ishlamayapti.', searchUrl);
    return;
  }

  if (button) {
    button.disabled = true;
    button.dataset.originalLabel ||= button.textContent;
    button.textContent = 'Zaif ko‘nikma uchun izlanmoqda...';
  }
  addPlaceholder(
    grid,
    recommendation.hasAssessment
      ? `${recommendation.skillName} — ${recommendation.score}/100. Mos videolar qidirilmoqda...`
      : `${recommendation.skillName} ko‘nikmasi bo‘yicha natija hali yo‘q; boshlang‘ich daraja uchun video qidirilmoqda...`
  );

  try {
    const response = await fetchImpl('/.netlify/functions/youtube-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: input.languageId,
        skill: recommendation.skill,
        level: recommendation.level,
        exam: recommendation.exam,
        score: recommendation.score
      })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'YouTube qidiruv xizmati ishlamadi.');

    const subtitle = document.getElementById('videoSubtitle');
    if (subtitle) {
      subtitle.textContent = recommendation.hasAssessment
        ? `Eng past natija: ${recommendation.skillName} (${recommendation.score}/100) · ${recommendation.level}`
        : `${recommendation.skillName} bo‘yicha boshlang‘ich mashqlar · ${recommendation.level}`;
    }
    if (data.videos?.length) {
      renderVideos(grid, data.videos);
    } else {
      addPlaceholder(
        grid,
        data.configured
          ? 'Bu ko‘nikma uchun mos YouTube videosi topilmadi.'
          : 'Jonli video kartalari uchun admin panelda YOUTUBE_API_KEY sozlang. Hozir qidiruv YouTube saytida ochiladi.',
        data.searchUrl || searchUrl
      );
    }
  } catch (error) {
    addPlaceholder(grid, `Video qidiruv natijalari olinmadi: ${error.message}`, searchUrl);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalLabel || 'AI video topsin';
    }
  }
}

export { buildRecommendation, findSkillVideos, getWeakestSkill };
