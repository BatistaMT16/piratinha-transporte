const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'piratinha_transporte_jwt_secret_2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      usuario: user.usuario,
      nome: user.nome,
      perfil: user.perfil,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Token de autenticação não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ erro: 'Sessão expirada ou token inválido.' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.perfil !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireAdmin,
};
