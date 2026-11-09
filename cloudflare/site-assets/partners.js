/* LinguaVerse Cloudflare-only Partnership Growth Studio v2.
 * New working capabilities: UTM campaign links, copy/share, revenue simulator,
 * locally saved visual-brand draft and real server-side application status.
 * No fabricated payment processing, referral attribution or OAuth approval.
 */
import {auth} from '/js/lv-core.js';
import {onAuthStateChanged} from '/js/fb/firebase-auth.js';

const init = () => {
  if (!document.querySelector('#chips') || !document.querySelector('#application')) return;
  document.body.classList.add('lv-partner-page');
  const $ = id => document.getElementById(id);
  const chips = $('chips');
  const layout = document.querySelector('main .layout');
  if (!chips || !layout) return;

  chips.insertAdjacentHTML('beforebegin', `
    <section class="lv-p-strip" aria-label="Hamkorlik imkoniyatlari">
      <div class="lv-p-stat"><strong>7</strong><small>hamkorlik yo‘nalishi</small></div>
      <div class="lv-p-stat"><strong>8</strong><small>til yo‘nalishi</small></div>
      <div class="lv-p-stat"><strong>150</strong><small>har tilning asosiy darslari</small></div>
      <div class="lv-p-stat"><strong>60%</strong><small>taklif etilgan hamkor ulushi*</small></div>
    </section>`);
  chips.insertAdjacentHTML('afterend', `
    <section aria-labelledby="lv-p-benefit-title">
      <div class="lv-p-title"><div><h2 id="lv-p-benefit-title">Siz uchun nima foyda?</h2><p class="lv-p-intro" id="lv-p-benefit-intro">Hamkorlik turini tanlang — imkoniyatlar shu yerda o‘zgaradi.</p></div><span class="lv-p-badge">Hamkorlik studiyasi</span></div>
      <div id="lv-p-benefits" class="lv-p-benefits"></div>
    </section>`);

  layout.insertAdjacentHTML('afterend', `
    <section class="lv-p-tools" aria-label="Hamkorlik vositalari">
      <article class="lv-p-card" id="lv-p-earnings">
        <span class="lv-p-badge">Daromad modeli</span>
        <h3 style="margin-top:12px">Potensial daromad kalkulyatori</h3>
        <p>Hamkorlik savdolari bo‘yicha <strong>taxminiy</strong> 60/40 taqsimotni hisoblang.</p>
        <div class="lv-p-two-fields">
          <div><label for="lv-p-buyers">Tasdiqlangan savdolar soni</label><input id="lv-p-buyers" type="number" min="0" max="100000" value="30" inputmode="numeric"></div>
          <div><label for="lv-p-ticket">Bitta savdo (so‘m)</label><input id="lv-p-ticket" type="number" min="0" max="100000000" step="1000" value="80000" inputmode="numeric"></div>
        </div>
        <label for="lv-p-fees">Soliq, qaytarish va tranzaksiya xarajatlari (taxminiy %)</label>
        <input id="lv-p-fees" type="number" min="0" max="100" value="10" inputmode="decimal">
        <div class="lv-p-output" aria-live="polite"><div>Hamkor uchun taxminiy ulush</div><div id="lv-p-partner-total" class="lv-p-amount">—</div><small id="lv-p-platform-total"></small></div>
        <p class="lv-p-note">* Faqat simulyatsiya. To‘lov, hisob-kitob va ulush faqat imzolangan shartnomadan so‘ng. Avtomatik pul yechish hozir faol emas.</p>
      </article>
      <article class="lv-p-card" id="lv-p-campaign">
        <span class="lv-p-badge">Promo kampaniya</span>
        <h3 style="margin-top:12px">Kampaniya havolasi generatori</h3>
        <p>LinguaVerse’ni YouTube, Instagram, Telegram yoki saytingizda targ‘ib qilish uchun UTM havola yarating.</p>
        <div class="lv-p-two-fields"><div><label for="lv-p-channel">Kanal</label><select id="lv-p-channel"><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="telegram">Telegram</option><option value="website">Sayt</option></select></div><div><label for="lv-p-campaign-name">Kampaniya nomi</label><input id="lv-p-campaign-name" maxlength="50" value="linguaverse-partner" placeholder="my-campaign"></div></div>
        <label for="lv-p-url">Tayyor havola</label><input id="lv-p-url" readonly aria-label="Tayyor reklama havolasi">
        <div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" id="lv-p-copy">Havolani nusxalash</button><button type="button" id="lv-p-share">Ulashish</button></div>
        <div id="lv-p-share-result" class="lv-p-note" role="status"></div>
        <p class="lv-p-note">UTM — marketing manbasini belgilash usuli; bu havola hali avtomatik komissiya yoki savdoni kuzatmaydi. Komissiya uchun alohida atribusiya va shartnoma kerak.</p>
      </article>
    </section>
    <section class="lv-p-card" id="lv-p-status-section">
      <div class="lv-p-statusbox">
        <div><h3>Mening hamkorlik panelim</h3><p class="lv-p-note">Arizangiz holatini to‘g‘ridan-to‘g‘ri LinguaVerse serveridan olish.</p></div>
        <button type="button" id="lv-p-refresh">Holatni yangilash</button>
        <div id="lv-p-status" class="lv-p-statusline" role="status" aria-live="polite">Tizimga kirgach ariza holatini tekshirishingiz mumkin.</div>
      </div>
      <div class="lv-p-steps">
        <div class="lv-p-step"><span class="n">01</span><b>Ariza</b>Rasmiy nom, kontakt va hamkorlik yo‘nalishini kiriting.</div>
        <div class="lv-p-step"><span class="n">02</span><b>Avtomatik tekshiruv</b>YouTube / Instagram OAuth yoki DNS orqali tasdiqlash.</div>
        <div class="lv-p-step"><span class="n">03</span><b>O‘sish va natija</b>Promo kampaniyalar, brend sahifa va tasdiqlangan imtiyozlar.</div>
      </div>
    </section>`);

  const benefitCatalog = {
    brand: [
      ['🏷️','Brand Studio','Brend nomi, rang va shiorning jonli prevyusi.'],
      ['🌐','Tasdiqlangan sahifa','DNS TXT orqali domenni avtomatik tasdiqlash va partner URL.'],
      ['📣','Kampaniya havolalari','SMM manbasini bildiradigan UTM havolalar va ulashish.'],
      ['📐','Daromad rejasi','60/40 taklif asosida taxminiy ulush kalkulyatori.'],
      ['🛡️','Aniq qoidalar','Sof tushum, reklama oshkoraligi va brend xavfsizligi.'],
      ['🤝','B2B hamkorlik','Shartnomadan so‘ng ta’lim va brend distribusiyasi imkoniyati.']
    ],
    youtube: [
      ['🎬','YOUTUBER tarif','Rasmiy tasdiqdan keyin 8 tilda 150 tadan asosiy dars.'],
      ['🤖','AI modellari','Barcha modellarga belgilangan foydalanish limitlari.'],
      ['✅','Avtomatik audit','Google OAuth, 1000+ obunachi va dastlab 5 ta video.'],
      ['📅','Oylik talab','Har 30 kunda 3 ta yangi LinguaVerse videosi.'],
      ['🔗','Promo generator','Kampaniyalar uchun bepul UTM havolalar.'],
      ['📊','Holat paneli','Tasdiqlanish, faol vaqt va xatolik holatini ko‘rish.']
    ],
    instagram: [
      ['📱','Creator imtiyozi','Instagram Professional sahifalariga YOUTUBER dasturi.'],
      ['📈','Sahifa tekshiruvi','Meta OAuth va 10 000+ haqiqiy kuzatuvchi talabi.'],
      ['🎞️','Reels kampaniyasi','Dastlab 5 ta, keyin har oy 3 ta yangi e’lon.'],
      ['🔍','Avtomatik monitoring','Rasmiy API orqali mavjud dalillarni tekshirish.'],
      ['🔗','Promo havola','Instagram manbali kampaniya havolalari.'],
      ['✨','AI imkoniyatlari','Tasdiqdan so‘ng cheklangan foydalanish bilan barcha AI modellar.']
    ],
    school: [
      ['🏫','Ta’lim hamkorligi','Ta’lim markazi bilan kurslar tarqatishni rejalashtirish.'],
      ['🧑‍🏫','O‘qituvchi kanali','Kurslarni sinf va o‘quvchilar bilan targ‘ib qilish.'],
      ['🎯','Target havolalar','Kurslar uchun kampaniya UTM generatori.'],
      ['📊','Sotuv simulyatori','Kutilayotgan savdolar va ulushni oldindan baholash.'],
      ['🔏','Maxfiylik','O‘quvchi ma’lumotlariga rozilik asosida ishlash.'],
      ['🤝','Shartnoma modeli','Tasdiqlangan hamkor bilan alohida B2B kelishuv.']
    ],
    educator: [
      ['🎓','Ta’lim kontenti','Ekspert tavsiyalari va o‘quv kampaniyalari.'],
      ['📘','Kurs distribusiyasi','Darsga yo‘naltiruvchi promo havolalar.'],
      ['📋','Rasmiy ariza','O‘qituvchi yo‘nalishida hamkorlikka murojaat.'],
      ['🧩','Brend prevyusi','Ism va professional ranglarni sinab ko‘rish.'],
      ['📉','Raqamli reja','Kutilayotgan natijalarni kalkulyatorda baholash.'],
      ['🤝','Haqiqiy kelishuv','Daromad bo‘linishi shartnomadan keyin.']
    ],
    community: [
      ['🌐','Hamjamiyat','Til o‘rganuvchilarni birlashtiruvchi hamkorlik.'],
      ['💬','Ochiq kampaniyalar','Hamjamiyat ichida shaffof reklama.'],
      ['📣','Promo havolalar','Telegram va sayt uchun tayyor havolalar.'],
      ['🔐','Xavfsiz aloqa','Shaxsiy ma’lumotlarni minimal yig‘ish.'],
      ['🧑‍🤝‍🧑','O‘sish rejasi','Hamkorlik natijasini taxminiy hisoblash.'],
      ['📋','Ariza holati','Serverdan joriy holatni olish.']
    ],
    affiliate: [
      ['🔗','Yo‘naltirish','LinguaVerse uchun UTM promo havolalarini yaratish.'],
      ['📣','Marketing','Targ‘ibot kampaniyasini aniq nomlash.'],
      ['📊','Taxminiy ulush','Shartnomali hamkorlik uchun daromad modeli.'],
      ['🛡️','Oshkoralik','Hamkorlik reklamasi haqida auditoriyaga aytish.'],
      ['📋','Ariza','Referal hamkori sifatida ro‘yxatdan o‘tish.'],
      ['ℹ️','Muhim farq','UTM havola avtomatik pul hisoblamaydi; tasdiqlangan referal tizimi alohida.']
    ]
  };
  const renderBenefits = () => {
    const active = chips.querySelector('.chip.active')?.dataset.type || 'brand';
    const cards = benefitCatalog[active] || benefitCatalog.brand;
    const holder = $('lv-p-benefits');
    holder.replaceChildren(...cards.map(([icon, title, description]) => {
      const article = document.createElement('article');
      article.className = 'lv-p-benefit';
      const i = document.createElement('div');i.className = 'i';i.textContent = icon;
      const h = document.createElement('h3');h.textContent = title;
      const p = document.createElement('p');p.textContent = description;
      article.append(i,h,p);return article;
    }));
    if (active === 'youtube') $('lv-p-channel').value = 'youtube';
    if (active === 'instagram') $('lv-p-channel').value = 'instagram';
    updateUrl();
  };
  chips.addEventListener('click', e => {if (e.target.closest('button[data-type]')) queueMicrotask(renderBenefits);});

  const fmt = x => new Intl.NumberFormat('uz-UZ',{maximumFractionDigits:0}).format(x) + ' so‘m';
  function calculate() {
    const count = Math.max(0, Math.min(100000, Number($('lv-p-buyers').value) || 0));
    const price = Math.max(0, Math.min(100000000, Number($('lv-p-ticket').value) || 0));
    const expenses = Math.max(0, Math.min(100, Number($('lv-p-fees').value) || 0));
    const net = count * price * (1-expenses/100);
    $('lv-p-partner-total').textContent = fmt(Math.round(net*.6));
    $('lv-p-platform-total').textContent = 'Platforma uchun taxminiy ulush: ' + fmt(Math.round(net*.4));
  }
  ['lv-p-buyers','lv-p-ticket','lv-p-fees'].forEach(id => $(id).addEventListener('input',calculate));

  function updateUrl() {
    const url = new URL('/index.html',location.origin);
    const src = $('lv-p-channel').value;
    const campaign = ($('lv-p-campaign-name').value || 'linguaverse-partner')
      .toLowerCase().normalize('NFKD').replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50) || 'partner';
    url.searchParams.set('utm_source',src);
    url.searchParams.set('utm_medium','partner');
    url.searchParams.set('utm_campaign',campaign);
    $('lv-p-url').value = url.href;
  }
  ['lv-p-channel','lv-p-campaign-name'].forEach(id=>$(id).addEventListener('input',updateUrl));
  $('lv-p-copy').addEventListener('click',async () => {
    try {await navigator.clipboard.writeText($('lv-p-url').value);$('lv-p-share-result').textContent='✅ Havola nusxalandi.';}
    catch { $('lv-p-url').focus();$('lv-p-url').select();$('lv-p-share-result').textContent='Havolani Ctrl+C bilan nusxalang.'; }
  });
  $('lv-p-share').addEventListener('click',async () => {
    const url = $('lv-p-url').value;
    if (navigator.share) {
      try {await navigator.share({title:'LinguaVerse',text:'LinguaVerse bilan til o‘rganing!',url});}catch{}
    } else {
      try {await navigator.clipboard.writeText(url);$('lv-p-share-result').textContent='✅ Ulashish havolasi nusxalandi.';}
      catch { $('lv-p-url').focus();$('lv-p-url').select(); }
    }
  });

  // Save only non-sensitive visual brand preferences. Never store contacts, tokens or messages.
  const draftFields=['company','tagline','color'];
  try {
    const saved = JSON.parse(localStorage.getItem('lv-partner-brand-draft-v2')||'{}');
    for (const id of draftFields) if(typeof saved[id]==='string' && $(id) && saved[id].length < 160) {
      $(id).value = saved[id];
      $(id).dispatchEvent(new Event('input', {bubbles:true}));
    }
  } catch {}
  for (const id of draftFields) $(id)?.addEventListener('input',()=>{
    try {localStorage.setItem('lv-partner-brand-draft-v2', JSON.stringify(Object.fromEntries(draftFields.map(k=>[k,$(k)?.value || '']))));}catch{}
  });

  let currentUser = null;
  onAuthStateChanged(auth, u => {currentUser=u;});
  $('lv-p-refresh').addEventListener('click', async()=>{
    const target=$('lv-p-status');
    if (!currentUser) {target.textContent='Ariza holatini ko‘rish uchun avval hisobga kiring.';return;}
    $('lv-p-refresh').disabled=true;
    target.textContent='Serverdan holat olinmoqda…';
    try {
      const token=await currentUser.getIdToken();
      const res=await fetch('/.netlify/functions/partnership',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',idToken:token})});
      const data=await res.json();
      if (!res.ok) throw new Error(data.error || 'Holat olinmadi');
      const names={'not-applied':'Ariza hali topshirilmagan','pending-verification':'Tasdiq kutilmoqda','active-brand-site':'Brend sayti faol','active-creator':'YOUTUBER faol','paused-creator':'Creator huquqi vaqtincha to‘xtagan','requirements-not-met':'Talablar bajarilmagan','verification-retry':'Tekshiruv takrorlanadi'};
      const label=names[data.status]||String(data.status||'Noma’lum');
      const due=data.nextDueAt?.$t || data.nextDueAt;
      target.textContent = 'Holat: '+label+(data.reason?'\nSabab: '+data.reason:'')+
        (due?'\nKeyingi tekshiruv: '+new Date(due).toLocaleDateString('uz-UZ'):'')+
        (data.brandSlug?'\nBrend sahifasi: /languages-html/partners.html?brand='+encodeURIComponent(data.brandSlug):'');
    } catch(e) {target.textContent='❌ '+(e?.message||'Xatolik');}
    finally {$('lv-p-refresh').disabled=false;}
  });

  renderBenefits();calculate();updateUrl();
};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});else init();
