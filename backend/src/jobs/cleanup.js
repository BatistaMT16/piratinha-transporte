const pool = require('../db');

/**
 * Etapa 1: Exclui orçamentos em_aberto ou cancelado com mais de 30 dias (CASCADE remove endereços e itens).
 * Etapa 2: Logo após a Etapa 1, exclui clientes órfãos sem nenhum orçamento vinculado.
 */
async function executarLimpezaDiaria() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Etapa 1 — Limpeza de Orçamentos Antigos (> 30 dias em aberto ou cancelados)
    const resOrcamentos = await client.query(`
      DELETE FROM orcamentos
      WHERE status IN ('em_aberto', 'cancelado')
        AND criado_em < NOW() - INTERVAL '30 days'
      RETURNING id
    `);

    // Etapa 2 — Varredura de Clientes Órfãos (executada estritamente após Etapa 1)
    const resClientes = await client.query(`
      DELETE FROM clientes
      WHERE NOT EXISTS (
        SELECT 1 FROM orcamentos WHERE orcamentos.cliente_id = clientes.id
      )
      RETURNING id
    `);

    await client.query('COMMIT');

    console.log(
      `[LIMPEZA DIÁRIA] Orçamentos removidos: ${resOrcamentos.rowCount} | Clientes órfãos removidos: ${resClientes.rowCount}`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[LIMPEZA DIÁRIA] Erro ao executar limpeza:', err);
  } finally {
    client.release();
  }
}

/**
 * Encerra automaticamente orçamentos 'fechado' após 24 horas da data e horário do serviço.
 */
async function encerrarServicosExpirados24h() {
  try {
    const result = await pool.query(`
      UPDATE orcamentos
      SET status = 'encerrado',
          atualizado_em = NOW()
      WHERE status = 'fechado'
        AND data_servico IS NOT NULL
        AND (data_servico + COALESCE(horario_servico, '00:00:00'::time)) < ((NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '24 hours')
      RETURNING id
    `);

    if (result.rowCount > 0) {
      console.log(`[AUTO-ENCERRAMENTO 24H] ${result.rowCount} serviço(s) encerrado(s) automaticamente.`);
    }
  } catch (err) {
    console.error('[AUTO-ENCERRAMENTO 24H] Erro ao atualizar serviços expirados:', err);
  }
}

function iniciarRotinasAgendadas() {
  // Executa imediatamente ao iniciar o servidor
  executarLimpezaDiaria();
  encerrarServicosExpirados24h();

  // Limpeza diária a cada 24 horas
  const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    executarLimpezaDiaria();
  }, VINTE_QUATRO_HORAS_MS);

  // Verificação de encerramento 24h a cada 30 minutos
  const TRINTA_MINUTOS_MS = 30 * 60 * 1000;
  setInterval(() => {
    encerrarServicosExpirados24h();
  }, TRINTA_MINUTOS_MS);
}

module.exports = {
  executarLimpezaDiaria,
  encerrarServicosExpirados24h,
  iniciarRotinasAgendadas,
};
