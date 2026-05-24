'use strict';

// ── STATE ──
let curLevel = 'beginner';
let wOff = 0, wFilt = 'all', wSrch = '';
let flashIdx = 0, flashFlipped = false, flashCorrect = 0, flashWrong = 0;
let flashDeck = [];
let quizScore = 0, curQuizWord = null;
let matchSelected = null, matchPairs = [], matchMatched = [];
let typingIdx = 0, typingDeck = [];
let fillIdx = 0, fillDeck = [];
let xp = 0, streak = 0;
let curGrammar = 0;
let completedUnits = JSON.parse(localStorage.getItem('tr_units') || '{}');
xp = parseInt(localStorage.getItem('tr_xp') || '0');

// ── WORD DATABASE (500+ so'z) ──
// FULL WORDS DATABASE — 800+ TURKISH WORDS
// ----------------------------------------
const WDB = [
    // BEGINNER - Temel Seviye
    { e: 'merhaba', u: 'Salom', t: 'interjection', l: 'beginner', ex: 'Merhaba, nasılsın?', eu: 'Salom, qandaysiz?' },
    { e: 'güle güle', u: 'Xayr', t: 'interjection', l: 'beginner', ex: 'Güle güle, yarın görüşürüz!', eu: "Xayr, ertaga ko'rishamiz!" },
    { e: 'teşekkür ederim', u: 'Rahmat', t: 'phrase', l: 'beginner', ex: 'Teşekkür ederim, çok yardımcı oldun.', eu: "Rahmat, juda yordam berdingiz." },
    { e: 'lütfen', u: 'Iltimos', t: 'adverb', l: 'beginner', ex: 'Lütfen bana yardım eder misin?', eu: "Iltimos, menga yordam bera olasizmi?" },
    { e: 'özür dilerim', u: 'Kechirasiz', t: 'interjection', l: 'beginner', ex: 'Özür dilerim, geç kaldım.', eu: "Kechirasiz, kech qoldim." },
    { e: 'evet', u: 'Ha', t: 'interjection', l: 'beginner', ex: 'Evet, ben de aynı fikirdeyim.', eu: "Ha, men ham shu fikrdaman." },
    { e: 'hayır', u: "Yo'q", t: 'interjection', l: 'beginner', ex: 'Hayır, öyle düşünmüyorum.', eu: "Yo'q, men bunday deb o'ylamayman." },
    { e: 'iyi', u: 'Yaxshi', t: 'adjective', l: 'beginner', ex: 'Günaydın, herkese iyi günler!', eu: "Xayrli tong, hammaga yaxshi kun!" },
    { e: 'kötü', u: 'Yomon', t: 'adjective', l: 'beginner', ex: 'Bugün hava çok kötü.', eu: "Bugun havo juda yomon." },
    { e: 'büyük', u: 'Katta', t: 'adjective', l: 'beginner', ex: 'Bu çok büyük bir ev.', eu: "Bu juda katta uy." },
    { e: 'küçük', u: 'Kichik', t: 'adjective', l: 'beginner', ex: 'Benim küçük bir kedim var.', eu: "Mening kichik mushugim bor." },
    { e: 'mutlu', u: 'Xursand', t: 'adjective', l: 'beginner', ex: 'Bugün çok mutluyum!', eu: "Bugun juda xursandman!" },
    { e: 'üzgün', u: "Qayg'uli", t: 'adjective', l: 'beginner', ex: 'O bugün üzgün görünüyor.', eu: "U bugun qayg'uli ko'rinadi." },
    { e: 'sıcak', u: 'Issiq', t: 'adjective', l: 'beginner', ex: 'Dışarısı çok sıcak.', eu: "Tashqarida juda issiq." },
    { e: 'soğuk', u: 'Sovuq', t: 'adjective', l: 'beginner', ex: 'Su çok soğuk.', eu: "Suv juda sovuq." },
    { e: 'kırmızı', u: 'Qizil', t: 'adjective', l: 'beginner', ex: 'Kırmızı elmaları severim.', eu: "Men qizil olmalarni yaxshi ko'raman." },
    { e: 'mavi', u: "Ko'k", t: 'adjective', l: 'beginner', ex: 'Gökyüzü mavi.', eu: "Osmon ko'k." },
    { e: 'yeşil', u: 'Yashil', t: 'adjective', l: 'beginner', ex: 'Çimenler yeşil.', eu: "O'tlar yashil." },
    { e: 'sarı', u: 'Sariq', t: 'adjective', l: 'beginner', ex: 'Güneş sarıdır.', eu: "Quyosh sariq." },
    { e: 'siyah', u: 'Qora', t: 'adjective', l: 'beginner', ex: 'Kedim siyah.', eu: "Mushugim qora." },
    { e: 'beyaz', u: 'Oq', t: 'adjective', l: 'beginner', ex: 'Kar beyazdır.', eu: "Qor oq." },
    { e: 'bir', u: 'Bir', t: 'number', l: 'beginner', ex: 'Bir kız kardeşim var.', eu: "Bitta singlim bor." },
    { e: 'iki', u: 'Ikki', t: 'number', l: 'beginner', ex: 'İki kedim var.', eu: "Ikkita mushugim bor." },
    { e: 'üç', u: 'Uch', t: 'number', l: 'beginner', ex: 'Onun üç kitabı var.', eu: "Uning uch kitobi bor." },
    { e: 'dört', u: "To'rt", t: 'number', l: 'beginner', ex: 'Dört mevsim vardır.', eu: "To'rt fasl bor." },
    { e: 'beş', u: 'Besh', t: 'number', l: 'beginner', ex: 'Beş parmağım var.', eu: "Besh barmog'im bor." },
    { e: 'altı', u: 'Olti', t: 'number', l: 'beginner', ex: 'Altı öğrenci var.', eu: "Olti o'quvchi bor." },
    { e: 'yedi', u: 'Yetti', t: 'number', l: 'beginner', ex: 'Haftada yedi gün var.', eu: "Haftada yetti kun bor." },
    { e: 'sekiz', u: 'Sakkiz', t: 'number', l: 'beginner', ex: 'Sekiz elma aldım.', eu: "Sakkiz olma sotib oldim." },
    { e: 'dokuz', u: "To'qqiz", t: 'number', l: 'beginner', ex: 'Dokuz sayısı şanslıdır.', eu: "To'qqiz raqami omadli." },
    { e: 'on', u: "O'n", t: 'number', l: 'beginner', ex: 'On parmağımız var.', eu: "O'nta barmog'imiz bor." },
    { e: 'anne', u: 'Ona', t: 'noun', l: 'beginner', ex: 'Annem bir öğretmendir.', eu: "Onam o'qituvchi." },
    { e: 'baba', u: 'Ota', t: 'noun', l: 'beginner', ex: 'Babam çok çalışır.', eu: "Otam qattiq ishlaydi." },
    { e: 'kız kardeş', u: 'Singil', t: 'noun', l: 'beginner', ex: 'Kız kardeşim 10 yaşında.', eu: "Singlim 10 yoshda." },
    { e: 'erkek kardeş', u: 'Aka/Uka', t: 'noun', l: 'beginner', ex: 'Erkek kardeşim futbolu sever.', eu: "Akam futbolni yaxshi ko'radi." },
    { e: 'su', u: 'Suv', t: 'noun', l: 'beginner', ex: 'Lütfen bana biraz su ver.', eu: "Iltimos, menga suv bering." },
    { e: 'yemek', u: 'Ovqat', t: 'noun', l: 'beginner', ex: 'Yemek çok lezzetli.', eu: "Ovqat juda mazali." },
    { e: 'elma', u: 'Olma', t: 'noun', l: 'beginner', ex: 'Her gün bir elma yerim.', eu: "Har kuni olma yeyman." },
    { e: 'ekmek', u: 'Non', t: 'noun', l: 'beginner', ex: 'Taze ekmek yapıyor.', eu: "Yangi non yopadi." },
    { e: 'okul', u: 'Maktab', t: 'noun', l: 'beginner', ex: 'Her gün okula giderim.', eu: "Har kuni maktabga boraman." },
    { e: 'kitap', u: 'Kitob', t: 'noun', l: 'beginner', ex: 'Bu ilginç bir kitap.', eu: "Bu qiziqarli kitob." },
    { e: 'köpek', u: 'It', t: 'noun', l: 'beginner', ex: 'Dost canlısı bir köpeğim var.', eu: "Mening do'stona itim bor." },
    { e: 'kedi', u: 'Mushuk', t: 'noun', l: 'beginner', ex: 'Kedi uyuyor.', eu: "Mushuk uxlayapti." },
    { e: 'ev', u: 'Uy', t: 'noun', l: 'beginner', ex: 'Büyük bir evde yaşıyorum.', eu: "Katta uyda yashayman." },
    { e: 'araba', u: 'Avtomobil', t: 'noun', l: 'beginner', ex: 'Babamın kırmızı bir arabası var.', eu: "Otamning qizil mashinasi bor." },
    { e: 'koşmak', u: 'Yugurmoq', t: 'verb', l: 'beginner', ex: 'Her sabah koşar.', eu: "Har ertalab yuguradi." },
    { e: 'yemek', u: 'Yemoq', t: 'verb', l: 'beginner', ex: 'Akşam yemeğini saat 7de yeriz.', eu: "Kechki ovqatni soat 7 da yeymiz." },
    { e: 'içmek', u: 'Ichmoq', t: 'verb', l: 'beginner', ex: 'Kahve içer.', eu: "Qahva ichadi." },
    { e: 'uyumak', u: 'Uxlamoq', t: 'verb', l: 'beginner', ex: 'Çocuklar erken uyur.', eu: "Bolalar erta uxlashadi." },
    { e: 'okumak', u: "O'qimoq", t: 'verb', l: 'beginner', ex: 'Kitap okumayı çok severim.', eu: "Kitob o'qishni juda yaxshi ko'raman." },
    { e: 'yazmak', u: 'Yozmoq', t: 'verb', l: 'beginner', ex: 'Lütfen adınızı yazın.', eu: "Iltimos, ismingizni yozing." },
    { e: 'yürümek', u: 'Yurmoq', t: 'verb', l: 'beginner', ex: 'Okula yürüyerek giderim.', eu: "Maktabga piyoda boraman." },
    { e: 'konuşmak', u: 'Gapirmoq', t: 'verb', l: 'beginner', ex: 'Türkçeyi iyi konuşuyor.', eu: "Turkchani yaxshi gapiradi." },
    { e: 'dinlemek', u: 'Eshitmoq', t: 'verb', l: 'beginner', ex: 'Lütfen dikkatlice dinleyin.', eu: "Iltimos, diqqat bilan eshiting." },
    { e: 'oynamak', u: "O'ynamoq", t: 'verb', l: 'beginner', ex: 'Çocuklar oynamayı sever.', eu: "Bolalar o'ynashni yaxshi ko'radi." },
    { e: 'Pazartesi', u: 'Dushanba', t: 'noun', l: 'beginner', ex: 'Pazartesi haftanın ilk günüdür.', eu: "Dushanba haftaning birinchi kuni." },
    { e: 'Salı', u: 'Seshanba', t: 'noun', l: 'beginner', ex: 'Salı günü dersim var.', eu: "Seshanba kuni darsim bor." },
    { e: 'Çarşamba', u: 'Chorshanba', t: 'noun', l: 'beginner', ex: 'Her Çarşamba buluşuruz.', eu: "Har chorshanba uchrashamiz." },
    { e: 'Perşembe', u: 'Payshanba', t: 'noun', l: 'beginner', ex: 'Perşembe en sevdiğim gün.', eu: "Payshanba mening sevimli kunim." },
    { e: 'Cuma', u: 'Juma', t: 'noun', l: 'beginner', ex: 'Cuma günü erken bitiririz.', eu: "Juma kuni erta tugatamiz." },
    { e: 'Cumartesi', u: 'Shanba', t: 'noun', l: 'beginner', ex: 'Cumartesi dinlenirim.', eu: "Shanba kuni dam olaman." },
    { e: 'Pazar', u: 'Yakshanba', t: 'noun', l: 'beginner', ex: 'Pazar tatil günüdür.', eu: "Yakshanba dam olish kuni." },
    { e: 'sabah', u: 'Ertalab', t: 'noun', l: 'beginner', ex: 'Her sabah uyanırım.', eu: "Har ertalab uyg'onaman." },
    { e: 'akşam', u: 'Kechqurun', t: 'noun', l: 'beginner', ex: 'Akşam yürüyüş yaparız.', eu: "Kechqurun sayr qilamiz." },
    { e: 'gece', u: 'Tun/Kecha', t: 'noun', l: 'beginner', ex: 'İyi geceler, iyi uykular.', eu: "Xayrli tun, yaxshi uxlang." },
    { e: 'gün', u: 'Kun', t: 'noun', l: 'beginner', ex: 'İyi günler!', eu: "Xayrli kun!" },
    { e: 'yıl', u: 'Yil', t: 'noun', l: 'beginner', ex: 'Bu yıl çok özel.', eu: "Bu yil juda alohida." },
    { e: 'zaman', u: 'Vaqt', t: 'noun', l: 'beginner', ex: 'Saat kaç?', eu: "Soat necha bo'ldi?" },
    { e: 'isim', u: 'Ism', t: 'noun', l: 'beginner', ex: 'Benim adım Ahmet.', eu: "Mening ismim Ahmad." },
    { e: 'şehir', u: 'Shahar', t: 'noun', l: 'beginner', ex: 'İstanbul büyük bir şehirdir.', eu: "Istanbul katta shahar." },
    { e: 'ülke', u: 'Mamlakat', t: 'noun', l: 'beginner', ex: 'Türkiye güzel bir ülkedir.', eu: "Turkiya go'zal mamlakat." },
    { e: 'güneş', u: 'Quyosh', t: 'noun', l: 'beginner', ex: 'Güneş parlıyor.', eu: "Quyosh charaqlab turibdi." },
    { e: 'ay', u: 'Oy', t: 'noun', l: 'beginner', ex: 'Bu gece ay çok parlak.', eu: "Bu kecha oy juda yorqin." },
    { e: 'çiçek', u: 'Gul', t: 'noun', l: 'beginner', ex: 'Güzel çiçekleri var.', eu: "Uning chiroyli gullari bor." },
    { e: 'ağaç', u: 'Daraxt', t: 'noun', l: 'beginner', ex: 'Ağaç çok uzun.', eu: "Daraxt juda baland." },
    { e: 'kuş', u: 'Qush', t: 'noun', l: 'beginner', ex: 'Kuş şarkı söylüyor.', eu: "Qush sayrayapti." },
    { e: 'balık', u: 'Baliq', t: 'noun', l: 'beginner', ex: 'Balık yemeyi severim.', eu: "Baliq yeyishni yaxshi ko'raman." },
    { e: 'yeni', u: 'Yangi', t: 'adjective', l: 'beginner', ex: 'Yeni bir telefonum var.', eu: "Yangi telefonim bor." },
    { e: 'eski', u: 'Eski', t: 'adjective', l: 'beginner', ex: 'Bu eski bir bina.', eu: "Bu eski bino." },
    { e: 'uzun', u: 'Uzun', t: 'adjective', l: 'beginner', ex: 'O çok uzun boylu.', eu: "U juda baland bo'yli." },
    { e: 'kısa', u: 'Qisqa', t: 'adjective', l: 'beginner', ex: 'Kısa boylu kız zekidir.', eu: "Past bo'yli qiz aqlli." },
    { e: 'hızlı', u: 'Tez', t: 'adjective', l: 'beginner', ex: 'Araba çok hızlı.', eu: "Mashina juda tez." },
    { e: 'yavaş', u: 'Sekin', t: 'adjective', l: 'beginner', ex: 'Kaplumbağa yavaş hareket eder.', eu: "Toshbaqa sekin yuradi." },
    { e: 'açık', u: 'Ochiq', t: 'adjective', l: 'beginner', ex: 'Kapı açık.', eu: "Eshik ochiq." },
    { e: 'kapalı', u: 'Yopiq', t: 'adjective', l: 'beginner', ex: 'Dükkan kapalı.', eu: "Do'kon yopiq." },
    { e: 'sevmek', u: 'Sevmoq', t: 'verb', l: 'beginner', ex: 'Ailemi çok seviyorum.', eu: "Oilamni juda sevaman." },
    { e: 'istemek', u: 'Xohlamoq', t: 'verb', l: 'beginner', ex: 'Eve gitmek istiyorum.', eu: "Uyga ketmoqchiman." },
    { e: 'bilmek', u: 'Bilmoq', t: 'verb', l: 'beginner', ex: 'Onu tanıyor musun?', eu: "Uni bilasizmi?" },
    { e: 'görmek', u: "Ko'rmoq", t: 'verb', l: 'beginner', ex: 'Dağı görebiliyorum.', eu: "Men tog'ni ko'ryapman." },
    { e: 'gelmek', u: 'Kelmoq', t: 'verb', l: 'beginner', ex: 'Lütfen buraya gel.', eu: "Iltimos, bu yerga keling." },
    { e: 'gitmek', u: 'Bormoq', t: 'verb', l: 'beginner', ex: 'Hadi parka gidelim.', eu: "Keling, parkka boraylik." },
    { e: 'vermek', u: 'Bermoq', t: 'verb', l: 'beginner', ex: 'Bana o kitabı ver.', eu: "Menga o'sha kitobni bering." },
    { e: 'almak', u: 'Olmoq', t: 'verb', l: 'beginner', ex: 'Bu şemsiyeyi al.', eu: "Bu soyabonni oling." },
    { e: 'yardım etmek', u: 'Yordam bermoq', t: 'verb', l: 'beginner', ex: 'Bana yardım eder misin?', eu: "Menga yordam bera olasizmi?" },
    { e: 'çalışmak', u: 'Ishlash', t: 'verb', l: 'beginner', ex: 'Her gün çalışırım.', eu: "Har kuni ishlayman." },
    { e: 'düşünmek', u: "O'ylamoq", t: 'verb', l: 'beginner', ex: 'Bence haklısın.', eu: "Menimcha siz haqlisiz." },
    { e: 'söylemek', u: 'Aytmoq', t: 'verb', l: 'beginner', ex: 'Ne dedin?', eu: "Nima dedingiz?" },
    { e: 'yapmak', u: 'Qilmoq', t: 'verb', l: 'beginner', ex: 'Çay yapayım.', eu: "Choy qilay." },
    { e: 'koymak', u: "Qo'ymoq", t: 'verb', l: 'beginner', ex: 'Onu masanın üzerine koy.', eu: "Uni stolga qo'ying." },
    { e: 'bulmak', u: 'Topmoq', t: 'verb', l: 'beginner', ex: 'Anahtarlarımı bulamıyorum.', eu: "Kalitlarimni topolmayapman." },
    { e: 'satın almak', u: 'Sotib olmoq', t: 'verb', l: 'beginner', ex: 'Bir kitap satın almak istiyorum.', eu: "Kitob sotib olmoqchiman." },
    { e: 'süt', u: 'Sut', t: 'noun', l: 'beginner', ex: 'Çocuklar süt içer.', eu: "Bolalar sut ichadi." },
    { e: 'yumurta', u: 'Tuxum', t: 'noun', l: 'beginner', ex: 'Kahvaltıda iki yumurta yerim.', eu: "Nonushtada ikki tuxum yeyman." },
    { e: 'pirinç', u: 'Guruch', t: 'noun', l: 'beginner', ex: 'Pirinç bizim ana yemeğimizdir.', eu: "Guruch asosiy ovqatimiz." },
    { e: 'et', u: "Go'sht", t: 'noun', l: 'beginner', ex: 'Bu et çok lezzetli.', eu: "Bu go'sht juda mazali." },
    { e: 'çay', u: 'Choy', t: 'noun', l: 'beginner', ex: 'Hadi çay içelim.', eu: "Keling, choy ichaylik." },
    { e: 'kahve', u: 'Qahva', t: 'noun', l: 'beginner', ex: 'Her sabah kahve içerim.', eu: "Har ertalab qahva ichaman." },
    { e: 'portakal', u: 'Apelsin', t: 'noun', l: 'beginner', ex: 'Portakallar tatlıdır.', eu: "Apelsinlar shirin." },
    { e: 'muz', u: 'Banan', t: 'noun', l: 'beginner', ex: 'Her gün bir muz yerim.', eu: "Har kuni banan yeyman." },
    { e: 'masa', u: 'Stol', t: 'noun', l: 'beginner', ex: 'Kitap masanın üstünde.', eu: "Kitob stolda." },
    { e: 'sandalye', u: 'Stul', t: 'noun', l: 'beginner', ex: 'Sandalyeye oturun.', eu: "Stulga o'tiring." },
    { e: 'kalem', u: 'Ruchka/Qalam', t: 'noun', l: 'beginner', ex: 'Kaleminizi ödünç alabilir miyim?', eu: "Ruchkangizni olsam bo'ladimi?" },
    { e: 'çanta', u: 'Sumka', t: 'noun', l: 'beginner', ex: 'Çantam ağır.', eu: "Sumkam og'ir." },
    { e: 'telefon', u: 'Telefon', t: 'noun', l: 'beginner', ex: 'Telefonum yeni.', eu: "Telefonim yangi." },
    { e: 'pencere', u: 'Deraza', t: 'noun', l: 'beginner', ex: 'Lütfen pencereyi aç.', eu: "Iltimos, derazani oching." },
    { e: 'kapı', u: 'Eshik', t: 'noun', l: 'beginner', ex: 'Kapıyı kapat.', eu: "Eshikni yoping." },
    { e: 'yol', u: "Yo'l", t: 'noun', l: 'beginner', ex: 'Yol uzun.', eu: "Yo'l uzoq." },
    { e: 'park', u: 'Park', t: 'noun', l: 'beginner', ex: 'Çocuklar parkta oynuyor.', eu: "Bolalar parkda o'ynaydi." },
    { e: 'dükkan', u: "Do'kon", t: 'noun', l: 'beginner', ex: "Hadi dükkana gidelim.", eu: "Keling, do'konga boraylik." },
    { e: 'para', u: 'Pul', t: 'noun', l: 'beginner', ex: 'Paran var mı?', eu: "Pulingiz bormi?" },
    { e: 'arkadaş', u: "Do'st", t: 'noun', l: 'beginner', ex: 'O benim en iyi arkadaşımdır.', eu: "U mening eng yaxshi do'stim." },
    { e: 'öğretmen', u: "O'qituvchi", t: 'noun', l: 'beginner', ex: 'Öğretmenim çok nazik.', eu: "O'qituvchim juda mehribon." },
    { e: 'öğrenci', u: "O'quvchi", t: 'noun', l: 'beginner', ex: 'O iyi bir öğrenci.', eu: "U yaxshi o'quvchi." },
    { e: 'güzel', u: "Go'zal", t: 'adjective', l: 'beginner', ex: 'Ne güzel bir gün!', eu: "Naqadar go'zal kun!" },
    { e: 'çirkin', u: "Xunuk", t: 'adjective', l: 'beginner', ex: 'O eski bina çirkin.', eu: "O eski bino xunuk." },
    { e: 'doğru', u: "To'g'ri", t: 'adjective', l: 'beginner', ex: 'Bu doğru cevap.', eu: "Bu to'g'ri javob." },
    { e: 'yanlış', u: 'Noto\'g\'ri', t: 'adjective', l: 'beginner', ex: 'Bu yanlış bir adres.', eu: "Bu noto'g'ri manzil." },
    { e: 'çok', u: "Juda", t: 'adverb', l: 'beginner', ex: 'Çok teşekkür ederim!', eu: "Katta rahmat!" },
    { e: 'az', u: 'Oz', t: 'adjective', l: 'beginner', ex: 'Az param var.', eu: "Pulim oz." },
    { e: 'günaydın', u: "Xayrli tong", t: 'interjection', l: 'beginner', ex: 'Günaydın, nasılsın?', eu: "Xayrli tong, qandaysiz?" },
    { e: 'iyi akşamlar', u: "Xayrli kech", t: 'interjection', l: 'beginner', ex: 'İyi akşamlar efendim!', eu: "Xayrli kech, janob!" },
    { e: 'iyi geceler', u: "Xayrli tun", t: 'interjection', l: 'beginner', ex: 'İyi geceler, tatlı rüyalar!', eu: "Xayrli tun, shirin tushlar!" },
    { e: 'hoş geldin', u: "Xush kelibsiz", t: 'interjection', l: 'beginner', ex: 'Hoş geldin, arkadaşım!', eu: "Xush kelibsiz, do'stim!" },
    { e: 'hoşça kal', u: "Xayr", t: 'interjection', l: 'beginner', ex: 'Hoşça kal, görüşürüz!', eu: "Xayr, ko'rishguncha!" },

    // ELEMENTARY — Temel Üstü
    { e: 'yemek odası', u: 'Oshxona', t: 'noun', l: 'elementary', ex: 'Yemek odasında yemek yeriz.', eu: 'Oshxonada ovqatlanamiz.' },
    { e: 'yatak odası', u: 'Yotoqxona', t: 'noun', l: 'elementary', ex: 'Yatak odam çok rahat.', eu: 'Yotoqxonam juda qulay.' },
    { e: 'mutfak', u: 'Oshxona', t: 'noun', l: 'elementary', ex: 'Mutfakta yemek pişiriyor.', eu: 'Oshxonada ovqat pishiradi.' },
    { e: 'banyo', u: 'Hammom', t: 'noun', l: 'elementary', ex: 'Banyo çok temiz.', eu: 'Hammom juda toza.' },
    { e: 'bahçe', u: "Bog'", t: 'noun', l: 'elementary', ex: 'Bahçede sebze yetiştiririz.', eu: "Bog'da sabzavot yetishtiramiz." },
    { e: 'doktor', u: 'Shifokor', t: 'noun', l: 'elementary', ex: 'Doktor hastayı muayene etti.', eu: 'Shifokor bemorni tekshirdi.' },
    { e: 'mühendis', u: 'Muhandis', t: 'noun', l: 'elementary', ex: 'O bir yazılım mühendisi.', eu: "U dasturiy ta'minot muhandisi." },
    { e: 'pahalı', u: 'Qimmat', t: 'adjective', l: 'elementary', ex: 'Bu telefon çok pahalı.', eu: 'Bu telefon juda qimmat.' },
    { e: 'ucuz', u: 'Arzon', t: 'adjective', l: 'elementary', ex: 'Bu ayakkabılar ucuz.', eu: 'Bu poyabzallar arzon.' },
    { e: 'ilginç', u: 'Qiziqarli', t: 'adjective', l: 'elementary', ex: 'Bu ilginç bir hikaye.', eu: 'Bu qiziqarli hikoya.' },
    { e: 'zor', u: 'Qiyin', t: 'adjective', l: 'elementary', ex: 'Bu sınav çok zor.', eu: 'Bu imtihon juda qiyin.' },
    { e: 'kolay', u: 'Oson', t: 'adjective', l: 'elementary', ex: 'Bu alıştırma çok kolay.', eu: 'Bu mashq juda oson.' },
    { e: 'seyahat', u: 'Sayohat', t: 'noun', l: 'elementary', ex: 'Yurt dışına seyahat etmeyi severim.', eu: 'Chet elga sayohat qilishni yaxshi ko\'raman.' },
    { e: 'müzik', u: 'Musiqa', t: 'noun', l: 'elementary', ex: 'Her gün müzik dinlerim.', eu: 'Har kuni musiqa eshitaman.' },
    { e: 'hava', u: 'Ob-havo', t: 'noun', l: 'elementary', ex: 'Bugün hava güzel.', eu: 'Bugun ob-havo yaxshi.' },
    { e: 'bilgisayar', u: 'Kompyuter', t: 'noun', l: 'elementary', ex: 'Bilgisayarı iş için kullanırım.', eu: 'Kompyuterni ish uchun ishlataman.' },
    { e: 'hastane', u: 'Kasalxona', t: 'noun', l: 'elementary', ex: 'Hastaneye kaldırıldı.', eu: 'Uni kasalxonaga olib ketishdi.' },
    { e: 'restoran', u: 'Restoran', t: 'noun', l: 'elementary', ex: 'Restoranda yemek yeriz.', eu: 'Restoranda ovqatlanamiz.' },
    { e: 'havaalanı', u: 'Aeroport', t: 'noun', l: 'elementary', ex: 'Havaalanı çok yoğun.', eu: 'Aeroport juda gavjum.' },
    { e: 'toplantı', u: 'Uchrashuv', t: 'noun', l: 'elementary', ex: 'Saat 10da toplantım var.', eu: 'Soat 10 da uchrashuvim bor.' },
    { e: 'alışveriş', u: 'Xarid', t: 'noun', l: 'elementary', ex: 'Alışveriş yapmayı sever.', eu: 'Xarid qilishni yaxshi ko\'radi.' },
    { e: 'bilet', u: 'Chipta', t: 'noun', l: 'elementary', ex: 'Tren bileti aldım.', eu: 'Poyezd chiptasi sotib oldim.' },
    { e: 'otel', u: 'Mehmonxona', t: 'noun', l: 'elementary', ex: 'Güzel bir otelde kaldık.', eu: 'Chiroyli mehmonxonada qoldik.' },
    { e: 'menü', u: 'Menyu', t: 'noun', l: 'elementary', ex: 'Menüyü görebilir miyim?', eu: 'Menyuni ko\'rsam bo\'ladimi?' },
    { e: 'fiş', u: 'Kvitansiya', t: 'noun', l: 'elementary', ex: 'Fişinizi saklayın.', eu: 'Kvitansiyangizni saqlang.' },
    { e: 'indirim', u: 'Chegirma', t: 'noun', l: 'elementary', ex: 'Bugün %20 indirim var.', eu: 'Bugun 20% chegirma bor.' },
    { e: 'egzersiz', u: 'Mashq', t: 'noun', l: 'elementary', ex: 'Egzersiz sağlık için faydalıdır.', eu: 'Mashq sog\'liq uchun foydali.' },
    { e: 'randevu', u: 'Uchrashuv vaqti', t: 'noun', l: 'elementary', ex: 'Doktor randevum var.', eu: 'Shifokor bilan uchrashuv vaqtim bor.' },
    { e: 'yön', u: "Yo'nalish", t: 'noun', l: 'elementary', ex: 'Bana yön gösterebilir misin?', eu: "Yo'l ko'rsata olasizmi?" },
    { e: 'kütüphane', u: 'Kutubxona', t: 'noun', l: 'elementary', ex: 'Sık sık kütüphaneye giderim.', eu: 'Tez-tez kutubxonaga boraman.' },
    { e: 'ders', u: 'Dars', t: 'noun', l: 'elementary', ex: 'Ders saat 9da başlar.', eu: 'Dars soat 9 da boshlanadi.' },
    { e: 'ödev', u: 'Uy vazifasi', t: 'noun', l: 'elementary', ex: 'Her akşam ödevimi yaparım.', eu: 'Har kechqurun uy vazifamni bajaraman.' },
    { e: 'sınıf', u: 'Sinf', t: 'noun', l: 'elementary', ex: 'Sınıfımızda 25 öğrenci var.', eu: "Sinfimizda 25 o'quvchi bor." },
    { e: 'sınav', u: 'Imtihon', t: 'noun', l: 'elementary', ex: 'Yarın sınavım var.', eu: 'Ertaga imtihonim bor.' },
    { e: 'not', u: 'Baho', t: 'noun', l: 'elementary', ex: 'İyi bir not aldı.', eu: 'Yaxshi baho oldi.' },
    { e: 'gezegen', u: 'Sayyora', t: 'noun', l: 'elementary', ex: 'Dünya bizim gezegenimizdir.', eu: 'Yer bizning sayyoramiz.' },
    { e: 'dağ', u: "Tog'", t: 'noun', l: 'elementary', ex: 'Dağ çok yüksek.', eu: "Tog' juda baland." },
    { e: 'nehir', u: 'Daryo', t: 'noun', l: 'elementary', ex: 'Nehir çok güzel.', eu: 'Daryo go\'zal.' },
    { e: 'deniz', u: 'Dengiz', t: 'noun', l: 'elementary', ex: 'Denizi çok severim.', eu: 'Dengizni juda yaxshi ko\'raman.' },
    { e: 'orman', u: "O'rmon", t: 'noun', l: 'elementary', ex: 'Orman karanlık ve sessiz.', eu: "O'rmon qorong'i va sokin." },
    { e: 'hayvan', u: 'Hayvon', t: 'noun', l: 'elementary', ex: 'En sevdiğim hayvan aslandır.', eu: 'Sevimli hayvonim — sher.' },
    { e: 'spor', u: 'Sport', t: 'noun', l: 'elementary', ex: 'Spor sizi sağlıklı tutar.', eu: 'Sport sizni sog\'lom saqlaydi.' },
    { e: 'takım', u: 'Jamoa', t: 'noun', l: 'elementary', ex: 'Takımımız maçı kazandı.', eu: "Jamoamiz o'yinda g'olib keldi." },
    { e: 'kazanan', u: "G'olib", t: 'noun', l: 'elementary', ex: 'O kazanan!', eu: "U g'olib!" },
    { e: 'hikaye', u: 'Hikoya', t: 'noun', l: 'elementary', ex: 'Bana bir hikaye anlat.', eu: 'Menga hikoya aytib ber.' },
    { e: 'macera', u: 'Sarguzasht', t: 'noun', l: 'elementary', ex: 'Hayat bir maceradır.', eu: 'Hayot — bu sarguzasht.' },
    { e: 'rüya', u: 'Orzu/Tush', t: 'noun', l: 'elementary', ex: 'Hayalinin peşinden git.', eu: "Orzuingiz ortidan yuring." },
    { e: 'gülmek', u: 'Kulmoq', t: 'verb', l: 'elementary', ex: 'Beni hep güldürür.', eu: 'Meni doim kuldirmoqda.' },
    { e: 'ağlamak', u: "Yig'lamoq", t: 'verb', l: 'elementary', ex: 'Ağlama, her şey iyi olacak.', eu: "Yig'lama, hammasi yaxshi bo'ladi." },
    { e: 'ziyaret etmek', u: "Tashrif buyurmoq", t: 'verb', l: 'elementary', ex: 'Büyükannemi sık sık ziyaret ederiz.', eu: "Buvisiga tez-tez boramiz." },
    { e: 'anlatmak', u: 'Tushuntirmoq', t: 'verb', l: 'elementary', ex: 'Lütfen bana anlat.', eu: 'Iltimos, menga tushuntiring.' },
    { e: 'tarif etmek', u: 'Tasvirlash', t: 'verb', l: 'elementary', ex: 'Resmi tarif edebilir misin?', eu: 'Rasmni tasvirlay olasizmi?' },
    { e: 'katılmak', u: "Qo'shilmoq", t: 'verb', l: 'elementary', ex: 'Fikrine katılıyorum.', eu: "Fikringizga qo'shilaman." },
    { e: 'seçmek', u: 'Tanlash', t: 'verb', l: 'elementary', ex: 'Lütfen bir cevap seçin.', eu: 'Iltimos, bitta javob tanlang.' },
    { e: 'hatırlamak', u: 'Eslamoq', t: 'verb', l: 'elementary', ex: 'Adını hatırlıyorum.', eu: 'Ismingizni eslayman.' },
    { e: 'unutmak', u: 'Unutmoq', t: 'verb', l: 'elementary', ex: 'Anahtarlarını unutma!', eu: 'Kalitlaringizni unutmang!' },
    { e: 'geliştirmek', u: 'Yaxshilamoq', t: 'verb', l: 'elementary', ex: 'Türkçemi geliştirmek istiyorum.', eu: "Turk tilimni yaxshilashni xohlayman." },
    { e: 'hazırlanmak', u: 'Tayyorlamoq', t: 'verb', l: 'elementary', ex: 'Sınava hazırlanıyorum.', eu: 'Imtihonga tayyorlanayapman.' },
    { e: 'bitirmek', u: 'Tugatmoq', t: 'verb', l: 'elementary', ex: 'İşini bitirdin mi?', eu: 'Ishingizni tugatdingizmi?' },
    { e: 'başlamak', u: 'Boshlash', t: 'verb', l: 'elementary', ex: 'Hadi derse başlayalım.', eu: "Keling, darsni boshlaylik." },
    { e: 'genellikle', u: 'Odatda', t: 'adverb', l: 'elementary', ex: 'Genellikle saat 7de uyanırım.', eu: 'Odatda soat 7 da uyg\'onaman.' },
    { e: 'bazen', u: "Ba'zan", t: 'adverb', l: 'elementary', ex: 'Bazen film izler.', eu: "Ba'zan film ko'radi." },
    { e: 'asla', u: 'Hech qachon', t: 'adverb', l: 'elementary', ex: 'Asla fast food yemem.', eu: 'Hech qachon tez ovqat yemayman.' },
    { e: 'her zaman', u: 'Har doim', t: 'adverb', l: 'elementary', ex: 'Her zaman zamanında gelir.', eu: 'Har doim o\'z vaqtida keladi.' },
    { e: 'sık sık', u: 'Tez-tez', t: 'adverb', l: 'elementary', ex: 'Sık sık yürüyüşe çıkarız.', eu: 'Tez-tez sayrga chiqamiz.' },
    { e: 'sonunda', u: 'Nihoyat', t: 'adverb', l: 'elementary', ex: 'Sonunda geldik.', eu: 'Nihoyat yetib keldik.' },
    { e: 'aniden', u: "To'satdan", t: 'adverb', l: 'elementary', ex: 'Aniden yağmur yağmaya başladı.', eu: "To'satdan yomg'ir yog'a boshladi." },
    { e: 'güzel', u: 'Yoqimli/Yaxshi', t: 'adjective', l: 'elementary', ex: 'Ne güzel bir manzara!', eu: 'Naqadar go\'zal manzara!' },
    { e: 'harika', u: 'Ajoyib', t: 'adjective', l: 'elementary', ex: 'Harika bir fikir!', eu: 'Ajoyib g\'oya!' },
    { e: 'berbat', u: 'Juda yomon', t: 'adjective', l: 'elementary', ex: 'Hava berbat.', eu: 'Havo juda yomon.' },
    { e: 'rahat', u: 'Qulay', t: 'adjective', l: 'elementary', ex: 'Bu koltuk çok rahat.', eu: 'Bu kreslo juda qulay.' },
    { e: 'dar', u: 'Tor', t: 'adjective', l: 'elementary', ex: 'Bu sokak çok dar.', eu: 'Bu ko\'cha juda tor.' },
    { e: 'geniş', u: 'Keng', t: 'adjective', l: 'elementary', ex: 'Geniş bir evimiz var.', eu: 'Keng uyimiz bor.' },
    { e: 'temiz', u: 'Toza', t: 'adjective', l: 'elementary', ex: 'Oda çok temiz.', eu: 'Xona juda toza.' },
    { e: 'kirli', u: 'Iflos', t: 'adjective', l: 'elementary', ex: 'Ellerin kirli.', eu: 'Qo\'llaringiz iflos.' },
    { e: 'ağır', u: "Og'ir", t: 'adjective', l: 'elementary', ex: 'Bu çanta çok ağır.', eu: 'Bu sumka juda og\'ir.' },
    { e: 'hafif', u: 'Yengil', t: 'adjective', l: 'elementary', ex: 'Bu kutu hafif.', eu: 'Bu quti yengil.' },
    { e: 'tatlı', u: 'Shirin', t: 'adjective', l: 'elementary', ex: 'Bu pasta çok tatlı.', eu: 'Bu pirojniy juda shirin.' },
    { e: 'ekşi', u: 'Nordon', t: 'adjective', l: 'elementary', ex: 'Limon ekşidir.', eu: 'Limon nordon.' },
    { e: 'tuzlu', u: 'Tuzli', t: 'adjective', l: 'elementary', ex: 'Çorba çok tuzlu.', eu: 'Sho\'rva juda tuzli.' },
    { e: 'acı', u: 'Achchiq', t: 'adjective', l: 'elementary', ex: 'Biber acıdır.', eu: "Qalampir achchiq." },
    { e: 'yağmur', u: 'Yomg\'ir', t: 'noun', l: 'elementary', ex: 'Yağmur yağıyor.', eu: "Yomg'ir yog'yapti." },
    { e: 'kar', u: 'Qor', t: 'noun', l: 'elementary', ex: 'Kar yağdı.', eu: 'Qor yog\'di.' },
    { e: 'rüzgar', u: 'Shamol', t: 'noun', l: 'elementary', ex: 'Rüzgar çok kuvvetli.', eu: 'Shamol juda kuchli.' },
    { e: 'bulut', u: 'Bulut', t: 'noun', l: 'elementary', ex: 'Gökyüzü bulutlu.', eu: 'Osmon bulutli.' },
    { e: 'gökkuşağı', u: 'Kamalak', t: 'noun', l: 'elementary', ex: 'Gökkuşağı çok renklidir.', eu: 'Kamalak rang-barang.' },
    { e: 'yıldız', u: 'Yulduz', t: 'noun', l: 'elementary', ex: 'Yıldızlar parlıyor.', eu: 'Yulduzlar charaqlayapti.' },
    { e: 'deniz', u: 'Dengiz', t: 'noun', l: 'elementary', ex: 'Deniz kenarında yürüdük.', eu: 'Dengiz bo\'yida yurdik.' },
    { e: 'göl', u: "Ko'l", t: 'noun', l: 'elementary', ex: 'Gölde yüzdük.', eu: "Ko'lda suzdik." },
    { e: 'ada', u: 'Orol', t: 'noun', l: 'elementary', ex: 'Yunan adaları çok güzel.', eu: 'Yunon orollari juda go\'zal.' },
    { e: 'çöl', u: "Cho'l", t: 'noun', l: 'elementary', ex: 'Çöl çok sıcak.', eu: "Cho'l juda issiq." },
    { e: 'vadi', u: 'Vodiy', t: 'noun', l: 'elementary', ex: 'Vadi çok yeşil.', eu: 'Vodiy juda yashil.' },
    { e: 'tepe', u: 'Tepalik', t: 'noun', l: 'elementary', ex: 'Tepeye tırmandık.', eu: 'Tepalikka chiqdik.' },
    { e: 'orman', u: "O'rmon", t: 'noun', l: 'elementary', ex: 'Ormanda yürüyüş yaptık.', eu: "O'rmonda sayr qildik." },
    { e: 'köy', u: "Qishloq", t: 'noun', l: 'elementary', ex: 'Köyde büyüdüm.', eu: "Qishloqda o'sganman." },
    { e: 'kasaba', u: 'Shaharcha', t: 'noun', l: 'elementary', ex: 'Kasaba çok sessiz.', eu: 'Shaharcha juda sokin.' },
    { e: 'köprü', u: "Ko'prik", t: 'noun', l: 'elementary', ex: 'Boğaziçi Köprüsü ünlüdür.', eu: "Bog'azichi ko'prigi mashhur." },
    { e: 'liman', u: 'Port', t: 'noun', l: 'elementary', ex: 'Liman çok büyük.', eu: 'Port juda katta.' },
    { e: 'hastane', u: 'Kasalxona', t: 'noun', l: 'elementary', ex: 'Hastanede çalışıyor.', eu: 'Kasalxonada ishlaydi.' },
    { e: 'eczane', u: 'Dorixona', t: 'noun', l: 'elementary', ex: 'Eczane nerede?', eu: 'Dorixona qayerda?' },
    { e: 'market', u: 'Bozor/Magazin', t: 'noun', l: 'elementary', ex: 'Markete gidiyorum.', eu: 'Magazinga ketyapman.' },
    { e: 'fırın', u: 'Nonvoyxona', t: 'noun', l: 'elementary', ex: 'Fırından ekmek aldım.', eu: 'Nonvoyxonadan non oldim.' },
    { e: 'manav', u: 'Meva-sabzavot do\'koni', t: 'noun', l: 'elementary', ex: 'Manavdan meyve aldım.', eu: "Meva-sabzavot do'konidan meva oldim." },

    // PRE-INTERMEDIATE — Orta Seviye
    { e: 'ancak', u: 'Biroq, ammo', t: 'conjunction', l: 'pre-intermediate', ex: 'Soğuktu ancak dışarı çıktık.', eu: "Sovuq edi, biroq chiqdik." },
    { e: 'rağmen', u: "Garchi...bo'lsa ham", t: 'conjunction', l: 'pre-intermediate', ex: 'Yağmura rağmen oynadık.', eu: "Yomg'irga qaramasdan o'ynadik." },
    { e: 'bu nedenle', u: 'Shuning uchun', t: 'adverb', l: 'pre-intermediate', ex: 'Bu nedenle gitmeye karar verdik.', eu: "Shuning uchun ketishga qaror qildik." },
    { e: 'üstelik', u: 'Bundan tashqari', t: 'adverb', l: 'pre-intermediate', ex: 'Üstelik çok yetenekli.', eu: "Bundan tashqari, u juda iste'dodli." },
    { e: 'fırsat', u: 'Imkoniyat', t: 'noun', l: 'pre-intermediate', ex: 'Bu harika bir fırsat.', eu: "Bu ajoyib imkoniyat." },
    { e: 'araştırma', u: 'Tadqiqot', t: 'noun', l: 'pre-intermediate', ex: 'Bilim insanları araştırma yapar.', eu: "Olimlar tadqiqot o'tkazadilar." },
    { e: 'son tarih', u: 'Muddat', t: 'noun', l: 'pre-intermediate', ex: 'Son tarih yarın.', eu: "Muddati ertaga." },
    { e: 'vazgeçmek', u: 'Voz kechmoq', t: 'verb', l: 'pre-intermediate', ex: 'Hayallerinden vazgeçme.', eu: "Orzularingizdan voz kechmang." },
    { e: 'beklemek', u: 'Kutmoq', t: 'verb', l: 'pre-intermediate', ex: 'Seni görmeyi dört gözle bekliyorum.', eu: "Sizni ko'rishni intiqlik bilan kutyapman." },
    { e: 'başarı', u: 'Yutuq', t: 'noun', l: 'pre-intermediate', ex: 'Bu büyük bir başarı.', eu: "Bu katta yutuq." },
    { e: 'meydan okuma', u: 'Sinov/Muammo', t: 'noun', l: 'pre-intermediate', ex: 'Her meydan okuma sizi güçlendirir.', eu: "Har bir sinov sizni kuchliroq qiladi." },
    { e: 'kendine güvenen', u: 'Ishonchli', t: 'adjective', l: 'pre-intermediate', ex: 'Kendine güven.', eu: "O'zingizga ishoning." },
    { e: 'başarılı', u: 'Muvaffaqiyatli', t: 'adjective', l: 'pre-intermediate', ex: 'Başarılı bir iş kadınıdır.', eu: "Muvaffaqiyatli ish ayoli." },
    { e: 'sorumlu', u: "Mas'ul", t: 'adjective', l: 'pre-intermediate', ex: 'Eylemlerinizden sorumlu olun.', eu: "Harakatlaringiz uchun mas'ul bo'ling." },
    { e: 'çevre', u: 'Atrof-muhit', t: 'noun', l: 'pre-intermediate', ex: 'Çevreyi korumalıyız.', eu: "Atrof-muhitni himoya qilishimiz kerak." },
    { e: 'teknoloji', u: 'Texnologiya', t: 'noun', l: 'pre-intermediate', ex: 'Teknoloji hayatımızı değiştiriyor.', eu: "Texnologiya hayotimizni o'zgartirmoqda." },
    { e: 'toplum', u: 'Jamiyat', t: 'noun', l: 'pre-intermediate', ex: 'Toplum hızla değişiyor.', eu: "Jamiyat tez o'zgarmoqda." },
    { e: 'eğitim', u: "Ta'lim", t: 'noun', l: 'pre-intermediate', ex: 'Eğitim başarının anahtarıdır.', eu: "Ta'lim — muvaffaqiyat kaliti." },
    { e: 'kariyer', u: 'Karyera', t: 'noun', l: 'pre-intermediate', ex: 'İyi bir kariyer istiyorum.', eu: "Yaxshi karyera istayman." },
    { e: 'maaş', u: 'Maosh', t: 'noun', l: 'pre-intermediate', ex: 'Maaşı çok yüksek.', eu: "Maoshi juda baland." },
    { e: 'iş arkadaşı', u: 'Hamkasb', t: 'noun', l: 'pre-intermediate', ex: 'İş arkadaşım yardımsever.', eu: "Hamkasbim yordamsevar." },
    { e: 'mülakat', u: 'Suhbat/Intervyu', t: 'noun', l: 'pre-intermediate', ex: 'Yarın iş mülakatım var.', eu: "Ertaga ish suhbatim bor." },
    { e: 'başvuru', u: 'Ariza', t: 'noun', l: 'pre-intermediate', ex: 'Başvurumu gönderdim.', eu: "Arizamni topshirdim." },
    { e: 'deneyim', u: 'Tajriba', t: 'noun', l: 'pre-intermediate', ex: 'İş deneyimi çok önemli.', eu: "Ish tajribasi juda muhim." },
    { e: 'beceriler', u: "Ko'nikmalar", t: 'noun', l: 'pre-intermediate', ex: 'İyi iletişim becerileri gerekli.', eu: "Yaxshi muloqot ko'nikmalari kerak." },
    { e: 'yönetmek', u: 'Boshqarmoq', t: 'verb', l: 'pre-intermediate', ex: 'Büyük bir ekibi yönetiyor.', eu: "Katta jamoani boshqaradi." },
    { e: 'çözmek', u: 'Yechmoq', t: 'verb', l: 'pre-intermediate', ex: 'Bu sorunu çözmeliyiz.', eu: "Bu muammoni yechishimiz kerak." },
    { e: 'ulaşmak', u: 'Erishmoq', t: 'verb', l: 'pre-intermediate', ex: 'Hedeflerinize ulaşabilirsiniz.', eu: "Maqsadlaringizga erisha olasiz." },
    { e: 'geliştirmek', u: 'Rivojlantirmoq', t: 'verb', l: 'pre-intermediate', ex: 'Yeni fikirler geliştirmeliyiz.', eu: "Yangi g'oyalarni rivojlantirishimiz kerak." },
    { e: 'artırmak', u: 'Oshirmoq', t: 'verb', l: 'pre-intermediate', ex: 'Fiyatlar artıyor.', eu: "Narxlar oshmoqda." },
    { e: 'azaltmak', u: 'Kamaytirmoq', t: 'verb', l: 'pre-intermediate', ex: 'Kirliliği azaltmalıyız.', eu: "Ifloslanishni kamaytirishimiz kerak." },
    { e: 'önermek', u: 'Taklif qilmoq', t: 'verb', l: 'pre-intermediate', ex: 'Şimdi gitmemizi öneriyorum.', eu: "Endi ketishimizni taklif qilaman." },
    { e: 'karşılaştırmak', u: 'Solishtirmoq', t: 'verb', l: 'pre-intermediate', ex: 'Bu iki ürünü karşılaştırın.', eu: "Bu ikki mahsulotni solishtiring." },
    { e: 'rapor', u: 'Hisobot', t: 'noun', l: 'pre-intermediate', ex: 'Bunun hakkında rapor yazın.', eu: "Bu haqida hisobot yozing." },
    { e: 'proje', u: 'Loyiha', t: 'noun', l: 'pre-intermediate', ex: 'Projemiz Cuma günü teslim.', eu: "Loyihamiz juma kuni topshirilishi kerak." },
    { e: 'bütçe', u: 'Byudjet', t: 'noun', l: 'pre-intermediate', ex: 'Sınırlı bir bütçemiz var.', eu: "Cheklangan byudjetimiz bor." },
    { e: 'kâr', u: 'Foyda', t: 'noun', l: 'pre-intermediate', ex: 'Şirket kâr etti.', eu: "Kompaniya foyda ko'rdi." },
    { e: 'müşteri', u: 'Mijoz', t: 'noun', l: 'pre-intermediate', ex: 'Müşteri memnun.', eu: "Mijoz mamnun." },
    { e: 'sözleşme', u: 'Shartnoma', t: 'noun', l: 'pre-intermediate', ex: 'Sözleşmeyi imzalayın.', eu: "Shartnomani imzolang." },
    { e: 'aksine', u: 'Aksincha', t: 'preposition', l: 'pre-intermediate', ex: 'Aksine, çok çalıştı.', eu: "Aksincha, juda ko'p ishladi." },
    { e: 'meğer', u: 'Ma\'lum bo\'lishicha', t: 'conjunction', l: 'pre-intermediate', ex: 'Meğer o doktormuş.', eu: "Ma'lum bo'lishicha, u shifokor ekan." },
    { e: 'halbuki', u: 'Holbuki', t: 'conjunction', l: 'pre-intermediate', ex: 'O zengin, halbuki kardeşi fakir.', eu: "U boy, holbuki ukasi kambag'al." },
    { e: 'bu arada', u: 'Shu orada', t: 'adverb', l: 'pre-intermediate', ex: 'Yemek pişirdim; bu arada o masayı hazırladı.', eu: "Ovqat pishirdim; shu orada u dasturxon tayyorladi." },
    { e: 'boyunca', u: 'Davomida', t: 'preposition', l: 'pre-intermediate', ex: 'Yıl boyunca çok çalıştık.', eu: "Yil davomida ko'p ishladik." },
    { e: 'üstelik', u: "Qo'shimcha ravishda", t: 'adverb', l: 'pre-intermediate', ex: 'Üstelik çok nazik bir insan.', eu: "Qo'shimcha ravishda, u juda xushmuomala inson." },
    { e: 'ne yazık ki', u: 'Afsuski', t: 'adverb', l: 'pre-intermediate', ex: 'Ne yazık ki gelemedi.', eu: "Afsuski, kela olmadi." },
    { e: 'gerçekten', u: "Haqiqatan", t: 'adverb', l: 'pre-intermediate', ex: 'Gerçekten çok güzeldi.', eu: "Haqiqatan juda go'zal edi." },
    { e: 'kesinlikle', u: 'Mutlaqo', t: 'adverb', l: 'pre-intermediate', ex: 'Kesinlikle haklısın.', eu: "Mutlaqo haqlisiz." },
    { e: 'muhtemelen', u: 'Ehtimol', t: 'adverb', l: 'pre-intermediate', ex: 'Muhtemelen gelecek.', eu: "Ehtimol keladi." },
    { e: 'aslında', u: 'Aslida', t: 'adverb', l: 'pre-intermediate', ex: 'Aslında ben de bilmiyorum.', eu: "Aslida men ham bilmayman." },
    { e: 'bence', u: 'Menimcha', t: 'adverb', l: 'pre-intermediate', ex: 'Bence bu doğru değil.', eu: "Menimcha bu to'g'ri emas." },
    { e: 'bana göre', u: "Mening fikrimcha", t: 'phrase', l: 'pre-intermediate', ex: 'Bana göre en iyi film bu.', eu: "Mening fikrimcha eng yaxshi film bu." },
    { e: 'endişelenmek', u: "Xavotir olmoq", t: 'verb', l: 'pre-intermediate', ex: 'Endişelenme, her şey iyi olacak.', eu: "Xavotir olmang, hammasi yaxshi bo'ladi." },
    { e: 'denemek', u: 'Sinab ko\'rmoq', t: 'verb', l: 'pre-intermediate', ex: 'Tekrar dene!', eu: "Qayta sinab ko'r!" },
    { e: 'başarmak', u: 'Muvaffaqiyat qozonmoq', t: 'verb', l: 'pre-intermediate', ex: 'Sonunda başardık!', eu: "Nihoyat muvaffaqiyat qozondik!" },
    { e: 'devam etmek', u: 'Davom etmoq', t: 'verb', l: 'pre-intermediate', ex: 'Lütfen devam et.', eu: "Iltimos, davom eting." },
    { e: 'değiştirmek', u: "O'zgartirmoq", t: 'verb', l: 'pre-intermediate', ex: 'Fikrimi değiştirdim.', eu: "Fikrimni o'zgartirdim." },
    { e: 'karar vermek', u: 'Qaror qilmoq', t: 'verb', l: 'pre-intermediate', ex: 'Gitmeye karar verdim.', eu: "Ketishga qaror qildim." },
    { e: 'anlamak', u: 'Tushunmoq', t: 'verb', l: 'pre-intermediate', ex: 'Beni anlıyor musun?', eu: "Meni tushunyapsizmi?" },
    { e: 'inanmak', u: 'Ishonmoq', t: 'verb', l: 'pre-intermediate', ex: 'Kendine inan.', eu: "O'zingga ishon." },
    { e: 'ödemek', u: "To'lash", t: 'verb', l: 'pre-intermediate', ex: 'Faturayı ödedim.', eu: "Hisobni to'ladim." },

    // ADVANCED — İleri Seviye
    { e: 'nüans', u: 'Noziklik', t: 'noun', l: 'advanced', ex: 'Sözlerinin nüansı önemliydi.', eu: "So'zlarining nozikligi muhim edi." },
    { e: 'egemenlik', u: 'Suverenitet', t: 'noun', l: 'advanced', ex: 'Ulusal egemenlik çok önemlidir.', eu: "Milliy suverenitet muhimdir." },
    { e: 'belagat', u: 'Notiqlik', t: 'noun', l: 'advanced', ex: 'Belagati herkesi etkiledi.', eu: "Uning notiqligi hammani hayratda qoldirdi." },
    { e: 'paradigma', u: 'Paradigma', t: 'noun', l: 'advanced', ex: 'Yeni bir paradigma ortaya çıkıyor.', eu: "Yangi paradigma paydo bo'lmoqda." },
    { e: 'korelasyon', u: 'Korrelyatsiya', t: 'noun', l: 'advanced', ex: 'Korelasyon nedensellik anlamına gelmez.', eu: "Korrelyatsiya sababiyatni anglatmaydi." },
    { e: 'mevzuat', u: 'Qonunchilik', t: 'noun', l: 'advanced', ex: 'Yeni mevzuat kabul edildi.', eu: "Yangi qonun qabul qilindi." },
    { e: 'hafifletmek', u: 'Yumshatmoq', t: 'verb', l: 'advanced', ex: 'Riskleri hafifletmeliyiz.', eu: "Xavflarni yumshatishimiz kerak." },
    { e: 'eşi benzeri görülmemiş', u: "Misli ko'rilmagan", t: 'adjective', l: 'advanced', ex: 'Bu eşi benzeri görülmemiş bir durum.', eu: "Bu misli ko'rilmagan holat." },
    { e: 'titiz', u: 'Puxta, sinchkov', t: 'adjective', l: 'advanced', ex: 'İşinde çok titizdir.', eu: "Ishida juda puxta." },
    { e: 'belirsiz', u: 'Noaniq', t: 'adjective', l: 'advanced', ex: 'Açıklaması belirsizdi.', eu: "Uning bayonoti noaniq edi." },
    { e: 'tutarlı', u: 'Izchil, mantiqiy', t: 'adjective', l: 'advanced', ex: 'Tutarlı bir argüman yazın.', eu: "Izchil argument yozing." },
    { e: 'önemli', u: 'Muhim, sezilarli', t: 'adjective', l: 'advanced', ex: 'Önemli kanıtlar var.', eu: "Jiddiy dalillar mavjud." },
    { e: 'doğal', u: "O'ziga xos, tabiiy", t: 'adjective', l: 'advanced', ex: 'Doğal riskler vardır.', eu: "O'ziga xos xavflar mavjud." },
    { e: 'baskın', u: 'Ustunlik qiluvchi', t: 'adjective', l: 'advanced', ex: 'Türkçe baskın dildir.', eu: "Turk tili ustunlik qiluvchi til." },
    { e: 'ikna edici', u: 'Jozibali, ishonarli', t: 'adjective', l: 'advanced', ex: 'İkna edici bir argüman sundu.', eu: "Ishonarli argument keltirdi." },
    { e: 'tartışmalı', u: 'Bahsli, munozarali', t: 'adjective', l: 'advanced', ex: 'Bu tartışmalı bir konu.', eu: "Bu munozarali mavzu." },
    { e: 'pragmatik', u: 'Amaliy', t: 'adjective', l: 'advanced', ex: 'Pragmatik olun.', eu: "Amaliy bo'ling." },
    { e: 'katalizör', u: 'Katalizator', t: 'noun', l: 'advanced', ex: 'Buluş değişim için katalizör oldu.', eu: "Ixtiro o'zgarish uchun katalizator bo'ldi." },
    { e: 'demografik', u: 'Demografik', t: 'adjective', l: 'advanced', ex: 'Demografik değişimler önemli.', eu: "Demografik o'zgarishlar muhim." },
    { e: 'altyapı', u: 'Infratuzilma', t: 'noun', l: 'advanced', ex: 'Altyapıya yatırım yapmalıyız.', eu: "Infratuzilmaga investitsiya qilishimiz kerak." },
    { e: 'hipotez', u: 'Faraz', t: 'noun', l: 'advanced', ex: 'Hipotezinizi test edin.', eu: "Farazingizni sinab ko'ring." },
    { e: 'metodoloji', u: 'Metodologiya', t: 'noun', l: 'advanced', ex: 'Metodolojinizi açıklayın.', eu: "Metodologiyangizni tushuntiring." },
    { e: 'fenomen', u: 'Hodisa', t: 'noun', l: 'advanced', ex: 'Bu küresel bir fenomen.', eu: "Bu global hodisa." },
    { e: 'sonuçlar', u: 'Oqibatlar', t: 'noun', l: 'advanced', ex: 'Sonuçları düşünün.', eu: "Oqibatlarni ko'rib chiqing." },
    { e: 'bakış açısı', u: 'Nuqtai nazar', t: 'noun', l: 'advanced', ex: 'Farklı bir bakış açısı düşünün.', eu: "Boshqa nuqtai nazarni ko'rib chiqing." },
    { e: 'çerçeve', u: 'Tizim/Struktura', t: 'noun', l: 'advanced', ex: 'Net bir çerçeveye ihtiyacımız var.', eu: "Bizga aniq tizim kerak." },
    { e: 'retorik', u: 'Ritorika', t: 'noun', l: 'advanced', ex: 'Retoriği çok güçlüydü.', eu: "Uning ritorikasi kuchli edi." },
    { e: 'inceleme', u: 'Sinchkovlik bilan tekshirish', t: 'noun', l: 'advanced', ex: 'Plan incelemeye tabi tutuldu.', eu: "Reja sinchkovlik bilan tekshirildi." },
    { e: 'fikir birliği', u: 'Kelishuv', t: 'noun', l: 'advanced', ex: 'Fikir birliğine vardık.', eu: "Biz kelishuvga erishdik." },
    { e: 'savunmak', u: 'Himoya qilmoq', t: 'verb', l: 'advanced', ex: 'İnsan haklarını savunuyor.', eu: "Inson huquqlarini himoya qiladi." },
    { e: 'oluşturmak', u: 'Tashkil etmoq', t: 'verb', l: 'advanced', ex: 'Bu bir ihlal oluşturur.', eu: "Bu qoidabuzarlik tashkil etadi." },
    { e: 'kolaylaştırmak', u: 'Osonlashtirmoq', t: 'verb', l: 'advanced', ex: 'Teknoloji öğrenmeyi kolaylaştırır.', eu: "Texnologiya o'rganishni osonlashtiradi." },
    { e: 'detaylı incelemek', u: 'Diqqat bilan tekshirmoq', t: 'verb', l: 'advanced', ex: 'Verileri detaylı incelemeliyiz.', eu: "Ma'lumotlarni diqqat bilan tekshirishimiz kerak." },
    { e: 'ayrıntılı anlatmak', u: 'Batafsil bayon etmoq', t: 'verb', l: 'advanced', ex: 'Bunu ayrıntılı anlatabilir misin?', eu: "Bu haqida batafsil ayta olasizmi?" },
    { e: 'kabul etmek', u: 'Tan olmoq', t: 'verb', l: 'advanced', ex: 'Hatamı kabul ediyorum.', eu: "Xatoimni tan olaman." },
    { e: 'sürdürmek', u: 'Davom ettirmoq', t: 'verb', l: 'advanced', ex: 'Çabalarımızı sürdürmeliyiz.', eu: "Kuchlarimizni davom ettirishimiz kerak." },
    { e: '-e rağmen', u: 'Qaramasdan', t: 'preposition', l: 'advanced', ex: 'Zorluklara rağmen başardık.', eu: "Qiyinchiliklarga qaramasdan, muvaffaqiyat qozondik." },
    { e: 'her ne kadar', u: 'Garchi', t: 'conjunction', l: 'advanced', ex: 'Her ne kadar beklenmedik olsa da iyi bir sonuçtu.', eu: "Garchi kutilmagan bo'lsa ham, yaxshi natija edi." },
    { e: 'ölçüde', u: 'Darajada', t: 'conjunction', l: 'advanced', ex: 'Mümkün olduğu ölçüde yardım edeceğiz.', eu: "Imkon qadar yordam beramiz." },
    { e: 'yaklaşan', u: 'Yaqinlashayotgan', t: 'adjective', l: 'advanced', ex: 'Yaklaşan değişiklikler önemli.', eu: "Yaqinlashayotgan o'zgarishlar muhim." },
    { e: 'makul', u: "Ishonchli ko'rinadigan", t: 'adjective', l: 'advanced', ex: 'Bu makul görünüyor.', eu: "Bu ishonchli ko'rinadi." },
    { e: 'tutarlılık', u: 'Izchillik', t: 'noun', l: 'advanced', ex: 'Tutarlılık çok önemlidir.', eu: "Izchillik juda muhimdir." },
    { e: 'bütünlük', u: 'Butunlik/Yaxlitlik', t: 'noun', l: 'advanced', ex: 'Veri bütünlüğü sağlanmalıdır.', eu: "Ma'lumotlar yaxlitligi ta'minlanishi kerak." },
    { e: 'özgün', u: 'Originallik', t: 'adjective', l: 'advanced', ex: 'Özgün bir fikir.', eu: "Original fikr." },
    { e: 'geçerli', u: 'Kuchga ega/haqiqiy', t: 'adjective', l: 'advanced', ex: 'Geçerli bir nedeni var.', eu: "Haqiqiy sababi bor." },
    { e: 'güvenilir', u: 'Ishonchli', t: 'adjective', l: 'advanced', ex: 'Güvenilir bir kaynak.', eu: "Ishonchli manba." },
    { e: 'şeffaf', u: 'Shaffof', t: 'adjective', l: 'advanced', ex: 'Süreç şeffaf olmalı.', eu: "Jarayon shaffof bo'lishi kerak." },
    { e: 'kapsamlı', u: 'Keng qamrovli', t: 'adjective', l: 'advanced', ex: 'Kapsamlı bir rapor hazırladı.', eu: "Keng qamrovli hisobot tayyorladi." },
    { e: 'sürdürülebilir', u: 'Barqaror', t: 'adjective', l: 'advanced', ex: 'Sürdürülebilir kalkınma önemli.', eu: "Barqaror rivojlanish muhimdir." },
    { e: 'verimli', u: 'Samarali', t: 'adjective', l: 'advanced', ex: 'Verimli bir çalışma yöntemi.', eu: "Samarali ish usuli." },
    { e: 'analiz', u: 'Tahlil', t: 'noun', l: 'advanced', ex: 'Detaylı bir analiz yapıldı.', eu: "Batafsil tahlil o'tkazildi." },
    { e: 'strateji', u: 'Strategiya', t: 'noun', l: 'advanced', ex: 'Yeni bir strateji geliştirmeliyiz.', eu: "Yangi strategiya ishlab chiqishimiz kerak." },
    { e: 'politika', u: 'Siyosat', t: 'noun', l: 'advanced', ex: 'Şirket politikası bu.', eu: "Kompaniya siyosati shu." },
    { e: 'kriter', u: 'Mezon', t: 'noun', l: 'advanced', ex: 'Kriterleri karşılıyor musunuz?', eu: "Mezonlarga javob berasizmi?" },
    { e: 'gösterge', u: "Ko'rsatkich", t: 'noun', l: 'advanced', ex: 'Önemli bir göstergedir.', eu: "Muhim ko'rsatkichdir." },
    { e: 'perspektif', u: 'Perspektiv/Istiqbolli', t: 'noun', l: 'advanced', ex: 'Bu perspektiften bakalım.', eu: "Bu nuqtai nazardan qaraylik." },
    { e: 'değerlendirme', u: 'Baholash', t: 'noun', l: 'advanced', ex: 'Performans değerlendirmesi yapıldı.', eu: "Ish faoliyatini baholash o'tkazildi." },
    { e: 'iyileştirme', u: 'Yaxshilash', t: 'noun', l: 'advanced', ex: 'Sürekli iyileştirme hedefimiz.', eu: "Doimiy yaxshilash maqsadimiz." },
    { e: 'dönüşüm', u: "O'zgarish/Transformatsiya", t: 'noun', l: 'advanced', ex: 'Dijital dönüşüm hızlanıyor.', eu: "Raqamli transformatsiya tezlashmoqda." },
    { e: 'inovasyon', u: 'Innovatsiya', t: 'noun', l: 'advanced', ex: 'İnovasyon rekabet avantajı sağlar.', eu: "Innovatsiya raqobat ustunligi beradi." },
    { e: 'verimlilik', u: 'Samaradorlik', t: 'noun', l: 'advanced', ex: 'Verimlilik arttı.', eu: "Samaradorlik oshdi." },
    { e: 'etkinlik', u: 'Faoliyat/Samaradorlik', t: 'noun', l: 'advanced', ex: 'Etkinlik değerlendirmesi yapıldı.', eu: "Faoliyat baholandi." },
    { e: 'optimizasyon', u: 'Optimallashtirish', t: 'noun', l: 'advanced', ex: 'Süreç optimizasyonu gerekiyor.', eu: "Jarayonni optimallashtirish kerak." },
]
const ud = {
    beginner: [
        {
            id: 'b1', emoji: '👋', title: 'Selamlaşma', desc: "Salomlashish va tanishish", level: 'beginner',
            words: ['merhaba', 'güle güle', 'teşekkür ederim', 'lütfen', 'üzgünüm', 'evet', 'hayır', 'iyi', 'kötü', 'tamam'],
            xp: 50, coin: 20, grammar_rule: "Şahıs zamirleri: Ben, Sen, O... Türkçede fiil sonuna eklenir.",
            grammar_example: "Ben öğrenciyim. Sen arkadaşımsın. O öğretmendir.",
            reading_text: "Benim adım Ali. Ben Türkiye'denim. Her sabah komşularıma 'merhaba' derim. Gittiğimde 'güle güle' derim. Her zaman 'lütfen' ve 'teşekkür ederim' derim. İnsanlar çok kibar olduğumu söyler. Bence kibar olmak önemlidir.",
            reading_qs: [{ q: "Ali nereden?", opts: ["Amerika", "Türkiye", "Fransa", "Almanya"], c: 1 }, { q: "Ali gittiğinde ne diyor?", opts: ["Merhaba", "Teşekkür ederim", "Güle güle", "Lütfen"], c: 2 }, { q: "Ali neyi önemli buluyor?", opts: ["Para", "Kibar olmak", "Şöhret", "Güç"], c: 1 }]
        },
        {
            id: 'b2', emoji: '🔢', title: 'Sayılar', desc: 'Raqamlar va sanash', level: 'beginner',
            words: ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'],
            xp: 50, coin: 20, grammar_rule: 'Türkçede sayılar: bir, iki, üç... Sıra sayıları: birinci, ikinci, üçüncü',
            grammar_example: 'Üç kitabım var. O birinci öğrenci.',
            reading_text: "Ali'nin üç kedisi ve iki köpeği var. Her gün onları dört kez besler. Her hayvanla yaklaşık on dakika geçirir. Hafta sonları on beş saat boş vakti var. Kedilerine on iki oyuncak aldı. Beş üyeli hayvan ailesiyle çok mutlu.",
            reading_qs: [{ q: "Ali'nin kaç kedisi var?", opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 1 }, { q: 'Günde kaç kez besliyor?', opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 2 }, { q: 'Kaç oyuncak aldı?', opts: ['On', 'On iki', 'On beş', 'Yirmi'], c: 1 }]
        },
        {
            id: 'b3', emoji: '🎨', title: 'Renkler', desc: 'Turk tilida ranglar', level: 'beginner',
            words: ['kırmızı', 'mavi', 'yeşil', 'sarı', 'siyah', 'beyaz', 'turuncu', 'mor', 'pembe', 'kahverengi'],
            xp: 60, coin: 25, grammar_rule: 'Sıfatlar isimden önce gelir: kırmızı bir elma, mavi gökyüzü',
            grammar_example: 'Kırmızı bir çantası var. Mavi kuşlar görüyorum. Yeşil çimen yumuşak.',
            reading_text: 'Gökkuşağının yedi rengi vardır: kırmızı, turuncu, sarı, yeşil, mavi, lacivert ve mor. Kırmızı ateşin ve aşkın rengidir. Mavi gökyüzünün ve denizin rengidir. Yeşil ağaçların ve çimenin rengidir. Sarı güneşin rengidir. Siyah en koyu renktir. Beyaz en açık renktir. Renkler dünyamızı güzel yapar.',
            reading_qs: [{ q: 'Gökkuşağının kaç rengi vardır?', opts: ['Beş', 'Altı', 'Yedi', 'Sekiz'], c: 2 }, { q: 'Gökyüzünün rengi nedir?', opts: ['Kırmızı', 'Sarı', 'Yeşil', 'Mavi'], c: 3 }, { q: 'En koyu renk hangisidir?', opts: ['Kahverengi', 'Gri', 'Siyah', 'Mor'], c: 2 }]
        },
        {
            id: 'b4', emoji: '👨‍👩‍👧', title: 'Aile', desc: "Oila a'zolari", level: 'beginner',
            words: ['anne', 'baba', 'abla', 'erkek kardeş', 'arkadaş', 'öğretmen', 'öğrenci', 'isim', 'sevgi', 'mutlu'],
            xp: 60, coin: 25, grammar_rule: 'İyelik ekleri: -im, -in, -i, -imiz, -iniz, -leri',
            grammar_example: 'Annem naziktir. Babası çok çalışır. Aileleri büyük.',
            reading_text: 'Ailem beş kişiden oluşur. Babam doktor, annem öğretmendir. Bir erkek kardeşim ve bir ablam var. Erkek kardeşim benden büyük. Ablam benden küçük. Büyükannem ve büyükbabam yakında oturur. Her pazar onları ziyaret ederiz. Büyükbabam bize hikayeler anlatır. Büyükannem lezzetli yemekler pişirir. Aile benim için her şeydir.',
            reading_qs: [{ q: 'Aile kaç kişiden oluşur?', opts: ['Üç', 'Dört', 'Beş', 'Altı'], c: 2 }, { q: 'Babanın mesleği nedir?', opts: ['Öğretmen', 'Doktor', 'Mühendis', 'Şoför'], c: 1 }, { q: 'Ne zaman büyükanneleri ziyaret ederler?', opts: ['Cumartesi', 'Pazar', 'Pazartesi', 'Cuma'], c: 1 }]
        },
        {
            id: 'b5', emoji: '🍎', title: 'Yiyecek ve İçecek', desc: "Ovqat va ichimliklar", level: 'beginner',
            words: ['elma', 'ekmek', 'su', 'süt', 'pirinç', 'yumurta', 'et', 'balık', 'çay', 'kahve'],
            xp: 70, coin: 30, grammar_rule: 'Türkçede çoğul: -ler/-lar. Bir elma, iki elma (sayı varsa çoğul ek kullanılmaz)',
            grammar_example: 'Bir elma ve su istiyorum. O her sabah süt içer.',
            reading_text: 'Sağlıklı bir kahvaltı önemlidir. Birçok insan sabahları yumurta ve ekmek yer. Bazı insanlar elma ve portakal gibi meyveleri tercih eder. Çay ve kahve popüler içeceklerdir. Süt çocuklar için iyidir. Öğle yemeğinde pirinç ve et yaygındır. Balık çok sağlıklıdır. Her gün yeterince su için. İyi yemek sizi güçlü ve sağlıklı tutar.',
            reading_qs: [{ q: 'Sabahları ne önemlidir?', opts: ['Akşam yemeği', 'Öğle yemeği', 'Kahvaltı', 'Ara öğün'], c: 2 }, { q: 'Çocuklar için hangi içecek iyidir?', opts: ['Kahve', 'Çay', 'Süt', 'Meyve suyu'], c: 2 }, { q: 'Hangi yiyecek sağlıklı olarak tanımlanmıştır?', opts: ['Ekmek', 'Pirinç', 'Balık', 'Şeker'], c: 2 }]
        },
        {
            id: 'b6', emoji: '⏰', title: 'Zaman ve Günler', desc: 'Vaqt va kunlar', level: 'beginner',
            words: ['sabah', 'akşam', 'gece', 'gün', 'yıl', 'zaman', 'Pazartesi', 'Salı', 'Çarşamba', 'Cuma'],
            xp: 60, coin: 25, grammar_rule: 'Saat söyleme: Saat üç. Saat beş buçuk. Saat kaç?',
            grammar_example: 'Saat yedide uyanıyorum. Toplantı saat iki buçukta.',
            reading_text: 'Zaman yönetimi çok önemlidir. Bir haftada yedi gün vardır: Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi ve Pazar. Bir gün 24 saattir. Sabah ders çalışmak için en iyi zamandır. Akşam dinlenmek için iyidir. Birçok insan gece yorgun hisseder. İyi zaman yönetimi hedeflerinize ulaşmanıza yardımcı olur.',
            reading_qs: [{ q: 'Bir haftada kaç gün vardır?', opts: ['Beş', 'Altı', 'Yedi', 'Sekiz'], c: 2 }, { q: 'Ders çalışmak için en iyi zaman nedir?', opts: ['Gece', 'Akşam', 'Öğleden sonra', 'Sabah'], c: 3 }, { q: 'Bir gün kaç saattir?', opts: ['12', '24', '48', '7'], c: 1 }]
        },
    ],
    elementary: [
        {
            id: 'e1', emoji: '🏡', title: 'Ev ve Odalar', desc: 'Uy va xonalar', level: 'elementary',
            words: ['yatak odası', 'mutfak', 'banyo', 'bahçe', 'kapı', 'pencere', 'masa', 'sandalye', 'çanta', 'telefon'],
            xp: 80, coin: 35, grammar_rule: 'Var / Yok: Bir koltuk var. Üç yatak odası var.',
            grammar_example: 'Büyük bir mutfak var. İki banyo var. Bahçe var mı? Evet, var.',
            reading_text: 'Evim üç katlıdır. Zemin katta büyük bir oturma odası ve modern bir mutfak var. Oturma odasında rahat bir koltuk, bir sehpa ve büyük bir televizyon var. Mutfak en yeni aletlere sahip. Birinci katta üç yatak odası ve iki banyo var. Yatak odamın bahçe manzaralı büyük bir penceresi var. Bahçede güzel çiçekler ve küçük bir gölet var. Evimi seviyorum.',
            reading_qs: [{ q: 'Ev kaç katlıdır?', opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 1 }, { q: 'Yatak odaları nerede?', opts: ['Zemin kat', 'Birinci kat', 'Bahçe', 'Bodrum'], c: 1 }, { q: 'Bahçede ne var?', opts: ['Bir yüzme havuzu', 'Bir araba', 'Çiçekler ve bir gölet', 'Futbol sahası'], c: 2 }]
        },
        {
            id: 'e2', emoji: '💼', title: 'Meslekler', desc: 'Kasblar', level: 'elementary',
            words: ['doktor', 'öğretmen', 'mühendis', 'çiftçi', 'şoför', 'hemşire', 'avukat', 'aşçı', 'pilot', 'bilim insanı'],
            xp: 80, coin: 35, grammar_rule: 'Ne iş yapıyorsun? Ben bir...-im. O bir...-dir.',
            grammar_example: 'Ne iş yapıyorsun? Ben bir hemşireyim. O bir mühendis olarak çalışıyor.',
            reading_text: 'Dünyada birçok farklı meslek vardır. Doktorlar ve hemşireler hastanelerde çalışır ve hayat kurtarır. Öğretmenler yeni nesli eğitir. Mühendisler köprüler ve makineler inşa eder. Pilotlar uçakları uçurur. Aşçılar restoranlarda lezzetli yemekler yapar. İtfaiyeciler yangınları söndüren kahramanlardır. Gazeteciler haber yazar. Mimarlar güzel binalar tasarlar. Her meslek toplum için önemlidir. Sen ne olmak istersin?',
            reading_qs: [{ q: 'Doktorlar ve hemşireler nerede çalışır?', opts: ['Okullar', 'Fabrikalar', 'Hastaneler', 'Ofisler'], c: 2 }, { q: 'Mimarlar ne yapar?', opts: ['Yemek pişirir', 'Binalar tasarlar', 'Uçak uçurur', 'Haber yazar'], c: 1 }, { q: 'Gazeteciler ne yapar?', opts: ['Köprü inşa eder', 'Hayat kurtarır', 'Haber yazar', 'Çocuklara ders verir'], c: 2 }]
        },
        {
            id: 'e3', emoji: '🛒', title: 'Alışveriş', desc: 'Xarid qilish', level: 'elementary',
            words: ['pahalı', 'ucuz', 'satın almak', 'indirim', 'fiş', 'bilet', 'otel', 'menü', 'alışveriş', 'para'],
            xp: 90, coin: 40, grammar_rule: 'Ne kadar? ... TL. Kartla ödeyebilir miyim?',
            grammar_example: 'Bu gömlek ne kadar? 250 TL. Kartla ödeyebilir miyim? Tabii ki.',
            reading_text: 'Alışveriş çoğu insan için günlük bir aktivitedir. Süpermarketler yiyecek, içecek ve ev eşyaları satar. Büyük mağazalar kıyafet, elektronik ve mobilya satar. Satın almadan önce her zaman fiyatı kontrol edin. Para biriktirmek için indirimleri ve kampanyaları takip edin. Nakit veya kredi kartı ile ödeyebilirsiniz. Üründe sorun varsa iade isteyebilirsiniz. Fişinizi saklayın! Online alışveriş kullanışlı olduğu için giderek daha popüler hale geliyor.',
            reading_qs: [{ q: 'Kıyafet ve elektronik nereden satın alınır?', opts: ['Süpermarket', 'Büyük mağaza', 'Eczane', 'Fırın'], c: 1 }, { q: 'Satın aldıktan sonra ne saklanmalı?', opts: ['Poşet', 'Fiş', 'Etiket', 'Kutu'], c: 1 }, { q: 'Online alışveriş neden popüler?', opts: ['Daha ucuz', 'Daha hızlı', 'Kullanışlı', 'Eğlenceli'], c: 2 }]
        },
        {
            id: 'e4', emoji: '🎓', title: 'Okul ve Eğitim', desc: "Maktab va ta'lim", level: 'elementary',
            words: ['ders', 'konu', 'ödev', 'sınıf', 'sınav', 'not', 'kütüphane', 'çalışmak', 'açıklamak', 'hatırlamak'],
            xp: 90, coin: 40, grammar_rule: 'Geniş Zaman: Ben her gün çalışırım. O okula gider.',
            grammar_example: 'Her akşam Türkçe çalışırım. O akşam yemeğinden önce ödevini yapar.',
            reading_text: 'Eğitim kendinize verebileceğiniz en önemli hediyedir. Okulda öğrenciler birçok konu öğrenir: matematik, fen, tarih, coğrafya ve diller. Ödevler öğrencilerin öğrendiklerini pratik yapmasına yardımcı olur. Kütüphaneler kitap bulmak ve araştırma yapmak için harika yerlerdir. Sınavlar bilginizi test eder. İyi notlar almak konuyu anladığınızı gösterir. Ama eğitim sadece notlarla ilgili değildir — düşünmeyi öğrenmekle ilgilidir.',
            reading_qs: [{ q: 'Sınavlar neyi test eder?', opts: ['Hızınızı', 'Bilginizi', 'Hafızanızı', 'Yaşınızı'], c: 1 }, { q: 'Kütüphane ne için iyidir?', opts: ['Oyun oynamak', 'Yemek yemek', 'Kitap bulmak ve araştırma', 'Film izlemek'], c: 2 }, { q: 'Eğitim sadece neyle ilgili değildir?', opts: ['Öğrenme', 'Düşünme', 'Notlar', 'Anlama'], c: 2 }]
        },
        {
            id: 'e5', emoji: '🌍', title: 'Seyahat ve Yerler', desc: 'Sayohat va joylar', level: 'elementary',
            words: ['seyahat', 'havaalanı', 'otel', 'bilet', 'yol tarifi', 'restoran', 'dağ', 'nehir', 'deniz', 'orman'],
            xp: 100, coin: 45, grammar_rule: 'Geçmiş Zaman (Görülen): -dı/-di/-du/-dü. Ben gittim, O geldi.',
            grammar_example: 'Geçen yaz İstanbul\'u ziyaret ettim. Güzel bir otelde kaldık ve yerel yemekler yedik.',
            reading_text: 'Seyahat etmek dünyayı öğrenmenin en iyi yollarından biridir. Seyahat ettiğinizde yeni yerler, kültürler ve diller keşfedersiniz. Seyahatten önce bilet ve otel rezervasyonu yapmalısınız. Havaalanında check-in yapar ve pasaport kontrolünden geçersiniz. Uçakta manzaranın tadını çıkarabilirsiniz. Vardığınızda yerel yemekleri ve turistik yerleri keşfedin. Dağlar, nehirler, denizler ve ormanlar inanılmaz doğal güzellikler sunar. Seyahat ufkunuzu genişletir.',
            reading_qs: [{ q: 'Seyahatten önce ne yapmalısınız?', opts: ['Hediyelik eşya almak', 'Bilet ve otel ayırtmak', 'Yemek pişirmeyi öğrenmek', 'Yeni kıyafet almak'], c: 1 }, { q: 'Uçuş için nerede check-in yaparsınız?', opts: ['Tren istasyonu', 'Otobüs durağı', 'Havaalanı', 'Otel'], c: 2 }, { q: 'Seyahat neyi genişletir?', opts: ['Kafanızı karıştırır', 'Ufkunuzu genişletir', 'Yorar', 'Kapatır'], c: 1 }]
        },
    ],
    'pre-intermediate': [
        {
            id: 'p1', emoji: '🔮', title: 'Gelecek Planları', desc: 'Kelajak zamonlari', level: 'pre-intermediate',
            words: ['ancak', 'rağmen', 'fırsat', 'başarı', 'hedef', 'başarmak', 'geliştirmek', 'kariyer', 'eğitim', 'deneyim'],
            xp: 130, coin: 60, grammar_rule: 'Gelecek Zaman: -ecek/-acak ekleri. Yarın gideceğim. Planlar için kullanılır.',
            grammar_example: 'Yarın seni arayacağım. O tıp okuyacak. Muhtemelen zamanında gelmeyecekler.',
            reading_text: 'Gelecek için plan yapmak önemlidir. Net hedefler belirlemek başarıya ulaşmanıza yardımcı olur. Kısa vadeli hedefler birkaç hafta veya ay sürer. Uzun vadeli hedefler yıllar alabilir. Plan yaparken yeteneklerinizi ve isteklerinizi göz önünde bulundurun. Bazı insanlar iş kurmayı hayal eder. Diğerleri dünyayı gezmek ister. Eğitim ve kariyer planlaması gençler için önemlidir. Finansal planlama emeklilik için birikim yapmanıza yardımcı olur. Unutmayın, planlar değişebilir. Esneklik kararlılık kadar önemlidir.',
            reading_qs: [{ q: 'Kısa vadeli hedefler ne kadar sürer?', opts: ['Yıllar', 'On yıllar', 'Birkaç hafta veya ay', 'Bir ömür'], c: 2 }, { q: 'Kararlılık kadar önemli olan nedir?', opts: ['Para', 'Esneklik', 'Eğitim', 'Güç'], c: 1 }, { q: 'Finansal planlama ne için yardımcı olur?', opts: ['Tatil', 'Emeklilik', 'Eğitim', 'Alışveriş'], c: 1 }]
        },
        {
            id: 'p2', emoji: '🎯', title: 'Şimdiki Zaman', desc: "Hozirgi zamon (continuous)", level: 'pre-intermediate',
            words: ['bu nedenle', 'üstelik', 'çözüm', 'sorumluluk', 'gerekli', 'öneri', 'karşılaştırma', 'rapor', 'proje', 'bütçe'],
            xp: 140, coin: 65, grammar_rule: 'Şimdiki Zaman: -iyor eki. Ben gidiyorum. O yemek yiyor. Sürekli eylemler için.',
            grammar_example: 'Şimdi ders çalışıyorum. O akşam yemeği pişiriyor. Onlar bahçede oynuyor.',
            reading_text: 'Türkçede şimdiki zaman sürekli eylemleri anlatır. "-iyor" eki fiile eklenir: gelmek → geliyorum, okumak → okuyorum. Şimdiki zaman şu anda olan eylemler için kullanılır. Ayrıca yakın gelecekteki planlar için de kullanılabilir: "Yarın İstanbul\'a gidiyorum." Bu zamanı öğrenmek Türkçe akıcılık için önemli bir adımdır.',
            reading_qs: [{ q: 'Şimdiki zaman hangi eki alır?', opts: ['-di', '-miş', '-iyor', '-ecek'], c: 2 }, { q: 'Şimdiki zaman ne için kullanılmaz?', opts: ['Şu anki eylemler', 'Yakın gelecek planları', 'Geçmiş alışkanlıklar', 'Sürekli durumlar'], c: 2 }, { q: 'Örnek: "Yarın İstanbul\'a gidiyorum" hangi anlamda?', opts: ['Geçmiş', 'Şimdiki', 'Gelecek planı', 'Alışkanlık'], c: 2 }]
        },
        {
            id: 'p3', emoji: '💬', title: 'Şart Kipleri', desc: 'Shart gaplar', level: 'pre-intermediate',
            words: ['yönetmek', 'çözmek', 'artırmak', 'azaltmak', 'önermek', 'karşılaştırmak', 'müşteri', 'sözleşme', 'maaş', 'iş arkadaşı'],
            xp: 150, coin: 70, grammar_rule: 'Şart kipi: -se/-sa eki. Gelirsem... Yapsaydım... Keşke...',
            grammar_example: 'Yağmur yağarsa evde kalırım. Çalışırsam başarırım. Zengin olsaydım seyahat ederdim.',
            reading_text: 'Şart cümleleri olası durumları ve sonuçlarını tanımlar. "-se/-sa" eki ile yapılır. Gerçek şart: "Çalışırsan başarırsın." Gerçek dışı şart: "Keşke daha çok çalışsaydım." Türkçede şart kipi günlük hayatta çok kullanılır. Bu yapıyı bilmek size karmaşık fikirleri ifade etme imkanı verir.',
            reading_qs: [{ q: 'Şart kipi hangi eki alır?', opts: ['-di/-miş', '-se/-sa', '-iyor', '-ecek'], c: 1 }, { q: '"Çalışırsan başarırsın" ne tür bir şarttır?', opts: ['Gerçek dışı', 'Gerçek', 'Geçmiş', 'Gelecek'], c: 1 }, { q: 'Gerçek dışı şart hangi kelimeyle başlar?', opts: ['Eğer', 'Keşke', 'Belki', 'Sanki'], c: 1 }]
        },
    ],
    advanced: [
        {
            id: 'a1', emoji: '🖊️', title: 'Akademik Yazma', desc: 'Akademik yozuv', level: 'advanced',
            words: ['nüans', 'belagat', 'paradigma', 'korelasyon', 'mevzuat', 'tutarlı', 'ikna edici', 'tartışmalı', 'pragmatik', 'katalizör'],
            xp: 200, coin: 90, grammar_rule: 'Bağlaçlar: ancak, bununla birlikte, bu nedenle, oysaki, üstelik, yine de.',
            grammar_example: 'Veriler hipotezi açıkça desteklemektedir. Bununla birlikte, önceki araştırmalar da bu bulguları doğrulamaktadır. Ancak bazı sınırlamalar kabul edilmelidir.',
            reading_text: 'Akademik yazma kesinlik, açıklık ve mantıksal tutarlılık gerektirir. Her argüman güvenilir kaynaklardan kanıtlarla desteklenmelidir. Bağlaçlar ve geçiş ifadeleri fikirler arasındaki ilişkileri gösterir: "üstelik" bilgi ekler, "oysaki" zıtlık sunar, "bu nedenle" sonuç belirtir. Gayriresmi dil, kısaltmalar ve kişisel anekdotlardan kaçının. Güçlü bir sonuç, yeni bilgi eklemeden argümanı özetlemelidir.',
            reading_qs: [{ q: '"Üstelik" neyi ifade eder?', opts: ['Zıtlık', 'Sonuç', 'Ek bilgi', 'Şart'], c: 2 }, { q: 'Gayriresmi dilden kaçınmak neden önemlidir?', opts: ['Daha kısa olmak için', 'Akademik ciddiyet için', 'Daha kolay için', 'Daha süslü için'], c: 1 }, { q: 'Güçlü bir sonuç ne yapmalıdır?', opts: ['Yeni fikirler eklemeli', 'Girişi tekrarlamalı', 'Argümanı özetlemeli', 'Daha fazla kanıt eklemeli'], c: 2 }]
        },
        {
            id: 'a2', emoji: '📋', title: 'İleri Düzey Yazma', desc: 'IELTS Yozuv Vazifalar', level: 'advanced',
            words: ['eşi benzeri görülmemiş', 'titiz', 'belirsiz', 'önemli', 'baskın', 'fenomen', 'bakış açısı', 'retorik', 'savunmak', 'detaylı incelemek'],
            xp: 250, coin: 110, grammar_rule: 'Dolaylı anlatım: Dedi ki... Sordu ki... İstedi ki... (Fiil çekimleri değişir)',
            grammar_example: 'Genel olarak, internet kullanımının çarpıcı biçimde arttığı açıktır. Oran %5\'ten %60\'a yükselmiş, 2018\'de zirve yapmıştır.',
            reading_text: 'İleri düzey Türkçe yazma, sadece doğru dil bilgisi değil, aynı zamanda akıcılık ve kelime çeşitliliği gerektirir. Makalelerde giriş, gelişme ve sonuç bölümleri bulunmalıdır. Her paragraf tek bir ana fikir etrafında düzenlenmelidir. Giriş bölümü okuyucuyu konuya hazırlar. Gelişme bölümü argümanları sunar. Sonuç bölümü ana noktaları özetler ve genel bir değerlendirme yapar.',
            reading_qs: [{ q: 'İleri düzey yazma ne gerektirir?', opts: ['Sadece gramer', 'Sadece kelime', 'Gramar ve akıcılık', 'Sadece uzunluk'], c: 2 }, { q: 'Her paragraf ne etrafında düzenlenmelidir?', opts: ['Birden çok fikir', 'Tek bir ana fikir', 'Rastgele', 'Zamana göre'], c: 1 }, { q: 'Sonuç bölümü ne yapar?', opts: ['Yeni fikir ekler', 'Girişi tekrarlar', 'Ana noktaları özetler', 'Hikaye anlatır'], c: 2 }]
        },
        {
            id: 'a3', emoji: '🎤', title: 'İleri Düzey Konuşma', desc: 'IELTS Speaking & Presentation', level: 'advanced',
            words: ['hipotez', 'metodoloji', 'analiz', 'strateji', 'değerlendirme', 'iyileştirme', 'dönüşüm', 'inovasyon', 'optimizasyon', 'perspektif'],
            xp: 220, coin: 100, grammar_rule: 'Dolaylı ifadeler: Söylenebilir ki... Görünüyor ki... Kanıtlar gösteriyor ki...',
            grammar_example: 'Sosyal medyanın iletişimi temelden değiştirdiği söylenebilir. Kanıtlar gençlerin çevrimiçi daha fazla zaman geçirdiğini göstermektedir.',
            reading_text: 'İleri düzey Türkçe konuşma, sadece doğru dil bilgisi değil, akıcılık ve kelime çeşitliliği gerektirir. Konuşurken dolaylı ifadeler kullanmak daha akademik bir ton sağlar. Cevaplarınızı örnekler, nedenler ve karşılaştırmalarla genişletin. Tekrardan kaçınmak için eş anlamlı kelimeler kullanın. Vurgu ve tonlama da iletişiminizi etkiler.',
            reading_qs: [{ q: 'Dolaylı ifadeler ne sağlar?', opts: ['Daha kesin', 'Daha akademik ton', 'Daha hızlı', 'Daha kısa'], c: 1 }, { q: 'Tekrardan kaçınmak için ne kullanılır?', opts: ['Eş anlamlılar', 'Uzun cümleler', 'Kısa cevaplar', 'Sorular'], c: 0 }, { q: 'Cevaplar neyle genişletilmelidir?', opts: ['Sessizlik', 'Örnekler ve nedenler', 'Evet/hayır', 'El hareketleri'], c: 1 }]
        },
    ]
};
// ════════════════════════════════════════
// 400+ EXERCISES DATABASE
// ════════════════════════════════════════

