export function createFallbackDailyPlan(analysis, userData = {}) {
    const focus = analysis.weak?.[0]?.[0] || 'grammatika';
    const streak = userData.stats?.streak || 0;

    return {
        isFallback: true,
        greeting: streak > 0
            ? `${streak} kunlik ketma-ketlikni davom ettiring — bugun ham ozgina mashq qiling!`
            : 'Bugun kichik qadam tashlang — muntazamlik katta natija beradi!',
        totalMinutes: 30,
        tasks: [
            { order: 1, type: 'reading', title: 'O‘qish mashqi', desc: `${focus} ko‘nikmasini mustahkamlash uchun qisqa matn o‘qing.`, min: 8, icon: '📖', xp: 50, priority: 'high', skill: 'reading' },
            { order: 2, type: 'listening', title: 'Tinglab tushunish', desc: 'Qisqa audio tinglab, asosiy fikrlarni eslab qoling.', min: 7, icon: '🎧', xp: 55, priority: 'high', skill: 'listening' },
            { order: 3, type: 'speaking', title: 'Gapirish mashqi', desc: 'Tanish mavzuda bir daqiqa davomida ovoz chiqarib gapiring.', min: 8, icon: '🎤', xp: 60, priority: 'medium', skill: 'speaking' },
            { order: 4, type: 'writing', title: 'Yozish mashqi', desc: 'Bugungi mavzu haqida bir necha gap yozing.', min: 5, icon: '✍️', xp: 65, priority: 'medium', skill: 'writing' },
            { order: 5, type: 'vocabulary', title: 'Yangi so‘zlar', desc: `${focus} bo‘yicha beshta yangi so‘zni o‘rganib, gaplarda ishlating.`, min: 2, icon: '📚', xp: 30, priority: 'low', skill: 'vocabulary' }
        ],
        motivationTip: `${focus} ustida muntazam ishlang — har kuni ozgina mashq ham sezilarli yordam beradi.`,
        weeklyGoal: 'Hafta davomida har kuni kamida bitta mashq bajaring.',
        funChallenge: 'Bugun o‘rgangan beshta yangi so‘zni gaplarda ishlating.'
    };
}
