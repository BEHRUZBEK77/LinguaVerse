const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ACTFL = ['Intermediate Low', 'Intermediate Mid', 'Intermediate High', 'Advanced Low', 'Advanced Mid', 'Advanced High', 'Superior'];

const SKILLS = Object.freeze({
  listening: { title: 'Tinglab tushunish', task: 'Audio savollarini sinov sharoitida bajaring, javobni audiodagi dalil bilan tekshiring.' },
  reading: { title: 'O‘qib tushunish', task: 'Matnlarni vaqt bilan o‘qing; savol turini va noto‘g‘ri javob sababini qayd qiling.' },
  writing: { title: 'Yozish', task: 'Imtihon formatidagi matn yozing; rasmiy mezon bo‘yicha tuzilish, aniqlik va vaqtni tekshiring.' },
  speaking: { title: 'Gapirish', task: 'Imtihon topshirig‘ini ovozga yozib, ravonlik, aniqlik va vaqt talablarini tekshiring.' },
  grammar: { title: 'Grammatika va leksika', task: 'Imtihon talab qiladigan grammatika va lug‘at topshiriqlarini bajaring; takroriy xatolarni kartochkaga yozing.' }
});

function exam(name, officialUrl, format, targetLabel, targets, skillIds) {
  return Object.freeze({ name, officialUrl, format, targetLabel, targets: Object.freeze(targets), skillIds: Object.freeze(skillIds) });
}

const ALL_FOUR = ['listening', 'reading', 'writing', 'speaking'];
const CEFR_EXAM = (name, url, format, skillIds = ALL_FOUR) =>
  exam(name, url, format, 'Maqsad daraja', CEFR, skillIds);