// LISTENING exercises (80+)
const LISTEN_EX = [
    { text: "Günaydın! Bugün hava güneşli ve sıcak. Hafif kıyafetler giymenizi öneririm. Sıcaklık yaklaşık 25 derece. İyi günler dilerim!", q: "Hava nasıl?", opts: ["Soğuk ve yağmurlu", "Güneşli ve sıcak", "Bulutlu ve rüzgarlı", "Karlı"], c: 1, level: 'beginner' },
    { text: "Merhaba, bu Şehir Kütüphanesi. Pazartesiden Cumaya 9'dan 6'ya kadar, Cumartesi günleri ise 10'dan 4'e kadar açığız. Pazar günleri kapalıyız. Görüşmek üzere!", q: "Kütüphane ne zaman kapalı?", opts: ["Pazartesi", "Cumartesi", "Pazar", "Cuma"], c: 2, level: 'beginner' },
    { text: "Sevgili yolcular! Ankara'ya giden tren 7 numaralı perondan saat üç buçukta kalkacaktır. Lütfen biletlerinizi hazır bulundurun. Teşekkür ederiz.", q: "Tren hangi perondan kalkıyor?", opts: ["Peron 5", "Peron 6", "Peron 7", "Peron 8"], c: 2, level: 'beginner' },
    { text: "Merhaba! İş ilanı hakkında arıyorum. Pazarlama alanında beş yıllık tecrübem var. Üç dil biliyorum: Türkçe, İngilizce ve Fransızca.", q: "Arayan kaç dil biliyor?", opts: ["İki", "Üç", "Dört", "Beş"], c: 1, level: 'elementary' },
    { text: "Sağlık Kliniğine hoş geldiniz. Acil bir durum varsa 1'e basın. Randevu için 2'ye basın. Test sonuçları için 3'e basın.", q: "Randevu almak için hangi tuşa basmalısınız?", opts: ["1", "2", "3", "0"], c: 1, level: 'elementary' },
    { text: "Bilim Müzesi'ne okul gezisi 15 Perşembe günü. Öğrenciler yanlarında öğle yemeği getirmeli ve rahat ayakkabı giymelidir. Otobüs saat 8:30'da kalkıyor.", q: "Okul gezisi ne zaman?", opts: ["Pazartesi", "Salı", "Çarşamba", "Perşembe"], c: 3, level: 'beginner' },
    { text: "İstanbul'a giden TK202 uçağı için yolcularımıza duyuru. Biniş yaklaşık 20 dakika içinde 12 numaralı kapıda başlayacaktır.", q: "Duyuru hangi uçuş için?", opts: ["TK201", "TK202", "TK203", "TK204"], c: 1, level: 'elementary' },
    { text: "Kafenin bugünkü spesiyali domates çorbası ve taze ekmek, ardından ızgara tavuk ve sebze. Fiyat 250 lira. Tatlı ekstra.", q: "Bugünkü ana yemek nedir?", opts: ["Domates çorbası", "Izgara balık", "Izgara tavuk", "Makarna"], c: 2, level: 'beginner' },
    { text: "Merhaba Ali, ben Ayşe. Toplantımıza yaklaşık 15 dakika geç kalacağımı söylemek için arıyorum. Saat iki buçukta orada olurum.", q: "Ayşe kaç dakika geç kalacak?", opts: ["5 dakika", "10 dakika", "15 dakika", "20 dakika"], c: 2, level: 'beginner' },
    { text: "İyi akşamlar. Bu akşamki program saat yedide haberlerle başlıyor. Ardından saat yedi buçukta okyanus yaşamı hakkında bir belgesel var.", q: "Belgesel saat kaçta başlıyor?", opts: ["Saat yedi", "Saat yedi buçuk", "Saat sekiz", "Saat dokuz"], c: 1, level: 'beginner' },
    { text: "Spor merkezi bakım nedeniyle Pazartesiden Çarşambaya kadar kapalı olacaktır. Perşembe günü yeniden açılacaktır.", q: "Spor merkezi ne zaman açılacak?", opts: ["Pazartesi", "Salı", "Çarşamba", "Perşembe"], c: 3, level: 'elementary' },
    { text: "Türkçe Dil Okulu'na hoş geldiniz. Yeni kursumuz İş Türkçesi 1 Eylül'de başlıyor. Dersler Salı ve Perşembe akşamları 6'dan 8'e.", q: "Yeni kurs ne zaman başlıyor?", opts: ["1 Ağustos", "1 Eylül", "1 Ekim", "1 Kasım"], c: 1, level: 'elementary' },
    { text: "Müze haftanın yedi günü açıktır. Yetişkin biletleri 50 lira. 12 yaş altı çocuklar ücretsiz. Emeklilere %20 indirim.", q: "Çocuk biletleri ne kadar?", opts: ["50 lira", "25 lira", "10 lira", "Ücretsiz"], c: 3, level: 'elementary' },
    { text: "Araştırmalar düzenli egzersiz yapan insanların yapmayanlardan ortalama yedi yıl daha uzun yaşadığını gösteriyor.", q: "Düzenli egzersiz yapanlar kaç yıl daha uzun yaşıyor?", opts: ["Beş", "Altı", "Yedi", "Sekiz"], c: 2, level: 'pre-intermediate' },
    { text: "Son bir ankette, gençlerin %68'i televizyon izlemek yerine çevrimiçi videoları tercih ettiğini söyledi.", q: "Yüzde kaç çevrimiçi videoları tercih ediyor?", opts: ["%22", "%45", "%68", "%80"], c: 2, level: 'pre-intermediate' },
    { text: "Günaydın sınıf. Bugün iklim değişikliğini tartışacağız. Sanayi devriminden bu yana Dünya'nın sıcaklığı yaklaşık 1.1 derece arttı.", q: "Dünya'nın sıcaklığı ne kadar arttı?", opts: ["0.5 derece", "1.1 derece", "1.5 derece", "2 derece"], c: 1, level: 'pre-intermediate' },
    { text: "Yeni politika 1 Ocak'ta yürürlüğe girecek. Tüm çalışanlar bu tarihten önce eğitim modülünü tamamlamalıdır.", q: "Yeni politika ne zaman yürürlüğe girecek?", opts: ["1 Aralık", "1 Ocak", "1 Şubat", "1 Mart"], c: 1, level: 'elementary' },
    { text: "Bu podcast uyku ve üretkenlik arasındaki bağlantıya odaklanıyor. Yetişkinlerin 7-9 saat uykuya ihtiyacı vardır.", q: "Yetişkinler kaç saat uyumalıdır?", opts: ["5-6", "6-7", "7-9", "9-10"], c: 2, level: 'pre-intermediate' },
    { text: "Bayanlar ve baylar, şimdi varış noktamıza yaklaşıyoruz. Yerel saat öğleden sonra dördü çeyrek geçiyor.", q: "Yerel saat nedir?", opts: ["Dörde çeyrek var", "Dördü çeyrek geçiyor", "Dört buçuk", "Saat dört"], c: 1, level: 'beginner' },
    { text: "Müdürle görüşebilir miyim? Üç hafta önce çevrimiçi bir bilgisayar sipariş ettim ve henüz gelmedi.", q: "Müşteri ne kadar süredir bekliyor?", opts: ["Bir hafta", "İki hafta", "Üç hafta", "Bir ay"], c: 2, level: 'elementary' },
    { text: "Yapay zeka konferansı üç gün sürecek. Birinci gün makine öğrenimi, ikinci gün doğal dil işleme.", q: "İkinci günün konusu nedir?", opts: ["Makine öğrenimi", "Etik", "Doğal dil işleme", "Robotik"], c: 2, level: 'advanced' },
    { text: "Ekonomistler gelecek yıl büyümede yavaşlama öngörüyor. Enflasyon %4.2'ye ulaştı, bu on yılın en yüksek seviyesi.", q: "Enflasyon ne kadar?", opts: ["%3.2", "%4.2", "%5.2", "%6.2"], c: 1, level: 'advanced' },
    { text: "Antik Romalılar Avrupa, Kuzey Afrika ve Orta Doğu'da 400.000 kilometreyi aşan yollar inşa etti.", q: "Roma yolları ne kadar uzanıyordu?", opts: ["100,000 km", "200,000 km", "300,000 km", "400,000 km"], c: 3, level: 'pre-intermediate' },
    { text: "Bu ceketi iade etmek istiyorum. Geçen hafta aldım ama eve geldiğimde kolunda küçük bir yırtık fark ettim.", q: "Ceketteki sorun nedir?", opts: ["Yanlış beden", "Yanlış renk", "Kolunda yırtık", "Fermuar bozuk"], c: 2, level: 'elementary' },
    { text: "Şirket bu çeyrekte rekor kar bildirdi, özellikle Asya pazarlarındaki güçlü satışlarla. Gelir geçen yıla göre %23 arttı.", q: "Gelir ne kadar arttı?", opts: ["%13", "%18", "%23", "%30"], c: 2, level: 'advanced' },
]; const ud = {
    beginner: [
        {
            id: 'b1', emoji: '👋', title: 'Selamlaşma', desc: "Salomlashish va tanishish", level: 'beginner',
            words: ['merhaba', 'güle güle', 'teşekkür ederim', 'lütfen', 'üzgünüm', 'evet', 'hayır', 'iyi', 'kötü', 'tamam'],
            xp: 50, coin: 20, grammar_rule: "Şahıs zamirleri: Ben, Sen, O... Türkçede fiil sonuna eklenir.",
            grammar_example: "Ben öğrenciyim. Sen arkadaşımsın. O öğretmendir.",
            reading_text: "Benim adım Ali. Ben Türkiye'denim. Her sabah komşularıma 'merhaba' derim. Gittiğimde 'güle güle' derim. Her zaman 'lütfen' ve 'teşekkür ederim' derim. İnsanlar çok kibar olduğumu söyler. Bence kibar olmak önemlidir.",
            reading_qs: [{ q: "Ali nereden?", opts: ["Amerika", "Türkiye", "Fransa", "Almanya"], c: 1 }, { q: "Ali gittiğinde ne diyor?", opts: ["Merhaba", "Teşekkür ederim", "Güle güle", "Lütfen"], c: 2 }, { q: "Ali neyi önemli buluyor?", opts: ["Para", "Kibar olmak", "Şöhret", "Güç"], c: 1 }]
        },
        {
            id: 'b2', emoji: '🔢', title: 'Sayılar', desc: 'Raqamlar va sanash', level: 'beginner',
            words: ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'],
            xp: 50, coin: 20, grammar_rule: 'Türkçede sayılar: bir, iki, üç... Sıra sayıları: birinci, ikinci, üçüncü',
            grammar_example: 'Üç kitabım var. O birinci öğrenci.',
            reading_text: "Ali'nin üç kedisi ve iki köpeği var. Her gün onları dört kez besler. Her hayvanla yaklaşık on dakika geçirir. Hafta sonları on beş saat boş vakti var. Kedilerine on iki oyuncak aldı. Beş üyeli hayvan ailesiyle çok mutlu.",
            reading_qs: [{ q: "Ali'nin kaç kedisi var?", opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 1 }, { q: 'Günde kaç kez besliyor?', opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 2 }, { q: 'Kaç oyuncak aldı?', opts: ['On', 'On iki', 'On beş', 'Yirmi'], c: 1 }]
        },
        {
            id: 'b3', emoji: '🎨', title: 'Renkler', desc: 'Turk tilida ranglar', level: 'beginner',
            words: ['kırmızı', 'mavi', 'yeşil', 'sarı', 'siyah', 'beyaz', 'turuncu', 'mor', 'pembe', 'kahverengi'],
            xp: 60, coin: 25, grammar_rule: 'Sıfatlar isimden önce gelir: kırmızı bir elma, mavi gökyüzü',
            grammar_example: 'Kırmızı bir çantası var. Mavi kuşlar görüyorum. Yeşil çimen yumuşak.',
            reading_text: 'Gökkuşağının yedi rengi vardır: kırmızı, turuncu, sarı, yeşil, mavi, lacivert ve mor. Kırmızı ateşin ve aşkın rengidir. Mavi gökyüzünün ve denizin rengidir. Yeşil ağaçların ve çimenin rengidir. Sarı güneşin rengidir. Siyah en koyu renktir. Beyaz en açık renktir. Renkler dünyamızı güzel yapar.',
            reading_qs: [{ q: 'Gökkuşağının kaç rengi vardır?', opts: ['Beş', 'Altı', 'Yedi', 'Sekiz'], c: 2 }, { q: 'Gökyüzünün rengi nedir?', opts: ['Kırmızı', 'Sarı', 'Yeşil', 'Mavi'], c: 3 }, { q: 'En koyu renk hangisidir?', opts: ['Kahverengi', 'Gri', 'Siyah', 'Mor'], c: 2 }]
        },
        {
            id: 'b4', emoji: '👨‍👩‍👧', title: 'Aile', desc: "Oila a'zolari", level: 'beginner',
            words: ['anne', 'baba', 'abla', 'erkek kardeş', 'arkadaş', 'öğretmen', 'öğrenci', 'isim', 'sevgi', 'mutlu'],
            xp: 60, coin: 25, grammar_rule: 'İyelik ekleri: -im, -in, -i, -imiz, -iniz, -leri',
            grammar_example: 'Annem naziktir. Babası çok çalışır. Aileleri büyük.',
            reading_text: 'Ailem beş kişiden oluşur. Babam doktor, annem öğretmendir. Bir erkek kardeşim ve bir ablam var. Erkek kardeşim benden büyük. Ablam benden küçük. Büyükannem ve büyükbabam yakında oturur. Her pazar onları ziyaret ederiz. Büyükbabam bize hikayeler anlatır. Büyükannem lezzetli yemekler pişirir. Aile benim için her şeydir.',
            reading_qs: [{ q: 'Aile kaç kişiden oluşur?', opts: ['Üç', 'Dört', 'Beş', 'Altı'], c: 2 }, { q: 'Babanın mesleği nedir?', opts: ['Öğretmen', 'Doktor', 'Mühendis', 'Şoför'], c: 1 }, { q: 'Ne zaman büyükanneleri ziyaret ederler?', opts: ['Cumartesi', 'Pazar', 'Pazartesi', 'Cuma'], c: 1 }]
        },
        {
            id: 'b5', emoji: '🍎', title: 'Yiyecek ve İçecek', desc: "Ovqat va ichimliklar", level: 'beginner',
            words: ['elma', 'ekmek', 'su', 'süt', 'pirinç', 'yumurta', 'et', 'balık', 'çay', 'kahve'],
            xp: 70, coin: 30, grammar_rule: 'Türkçede çoğul: -ler/-lar. Bir elma, iki elma (sayı varsa çoğul ek kullanılmaz)',
            grammar_example: 'Bir elma ve su istiyorum. O her sabah süt içer.',
            reading_text: 'Sağlıklı bir kahvaltı önemlidir. Birçok insan sabahları yumurta ve ekmek yer. Bazı insanlar elma ve portakal gibi meyveleri tercih eder. Çay ve kahve popüler içeceklerdir. Süt çocuklar için iyidir. Öğle yemeğinde pirinç ve et yaygındır. Balık çok sağlıklıdır. Her gün yeterince su için. İyi yemek sizi güçlü ve sağlıklı tutar.',
            reading_qs: [{ q: 'Sabahları ne önemlidir?', opts: ['Akşam yemeği', 'Öğle yemeği', 'Kahvaltı', 'Ara öğün'], c: 2 }, { q: 'Çocuklar için hangi içecek iyidir?', opts: ['Kahve', 'Çay', 'Süt', 'Meyve suyu'], c: 2 }, { q: 'Hangi yiyecek sağlıklı olarak tanımlanmıştır?', opts: ['Ekmek', 'Pirinç', 'Balık', 'Şeker'], c: 2 }]
        },
        {
            id: 'b6', emoji: '⏰', title: 'Zaman ve Günler', desc: 'Vaqt va kunlar', level: 'beginner',
            words: ['sabah', 'akşam', 'gece', 'gün', 'yıl', 'zaman', 'Pazartesi', 'Salı', 'Çarşamba', 'Cuma'],
            xp: 60, coin: 25, grammar_rule: 'Saat söyleme: Saat üç. Saat beş buçuk. Saat kaç?',
            grammar_example: 'Saat yedide uyanıyorum. Toplantı saat iki buçukta.',
            reading_text: 'Zaman yönetimi çok önemlidir. Bir haftada yedi gün vardır: Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi ve Pazar. Bir gün 24 saattir. Sabah ders çalışmak için en iyi zamandır. Akşam dinlenmek için iyidir. Birçok insan gece yorgun hisseder. İyi zaman yönetimi hedeflerinize ulaşmanıza yardımcı olur.',
            reading_qs: [{ q: 'Bir haftada kaç gün vardır?', opts: ['Beş', 'Altı', 'Yedi', 'Sekiz'], c: 2 }, { q: 'Ders çalışmak için en iyi zaman nedir?', opts: ['Gece', 'Akşam', 'Öğleden sonra', 'Sabah'], c: 3 }, { q: 'Bir gün kaç saattir?', opts: ['12', '24', '48', '7'], c: 1 }]
        },
    ],
    elementary: [
        {
            id: 'e1', emoji: '🏡', title: 'Ev ve Odalar', desc: 'Uy va xonalar', level: 'elementary',
            words: ['yatak odası', 'mutfak', 'banyo', 'bahçe', 'kapı', 'pencere', 'masa', 'sandalye', 'çanta', 'telefon'],
            xp: 80, coin: 35, grammar_rule: 'Var / Yok: Bir koltuk var. Üç yatak odası var.',
            grammar_example: 'Büyük bir mutfak var. İki banyo var. Bahçe var mı? Evet, var.',
            reading_text: 'Evim üç katlıdır. Zemin katta büyük bir oturma odası ve modern bir mutfak var. Oturma odasında rahat bir koltuk, bir sehpa ve büyük bir televizyon var. Mutfak en yeni aletlere sahip. Birinci katta üç yatak odası ve iki banyo var. Yatak odamın bahçe manzaralı büyük bir penceresi var. Bahçede güzel çiçekler ve küçük bir gölet var. Evimi seviyorum.',
            reading_qs: [{ q: 'Ev kaç katlıdır?', opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 1 }, { q: 'Yatak odaları nerede?', opts: ['Zemin kat', 'Birinci kat', 'Bahçe', 'Bodrum'], c: 1 }, { q: 'Bahçede ne var?', opts: ['Bir yüzme havuzu', 'Bir araba', 'Çiçekler ve bir gölet', 'Futbol sahası'], c: 2 }]
        },
        {
            id: 'e2', emoji: '💼', title: 'Meslekler', desc: 'Kasblar', level: 'elementary',
            words: ['doktor', 'öğretmen', 'mühendis', 'çiftçi', 'şoför', 'hemşire', 'avukat', 'aşçı', 'pilot', 'bilim insanı'],
            xp: 80, coin: 35, grammar_rule: 'Ne iş yapıyorsun? Ben bir...-im. O bir...-dir.',
            grammar_example: 'Ne iş yapıyorsun? Ben bir hemşireyim. O bir mühendis olarak çalışıyor.',
            reading_text: 'Dünyada birçok farklı meslek vardır. Doktorlar ve hemşireler hastanelerde çalışır ve hayat kurtarır. Öğretmenler yeni nesli eğitir. Mühendisler köprüler ve makineler inşa eder. Pilotlar uçakları uçurur. Aşçılar restoranlarda lezzetli yemekler yapar. İtfaiyeciler yangınları söndüren kahramanlardır. Gazeteciler haber yazar. Mimarlar güzel binalar tasarlar. Her meslek toplum için önemlidir. Sen ne olmak istersin?',
            reading_qs: [{ q: 'Doktorlar ve hemşireler nerede çalışır?', opts: ['Okullar', 'Fabrikalar', 'Hastaneler', 'Ofisler'], c: 2 }, { q: 'Mimarlar ne yapar?', opts: ['Yemek pişirir', 'Binalar tasarlar', 'Uçak uçurur', 'Haber yazar'], c: 1 }, { q: 'Gazeteciler ne yapar?', opts: ['Köprü inşa eder', 'Hayat kurtarır', 'Haber yazar', 'Çocuklara ders verir'], c: 2 }]
        },
        {
            id: 'e3', emoji: '🛒', title: 'Alışveriş', desc: 'Xarid qilish', level: 'elementary',
            words: ['pahalı', 'ucuz', 'satın almak', 'indirim', 'fiş', 'bilet', 'otel', 'menü', 'alışveriş', 'para'],
            xp: 90, coin: 40, grammar_rule: 'Ne kadar? ... TL. Kartla ödeyebilir miyim?',
            grammar_example: 'Bu gömlek ne kadar? 250 TL. Kartla ödeyebilir miyim? Tabii ki.',
            reading_text: 'Alışveriş çoğu insan için günlük bir aktivitedir. Süpermarketler yiyecek, içecek ve ev eşyaları satar. Büyük mağazalar kıyafet, elektronik ve mobilya satar. Satın almadan önce her zaman fiyatı kontrol edin. Para biriktirmek için indirimleri ve kampanyaları takip edin. Nakit veya kredi kartı ile ödeyebilirsiniz. Üründe sorun varsa iade isteyebilirsiniz. Fişinizi saklayın! Online alışveriş kullanışlı olduğu için giderek daha popüler hale geliyor.',
            reading_qs: [{ q: 'Kıyafet ve elektronik nereden satın alınır?', opts: ['Süpermarket', 'Büyük mağaza', 'Eczane', 'Fırın'], c: 1 }, { q: 'Satın aldıktan sonra ne saklanmalı?', opts: ['Poşet', 'Fiş', 'Etiket', 'Kutu'], c: 1 }, { q: 'Online alışveriş neden popüler?', opts: ['Daha ucuz', 'Daha hızlı', 'Kullanışlı', 'Eğlenceli'], c: 2 }]
        },
        {
            id: 'e4', emoji: '🎓', title: 'Okul ve Eğitim', desc: "Maktab va ta'lim", level: 'elementary',
            words: ['ders', 'konu', 'ödev', 'sınıf', 'sınav', 'not', 'kütüphane', 'çalışmak', 'açıklamak', 'hatırlamak'],
            xp: 90, coin: 40, grammar_rule: 'Geniş Zaman: Ben her gün çalışırım. O okula gider.',
            grammar_example: 'Her akşam Türkçe çalışırım. O akşam yemeğinden önce ödevini yapar.',
            reading_text: 'Eğitim kendinize verebileceğiniz en önemli hediyedir. Okulda öğrenciler birçok konu öğrenir: matematik, fen, tarih, coğrafya ve diller. Ödevler öğrencilerin öğrendiklerini pratik yapmasına yardımcı olur. Kütüphaneler kitap bulmak ve araştırma yapmak için harika yerlerdir. Sınavlar bilginizi test eder. İyi notlar almak konuyu anladığınızı gösterir. Ama eğitim sadece notlarla ilgili değildir — düşünmeyi öğrenmekle ilgilidir.',
            reading_qs: [{ q: 'Sınavlar neyi test eder?', opts: ['Hızınızı', 'Bilginizi', 'Hafızanızı', 'Yaşınızı'], c: 1 }, { q: 'Kütüphane ne için iyidir?', opts: ['Oyun oynamak', 'Yemek yemek', 'Kitap bulmak ve araştırma', 'Film izlemek'], c: 2 }, { q: 'Eğitim sadece neyle ilgili değildir?', opts: ['Öğrenme', 'Düşünme', 'Notlar', 'Anlama'], c: 2 }]
        },
        {
            id: 'e5', emoji: '🌍', title: 'Seyahat ve Yerler', desc: 'Sayohat va joylar', level: 'elementary',
            words: ['seyahat', 'havaalanı', 'otel', 'bilet', 'yol tarifi', 'restoran', 'dağ', 'nehir', 'deniz', 'orman'],
            xp: 100, coin: 45, grammar_rule: 'Geçmiş Zaman (Görülen): -dı/-di/-du/-dü. Ben gittim, O geldi.',
            grammar_example: 'Geçen yaz İstanbul\'u ziyaret ettim. Güzel bir otelde kaldık ve yerel yemekler yedik.',
            reading_text: 'Seyahat etmek dünyayı öğrenmenin en iyi yollarından biridir. Seyahat ettiğinizde yeni yerler, kültürler ve diller keşfedersiniz. Seyahatten önce bilet ve otel rezervasyonu yapmalısınız. Havaalanında check-in yapar ve pasaport kontrolünden geçersiniz. Uçakta manzaranın tadını çıkarabilirsiniz. Vardığınızda yerel yemekleri ve turistik yerleri keşfedin. Dağlar, nehirler, denizler ve ormanlar inanılmaz doğal güzellikler sunar. Seyahat ufkunuzu genişletir.',
            reading_qs: [{ q: 'Seyahatten önce ne yapmalısınız?', opts: ['Hediyelik eşya almak', 'Bilet ve otel ayırtmak', 'Yemek pişirmeyi öğrenmek', 'Yeni kıyafet almak'], c: 1 }, { q: 'Uçuş için nerede check-in yaparsınız?', opts: ['Tren istasyonu', 'Otobüs durağı', 'Havaalanı', 'Otel'], c: 2 }, { q: 'Seyahat neyi genişletir?', opts: ['Kafanızı karıştırır', 'Ufkunuzu genişletir', 'Yorar', 'Kapatır'], c: 1 }]
        },
    ],
    'pre-intermediate': [
        {
            id: 'p1', emoji: '🔮', title: 'Gelecek Planları', desc: 'Kelajak zamonlari', level: 'pre-intermediate',
            words: ['ancak', 'rağmen', 'fırsat', 'başarı', 'hedef', 'başarmak', 'geliştirmek', 'kariyer', 'eğitim', 'deneyim'],
            xp: 130, coin: 60, grammar_rule: 'Gelecek Zaman: -ecek/-acak ekleri. Yarın gideceğim. Planlar için kullanılır.',
            grammar_example: 'Yarın seni arayacağım. O tıp okuyacak. Muhtemelen zamanında gelmeyecekler.',
            reading_text: 'Gelecek için plan yapmak önemlidir. Net hedefler belirlemek başarıya ulaşmanıza yardımcı olur. Kısa vadeli hedefler birkaç hafta veya ay sürer. Uzun vadeli hedefler yıllar alabilir. Plan yaparken yeteneklerinizi ve isteklerinizi göz önünde bulundurun. Bazı insanlar iş kurmayı hayal eder. Diğerleri dünyayı gezmek ister. Eğitim ve kariyer planlaması gençler için önemlidir. Finansal planlama emeklilik için birikim yapmanıza yardımcı olur. Unutmayın, planlar değişebilir. Esneklik kararlılık kadar önemlidir.',
            reading_qs: [{ q: 'Kısa vadeli hedefler ne kadar sürer?', opts: ['Yıllar', 'On yıllar', 'Birkaç hafta veya ay', 'Bir ömür'], c: 2 }, { q: 'Kararlılık kadar önemli olan nedir?', opts: ['Para', 'Esneklik', 'Eğitim', 'Güç'], c: 1 }, { q: 'Finansal planlama ne için yardımcı olur?', opts: ['Tatil', 'Emeklilik', 'Eğitim', 'Alışveriş'], c: 1 }]
        },
        {
            id: 'p2', emoji: '🎯', title: 'Şimdiki Zaman', desc: "Hozirgi zamon (continuous)", level: 'pre-intermediate',
            words: ['bu nedenle', 'üstelik', 'çözüm', 'sorumluluk', 'gerekli', 'öneri', 'karşılaştırma', 'rapor', 'proje', 'bütçe'],
            xp: 140, coin: 65, grammar_rule: 'Şimdiki Zaman: -iyor eki. Ben gidiyorum. O yemek yiyor. Sürekli eylemler için.',
            grammar_example: 'Şimdi ders çalışıyorum. O akşam yemeği pişiriyor. Onlar bahçede oynuyor.',
            reading_text: 'Türkçede şimdiki zaman sürekli eylemleri anlatır. "-iyor" eki fiile eklenir: gelmek → geliyorum, okumak → okuyorum. Şimdiki zaman şu anda olan eylemler için kullanılır. Ayrıca yakın gelecekteki planlar için de kullanılabilir: "Yarın İstanbul\'a gidiyorum." Bu zamanı öğrenmek Türkçe akıcılık için önemli bir adımdır.',
            reading_qs: [{ q: 'Şimdiki zaman hangi eki alır?', opts: ['-di', '-miş', '-iyor', '-ecek'], c: 2 }, { q: 'Şimdiki zaman ne için kullanılmaz?', opts: ['Şu anki eylemler', 'Yakın gelecek planları', 'Geçmiş alışkanlıklar', 'Sürekli durumlar'], c: 2 }, { q: 'Örnek: "Yarın İstanbul\'a gidiyorum" hangi anlamda?', opts: ['Geçmiş', 'Şimdiki', 'Gelecek planı', 'Alışkanlık'], c: 2 }]
        },
        {
            id: 'p3', emoji: '💬', title: 'Şart Kipleri', desc: 'Shart gaplar', level: 'pre-intermediate',
            words: ['yönetmek', 'çözmek', 'artırmak', 'azaltmak', 'önermek', 'karşılaştırmak', 'müşteri', 'sözleşme', 'maaş', 'iş arkadaşı'],
            xp: 150, coin: 70, grammar_rule: 'Şart kipi: -se/-sa eki. Gelirsem... Yapsaydım... Keşke...',
            grammar_example: 'Yağmur yağarsa evde kalırım. Çalışırsam başarırım. Zengin olsaydım seyahat ederdim.',
            reading_text: 'Şart cümleleri olası durumları ve sonuçlarını tanımlar. "-se/-sa" eki ile yapılır. Gerçek şart: "Çalışırsan başarırsın." Gerçek dışı şart: "Keşke daha çok çalışsaydım." Türkçede şart kipi günlük hayatta çok kullanılır. Bu yapıyı bilmek size karmaşık fikirleri ifade etme imkanı verir.',
            reading_qs: [{ q: 'Şart kipi hangi eki alır?', opts: ['-di/-miş', '-se/-sa', '-iyor', '-ecek'], c: 1 }, { q: '"Çalışırsan başarırsın" ne tür bir şarttır?', opts: ['Gerçek dışı', 'Gerçek', 'Geçmiş', 'Gelecek'], c: 1 }, { q: 'Gerçek dışı şart hangi kelimeyle başlar?', opts: ['Eğer', 'Keşke', 'Belki', 'Sanki'], c: 1 }]
        },
    ],
    advanced: [
        {
            id: 'a1', emoji: '🖊️', title: 'Akademik Yazma', desc: 'Akademik yozuv', level: 'advanced',
            words: ['nüans', 'belagat', 'paradigma', 'korelasyon', 'mevzuat', 'tutarlı', 'ikna edici', 'tartışmalı', 'pragmatik', 'katalizör'],
            xp: 200, coin: 90, grammar_rule: 'Bağlaçlar: ancak, bununla birlikte, bu nedenle, oysaki, üstelik, yine de.',
            grammar_example: 'Veriler hipotezi açıkça desteklemektedir. Bununla birlikte, önceki araştırmalar da bu bulguları doğrulamaktadır. Ancak bazı sınırlamalar kabul edilmelidir.',
            reading_text: 'Akademik yazma kesinlik, açıklık ve mantıksal tutarlılık gerektirir. Her argüman güvenilir kaynaklardan kanıtlarla desteklenmelidir. Bağlaçlar ve geçiş ifadeleri fikirler arasındaki ilişkileri gösterir: "üstelik" bilgi ekler, "oysaki" zıtlık sunar, "bu nedenle" sonuç belirtir. Gayriresmi dil, kısaltmalar ve kişisel anekdotlardan kaçının. Güçlü bir sonuç, yeni bilgi eklemeden argümanı özetlemelidir.',
            reading_qs: [{ q: '"Üstelik" neyi ifade eder?', opts: ['Zıtlık', 'Sonuç', 'Ek bilgi', 'Şart'], c: 2 }, { q: 'Gayriresmi dilden kaçınmak neden önemlidir?', opts: ['Daha kısa olmak için', 'Akademik ciddiyet için', 'Daha kolay için', 'Daha süslü için'], c: 1 }, { q: 'Güçlü bir sonuç ne yapmalıdır?', opts: ['Yeni fikirler eklemeli', 'Girişi tekrarlamalı', 'Argümanı özetlemeli', 'Daha fazla kanıt eklemeli'], c: 2 }]
        },
        {
            id: 'a2', emoji: '📋', title: 'İleri Düzey Yazma', desc: 'IELTS Yozuv Vazifalar', level: 'advanced',
            words: ['eşi benzeri görülmemiş', 'titiz', 'belirsiz', 'önemli', 'baskın', 'fenomen', 'bakış açısı', 'retorik', 'savunmak', 'detaylı incelemek'],
            xp: 250, coin: 110, grammar_rule: 'Dolaylı anlatım: Dedi ki... Sordu ki... İstedi ki... (Fiil çekimleri değişir)',
            grammar_example: 'Genel olarak, internet kullanımının çarpıcı biçimde arttığı açıktır. Oran %5\'ten %60\'a yükselmiş, 2018\'de zirve yapmıştır.',
            reading_text: 'İleri düzey Türkçe yazma, sadece doğru dil bilgisi değil, aynı zamanda akıcılık ve kelime çeşitliliği gerektirir. Makalelerde giriş, gelişme ve sonuç bölümleri bulunmalıdır. Her paragraf tek bir ana fikir etrafında düzenlenmelidir. Giriş bölümü okuyucuyu konuya hazırlar. Gelişme bölümü argümanları sunar. Sonuç bölümü ana noktaları özetler ve genel bir değerlendirme yapar.',
            reading_qs: [{ q: 'İleri düzey yazma ne gerektirir?', opts: ['Sadece gramer', 'Sadece kelime', 'Gramar ve akıcılık', 'Sadece uzunluk'], c: 2 }, { q: 'Her paragraf ne etrafında düzenlenmelidir?', opts: ['Birden çok fikir', 'Tek bir ana fikir', 'Rastgele', 'Zamana göre'], c: 1 }, { q: 'Sonuç bölümü ne yapar?', opts: ['Yeni fikir ekler', 'Girişi tekrarlar', 'Ana noktaları özetler', 'Hikaye anlatır'], c: 2 }]
        },
        {
            id: 'a3', emoji: '🎤', title: 'İleri Düzey Konuşma', desc: 'IELTS Speaking & Presentation', level: 'advanced',
            words: ['hipotez', 'metodoloji', 'analiz', 'strateji', 'değerlendirme', 'iyileştirme', 'dönüşüm', 'inovasyon', 'optimizasyon', 'perspektif'],
            xp: 220, coin: 100, grammar_rule: 'Dolaylı ifadeler: Söylenebilir ki... Görünüyor ki... Kanıtlar gösteriyor ki...',
            grammar_example: 'Sosyal medyanın iletişimi temelden değiştirdiği söylenebilir. Kanıtlar gençlerin çevrimiçi daha fazla zaman geçirdiğini göstermektedir.',
            reading_text: 'İleri düzey Türkçe konuşma, sadece doğru dil bilgisi değil, akıcılık ve kelime çeşitliliği gerektirir. Konuşurken dolaylı ifadeler kullanmak daha akademik bir ton sağlar. Cevaplarınızı örnekler, nedenler ve karşılaştırmalarla genişletin. Tekrardan kaçınmak için eş anlamlı kelimeler kullanın. Vurgu ve tonlama da iletişiminizi etkiler.',
            reading_qs: [{ q: 'Dolaylı ifadeler ne sağlar?', opts: ['Daha kesin', 'Daha akademik ton', 'Daha hızlı', 'Daha kısa'], c: 1 }, { q: 'Tekrardan kaçınmak için ne kullanılır?', opts: ['Eş anlamlılar', 'Uzun cümleler', 'Kısa cevaplar', 'Sorular'], c: 0 }, { q: 'Cevaplar neyle genişletilmelidir?', opts: ['Sessizlik', 'Örnekler ve nedenler', 'Evet/hayır', 'El hareketleri'], c: 1 }]
        },
    ]
};
// ----------------------------------------
// 400+ EXERCISES DATABASE
// ----------------------------------------

