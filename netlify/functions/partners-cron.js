'use strict';
// Hamkorlik markazi — kunlik avtomatika (Cloudflare cron va GitHub Actions chaqiradi).
// HTTP orqali ochiq EMAS: faqat rejalashtirilgan ishga tushirish.
const { runCron } = require('./_partner-service.js');
exports.handler = async function () {
  const r = await runCron();
  console.log('[partners-cron]', JSON.stringify(r));
  return { statusCode: 200, body: JSON.stringify(r) };
};
