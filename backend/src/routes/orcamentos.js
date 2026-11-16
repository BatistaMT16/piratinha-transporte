const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../utils/authMiddleware');
const { encerrarServicosExpirados24h } = require('../jobs/cleanup');

const router = express.Router();

function normalizarWhatsapp(valor) {
  return String(valor || '').replace(/\D/g, '');
}

async function buscarOrcamentosCompletos(whereClause, params) {
  const orcamentosRes = await pool.query(
    `SELECT o.*,
            TO_CHAR(o.data_servico, 'YYYY-MM-DD') AS data_servico_fmt,
            TO_CHAR(o.horario_servico, 'HH24:MI') AS horario_servico_fmt,
            c.nome AS cliente_nome,
            c.whatsapp AS cliente_whatsapp,
            p.nome AS prestador_nome,
            p.telefone AS prestador_telefone,
            p.cargo_tag AS prestador_cargo_tag,
            po.nome AS prestador_origem_nome,
            po.telefone AS prestador_origem_telefone
     FROM orcamentos o
     INNER JOIN clientes c ON c.id = o.cliente_id
     INNER JOIN usuarios p ON p.id = o.prestador_id
     LEFT JOIN usuarios po ON po.id = o.prestador_origem_id
     ${whereClause}
     ORDER BY o.criado_em DESC`,
    params
  );

  const orcamentos = orcamentosRes.rows;
  if (orcamentos.length === 0) return [];

  const ids = orcamentos.map((o) => o.id);

  const [enderecosRes, itensRes] = await Promise.all([
    pool.query(
      `SELECT * FROM orcamento_enderecos WHERE orcamento_id = ANY($1) ORDER BY id ASC`,
      [ids]
    ),
    pool.query(
      `SELECT * FROM orcamento_itens WHERE orcamento_id = ANY($1) ORDER BY id ASC`,
      [ids]
    ),
  ]);

  const enderecosMap = {};
  for (const end of enderecosRes.rows) {
    if (!enderecosMap[end.orcamento_id]) enderecosMap[end.orcamento_id] = [];
    enderecosMap[end.orcamento_id].push(end);
  }

  const itensMap = {};
  for (const item of itensRes.rows) {
    if (!itensMap[item.orcamento_id]) itensMap[item.orcamento_id] = [];
    itensMap[item.orcamento_id].push(item);
  }

  return orcamentos.map((o) => ({
    ...o,
    data_servico: o.data_servico_fmt,
    horario_servico: o.horario_servico_fmt,
    enderecos: enderecosMap[o.id] || [],
    itens: itensMap[o.id] || [],
  }));
}

