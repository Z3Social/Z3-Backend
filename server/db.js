// Tiny JSON-file datastore with debounced atomic writes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;
let saveTimer = null;

function uid() {
  return crypto.randomUUID();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user || !user.passHash) return false;
  const { hash } = hashPassword(password, user.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(user.passHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function load({ reset = false } = {}) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!reset && fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = require('./seed')({ uid, hashPassword });
    saveNow();
  }
  // forward-compatible defaults
  for (const k of ['users', 'groups', 'posts', 'comments', 'follows', 'notifications', 'messages', 'files']) {
    if (!Array.isArray(db[k])) db[k] = [];
  }
  if (!db.sessions) db.sessions = {};
  if (!db.site) db.site = {};
  return db;
}

function saveNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 150);
}

module.exports = {
  load,
  save,
  saveNow,
  uid,
  hashPassword,
  verifyPassword,
  get db() {
    return db;
  },
};
