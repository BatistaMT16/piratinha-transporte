const express = require('express');
const pool = require('../db');
const { generateToken, authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();

// POST /api/auth/login (case-insensitive para usuário)
router.post('/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body || {};

    if (!usuario || !senha) {
      return res.status(400).json({ erro: 'Informe usuário e senha.' });
    }

    const result = await pool.query(
      `SELECT id, nome, usuario, telefone, cargo_tag, perfil, ativo
       FROM usuarios
       WHERE LOWER(TRIM(usuario)) = LOWER(TRIM($1))
         AND senha = $2
         AND ativo = TRUE
       LIMIT 1`,
      [String(usuario), String(senha)]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }

    const user = result.rows[0];
    const token = generateToken(user);

    return res.json({
      token,
      usuario: user,
    });
  } catch (err) {
    console.error('[AUTH] Erro no login:', err);
    return res.status(500).json({ erro: 'Erro interno ao autenticar.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, usuario, telefone, cargo_tag, perfil, ativo
       FROM usuarios
       WHERE id = $1 AND ativo = TRUE`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    return res.json({ usuario: result.rows[0] });
  } catch (err) {
    console.error('[AUTH] Erro ao buscar usuário atual:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

module.exports = router;
