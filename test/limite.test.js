// Limite d'essais avec une fausse base D1 (SQLite de Node, même SQL que Cloudflare)
const test = require('node:test');
const assert = require('node:assert');
const { DatabaseSync } = require('node:sqlite');
const { tooMany, MAX } = require('../lib/limite');

const fakeD1 = () => {
  const db = new DatabaseSync(':memory:');
  return {
    raw: db,
    exec: async (sql) => db.exec(sql),
    prepare: (sql) => ({ bind: (...a) => ({ first: async () => db.prepare(sql).get(...a), run: async () => db.prepare(sql).run(...a) }) }),
  };
};

test(`limite : ${MAX} essais passent, le suivant est bloqué, une autre connexion passe`, async () => {
  const db = fakeD1();
  for (let i = 0; i < MAX; i++) assert.strictEqual(await tooMany(db, '1.2.3.4'), false);
  assert.strictEqual(await tooMany(db, '1.2.3.4'), true);
  assert.strictEqual(await tooMany(db, '5.6.7.8'), false);
  // jamais l'adresse en clair dans la base
  assert(!JSON.stringify(db.raw.prepare('SELECT * FROM essais').all()).includes('1.2.3.4'));
});

test('limite : sans base ou base en panne, on laisse passer', async () => {
  assert.strictEqual(await tooMany(undefined, '1.2.3.4'), false);
  const broken = { exec: async () => { throw new Error('panne'); } };
  assert.strictEqual(await tooMany(broken, '1.2.3.4'), false);
});
