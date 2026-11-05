# 🌍 LinguaVerse – AI Yordamida Til O‘rganish Platformasi

## 📖 Loyiha haqida

LinguaVerse — bu sun’iy intellekt (AI) yordamida ishlovchi zamonaviy til o‘rganish platformasi. Platforma foydalanuvchilarga yangi tillarni interaktiv darslar, AI bilan suhbat, testlar va shaxsiylashtirilgan o‘quv dasturi orqali samarali o‘rganish imkonini beradi.

## 🌐 Platforma havolasi

https://linguaverce.netlify.app

## 🚀 Asosiy imkoniyatlar

* 🤖 AI yordamida til o‘rgatish
* 💬 Real vaqt rejimida AI bilan suhbat
* 📚 Interaktiv darslar
* 📝 Aqlli test va mashqlar
* 🔊 Talaffuzni yaxshilash imkoniyati
* 📊 O‘quv jarayonini kuzatish
* 🎯 Shaxsiylashtirilgan o‘quv rejalari
* 📱 Barcha qurilmalarga mos dizayn

## 🌍 Mavjud kurs tillari

Kurslar va 3D dunyodagi AI suhbatlarida quyidagi 8 til mavjud:

* 🇬🇧 Ingliz tili
* 🇷🇺 Rus tili
* 🇪🇸 Ispan tili
* 🇩🇪 Nemis tili
* 🇹🇷 Turk tili
* 🇸🇦 Arab tili
* 🇰🇷 Koreys tili
* 🇨🇳 Xitoy tili

3D dunyoning hozirgi statik lug‘ati va ibora vazifalari ingliz tilida; boshqa tillar NPC suhbatida mashq qilinadi.

## 🧠 AI imkoniyatlari

Sun’iy intellekt quyidagi vazifalarni bajaradi:

* Grammatik xatolarni aniqlash va tuzatish
* So‘z boyligini oshirish
* Matn yozishni rivojlantirish
* Tabiiy suhbat muhitini yaratish
* O‘quvchining darajasiga moslashish
* Shaxsiy tavsiyalar berish

## 🎯 Maqsad

LinguaVerse foydalanuvchilarga chet tillarini tez, qulay va zamonaviy usulda o‘rganish imkoniyatini yaratish uchun ishlab chiqilgan. Platforma nazariy bilimlarni amaliy mashg‘ulotlar bilan birlashtirib, haqiqiy muloqot ko‘nikmalarini rivojlantirishga yordam beradi.

## 🛠 Foydalanilgan texnologiyalar

* HTML5
* CSS3
* JavaScript
* AI Texnologiyalari
* Responsive Web Design

## 🖥️ Kompyuter va Android ilovalari

Windows, macOS, Linux va Android paketlari GitHub Actions orqali bir xil sayt manzilini ochadigan native qobiq sifatida yig‘iladi. Hisob, darslar va progress saytning Firebase loyihasi bilan bir xil; ilovada internet kerak.

- Saytdagi **Ilovani yuklab olish** sahifasi: `downloads.html`
- Yangi reliz yaratish: versiyani yangilang, `v*` tegi qo‘ying va GitHub’ga yuboring (masalan, `v2.1.0`).
- CI Windows o‘rnatuvchi `.exe`, universal macOS `.dmg`, Linux `.AppImage` va Android `.apk` ni GitHub Release’ga chiqaradi.
- Release workflow yuklab olish manifestini asosiy tarmoqqa yozadi; Netlify shu tarmoqdan avtomatik deploy qilsa, yangi havolalar saytda paydo bo‘ladi.
- Windows/macOS buildlar hozircha kod imzosiz; Android APK GitHub Actions debug-signing kaliti bilan imzolanadi va Play Store relizi emas.
- Android native shell Google login uchun Firebase redirect oqimini ishlatadi. Firebase Console’da `linguaverce.netlify.app` Authorized domains ro‘yxatida bo‘lishi kerak.

Mahalliy desktop build: `npm ci`, keyin `npm run desktop:dist` (joriy OS uchun). Android build uchun Android SDK/JDK hamda `npx cap sync android` talab qilinadi.

## 🗄️ Baza: Supabase (Firebase'dan ko'chirilgan)

Sayt endi **Supabase**'da ishlaydi (loyiha `linguaverse`, Frankfurt). Firestore hujjatlari aynan o'sha yo'llar bilan (`users/{uid}`, `orders/{id}` ...) Supabase'dagi `docs` jadvalida saqlanadi. Sahifalar `js/fb/firebase-*.js` dan import qiladi — bu modullar Firebase API'sini beradi, ichida esa Supabase ishlaydi. Xavfsizlik qoidalari (firestore.rules ning SQL nusxasi): `supabase/migrations/001_docs_store.sql`.

