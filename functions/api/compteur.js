// Nombre d'installations : un seul nombre stocké (KV « COMPTEUR »), rien sur les personnes
import { menage } from '../../lib/limite.js';

export async function onRequestGet({ env, waitUntil }) {
  // Chaque visite efface aussi les empreintes d'essais périmées (lib/limite.js)
  waitUntil(menage(env.LIMITE).catch(() => {}));
  const n = env.COMPTEUR ? Number(await env.COMPTEUR.get('installations')) || 0 : null;
  return Response.json({ n }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
