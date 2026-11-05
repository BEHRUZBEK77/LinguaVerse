// ═══════════════════════════════════════════════════════════════════════════
// _syllabus.js — 150 TA DARSNING O'QUV MATERIALI (A1 → C2, har darajada 25)
//
// js/course-catalog.mjs dagi CEFR_TOPICS bilan BIR XIL tartibda.
// Har bir dars: [maqsad, majburiy o'rgatiladigan nuqtalar, amaliy topshiriq]
// AI ustoz (course.js → corePrompt) shu materialga qat'iy amal qiladi:
// ssenariy, ovoz (ElevenLabs) va MP4 shu reja asosida yaratiladi, shuning
// uchun 8 til va 9 ona tilida darslar bir xil sifat va izchillikda bo'ladi.
// Matn inglizcha — bu AI uchun ko'rsatma; o'quvchi uni ona tilida eshitadi.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const S = {
  A1: [
    ['Read and pronounce every letter/sound of the script and spell own name aloud.', ['writing system or alphabet overview (letters, syllable blocks, characters or Pinyin as relevant)', 'sounds that do not exist in the native language', 'stress/tone basics', 'spelling own name'], 'Spell your name and city aloud, then read 5 new words.'],
    ['Greet people, introduce yourself and say goodbye in formal and informal situations.', ['formal vs informal greetings by time of day', 'my name is / I am from', 'asking someone\'s name and origin', 'polite leave-taking'], 'Record a 30-second self-introduction with a greeting and a goodbye.'],
    ['Count to 100 and give age and a phone number.', ['numbers 0–20, tens, compound numbers', 'how age is expressed (verb or structure differs by language)', 'reading phone numbers digit by digit or in pairs', 'native-speaker pitfalls with teens/tens'], 'Say your age, your phone number and three prices.'],
    ['Describe yourself and your family.', ['family members vocabulary', 'possessives: my/your/his/her', 'have/has or the language\'s possession structure', 'describing family size and jobs'], 'Describe 4 family members in 6 sentences.'],
    ['Make the simplest statements with the verb "to be" (or its equivalent / omission).', ['forms of "to be" or how the language links subject and predicate (e.g. no present copula in Russian/Arabic, copula suffixes in Turkish, 이다 in Korean, 是 in Chinese)', 'subject pronouns', 'short answers', 'contrast with the native language'], 'Write 8 "I am / he is" sentences about people you know.'],
    ['Name common jobs and workplaces and ask what someone does.', ['20 job names (with gender forms where the language has them)', 'What do you do? / Where do you work?', 'workplace vocabulary', 'articles or classifiers with jobs if relevant'], 'Say what 5 people you know do and where they work.'],
    ['Tell the time and describe a daily routine with times.', ['asking and telling the time, half/quarter', 'parts of the day', 'at + time or equivalent', 'routine verbs: get up, eat, go, sleep'], 'Describe your weekday with at least 6 clock times.'],
    ['Talk about habits and routines in the present simple (or the language\'s basic present).', ['present tense conjugation/endings', 'third person or person agreement', 'frequency words: always, usually, never', 'word order of adverbs'], 'Write 8 sentences about your habits using frequency words.'],
    ['Order food and drinks in a café and ask for the bill.', ['food and drink vocabulary', 'I would like / Can I have (polite request forms)', 'asking prices and paying', 'cultural politeness when ordering'], 'Role-play ordering a full meal and paying.'],
    ['Describe a home, rooms and furniture.', ['rooms and furniture vocabulary', 'there is / there are or existence structures', 'basic location words', 'describing size and condition'], 'Describe your home room by room in 8 sentences.'],
    ['Ask for and give directions in a city.', ['places in town', 'turn left/right, go straight, opposite, next to', 'polite question forms', 'imperative for directions'], 'Give directions from your home to a nearby shop.'],
    ['Name colours and clothes and buy clothes in a shop.', ['colours (with agreement if the language has it)', 'clothes vocabulary', 'size, try on, price questions', 'this/that demonstratives'], 'Describe what you are wearing and role-play buying a jacket.'],
    ['Form questions correctly.', ['yes/no question formation (word order, particle, intonation)', 'question words: who, what, where, when, why, how, how much', 'question word order', 'intonation of questions'], 'Write 10 questions to ask a new friend.'],
    ['Make negative sentences correctly.', ['negation forms for to be and other verbs', 'negative particles/auxiliaries', 'double negation rules in this language', 'short negative answers'], 'Write 8 true negative sentences about yourself.'],
    ['Say days, months and dates correctly.', ['days of the week, months', 'ordinal numbers for dates', 'date format and prepositions (on/in or equivalents)', 'birthdays and appointments'], 'Say your birthday and 3 important dates this year.'],
    ['Talk about weather and seasons.', ['weather expressions (impersonal structures)', 'seasons and temperatures', 'what is the weather like?', 'adjectives for weather'], 'Describe the weather in your city in each season.'],
    ['Talk about hobbies and free time.', ['hobby vocabulary', 'like/love/hate + activity (verb form after like differs by language)', 'asking about free time', 'giving a reason with because'], 'Describe 3 hobbies and why you like them.'],
    ['Express ability with can / cannot.', ['modal of ability or its equivalent', 'question and negative forms', 'well / a little / not at all', 'skills vocabulary'], 'Say 5 things you can and 5 things you cannot do.'],
    ['Describe people and things with adjectives.', ['appearance and character adjectives', 'adjective position and agreement', 'very / quite / too', 'opposites'], 'Describe a friend\'s appearance and character in 8 sentences.'],
    ['Use plurals and count objects.', ['plural formation rules and irregulars (or classifiers/measure words in Chinese and Korean)', 'how many?', 'numbers with nouns (case/number agreement where relevant)', 'common mistakes'], 'Count and name 10 objects around you.'],
    ['Use personal and possessive pronouns correctly.', ['subject, object and possessive pronouns or their particle/suffix equivalents', 'formal vs informal you', 'agreement of possessives', 'pronoun dropping where natural'], 'Rewrite a short text replacing names with pronouns.'],
    ['Say where things are with prepositions of place (or postpositions/case endings).', ['in, on, under, behind, between, next to equivalents', 'how location is marked (prepositions, cases, particles)', 'Where is...?', 'describing a picture'], 'Describe where 8 objects are in your room.'],
    ['Use transport and buy a ticket.', ['transport vocabulary', 'by bus / on foot structures', 'buying a ticket: one-way, return, time, platform', 'asking how long it takes'], 'Role-play buying a train ticket to another city.'],
    ['Understand a short simple text and dialogue.', ['reading for the main idea', 'listening for names, numbers and places', 'key-word strategy', 'answering comprehension questions'], 'Retell a short dialogue in 4 sentences.'],
    ['Review all A1 material and pass the A1 exam.', ['to be, present tense, questions, negatives', 'core vocabulary groups', 'introductions, shopping, directions', 'exam task types and timing'], 'Complete the A1 exam and record a 1-minute self-introduction.']
  ],
  A2: [
    ['Talk about finished past events with regular verbs.', ['regular past forms (or aspect particle 了 / past suffixes / perfective forms as the language uses)', 'time markers: yesterday, last week, ago', 'questions and negatives in the past', 'pronunciation of past endings where relevant'], 'Write 8 sentences about what you did yesterday.'],
    ['Use the most common irregular past forms.', ['30 high-frequency irregular verbs (or the language\'s irregular/aspect-pair forms)', 'memorisation patterns', 'past questions and short answers', 'common native-speaker mistakes'], 'Tell a short story using 10 irregular verbs.'],
    ['Narrate a past holiday or trip.', ['sequencing: first, then, after that, finally', 'travel vocabulary', 'past tense in narrative', 'expressing feelings about the trip'], 'Speak for 1 minute about your last holiday.'],
    ['Talk about future plans and intentions.', ['going to / will or the language\'s future forms', 'plan vs prediction vs decision', 'future time expressions', 'questions about plans'], 'Describe your plans for next weekend and next year.'],
    ['Compare two things with comparatives.', ['comparative formation and irregulars', 'than / as ... as equivalents', 'much / a bit + comparative', 'comparing cities, people, products'], 'Compare two cities in 8 sentences.'],
    ['Say what is the best/most with superlatives.', ['superlative formation and irregulars', 'in / of the group', 'ever in superlative sentences', 'favourites and records'], 'Describe the best and worst things about your city.'],
    ['Explain a health problem at the doctor\'s and pharmacy.', ['body parts and symptoms', 'I have a headache / it hurts structures', 'doctor\'s advice (should/must)', 'pharmacy dialogue and dosage words'], 'Role-play a doctor visit with three symptoms.'],
    ['Handle a hotel stay and travel situations.', ['booking, check-in, check-out', 'complaints and requests', 'polite request forms', 'travel problems vocabulary'], 'Role-play checking in and reporting a problem in your room.'],
    ['Talk about work and study life.', ['work/study vocabulary', 'responsibilities: I have to / I am responsible for', 'describing a typical day at work or school', 'likes and dislikes about work'], 'Describe your job or studies in 1 minute.'],
    ['Describe actions happening now (present continuous or equivalent).', ['present progressive form or how the language shows ongoing action', 'now / at the moment', 'contrast with the simple/habitual present', 'state verbs not used in progressive (if relevant)'], 'Describe what 6 people in a picture are doing now.'],
    ['Invite, accept and refuse politely.', ['invitation structures', 'accepting enthusiastically', 'refusing politely with a reason', 'suggesting another time'], 'Write 3 invitations and a polite refusal for each.'],
    ['Give commands, requests and advice.', ['imperative forms (formal/informal)', 'polite requests: could you / please equivalents', 'advice: should / it is better to', 'softening commands'], 'Give a new student 8 pieces of advice.'],
    ['Talk about holidays and traditions.', ['holiday vocabulary', 'customs of the target culture', 'comparing with the native culture', 'greetings for holidays'], 'Describe your favourite holiday and one target-culture holiday.'],
    ['Read a menu, order and pay in a restaurant.', ['menu vocabulary and cooking methods', 'ordering courses and special requests', 'complaining politely', 'paying and tipping customs'], 'Role-play a full restaurant visit with one complaint.'],
    ['Write short letters and messages.', ['message openings and closings', 'informal vs semi-formal tone', 'thanking, inviting, apologising', 'punctuation and layout'], 'Write a 60-word message inviting a friend.'],
    ['Use countable and uncountable nouns correctly.', ['countable vs uncountable (or the language\'s mass/count system, measure words)', 'some/any equivalents', 'containers: a bottle of, a piece of', 'common mistakes'], 'Write a shopping list with quantities for 10 items.'],
    ['Express quantity: much, many, a few, a little.', ['quantifiers with countable/uncountable nouns', 'too much / not enough', 'how much / how many', 'natural usage in conversation'], 'Describe your diet using 8 quantity words.'],
    ['Link ideas with and, but, because, so.', ['coordinating conjunctions', 'cause and result', 'word order after conjunctions (e.g. German weil, Turkish -dığı için)', 'joining short sentences'], 'Join 8 pairs of short sentences.'],
    ['Talk about nature, animals and surroundings.', ['nature and animal vocabulary', 'describing landscapes', 'likes and fears', 'environment basics'], 'Describe a place in nature you love.'],
    ['Talk about films, music and books.', ['genres vocabulary', 'giving opinions: I think / in my opinion', 'recommending', 'describing a plot simply'], 'Recommend a film or book in 1 minute.'],
    ['Handle money, prices and bargaining.', ['currency and large numbers', 'expensive/cheap, discount, change', 'bargaining phrases and culture', 'paying by card/cash'], 'Role-play bargaining at a market.'],
    ['Talk about phones, the internet and social media.', ['tech vocabulary', 'describing online habits', 'pros and cons', 'digital communication phrases'], 'Describe how you use your phone each day.'],
    ['Talk about life experiences (present perfect or equivalent).', ['present perfect form or experiential structures (e.g. 过 in Chinese, -아/어 본 적이 있다 in Korean)', 'ever / never', 'contrast with the simple past', 'follow-up questions'], 'Ask and answer 8 "Have you ever...?" questions.'],
    ['Understand announcements and everyday dialogues.', ['listening for key information', 'station/airport announcements', 'predicting content', 'note-taking basics'], 'Listen and note 5 key details from an announcement.'],
    ['Review all A2 material and pass the A2 exam.', ['past, future, comparatives, perfect', 'everyday transactions', 'messages and short texts', 'exam strategy'], 'Complete the A2 exam and tell a 1-minute story about your week.']
  ],
  B1: [
    ['Review the full tense/aspect system and choose the right form.', ['overview of all tenses/aspects of the language in one map', 'time markers for each', 'choosing by meaning, not translation', 'native-speaker transfer errors'], 'Write a 120-word text using at least 5 different tenses.'],
    ['Use the perfect aspect for experience and results.', ['present perfect / perfective forms', 'for and since or duration structures', 'just, already, yet', 'result vs experience'], 'Describe 6 changes in your life over the last 5 years.'],
    ['Tell stories with past continuous and background actions.', ['past progressive or imperfective', 'interrupted actions: while / when', 'setting the scene in a story', 'contrast with simple past'], 'Tell a 1-minute story of an unexpected event.'],
    ['Use different future forms correctly.', ['will vs going to vs present for future (or the language\'s future forms)', 'future continuous/perfect basics', 'predictions, plans, arrangements', 'time clauses about the future'], 'Describe your life in 10 years using 3 future forms.'],
    ['Make real conditionals.', ['zero and first conditional (or real-condition forms)', 'if / when / unless', 'tense in the condition clause', 'giving warnings and promises'], 'Write 8 real conditional sentences about your city.'],
    ['Make hypothetical conditionals.', ['second conditional / unreal present', 'if I were you advice', 'wish structures', 'difference from real conditions'], 'Answer "What would you do if...?" for 6 situations.'],
    ['Express obligation, permission and advice with modals.', ['must / have to / should / may / can equivalents', 'lack of obligation vs prohibition', 'formal vs informal permission', 'modal meanings in context'], 'Write the rules of your school or workplace.'],
    ['Use the passive voice for processes and news.', ['passive formation in this language', 'when to use passive', 'by-agent', 'passive in news headlines'], 'Describe how a product is made in 8 passive sentences.'],
    ['Use relative clauses to define and add information.', ['relative pronouns or participial/attributive structures (e.g. Korean -는, Turkish -an/-dık)', 'defining vs non-defining', 'word order and punctuation', 'combining sentences'], 'Define 8 words using relative clauses.'],
    ['Give and justify an opinion.', ['opinion phrases', 'reasons and examples', 'agreeing and disagreeing politely', 'linking: firstly, moreover, however'], 'Give a 1-minute opinion on "Is social media useful?"'],
    ['Succeed in a job interview.', ['common interview questions', 'describing strengths and experience', 'formal register', 'asking the interviewer questions'], 'Answer 5 interview questions aloud.'],
    ['Talk about education and studying.', ['education vocabulary', 'school systems comparison', 'learning methods', 'expressing preferences'], 'Compare education in your country and the target country.'],
    ['Talk about technology in daily life.', ['technology vocabulary', 'advantages and disadvantages', 'describing how something works', 'future of technology'], 'Speak for 1 minute about a device you cannot live without.'],
    ['Talk about healthy living.', ['diet, exercise, sleep vocabulary', 'giving advice', 'habits and changes', 'cause and effect'], 'Write advice for a healthier lifestyle (100 words).'],
    ['Discuss the environment and ecology.', ['environment vocabulary', 'problems and solutions', 'should/must for actions', 'cause-effect linkers'], 'Present 3 environmental problems and solutions.'],
    ['Report what other people said.', ['reported speech basics (or the language\'s quotation/reporting forms)', 'tense/person changes', 'reporting verbs: say, tell, ask', 'reported questions'], 'Report a conversation you had today.'],
    ['Use infinitives and gerunds (or verbal nouns) correctly.', ['verb + infinitive vs verb + -ing (or verbal noun/nominaliser)', 'purpose structures', 'common verb patterns', 'frequent mistakes'], 'Write 10 sentences using 10 different verb patterns.'],
    ['Use 30 essential fixed expressions naturally.', ['high-frequency collocations and set phrases', 'meaning in context', 'register of each', 'avoiding literal translation'], 'Use 10 of the expressions in a short dialogue.'],
    ['Write formal and informal letters.', ['layout and conventions', 'formal vs informal phrases', 'requesting, complaining, thanking', 'paragraphing'], 'Write a formal complaint and an informal email (120 words each).'],
    ['Find the main idea of a text.', ['skimming', 'topic sentences', 'distinguishing main idea from detail', 'summarising in one sentence'], 'Summarise a 300-word article in 3 sentences.'],
    ['Catch specific details while listening.', ['listening for numbers, names, reasons', 'predicting answers', 'signpost words', 'checking answers'], 'Listen and answer 6 detail questions.'],
    ['Compare and contrast two options.', ['similarities and differences language', 'whereas, while, on the other hand', 'structuring a comparison', 'concluding with a preference'], 'Compare living in a city vs the countryside (1 minute).'],
    ['Tell an engaging story.', ['story structure', 'narrative tenses', 'adding suspense and feelings', 'storytelling phrases'], 'Tell a 2-minute personal story.'],
    ['Describe a problem and propose solutions.', ['problem language', 'suggesting solutions', 'evaluating options', 'making a recommendation'], 'Describe a problem in your city and 3 solutions.'],
    ['Review all B1 material and pass the B1 exam.', ['tense system, conditionals, passive, reported speech', 'opinion and narrative skills', 'letters and summaries', 'exam strategy'], 'Complete the B1 exam and give a 2-minute talk.']
  ],
  B2: [
    ['Understand what B2 requires and how to reach it.', ['B2 descriptors: fluency, accuracy, range', 'typical plateau at B1', 'study plan for B2', 'self-assessment'], 'Record a 2-minute talk and self-assess it against B2 criteria.'],
    ['Master subtle tense/aspect differences in context.', ['perfect continuous, past perfect or the language\'s nuanced aspect choices', 'contrast of similar forms', 'tense in narrative and reporting', 'error analysis'], 'Correct 10 sentences with tense errors and explain why.'],
    ['Speak fluently and in detail about yourself.', ['extended answers technique', 'adding examples and reasons', 'fillers and natural pauses', 'range of vocabulary'], 'Answer 5 personal questions with 30-second answers.'],
    ['Use real, hypothetical and mixed conditionals.', ['third conditional / unreal past', 'mixed conditionals', 'alternatives to if: provided, otherwise', 'regrets and criticism'], 'Write 8 sentences about past decisions and their effects.'],
    ['Use professional work and career vocabulary.', ['career vocabulary and collocations', 'describing achievements', 'workplace communication', 'formal emails at work'], 'Write a 150-word career summary.'],
    ['Defend an opinion with evidence.', ['claim, reason, evidence, example', 'hedging and strengthening', 'counter-argument and rebuttal', 'persuasive phrases'], 'Give a 2-minute argued opinion.'],
    ['Use the passive and formal style.', ['advanced passive forms', 'impersonal structures: it is said that', 'formal vs neutral register', 'rewriting active to formal'], 'Rewrite an informal text in formal style.'],
    ['Discuss education and technology at B2 level.', ['advanced topic vocabulary', 'discussing trends', 'expressing certainty and doubt', 'balanced argument'], 'Discuss "Will AI replace teachers?" for 2 minutes.'],
    ['Understand main ideas and details while listening.', ['note-taking structure', 'identifying speaker attitude', 'distractors in listening tasks', 'paraphrase recognition'], 'Listen to a talk and write 6 key points.'],
    ['Read fast with skimming and scanning.', ['skimming for gist', 'scanning for specific information', 'time management', 'matching headings'], 'Scan a text for 8 facts in 3 minutes.'],
    ['Master reported speech fully.', ['all reporting verbs with patterns', 'reporting questions, commands, suggestions', 'when tense does not change', 'summarising conversations'], 'Report a debate using 10 different reporting verbs.'],
    ['Write formal and informal letters at B2 level.', ['purpose-driven structure', 'tone control', 'complaint, application, recommendation letters', 'cohesion'], 'Write a 200-word letter of application.'],
    ['Build complex sentences.', ['subordination and coordination', 'participle clauses', 'concession: although, despite', 'sentence variety for style'], 'Combine 10 simple sentences into 4 complex ones.'],
    ['Use the 100 most useful collocations.', ['verb + noun, adjective + noun collocations', 'collocation vs literal translation', 'topic-grouped collocations', 'memory techniques'], 'Write a paragraph using 15 collocations.'],
    ['Deliver a 2-minute monologue about an experience.', ['planning in 1 minute', 'structure: situation, details, feelings, reflection', 'time phrases and linkers', 'keeping going without stopping'], 'Record two 2-minute monologues on given cards.'],
    ['Discuss environment and society.', ['social issues vocabulary', 'cause, effect and solution language', 'statistics language', 'balanced discussion'], 'Discuss a social problem for 2 minutes.'],
    ['Structure an essay: introduction, arguments, conclusion.', ['thesis statement', 'paragraph structure: topic sentence, support, example', 'linking paragraphs', 'concluding without repetition'], 'Write a 250-word opinion essay.'],
    ['Improve stress, intonation and connected speech.', ['word and sentence stress (or tones/pitch)', 'linking and reduction', 'intonation for meaning', 'shadowing technique'], 'Shadow a 1-minute native recording and compare.'],
    ['Debate and express counter-arguments.', ['interrupting politely', 'conceding and countering', 'asking for clarification', 'summarising positions'], 'Hold a 3-minute debate with the teacher prompts.'],
    ['Express speculation and probability.', ['must have / might have / can\'t have (or equivalents)', 'probably, likely, bound to', 'deduction from evidence', 'degrees of certainty'], 'Speculate about 6 pictures or situations.'],
    ['Discuss media, advertising and news.', ['media vocabulary', 'analysing an advert', 'bias and reliability', 'reporting news'], 'Analyse an advertisement in 1 minute.'],
    ['Understand cross-cultural differences.', ['cultural norms of target-language countries', 'politeness and directness', 'avoiding cultural mistakes', 'comparing cultures respectfully'], 'Describe 3 cultural differences you noticed.'],
    ['Describe graphs and tables.', ['trend vocabulary: rise, fall, fluctuate', 'comparing data', 'overview sentence', 'accurate numbers and approximations'], 'Write a 150-word description of a chart.'],
    ['Apply B2 exam strategy.', ['exam format of the target exam', 'time management per section', 'common traps', 'scoring criteria'], 'Plan your timing for a full mock exam.'],
    ['Review all B2 material and pass the B2 final exam for the certificate.', ['full grammar and vocabulary review', 'speaking and writing criteria', 'reading and listening strategy', 'certificate requirements'], 'Complete the B2 final exam.']
  ],
  C1: [
    ['Understand the C1 roadmap.', ['C1 descriptors: precision, flexibility, implicit meaning', 'gaps typical at B2', 'study plan', 'measuring progress'], 'Record a 3-minute talk and list 5 C1 goals.'],
    ['Use inversion and emphatic structures.', ['inversion after negative adverbials (or the language\'s emphasis devices: word order, particles, cleft)', 'cleft sentences: what I need is', 'fronting for emphasis', 'register of emphatic forms'], 'Rewrite 8 sentences with emphasis.'],
    ['Master 300 key academic words.', ['academic word families', 'collocations of academic words', 'formal synonyms of common words', 'using them in writing'], 'Write a paragraph using 15 academic words.'],
    ['Distinguish fine differences between synonyms.', ['near-synonyms in meaning, register, collocation', 'connotation (positive/negative)', 'choosing the precise word', 'dictionary skills'], 'Explain the difference in 6 synonym pairs.'],
    ['Use idioms naturally and appropriately.', ['high-frequency idioms', 'context and register', 'avoiding overuse', 'idioms in speaking tests'], 'Use 8 idioms correctly in a story.'],
    ['Use advanced meanings of modal verbs.', ['modals of deduction in the past', 'criticism and regret: should have', 'formal modals: shall, need not', 'subtle meaning differences'], 'Write 10 sentences showing advanced modal meanings.'],
    ['Speak for 2 minutes without stopping.', ['idea generation techniques', 'expanding with examples and contrast', 'self-correction strategies', 'natural fillers'], 'Speak for 2 minutes on 3 random topics.'],
    ['Reason about abstract topics.', ['abstract nouns and concepts', 'hypothetical reasoning', 'generalising and qualifying', 'structuring abstract arguments'], 'Discuss "Is success luck or effort?" for 3 minutes.'],
    ['Use nominalisation and academic style.', ['verb → noun transformations', 'impersonal academic tone', 'dense noun phrases', 'when not to overuse'], 'Rewrite a spoken paragraph in academic style.'],
    ['Use cohesive devices skilfully.', ['reference, substitution, ellipsis', 'advanced linkers', 'paragraph-to-paragraph cohesion', 'avoiding mechanical linking'], 'Improve the cohesion of a given text.'],
    ['Write argumentative essays at band 7–8 level.', ['task response and position', 'developed paragraphs', 'lexical and grammatical range', 'analysing model answers'], 'Write a 280-word argumentative essay.'],
    ['Identify author purpose and attitude in complex texts.', ['implicit meaning and tone', 'author stance markers', 'fact vs opinion', 'inference questions'], 'Analyse the attitude of an opinion article.'],
    ['Understand fast speech and different accents.', ['connected speech features', 'major accents of the language', 'understanding under speed', 'strategy for missed words'], 'Transcribe 30 seconds of fast native speech.'],
    ['Persuade and negotiate.', ['persuasive techniques', 'negotiation stages', 'making concessions and conditions', 'diplomatic language'], 'Role-play a negotiation for a better salary.'],
    ['Paraphrase effectively.', ['synonym substitution', 'changing word class and structure', 'keeping meaning precise', 'paraphrasing in exams'], 'Paraphrase 10 sentences in two ways each.'],
    ['Use advanced subordinate clauses and reduced constructions.', ['participle and absolute clauses', 'reduced relative clauses', 'converbs or equivalents where the language uses them', 'style and clarity'], 'Rewrite a paragraph using 5 reduced clauses.'],
    ['Write business correspondence and reports.', ['report structure', 'formal email conventions', 'recommendations and findings', 'concise professional style'], 'Write a 250-word report with recommendations.'],
    ['Discuss science and technology at C1 level.', ['scientific vocabulary', 'explaining processes', 'evaluating impacts', 'ethical aspects'], 'Discuss a scientific breakthrough for 3 minutes.'],
    ['Use economics and business vocabulary.', ['economic terms and collocations', 'describing markets and trends', 'business discussion phrases', 'numbers and finance'], 'Explain an economic trend in your country.'],
    ['Deliver an effective presentation.', ['presentation structure', 'signposting', 'engaging the audience', 'handling questions'], 'Give a 3-minute presentation.'],
    ['Convey meaning through intonation (or tone/pitch control).', ['intonation for attitude', 'contrastive stress', 'tonal accuracy for tone languages', 'expressive reading'], 'Read a dialogue expressing 4 different attitudes.'],
    ['Eliminate the most common C1 errors.', ['persistent errors of native-language speakers', 'collocation and preposition errors', 'register slips', 'self-editing checklist'], 'Find and fix 15 errors in a text.'],
    ['Manage time and stress in the exam.', ['time plan per section', 'stress-control techniques', 'prioritising questions', 'checking strategy'], 'Do a timed section and review mistakes.'],
    ['Full mock exam: Speaking and Writing.', ['speaking test procedure', 'writing tasks under time', 'self-evaluation with band descriptors', 'feedback priorities'], 'Complete the full speaking and writing mock.'],
    ['Review all C1 material and pass the C1 final exam.', ['advanced grammar review', 'academic vocabulary review', 'all-skill exam practice', 'certificate requirements'], 'Complete the C1 final exam.']
  ],
  C2: [
    ['Understand the path from C1 to near-native C2.', ['C2 descriptors: effortless precision, nuance', 'remaining gaps', 'immersion strategies', 'personal plan'], 'Record a 3-minute talk and list 5 nuances to master.'],
    ['Control register from formal to colloquial.', ['register spectrum', 'colloquial and slang awareness', 'switching register appropriately', 'register in writing vs speech'], 'Rewrite one message in 3 registers.'],
    ['Understand and use sarcasm, humour and irony.', ['how irony is signalled', 'humour in the target culture', 'understatement and overstatement', 'avoiding misunderstandings'], 'Explain 5 humorous or ironic examples.'],
    ['Use phraseology and proverbs.', ['proverbs and their native-language equivalents', 'set expressions of the target language', 'appropriate use in context', 'cultural background'], 'Use 6 proverbs in context.'],
    ['Use rhetorical devices and the art of speech.', ['rhetorical questions, tricolon, contrast, repetition', 'persuasive structure', 'famous speech analysis', 'delivery'], 'Write and deliver a 2-minute persuasive speech.'],
    ['Master complex grammatical structures.', ['rare and complex structures of the language', 'subjunctive or mood nuances', 'complex word order', 'style-driven grammar choices'], 'Write 10 sentences with complex structures.'],
    ['Analyse literary texts.', ['literary devices', 'theme and symbolism', 'style analysis vocabulary', 'writing an analysis'], 'Write a 200-word analysis of a short literary passage.'],
    ['Debate philosophy and ethics.', ['abstract ethical vocabulary', 'constructing logical arguments', 'thought experiments', 'respectful disagreement'], 'Debate an ethical dilemma for 3 minutes.'],
    ['Use politics and international relations vocabulary.', ['political terms', 'diplomatic and journalistic language', 'neutral, balanced description', 'news analysis'], 'Summarise and analyse an international news story neutrally.'],
    ['Write in the style of a scientific article.', ['article structure: abstract, method, results, discussion', 'hedging and precision', 'citation language', 'objectivity'], 'Write a 250-word abstract.'],
    ['Write a band 9 essay.', ['full analysis of a band 9 model', 'sophisticated argument development', 'precise vocabulary and flawless grammar', 'final proofreading'], 'Write a 300-word essay and self-score it.'],
    ['Catch tone and intention in fast speech.', ['implied meaning', 'tone and attitude markers', 'humour and irony in speech', 'fast authentic material'], 'Identify the speaker\'s intention in 5 clips.'],
    ['Understand cultural context and historical references.', ['cultural allusions', 'historical events frequently referenced', 'literature and media references', 'interpreting allusions'], 'Explain 5 cultural references from authentic texts.'],
    ['Master word formation with prefixes and suffixes.', ['productive prefixes and suffixes (or word-building/root patterns)', 'word families', 'forming new words correctly', 'exam word-formation tasks'], 'Build 30 words from 6 roots.'],
    ['Handle subtle grammatical nuances and exceptions.', ['exceptions to common rules', 'subtle meaning shifts', 'native-speaker variation', 'prescriptive vs descriptive usage'], 'Explain 8 subtle grammar contrasts.'],
    ['Use diplomatic language and softening.', ['hedging and softeners', 'indirect requests and refusals', 'face-saving language', 'diplomatic criticism'], 'Rewrite 8 direct statements diplomatically.'],
    ['Develop topics in depth (Part 3 level).', ['analysing causes and consequences', 'comparing past and future', 'abstract generalisation', 'extending answers with depth'], 'Answer 4 Part-3-style questions for 1 minute each.'],
    ['Give public speeches and take part in debates.', ['speech structure for an audience', 'debate formats', 'rebuttal techniques', 'confident delivery'], 'Deliver a 3-minute speech and rebut one argument.'],
    ['Translate and think bilingually.', ['translation strategies', 'false friends', 'cultural adaptation', 'thinking directly in the target language'], 'Translate a paragraph both ways and compare.'],
    ['Achieve natural speech flow in pronunciation.', ['rhythm and connected speech at native speed', 'prosody for nuance', 'accent reduction priorities', 'advanced shadowing'], 'Shadow 2 minutes of native speech and record it.'],
    ['Write error-free: editing and proofreading.', ['self-editing checklist', 'common subtle errors', 'punctuation mastery', 'concision'], 'Edit a 300-word text to perfection.'],
    ['Full mock exam: Speaking.', ['full speaking test simulation', 'band descriptors at the top level', 'feedback and improvement plan', 'managing nerves'], 'Complete the full speaking mock.'],
    ['Full mock exam: Writing and Reading.', ['writing tasks under time', 'hardest reading question types', 'self-scoring', 'improvement plan'], 'Complete the writing and reading mock.'],
    ['Prepare for exam day: strategy and psychology.', ['final week plan', 'exam-day routine', 'stress management', 'last-minute review'], 'Write your personal exam-day plan.'],
    ['Review everything and pass the C2 final exam for the certificate.', ['complete C2 review', 'all skills at top level', 'certificate requirements', 'next steps after C2'], 'Complete the C2 final exam.']
  ]
};

