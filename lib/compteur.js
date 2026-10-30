// Nombre d'installations dans D1 : le +1 est fait par la base elle-même, donc exact même pour deux installations simultanées.
// La première fois, reprend le chiffre de l'ancien compteur KV pour ne pas repartir de zéro.
let ready;
const prepare = (db, kv) => (ready ??= (async () => {
  await db.exec('CREATE TABLE IF NOT EXISTS compteur (k TEXT PRIMARY KEY, n INTEGER)');
  const old = Number(await kv?.get('installations')) || 0;
  await db.prepare("INSERT OR IGNORE INTO compteur (k, n) VALUES ('installations', ?1)").bind(old).run();
})().catch((err) => { ready = undefined; throw err; }));

async function compter(db, kv) {
  await prepare(db, kv);
  await db.prepare("UPDATE compteur SET n = n + 1 WHERE k = 'installations'").bind().run();
}

async function lire(db, kv) {
  await prepare(db, kv);
  const row = await db.prepare("SELECT n FROM compteur WHERE k = 'installations'").bind().first();
  return row ? row.n : 0;
}

module.exports = { compter, lire };