**Eski foydalanuvchilar** hech narsa sezmaydi: email/parol bilan kirganda parol eski Firebase hisobida tekshirilib, Supabase'ga o'tkaziladi; Google bilan kirganlar email bo'yicha eski uid'ga bog'lanadi — barcha tarif, coin va progress joyida.

**O'tish tartibi:**
1. Netlify env'ga qo'shing: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIGRATION_SECRET` (Firebase env'larini hozircha o'chirmang).
2. Supabase → Authentication → URL Configuration: Site URL = `https://linguaverce.netlify.app`, Redirect URLs = `https://linguaverce.netlify.app/**`.
3. Supabase → Authentication → Providers: **Google** ni yoqing (Google Cloud OAuth client ID/secret) va **Anonymous sign-ins** ni yoqing (ovozli xonalar uchun).
4. Saytni deploy qiling va darhol `/admin/migrate.html` ni ochib, maxfiy so'zni kiriting → "Ko'chirishni boshlash".
5. Parolni tiklash xatlari eski hisoblar uchun Firebase orqali ketadi; yangi hisoblar uchun Supabase → Authentication → SMTP Settings'da o'z pochta xizmatingizni ulang (standart Supabase pochtasi faqat jamoa a'zolariga yuboradi).

## 🎓 IELTS imtihonchi, AI ustoz va video kurslar

| Sahifa | Nima qiladi |
|---|---|
| `languages-html/ielts-examiner.html` | IELTS Speaking mock test (Part 1, 2, 3) va "Qattiq ustoz" mashqi. Ustoz emotsiya bilan gapiradi (jahli chiqadi, maqtaydi, kuladi), xatoni tuzatadi, oxirida 4 mezon bo'yicha band ball beradi. 8 tilda, har tilga alohida ustoz va ovoz. |
| `languages-html/courses.html` | AI video kurslar: har til uchun B2 (200 000 so'm) va C2 (400 000 so'm, B2 ham ichida). Ssenariy, slaydlar, subtitr va ovoz AI tomonidan yaratiladi va keshlanadi. Test serverda tekshiriladi. |
| `certificate.html?id=...` | Kurs sertifikati — ochiq tekshiriladi, PDF ga chop etiladi. |
| Admin → **Onlayn to'lovlar (inPAY)** | inPAY buyurtmalari, webhook kelmagan to'lovni qo'lda tasdiqlash, naqd/Click to'lovi uchun reja yoki kursni qo'lda yoqish, avto-to'lovni hozir ishga tushirish. |

**Narxlar:** IELTS PRO obunasi oyiga 200 000 so'm (avto-to'lov bilan). Narxlar `netlify/functions/_plans.js` (server) va `js/lv-core.js` / `js/course-catalog.mjs` (brauzer) da bir xil turishi shart: `node scripts/check-plan-sync.js`.

**Sozlash:**
1. Admin panel → API Kalitlar: `ELEVENLABS_API_KEY` (ixtiyoriy: `ELEVENLABS_MODEL=eleven_v3`, har til uchun `ELEVENLABS_VOICE_EN/RU/...`).
2. inPAY: `INPAY_MERCHANT_ID`, `INPAY_BEARER_TOKEN`, `INPAY_WEBHOOK_SECRET`, sinov tugagach `INPAY_SANDBOX` ni o'chiring.
3. Firestore qoidalarini yangilang: `firestore.rules` ni Firebase Console → Firestore → Rules ga joylang.
4. (Tavsiya) Netlify'da funksiya taymautini 26 s ga oshiring va `FUNCTION_TIMEOUT_MS=26000` qo'ying — IELTS baholashda eng kuchli modellar ishlaydi.

**Bepul speaking cheklovi:** IELTS PRO / PREMIUM bo'lmagan foydalanuvchi AI ustoz bilan jami 5 daqiqa gaplashadi, keyin 5 kunga yopiladi. Vaqt serverda (`speakQuota/{uid}`) hisoblanadi — sahifani yangilash yoki qayta boshlash hisobni nolga tushirmaydi.

**150 ta dars har til uchun:** B2 kursi (200 000 so'm) — A1, A2, B1, B2 darajalari, har birida 25 tadan, jami 100 dars. C2 kursi (400 000 so'm) — C1 va C2 (50 dars) + B2 kursi ichida = 150 dars. Ro'yxat: `js/course-catalog.mjs`.

