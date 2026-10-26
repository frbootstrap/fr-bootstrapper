// Fabrique les liens d'addons. Rien n'est enregistré : les clés servent le temps de la requête.
const { buildLinks, checkDebrid, tmdbKeys, TRACKERS } = require('../lib/addons');

const NAMES = { alldebrid: 'AllDebrid', torbox: 'TorBox' };
const isKey = (key) => typeof key === 'string' && /^[A-Za-z0-9_.-]{8,256}$/.test(key);
const isManifest = (url) => typeof url === 'string' && /^https:\/\/[^\s]+\/manifest\.json$/.test(url);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'méthode non permise' });
  const { alldebrid, torbox, tmdb, trackers = {}, mine = {} } = req.body || {};

  const debrid = Object.entries({ alldebrid, torbox }).filter(([, key]) => key);
  if (!debrid.length) return res.status(400).json({ error: 'il faut au moins une clé AllDebrid ou TorBox' });
  for (const [service, key] of debrid) {
    if (!isKey(key)) return res.status(400).json({ error: `clé ${NAMES[service]} invalide (copie-la en entier, sans espace)` });
  }
  if (tmdb && !tmdbKeys(tmdb)) return res.status(400).json({ error: 'jeton TMDB invalide : copie le « jeton d’accès en lecture », pas la clé courte' });
  if (typeof trackers !== 'object' || typeof mine !== 'object') return res.status(400).json({ error: 'requête invalide' });
  for (const [name, key] of Object.entries(trackers)) {
    if (!TRACKERS[name] || (key && !isKey(key))) return res.status(400).json({ error: `clé ${name} invalide (copie-la en entier, sans espace)` });
  }
  for (const [name, url] of Object.entries(mine)) {
    if (!['lumio', 'wacustom', 'streamfusion'].includes(name) || (url && !isManifest(url))) {
      return res.status(400).json({ error: 'un lien « j’ai déjà un compte » doit commencer par https:// et finir par /manifest.json' });
    }
  }

  for (const [service, key] of debrid) {
    const problem = await checkDebrid(service, key);
    if (problem) return res.status(400).json({ error: problem });
  }
  res.json({ addons: await buildLinks({ alldebrid, torbox, tmdbToken: tmdb, trackers, mine }) });
};
