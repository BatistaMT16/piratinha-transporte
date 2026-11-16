const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { iniciarRotinasAgendadas } = require('./jobs/cleanup');

const authRoutes = require('./routes/auth');
const prestadoresRoutes = require('./routes/prestadores');
const orcamentosRoutes = require('./routes/orcamentos');
const chamadosRoutes = require('./routes/chamados');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Healthcheck
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', empresa: 'Piratinha Transporte' });
  } catch (err) {
    return res.status(500).json({ status: 'error', erro: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/prestadores', prestadoresRoutes);
app.use('/api/orcamentos', orcamentosRoutes);
app.use('/api/chamados', chamadosRoutes);

app.listen(PORT, () => {
  console.log(`[Piratinha Transporte API] Rodando na porta ${PORT}`);
  // Aguarda brevemente para garantir que o Postgres esteja pronto antes da rotina inicial
  setTimeout(() => {
    iniciarRotinasAgendadas();
  }, 3000);
});
