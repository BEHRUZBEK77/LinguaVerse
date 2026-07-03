
// ══════════════════════════════════════════════════════════════
// 1. BARCHA TILLAR UCHUN KONFIGURATSIYA
// ══════════════════════════════════════════════════════════════
const LV_LANG_CONFIG = {
    uz: {
        code: 'uz', flag: '🇺🇿', name: "O'zbek", dir: 'ltr',
        // AI system prompt — barcha callAI() ga qo'shiladi
        ai_instruction: "MUHIM: Barcha javoblaringiz O'ZBEK TILIDA bo'lsin. Grammatika tushuntirishlar, so'z izohlari, baholash — barchasi o'zbek tilida.",
        // Chat mode promptlari
        chat_modes: {
            free:     "Siz SpeakVerse platformasining do'stona AI o'qituvchisisiz. O'zbek tilida gaplashing. Foydalanuvchiga til o'rganishda yordam bering. Javoblar qisqa bo'lsin (2-4 jumlа).",
            teacher:  "Siz til o'rganuvchi o'zbek talabalar uchun AI o'qituvchisisiz. Grammatika qoidalarini o'zbek tilida tushuntiring, misollar keltiring, talabani rag'batlantiring.",
            grammar:  "Siz grammatika tekshiruvchi AI siz. Foydalanuvchi matn yuborganda, barcha xatolarni toping va o'ZBEK TILIDA tushuntiring. Format: '❌ Xato → ✅ To'g'ri: ... 📚 Qoida: ...'",
            translate:"Siz professional tarjimon siz. O'zbek va boshqa tillar orasida tarjima qiling. Idiomalar va iboralarni o'zbek tilida tushuntiring.",
            exam:     "Siz imtihon tayyorlash murabbiy sisiz. O'zbek tilida dars bering, javoblarni tekshiring va ball mezonlarini tushuntiring."
        },
        // Prompt suffix — callAI() da ishlatiladi
        prompt_suffix: "\n\nJAVOBINGIZ ALBATTA O'ZBEK TILIDA BO'LSIN.",
        // UI translations
        ui: {
            home: "Bosh sahifa", learn_lang: "O'rganish tillari", shop: "Do'kon",
            profile: "Profil", plans: "Rejalar", interface_lang: "Interfeys tili",
            page_badge: "Interfeys tili sozlamalari",
            hero_title_1: "Sayt", hero_title_2: "Interfeys Tilini", hero_title_3: "Tanlang",
            hero_sub: "Sayt interfeysi va AI o'qituvchisi tanlagan tilingizda ishlaydi.",
            current_lang: "Hozirgi til",
            ai_note_title: "AI o'qituvchi ham shu tilda gaplashadi",
            ai_note_desc: "Interfeys tilini o'zgartirsangiz, AI va barcha darslar ham shu tilda ishlaydi.",
            how_title: "Qanday ishlaydi?", how_sub: "Til tanlash 3 bosqichda ishlaydi",
            how1_title: "Tilni tanlang", how1_desc: "Ro'yxatdan sayt interfeysi uchun tilni tanlang",
            how2_title: "Saqlang", how2_desc: "Tanlangan til brauzeringizda saqlanadi",
            how3_title: "AI moslashadi", how3_desc: "AI o'qituvchi tanlagan tilingizda dars beradi",
            how4_title: "Istalgan vaqt o'zgartiring", how4_desc: "Bu sahifaga qaytib boshqa tilni tanlashingiz mumkin",
            pick_title: "Interfeys tilini tanlang", pick_sub: "12 ta tildan birini tanlang",
            apply_btn: "Tilni qo'llash",
            search_placeholder: "Til qidirish...",
            toast_success: "✅ Til o'zgartirildi! Sahifa yangilanmoqda...",
        }
    },
    en: {
        code: 'en', flag: '🇺🇸', name: "English", dir: 'ltr',
        ai_instruction: "IMPORTANT: All your responses must be in ENGLISH. Explain grammar, vocabulary, assessments — everything in English.",
        chat_modes: {
            free:     "You are a friendly AI language tutor on SpeakVerse. Speak in English. Help the user practice languages. Keep responses concise (2-4 sentences).",
            teacher:  "You are an AI language teacher for English-speaking students. Explain grammar rules clearly in English, give examples, and encourage the student.",
            grammar:  "You are an English grammar checker. When the user sends text, find all errors and explain them IN ENGLISH. Format: '❌ Error → ✅ Correct: ... 📚 Rule: ...'",
            translate:"You are a professional translator. Translate between English and the target language. Explain idioms and expressions in English.",
            exam:     "You are an exam preparation coach. Teach in English, check answers and explain scoring criteria in English."
        },
        prompt_suffix: "\n\nYOUR RESPONSE MUST BE IN ENGLISH.",
        ui: {
            home: "Home", learn_lang: "Learning Languages", shop: "Shop",
            profile: "Profile", plans: "Plans", interface_lang: "Interface Language",
            page_badge: "Interface Language Settings",
            hero_title_1: "Choose", hero_title_2: "Interface Language", hero_title_3: "for the Site",
            hero_sub: "The site interface and AI teacher will work in your chosen language.",
            current_lang: "Current language",
            ai_note_title: "The AI teacher also speaks in this language",
            ai_note_desc: "When you change the interface language, the AI and all lessons also work in that language.",
            how_title: "How does it work?", how_sub: "Language selection works in 3 steps",
            how1_title: "Select a language", how1_desc: "Choose a language for the site interface",
            how2_title: "Save", how2_desc: "The selected language is saved in your browser",
            how3_title: "AI adapts", how3_desc: "The AI teacher gives lessons in your chosen language",
            how4_title: "Change anytime", how4_desc: "Come back to this page to switch languages anytime",
            pick_title: "Choose interface language", pick_sub: "Select one of 12 languages",
            apply_btn: "Apply Language",
            search_placeholder: "Search languages...",
            toast_success: "✅ Language changed! Reloading page...",
        }
    },
    ru: {
        code: 'ru', flag: '🇷🇺', name: "Русский", dir: 'ltr',
        ai_instruction: "ВАЖНО: Все ваши ответы должны быть НА РУССКОМ ЯЗЫКЕ. Объясняйте грамматику, словарный запас, оценки — всё по-русски.",
        chat_modes: {
            free:     "Вы дружелюбный ИИ-репетитор на SpeakVerse. Говорите по-русски. Помогайте пользователю изучать языки. Ответы краткие (2-4 предложения).",
            teacher:  "Вы ИИ-учитель языков для русскоязычных студентов. Объясняйте правила грамматики по-русски, приводите примеры, поощряйте.",
            grammar:  "Вы проверщик грамматики. Найдите все ошибки и объясните их ПО-РУССКИ. Формат: '❌ Ошибка → ✅ Правильно: ... 📚 Правило: ...'",
            translate:"Вы профессиональный переводчик. Переводите между русским и целевым языком. Объясняйте идиомы по-русски.",
            exam:     "Вы тренер по подготовке к экзаменам. Обучайте по-русски, проверяйте ответы и объясняйте критерии оценки."
        },
        prompt_suffix: "\n\nВАШ ОТВЕТ ДОЛЖЕН БЫТЬ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ.",
        ui: {
            home: "Главная", learn_lang: "Языки обучения", shop: "Магазин",
            profile: "Профиль", plans: "Планы", interface_lang: "Язык интерфейса",
            page_badge: "Настройки языка интерфейса",
            hero_title_1: "Выберите", hero_title_2: "Язык Интерфейса", hero_title_3: "Сайта",
            hero_sub: "Интерфейс сайта и ИИ-учитель работают на выбранном языке.",
            current_lang: "Текущий язык",
            ai_note_title: "ИИ-учитель тоже говорит на этом языке",
            ai_note_desc: "Когда вы меняете язык интерфейса, ИИ и все уроки тоже работают на нём.",
            how_title: "Как это работает?", how_sub: "Выбор языка в 3 шага",
            how1_title: "Выберите язык", how1_desc: "Выберите язык интерфейса из списка",
            how2_title: "Сохраните", how2_desc: "Язык сохраняется в браузере",
            how3_title: "ИИ адаптируется", how3_desc: "ИИ-учитель проводит уроки на выбранном языке",
            how4_title: "Меняйте в любое время", how4_desc: "Вернитесь на эту страницу для смены языка",
            pick_title: "Выберите язык интерфейса", pick_sub: "Выберите один из 12 языков",
            apply_btn: "Применить язык",
            search_placeholder: "Поиск языков...",
            toast_success: "✅ Язык изменён! Перезагрузка...",
        }
    },
    es: {
        code: 'es', flag: '🇪🇸', name: "Español", dir: 'ltr',
        ai_instruction: "IMPORTANTE: Todas tus respuestas deben estar EN ESPAÑOL. Explica gramática, vocabulario, evaluaciones — todo en español.",
        chat_modes: {
            free:     "Eres un tutor de IA amigable en SpeakVerse. Habla en español. Ayuda al usuario a practicar idiomas. Respuestas concisas (2-4 frases).",
            teacher:  "Eres un profesor de idiomas de IA para hispanohablantes. Explica gramática en español, da ejemplos, y anima al estudiante.",
            grammar:  "Eres un corrector gramatical. Encuentra errores y explícalos EN ESPAÑOL. Formato: '❌ Error → ✅ Correcto: ... 📚 Regla: ...'",
            translate:"Eres un traductor profesional. Traduce entre español y el idioma objetivo. Explica modismos en español.",
            exam:     "Eres un entrenador para exámenes. Enseña en español, revisa respuestas y explica criterios de puntuación."
        },
        prompt_suffix: "\n\nTU RESPUESTA DEBE ESTAR EN ESPAÑOL.",
        ui: {
            home: "Inicio", learn_lang: "Idiomas de aprendizaje", shop: "Tienda",
            profile: "Perfil", plans: "Planes", interface_lang: "Idioma de interfaz",
            page_badge: "Configuración del idioma de interfaz",
            hero_title_1: "Elige el", hero_title_2: "Idioma de Interfaz", hero_title_3: "del Sitio",
            hero_sub: "La interfaz del sitio y el profesor de IA trabajarán en tu idioma.",
            current_lang: "Idioma actual",
            ai_note_title: "El profesor de IA también habla en este idioma",
            ai_note_desc: "Al cambiar el idioma, la IA y todas las lecciones funcionan en ese idioma.",
            how_title: "¿Cómo funciona?", how_sub: "La selección de idioma en 3 pasos",
            how1_title: "Selecciona un idioma", how1_desc: "Elige el idioma de la interfaz del sitio",
            how2_title: "Guarda", how2_desc: "El idioma se guarda en tu navegador",
            how3_title: "La IA se adapta", how3_desc: "El profesor de IA da lecciones en tu idioma",
            how4_title: "Cambia en cualquier momento", how4_desc: "Vuelve aquí para cambiar de idioma",
            pick_title: "Elige el idioma de interfaz", pick_sub: "Selecciona uno de 12 idiomas",
            apply_btn: "Aplicar idioma",
            search_placeholder: "Buscar idiomas...",
            toast_success: "✅ ¡Idioma cambiado! Recargando...",
        }
    },
    de: {
        code: 'de', flag: '🇩🇪', name: "Deutsch", dir: 'ltr',
        ai_instruction: "WICHTIG: Alle Antworten müssen AUF DEUTSCH sein. Erkläre Grammatik, Vokabeln, Bewertungen — alles auf Deutsch.",
        chat_modes: {
            free:     "Sie sind ein freundlicher KI-Tutor auf SpeakVerse. Sprechen Sie auf Deutsch. Helfen Sie dem Nutzer beim Sprachenlernen. Antworten kurz halten (2-4 Sätze).",
            teacher:  "Sie sind ein KI-Sprachlehrer für deutschsprachige Schüler. Erklären Sie Grammatik auf Deutsch, geben Sie Beispiele, ermutigen Sie.",
            grammar:  "Sie sind ein Grammatikprüfer. Finden Sie Fehler und erklären Sie sie AUF DEUTSCH. Format: '❌ Fehler → ✅ Richtig: ... 📚 Regel: ...'",
            translate:"Sie sind ein professioneller Übersetzer. Übersetzen Sie zwischen Deutsch und der Zielsprache. Erklären Sie Idiome auf Deutsch.",
            exam:     "Sie sind ein Prüfungsvorbereitungscoach. Unterrichten Sie auf Deutsch, prüfen Sie Antworten auf Deutsch."
        },
        prompt_suffix: "\n\nIHRE ANTWORT MUSS AUF DEUTSCH SEIN.",
        ui: {
            home: "Startseite", learn_lang: "Lernsprachen", shop: "Shop",
            profile: "Profil", plans: "Pläne", interface_lang: "Schnittstellensprache",
            page_badge: "Spracheinstellungen der Oberfläche",
            hero_title_1: "Wählen Sie die", hero_title_2: "Schnittstellensprache", hero_title_3: "der Website",
            hero_sub: "Die Website-Oberfläche und der KI-Lehrer arbeiten in Ihrer Sprache.",
            current_lang: "Aktuelle Sprache",
            ai_note_title: "Der KI-Lehrer spricht auch in dieser Sprache",
            ai_note_desc: "Wenn Sie die Sprache ändern, funktioniert die KI und alle Lektionen in dieser Sprache.",
            how_title: "Wie funktioniert es?", how_sub: "Sprachauswahl in 3 Schritten",
            how1_title: "Sprache wählen", how1_desc: "Wählen Sie eine Sprache aus der Liste",
            how2_title: "Speichern", how2_desc: "Die Sprache wird in Ihrem Browser gespeichert",
            how3_title: "KI passt sich an", how3_desc: "Der KI-Lehrer gibt Lektionen auf Deutsch",
            how4_title: "Jederzeit ändern", how4_desc: "Kehren Sie zurück, um die Sprache zu ändern",
            pick_title: "Schnittstellensprache wählen", pick_sub: "Wählen Sie eine von 12 Sprachen",
            apply_btn: "Sprache anwenden",
            search_placeholder: "Sprachen suchen...",
            toast_success: "✅ Sprache geändert! Wird neu geladen...",
        }
    },
    fr: {
        code: 'fr', flag: '🇫🇷', name: "Français", dir: 'ltr',
        ai_instruction: "IMPORTANT: Toutes vos réponses doivent être EN FRANÇAIS. Expliquez la grammaire, le vocabulaire, les évaluations — tout en français.",
        chat_modes: {
            free:     "Vous êtes un tuteur IA amical sur SpeakVerse. Parlez en français. Aidez l'utilisateur à pratiquer les langues. Réponses courtes (2-4 phrases).",
            teacher:  "Vous êtes un professeur de langues IA pour francophones. Expliquez la grammaire en français, donnez des exemples, encouragez.",
            grammar:  "Vous êtes un correcteur grammatical. Trouvez les erreurs et expliquez-les EN FRANÇAIS. Format: '❌ Erreur → ✅ Correct: ... 📚 Règle: ...'",
            translate:"Vous êtes un traducteur professionnel. Traduisez entre le français et la langue cible. Expliquez les idiomes en français.",
            exam:     "Vous êtes un coach de préparation aux examens. Enseignez en français, vérifiez les réponses et expliquez les critères."
        },
        prompt_suffix: "\n\nVOTRE RÉPONSE DOIT ÊTRE EN FRANÇAIS.",
        ui: {
            home: "Accueil", learn_lang: "Langues d'apprentissage", shop: "Boutique",
            profile: "Profil", plans: "Plans", interface_lang: "Langue d'interface",
            page_badge: "Paramètres de langue d'interface",
            hero_title_1: "Choisissez la", hero_title_2: "Langue d'Interface", hero_title_3: "du Site",
            hero_sub: "L'interface du site et le professeur IA fonctionnent dans votre langue.",
            current_lang: "Langue actuelle",
            ai_note_title: "Le professeur IA parle aussi dans cette langue",
            ai_note_desc: "Quand vous changez la langue, l'IA et les leçons fonctionnent dans cette langue.",
            how_title: "Comment ça marche?", how_sub: "Sélection de langue en 3 étapes",
            how1_title: "Sélectionnez une langue", how1_desc: "Choisissez la langue dans la liste",
            how2_title: "Enregistrer", how2_desc: "La langue est enregistrée dans votre navigateur",
            how3_title: "L'IA s'adapte", how3_desc: "Le professeur IA donne des leçons en français",
            how4_title: "Changer à tout moment", how4_desc: "Revenez ici pour changer de langue",
            pick_title: "Choisissez la langue d'interface", pick_sub: "Sélectionnez l'une des 12 langues",
            apply_btn: "Appliquer la langue",
            search_placeholder: "Rechercher des langues...",
            toast_success: "✅ Langue changée! Rechargement...",
        }
    },
    tr: {
        code: 'tr', flag: '🇹🇷', name: "Türkçe", dir: 'ltr',
        ai_instruction: "ÖNEMLİ: Tüm yanıtlarınız TÜRKÇE olmalıdır. Dilbilgisi, kelime bilgisi, değerlendirmeleri açıklayın — her şey Türkçe.",
        chat_modes: {
            free:     "SpeakVerse'de dostane bir yapay zeka öğretmenisiniz. Türkçe konuşun. Kullanıcının dil pratiği yapmasına yardım edin. Yanıtlar kısa (2-4 cümle).",
            teacher:  "Türkçe konuşan öğrenciler için yapay zeka dil öğretmenisiniz. Dilbilgisi kurallarını Türkçe açıklayın, örnek verin, teşvik edin.",
            grammar:  "Dilbilgisi denetçisisiniz. Hataları bulun ve TÜRKÇE açıklayın. Format: '❌ Hata → ✅ Doğru: ... 📚 Kural: ...'",
            translate:"Profesyonel bir çevirmenisiniz. Türkçe ve hedef dil arasında çeviri yapın. Deyimleri Türkçe açıklayın.",
            exam:     "Sınav hazırlık koçusunuz. Türkçe öğretin, yanıtları Türkçe kontrol edin."
        },
        prompt_suffix: "\n\nYANITINIZ TÜRKÇE OLMALIDIR.",
        ui: {
            home: "Ana Sayfa", learn_lang: "Öğrenme Dilleri", shop: "Mağaza",
            profile: "Profil", plans: "Planlar", interface_lang: "Arayüz Dili",
            page_badge: "Arayüz Dili Ayarları",
            hero_title_1: "Site", hero_title_2: "Arayüz Dilini", hero_title_3: "Seçin",
            hero_sub: "Site arayüzü ve yapay zeka öğretmeni seçtiğiniz dilde çalışır.",
            current_lang: "Mevcut dil",
            ai_note_title: "Yapay zeka öğretmeni de bu dilde konuşur",
            ai_note_desc: "Dili değiştirdiğinizde, yapay zeka ve tüm dersler de o dilde çalışır.",
            how_title: "Nasıl çalışır?", how_sub: "Dil seçimi 3 adımda",
            how1_title: "Dil seçin", how1_desc: "Listeden arayüz dilini seçin",
            how2_title: "Kaydet", how2_desc: "Seçilen dil tarayıcınıza kaydedilir",
            how3_title: "Yapay zeka uyum sağlar", how3_desc: "Yapay zeka öğretmeni Türkçe ders verir",
            how4_title: "İstediğiniz zaman değiştirin", how4_desc: "Dili değiştirmek için buraya dönün",
            pick_title: "Arayüz dilini seçin", pick_sub: "12 dilden birini seçin",
            apply_btn: "Dili Uygula",
            search_placeholder: "Dil ara...",
            toast_success: "✅ Dil değiştirildi! Yeniden yükleniyor...",
        }
    },
    ar: {
        code: 'ar', flag: '🇸🇦', name: "العربية", dir: 'rtl',
        ai_instruction: "مهم: يجب أن تكون جميع إجاباتك باللغة العربية. اشرح القواعد والمفردات والتقييمات — كل شيء بالعربية.",
        chat_modes: {
            free:     "أنت مدرس ذكاء اصطناعي ودود على SpeakVerse. تحدث بالعربية. ساعد المستخدم في تعلم اللغات. الإجابات مختصرة (2-4 جمل).",
            teacher:  "أنت مدرس لغات ذكاء اصطناعي للناطقين بالعربية. اشرح قواعد النحو بالعربية، أعطِ أمثلة، وشجع الطالب.",
            grammar:  "أنت مدقق نحوي. ابحث عن الأخطاء واشرحها بالعربية. التنسيق: '❌ خطأ → ✅ صحيح: ... 📚 القاعدة: ...'",
            translate:"أنت مترجم محترف. ترجم بين العربية واللغة الهدف. اشرح التعبيرات الاصطلاحية بالعربية.",
            exam:     "أنت مدرب لتحضير الامتحانات. درّس بالعربية وراجع الإجابات واشرح معايير التقييم."
        },
        prompt_suffix: "\n\nيجب أن يكون ردك باللغة العربية فقط.",
        ui: {
            home: "الرئيسية", learn_lang: "لغات التعلم", shop: "المتجر",
            profile: "الملف الشخصي", plans: "الخطط", interface_lang: "لغة الواجهة",
            page_badge: "إعدادات لغة الواجهة",
            hero_title_1: "اختر", hero_title_2: "لغة الواجهة", hero_title_3: "للموقع",
            hero_sub: "واجهة الموقع ومعلم الذكاء الاصطناعي سيعملان باللغتك.",
            current_lang: "اللغة الحالية",
            ai_note_title: "معلم الذكاء الاصطناعي يتحدث أيضاً بهذه اللغة",
            ai_note_desc: "عند تغيير اللغة، يعمل الذكاء الاصطناعي وجميع الدروس بتلك اللغة.",
            how_title: "كيف يعمل؟", how_sub: "اختيار اللغة في 3 خطوات",
            how1_title: "اختر لغة", how1_desc: "اختر لغة الواجهة من القائمة",
            how2_title: "احفظ", how2_desc: "اللغة محفوظة في متصفحك",
            how3_title: "يتكيف الذكاء الاصطناعي", how3_desc: "معلم الذكاء الاصطناعي يعطي دروساً بالعربية",
            how4_title: "غيّر في أي وقت", how4_desc: "عد هنا لتغيير اللغة",
            pick_title: "اختر لغة الواجهة", pick_sub: "اختر واحدة من 12 لغة",
            apply_btn: "تطبيق اللغة",
            search_placeholder: "البحث عن لغات...",
            toast_success: "✅ تم تغيير اللغة! إعادة تحميل...",
        }
    },
    zh: {
        code: 'zh', flag: '🇨🇳', name: "中文", dir: 'ltr',
        ai_instruction: "重要：您的所有回复必须用中文。用中文解释语法、词汇、评估——一切用中文。",
        chat_modes: {
            free:     "您是SpeakVerse平台的友好AI导师。用中文说话。帮助用户练习语言。回复简洁（2-4句话）。",
            teacher:  "您是中文学习者的AI语言教师。用中文解释语法规则，给出例子，鼓励学生。",
            grammar:  "您是语法检查员。找出错误并用中文解释。格式：'❌ 错误 → ✅ 正确: ... 📚 规则: ...'",
            translate:"您是专业翻译。在中文和目标语言之间翻译。用中文解释成语。",
            exam:     "您是考试备考教练。用中文教学，检查答案并解释评分标准。"
        },
        prompt_suffix: "\n\n您的回复必须用中文。",
        ui: {
            home: "首页", learn_lang: "学习语言", shop: "商店",
            profile: "个人资料", plans: "计划", interface_lang: "界面语言",
            page_badge: "界面语言设置",
            hero_title_1: "选择", hero_title_2: "界面语言", hero_title_3: "设置",
            hero_sub: "网站界面和AI老师将以您选择的语言工作。",
            current_lang: "当前语言",
            ai_note_title: "AI老师也用这种语言说话",
            ai_note_desc: "更改语言后，AI和所有课程也会以该语言运行。",
            how_title: "如何工作？", how_sub: "语言选择分3步",
            how1_title: "选择语言", how1_desc: "从列表中选择界面语言",
            how2_title: "保存", how2_desc: "所选语言保存在您的浏览器中",
            how3_title: "AI适应", how3_desc: "AI老师用中文上课",
            how4_title: "随时更改", how4_desc: "返回此页面随时切换语言",
            pick_title: "选择界面语言", pick_sub: "从12种语言中选择一种",
            apply_btn: "应用语言",
            search_placeholder: "搜索语言...",
            toast_success: "✅ 语言已更改！正在重新加载...",
        }
    },
    ja: {
        code: 'ja', flag: '🇯🇵', name: "日本語", dir: 'ltr',
        ai_instruction: "重要：すべての回答は日本語でなければなりません。文法、語彙、評価を説明する — すべて日本語で。",
        chat_modes: {
            free:     "あなたはSpeakVerseの親切なAIチューターです。日本語で話してください。ユーザーの言語練習を手伝ってください。回答は簡潔に（2-4文）。",
            teacher:  "あなたは日本語学習者のためのAI言語教師です。日本語で文法規則を説明し、例を示し、励ましてください。",
            grammar:  "あなたは文法チェッカーです。エラーを見つけて日本語で説明してください。形式：'❌ 誤り → ✅ 正しい: ... 📚 ルール: ...'",
            translate:"あなたはプロの翻訳者です。日本語と対象言語を翻訳してください。慣用句を日本語で説明してください。",
            exam:     "あなたは試験準備コーチです。日本語で教え、回答を確認してください。"
        },
        prompt_suffix: "\n\nあなたの回答は日本語でなければなりません。",
        ui: {
            home: "ホーム", learn_lang: "学習言語", shop: "ショップ",
            profile: "プロフィール", plans: "プラン", interface_lang: "インターフェース言語",
            page_badge: "インターフェース言語設定",
            hero_title_1: "サイトの", hero_title_2: "インターフェース言語", hero_title_3: "を選択",
            hero_sub: "サイトのインターフェースとAI先生が選択した言語で動作します。",
            current_lang: "現在の言語",
            ai_note_title: "AI先生もこの言語で話します",
            ai_note_desc: "言語を変更すると、AIとすべてのレッスンもその言語で動作します。",
            how_title: "どのように機能しますか？", how_sub: "言語選択は3ステップ",
            how1_title: "言語を選択", how1_desc: "リストから言語を選択",
            how2_title: "保存", how2_desc: "言語はブラウザに保存されます",
            how3_title: "AIが適応", how3_desc: "AI先生が日本語でレッスンします",
            how4_title: "いつでも変更", how4_desc: "このページに戻って言語を変更",
            pick_title: "インターフェース言語を選択", pick_sub: "12の言語から選択",
            apply_btn: "言語を適用",
            search_placeholder: "言語を検索...",
            toast_success: "✅ 言語が変更されました！再読み込み中...",
        }
    },
    ko: {
        code: 'ko', flag: '🇰🇷', name: "한국어", dir: 'ltr',
        ai_instruction: "중요: 모든 답변은 한국어로 작성해야 합니다. 문법, 어휘, 평가를 설명하세요 — 모두 한국어로.",
        chat_modes: {
            free:     "당신은 SpeakVerse의 친근한 AI 튜터입니다. 한국어로 말하세요. 사용자가 언어를 연습하도록 도와주세요. 답변은 간결하게 (2-4 문장).",
            teacher:  "당신은 한국어 학습자를 위한 AI 언어 교사입니다. 한국어로 문법 규칙을 설명하고 예시를 제공하세요.",
            grammar:  "당신은 문법 검사기입니다. 오류를 찾아 한국어로 설명하세요. 형식: '❌ 오류 → ✅ 올바른: ... 📚 규칙: ...'",
            translate:"당신은 전문 번역가입니다. 한국어와 대상 언어를 번역하세요. 관용어를 한국어로 설명하세요.",
            exam:     "당신은 시험 준비 코치입니다. 한국어로 가르치고 답변을 확인하세요."
        },
        prompt_suffix: "\n\n당신의 답변은 한국어여야 합니다.",
        ui: {
            home: "홈", learn_lang: "학습 언어", shop: "상점",
            profile: "프로필", plans: "플랜", interface_lang: "인터페이스 언어",
            page_badge: "인터페이스 언어 설정",
            hero_title_1: "사이트", hero_title_2: "인터페이스 언어", hero_title_3: "선택",
            hero_sub: "사이트 인터페이스와 AI 선생님이 선택한 언어로 작동합니다.",
            current_lang: "현재 언어",
            ai_note_title: "AI 선생님도 이 언어로 말합니다",
            ai_note_desc: "언어를 변경하면 AI와 모든 수업도 해당 언어로 작동합니다.",
            how_title: "어떻게 작동하나요?", how_sub: "언어 선택은 3단계",
            how1_title: "언어 선택", how1_desc: "목록에서 인터페이스 언어 선택",
            how2_title: "저장", how2_desc: "선택한 언어가 브라우저에 저장됩니다",
            how3_title: "AI 적응", how3_desc: "AI 선생님이 한국어로 수업합니다",
            how4_title: "언제든지 변경", how4_desc: "이 페이지로 돌아와 언어를 변경하세요",
            pick_title: "인터페이스 언어 선택", pick_sub: "12개 언어 중 하나 선택",
            apply_btn: "언어 적용",
            search_placeholder: "언어 검색...",
            toast_success: "✅ 언어가 변경되었습니다! 다시 로드합니다...",
        }
    },
    it: {
        code: 'it', flag: '🇮🇹', name: "Italiano", dir: 'ltr',
        ai_instruction: "IMPORTANTE: Tutte le risposte devono essere IN ITALIANO. Spiega grammatica, vocabolario, valutazioni — tutto in italiano.",
        chat_modes: {
            free:     "Sei un tutor IA amichevole su SpeakVerse. Parla in italiano. Aiuta l'utente a praticare le lingue. Risposte concise (2-4 frasi).",
            teacher:  "Sei un insegnante di lingue IA per italofoni. Spiega le regole grammaticali in italiano, dai esempi e incoraggia.",
            grammar:  "Sei un correttore grammaticale. Trova errori e spiegali IN ITALIANO. Formato: '❌ Errore → ✅ Corretto: ... 📚 Regola: ...'",
            translate:"Sei un traduttore professionista. Traduci tra italiano e la lingua target. Spiega idiomi in italiano.",
            exam:     "Sei un coach per gli esami. Insegna in italiano, controlla le risposte e spiega i criteri di valutazione."
        },
        prompt_suffix: "\n\nLA TUA RISPOSTA DEVE ESSERE IN ITALIANO.",
        ui: {
            home: "Home", learn_lang: "Lingue di apprendimento", shop: "Negozio",
            profile: "Profilo", plans: "Piani", interface_lang: "Lingua interfaccia",
            page_badge: "Impostazioni lingua interfaccia",
            hero_title_1: "Scegli la", hero_title_2: "Lingua dell'Interfaccia", hero_title_3: "del Sito",
            hero_sub: "L'interfaccia del sito e l'insegnante IA lavorano nella lingua scelta.",
            current_lang: "Lingua corrente",
            ai_note_title: "Anche l'insegnante IA parla in questa lingua",
            ai_note_desc: "Quando cambi la lingua, l'IA e le lezioni funzionano in quella lingua.",
            how_title: "Come funziona?", how_sub: "Selezione della lingua in 3 passi",
            how1_title: "Seleziona una lingua", how1_desc: "Scegli la lingua dall'elenco",
            how2_title: "Salva", how2_desc: "La lingua viene salvata nel browser",
            how3_title: "L'IA si adatta", how3_desc: "L'insegnante IA dà lezioni in italiano",
            how4_title: "Cambia in qualsiasi momento", how4_desc: "Torna qui per cambiare lingua",
            pick_title: "Scegli la lingua dell'interfaccia", pick_sub: "Seleziona una delle 12 lingue",
            apply_btn: "Applica lingua",
            search_placeholder: "Cerca lingue...",
            toast_success: "✅ Lingua cambiata! Ricaricamento...",
        }
    }
};

