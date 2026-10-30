// Bouton « Vérifier » à côté de chaque clé debrid ou tracker
import { checkDebrid, checkTracker, TRACKERS } from '../../lib/addons.js';
import { tooMany, TROP } from '../../lib/limite.js';

export async function onRequestPost({ request, env }) {
  if (await tooMany(env.DB, request.headers.get('CF-Connecting-IP'))) return Response.json({ error: TROP }, { status: 429 });
  const { service, key } = await request.json().catch(() => ({}));
  const known = ['alldebrid', 'torbox'].includes(service) || (TRACKERS[service] && service !== 'nekobt');
  if (!known || typeof key !== 'string' || !/^[A-Za-z0-9_.-]{8,256}$/.test(key)) {
    return Response.json({ error: 'clé mal copiée : il la faut en entier, sans espace' });
  }
  if (TRACKERS[service]) return Response.json(await checkTracker(service, key));
  return Response.json({ error: await checkDebrid(service, key) });
}
