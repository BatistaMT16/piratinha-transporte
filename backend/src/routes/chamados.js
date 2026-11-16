const express = require('express');
const pool = require('../db');
const { authenticateToken, requireAdmin } = require('../utils/authMiddleware');

const router = express.Router();

// GET /api/chamados (autenticado)
// Admin vê todos; prestador vê apenas os seus
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT ch.*, u.nome AS autor_nome, u.usuario AS autor_usuario
      FROM chamados_suporte ch
      INNER JOIN usuarios u ON u.id = ch.usuario_id
    `;
    const params = [];

    if (req.user.perfil !== 'admin') {
      params.push(req.user.id);
      query += ` WHERE ch.usuario_id = $1`;
    }

    query += ` ORDER BY ch.criado_em DESC`;

    const result = await pool.query(query, params);
    return res.json({ chamados: result.rows });
  } catch (err) {
    console.error('[CHAMADOS] Erro ao listar:', err);
    return res.status(500).json({ erro: 'Erro ao listar chamados.' });
  }
});

// POST /api/chamados (autenticado)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tipo, titulo, descricao } = req.body || {};

    if (!['bug', 'melhoria', 'duvida'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo de chamado inválido.' });
    }

    if (!titulo || !String(titulo).trim() || !descricao || !String(descricao).trim()) {
      return res.status(400).json({ erro: 'Informe título e descrição do chamado.' });
    }

    const result = await pool.query(
      `INSERT INTO chamados_suporte (usuario_id, tipo, titulo, descricao, status)
       VALUES ($1, $2, $3, $4, 'aberto')
       RETURNING *`,
      [req.user.id, tipo, String(titulo).trim().slice(0, 150), String(descricao).trim()]
    );

    return res.status(201).json({ chamado: result.rows[0] });
  } catch (err) {
    console.error('[CHAMADOS] Erro ao criar:', err);
    return res.status(500).json({ erro: 'Erro ao abrir chamado.' });
  }
});

// PATCH /api/chamados/:id (somente admin)
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, resposta_admin } = req.body || {};

    const validos = ['aberto', 'em_analise', 'em_desenvolvimento', 'finalizado'];
    if (status && !validos.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido.' });
    }

    const result = await pool.query(
      `UPDATE chamados_suporte
       SET status = COALESCE($1, status),
           resposta_admin = COALESCE($2, resposta_admin),
           atualizado_em = NOW()
       WHERE id = $3
       RETURNING *`,
      [status || null, resposta_admin !== undefined ? String(resposta_admin).trim() : null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Chamado não encontrado.' });
    }

    return res.json({ chamado: result.rows[0] });
  } catch (err) {
    console.error('[CHAMADOS] Erro ao atualizar:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar chamado.' });
  }
});

module.exports = router;