// ══════════════════════════════════════════════════════════════
// 2. JORIY TIL — localStorage dan olinadi
// ══════════════════════════════════════════════════════════════
const _lvCode = localStorage.getItem('lv_interface_lang') || 'uz';
const LV_LANG = LV_LANG_CONFIG[_lvCode] || LV_LANG_CONFIG['uz'];

// Global qilib chiqaramiz
window.LV_LANG = LV_LANG;
window.LV_LANG_CONFIG = LV_LANG_CONFIG;

// RTL/LTR
document.documentElement.dir = LV_LANG.dir || 'ltr';
document.documentElement.lang = LV_LANG.code;

// ══════════════════════════════════════════════════════════════
// 3. callAI() OVERRIDE — ASOSIY MEXANIZM
//    Barcha JS faillarda callAI() chaqirilganda bu funksiya ishlaydi.
//    Prompt ga til instruksiyasini AVTOMATIK qo'shadi.
// ══════════════════════════════════════════════════════════════
window.__LV_patchCallAI = function () {
    // Agar callAI allaqachon mavjud bo'lsa, uni wrap qilamiz
    if (typeof callAI === 'function' && !callAI.__lvPatched) {
        const _original = callAI;
        window.callAI = async function (prompt, maxTok = 1000) {
            // Prompt ga til instruksiyasini qo'sh
            const langInstruction = LV_LANG.ai_instruction || '';
            const patchedPrompt = langInstruction
                ? `${langInstruction}\n\n${prompt}`
                : prompt;
            return _original(patchedPrompt, maxTok);
        };
        window.callAI.__lvPatched = true;
    }
};

