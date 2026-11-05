const crypto = require('crypto');
const { promisify } = require('util');
const fsdb = require('./_firestore');
const { verifyIdToken } = require('./_auth');

const pbkdf2 = promisify(crypto.pbkdf2);
const HASH_ITERATIONS = 210000;
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

function validRoomId(roomId) {
  return typeof roomId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(roomId);
}

function validPassword(password) {
  return typeof password === 'string' && password.length > 0 && password.length <= 30;
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = await pbkdf2(password, salt, HASH_ITERATIONS, 32, 'sha256');
  return { salt: salt.toString('base64'), hash: hash.toString('base64'), iterations: HASH_ITERATIONS };
}

async function rateLimit(key) {
  let allowed = false;
  await fsdb.transact(`rate_limits/${encodeURIComponent(`voice-room:${key}`)}`, current => {
    const now = Date.now();
    const start = current?.windowStart || now;
    const count = now - start >= WINDOW_MS ? 0 : current?.count || 0;
    if (count >= MAX_ATTEMPTS) return null;
    allowed = true;
    return { windowStart: count === 0 ? now : start, count: count + 1 };
  });
  return allowed;
}

async function checkPasswordRate(event, uid) {
  const headers = event.headers || {};
  const ip = headers['x-nf-client-connection-ip']
    || (headers['x-forwarded-for'] || '').split(',')[0].trim()
    || headers['client-ip'];
  const keys = [`uid:${uid}`];
  if (ip) keys.push(`ip:${ip}`);
  for (const key of keys) {
    if (!await rateLimit(key)) return false;
  }
  return true;
}

async function verifyRoomPassword(roomId, room, password) {
  const secret = await fsdb.getDoc(`voiceRoomSecrets/${roomId}`);
  if (secret) {
    if (secret.iterations !== HASH_ITERATIONS || typeof secret.salt !== 'string' || typeof secret.hash !== 'string') {
      throw new Error('Xona paroli sozlamasi noto‘g‘ri');
    }
    const derived = await hashPassword(password, Buffer.from(secret.salt, 'base64'));
    return constantTimeEqual(derived.hash, secret.hash);
  }

  // Upgrade old rooms the first time their owner/visitor successfully joins.
  if (typeof room.password !== 'string' || !constantTimeEqual(password, room.password)) return false;
  await fsdb.setDoc(`voiceRoomSecrets/${roomId}`, await hashPassword(password));
  await fsdb.deleteFields(`voiceRooms/${roomId}`, ['password']);
  return true;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Faqat POST so‘rovi qo‘llab-quvvatlanadi' });
  if (!fsdb.configured()) return json(503, { error: 'Xona serveri sozlanmagan' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'So‘rov formati noto‘g‘ri' });
  }
  if (!validRoomId(body.roomId)) return json(400, { error: 'Xona identifikatori noto‘g‘ri' });

  let user;
  try {
    user = await verifyIdToken(body.idToken);
  } catch {
    return json(401, { error: 'Kirish muddati tugagan, qayta urinib ko‘ring' });
  }

  const roomPath = `voiceRooms/${body.roomId}`;
  try {
    if (body.action === 'configure') {
      const room = await fsdb.getDoc(roomPath);
      if (!room) return json(404, { error: 'Xona topilmadi' });
      if (room.hostUid !== user.uid) return json(403, { error: 'Faqat xona egasi sozlay oladi' });
      if (room.locked) {
        if (!validPassword(body.password)) return json(400, { error: 'Xona paroli noto‘g‘ri' });
        await fsdb.setDoc(`voiceRoomSecrets/${body.roomId}`, await hashPassword(body.password));
        if (typeof room.password === 'string') await fsdb.deleteFields(roomPath, ['password']);
      }
      return json(200, { ok: true });
    }

    if (body.action === 'join') {
      if (typeof body.peerId !== 'string' || !body.peerId || body.peerId.length > 100
        || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 40) {
        return json(400, { error: 'Ishtirokchi ma’lumotlari noto‘g‘ri' });
      }
      const room = await fsdb.getDoc(roomPath);
      if (!room) return json(404, { error: 'Xona topilmadi' });

      if (room.locked) {
        if (!validPassword(body.password)) return json(403, { error: 'Xona paroli noto‘g‘ri' });
        if (!await checkPasswordRate(event, user.uid)) {
          return json(429, { error: 'Parol urinishlari ko‘p. Birozdan keyin qayta urinib ko‘ring.' });
        }
        if (!await verifyRoomPassword(body.roomId, room, body.password)) {
          return json(403, { error: 'Xona paroli noto‘g‘ri' });
        }
      }

      await fsdb.transact(roomPath, current => {
        if (!current) throw new Error('Xona topilmadi');
        if (current.locked !== room.locked) throw new Error('Xona holati o‘zgardi');
        const peers = Array.isArray(current.peers) ? current.peers : [];
        if (peers.some(peer => peer.uid === user.uid)) throw new Error('Siz bu xonadasiz');
        if (Number(current.maxPeers) > 0 && peers.length >= Number(current.maxPeers)) {
          throw new Error('Xona to‘la');
        }
        return { peers: [...peers, { uid: user.uid, peerId: body.peerId, name: body.name.trim() }] };
      });
      try {
        await fsdb.setDoc(`voiceRoomMembers/${body.roomId}_${user.uid}`, {
          roomId: body.roomId, uid: user.uid, joinedAt: new Date()
        });
      } catch (error) {
        await fsdb.transact(roomPath, current => current
          ? { peers: (current.peers || []).filter(peer => peer.uid !== user.uid) }
          : null);
        throw error;
      }
      return json(200, { ok: true });
    }

    if (body.action === 'leave') {
      const room = await fsdb.getDoc(roomPath);
      if (!room) return json(200, { ok: true });
      if (room.hostUid === user.uid) {
        await fsdb.deleteDoc(roomPath);
        await fsdb.deleteDoc(`voiceRoomSecrets/${body.roomId}`);
      } else {
        await fsdb.transact(roomPath, current => {
          if (!current) return null;
          return { peers: (current.peers || []).filter(peer => peer.uid !== user.uid) };
        });
      }
      await fsdb.deleteDoc(`voiceRoomMembers/${body.roomId}_${user.uid}`);
      return json(200, { ok: true });
    }

    return json(400, { error: 'Noma’lum xona amali' });
  } catch (error) {
    if (error.message === 'Xona topilmadi') return json(404, { error: error.message });
    if (error.message === 'Xona to‘la') return json(409, { error: error.message });
    if (error.message === 'Siz bu xonadasiz') return json(409, { error: error.message });
    console.error('[voice-room] Amal bajarilmadi:', body.action, error.stack || error.message);
    return json(500, { error: 'Xona amalini bajarib bo‘lmadi' });
  }
};
