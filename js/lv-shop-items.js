// ═══════════════════════════════════════════════════════════════════════════
// lv-shop-items.js — MEGA DO'KON: 58 ta mahsulot
//
// O'z-o'zini o'rnatadi: sahifada <div id="lvMegaShop"></div> bo'lsa, shu
// yerga katalogni chizadi. Uslublar ham shu faylda.
//
// Xarid oqimi (hammasi ATOMIK, runTransaction ichida):
//   1. Foydalanuvchi coinini tekshiradi
//   2. Coinni ayiradi
//   3. users/{uid}/inventory/{itemId} ga buyum yozadi (soni oshadi)
//   4. Effektli buyum bo'lsa — user hujjatiga effekt maydonini yozadi
//
// Effekt maydonlari (boshqa sahifalar o'qishi uchun):
//   boostXpMult / boostXpUntil       — XP ko'paytirgich va muddati (ms)
//   boostCoinMult / boostCoinUntil   — Coin ko'paytirgich
//   streakFreezes                    — streak muzlatish soni
//   hintTickets / retryTickets / skipTickets — chiptalar
//   activeAvatar / activeFrame / activeTheme / activeTitle — bezaklar
// ═══════════════════════════════════════════════════════════════════════════

import { LV, db } from './lv-core.js';
import {
  doc, runTransaction, serverTimestamp, increment, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════════════════════════════
// KATALOG — 58 ta mahsulot, 8 toifa
// ═══════════════════════════════════════════════════════════════════════════
export const CATEGORIES = {
  boost:   { name: 'Boostlar',   fa: 'fa-bolt',          color: '#f5c842', desc: "XP va Coin ko'paytirgichlar" },
  streak:  { name: 'Streak',     fa: 'fa-fire',          color: '#f87171', desc: 'Kunlik zanjirni himoya qilish' },
  ticket:  { name: 'Chiptalar',  fa: 'fa-ticket',        color: '#22d3ee', desc: 'Dars va testlarda yordam' },
  avatar:  { name: 'Avatarlar',  fa: 'fa-masks-theater', color: '#a78bfa', desc: 'Profil qiyofasi' },
  frame:   { name: 'Ramkalar',   fa: 'fa-image',         color: '#60a5fa', desc: 'Avatar atrofidagi bezak' },
  theme:   { name: 'Mavzular',   fa: 'fa-palette',       color: '#34d399', desc: 'Sayt rang palitralari' },
  title:   { name: 'Unvonlar',   fa: 'fa-tag',           color: '#fbbf24', desc: 'Ism ostidagi maxsus yozuv' },
  mystery: { name: 'Sirli quti', fa: 'fa-gift',          color: '#f472b6', desc: 'Omadingizni sinang' }
};

// effect turlari: boost | counter | cosmetic | mystery
export const ITEMS = [
  // ── BOOSTLAR (10) ──
  { id: 'xp2_1h',      cat: 'boost', fa: 'fa-bolt',                 name: 'XP ×2 — 1 soat',      price: 120,  desc: '1 soat davomida barcha XP ikki baravar', effect: { type: 'boost', field: 'Xp', mult: 2, hours: 1 } },
  { id: 'xp2_24h',     cat: 'boost', fa: 'fa-star',                 name: 'XP ×2 — 24 soat',     price: 700,  desc: 'Butun kun XP ikki baravar', effect: { type: 'boost', field: 'Xp', mult: 2, hours: 24 } },
  { id: 'xp3_1h',      cat: 'boost', fa: 'fa-wand-magic-sparkles',  name: 'XP ×3 — 1 soat',      price: 300,  desc: '1 soat XP UCH baravar — sprint uchun', effect: { type: 'boost', field: 'Xp', mult: 3, hours: 1 } },
  { id: 'xp2_7d',      cat: 'boost', fa: 'fa-rocket',               name: 'XP ×2 — 7 kun',       price: 3200, desc: 'Bir hafta uzluksiz ikki baravar XP', effect: { type: 'boost', field: 'Xp', mult: 2, hours: 168 } },
  { id: 'coin2_1h',    cat: 'boost', fa: 'fa-coins',                name: 'Coin ×2 — 1 soat',    price: 150,  desc: '1 soat coin daromadi ikki baravar', effect: { type: 'boost', field: 'Coin', mult: 2, hours: 1 } },
  { id: 'coin2_24h',   cat: 'boost', fa: 'fa-sack-dollar',          name: 'Coin ×2 — 24 soat',   price: 800,  desc: 'Butun kun coin ikki baravar', effect: { type: 'boost', field: 'Coin', mult: 2, hours: 24 } },
  { id: 'coin3_1h',    cat: 'boost', fa: 'fa-money-bill-trend-up',  name: 'Coin ×3 — 1 soat',    price: 350,  desc: '1 soat coin UCH baravar', effect: { type: 'boost', field: 'Coin', mult: 3, hours: 1 } },
  { id: 'combo2_1h',   cat: 'boost', fa: 'fa-fire',                 name: 'Kombo ×2 — 1 soat',   price: 240,  desc: 'XP HAM Coin HAM ikki baravar', effect: { type: 'boost', field: 'Both', mult: 2, hours: 1 } },
  { id: 'combo2_24h',  cat: 'boost', fa: 'fa-meteor',               name: 'Kombo ×2 — 24 soat',  price: 1300, desc: 'Butun kun hammasi ikki baravar', effect: { type: 'boost', field: 'Both', mult: 2, hours: 24 } },
  { id: 'weekend2',    cat: 'boost', fa: 'fa-champagne-glasses',    name: 'Dam olish boosti',    price: 900,  desc: '48 soat XP va Coin ×2 — shanba-yakshanba uchun', effect: { type: 'boost', field: 'Both', mult: 2, hours: 48 } },

  // ── STREAK (6) ──
  { id: 'freeze1',     cat: 'streak', fa: 'fa-icicles',             name: 'Muzlatish ×1',        price: 200,  desc: "1 kun o'tkazib yuborsangiz streak saqlanadi", effect: { type: 'counter', field: 'streakFreezes', amount: 1 } },
  { id: 'freeze3',     cat: 'streak', fa: 'fa-snowflake',           name: 'Muzlatish ×3',        price: 500,  desc: "3 ta muzlatish — arzonroq to'plam", effect: { type: 'counter', field: 'streakFreezes', amount: 3 } },
  { id: 'freeze7',     cat: 'streak', fa: 'fa-igloo',               name: 'Muzlatish ×7',        price: 1000, desc: "Bir haftalik zaxira — ta'til uchun", effect: { type: 'counter', field: 'streakFreezes', amount: 7 } },
  { id: 'repair',      cat: 'streak', fa: 'fa-screwdriver-wrench',  name: "Streak ta'miri",      price: 800,  desc: 'Uzilgan streakni qayta tiklaydi (oxirgi 3 kun ichida)', effect: { type: 'counter', field: 'streakRepairs', amount: 1 } },
  { id: 'shield_we',   cat: 'streak', fa: 'fa-shield-halved',       name: 'Dam olish qalqoni',   price: 350,  desc: 'Shanba-yakshanba streak avtomatik saqlanadi', effect: { type: 'counter', field: 'weekendShields', amount: 1 } },
  { id: 'streak_ins',  cat: 'streak', fa: 'fa-file-shield',         name: "Sug'urta — 30 kun",   price: 1500, desc: '30 kun ichida bitta uzilish avtomatik tiklanadi', effect: { type: 'counter', field: 'streakInsurance', amount: 1 } },

  // ── CHIPTALAR (8) ──
  { id: 'hint5',       cat: 'ticket', fa: 'fa-lightbulb',           name: 'Maslahat ×5',         price: 100,  desc: 'Testda 5 marta yordam olish', effect: { type: 'counter', field: 'hintTickets', amount: 5 } },
  { id: 'hint20',      cat: 'ticket', fa: 'fa-tower-observation',   name: 'Maslahat ×20',        price: 320,  desc: "20 ta maslahat — tejamli to'plam", effect: { type: 'counter', field: 'hintTickets', amount: 20 } },
  { id: 'retry1',      cat: 'ticket', fa: 'fa-rotate-right',        name: 'Qayta urinish',       price: 80,   desc: 'Yiqilgan testni ballsiz qayta topshirish', effect: { type: 'counter', field: 'retryTickets', amount: 1 } },
  { id: 'retry5',      cat: 'ticket', fa: 'fa-recycle',             name: 'Qayta urinish ×5',    price: 320,  desc: '5 ta qayta urinish', effect: { type: 'counter', field: 'retryTickets', amount: 5 } },
  { id: 'skip1',       cat: 'ticket', fa: 'fa-forward-step',        name: "O'tkazib yuborish",   price: 150,  desc: "Qiyin mashqni o'tkazib, keyingisiga o'tish", effect: { type: 'counter', field: 'skipTickets', amount: 1 } },
  { id: 'double_next', cat: 'ticket', fa: 'fa-bullseye',            name: 'Keyingi dars ×2',     price: 130,  desc: 'Keyingi tugatilgan dars ikki baravar mukofot beradi', effect: { type: 'counter', field: 'doubleNextLesson', amount: 1 } },
  { id: 'second',      cat: 'ticket', fa: 'fa-clover',              name: 'Ikkinchi imkon',      price: 110,  desc: "Noto'g'ri javobdan keyin yana bir urinish", effect: { type: 'counter', field: 'secondChances', amount: 3 } },
  { id: 'exam_sim',    cat: 'ticket', fa: 'fa-file-pen',            name: 'Imtihon simulyatsiyasi', price: 400, desc: "IELTS/TOPIK uslubidagi to'liq sinov testi", effect: { type: 'counter', field: 'examTickets', amount: 1 } },

  // ── AVATARLAR (10) ──
  { id: 'av_fox',      cat: 'avatar', fa: 'fa-paw',                 name: 'Tulki',      price: 300,  desc: "Ayyor va tez o'rganuvchi", effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-paw' } },
  { id: 'av_owl',      cat: 'avatar', fa: 'fa-feather',             name: 'Boyqush',    price: 300,  desc: 'Donolik ramzi', effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-feather' } },
  { id: 'av_panda',    cat: 'avatar', fa: 'fa-otter',               name: 'Panda',      price: 350,  desc: "Xotirjam va qat'iyatli", effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-otter' } },
  { id: 'av_robot',    cat: 'avatar', fa: 'fa-robot',               name: 'Robot',      price: 400,  desc: 'Xatosiz mashina', effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-robot' } },
  { id: 'av_ninja',    cat: 'avatar', fa: 'fa-user-ninja',          name: 'Ninja',      price: 500,  desc: 'Jim, lekin samarali', effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-user-ninja' } },
  { id: 'av_astro',    cat: 'avatar', fa: 'fa-user-astronaut',      name: 'Astronavt',  price: 600,  desc: 'Yangi olamlarni ochuvchi', effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-user-astronaut' } },
  { id: 'av_wizard',   cat: 'avatar', fa: 'fa-hat-wizard',          name: 'Sehrgar',    price: 700,  desc: "So'z sehrini biladi", effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-hat-wizard' } },
  { id: 'av_dragon',   cat: 'avatar', fa: 'fa-dragon',              name: 'Ajdaho',     price: 1000, desc: 'Kuch va qudrat', effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-dragon' } },
  { id: 'av_phoenix',  cat: 'avatar', fa: 'fa-crow',                name: 'Feniks',     price: 1500, desc: 'Har safar kuchliroq qaytadi', effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-crow' } },
  { id: 'av_alien',    cat: 'avatar', fa: 'fa-user-secret',         name: 'Aliens',     price: 2000, desc: 'Boshqa sayyoradan kelgan poliglot', effect: { type: 'cosmetic', field: 'activeAvatar', value: 'fa-user-secret' } },

  // ── RAMKALAR (6) ──
  { id: 'fr_silver',   cat: 'frame', fa: 'fa-square',               name: 'Kumush ramka',   price: 400,  desc: 'Sokin va zamonaviy', effect: { type: 'cosmetic', field: 'activeFrame', value: 'silver' } },
  { id: 'fr_gold',     cat: 'frame', fa: 'fa-award',                name: 'Oltin ramka',    price: 900,  desc: 'Klassik hashamat', effect: { type: 'cosmetic', field: 'activeFrame', value: 'gold' } },
  { id: 'fr_neon',     cat: 'frame', fa: 'fa-star-of-life',         name: 'Neon ramka',     price: 1200, desc: 'Yorqin siyan nur', effect: { type: 'cosmetic', field: 'activeFrame', value: 'neon' } },
  { id: 'fr_fire',     cat: 'frame', fa: 'fa-fire-flame-curved',    name: 'Olov ramka',     price: 1500, desc: 'Yonayotgan chegara', effect: { type: 'cosmetic', field: 'activeFrame', value: 'fire' } },
  { id: 'fr_ice',      cat: 'frame', fa: 'fa-snowflake',            name: 'Muz ramka',      price: 1500, desc: 'Sovuq kristall', effect: { type: 'cosmetic', field: 'activeFrame', value: 'ice' } },
  { id: 'fr_royal',    cat: 'frame', fa: 'fa-crown',                name: 'Qirollik ramka', price: 2500, desc: 'Faqat eng yaxshilar uchun', effect: { type: 'cosmetic', field: 'activeFrame', value: 'royal' } },

  // ── MAVZULAR (6) ──
  { id: 'th_ocean',    cat: 'theme', fa: 'fa-water',                name: 'Okean',      price: 600, desc: "Chuqur ko'k palitra", effect: { type: 'cosmetic', field: 'activeTheme', value: 'ocean' } },
  { id: 'th_forest',   cat: 'theme', fa: 'fa-tree',                 name: "O'rmon",     price: 600, desc: 'Tinch yashil tuslar', effect: { type: 'cosmetic', field: 'activeTheme', value: 'forest' } },
  { id: 'th_sunset',   cat: 'theme', fa: 'fa-mountain-sun',         name: 'Shom',       price: 600, desc: 'Iliq apelsin-pushti', effect: { type: 'cosmetic', field: 'activeTheme', value: 'sunset' } },
  { id: 'th_galaxy',   cat: 'theme', fa: 'fa-meteor',               name: 'Galaktika',  price: 800, desc: 'Binafsha koinot', effect: { type: 'cosmetic', field: 'activeTheme', value: 'galaxy' } },
  { id: 'th_sakura',   cat: 'theme', fa: 'fa-fan',                  name: 'Sakura',     price: 800, desc: 'Yapon bahori', effect: { type: 'cosmetic', field: 'activeTheme', value: 'sakura' } },
  { id: 'th_mono',     cat: 'theme', fa: 'fa-circle-half-stroke',   name: 'Monoxrom',   price: 500, desc: "Faqat oq-qora, chalg'ituvchisiz", effect: { type: 'cosmetic', field: 'activeTheme', value: 'mono' } },

  // ── UNVONLAR (8) ──
  { id: 'ti_hunter',   cat: 'title', fa: 'fa-bullseye',             name: "So'z ovchisi",    price: 250,  desc: "1000+ so'z yodlaganlar unvoni", effect: { type: 'cosmetic', field: 'activeTitle', value: "So'z ovchisi" } },
  { id: 'ti_guru',     cat: 'title', fa: 'fa-ruler-combined',       name: 'Grammatika guru', price: 250,  desc: "Qoidalarni suv qilib ichgan", effect: { type: 'cosmetic', field: 'activeTitle', value: 'Grammatika guru' } },
  { id: 'ti_owl',      cat: 'title', fa: 'fa-moon',                 name: 'Tungi boyqush',   price: 200,  desc: "Yarim tundan keyin o'qiydiganlar", effect: { type: 'cosmetic', field: 'activeTitle', value: 'Tungi boyqush' } },
  { id: 'ti_bird',     cat: 'title', fa: 'fa-sun',                  name: 'Erta turuvchi',   price: 200,  desc: 'Tong saharlab dars qiladiganlar', effect: { type: 'cosmetic', field: 'activeTitle', value: 'Erta turuvchi' } },
  { id: 'ti_speed',    cat: 'title', fa: 'fa-wind',                 name: 'Chaqmoq',         price: 300,  desc: 'Darslarni yashin tezligida tugatadi', effect: { type: 'cosmetic', field: 'activeTitle', value: 'Chaqmoq' } },
  { id: 'ti_perfect',  cat: 'title', fa: 'fa-certificate',          name: 'Perfektsionist',  price: 400,  desc: 'Faqat 100% natijaga rozi', effect: { type: 'cosmetic', field: 'activeTitle', value: 'Perfektsionist' } },
  { id: 'ti_poly',     cat: 'title', fa: 'fa-earth-americas',       name: 'Poliglot',        price: 800,  desc: "3+ tilda o'qiyotganlar", effect: { type: 'cosmetic', field: 'activeTitle', value: 'Poliglot' } },
  { id: 'ti_legend',   cat: 'title', fa: 'fa-trophy',               name: 'AFSONA',          price: 3000, desc: 'Platformaning eng oliy unvoni', effect: { type: 'cosmetic', field: 'activeTitle', value: 'AFSONA' } },

  // ── SIRLI QUTILAR (4) ──
  { id: 'box_common',  cat: 'mystery', fa: 'fa-box',                name: 'Oddiy quti',      price: 150,  desc: '50–300 coin yoki kichik buyum', effect: { type: 'mystery', tier: 'common' } },
  { id: 'box_rare',    cat: 'mystery', fa: 'fa-gift',               name: 'Nodir quti',      price: 400,  desc: '150–800 coin yoki boost', effect: { type: 'mystery', tier: 'rare' } },
  { id: 'box_epic',    cat: 'mystery', fa: 'fa-box-open',           name: 'Epik quti',       price: 900,  desc: '400–2000 coin yoki qimmat buyum', effect: { type: 'mystery', tier: 'epic' } },
  { id: 'box_legend',  cat: 'mystery', fa: 'fa-rainbow',            name: 'Afsonaviy quti',  price: 2000, desc: "1000–5000 coin yoki eng zo'r buyumlar", effect: { type: 'mystery', tier: 'legendary' } }
];

const MYSTERY_COINS = {
  common:    [50, 300],
  rare:      [150, 800],
  epic:      [400, 2000],
  legendary: [1000, 5000]
};

// ═══════════════════════════════════════════════════════════════════════════
// XARID — atomik va xavfsiz
// ═══════════════════════════════════════════════════════════════════════════
export async function buyItem(itemId) {
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return { ok: false, message: 'Buyum topilmadi' };

  const snap = await LV.ready();
  if (!snap.signedIn) {
    return { ok: false, message: 'Xarid uchun tizimga kiring', needAuth: true };
  }

  const uid = snap.uid;
  const userRef = doc(db, 'users', uid);
  const invRef = doc(db, 'users', uid, 'inventory', item.id);

  try {
    const result = await runTransaction(db, async tx => {
      const u = await tx.get(userRef);
      if (!u.exists()) throw new Error('Profil topilmadi');

      const coins = u.data().coins || 0;
      if (coins < item.price) {
        const err = new Error(`Coin yetmaydi: ${coins}/${item.price}`);
        err.code = 'NO_COINS';
        err.have = coins;
        throw err;
      }

      // Bezak allaqachon sotib olinganmi? (bir marta yetadi)
      const inv = await tx.get(invRef);
      if (item.effect.type === 'cosmetic' && inv.exists()) {
        const err = new Error('Bu buyum sizda allaqachon bor');
        err.code = 'OWNED';
        throw err;
      }

      const patch = { coins: coins - item.price, lastActive: serverTimestamp() };
      const fx = item.effect;
      let bonus = null;

      if (fx.type === 'boost') {
        const until = Date.now() + fx.hours * 3600_000;
        if (fx.field === 'Xp' || fx.field === 'Both') {
          patch.boostXpMult = fx.mult;
          patch.boostXpUntil = until;
        }
        if (fx.field === 'Coin' || fx.field === 'Both') {
          patch.boostCoinMult = fx.mult;
          patch.boostCoinUntil = until;
        }
      } else if (fx.type === 'counter') {
        patch[fx.field] = (u.data()[fx.field] || 0) + fx.amount;
      } else if (fx.type === 'cosmetic') {
        patch[fx.field] = fx.value;
      } else if (fx.type === 'mystery') {
        // Sirli quti: coin yutug'i shu yerning o'zida
        const [lo, hi] = MYSTERY_COINS[fx.tier];
        bonus = lo + Math.floor(Math.random() * (hi - lo + 1));
        patch.coins = coins - item.price + bonus;
      }

      tx.update(userRef, patch);

      tx.set(invRef, {
        itemId: item.id,
        name: item.name,
        fa: item.fa,
        cat: item.cat,
        price: item.price,
        qty: increment(1),
        boughtAt: serverTimestamp()
      }, { merge: true });

      return { bonus, newCoins: patch.coins };
    });

    return {
      ok: true,
      item,
      newCoins: result.newCoins,
      bonus: result.bonus,
      message: (result.bonus !== null && result.bonus !== undefined)
        ? `Qutidan ${result.bonus} coin chiqdi!`
        : `${item.name} sotib olindi!`
    };

  } catch (e) {
    if (e.code === 'NO_COINS') {
      return { ok: false, message: `Coin yetmaydi (sizda ${e.have}, kerak ${item.price}). Darslarni tugatib coin yig'ing!` };
    }
    if (e.code === 'OWNED') {
      return { ok: false, message: 'Bu buyum sizda allaqachon bor.' };
    }
    console.error('[shop]', e);
    return { ok: false, message: 'Xarid amalga oshmadi: ' + (e.code || e.message) };
  }
}

/** Foydalanuvchi inventarini o'qiydi. */
export async function loadInventory() {
  const snap = await LV.ready();
  if (!snap.signedIn) return {};
  try {
    const qs = await getDocs(collection(db, 'users', snap.uid, 'inventory'));
    const out = {};
    qs.forEach(d => { out[d.id] = d.data(); });
    return out;
  } catch { return {}; }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI — o'zini #lvMegaShop ichiga chizadi
// ═══════════════════════════════════════════════════════════════════════════
const CSS = `
#lvMegaShop { margin: 30px 0 40px; font-family:'DM Sans',system-ui,sans-serif; }
#lvMegaShop .ms-head { text-align:center; margin-bottom:22px; }
#lvMegaShop .ms-title { font-size:1.6rem; font-weight:800; }
#lvMegaShop .ms-title span { background:linear-gradient(135deg,#4f6ef7,#a78bfa,#f5c842); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
#lvMegaShop .ms-sub { color:#7580a8; font-size:.85rem; margin-top:4px; }
#lvMegaShop .ms-coins { display:inline-flex; align-items:center; gap:7px; margin-top:12px; background:rgba(245,200,66,.1); border:1px solid rgba(245,200,66,.3); border-radius:100px; padding:6px 16px; font-weight:800; color:#f5c842; font-size:.95rem; }
#lvMegaShop .ms-cats { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:20px; }
#lvMegaShop .ms-cat { display:inline-flex; align-items:center; gap:7px; padding:8px 15px; border-radius:100px; background:rgba(255,255,255,.03); border:1.5px solid rgba(255,255,255,.08); color:#e8ecff; font-size:.8rem; font-weight:700; cursor:pointer; transition:all .15s; font-family:inherit; }
#lvMegaShop .ms-cat:hover { border-color:rgba(255,255,255,.25); transform:translateY(-1px); }
#lvMegaShop .ms-cat b { font-size:.7rem; opacity:.6; font-weight:800; }
#lvMegaShop .ms-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(205px,1fr)); gap:12px; }
#lvMegaShop .ms-item { position:relative; overflow:hidden; background:rgba(11,15,30,.7); border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:16px; display:flex; flex-direction:column; gap:8px; transition:transform .15s, border-color .15s, box-shadow .15s; }
#lvMegaShop .ms-item::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:var(--ic); opacity:.55; }
#lvMegaShop .ms-item:hover { transform:translateY(-3px); border-color:var(--ic); }
#lvMegaShop .ms-item.owned { opacity:.6; }
#lvMegaShop .ms-ic { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; font-size:1.25rem; color:var(--ic); background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); }
#lvMegaShop .ms-nm { font-weight:800; font-size:.92rem; }
#lvMegaShop .ms-ds { color:#7580a8; font-size:.75rem; line-height:1.45; flex:1; }
#lvMegaShop .ms-buy { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:4px; }
#lvMegaShop .ms-pr { font-weight:800; color:#f5c842; font-size:.9rem; white-space:nowrap; }
#lvMegaShop .ms-btn { padding:8px 16px; border-radius:10px; border:none; background:#4f6ef7; color:#fff; font-weight:700; font-size:.78rem; cursor:pointer; font-family:inherit; transition:background .15s, opacity .15s; }
#lvMegaShop .ms-btn:hover:not(:disabled) { background:#5f7bff; }
#lvMegaShop .ms-btn:disabled { opacity:.5; cursor:not-allowed; }
#lvMegaShop .ms-btn.owned { background:rgba(52,211,153,.15); color:#34d399; }
.ms-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#0b0f1e; border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:13px 22px; font-weight:700; font-size:.88rem; z-index:600; box-shadow:0 16px 50px rgba(0,0,0,.6); font-family:'DM Sans',system-ui,sans-serif; animation:msPop .25s ease; }
@keyframes msPop { from { opacity:0; transform:translate(-50%,12px);} to { opacity:1; transform:translate(-50%,0);} }
`;

let currentCat = 'all';
let inventory = {};
let userCoins = 0;

function toast(msg, color = '#e8ecff') {
  document.querySelectorAll('.ms-toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'ms-toast';
  t.style.color = color;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function render(root) {
  const cats = Object.entries(CATEGORIES);
  const items = currentCat === 'all' ? ITEMS : ITEMS.filter(i => i.cat === currentCat);

  root.innerHTML = `
    <div class="ms-head">
      <div class="ms-title"><i class="fa-solid fa-bag-shopping"></i> <span>Mega Do'kon</span></div>
      <div class="ms-sub">${ITEMS.length} ta buyum · Coinlarni darslarda yig'asiz</div>
      <div class="ms-coins"><i class="fa-solid fa-coins"></i> <span id="msCoins">${userCoins.toLocaleString()}</span> coin</div>
    </div>
    <div class="ms-cats">
      <button class="ms-cat ${currentCat === 'all' ? 'on' : ''}" data-cat="all"
              style="${currentCat === 'all' ? 'border-color:#4f6ef7;background:rgba(79,110,247,.12);color:#93a9ff' : ''}">
        <i class="fa-solid fa-border-all"></i> Hammasi <b>${ITEMS.length}</b>
      </button>
      ${cats.map(([id, c]) => `
        <button class="ms-cat" data-cat="${id}"
                style="${currentCat === id ? `border-color:${c.color};background:${c.color}1a;color:${c.color}` : ''}">
          <i class="fa-solid ${c.fa}" style="color:${c.color}"></i> ${c.name}
          <b>${ITEMS.filter(i => i.cat === id).length}</b>
        </button>`).join('')}
    </div>
    <div class="ms-grid">
      ${items.map(i => {
        const owned = i.effect.type === 'cosmetic' && inventory[i.id];
        const c = CATEGORIES[i.cat];
        return `
        <div class="ms-item ${owned ? 'owned' : ''}" style="--ic:${c.color}">
          <div class="ms-ic"><i class="fa-solid ${i.fa || c.fa}"></i></div>
          <div class="ms-nm">${i.name}</div>
          <div class="ms-ds">${i.desc}</div>
          <div class="ms-buy">
            <span class="ms-pr"><i class="fa-solid fa-coins"></i> ${i.price.toLocaleString()}</span>
            ${owned
              ? `<button class="ms-btn owned" disabled><i class="fa-solid fa-check"></i> Sizda bor</button>`
              : `<button class="ms-btn" data-buy="${i.id}">Olish</button>`}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  root.querySelectorAll('[data-cat]').forEach(b => {
    b.onclick = () => { currentCat = b.dataset.cat; render(root); };
  });

  root.querySelectorAll('[data-buy]').forEach(b => {
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = '...';

      const res = await buyItem(b.dataset.buy);

      if (res.ok) {
        userCoins = res.newCoins;
        if (res.item.effect.type === 'cosmetic') inventory[res.item.id] = true;
        toast(res.message, '#34d399');
        render(root);
      } else {
        toast(res.message, res.needAuth ? '#f5c842' : '#f87171');
        if (res.needAuth) setTimeout(() => location.href = '../auth/login.html', 1400);
        b.disabled = false;
        b.textContent = 'Olish';
      }
    };
  });
}

// ── O'RNATISH ──
(async () => {
  const root = document.getElementById('lvMegaShop');
  if (!root) return;   // bu sahifada do'kon yo'q

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  root.innerHTML = `<div style="text-align:center;color:#7580a8;padding:30px">Do'kon yuklanmoqda...</div>`;

  const snap = await LV.ready();
  userCoins = snap.profile?.coins || 0;
  inventory = await loadInventory();

  // Coin o'zgarsa yangilab turamiz
  LV.onChange(s => {
    const c = s.profile?.coins;
    if (typeof c === 'number' && c !== userCoins) {
      userCoins = c;
      const el = document.getElementById('msCoins');
      if (el) el.textContent = c.toLocaleString();
    }
  });

  render(root);
  console.log("[shop] Mega Do'kon: " + ITEMS.length + ' ta buyum yuklandi');
})();

export default { ITEMS, CATEGORIES, buyItem, loadInventory };