// Har bir tilni o'qitishda e'tibor beriladigan o'ziga xosliklar
const LANG_NOTES = {
  english: 'English: articles, phrasal verbs, irregular verbs, tense-aspect system, weak forms and linking in pronunciation; British and American variants where they differ.',
  russian: 'Russian: 6 cases and their endings, verb aspect pairs (perfective/imperfective), verbs of motion, gender, no present-tense copula, stress mobility and vowel reduction; Cyrillic script.',
  spanish: 'Spanish: ser vs estar, gender and agreement, preterite vs imperfect, subjunctive, por vs para, clitic pronouns; Spain and Latin-American variants where they differ.',
  german: 'German: gender and 4 cases, V2 and verb-final word order, separable verbs, Perfekt vs Präteritum, Konjunktiv II, adjective endings.',
  turkish: 'Turkish: vowel harmony, agglutinative suffix order, SOV word order, case suffixes, -di/-miş past distinction, possessive suffixes, converbs (-ip, -erek).',
  arabic: 'Arabic (Modern Standard, with notes on common spoken forms): script and letters by position, root-and-pattern system, gender and dual, verb forms, iḍāfa, sun/moon letters, case endings at higher levels.',
  korean: 'Korean: Hangul, particles (은/는, 이/가, 을/를), speech levels and honorifics, SOV order, verb endings, sound-change rules in pronunciation.',
  chinese: 'Mandarin Chinese: Pinyin and 4 tones plus neutral tone, characters and radicals, measure words, aspect particles 了/过/着 instead of tenses, topic-comment structure, HSK vocabulary.'
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** cefr + daraja ichidagi o'rin bo'yicha material: { goal, points, task } yoki null */
function lessonMaterial(cefr, indexInLevel) {
  const row = S[cefr]?.[indexInLevel];
  return row ? { goal: row[0], points: row[1], task: row[2] } : null;
}

/** Kursdagi dars raqamidan (b2: 0–99, c2: 0–49) daraja ichidagi o'rinni topadi */
function indexInLevel(level, idx) { return idx % 25; }

module.exports = { SYLLABUS: S, LANG_NOTES, LEVELS, lessonMaterial, indexInLevel };