// POST /api/orcamentos (público — criação pelo cliente ou manual pela equipe)
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      cliente_nome,
      cliente_whatsapp,
      prestador_id,
      data_servico,
      horario_servico,
      precisa_ajudante,
      qtd_ajudantes,
      precisa_caixas,
      qtd_caixas,
      observacao_geral,
      enderecos,
      itens,
      valor_orcado,
    } = req.body || {};

    const nomeLimpo = String(cliente_nome || '').trim();
    const whatsappLimpo = normalizarWhatsapp(cliente_whatsapp);

    if (!nomeLimpo || whatsappLimpo.length < 10) {
      return res.status(400).json({ erro: 'Informe seu nome e um WhatsApp válido com DDD.' });
    }

    if (!prestador_id) {
      return res.status(400).json({ erro: 'Selecione um prestador de serviço.' });
    }

    if (!Array.isArray(enderecos) || enderecos.length < 2) {
      return res.status(400).json({ erro: 'Informe os endereços de retirada e entrega.' });
    }

    // Verifica se o prestador existe e é perfil prestador
    const prestadorRes = await client.query(
      `SELECT id, nome, telefone, cargo_tag FROM usuarios WHERE id = $1 AND perfil = 'prestador' AND ativo = TRUE`,
      [Number(prestador_id)]
    );

    if (prestadorRes.rowCount === 0) {
      return res.status(400).json({ erro: 'Prestador selecionado é inválido.' });
    }

    const prestador = prestadorRes.rows[0];

    await client.query('BEGIN');

    // Busca cliente pelo whatsapp ou cria um novo
    let clienteId;
    const clienteExistente = await client.query(
      `SELECT id FROM clientes WHERE whatsapp = $1 LIMIT 1`,
      [whatsappLimpo]
    );

    if (clienteExistente.rowCount > 0) {
      clienteId = clienteExistente.rows[0].id;
      await client.query(
        `UPDATE clientes SET nome = $1, atualizado_em = NOW() WHERE id = $2`,
        [nomeLimpo, clienteId]
      );
    } else {
      const novoCliente = await client.query(
        `INSERT INTO clientes (nome, whatsapp) VALUES ($1, $2) RETURNING id`,
        [nomeLimpo, whatsappLimpo]
      );
      clienteId = novoCliente.rows[0].id;
    }

    const precisaAjud = Boolean(precisa_ajudante);
    const qtdAjud = precisaAjud ? Math.max(1, Number(qtd_ajudantes || 1)) : 0;
    const precisaCx = Boolean(precisa_caixas);
    const qtdCx = precisaCx ? Math.max(1, Number(qtd_caixas || 1)) : 0;

    const orcamentoRes = await client.query(
      `INSERT INTO orcamentos (
        cliente_id, prestador_id, status_repasse, data_servico, horario_servico,
        precisa_ajudante, qtd_ajudantes, precisa_caixas, qtd_caixas,
        observacao_geral, status, valor_orcado
      ) VALUES ($1, $2, 'nenhum', $3, $4, $5, $6, $7, $8, $9, 'em_aberto', $10)
      RETURNING id`,
      [
        clienteId,
        prestador.id,
        data_servico || null,
        horario_servico || null,
        precisaAjud,
        qtdAjud,
        precisaCx,
        qtdCx,
        observacao_geral ? String(observacao_geral).trim() : null,
        valor_orcado ? Number(valor_orcado) : null,
      ]
    );

    const orcamentoId = orcamentoRes.rows[0].id;

    // Insere endereços (retirada e entrega)
    for (const end of enderecos) {
      const tipo = end.tipo === 'entrega' ? 'entrega' : 'retirada';
      const tipoImovel = end.tipo_imovel === 'apartamento' ? 'apartamento' : 'casa';
      const obsEnd = end.observacoes ? String(end.observacoes).trim().slice(0, 100) : null;

      await client.query(
        `INSERT INTO orcamento_enderecos (
          orcamento_id, tipo, endereco_completo, tipo_imovel,
          tem_elevador, cabe_elevador, andares_escada, observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orcamentoId,
          tipo,
          String(end.endereco_completo || '').trim(),
          tipoImovel,
          tipoImovel === 'apartamento' ? Boolean(end.tem_elevador) : false,
          tipoImovel === 'apartamento' ? Boolean(end.cabe_elevador) : false,
          tipoImovel === 'apartamento' ? Math.max(0, Number(end.andares_escada || 0)) : 0,
          obsEnd,
        ]
      );
    }

    // Insere itens selecionados
    if (Array.isArray(itens)) {
      for (const item of itens) {
        const nomeItem = String(item.nome_item || '').trim().slice(0, 100);
        if (!nomeItem) continue;
        const qtd = Math.max(1, Number(item.quantidade || 1));
        const obsItem = item.observacao_item ? String(item.observacao_item).trim().slice(0, 50) : null;

        await client.query(
          `INSERT INTO orcamento_itens (orcamento_id, nome_item, quantidade, observacao_item)
           VALUES ($1, $2, $3, $4)`,
          [orcamentoId, nomeItem, qtd, obsItem]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id: orcamentoId,
      cliente_nome: nomeLimpo,
      prestador,
      mensagem: 'Orçamento criado com sucesso!',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ORCAMENTOS] Erro ao criar:', err);
    return res.status(500).json({ erro: 'Erro ao salvar orçamento. Tente novamente.' });
  } finally {
    client.release();
  }
});

// GET /api/orcamentos (autenticado)
router.get('/', authenticateToken, async (req, res) => {
  try {
    await encerrarServicosExpirados24h();

    const { status, prestador_id } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.perfil === 'admin') {
      if (prestador_id && prestador_id !== 'todos') {
        params.push(Number(prestador_id));
        conditions.push(`o.prestador_id = $${params.length}`);
      }
    } else {
      params.push(req.user.id);
      conditions.push(
        `(o.prestador_id = $${params.length} OR (o.prestador_origem_id = $${params.length} AND o.status_repasse = 'pendente_aceite'))`
      );
    }

    if (status && status !== 'todos') {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orcamentos = await buscarOrcamentosCompletos(whereClause, params);

    return res.json({ orcamentos });
  } catch (err) {
    console.error('[ORCAMENTOS] Erro ao listar:', err);
    return res.status(500).json({ erro: 'Erro ao listar orçamentos.' });
  }
});

// GET /api/orcamentos/conflitos (autenticado)
// Verifica se já existem orçamentos 'fechado' para o prestador na data informada
router.get('/conflitos', authenticateToken, async (req, res) => {
  try {
    const { data_servico, prestador_id, exclude_id } = req.query;

    if (!data_servico) {
      return res.json({ conflitos: [] });
    }

    const targetPrestador = prestador_id ? Number(prestador_id) : req.user.id;
    const exclude = exclude_id ? Number(exclude_id) : 0;

    const result = await pool.query(
      `SELECT o.id,
              TO_CHAR(o.data_servico, 'YYYY-MM-DD') AS data_servico,
              TO_CHAR(o.horario_servico, 'HH24:MI') AS horario_servico,
              c.nome AS cliente_nome,
              p.nome AS prestador_nome
       FROM orcamentos o
       INNER JOIN clientes c ON c.id = o.cliente_id
       INNER JOIN usuarios p ON p.id = o.prestador_id
       WHERE o.status = 'fechado'
         AND o.prestador_id = $1
         AND o.data_servico = $2::date
         AND o.id <> $3
       ORDER BY o.horario_servico ASC`,
      [targetPrestador, data_servico, exclude]
    );

    return res.json({ conflitos: result.rows });
  } catch (err) {
    console.error('[ORCAMENTOS] Erro ao verificar conflitos:', err);
    return res.status(500).json({ erro: 'Erro ao verificar conflitos de agenda.' });
  }
});

// PATCH /api/orcamentos/:id/status (autenticado)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, data_servico, horario_servico, valor_orcado, motivo_cancelamento } = req.body || {};

    const validos = ['em_aberto', 'cancelado', 'fechado', 'encerrado'];
    if (!validos.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido.' });
    }

    const atualRes = await pool.query(`SELECT * FROM orcamentos WHERE id = $1`, [id]);
    if (atualRes.rowCount === 0) {
      return res.status(404).json({ erro: 'Orçamento não encontrado.' });
    }
    const atual = atualRes.rows[0];

    if (req.user.perfil !== 'admin' && atual.prestador_id !== req.user.id) {
      return res.status(403).json({ erro: 'Sem permissão para alterar este orçamento.' });
    }

    if (status === 'fechado' && (!data_servico || !horario_servico)) {
      return res.status(400).json({ erro: 'Para fechar o serviço, confirme a data e o horário.' });
    }

    const result = await pool.query(
      `UPDATE orcamentos
       SET status = $1,
           data_servico = COALESCE($2, data_servico),
           horario_servico = COALESCE($3, horario_servico),
           valor_orcado = COALESCE($4, valor_orcado),
           motivo_cancelamento = COALESCE($5, motivo_cancelamento),
           atualizado_em = NOW()
       WHERE id = $6
       RETURNING id, status`,
      [
        status,
        data_servico || null,
        horario_servico || null,
        valor_orcado !== undefined && valor_orcado !== '' && valor_orcado !== null ? Number(valor_orcado) : null,
        motivo_cancelamento ? String(motivo_cancelamento).trim() : null,
        id,
      ]
    );

    return res.json({ orcamento: result.rows[0] });
  } catch (err) {
    console.error('[ORCAMENTOS] Erro ao atualizar status:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar status do orçamento.' });
  }
});

// PATCH /api/orcamentos/:id/reagendar (autenticado)
router.patch('/:id/reagendar', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { data_servico, horario_servico } = req.body || {};

    if (!data_servico || !horario_servico) {
      return res.status(400).json({ erro: 'Informe a nova data e o novo horário.' });
    }

    const atualRes = await pool.query(`SELECT * FROM orcamentos WHERE id = $1`, [id]);
    if (atualRes.rowCount === 0) {
      return res.status(404).json({ erro: 'Orçamento não encontrado.' });
    }
    const atual = atualRes.rows[0];

    if (req.user.perfil !== 'admin' && atual.prestador_id !== req.user.id) {
      return res.status(403).json({ erro: 'Sem permissão para remarcar este orçamento.' });
    }

    if (atual.status !== 'fechado') {
      return res.status(400).json({ erro: 'Apenas orçamentos fechados podem ser remarcados.' });
    }

    await pool.query(
      `UPDATE orcamentos
       SET data_servico = $1,
           horario_servico = $2,
           atualizado_em = NOW()
       WHERE id = $3`,
      [data_servico, horario_servico, id]
    );

    return res.json({ mensagem: 'Serviço remarcado com sucesso!' });
  } catch (err) {
    console.error('[ORCAMENTOS] Erro ao remarcar:', err);
    return res.status(500).json({ erro: 'Erro ao remarcar serviço.' });
  }
});

// POST /api/orcamentos/:id/repassar (autenticado)
router.post('/:id/repassar', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { novo_prestador_id } = req.body || {};

    if (!novo_prestador_id) {
      return res.status(400).json({ erro: 'Selecione o prestador de destino.' });
    }

    const atualRes = await pool.query(`SELECT * FROM orcamentos WHERE id = $1`, [id]);
    if (atualRes.rowCount === 0) {
      return res.status(404).json({ erro: 'Orçamento não encontrado.' });
    }
    const atual = atualRes.rows[0];

    if (req.user.perfil !== 'admin' && atual.prestador_id !== req.user.id) {
      return res.status(403).json({ erro: 'Sem permissão para repassar este orçamento.' });
    }

    if (Number(novo_prestador_id) === atual.prestador_id) {
      return res.status(400).json({ erro: 'O orçamento já pertence a este prestador.' });
    }

    const destRes = await pool.query(
      `SELECT id, nome, telefone FROM usuarios WHERE id = $1 AND perfil = 'prestador' AND ativo = TRUE`,
      [Number(novo_prestador_id)]
    );

    if (destRes.rowCount === 0) {
      return res.status(404).json({ erro: 'Prestador de destino não encontrado.' });
    }

    await pool.query(
      `UPDATE orcamentos
       SET prestador_origem_id = $1,
           prestador_id = $2,
           status_repasse = 'pendente_aceite',
           atualizado_em = NOW()
       WHERE id = $3`,
      [atual.prestador_id, Number(novo_prestador_id), id]
    );

    return res.json({
      mensagem: 'Orçamento repassado! Aguardando aceite.',
      prestador_destino: destRes.rows[0],
    });
  } catch (err) {
    console.error('[ORCAMENTOS] Erro ao repassar:', err);
    return res.status(500).json({ erro: 'Erro ao repassar orçamento.' });
  }
});

// POST /api/orcamentos/:id/responder-repasse (autenticado)
router.post('/:id/responder-repasse', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { acao, fechar_agora, data_servico, horario_servico, valor_orcado } = req.body || {};

    if (!['aceitar', 'recusar'].includes(acao)) {
      return res.status(400).json({ erro: 'Ação inválida.' });
    }

    const atualRes = await pool.query(`SELECT * FROM orcamentos WHERE id = $1`, [id]);
    if (atualRes.rowCount === 0) {
      return res.status(404).json({ erro: 'Orçamento não encontrado.' });
    }
    const atual = atualRes.rows[0];

    if (req.user.perfil !== 'admin' && atual.prestador_id !== req.user.id) {
      return res.status(403).json({ erro: 'Apenas o prestador destinatário pode responder ao repasse.' });
    }

    if (acao === 'recusar') {
      const origemId = atual.prestador_origem_id || atual.prestador_id;
      await pool.query(
        `UPDATE orcamentos
         SET prestador_id = $1,
             prestador_origem_id = NULL,
             status_repasse = 'recusado',
             atualizado_em = NOW()
         WHERE id = $2`,
        [origemId, id]
      );
      return res.json({ mensagem: 'Repasse recusado. O orçamento voltou para o prestador de origem.' });
    }

    // Aceitar
    if (fechar_agora && (!data_servico || !horario_servico)) {
      return res.status(400).json({ erro: 'Para aceitar e já fechar o serviço, confirme a data e o horário.' });
    }

    await pool.query(
      `UPDATE orcamentos
       SET status_repasse = 'aceito',
           status = CASE WHEN $1 THEN 'fechado' ELSE status END,
           data_servico = COALESCE($2, data_servico),
           horario_servico = COALESCE($3, horario_servico),
           valor_orcado = COALESCE($4, valor_orcado),
           atualizado_em = NOW()
       WHERE id = $5`,
      [
        Boolean(fechar_agora),
        data_servico || null,
        horario_servico || null,
        valor_orcado !== undefined && valor_orcado !== '' && valor_orcado !== null ? Number(valor_orcado) : null,
        id,
      ]
    );

    return res.json({
      mensagem: fechar_agora ? 'Repasse aceito e serviço fechado!' : 'Repasse aceito com sucesso!',
    });
  } catch (err) {
    console.error('[ORCAMENTOS] Erro ao responder repasse:', err);
    return res.status(500).json({ erro: 'Erro ao responder repasse.' });
  }
});

module.exports = router;
