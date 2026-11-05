const fsdb = require('./_firestore');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { Allow: 'GET', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Faqat GET so‘rovi qo‘llab-quvvatlanadi' })
    };
  }

  if (!fsdb.configured()) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Firestore xizmat hisobi sozlanmagan' })
    };
  }

  try {
    const userCount = await fsdb.countCollection('users');
    return {
      statusCode: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userCount })
    };
  } catch (error) {
    console.error('[student-count] O‘quvchilar sonini olishda xato:', error.stack || error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'O‘quvchilar sonini olish imkoni bo‘lmadi' })
    };
  }
};
