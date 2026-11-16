const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();

// GET /api/prestadores (público — retorna apenas perfil = 'prestador' ativos, nunca admin)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, telefone, cargo_tag
       FROM usuarios
       WHERE perfil = 'prestador' AND ativo = TRUE
       ORDER BY id ASC`
    );

    return res.json({ prestadores: result.rows });
  } catch (err) {
    console.error('[PRESTADORES] Erro ao listar:', err);
    return res.status(500).json({ erro: 'Erro ao listar prestadores.' });
  }
});

// PATCH /api/prestadores/meu-whatsapp (autenticado — atualiza telefone do próprio usuário)
router.patch('/meu-whatsapp', authenticateToken, async (req, res) => {
  try {
    const { telefone } = req.body || {};
    const limpo = String(telefone || '').replace(/\D/g, '');

    if (limpo.length < 10 || limpo.length > 15) {
      return res.status(400).json({
        erro: 'Informe um número de WhatsApp válido com DDD (ex: 5521999999999).',
      });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET telefone = $1
       WHERE id = $2
       RETURNING id, nome, usuario, telefone, cargo_tag, perfil`,
      [limpo, req.user.id]
    );

    return res.json({ usuario: result.rows[0] });
  } catch (err) {
    console.error('[PRESTADORES] Erro ao atualizar WhatsApp:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar WhatsApp.' });
  }
});

module.exports = router;
