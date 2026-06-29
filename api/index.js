// api/index.js — super minimal test
module.exports = function handler(req, res) {
  const path = req.url;
  if (path.startsWith('/api/auth')) {
    return require('./auth.js')(req, res);
  }
  if (path.startsWith('/api/cron')) {
    return require('./cron.js')(req, res);
  }
  if (path.startsWith('/api/manual')) {
    return require('./manual.js')(req, res);
  }
  return res.status(404).json({ error: 'Not found', path });
};