export const CERTIFICATION_LANGUAGES = Object.freeze([
  {
    id: 'english', name: 'English', nativeName: 'English', course: './English.html',
    standard: 'IELTS 9.0 — eng yuqori band. IELTS, Cambridge va CEFR darajalari o‘zaro to‘liq bir xil emas.',
    note: 'IELTS Academic va General Training Writing/Reading bo‘limlari farq qiladi. Siz topshiradigan test turini tanlang.',
    exams: Object.freeze([
      exam('IELTS Academic', 'https://ielts.org/take-a-test/preparation-resources',
        'Listening, Reading, Writing va Speaking. Academic Reading/Writing oliy ta’lim va akademik maqsadlarga mo‘ljallangan.',
        'IELTS band maqsadi', Array.from({ length: 11 }, (_, i) => (4 + i * 0.5).toFixed(1)), ALL_FOUR),
      exam('IELTS General Training', 'https://ielts.org/take-a-test/preparation-resources',
        'Listening, Reading, Writing va Speaking. General Training Reading/Writing kundalik, ijtimoiy va ish kontekstlariga mos.',
        'IELTS band maqsadi', Array.from({ length: 11 }, (_, i) => (4 + i * 0.5).toFixed(1)), ALL_FOUR),
      exam('Cambridge C2 Proficiency', 'https://www.cambridgeenglish.org/exams-and-tests/proficiency/',
        'Reading and Use of English, Writing, Listening va Speaking. Bu Cambridge English’ning C2 darajadagi imtihoni.',
        'Imtihon maqsadi', ['C2 Proficiency'], ['reading', 'grammar', 'writing', 'listening', 'speaking'])
    ])
  },
  {
    id: 'german', name: 'German', nativeName: 'Deutsch', course: './German.html',
    standard: 'Goethe/telc CEFR darajalaridan foydalanadi; TestDaF natijasi TDN ko‘rsatkichlarida beriladi.',
    note: 'Imtihon formati, daraja taklifi va topshirish shartlari markaz hamda tanlangan imtihonga bog‘liq.',
    exams: Object.freeze([
      CEFR_EXAM('Goethe-Zertifikat', 'https://www.goethe.de/en/spr/kup/prf.html',
        'Lesen, Hören, Schreiben va Sprechen. Yuqori darajali topshiriqlar uchun rasmiy Goethe model sinovlarini ishlating.'),
      CEFR_EXAM('telc Deutsch', 'https://www.telc.net/en/language-examinations/',
        'To‘rt ko‘nikma va topshiriqlar tanlangan telc imtihoniga qarab farq qiladi.'),
      exam('TestDaF', 'https://www.testdaf.de/en/participants/',
        'Lesen, Hören, Schreiben va Sprechen; topshiriladigan raqamli yoki qog‘oz formatining vazifalarini alohida mashq qiling.',
        'TDN maqsadi', ['TDN 3', 'TDN 4', 'TDN 5'], ALL_FOUR)
    ])
  },
  {
    id: 'spanish', name: 'Spanish', nativeName: 'Español', course: './Spain.html',
    standard: 'DELE va SIELE natijalari bir xil tizim emas; SIELE C1 gacha hisobot beradi.',
    note: 'DELE darajani imtihon topshirish paytida tanlaydi; SIELE natijasi ball va global daraja sifatida beriladi.',
    exams: Object.freeze([
      CEFR_EXAM('DELE', 'https://cervantes.org/es/examenes/dele',
        'Comprensión de lectura, comprensión auditiva, expresión e interacción escritas hamda orales. Aynan tanlangan darajaning model imtihonini oling.'),
      exam('SIELE Global', 'https://siele.org/en/',
        'Raqamli imtihonda Reading, Listening, Writing va Speaking baholanadi; natija ball va A1–C1 global daraja bilan ifodalanadi.',
        'SIELE global daraja', ['A1', 'A2', 'B1', 'B2', 'C1'], ALL_FOUR)
    ])
  },
  {
    id: 'russian', name: 'Russian', nativeName: 'Русский', course: './Russia.html',
    standard: 'TORFL/TRKI o‘z imtihon darajalaridan foydalanadi; darajani rasmiy markaz va qabul qiluvchi bilan aniqlang.',
    note: 'Imtihon odatda o‘qish, yozish, tinglash, gapirish va leksik-grammatik kompetensiyalarni qamrab oladi.',
    exams: Object.freeze([
      CEFR_EXAM('TORFL / TRKI', 'https://test.irlc.msu.ru/',
        'Reading, Writing, Listening, Speaking va leksika/grammatika. Beshala bo‘limni tanlangan darajada mashq qiling.',
        ['reading', 'writing', 'listening', 'speaking', 'grammar'])
    ])
  },
  {
    id: 'turkish', name: 'Turkish', nativeName: 'Türkçe', course: './Turkish.html',
    standard: 'TYS rasmiy imtihon yo‘nalishi; TÖMER talablari esa universitet yoki markazga qarab farq qiladi.',
    note: 'TÖMER markazlari imtihon formati va sertifikat qabul qilinishini o‘zlari belgilashi mumkin.',
    exams: Object.freeze([
      exam('TYS (Yunus Emre Enstitüsü)', 'https://tys.yee.org.tr/',
        'O‘qish, tinglash, yozish va gapirish; ro‘yxatdan o‘tish hamda amaldagi qoidalarni rasmiy sahifadan tekshiring.',
        'TYS maqsad darajasi', ['B2', 'C1', 'C2'], ALL_FOUR),
      CEFR_EXAM('TÖMER (markaz talabi)', 'https://www.ankara.edu.tr/',
        'Yagona TÖMER imtihon formati yo‘q. Avval kerakli universitet/markazni tanlab, uning amaldagi namuna testi va mezonini oling.')
    ])
  },
  {
    id: 'arabic', name: 'Arabic', nativeName: 'العربية', course: './Arabic.html',
    standard: 'Arab tilida barcha tashkilotlar tan oladigan yagona sertifikat yo‘q. O‘quv kursi fus’ha arab tiliga yo‘naltirilgan.',
    note: 'ACTFL OPI/OPIc faqat gapirish darajasini baholaydi va faqat natijani qabul qiluvchi tashkilot tan olsa mos keladi.',
    exams: Object.freeze([
      exam('ACTFL Arabic OPI/OPIc (qabul qilinsa)', 'https://www.actfl.org/assessments/postsecondary-assessments/oral-proficiency-interview-opi',
        'Bu og‘zaki proficiency baholashi: Listening, Reading va Writing sertifikati o‘rnini bosmaydi. Imtihonga yozilishdan oldin tashkilotingiz qabul qilishini tasdiqlang.',
        'ACTFL oral proficiency maqsadi', ACTFL, ['speaking'])
    ])
  },
  {
    id: 'korean', name: 'Korean', nativeName: '한국어', course: './Korean.html',
    standard: 'TOPIK darajalari CEFR darajalariga to‘g‘ridan-to‘g‘ri tenglashtirilmaydi.',
    note: 'TOPIK I — 1–2-daraja; TOPIK II — 3–6-daraja. TOPIK standart imtihonida Speaking bo‘limi yo‘q.',
    exams: Object.freeze([
      exam('TOPIK II', 'https://www.topik.go.kr/',
        'Listening, Reading va Writing. TOPIK II standartida Speaking yo‘qligi sabab Speaking Coach qo‘shimcha amaliyot, test bo‘limi emas.',
        'TOPIK daraja maqsadi', ['3', '4', '5', '6'], ['listening', 'reading', 'writing']),
      exam('TOPIK I', 'https://www.topik.go.kr/',
        'Listening va Reading. Imtihon sanasi va rasmiy namuna/qo‘llanmalarni TOPIK portalidan tekshiring.',
        'TOPIK daraja maqsadi', ['1', '2'], ['listening', 'reading'])
    ])
  },
  {
    id: 'chinese', name: 'Chinese', nativeName: '中文', course: './Chinese.html',
    standard: 'HSK/HSKK va ularning formatlari o‘z imtihon tizimlariga ega; CEFR C2 bilan teng deb hisoblanmaydi.',
    note: 'HSK daraja/versiyasi va HSKK speaking imtihoni alohida bo‘lishi mumkin. Ro‘yxatdan o‘tishdagi amaldagi formatni rasmiy portaldan tekshiring.',
    exams: Object.freeze([
      exam('HSK', 'https://www.chinesetest.cn/',
        'HSK darajasi va imtihon versiyasiga qarab Listening, Reading va Writing. Rasmiy saytdagi aynan siz topshiradigan versiya namunasi bilan mashq qiling.',
        'HSK daraja maqsadi', ['1', '2', '3', '4', '5', '6'], ['listening', 'reading', 'writing']),
      exam('HSKK (og‘zaki imtihon)', 'https://www.chinesetest.cn/',
        'HSKK og‘zaki ko‘nikmaga qaratilgan; u HSKning yozma/tinglab tushunish bo‘limlarini almashtirmaydi.',
        'HSKK bosqichi', ['Elementary', 'Intermediate', 'Advanced'], ['speaking'])
    ])
  }
]);

