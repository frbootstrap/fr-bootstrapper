// Limite d'essais par connexion (« Vérifier » + « Installer ») : empêche de tester des clés volées à la chaîne.
// L'adresse IP n'est jamais gardée : seulement une empreinte (hachage) qui change toutes les 10 minutes, effacée ensuite.
// D1 et pas KV : KV relit avec jusqu'à 60 s de retard, un script rapide passerait au travers.
const MAX = 30;
const FENETRE = 600; // secondes

let ready;
const prepare = (db) => (ready ??= db.exec('CREATE TABLE IF NOT EXISTS essais (k TEXT PRIMARY KEY, n INTEGER, fin INTEGER)'));

// Efface les empreintes des fenêtres terminées (appelé aussi à chaque visite de la page)
async function menage(db) {
  if (!db) return;
  await prepare(db);
  await db.prepare('DELETE FROM essais WHERE fin < ?1').bind(Math.floor(Date.now() / 1000)).run();
}

async function tooMany(db, ip) {
  if (!db) return false; // base pas encore branchée : pas de limite
  try {
    await prepare(db);
    const win = Math.floor(Date.now() / 1000 / FENETRE);
    const k = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`frb|${ip}|${win}`))).toString('hex');
    const { n } = await db.prepare('INSERT INTO essais (k, n, fin) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n')
      .bind(k, (win + 1) * FENETRE).first();
    await menage(db);
    return n > MAX;
  } catch (err) {
    // Panne du compteur : on laisse passer, il ne doit jamais bloquer une vraie personne
    console.error('limite :', err.message);
    ready = undefined;
    return false;
  }
}

const TROP = 'trop d’essais d’un coup : réessaie dans quelques minutes';

module.exports = { tooMany, menage, TROP, MAX };
