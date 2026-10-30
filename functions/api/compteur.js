// Nombre d'installations : un seul nombre stocké (base D1, lib/compteur.js), rien sur les personnes
import { menage } from '../../lib/limite.js';
import { lire } from '../../lib/compteur.js';

export async function onRequestGet({ env, waitUntil }) {
  // Chaque visite efface aussi les empreintes d'essais périmées (lib/limite.js)
  waitUntil(menage(env.DB).catch(() => {}));
  const n = env.DB ? await lire(env.DB, env.COMPTEUR).catch(() => null) : null;
  return Response.json({ n }, { headers: { 'Cache-Control': 'no-store' } });
}