async function ensureTurkishAll() {
    const cacheKey = 'turkish_all_v2';
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) { }
    if (cached && cached.units && Object.keys(cached.units).length > 0) {
        applyTurkishCache(cached);
        return;
    }
    try {
        const levels = ['beginner', 'elementary', 'intermediate', 'upperintermediate', 'advanced']; const ud = {
            beginner: [
                {
                    id: 'b1', emoji: '👋', title: 'Selamlaşma', desc: "Salomlashish va tanishish", level: 'beginner',
                    words: ['merhaba', 'güle güle', 'teşekkür ederim', 'lütfen', 'üzgünüm', 'evet', 'hayır', 'iyi', 'kötü', 'tamam'],
                    xp: 50, coin: 20, grammar_rule: "Şahıs zamirleri: Ben, Sen, O... Türkçede fiil sonuna eklenir.",
                    grammar_example: "Ben öğrenciyim. Sen arkadaşımsın. O öğretmendir.",
                    reading_text: "Benim adım Ali. Ben Türkiye'denim. Her sabah komşularıma 'merhaba' derim. Gittiğimde 'güle güle' derim. Her zaman 'lütfen' ve 'teşekkür ederim' derim. İnsanlar çok kibar olduğumu söyler. Bence kibar olmak önemlidir.",
                    reading_qs: [{ q: "Ali nereden?", opts: ["Amerika", "Türkiye", "Fransa", "Almanya"], c: 1 }, { q: "Ali gittiğinde ne diyor?", opts: ["Merhaba", "Teşekkür ederim", "Güle güle", "Lütfen"], c: 2 }, { q: "Ali neyi önemli buluyor?", opts: ["Para", "Kibar olmak", "Şöhret", "Güç"], c: 1 }]
                },
                {
                    id: 'b2', emoji: '🔢', title: 'Sayılar', desc: 'Raqamlar va sanash', level: 'beginner',
                    words: ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'],
                    xp: 50, coin: 20, grammar_rule: 'Türkçede sayılar: bir, iki, üç... Sıra sayıları: birinci, ikinci, üçüncü',
                    grammar_example: 'Üç kitabım var. O birinci öğrenci.',
                    reading_text: "Ali'nin üç kedisi ve iki köpeği var. Her gün onları dört kez besler. Her hayvanla yaklaşık on dakika geçirir. Hafta sonları on beş saat boş vakti var. Kedilerine on iki oyuncak aldı. Beş üyeli hayvan ailesiyle çok mutlu.",
                    reading_qs: [{ q: "Ali'nin kaç kedisi var?", opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 1 }, { q: 'Günde kaç kez besliyor?', opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 2 }, { q: 'Kaç oyuncak aldı?', opts: ['On', 'On iki', 'On beş', 'Yirmi'], c: 1 }]
                },
                {
                    id: 'b3', emoji: '🎨', title: 'Renkler', desc: 'Turk tilida ranglar', level: 'beginner',
                    words: ['kırmızı', 'mavi', 'yeşil', 'sarı', 'siyah', 'beyaz', 'turuncu', 'mor', 'pembe', 'kahverengi'],
                    xp: 60, coin: 25, grammar_rule: 'Sıfatlar isimden önce gelir: kırmızı bir elma, mavi gökyüzü',
                    grammar_example: 'Kırmızı bir çantası var. Mavi kuşlar görüyorum. Yeşil çimen yumuşak.',
                    reading_text: 'Gökkuşağının yedi rengi vardır: kırmızı, turuncu, sarı, yeşil, mavi, lacivert ve mor. Kırmızı ateşin ve aşkın rengidir. Mavi gökyüzünün ve denizin rengidir. Yeşil ağaçların ve çimenin rengidir. Sarı güneşin rengidir. Siyah en koyu renktir. Beyaz en açık renktir. Renkler dünyamızı güzel yapar.',
                    reading_qs: [{ q: 'Gökkuşağının kaç rengi vardır?', opts: ['Beş', 'Altı', 'Yedi', 'Sekiz'], c: 2 }, { q: 'Gökyüzünün rengi nedir?', opts: ['Kırmızı', 'Sarı', 'Yeşil', 'Mavi'], c: 3 }, { q: 'En koyu renk hangisidir?', opts: ['Kahverengi', 'Gri', 'Siyah', 'Mor'], c: 2 }]
                },
                {
                    id: 'b4', emoji: '👨‍👩‍👧', title: 'Aile', desc: "Oila a'zolari", level: 'beginner',
                    words: ['anne', 'baba', 'abla', 'erkek kardeş', 'arkadaş', 'öğretmen', 'öğrenci', 'isim', 'sevgi', 'mutlu'],
                    xp: 60, coin: 25, grammar_rule: 'İyelik ekleri: -im, -in, -i, -imiz, -iniz, -leri',
                    grammar_example: 'Annem naziktir. Babası çok çalışır. Aileleri büyük.',
                    reading_text: 'Ailem beş kişiden oluşur. Babam doktor, annem öğretmendir. Bir erkek kardeşim ve bir ablam var. Erkek kardeşim benden büyük. Ablam benden küçük. Büyükannem ve büyükbabam yakında oturur. Her pazar onları ziyaret ederiz. Büyükbabam bize hikayeler anlatır. Büyükannem lezzetli yemekler pişirir. Aile benim için her şeydir.',
                    reading_qs: [{ q: 'Aile kaç kişiden oluşur?', opts: ['Üç', 'Dört', 'Beş', 'Altı'], c: 2 }, { q: 'Babanın mesleği nedir?', opts: ['Öğretmen', 'Doktor', 'Mühendis', 'Şoför'], c: 1 }, { q: 'Ne zaman büyükanneleri ziyaret ederler?', opts: ['Cumartesi', 'Pazar', 'Pazartesi', 'Cuma'], c: 1 }]
                },
                {
                    id: 'b5', emoji: '🍎', title: 'Yiyecek ve İçecek', desc: "Ovqat va ichimliklar", level: 'beginner',
                    words: ['elma', 'ekmek', 'su', 'süt', 'pirinç', 'yumurta', 'et', 'balık', 'çay', 'kahve'],
                    xp: 70, coin: 30, grammar_rule: 'Türkçede çoğul: -ler/-lar. Bir elma, iki elma (sayı varsa çoğul ek kullanılmaz)',
                    grammar_example: 'Bir elma ve su istiyorum. O her sabah süt içer.',
                    reading_text: 'Sağlıklı bir kahvaltı önemlidir. Birçok insan sabahları yumurta ve ekmek yer. Bazı insanlar elma ve portakal gibi meyveleri tercih eder. Çay ve kahve popüler içeceklerdir. Süt çocuklar için iyidir. Öğle yemeğinde pirinç ve et yaygındır. Balık çok sağlıklıdır. Her gün yeterince su için. İyi yemek sizi güçlü ve sağlıklı tutar.',
                    reading_qs: [{ q: 'Sabahları ne önemlidir?', opts: ['Akşam yemeği', 'Öğle yemeği', 'Kahvaltı', 'Ara öğün'], c: 2 }, { q: 'Çocuklar için hangi içecek iyidir?', opts: ['Kahve', 'Çay', 'Süt', 'Meyve suyu'], c: 2 }, { q: 'Hangi yiyecek sağlıklı olarak tanımlanmıştır?', opts: ['Ekmek', 'Pirinç', 'Balık', 'Şeker'], c: 2 }]
                },
                {
                    id: 'b6', emoji: '⏰', title: 'Zaman ve Günler', desc: 'Vaqt va kunlar', level: 'beginner',
                    words: ['sabah', 'akşam', 'gece', 'gün', 'yıl', 'zaman', 'Pazartesi', 'Salı', 'Çarşamba', 'Cuma'],
                    xp: 60, coin: 25, grammar_rule: 'Saat söyleme: Saat üç. Saat beş buçuk. Saat kaç?',
                    grammar_example: 'Saat yedide uyanıyorum. Toplantı saat iki buçukta.',
                    reading_text: 'Zaman yönetimi çok önemlidir. Bir haftada yedi gün vardır: Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi ve Pazar. Bir gün 24 saattir. Sabah ders çalışmak için en iyi zamandır. Akşam dinlenmek için iyidir. Birçok insan gece yorgun hisseder. İyi zaman yönetimi hedeflerinize ulaşmanıza yardımcı olur.',
                    reading_qs: [{ q: 'Bir haftada kaç gün vardır?', opts: ['Beş', 'Altı', 'Yedi', 'Sekiz'], c: 2 }, { q: 'Ders çalışmak için en iyi zaman nedir?', opts: ['Gece', 'Akşam', 'Öğleden sonra', 'Sabah'], c: 3 }, { q: 'Bir gün kaç saattir?', opts: ['12', '24', '48', '7'], c: 1 }]
                },
            ],
            elementary: [
                {
                    id: 'e1', emoji: '🏡', title: 'Ev ve Odalar', desc: 'Uy va xonalar', level: 'elementary',
                    words: ['yatak odası', 'mutfak', 'banyo', 'bahçe', 'kapı', 'pencere', 'masa', 'sandalye', 'çanta', 'telefon'],
                    xp: 80, coin: 35, grammar_rule: 'Var / Yok: Bir koltuk var. Üç yatak odası var.',
                    grammar_example: 'Büyük bir mutfak var. İki banyo var. Bahçe var mı? Evet, var.',
                    reading_text: 'Evim üç katlıdır. Zemin katta büyük bir oturma odası ve modern bir mutfak var. Oturma odasında rahat bir koltuk, bir sehpa ve büyük bir televizyon var. Mutfak en yeni aletlere sahip. Birinci katta üç yatak odası ve iki banyo var. Yatak odamın bahçe manzaralı büyük bir penceresi var. Bahçede güzel çiçekler ve küçük bir gölet var. Evimi seviyorum.',
                    reading_qs: [{ q: 'Ev kaç katlıdır?', opts: ['İki', 'Üç', 'Dört', 'Beş'], c: 1 }, { q: 'Yatak odaları nerede?', opts: ['Zemin kat', 'Birinci kat', 'Bahçe', 'Bodrum'], c: 1 }, { q: 'Bahçede ne var?', opts: ['Bir yüzme havuzu', 'Bir araba', 'Çiçekler ve bir gölet', 'Futbol sahası'], c: 2 }]
                },
                {
                    id: 'e2', emoji: '💼', title: 'Meslekler', desc: 'Kasblar', level: 'elementary',
                    words: ['doktor', 'öğretmen', 'mühendis', 'çiftçi', 'şoför', 'hemşire', 'avukat', 'aşçı', 'pilot', 'bilim insanı'],
                    xp: 80, coin: 35, grammar_rule: 'Ne iş yapıyorsun? Ben bir...-im. O bir...-dir.',
                    grammar_example: 'Ne iş yapıyorsun? Ben bir hemşireyim. O bir mühendis olarak çalışıyor.',
                    reading_text: 'Dünyada birçok farklı meslek vardır. Doktorlar ve hemşireler hastanelerde çalışır ve hayat kurtarır. Öğretmenler yeni nesli eğitir. Mühendisler köprüler ve makineler inşa eder. Pilotlar uçakları uçurur. Aşçılar restoranlarda lezzetli yemekler yapar. İtfaiyeciler yangınları söndüren kahramanlardır. Gazeteciler haber yazar. Mimarlar güzel binalar tasarlar. Her meslek toplum için önemlidir. Sen ne olmak istersin?',
                    reading_qs: [{ q: 'Doktorlar ve hemşireler nerede çalışır?', opts: ['Okullar', 'Fabrikalar', 'Hastaneler', 'Ofisler'], c: 2 }, { q: 'Mimarlar ne yapar?', opts: ['Yemek pişirir', 'Binalar tasarlar', 'Uçak uçurur', 'Haber yazar'], c: 1 }, { q: 'Gazeteciler ne yapar?', opts: ['Köprü inşa eder', 'Hayat kurtarır', 'Haber yazar', 'Çocuklara ders verir'], c: 2 }]
                },
                {
                    id: 'e3', emoji: '🛒', title: 'Alışveriş', desc: 'Xarid qilish', level: 'elementary',
                    words: ['pahalı', 'ucuz', 'satın almak', 'indirim', 'fiş', 'bilet', 'otel', 'menü', 'alışveriş', 'para'],
                    xp: 90, coin: 40, grammar_rule: 'Ne kadar? ... TL. Kartla ödeyebilir miyim?',
                    grammar_example: 'Bu gömlek ne kadar? 250 TL. Kartla ödeyebilir miyim? Tabii ki.',
                    reading_text: 'Alışveriş çoğu insan için günlük bir aktivitedir. Süpermarketler yiyecek, içecek ve ev eşyaları satar. Büyük mağazalar kıyafet, elektronik ve mobilya satar. Satın almadan önce her zaman fiyatı kontrol edin. Para biriktirmek için indirimleri ve kampanyaları takip edin. Nakit veya kredi kartı ile ödeyebilirsiniz. Üründe sorun varsa iade isteyebilirsiniz. Fişinizi saklayın! Online alışveriş kullanışlı olduğu için giderek daha popüler hale geliyor.',
                    reading_qs: [{ q: 'Kıyafet ve elektronik nereden satın alınır?', opts: ['Süpermarket', 'Büyük mağaza', 'Eczane', 'Fırın'], c: 1 }, { q: 'Satın aldıktan sonra ne saklanmalı?', opts: ['Poşet', 'Fiş', 'Etiket', 'Kutu'], c: 1 }, { q: 'Online alışveriş neden popüler?', opts: ['Daha ucuz', 'Daha hızlı', 'Kullanışlı', 'Eğlenceli'], c: 2 }]
                },
                {
                    id: 'e4', emoji: '🎓', title: 'Okul ve Eğitim', desc: "Maktab va ta'lim", level: 'elementary',
                    words: ['ders', 'konu', 'ödev', 'sınıf', 'sınav', 'not', 'kütüphane', 'çalışmak', 'açıklamak', 'hatırlamak'],
                    xp: 90, coin: 40, grammar_rule: 'Geniş Zaman: Ben her gün çalışırım. O okula gider.',
                    grammar_example: 'Her akşam Türkçe çalışırım. O akşam yemeğinden önce ödevini yapar.',
                    reading_text: 'Eğitim kendinize verebileceğiniz en önemli hediyedir. Okulda öğrenciler birçok konu öğrenir: matematik, fen, tarih, coğrafya ve diller. Ödevler öğrencilerin öğrendiklerini pratik yapmasına yardımcı olur. Kütüphaneler kitap bulmak ve araştırma yapmak için harika yerlerdir. Sınavlar bilginizi test eder. İyi notlar almak konuyu anladığınızı gösterir. Ama eğitim sadece notlarla ilgili değildir — düşünmeyi öğrenmekle ilgilidir.',
                    reading_qs: [{ q: 'Sınavlar neyi test eder?', opts: ['Hızınızı', 'Bilginizi', 'Hafızanızı', 'Yaşınızı'], c: 1 }, { q: 'Kütüphane ne için iyidir?', opts: ['Oyun oynamak', 'Yemek yemek', 'Kitap bulmak ve araştırma', 'Film izlemek'], c: 2 }, { q: 'Eğitim sadece neyle ilgili değildir?', opts: ['Öğrenme', 'Düşünme', 'Notlar', 'Anlama'], c: 2 }]
                },
                {
                    id: 'e5', emoji: '🌍', title: 'Seyahat ve Yerler', desc: 'Sayohat va joylar', level: 'elementary',
                    words: ['seyahat', 'havaalanı', 'otel', 'bilet', 'yol tarifi', 'restoran', 'dağ', 'nehir', 'deniz', 'orman'],
                    xp: 100, coin: 45, grammar_rule: 'Geçmiş Zaman (Görülen): -dı/-di/-du/-dü. Ben gittim, O geldi.',
                    grammar_example: 'Geçen yaz İstanbul\'u ziyaret ettim. Güzel bir otelde kaldık ve yerel yemekler yedik.',
                    reading_text: 'Seyahat etmek dünyayı öğrenmenin en iyi yollarından biridir. Seyahat ettiğinizde yeni yerler, kültürler ve diller keşfedersiniz. Seyahatten önce bilet ve otel rezervasyonu yapmalısınız. Havaalanında check-in yapar ve pasaport kontrolünden geçersiniz. Uçakta manzaranın tadını çıkarabilirsiniz. Vardığınızda yerel yemekleri ve turistik yerleri keşfedin. Dağlar, nehirler, denizler ve ormanlar inanılmaz doğal güzellikler sunar. Seyahat ufkunuzu genişletir.',
                    reading_qs: [{ q: 'Seyahatten önce ne yapmalısınız?', opts: ['Hediyelik eşya almak', 'Bilet ve otel ayırtmak', 'Yemek pişirmeyi öğrenmek', 'Yeni kıyafet almak'], c: 1 }, { q: 'Uçuş için nerede check-in yaparsınız?', opts: ['Tren istasyonu', 'Otobüs durağı', 'Havaalanı', 'Otel'], c: 2 }, { q: 'Seyahat neyi genişletir?', opts: ['Kafanızı karıştırır', 'Ufkunuzu genişletir', 'Yorar', 'Kapatır'], c: 1 }]
                },
            ],
            'pre-intermediate': [
                {
                    id: 'p1', emoji: '🔮', title: 'Gelecek Planları', desc: 'Kelajak zamonlari', level: 'pre-intermediate',
                    words: ['ancak', 'rağmen', 'fırsat', 'başarı', 'hedef', 'başarmak', 'geliştirmek', 'kariyer', 'eğitim', 'deneyim'],
                    xp: 130, coin: 60, grammar_rule: 'Gelecek Zaman: -ecek/-acak ekleri. Yarın gideceğim. Planlar için kullanılır.',
                    grammar_example: 'Yarın seni arayacağım. O tıp okuyacak. Muhtemelen zamanında gelmeyecekler.',
                    reading_text: 'Gelecek için plan yapmak önemlidir. Net hedefler belirlemek başarıya ulaşmanıza yardımcı olur. Kısa vadeli hedefler birkaç hafta veya ay sürer. Uzun vadeli hedefler yıllar alabilir. Plan yaparken yeteneklerinizi ve isteklerinizi göz önünde bulundurun. Bazı insanlar iş kurmayı hayal eder. Diğerleri dünyayı gezmek ister. Eğitim ve kariyer planlaması gençler için önemlidir. Finansal planlama emeklilik için birikim yapmanıza yardımcı olur. Unutmayın, planlar değişebilir. Esneklik kararlılık kadar önemlidir.',
                    reading_qs: [{ q: 'Kısa vadeli hedefler ne kadar sürer?', opts: ['Yıllar', 'On yıllar', 'Birkaç hafta veya ay', 'Bir ömür'], c: 2 }, { q: 'Kararlılık kadar önemli olan nedir?', opts: ['Para', 'Esneklik', 'Eğitim', 'Güç'], c: 1 }, { q: 'Finansal planlama ne için yardımcı olur?', opts: ['Tatil', 'Emeklilik', 'Eğitim', 'Alışveriş'], c: 1 }]
                },
                {
                    id: 'p2', emoji: '🎯', title: 'Şimdiki Zaman', desc: "Hozirgi zamon (continuous)", level: 'pre-intermediate',
                    words: ['bu nedenle', 'üstelik', 'çözüm', 'sorumluluk', 'gerekli', 'öneri', 'karşılaştırma', 'rapor', 'proje', 'bütçe'],
                    xp: 140, coin: 65, grammar_rule: 'Şimdiki Zaman: -iyor eki. Ben gidiyorum. O yemek yiyor. Sürekli eylemler için.',
                    grammar_example: 'Şimdi ders çalışıyorum. O akşam yemeği pişiriyor. Onlar bahçede oynuyor.',
                    reading_text: 'Türkçede şimdiki zaman sürekli eylemleri anlatır. "-iyor" eki fiile eklenir: gelmek → geliyorum, okumak → okuyorum. Şimdiki zaman şu anda olan eylemler için kullanılır. Ayrıca yakın gelecekteki planlar için de kullanılabilir: "Yarın İstanbul\'a gidiyorum." Bu zamanı öğrenmek Türkçe akıcılık için önemli bir adımdır.',
                    reading_qs: [{ q: 'Şimdiki zaman hangi eki alır?', opts: ['-di', '-miş', '-iyor', '-ecek'], c: 2 }, { q: 'Şimdiki zaman ne için kullanılmaz?', opts: ['Şu anki eylemler', 'Yakın gelecek planları', 'Geçmiş alışkanlıklar', 'Sürekli durumlar'], c: 2 }, { q: 'Örnek: "Yarın İstanbul\'a gidiyorum" hangi anlamda?', opts: ['Geçmiş', 'Şimdiki', 'Gelecek planı', 'Alışkanlık'], c: 2 }]
                },
                {
                    id: 'p3', emoji: '💬', title: 'Şart Kipleri', desc: 'Shart gaplar', level: 'pre-intermediate',
                    words: ['yönetmek', 'çözmek', 'artırmak', 'azaltmak', 'önermek', 'karşılaştırmak', 'müşteri', 'sözleşme', 'maaş', 'iş arkadaşı'],
                    xp: 150, coin: 70, grammar_rule: 'Şart kipi: -se/-sa eki. Gelirsem... Yapsaydım... Keşke...',
                    grammar_example: 'Yağmur yağarsa evde kalırım. Çalışırsam başarırım. Zengin olsaydım seyahat ederdim.',
                    reading_text: 'Şart cümleleri olası durumları ve sonuçlarını tanımlar. "-se/-sa" eki ile yapılır. Gerçek şart: "Çalışırsan başarırsın." Gerçek dışı şart: "Keşke daha çok çalışsaydım." Türkçede şart kipi günlük hayatta çok kullanılır. Bu yapıyı bilmek size karmaşık fikirleri ifade etme imkanı verir.',
                    reading_qs: [{ q: 'Şart kipi hangi eki alır?', opts: ['-di/-miş', '-se/-sa', '-iyor', '-ecek'], c: 1 }, { q: '"Çalışırsan başarırsın" ne tür bir şarttır?', opts: ['Gerçek dışı', 'Gerçek', 'Geçmiş', 'Gelecek'], c: 1 }, { q: 'Gerçek dışı şart hangi kelimeyle başlar?', opts: ['Eğer', 'Keşke', 'Belki', 'Sanki'], c: 1 }]
                },
            ],
            advanced: [
                {
                    id: 'a1', emoji: '🖊️', title: 'Akademik Yazma', desc: 'Akademik yozuv', level: 'advanced',
                    words: ['nüans', 'belagat', 'paradigma', 'korelasyon', 'mevzuat', 'tutarlı', 'ikna edici', 'tartışmalı', 'pragmatik', 'katalizör'],
                    xp: 200, coin: 90, grammar_rule: 'Bağlaçlar: ancak, bununla birlikte, bu nedenle, oysaki, üstelik, yine de.',
                    grammar_example: 'Veriler hipotezi açıkça desteklemektedir. Bununla birlikte, önceki araştırmalar da bu bulguları doğrulamaktadır. Ancak bazı sınırlamalar kabul edilmelidir.',
                    reading_text: 'Akademik yazma kesinlik, açıklık ve mantıksal tutarlılık gerektirir. Her argüman güvenilir kaynaklardan kanıtlarla desteklenmelidir. Bağlaçlar ve geçiş ifadeleri fikirler arasındaki ilişkileri gösterir: "üstelik" bilgi ekler, "oysaki" zıtlık sunar, "bu nedenle" sonuç belirtir. Gayriresmi dil, kısaltmalar ve kişisel anekdotlardan kaçının. Güçlü bir sonuç, yeni bilgi eklemeden argümanı özetlemelidir.',
                    reading_qs: [{ q: '"Üstelik" neyi ifade eder?', opts: ['Zıtlık', 'Sonuç', 'Ek bilgi', 'Şart'], c: 2 }, { q: 'Gayriresmi dilden kaçınmak neden önemlidir?', opts: ['Daha kısa olmak için', 'Akademik ciddiyet için', 'Daha kolay için', 'Daha süslü için'], c: 1 }, { q: 'Güçlü bir sonuç ne yapmalıdır?', opts: ['Yeni fikirler eklemeli', 'Girişi tekrarlamalı', 'Argümanı özetlemeli', 'Daha fazla kanıt eklemeli'], c: 2 }]
                },
                {
                    id: 'a2', emoji: '📋', title: 'İleri Düzey Yazma', desc: 'IELTS Yozuv Vazifalar', level: 'advanced',
                    words: ['eşi benzeri görülmemiş', 'titiz', 'belirsiz', 'önemli', 'baskın', 'fenomen', 'bakış açısı', 'retorik', 'savunmak', 'detaylı incelemek'],
                    xp: 250, coin: 110, grammar_rule: 'Dolaylı anlatım: Dedi ki... Sordu ki... İstedi ki... (Fiil çekimleri değişir)',
                    grammar_example: 'Genel olarak, internet kullanımının çarpıcı biçimde arttığı açıktır. Oran %5\'ten %60\'a yükselmiş, 2018\'de zirve yapmıştır.',
                    reading_text: 'İleri düzey Türkçe yazma, sadece doğru dil bilgisi değil, aynı zamanda akıcılık ve kelime çeşitliliği gerektirir. Makalelerde giriş, gelişme ve sonuç bölümleri bulunmalıdır. Her paragraf tek bir ana fikir etrafında düzenlenmelidir. Giriş bölümü okuyucuyu konuya hazırlar. Gelişme bölümü argümanları sunar. Sonuç bölümü ana noktaları özetler ve genel bir değerlendirme yapar.',
                    reading_qs: [{ q: 'İleri düzey yazma ne gerektirir?', opts: ['Sadece gramer', 'Sadece kelime', 'Gramar ve akıcılık', 'Sadece uzunluk'], c: 2 }, { q: 'Her paragraf ne etrafında düzenlenmelidir?', opts: ['Birden çok fikir', 'Tek bir ana fikir', 'Rastgele', 'Zamana göre'], c: 1 }, { q: 'Sonuç bölümü ne yapar?', opts: ['Yeni fikir ekler', 'Girişi tekrarlar', 'Ana noktaları özetler', 'Hikaye anlatır'], c: 2 }]
                },
                {
                    id: 'a3', emoji: '🎤', title: 'İleri Düzey Konuşma', desc: 'IELTS Speaking & Presentation', level: 'advanced',
                    words: ['hipotez', 'metodoloji', 'analiz', 'strateji', 'değerlendirme', 'iyileştirme', 'dönüşüm', 'inovasyon', 'optimizasyon', 'perspektif'],
                    xp: 220, coin: 100, grammar_rule: 'Dolaylı ifadeler: Söylenebilir ki... Görünüyor ki... Kanıtlar gösteriyor ki...',
                    grammar_example: 'Sosyal medyanın iletişimi temelden değiştirdiği söylenebilir. Kanıtlar gençlerin çevrimiçi daha fazla zaman geçirdiğini göstermektedir.',
                    reading_text: 'İleri düzey Türkçe konuşma, sadece doğru dil bilgisi değil, akıcılık ve kelime çeşitliliği gerektirir. Konuşurken dolaylı ifadeler kullanmak daha akademik bir ton sağlar. Cevaplarınızı örnekler, nedenler ve karşılaştırmalarla genişletin. Tekrardan kaçınmak için eş anlamlı kelimeler kullanın. Vurgu ve tonlama da iletişiminizi etkiler.',
                    reading_qs: [{ q: 'Dolaylı ifadeler ne sağlar?', opts: ['Daha kesin', 'Daha akademik ton', 'Daha hızlı', 'Daha kısa'], c: 1 }, { q: 'Tekrardan kaçınmak için ne kullanılır?', opts: ['Eş anlamlılar', 'Uzun cümleler', 'Kısa cevaplar', 'Sorular'], c: 0 }, { q: 'Cevaplar neyle genişletilmelidir?', opts: ['Sessizlik', 'Örnekler ve nedenler', 'Evet/hayır', 'El hareketleri'], c: 1 }]
                },
            ]
        };
        // ── GRAMMAR DATA ──
        const GRAMMAR = [
            {
                title: 'Turk Alifbosi va Talaffuz',
                intro: 'Turk alifbosi lotin harflariga asoslangan va 29 harfdan iborat. O\'zbek tiliga juda o\'xshaydi!',
                content: `
            <table class="grammar-table">
                <tr><th>Harf</th><th>Talaffuz</th><th>Misol</th></tr>
                <tr><td>Ç / ç</td><td>ch (o'zbekcha ch)</td><td>çay = choy</td></tr>
                <tr><td>Ş / ş</td><td>sh (o'zbekcha sh)</td><td>şeker = shakar</td></tr>
                <tr><td>Ğ / ğ</td><td>yumshoq g (talaffuz qilinmaydi)</td><td>dağ = tog'</td></tr>
                <tr><td>Ö / ö</td><td>o va ö orasida</td><td>göz = ko'z</td></tr>
                <tr><td>Ü / ü</td><td>u va ü orasida</td><td>üzüm = uzum</td></tr>
                <tr><td>İ / i</td><td>oddiy i</td><td>iyi = yaxshi</td></tr>
                <tr><td>I / ı</td><td>orqa i (qattiq)</td><td>kış = qish</td></tr>
            </table>
            <div class="grammar-note">💡 Turk tili o'zbek tiliga juda o'xshaydi! Ko'p so'zlar bir xil: kitap (kitob), masa (stol), araba (mashina), okul (maktab).</div>
            <div class="grammar-example"><span class="tr">Türkçe öğrenmek çok kolay!</span><span class="uz">Turkcha o'rganish juda oson!</span></div>`
            },
            {
                title: 'Egalik Qo\'shimchalari',
                intro: 'Turk tilida egalik -(ım/im/um/üm) qo\'shimchasi bilan ifodalanadi. O\'zbek tili bilan juda o\'xshash!',
                content: `
            <table class="grammar-table">
                <tr><th>Shaxs</th><th>Qo\'shimcha</th><th>Misol (kitap - kitob)</th><th>O\'zbekcha</th></tr>
                <tr><td>Men</td><td>-ım/-im/-um/-üm</td><td>kitabım</td><td>kitobim</td></tr>
                <tr><td>Sen</td><td>-ın/-in/-un/-ün</td><td>kitabın</td><td>kitobing</td></tr>
                <tr><td>O</td><td>-ı/-i/-u/-ü</td><td>kitabı</td><td>kitobi</td></tr>
                <tr><td>Biz</td><td>-ımız/-imiz/-umuz/-ümüz</td><td>kitabımız</td><td>kitobimiz</td></tr>
                <tr><td>Siz</td><td>-ınız/-iniz/-unuz/-ünüz</td><td>kitabınız</td><td>kitobingiz</td></tr>
                <tr><td>Ular</td><td>-ları/-leri</td><td>kitapları</td><td>kitoblari</td></tr>
            </table>
            <div class="grammar-example"><span class="tr">Annem çok iyi.</span><span class="uz">Onam juda yaxshi. (Ona+m)</span></div>
            <div class="grammar-example"><span class="tr">Köpeğim oyun oynuyor.</span><span class="uz">Itim o'ynayapti. (It+im)</span></div>
            <div class="grammar-note">📌 Unli uyg'unligi: so'zdagi oxirgi unlidan keyin mos qo'shimcha tanlanadi (a/ı → -ım, e/i → -im, o/u → -um, ö/ü → -üm)</div>`
            },
            {
                title: 'Fe\'llar va Hozirgi Zamon',
                intro: 'Turk tilida hozirgi zamon -(ı/i/u/ü)yor qo\'shimchasi bilan ifodalanadi.',
                content: `
            <table class="grammar-table">
                <tr><th>Masdor</th><th>Hozirgi zamon (men)</th><th>Ma'nosi</th></tr>
                <tr><td>gitmek</td><td>gidiyorum</td><td>Boraman</td></tr>
                <tr><td>gelmek</td><td>geliyorum</td><td>Kelaman</td></tr>
                <tr><td>yemek</td><td>yiyorum</td><td>Yeyapman</td></tr>
                <tr><td>içmek</td><td>içiyorum</td><td>Ichiyman</td></tr>
                <tr><td>okumak</td><td>okuyorum</td><td>O'qiyman</td></tr>
                <tr><td>yazmak</td><td>yazıyorum</td><td>Yoziyman</td></tr>
                <tr><td>konuşmak</td><td>konuşuyorum</td><td>Gapiraman</td></tr>
            </table>
            <div class="grammar-example"><span class="tr">Ben her gün spor yapıyorum.</span><span class="uz">Men har kuni sport qilaman.</span></div>
            <div class="grammar-example"><span class="tr">O şimdi uyuyor.</span><span class="uz">U hozir uxlayapti.</span></div>
            <div class="grammar-note">💡 Shaxs qo'shimchalari: -um (men), -sun (sen), — (o), -uz (biz), -sunuz (siz), -lar (ular)</div>`
            },
            {
                title: 'O\'tgan va Kelajak Zamon',
                intro: 'Turk tilida o\'tgan zamon -dı/-di/-du/-dü, kelajak zamon -(y)acak/-(y)ecek bilan ifodalanadi.',
                content: `
            <table class="grammar-table">
                <tr><th>Zamon</th><th>Qo\'shimcha</th><th>Misol</th><th>O\'zbekcha</th></tr>
                <tr><td>O'tgan</td><td>-dı/-di/-du/-dü</td><td>gitti</td><td>Ketdi</td></tr>
                <tr><td>O'tgan (men)</td><td>-dım/-dim</td><td>gittim</td><td>Ketdim</td></tr>
                <tr><td>Kelajak</td><td>-(y)acak/-(y)ecek</td><td>gidecek</td><td>Boradi</td></tr>
                <tr><td>Kelajak (men)</td><td>-(y)acağım/-(y)eceğim</td><td>gideceğim</td><td>Boraman</td></tr>
            </table>
            <div class="grammar-example"><span class="tr">Dün okula gittim.</span><span class="uz">Kecha maktabga ketdim.</span></div>
            <div class="grammar-example"><span class="tr">Yarın İstanbul'a gideceğim.</span><span class="uz">Ertaga Istanbulga boraman.</span></div>
            <div class="grammar-note">📌 O'tgan zamonda shart: d/t dan keyin kelsa t o'zgaradi → t+di = tti (gitti, etti)</div>`
            },
            {
                title: 'Raqamlar',
                intro: 'Turk raqamlari o\'zbek tiliga juda o\'xshaydi. Ko\'pini allaqachon bilasiz!',
                content: `
            <table class="grammar-table">
                <tr><th>Raqam</th><th>Turkcha</th><th>Talaffuz</th></tr>
                <tr><td>1</td><td>bir</td><td>bir</td></tr>
                <tr><td>2</td><td>iki</td><td>iki</td></tr>
                <tr><td>3</td><td>üç</td><td>üch</td></tr>
                <tr><td>4</td><td>dört</td><td>dört</td></tr>
                <tr><td>5</td><td>beş</td><td>besh</td></tr>
                <tr><td>6</td><td>altı</td><td>altı</td></tr>
                <tr><td>7</td><td>yedi</td><td>yedi</td></tr>
                <tr><td>8</td><td>sekiz</td><td>sekiz</td></tr>
                <tr><td>9</td><td>dokuz</td><td>dokuz</td></tr>
                <tr><td>10</td><td>on</td><td>on</td></tr>
                <tr><td>20</td><td>yirmi</td><td>yirmi</td></tr>
                <tr><td>30</td><td>otuz</td><td>otuz</td></tr>
                <tr><td>50</td><td>elli</td><td>elli</td></tr>
                <tr><td>100</td><td>yüz</td><td>yüz</td></tr>
                <tr><td>1000</td><td>bin</td><td>bin</td></tr>
            </table>
            <div class="grammar-note">💡 Qo'shma raqamlar: 21 = yirmi bir, 35 = otuz beş, 100 = yüz, 200 = iki yüz</div>`
            },
            {
                title: 'Unli Uyg\'unligi (Vokal Uyumu)',
                intro: 'Turk tilining eng muhim qoidalaridan biri — unli uyg\'unligi. Qo\'shimchalar so\'zdagi oxirgi unlidan keyin tanlanadi.',
                content: `
            <table class="grammar-table">
                <tr><th>So'zdagi oxirgi unli</th><th>Qo'shimchadagi unli</th><th>Misol</th></tr>
                <tr><td>a, ı</td><td>a</td><td>masa+da = masada (stolda)</td></tr>
                <tr><td>e, i</td><td>e</td><td>ev+de = evde (uyda)</td></tr>
                <tr><td>o, u</td><td>a</td><td>okul+da = okulda (maktabda)</td></tr>
                <tr><td>ö, ü</td><td>e</td><td>göz+de = gözde (ko'zda)</td></tr>
            </table>
            <div class="grammar-example"><span class="tr">Ben evde oturuyorum.</span><span class="uz">Men uyda o'tiribman. (ev+de)</span></div>
            <div class="grammar-example"><span class="tr">Okulda öğrenciyim.</span><span class="uz">Maktabda o'quvchiman. (okul+da)</span></div>
            <div class="grammar-note">📌 O'zbek tilida ham shunga o'xshash qoida bor! Turkcha o'rganish shuning uchun oson.</div>`
            }
        ];

        // ── FILL IN THE BLANK DATA ──
        const FILL_DATA = [
            { sentence: 'Merhaba, adınız ___?', answer: 'ne', hint: 'Ism so\'rash' },
            { sentence: 'Ben bir ___ im.', answer: 'öğrenci', hint: 'O\'quvchi' },
            { sentence: 'Su lütfen, ___ mısınız?', answer: 'verebilir', hint: 'Bermoq' },
            { sentence: '___ nasılsınız?', answer: 'bugün', hint: 'Bugun' },
            { sentence: 'Teşekkür ___ .', answer: 'ederim', hint: 'Rahmat' },
            { sentence: 'Özür ___ , geç kaldım.', answer: 'dilerim', hint: 'Kechirasiz' },
            { sentence: 'Elma ___ aldım.', answer: 'bir', hint: 'Bir dona' },
            { sentence: 'Türkçe ___ istiyorum.', answer: 'öğrenmek', hint: 'O\'rganmoq' },
            { sentence: 'Annem çok ___ pişiriyor.', answer: 'yemek', hint: 'Ovqat' },
            { sentence: 'Kitabım ___ .', answer: 'kayboldu', hint: 'Yo\'qoldi' },
        ];

        // ── DOM ──
        const $id = id => document.getElementById(id);

        document.addEventListener('DOMContentLoaded', () => {
            updateXP(0);
            renderUnits('beginner');
            renderWords();
            initFlashcards();
            initQuiz();
            startMatch();
            initTyping();
            initFill();
            renderGrammar(0);
            updateStreak();
            navScroll();
        });

        function navScroll() {
            window.addEventListener('scroll', () => {
                $id('navbar').classList.toggle('scrolled', window.scrollY > 40);
            });
        }

        function updateXP(gained) {
            xp += gained;
            localStorage.setItem('tr_xp', xp);
            $id('xpDisplay').textContent = xp;
            if (gained > 0) showToast(`+${gained} XP qo'shildi! 🎉`);
        }

        function updateStreak() {
            const today = new Date().toDateString();
            const lastDay = localStorage.getItem('tr_streak_day');
            streak = parseInt(localStorage.getItem('tr_streak') || '0');
            if (lastDay !== today) {
                streak += 1;
                localStorage.setItem('tr_streak', streak);
                localStorage.setItem('tr_streak_day', today);
            }
            $id('streakText').textContent = `${streak} kun ketma-ket`;
        }

        function showToast(msg) {
            const t = $id('toast');
            t.textContent = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        }

        function switchLevel(level, el) {
            curLevel = level;
            document.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            renderUnits(level);
        }

        function renderUnits(level) {
            const grid = $id('unitsGrid');
            const units = UNITS[level] || [];
            grid.innerHTML = units.map((u, i) => {
                const done = completedUnits[`${level}_${u.n}`];
                const locked = i > 1 && !completedUnits[`${level}_${UNITS[level][i - 1].n}`];
                return `<div class="unit-card${done ? ' completed' : ''}${locked ? ' locked' : ''}" onclick="${locked ? 'showToast(\'Avvalgi unitni tugating!\')' : 'openUnit(' + u.n + ',\'' + level + '\')'}">
            <div class="unit-num">UNIT ${u.n}${done ? ' ✓' : ''}</div>
            <div class="unit-emoji">${u.e}</div>
            <div class="unit-title">${u.t}</div>
            <div class="unit-turkish">${u.tr}</div>
            <div class="unit-desc">${u.d}</div>
            <div class="unit-progress-bar-wrap"><div class="unit-progress-bar" style="width:${done ? 100 : 0}%"></div></div>
            <div class="unit-xp">⭐ ${u.xp} XP</div>
            ${done ? '<div class="unit-complete-badge">✅</div>' : ''}
        </div>`;
            }).join('');
        }

        function openUnit(n, level) {
            const unit = UNITS[level].find(u => u.n === n);
            if (!unit) return;
            $id('unitModalContent').innerHTML = `
        <div class="unit-modal-title">${unit.e} ${unit.t}</div>
        <div class="unit-modal-turkish">${unit.tr}</div>
        <p style="color:var(--text2);font-size:0.88rem;margin-bottom:20px;">${unit.d}</p>
        <div class="unit-modal-lessons">
            ${unit.lessons.map((l, i) => {
                const done = completedUnits[`lesson_tr_${n}_${i}`];
                return `<div class="unit-lesson-item${done ? ' done' : ''}" onclick="completeLesson(${n},'${level}',${i})">
                    <span class="lesson-icon">${['📖', '✍️', '🎯'][i % 3]}</span>
                    <span class="lesson-name">${l}</span>
                    <span class="lesson-status${done ? ' done' : ''}">${done ? '✅ Bajarildi' : 'Boshlash →'}</span>
                </div>`;
            }).join('')}
        </div>
        <button class="start-btn" style="width:100%" onclick="completeUnit(${n},'${level}')">Unitni yakunlash ✓</button>`;
            $id('unitModal').classList.add('active');
        }

        function completeLesson(unitN, level, lessonIdx) {
            completedUnits[`lesson_tr_${unitN}_${lessonIdx}`] = true;
            localStorage.setItem('tr_units', JSON.stringify(completedUnits));
            updateXP(20);
            openUnit(unitN, level);
        }

        function completeUnit(n, level) {
            completedUnits[`${level}_${n}`] = true;
            localStorage.setItem('tr_units', JSON.stringify(completedUnits));
            const unit = UNITS[level].find(u => u.n === n);
            if (unit) updateXP(unit.xp);
            closeUnitModal();
            renderUnits(level);
            showToast(`Unit ${n} bajarildi! 🎉`);
        }

        function closeUnitModal(e) {
            if (!e || e.target === $id('unitModal')) $id('unitModal').classList.remove('active');
        }

        let allFiltered = [];

        function renderWords() {
            wOff = 0; wFilt = 'all'; wSrch = '';
            updateWordsGrid();
        }

        function filterWords() {
            wSrch = $id('wordSearch').value.toLowerCase();
            wOff = 0;
            updateWordsGrid();
        }

        function filterByLevel(level, el) {
            wFilt = level; wOff = 0;
            document.querySelectorAll('.wf-tab').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            updateWordsGrid();
        }

        function loadMoreWords() {
            wOff += 30;
            updateWordsGrid(true);
        }

        function updateWordsGrid(append = false) {
            allFiltered = WDB.filter(w => {
                if (wFilt !== 'all' && w.l !== wFilt) return false;
                if (wSrch && !w.t.toLowerCase().includes(wSrch) && !w.u.toLowerCase().includes(wSrch)) return false;
                return true;
            });
            const slice = allFiltered.slice(0, wOff + 30);
            const grid = $id('wordsGrid');
            if (!append) {
                grid.innerHTML = slice.map(wordCard).join('');
            } else {
                grid.innerHTML += allFiltered.slice(wOff, wOff + 30).map(wordCard).join('');
            }
            $id('loadMoreBtn').style.display = slice.length < allFiltered.length ? 'inline-block' : 'none';
        }

        function wordCard(w) {
            return `<div class="word-card" onclick="openWordModal('${w.t.replace(/'/g, "\\'")}')">
        <div class="wc-top">
            <div class="wc-turkish">${w.t}</div>
            <button class="wc-snd" onclick="event.stopPropagation();speakTurkish('${w.t.replace(/'/g, "\\'")}')" title="Tinglash">🔊</button>
        </div>
        <div class="wc-uz">${w.u}</div>
        <div class="wc-meta">
            <span>${w.ty}</span>
            <span>${w.l}</span>
        </div>
    </div>`;
        }

        function openWordModal(turkish) {
            const w = WDB.find(x => x.t === turkish);
            if (!w) return;
            $id('wordModalContent').innerHTML = `
        <div class="word-modal-turkish">${w.t}</div>
        <div class="word-modal-uz">${w.u}</div>
        <span class="word-modal-type">${w.ty} • ${w.l}</span>
        <div class="word-modal-ex">
            <span class="tr">${w.ex}</span>
            <span class="uz">${w.eu}</span>
        </div>
        <button class="speak-word-btn" onclick="speakTurkish('${w.t.replace(/'/g, "\\'")}')">🔊 Tinglash</button>`;
            $id('wordModal').classList.add('active');
        }

        function closeWordModal(e) {
            if (!e || e.target === $id('wordModal')) $id('wordModal').classList.remove('active');
        }

        function speakTurkish(text) {
            if ('speechSynthesis' in window) {
                const utt = new SpeechSynthesisUtterance(text);
                utt.lang = 'tr-TR';
                utt.rate = 0.85;
                window.speechSynthesis.speak(utt);
            } else {
                showToast('Brauzeringiz nutq funksiyasini qo\'llab-quvvatlamaydi.');
            }
        }

        function switchPractice(mode, el) {
            document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
            $id('panel-' + mode).classList.add('active');
            el.classList.add('active');
            if (mode === 'flashcard') initFlashcards();
            if (mode === 'quiz') initQuiz();
            if (mode === 'match') startMatch();
            if (mode === 'typing') initTyping();
            if (mode === 'fill') initFill();
        }

        // ── FLASHCARD ──
        function initFlashcards() {
            flashDeck = shuffle([...WDB]).slice(0, 20);
            flashIdx = 0; flashCorrect = 0; flashWrong = 0;
            showFlash();
        }

        function showFlash() {
            const w = flashDeck[flashIdx];
            flashFlipped = false;
            $id('flashcard').classList.remove('flipped');
            $id('flashTurkish').textContent = w.t;
            $id('flashUz').textContent = w.u;
            $id('flashEx').textContent = w.ex;
            updateFlashProgress();
        }

        function flipCard() {
            flashFlipped = !flashFlipped;
            $id('flashcard').classList.toggle('flipped', flashFlipped);
            if (flashFlipped) speakTurkish(flashDeck[flashIdx].t);
        }

        function flashResult(result) {
            if (result === 'correct') { flashCorrect++; updateXP(5); }
            else flashWrong++;
            nextFlash();
        }

        function nextFlash() {
            flashIdx++;
            if (flashIdx >= flashDeck.length) {
                $id('flashTurkish').textContent = '🎉 Tugadi!';
                $id('flashcard').classList.remove('flipped');
                updateXP(10);
                return;
            }
            showFlash();
        }

        function updateFlashProgress() {
            const pct = Math.round((flashIdx / flashDeck.length) * 100);
            $id('flashProgress').textContent = `${flashIdx + 1} / ${flashDeck.length}`;
            $id('flashBar').style.width = pct + '%';
        }

        // ── QUIZ ──
        let quizAnswered = false;
        function initQuiz() {
            quizScore = 0;
            $id('quizScore').textContent = 0;
            nextQuiz();
        }

        function nextQuiz() {
            quizAnswered = false;
            const pool = shuffle([...WDB]);
            curQuizWord = pool[0];
            const wrongs = shuffle(pool.slice(1)).slice(0, 3);
            const options = shuffle([curQuizWord, ...wrongs]);
            const type = Math.random() > 0.5 ? 'tr2uz' : 'uz2tr';
            $id('quizQ').textContent = type === 'tr2uz'
                ? `"${curQuizWord.t}" — o'zbek tarjimasi?`
                : `"${curQuizWord.u}" — turkcha?`;
            $id('quizOptions').innerHTML = options.map(o =>
                `<button class="quiz-opt" onclick="checkQuiz(this,'${o.t.replace(/'/g, "\\'")}','${type}')">${type === 'tr2uz' ? o.u : o.t}</button>`
            ).join('');
            hideFeedback('quizFeedback');
        }

        function checkQuiz(btn, chosen, type) {
            if (quizAnswered) return;
            quizAnswered = true;
            document.querySelectorAll('.quiz-opt').forEach(b => {
                const isCorrect = type === 'tr2uz'
                    ? b.textContent === curQuizWord.u
                    : b.textContent === curQuizWord.t;
                if (isCorrect) b.classList.add('correct');
                else if (b === btn) b.classList.add('wrong');
            });
            const isRight = chosen === curQuizWord.t;
            if (isRight) {
                quizScore++;
                $id('quizScore').textContent = quizScore;
                showFeedback('quizFeedback', `✓ To'g'ri! "${curQuizWord.t}" = ${curQuizWord.u}`, 'correct');
                updateXP(10);
            } else {
                showFeedback('quizFeedback', `✗ Noto'g'ri. To'g'ri javob: "${curQuizWord.t}" = ${curQuizWord.u}`, 'wrong');
            }
            speakTurkish(curQuizWord.t);
        }

        // ── MATCH ──
        let matchSel1 = null;
        function startMatch() {
            const pool = shuffle([...WDB]).slice(0, 6);
            matchPairs = pool;
            matchMatched = [];
            matchSel1 = null;
            const left = shuffle(pool.map(w => ({ id: w.t, text: w.t, type: 'tr' })));
            const right = shuffle(pool.map(w => ({ id: w.t, text: w.u, type: 'uz' })));
            $id('matchGrid').innerHTML = shuffle([...left, ...right]).map(item =>
                `<div class="match-item" data-id="${item.id}" data-type="${item.type}" onclick="selectMatch(this)">${item.text}</div>`
            ).join('');
            hideFeedback('matchFeedback');
        }

        function selectMatch(el) {
            if (el.classList.contains('matched')) return;
            if (matchSel1 === null) {
                matchSel1 = el;
                el.classList.add('selected');
            } else {
                if (matchSel1 === el) { el.classList.remove('selected'); matchSel1 = null; return; }
                if (matchSel1.dataset.type === el.dataset.type) {
                    matchSel1.classList.remove('selected');
                    matchSel1 = el;
                    el.classList.add('selected');
                    return;
                }
                if (matchSel1.dataset.id === el.dataset.id) {
                    matchSel1.classList.remove('selected');
                    matchSel1.classList.add('matched');
                    el.classList.add('matched');
                    matchMatched.push(el.dataset.id);
                    matchSel1 = null;
                    updateXP(15);
                    if (matchMatched.length === matchPairs.length) {
                        showFeedback('matchFeedback', '🎉 Barcha juftliklar topildi! Yaxshi!', 'correct');
                    }
                } else {
                    matchSel1.classList.remove('selected');
                    matchSel1.classList.add('wrong-pick');
                    el.classList.add('wrong-pick');
                    setTimeout(() => {
                        matchSel1?.classList.remove('wrong-pick');
                        el.classList.remove('wrong-pick');
                        matchSel1 = null;
                    }, 800);
                }
            }
        }

        // ── TYPING ──
        function initTyping() {
            typingDeck = shuffle([...WDB]);
            typingIdx = 0;
            nextTyping();
        }

        function nextTyping() {
            const w = typingDeck[typingIdx % typingDeck.length];
            $id('typingWord').textContent = w.u;
            $id('typingHint').textContent = `O'zbekcha: ${w.u}`;
            $id('typingInput').value = '';
            hideFeedback('typingFeedback');
            typingIdx++;
        }

        function checkTyping() {
            const input = $id('typingInput').value.trim().toLowerCase();
            const w = typingDeck[(typingIdx - 1) % typingDeck.length];
            if (input === w.t.toLowerCase()) {
                showFeedback('typingFeedback', `✓ To'g'ri! "${w.t}" = ${w.u}`, 'correct');
                updateXP(8);
                $id('typingInput').value = '';
                speakTurkish(w.t);
                setTimeout(nextTyping, 1200);
            }
        }

        // ── FILL IN THE BLANK ──
        function initFill() {
            fillDeck = shuffle([...FILL_DATA]);
            fillIdx = 0;
            nextFill();
        }

        function nextFill() {
            const item = fillDeck[fillIdx % fillDeck.length];
            $id('fillSentence').innerHTML = item.sentence.replace('___', '<span style="color:var(--accent);border-bottom:2px solid var(--accent);padding:0 8px;">___</span>');
            $id('fillHint').textContent = `Maslahat: ${item.hint}`;
            $id('fillInput').value = '';
            hideFeedback('fillFeedback');
            fillIdx++;
        }

        function checkFill() {
            const input = $id('fillInput').value.trim().toLowerCase();
            const item = fillDeck[(fillIdx - 1) % fillDeck.length];
            if (input === item.answer.toLowerCase()) {
                showFeedback('fillFeedback', `✓ To'g'ri! "${item.answer}"`, 'correct');
                updateXP(10);
            } else {
                showFeedback('fillFeedback', `✗ Noto'g'ri. To'g'ri javob: "${item.answer}"`, 'wrong');
            }
        }

        // ── GRAMMAR ──
        function renderGrammar(idx) {
            curGrammar = idx;
            const g = GRAMMAR[idx];
            $id('grammarContent').innerHTML = `
        <div class="grammar-title">${g.title}</div>
        <div class="grammar-intro">${g.intro}</div>
        ${g.content}`;
        }

        function switchGrammar(idx, el) {
            document.querySelectorAll('.gtab').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            renderGrammar(idx);
        }

        // ── HELPERS ──
        function shuffle(arr) {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        function showFeedback(id, msg, type) {
            const el = $id(id);
            el.textContent = msg;
            el.className = `feedback-box show ${type}`;
        }

        function hideFeedback(id) {
            $id(id).className = 'feedback-box';
        }