const jwt = require('jsonwebtoken');

// Reads the "token" cookie (if present) and attaches req.user.
// Never blocks the request — routes decide what's required.
function attachUser(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin access only.' });
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
