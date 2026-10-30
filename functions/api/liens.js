// Fabrique les liens d'addons. Rien n'est enregistré : les clés servent le temps de la requête.
import { buildLinks, checkDebrid, tmdbKeys, TRACKERS } from '../../lib/addons.js';
import { tooMany, TROP } from '../../lib/limite.js';
import { compter } from '../../lib/compteur.js';

const NAMES = { alldebrid: 'AllDebrid', torbox: 'TorBox' };
const isKey = (key) => typeof key === 'string' && /^[A-Za-z0-9_.-]{8,256}$/.test(key);
const isManifest = (url) => typeof url === 'string' && /^https:\/\/[^\s]+\/manifest\.json$/.test(url);
const fail = (error) => Response.json({ error }, { status: 400 });

export async function onRequestPost({ request, env, waitUntil }) {
  if (await tooMany(env.DB, request.headers.get('CF-Connecting-IP'))) return Response.json({ error: TROP }, { status: 429 });
  const { alldebrid, torbox, tmdb, trackers = {}, mine = {}, skip = [], notes = true } = await request.json().catch(() => ({}));

  const debrid = Object.entries({ alldebrid, torbox }).filter(([, key]) => key);
  if (!debrid.length) return fail('il faut au moins une clé AllDebrid ou TorBox');
  for (const [service, key] of debrid) {
    if (!isKey(key)) return fail(`clé ${NAMES[service]} invalide (copie-la en entier, sans espace)`);
  }
  if (tmdb && !tmdbKeys(tmdb)) return fail('jeton TMDB invalide : copie le « jeton d’accès en lecture », pas la clé courte');
  if (typeof trackers !== 'object' || typeof mine !== 'object') return fail('requête invalide');
  if (!Array.isArray(skip) || skip.some((s) => typeof s !== 'string')) return fail('requête invalide');
  for (const [name, key] of Object.entries(trackers)) {
    if (!TRACKERS[name] || (key && !isKey(key))) return fail(`clé ${name} invalide (copie-la en entier, sans espace)`);
  }
  for (const [name, url] of Object.entries(mine)) {
    if (!['lumio', 'wacustom', 'streamfusion'].includes(name) || (url && !isManifest(url))) {
      return fail('un lien « j’ai déjà un compte » doit commencer par https:// et finir par /manifest.json');
    }
  }

  for (const [service, key] of debrid) {
    const problem = await checkDebrid(service, key);
    if (problem) return fail(problem);
  }
  const addons = await buildLinks({ alldebrid, torbox, tmdbToken: tmdb, trackers, mine, skip, notes: notes !== false });
  // Compté ici (clé debrid déjà vérifiée) : impossible de gonfler le chiffre sans vraie clé
  if (env.DB) waitUntil(compter(env.DB, env.COMPTEUR).catch((err) => console.error('compteur :', err.message)));
  return Response.json({ addons });
}