// ══════════════════════════════════════════════════════════════
// 4. CHAT MODE PROMPTLARINI OVERRIDE QILISH
//    chat_modes: { free, teacher, grammar, translate, exam }
//    Har bir JS faylida CHAT_MODES yoki chatModes objecti bo'lishi mumkin
// ══════════════════════════════════════════════════════════════
window.__LV_patchChatModes = function (modesObj) {
    if (!modesObj || !LV_LANG.chat_modes) return modesObj;
    const chatModes = LV_LANG.chat_modes;
    // Har bir mode uchun sys prompt ni yangi til prompti bilan almashtir
    const modeKeys = Object.keys(modesObj);
    modeKeys.forEach((key, idx) => {
        const chatModeKeys = Object.keys(chatModes);
        // Key bo'yicha topishga harakat qil
        if (chatModes[key]) {
            modesObj[key].sys = chatModes[key];
        } else if (chatModeKeys[idx]) {
            // Indeks bo'yicha moslashtir
            modesObj[key].sys = chatModes[chatModeKeys[idx]];
        }
    });
    return modesObj;
};

// ══════════════════════════════════════════════════════════════
// 5. UI TARJIMALARI — data-i18n atributlari bilan elementlarni tarjima qilish
// ══════════════════════════════════════════════════════════════
function lvApplyUI() {
    const t = LV_LANG.ui;
    if (!t) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key] !== undefined) el.textContent = t[key];
    });
    // Placeholder larni ham tarjima qilish
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key] !== undefined) el.placeholder = t[key];
    });
}

