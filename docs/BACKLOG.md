# LinguaVerse — avtonom ish ro'yxati (audit 2026-11-12)

Qoidalar (har bir sessiya uchun):
- Har bandni alohida bajar: tuzat → `npm test` (hammasi o'tsin) → kerak bo'lsa test qo'sh → commit → push.
  Commit: `LV_ALLOW_CODE=1 git commit -m "..."`, push oldidan `git pull --rebase --autostash origin main`.
- To'lov/pul kodiga (payment.js) faqat test bilan birga teg. Ishonching komil bo'lmasa — bandni "⏸" deb belgila va sababini yoz.
- Releases, secrets, foydalanuvchi ma'lumotlarini o'chirma. Workflow'larni qo'lda ishga tushirma.
- Bajarilgan bandni `[x]` qil va qisqa izoh yoz. Bitta sessiya ~70 daqiqa; vaqt tugasa to'xta.

## P1 — pul va xavfsizlik
(1–3: to'lov va kirish kodi — sud qaroriga ko'ra faqat egasi bilan kelishib qilinadi.)
- [⏸ INSON KO'RIGI — avtonom qilinmaydi (sud qarori)] 1. payment.js `runRenewals`: karta yechishdan OLDIN tranzaksiya bilan `chargingUntil` (lease) yoki `nextChargeAt` ni oldinga surish; har obuna+davr uchun deterministik orderId; provayder "to'landi" desa-yu `confirmPayment` yiqilsa — `failed` emas, `paid-unactivated`.
- [⏸ INSON KO'RIGI — avtonom qilinmaydi (sud qarori)] 2. payment.js `confirmPayment`: `activatedAt` belgisi faqat huquq berilgandan keyin; `paid` lekin `activatedAt` yo'q buyurtmani qayta chaqiruv tugatadi; webhook xatoda 5xx qaytarsin (provayder qayta yuborsin).
- [⏸ INSON KO'RIGI — avtonom qilinmaydi (sud qarori)] 3. auth-bridge.js: `claim` uchun rate limit (uid/IP); eski (legacy) qidiruv xatosida yopiq ishlash (fail-closed). `email_confirm:true` ni o'zgartirma — faqat docs'ga izoh.
- [x] 4. youtube-videos.js: natijalarni (til, ko'nikma, daraja, imtihon) bo'yicha 6 soat keshlash (fsdb `ytCache/<key>`), kunlik umumiy limit. — bajarildi: `ytCache/<sha>` 6 soat, `ytQuota/<kun>` 90 ta, xatoda yopiq; 2 test.
- [x] 5. teacher.js: `ieltsBand[body.lang]` faqat ruxsat etilgan tillar; baholanadigan matn uzunligi cheklovi. — bajarildi: `validateBody` (til TEACHERS ro'yxatidan, aks holda 400; assess javoblari jami ≤20000 belgi); test.
- [x] 6. community.js `save_count`: transact bilan, bir foydalanuvchi bir marta; `authorName` serverdan. — bajarildi: `community_saves/<kind>_<id>_<uid>` belgi + transact, id tekshiruvi, authorName tokendan; scripts/community.test.js.
- [x] 7. course.js: yakuniy sertifikat `transact` ichida (ikki parallel so'rov ikki sertifikat bermasin); test urinishlariga rate limit (dars bo'yicha soatiga 10). — bajarildi: `recordQuizResult` (progress + sertifikat ID bitta transact'da), `quiz:<uid>:<kurs>:<dars>` soatiga 10; scripts/course-certificate.test.js.

## P2 — workflow'lar
- [x] 8. render-videos.yml: `concurrency: {group: render-videos, cancel-in-progress: false}`, dars regex'iga `pro`, eski FIREBASE_* secret'larni olib tashlash, sarlavha izohini to'g'rilash. — bajarildi: concurrency, `(b2|c2|pro)`, FIREBASE_* olib tashlandi (R2 asosiy), sarlavha: jadval yo'q.
- [x] 9. release-apps.yml publish: `git push` oldidan `git pull --rebase` + 3 marta qayta urinish. — bajarildi.
- [x] 10. validate-app.yml: `paths-ignore: ['content/**']`. — bajarildi (push va pull_request).
- [x] 11. lesson-content.yml: `permissions: contents: read`, sarlavhadagi noto'g'ri va'dani to'g'rilash. — bajarildi: workflow repoga yozmaydi, sarlavha shunga moslandi.
- [x] 12. Bir martalik workflow'lar: `tts-korean-test.yml` ni o'chirish. — bajarildi.

## P3 — frontend va sifat
- [x] 13. THREE fon kodi bo'lgan sahifalarda `if (window.THREE)` himoyasi (CDN ochilmasa sahifa xato bermasin). — bajarildi: 11 sahifa (admin + languages-html) fon IIFE boshida `if (!window.THREE || !cv) return;`.
- [x] 14. update-leaderboard.js: yozuvlarni 5 tadan parallel. — bajarildi: `writeInBatches` (5 tadan Promise.all); scripts/leaderboard.test.js.
- [ ] 15. Darslar sifati: har sessiyada har tildan 2 ta tasodifiy dars — `say`/`examples` grammatikasi va o'zbekcha izoh. Faqat aniq xatoni tuzat, lesson-check ✅.
  - 2026-11-12: 16 dars ko‘rildi (8 til × A2-16, C2-03). german/A2-16 izohi tuzatildi («ikki dona non»). Katta muammo topildi → 16-band.
- [⏸ INSON QARORI] 16. 313 ta dars (arabic 88, chinese 74, russian 47+, turkish 99+, spanish 1) shablon: `say` ichida «ko‘nikma: …» qoldig‘i, bir gap o‘nlab sahnada takror, noto‘g‘ri tarjimalar — lekin `lesson-check` ✅ beradi va ular saytga/videoga chiqyapti. Yana 105 tasi shubhali. Ro‘yxat: `docs/LESSON-AUDIT-2026-11-12.md`. Kerak: `lesson-check` ga shablon tekshiruvini qo‘shish (scripts/ — egasi ruxsati), keyin ularni «QAYTA YOZING» navbati orqali qayta yozish.

## Jurnal
(har sessiya oxirida: sana, bajarilgan bandlar, test natijasi)
- 2026-11-12 (avtonom sessiya): 4–14 bajarildi (youtube kesh/limit, teacher validatsiya, community save_count, course sertifikat transact + quiz rate limit, 5 ta workflow tuzatish, tts-korean-test o‘chirildi, THREE himoyasi, leaderboard parallel). 15: 16 dars ko‘rildi, 1 tuzatish; 16-band (313 shablon dars) ochildi. `npm test`: 119/119 o‘tdi. 1–3 ⏸ (sud qarori) tegilmadi.
