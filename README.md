# Piratinha Transporte — Sistema de Orçamento de Fretes e Mudanças

Sistema web **Mobile First** desenvolvido para a **Piratinha Transporte**, com formulário de orçamento para clientes (com integração direta ao WhatsApp), painel completo da equipe (prestadores e administrador master), agenda com alerta universal de conflito de horários, repasse de orçamentos entre prestadores, central de chamados e limpeza automática de dados antigos.

- **Repositório Oficial:** `https://github.com/BatistaMT16/piratinha-transporte.git`

---

## Estrutura do Projeto

- `/frontend`: Interface estática Mobile First em HTML, CSS e JavaScript puro (pronta para Vercel e também servida localmente via Docker).
- `/backend`: API REST em Node.js + Express + PostgreSQL (`init.sql` com tabelas, índices e seed inicial).
- `/scripts`: Scripts `.bat` de automação com um clique para Windows.
- `/backups`: Pasta onde os backups `.sql` são salvos pelo script `backup-banco.bat`.
- `docker-compose.yml`: Orquestração dos containers (`db`, `backend`, `frontend`) com volume nomeado `piratinha_pgdata`.

---

## Pré-requisitos no Windows

1. **Docker Desktop** instalado e em execução.
2. **Git for Windows** instalado (para versionamento no GitHub).

---

## Como Executar Localmente (Windows)

### Opção 1: Com 1 clique via script `.bat`
Dê um duplo clique em:
- `scripts/iniciar-docker.bat`

### Opção 2: Via terminal (PowerShell ou CMD)
```powershell
docker compose up -d --build
```

### URLs de Acesso Local
- **Formulário do Cliente:** `http://localhost:8080`
- **Painel da Equipe:** `http://localhost:8080/equipe.html`
- **Healthcheck da API:** `http://localhost:3000/api/health`

---

## Acessos Iniciais da Equipe

> O login aceita usuário independente de maiúsculas ou minúsculas.

| Perfil | Nome | Usuário | Senha |
| :--- | :--- | :--- | :--- |
| Administrador Master | Matheus Silva | `matheus.silva` | `142536` |
| Prestador (Fundador) | EDILSON CARLOS | `EDILSON` | `080871` |
| Prestador | CARLOS BATISTA | `CARLOS` | `080871` |
| Prestador | HELIONAY HADONAY | `HELIONAY` | `080871` |
| Prestador | LAURILENE ANJOS | `LAURILENE` | `080871` |

---

## Backup e Restauração do Banco de Dados

### Gerar Backup
Dê um duplo clique em `scripts/backup-banco.bat`. O arquivo será salvo automaticamente em `/backups/backup_piratinha_AAAA-MM-DD_HH-MM-SS.sql`.

### Restaurar Backup no Docker Desktop (PowerShell)
Com o container `piratinha_db` rodando:
```powershell
Get-Content .\backups\SEU_ARQUIVO_DE_BACKUP.sql | docker exec -i piratinha_db psql -U piratinha -d piratinha_db
```

---

## Como Enviar Alterações para o GitHub

Dê um duplo clique em `scripts/salvar-github.bat`, digite uma breve descrição da alteração e pressione **Enter**.

---

## Deploy do Frontend na Vercel

1. Acesse [vercel.com](https://vercel.com) e importe o repositório `https://github.com/BatistaMT16/piratinha-transporte.git`.
2. Nas configurações do projeto na Vercel, defina **Root Directory** como `frontend`.
3. Em `frontend/js/config.js`, substitua `'https://SUA-API-AQUI.com/api'` pela URL pública onde você hospedar o `/backend` (ex: Railway, Render ou VPS).
4. Clique em **Deploy**.
