-- Inicialização do Banco de Dados - Piratinha Transporte
-- Executado automaticamente na criação do container PostgreSQL

SET TIME ZONE 'America/Sao_Paulo';

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    usuario VARCHAR(60) UNIQUE NOT NULL,
    senha VARCHAR(120) NOT NULL,
    telefone VARCHAR(30),
    cargo_tag VARCHAR(50),
    perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('admin', 'prestador')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    whatsapp VARCHAR(30) UNIQUE NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamentos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    prestador_id INTEGER NOT NULL REFERENCES usuarios(id),
    prestador_origem_id INTEGER REFERENCES usuarios(id),
    status_repasse VARCHAR(30) NOT NULL DEFAULT 'nenhum' CHECK (status_repasse IN ('nenhum', 'pendente_aceite', 'aceito', 'recusado')),
    data_servico DATE,
    horario_servico TIME,
    precisa_ajudante BOOLEAN NOT NULL DEFAULT FALSE,
    qtd_ajudantes INTEGER NOT NULL DEFAULT 0,
    precisa_caixas BOOLEAN NOT NULL DEFAULT FALSE,
    qtd_caixas INTEGER NOT NULL DEFAULT 0,
    observacao_geral TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'em_aberto' CHECK (status IN ('em_aberto', 'cancelado', 'fechado', 'encerrado')),
    valor_orcado NUMERIC(10, 2),
    motivo_cancelamento TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamento_enderecos (
    id SERIAL PRIMARY KEY,
    orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('retirada', 'entrega')),
    endereco_completo TEXT NOT NULL,
    tipo_imovel VARCHAR(20) NOT NULL CHECK (tipo_imovel IN ('casa', 'apartamento')),
    tem_elevador BOOLEAN NOT NULL DEFAULT FALSE,
    cabe_elevador BOOLEAN NOT NULL DEFAULT FALSE,
    andares_escada INTEGER NOT NULL DEFAULT 0,
    observacoes VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
    id SERIAL PRIMARY KEY,
    orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
    nome_item VARCHAR(100) NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    observacao_item VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS chamados_suporte (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('bug', 'melhoria', 'duvida')),
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'em_desenvolvimento', 'finalizado')),
    resposta_admin TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices úteis para performance
CREATE INDEX IF NOT EXISTS idx_orcamentos_prestador ON orcamentos(prestador_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_data ON orcamentos(data_servico);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_chamados_usuario ON chamados_suporte(usuario_id);

-- População inicial de Usuários (Admin Master + 4 Prestadores)
INSERT INTO usuarios (nome, usuario, senha, telefone, cargo_tag, perfil, ativo)
VALUES
    ('Matheus Silva', 'matheus.silva', '142536', NULL, 'Administrador', 'admin', TRUE),
    ('EDILSON CARLOS', 'EDILSON', '080871', '5521971495757', 'Fundador', 'prestador', TRUE),
    ('CARLOS BATISTA', 'CARLOS', '080871', '5521982269014', NULL, 'prestador', TRUE),
    ('HELIONAY HADONAY', 'HELIONAY', '080871', '5521970130139', NULL, 'prestador', TRUE),
    ('LAURILENE ANJOS', 'LAURILENE', '080871', '5521999282299', NULL, 'prestador', TRUE)
ON CONFLICT (usuario) DO NOTHING;