// ══════════════════════════════════════════════════════════════
// 6. NAVIGATE LINKS — barcha a[href] larni tekshirish (agar path noto'g'ri bo'lsa)
// ══════════════════════════════════════════════════════════════
function lvFixNavLinks() {
    // language.html sahifasiga link bo'lgan barcha linklar
    document.querySelectorAll('a[href*="language.html"], a[href*="languages.html"]').forEach(a => {
        // Hech narsa o'zgartirmaymiz — faqat languages-html/language.html ni ko'rsatamiz
        const href = a.getAttribute('href');
        if (href === 'languages.html' || href === '../languages.html') {
            // Root dan languages-html/language.html ga redirect
            a.setAttribute('href', href.includes('..') 
                ? '../languages-html/language.html' 
                : 'languages-html/language.html');
        }
    });
}

// ══════════════════════════════════════════════════════════════
// 7. DOMContentLoaded da hammani ishga tushir
// ══════════════════════════════════════════════════════════════
(function () {
    function boot() {
        lvApplyUI();
        lvFixNavLinks();
        // callAI patching — asosiy JS fayl yuklanganidan keyin
        setTimeout(window.__LV_patchCallAI, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Sahifa to'liq yuklanganida yana bir bor patch
    window.addEventListener('load', function () {
        window.__LV_patchCallAI();
    });
})();

// ══════════════════════════════════════════════════════════════
// 8. PROMPT BUILDER — boshqa JS fayllar ishlatishi uchun
//    Misol: callAI(lvPrompt(`so'zni tushuntir: ${word}`))
// ══════════════════════════════════════════════════════════════
window.lvPrompt = function (basePrompt) {
    return (LV_LANG.ai_instruction || '') + '\n\n' + basePrompt + (LV_LANG.prompt_suffix || '');
};

// ══════════════════════════════════════════════════════════════
// 9. CHAT SYS PROMPT GETTER
//    Misol: getLvChatSys('free') → til bo'yicha sys prompt
// ══════════════════════════════════════════════════════════════
window.getLvChatSys = function (modeKey) {
    const modes = LV_LANG.chat_modes || {};
    const modeKeys = Object.keys(modes);
    // to'g'ridan-to'g'ri key bo'yicha
    if (modes[modeKey]) return modes[modeKey];
    // Agar topilmasa default free ni qaytaramiz
    return modes[modeKeys[0]] || 'You are a helpful language tutor. Answer in the user\'s preferred language.';
};

console.log(`[SpeakVerse] Interface lang: ${LV_LANG.name} (${LV_LANG.code})`);