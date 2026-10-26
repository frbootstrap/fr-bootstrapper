// Bouton « Vérifier » à côté de chaque clé debrid
const { checkDebrid } = require('../lib/addons');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'méthode non permise' });
  const { service, key } = req.body || {};
  if (!['alldebrid', 'torbox'].includes(service) || typeof key !== 'string' || !/^[A-Za-z0-9_.-]{8,256}$/.test(key)) {
    return res.json({ error: 'clé mal copiée : il la faut en entier, sans espace' });
  }
  res.json({ error: await checkDebrid(service, key) });
};