export const READINESS_STEPS = Object.freeze([
  { id: 'requirements', title: 'Talabni tasdiqlash', detail: 'Qabul qiluvchi tashkilot, imtihon versiyasi, maqsad ball/daraja va qabul muddatini yozib oling.' },
  { id: 'blueprint', title: 'Rasmiy formatni o‘rganish', detail: 'Rasmiy imtihon sahifasidan bo‘limlar, vaqt, topshiriqlar va baholash mezonlarini ko‘rib chiqing.' },
  { id: 'baseline', title: 'Boshlang‘ich sinov', detail: 'Rasmiy namuna materialidan vaqt bilan diagnostika bajaring; har bir bo‘limdagi xatolarni qayd eting.' },
  { id: 'skills', title: 'Bo‘limlarni alohida mashq qilish', detail: 'Quyidagi imtihon bo‘limlarining har biri bo‘yicha mashq qiling; platforma mashqini rasmiy namuna deb hisoblamang.' },
  { id: 'mock', title: 'To‘liq vaqtli sinov', detail: 'Rasmiy namunadan tanaffus va vaqt qoidalariga amal qilib, to‘liq sinov bajaring.' },
  { id: 'review', title: 'Xatolarni tahlil qilish', detail: 'Xato sababini yozing, tuzatilgan topshiriqni qayta bajaring va zaif bo‘limni yana sinang.' },
  { id: 'logistics', title: 'Imtihon kuniga tayyorlanish', detail: 'Ro‘yxatdan o‘tish, ID hujjat, markaz/online format, qurilma, vaqt va natija talablarini tekshiring.' }
]);

export const CEFR_LEVELS = Object.freeze(CEFR);

export function getCertificationLanguage(id) {
  return CERTIFICATION_LANGUAGES.find(language => language.id === id) || null;
}

export function getCertificationExam(languageId, examName) {
  const language = getCertificationLanguage(languageId);
  return language?.exams.find(item => item.name === examName) || null;
}

export function createStudyPlan({ languageId, examName, target, dailyMinutes, examDate = '', today = new Date() }) {
  const language = getCertificationLanguage(languageId);
  if (!language) throw new RangeError('Qo‘llab-quvvatlanmaydigan til tanlandi.');
  const selectedExam = getCertificationExam(languageId, examName || language.exams[0].name);
  if (!selectedExam) throw new RangeError('Tanlangan imtihon ushbu til uchun mavjud emas.');
  if (!Number.isInteger(dailyMinutes) || dailyMinutes < 15 || dailyMinutes > 360) {
    throw new RangeError('Kunlik vaqt 15–360 daqiqa oralig‘idagi butun son bo‘lishi kerak.');
  }
  const selectedTarget = target || selectedExam.targets[selectedExam.targets.length - 1];
  if (!selectedExam.targets.includes(selectedTarget)) throw new RangeError('Tanlangan maqsad ushbu imtihon uchun mavjud emas.');

  let daysLeft = null;
  if (examDate) {
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(examDate);
    const parsedDate = dateParts
      ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
      : new Date(Number.NaN);
    if (!dateParts || parsedDate.getFullYear() !== Number(dateParts[1]) ||
        parsedDate.getMonth() !== Number(dateParts[2]) - 1 || parsedDate.getDate() !== Number(dateParts[3])) {
      throw new RangeError('Imtihon sanasi noto‘g‘ri.');
    }
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    daysLeft = Math.ceil((parsedDate.getTime() - startOfToday.getTime()) / 86400000);
    if (daysLeft < 0) throw new RangeError('Imtihon sanasi bugundan oldin bo‘lishi mumkin emas.');
  }

  const skills = selectedExam.skillIds.map(id => ({ id, ...SKILLS[id] }));
  const baseMinutes = Math.floor(dailyMinutes / skills.length);
  const remainder = dailyMinutes % skills.length;
  return {
    language,
    exam: selectedExam,
    target: selectedTarget,
    dailyMinutes,
    daysLeft,
    skills: skills.map((skill, index) => ({
      ...skill,
      minutes: baseMinutes + (index < remainder ? 1 : 0)
    }))
  };
}
