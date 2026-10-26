// Bouton « Vérifier » à côté de chaque clé debrid
import { checkDebrid } from '../../lib/addons.js';

export async function onRequestPost({ request }) {
  const { service, key } = await request.json().catch(() => ({}));
  if (!['alldebrid', 'torbox'].includes(service) || typeof key !== 'string' || !/^[A-Za-z0-9_.-]{8,256}$/.test(key)) {
    return Response.json({ error: 'clé mal copiée : il la faut en entier, sans espace' });
  }
  return Response.json({ error: await checkDebrid(service, key) });
}