**Video fabrika (AI o'zi yaratadi):** `.github/workflows/render-videos.yml` har 6 soatda 8 tilni parallel ishga tushiradi va hali MP4 i yo'q darslarni navbat bilan yaratadi (8 × 150 = 1200 video). Holatni admin panel → **Video fabrika** da ko'rasiz. "Hozir ishga tushirish" tugmasi uchun Netlify'ga `GITHUB_TOKEN` (fine-grained token, shu repo uchun "Actions: Read and write") va `GITHUB_REPO` (masalan `foydalanuvchi/LinguaVerse`) qo'shing.
⚠️ Xarajat: bitta dars ~2 500–4 000 belgi ovoz. 1200 dars ≈ 3–5 mln belgi ElevenLabs'da (Creator/Pro tarifi yetmaydi — Scale yoki Business kerak, yoki darslarni bosqichma-bosqich yarating). GitHub Actions: ochiq (public) repo'da bepul va cheksiz; yopiq (private) repo'da oyiga 2000 daqiqa bepul — bu ~150–200 videoga yetadi.

**Haqiqiy MP4 video darslar:** `scripts/render-lesson-video.mjs` AI darsini 1080p MP4 ga montaj qiladi (kirish kartochkasi, ustoz avatari lip-sync bilan, slaydlar, ikki tilli subtitr, yakuniy lug'at) va Firebase Storage'ga yuklaydi. Qo'lda: `node scripts/render-lesson-video.mjs --lang english --level b2 --lessons 0-9 --upload` yoki GitHub → Actions → **Video fabrika** (Secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`). MP4 tayyor bo'lgan darsda sayt pleyeri avtomatik videoni ko'rsatadi (3 soatlik imzolangan havola orqali — havola tarqatib yuborilsa ham tez eskiradi). MP4 hali yo'q darslar «MP4 hali tayyor emas» holati bilan interaktiv pleyerda ochiladi.

Ustoz qattiq, lekin so'kinmaydi va haqorat qilmaydi — bu qoida serverdagi promptda belgilangan. Band ball — tayyorgarlik ko'rsatkichi, rasmiy IELTS natijasi emas.

## 📈 Kelajakdagi rejalar

* Yangi tillarni qo‘shish
* Ovozli AI suhbatlar
* Android ilovasini Play Store’da chiqarish
* O‘quvchilar reyting tizimi
* Batafsil statistika paneli

## 📄 Litsenziya

Ushbu loyiha ta'limiy maqsadlarda ishlab chiqilgan.

---

### 🚀 LinguaVerse – Tillarni AI bilan o‘rganing!


## Ona tili, AI va MP4 darslar — v3

- Barcha ochiq sahifalarda **Til sozlamalari** bor. 9 ona tili (uz, en, ru, es, de, tr, ar, ko, zh) va 8 o‘rganiladigan til alohida tanlanadi. Tanlov qurilmada, tizimga kirilganda esa foydalanuvchi profilida saqlanadi. Arabcha interfeys o‘ngdan chapga ko‘rsatiladi.
- `js/learning-language.js` brauzer va server uchun umumiy ruxsat etilgan tillar ro‘yxati. AI, eski Groq/Gemini adapterlari, AI Coach, imtihonchi va kurs so‘rovlariga ona tili uzatiladi. Izohlar ona tilida, misollar o‘rganilayotgan tilda bo‘ladi.
- Sozlamalar oynasi va asosiy yangi boshqaruvlar 9 tilda tayyor. Eski sahifalarning qolgan statik interfeys matnlari `site-translations` orqali tarjima qilinib, bazada va joriy brauzer seansida keshlanadi. Xizmat sozlanmagan yoki ishlamasa, asl matn saqlanadi va qayta urinish xabari chiqadi. Bu holatda butun sayt tarjima qilingan hisoblanmaydi.
- Tarjimon faqat `locales/ui-source.json` dagi ommaviy matn identifikatorlarini qabul qiladi; yozilgan chat, forma qiymatlari va foydalanuvchi ma’lumotlari tarjima uchun yuborilmaydi. O‘rganilayotgan tildagi mashq matnlari interfeys tarjimasidan ajratilgan. UI matni o‘zgarsa: `python scripts/build-ui-catalog.py`.
- Kursning 150 mavzusi va xarid/progress huquqlari saqlangan. Yangi ssenariylar 10–12 sahna, ona tilidagi ovozli izoh (`say_native`), maqsad tilidagi misol, mustaqil mashq uchun pauza, lug‘at, yozma/og‘zaki uy vazifasi va server tekshiradigan testdan iborat. Har bir ona tili uchun dars, audio va MP4 alohida keshlanadi (`courseLessons/v3_<native>_<target>_<level>_<index>`). Eski v2 videolar o‘chirilmaydi; yangi tizimga avtomatik yangi video sifatida ko‘rsatilmaydi.
- Pleyer haqiqiy MP4 uchun bo‘limlarga o‘tish, ikki til subtitr treklarini tanlash, standart tezlik/to‘liq ekran boshqaruvlari va yuklanish xatosida qayta urinish yoki interaktiv darsga o‘tishni qo‘llaydi. MP4 bo‘lmagan dars tayyor video sifatida belgilanmaydi.

### Hozirgi haqiqiy namuna

`media/lessons/uz_english_b2_02.mp4`: A1 **Salomlashish va o‘zingizni tanishtirish**, 3:56, H.264/AAC, 1920×1080, 12 fps. Inglizcha Windows ovozi va o‘zbekcha izoh/subtitrlar bilan mahalliy namuna; bu namuna o‘zbekcha ovozli izohga ega emas. Ishlab chiqarish renderi odatda 25 fps va sozlangan ElevenLabs/Azure ovozidan foydalanadi. Namuna kurs sahifasida hisobga kirmasdan ochiladi. Barcha 150/1200 video bu lokal nusxada tayyor emas.

### Barcha darslarni yaratish

Serverdagi Supabase, AI va ovoz xizmatlari hamda Firebase Storage uchun xizmat hisobi sozlanishi kerak. GitHub workflow endi `SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY` secretlarini ham oladi. Admin → Video fabrika oynasida **ona tilini** tanlang. Avtomatik jadval xarajatni keskin ko‘paytirmaslik uchun faqat o‘zbekcha nashrni davom ettiradi; boshqa ona tillari qo‘lda tanlanadi. Bir xil ona/maqsad tili juftligi yaratilmaydi. Har nashr alohida hisoblanadi.

```sh
node scripts/render-lesson-video.mjs --lang german --native ru --level b2 --lessons 0-2 --upload
node scripts/render-lesson-video.mjs --auto --langs all --native uz --batch 15
```

Ssenariy va tarjima so‘rovlari uchun funksiya ishlash muddatini kamida 26 soniyaga sozlang. To‘liq yangi ssenariy yaratilishi eski qisqa darsga qaraganda uzoqroq davom etishi mumkin. Videoni yaratish narxi tanlangan ona tili nashrlari va ikki tildagi ovoz hajmiga bog‘liq.

Lokal render: Node, Playwright/Chromium, ffmpeg va ffprobe kerak. `FFMPEG_PATH`, `FFPROBE_PATH`, `PLAYWRIGHT_MODULE`, `CHROME_PATH` bilan mahalliy yo‘llarni ko‘rsatish mumkin. Windows ovozi bilan server kalitlarisiz namunani qayta yaratish:

```sh
node scripts/render-lesson-video.mjs --json scripts/samples/english_a1_greetings.json --lang english --native uz --level b2 --n 1 --tts windows --fps 12 --out media/lessons
```

Tekshiruv: `npm run check`, `npm test`. Mahalliy server 5511 portida ishlaganda `node scripts/learning-flow.browser.mjs` tanlov saqlanishi, AI tanlovi, mobil RTL, MP4 ijro/seek, subtitr, bo‘limlar, xato holati va byte-range javobini tekshiradi (Playwright kerak). Bu tekshiruv serverdagi haqiqiy AI/ovoz generatsiyasi yoki pullik kurs huquqlarining ishlab turgan hisob bilan yakuniy sinovini almashtirmaydi.

## Bepul video rejimi (standart)

30 daqiqalik MP4 darslar pul sarflamasdan ishlab chiqariladi:

| Qism | Bepul yechim |
|---|---|
| Dars matni | Gemini / Groq bepul kalitlari |
| Ovoz | Azure Speech bepul F0 tarifi — oyiga 500 000 belgi (`TTS_MONTHLY_CHARS=450000`, ≈18 ta dars) |
| Video yig'ish | GitHub Actions ("Video fabrika"), public repo — bepul |
| Saqlash | Cloudflare R2 — 10 GB bepul, ko'rish trafigi bepul (`R2_*` sozlamalari) |

* **Avto-video:** o'quvchi darsni ochishi bilan shu BITTA darsning MP4 i GitHub'da yasala boshlaydi (~40 daqiqa); shu orada interaktiv dars ishlaydi, keyingi ochishda video tayyor. Netlify'da `GITHUB_TOKEN` (faqat shu repo, Actions: Read and write) va `GITHUB_REPO=login/repo` kerak.
* **Navbat:** MP4 faqat o'quvchilar ochgan darslar uchun yasaladi (eng ko'p ochilgani birinchi). Hamma 150 darsni yasash uchun fabrikani `mode: all` bilan ishga tushiring.
* **Limit tugasa:** saytdagi interaktiv dars brauzer ovoziga o'tadi (bepul), fabrika keyingi oygacha kutadi.
* **Pullik tarifga o'tish:** `TTS_MONTHLY_CHARS=0` (cheklovsiz), `LESSON_VOICE=elevenlabs`, fabrikada `voice: auto`, `mode: all`.
* Admin panel → Video fabrika: navbat, oylik ovoz sarfi va saqlash joyi ko'rinadi.
