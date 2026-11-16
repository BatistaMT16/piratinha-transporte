(function () {
  const state = {
    token: localStorage.getItem('piratinha_token') || null,
    usuario: null,
    prestadores: [],
    orcamentos: [],
    chamados: [],
    filtroStatus: 'todos',
    filtroPrestador: 'todos',
    modalAgendaCtx: null, // { mode: 'fechar' | 'remarcar' | 'aceitar_fechar', orcamento }
    modalRepasseId: null,
    modalCancelarId: null,
    calAno: new Date().getFullYear(),
    calMes: new Date().getMonth(), // 0-11
    calDiaSelecionado: null,
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function formatarDataBR(iso) {
    if (!iso) return 'A definir';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function formatarStatusLabel(st) {
    const map = {
      em_aberto: 'Em Aberto',
      fechado: 'Fechado',
      encerrado: 'Encerrado',
      cancelado: 'Cancelado',
      aberto: 'Aberto',
      em_analise: 'Em Análise',
      em_desenvolvimento: 'Em Desenvolvimento',
      finalizado: 'Finalizado',
    };
    return map[st] || st;
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const resp = await fetch(`${window.API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (resp.status === 401 || resp.status === 403) {
      if (path !== '/auth/login') {
        fazerLogout();
      }
    }

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.erro || 'Erro na requisição.');
    }
    return data;
  }

  function fazerLogout() {
    state.token = null;
    state.usuario = null;
    localStorage.removeItem('piratinha_token');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('painel-section').classList.add('hidden');
    document.getElementById('btn-sair').classList.add('hidden');
    document.getElementById('header-user-info').textContent = 'Painel da Equipe';
  }

  document.getElementById('btn-sair').addEventListener('click', fazerLogout);

  // Login
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroBox = document.getElementById('login-erro');
    erroBox.classList.add('hidden');

    const usuario = document.getElementById('login-usuario').value.trim();
    const senha = document.getElementById('login-senha').value;

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usuario, senha }),
      });

      state.token = data.token;
      state.usuario = data.usuario;
      localStorage.setItem('piratinha_token', data.token);
      await iniciarPainel();
    } catch (err) {
      erroBox.textContent = err.message;
      erroBox.classList.remove('hidden');
    }
  });

  async function verificarSessao() {
    if (!state.token) return;
    try {
      const data = await apiFetch('/auth/me');
      state.usuario = data.usuario;
      await iniciarPainel();
    } catch (err) {
      fazerLogout();
    }
  }

  async function iniciarPainel() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('painel-section').classList.remove('hidden');
    document.getElementById('btn-sair').classList.remove('hidden');

    const u = state.usuario;
    document.getElementById('header-user-info').textContent = `${u.nome} (${u.perfil === 'admin' ? 'Admin' : 'Prestador'})`;
    document.getElementById('perfil-nome').textContent = u.nome;
    document.getElementById('perfil-info').textContent = `Usuário: ${u.usuario} | Perfil: ${u.perfil}`;
    document.getElementById('perfil-whatsapp').value = u.telefone || '';

    // Carrega prestadores para filtros e repasses
    const pData = await apiFetch('/prestadores');
    state.prestadores = pData.prestadores || [];

    if (u.perfil === 'admin') {
      document.getElementById('admin-filtro-prestador').classList.remove('hidden');
      document.getElementById('chamados-titulo-lista').textContent = 'Todos os Chamados (Visão Admin)';
      const sel = document.getElementById('select-filtro-prestador');
      sel.innerHTML = '<option value="todos">Todos os Prestadores</option>';
      state.prestadores.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nome;
        sel.appendChild(opt);
      });
    } else {
      document.getElementById('admin-filtro-prestador').classList.add('hidden');
      document.getElementById('chamados-titulo-lista').textContent = 'Meus Chamados';
    }

    await carregarOrcamentos();
    await carregarChamados();
  }

  // Navegação por Abas
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.dataset.tab;
      ['orcamentos', 'agenda', 'chamados', 'perfil'].forEach((t) => {
        document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
      });

      if (tab === 'agenda') {
        renderAgenda();
      }
    });
  });

  // Filtros de Orçamentos
  document.getElementById('select-filtro-prestador').addEventListener('change', (e) => {
    state.filtroPrestador = e.target.value;
    carregarOrcamentos();
  });

  document.querySelectorAll('#status-filtros .pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#status-filtros .pill-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.filtroStatus = btn.dataset.status;
      carregarOrcamentos();
    });
  });

  async function carregarOrcamentos() {
    const params = new URLSearchParams();
    if (state.filtroStatus !== 'todos') params.set('status', state.filtroStatus);
    if (state.usuario?.perfil === 'admin' && state.filtroPrestador !== 'todos') {
      params.set('prestador_id', state.filtroPrestador);
    }

    const data = await apiFetch(`/orcamentos?${params.toString()}`);
    state.orcamentos = data.orcamentos || [];
    renderOrcamentos();
    renderAgenda();
  }

  function renderEnderecoHtml(end, titulo) {
    if (!end) return '';
    let detalhes = `Imóvel: ${end.tipo_imovel === 'apartamento' ? 'Apartamento' : 'Casa'}`;
    if (end.tipo_imovel === 'apartamento') {
      detalhes += ` | Elevador: ${end.tem_elevador ? 'Sim' : 'Não'}`;
      if (end.tem_elevador) {
        detalhes += ` (Cabe tudo: ${end.cabe_elevador ? 'Sim' : 'Não'})`;
      }
      detalhes += ` | Escadas: ${end.andares_escada || 0} andar(es)`;
    }
    return `
      <div style="margin-top: 8px; padding: 8px 10px; background: var(--bg); border-radius: 8px; font-size: 0.88rem;">
        <strong>${titulo}:</strong> ${escapeHtml(end.endereco_completo)}<br />
        <span class="label-hint">${detalhes}</span>
        ${end.observacoes ? `<br /><span class="label-hint">Obs: ${escapeHtml(end.observacoes)}</span>` : ''}
      </div>
    `;
  }

  function montarLinkWhatsappCliente(o) {
    const tel = String(o.cliente_whatsapp || '').replace(/\D/g, '');
    const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
    const valorTxt = o.valor_orcado ? ` Valor estimado: R$ ${Number(o.valor_orcado).toFixed(2)}.` : '';
    const msg = `Olá ${o.cliente_nome}, aqui é da *Piratinha Transporte* sobre o seu orçamento #${o.id}.${valorTxt} Como podemos prosseguir?`;
    return `https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`;
  }

  function renderOrcamentos() {
    const container = document.getElementById('orcamentos-lista');
    if (state.orcamentos.length === 0) {
      container.innerHTML = '<div class="card"><p class="label-hint">Nenhum orçamento encontrado para este filtro.</p></div>';
      return;
    }

    container.innerHTML = '';
    state.orcamentos.forEach((o) => {
      const card = document.createElement('div');
      card.className = 'card';

      const ret = o.enderecos.find((e) => e.tipo === 'retirada');
      const ent = o.enderecos.find((e) => e.tipo === 'entrega');

      const itensHtml =
        o.itens.length > 0
          ? o.itens
              .map(
                (it) =>
                  `<li>${it.quantidade}x ${escapeHtml(it.nome_item)}${
                    it.observacao_item ? ` <span class="label-hint">(${escapeHtml(it.observacao_item)})</span>` : ''
                  }</li>`
              )
              .join('')
          : '<li class="label-hint">Nenhum item específico marcado</li>';

      const isPendenteParaMim =
        o.status_repasse === 'pendente_aceite' &&
        (state.usuario.perfil === 'admin' || o.prestador_id === state.usuario.id);

      const isPendenteEnviadoPorMim =
        o.status_repasse === 'pendente_aceite' && o.prestador_origem_id === state.usuario.id;

      let repasseBanner = '';
      if (isPendenteParaMim) {
        repasseBanner = `
          <div class="alert alert-info" style="margin-top: 8px;">
            Repassado por <strong>${escapeHtml(o.prestador_origem_nome || 'Colega')}</strong>. Deseja aceitar este orçamento?
            <div class="action-grid" style="margin-top: 8px;">
              <button type="button" class="btn btn-success btn-sm btn-aceitar-fechar">Aceitar e Fechar</button>
              <button type="button" class="btn btn-navy btn-sm btn-aceitar-aberto">Aceitar (Em Aberto)</button>
              <button type="button" class="btn btn-danger btn-sm btn-recusar-repasse">Recusar</button>
            </div>
          </div>
        `;
      } else if (isPendenteEnviadoPorMim) {
        repasseBanner = `
          <div class="alert alert-warning" style="margin-top: 8px;">
            Aguardando aceite do repasse por <strong>${escapeHtml(o.prestador_nome)}</strong>.
          </div>
        `;
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
          <div>
            <strong style="font-size: 1.08rem; color: var(--primary);">Orçamento #${o.id}</strong>
            <div class="label-hint">Prestador: <strong>${escapeHtml(o.prestador_nome)}</strong></div>
          </div>
          <span class="badge badge-${o.status}">${formatarStatusLabel(o.status)}</span>
        </div>

        ${repasseBanner}

        <div style="margin-top: 10px; font-size: 0.94rem;">
          <strong>Cliente:</strong> ${escapeHtml(o.cliente_nome)}<br />
          <strong>WhatsApp:</strong> ${escapeHtml(o.cliente_whatsapp)}<br />
          <strong>Data/Hora:</strong> ${formatarDataBR(o.data_servico)} ${o.horario_servico ? `às ${o.horario_servico}` : ''}<br />
          <strong>Ajudante:</strong> ${o.precisa_ajudante ? `Sim (${o.qtd_ajudantes})` : 'Não'} |
          <strong>Caixas:</strong> ${o.precisa_caixas ? `Sim (${o.qtd_caixas})` : 'Não'}
          ${o.valor_orcado ? `<br /><strong>Valor Orçado:</strong> R$ ${Number(o.valor_orcado).toFixed(2)}` : ''}
          ${o.motivo_cancelamento ? `<br /><strong>Motivo Cancelamento:</strong> ${escapeHtml(o.motivo_cancelamento)}` : ''}
        </div>

        ${renderEnderecoHtml(ret, 'Retirada')}
        ${renderEnderecoHtml(ent, 'Entrega')}

        <div style="margin-top: 10px;">
          <strong style="font-size: 0.9rem;">Itens (${o.itens.length}):</strong>
          <ul style="padding-left: 18px; margin-top: 4px; font-size: 0.88rem;">${itensHtml}</ul>
        </div>

        ${
          o.observacao_geral
            ? `<div class="sub-box" style="font-size: 0.88rem;"><strong>Obs. Geral de Acesso:</strong> ${escapeHtml(o.observacao_geral)}</div>`
            : ''
        }

        <div class="action-grid">
          <a href="${montarLinkWhatsappCliente(o)}" target="_blank" class="btn btn-success btn-sm">
            WhatsApp Cliente
          </a>
          ${
            o.status === 'em_aberto'
              ? `<button type="button" class="btn btn-primary btn-sm btn-fechar">Fechar Serviço</button>`
              : ''
          }
          ${
            o.status === 'fechado'
              ? `<button type="button" class="btn btn-navy btn-sm btn-remarcar">Remarcar Data/Hora</button>
                 <button type="button" class="btn btn-outline btn-sm btn-encerrar">Encerrar Serviço</button>`
              : ''
          }
          ${
            o.status === 'em_aberto' || o.status === 'fechado'
              ? `<button type="button" class="btn btn-outline btn-sm btn-repassar">Repassar Colega</button>
                 <button type="button" class="btn btn-danger btn-sm btn-cancelar">Cancelar</button>`
              : ''
          }
        </div>
      `;

      // Bind ações
      const btnFechar = card.querySelector('.btn-fechar');
      if (btnFechar) btnFechar.addEventListener('click', () => abrirModalAgenda('fechar', o));

      const btnRemarcar = card.querySelector('.btn-remarcar');
      if (btnRemarcar) btnRemarcar.addEventListener('click', () => abrirModalAgenda('remarcar', o));

      const btnEncerrar = card.querySelector('.btn-encerrar');
      if (btnEncerrar) {
        btnEncerrar.addEventListener('click', async () => {
          if (!confirm(`Confirmar encerramento do serviço #${o.id}?`)) return;
          await apiFetch(`/orcamentos/${o.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'encerrado' }),
          });
          await carregarOrcamentos();
        });
      }

      const btnRepassar = card.querySelector('.btn-repassar');
      if (btnRepassar) btnRepassar.addEventListener('click', () => abrirModalRepasse(o));

      const btnCancelar = card.querySelector('.btn-cancelar');
      if (btnCancelar) btnCancelar.addEventListener('click', () => abrirModalCancelar(o));

      const btnAceitarFechar = card.querySelector('.btn-aceitar-fechar');
      if (btnAceitarFechar) btnAceitarFechar.addEventListener('click', () => abrirModalAgenda('aceitar_fechar', o));

      const btnAceitarAberto = card.querySelector('.btn-aceitar-aberto');
      if (btnAceitarAberto) {
        btnAceitarAberto.addEventListener('click', async () => {
          await apiFetch(`/orcamentos/${o.id}/responder-repasse`, {
            method: 'POST',
            body: JSON.stringify({ acao: 'aceitar', fechar_agora: false }),
          });
          await carregarOrcamentos();
        });
      }

      const btnRecusar = card.querySelector('.btn-recusar-repasse');
      if (btnRecusar) {
        btnRecusar.addEventListener('click', async () => {
          await apiFetch(`/orcamentos/${o.id}/responder-repasse`, {
            method: 'POST',
            body: JSON.stringify({ acao: 'recusar' }),
          });
          await carregarOrcamentos();
        });
      }

      container.appendChild(card);
    });
  }

  // =========================================================
  // MODAL AGENDA + VERIFICAÇÃO UNIVERSAL DE CONFLITO DE AGENDA
  // =========================================================
  async function verificarConflitosAgenda(dataServico, prestadorId, excludeId) {
    const alerta = document.getElementById('modal-conflito-alerta');
    alerta.classList.add('hidden');
    if (!dataServico) return;

    try {
      const res = await apiFetch(
        `/orcamentos/conflitos?data_servico=${encodeURIComponent(dataServico)}&prestador_id=${prestadorId}&exclude_id=${excludeId}`
      );
      const conflitos = res.conflitos || [];
      if (conflitos.length > 0) {
        const lista = conflitos
          .map(
            (c) =>
              `<li>Orçamento <strong>#${c.id}</strong> — Cliente: <strong>${escapeHtml(c.cliente_nome)}</strong> (${formatarDataBR(
                c.data_servico
              )} às <strong>${c.horario_servico || 'sem horário'}</strong>)</li>`
          )
          .join('');
        alerta.innerHTML = `
          <strong>Atenção — Conflito de Agenda!</strong><br />
          Já existe(m) serviço(s) <strong>Fechado(s)</strong> nesta data:
          <ul style="padding-left: 18px; margin-top: 6px;">${lista}</ul>
        `;
        alerta.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Erro ao checar conflitos:', err);
    }
  }

  function abrirModalAgenda(mode, orcamento) {
    state.modalAgendaCtx = { mode, orcamento };
    const titulo = document.getElementById('modal-agenda-titulo');
    const valorGroup = document.getElementById('agenda-valor-group');

    if (mode === 'remarcar') {
      titulo.textContent = `Remarcar Serviço #${orcamento.id}`;
      valorGroup.classList.add('hidden');
    } else if (mode === 'aceitar_fechar') {
      titulo.textContent = `Aceitar e Fechar #${orcamento.id}`;
      valorGroup.classList.remove('hidden');
    } else {
      titulo.textContent = `Fechar Serviço #${orcamento.id}`;
      valorGroup.classList.remove('hidden');
    }

    const dataInput = document.getElementById('agenda-data');
    const horaInput = document.getElementById('agenda-horario');
    const valorInput = document.getElementById('agenda-valor');

    dataInput.value = orcamento.data_servico || new Date().toISOString().slice(0, 10);
    horaInput.value = orcamento.horario_servico || '09:00';
    valorInput.value = orcamento.valor_orcado || '';

    document.getElementById('modal-agenda').classList.remove('hidden');
    verificarConflitosAgenda(dataInput.value, orcamento.prestador_id, orcamento.id);
  }

  document.getElementById('agenda-data').addEventListener('change', (e) => {
    if (!state.modalAgendaCtx) return;
    const { orcamento } = state.modalAgendaCtx;
    verificarConflitosAgenda(e.target.value, orcamento.prestador_id, orcamento.id);
  });

  document.getElementById('btn-fechar-modal-agenda').addEventListener('click', () => {
    document.getElementById('modal-agenda').classList.add('hidden');
    state.modalAgendaCtx = null;
  });

  document.getElementById('form-modal-agenda').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.modalAgendaCtx) return;

    const { mode, orcamento } = state.modalAgendaCtx;
    const data_servico = document.getElementById('agenda-data').value;
    const horario_servico = document.getElementById('agenda-horario').value;
    const valor_orcado = document.getElementById('agenda-valor').value;

    if (mode === 'remarcar') {
      await apiFetch(`/orcamentos/${orcamento.id}/reagendar`, {
        method: 'PATCH',
        body: JSON.stringify({ data_servico, horario_servico }),
      });
    } else if (mode === 'aceitar_fechar') {
      await apiFetch(`/orcamentos/${orcamento.id}/responder-repasse`, {
        method: 'POST',
        body: JSON.stringify({
          acao: 'aceitar',
          fechar_agora: true,
          data_servico,
          horario_servico,
          valor_orcado: valor_orcado || null,
        }),
      });
    } else {
      await apiFetch(`/orcamentos/${orcamento.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'fechado',
          data_servico,
          horario_servico,
          valor_orcado: valor_orcado || null,
        }),
      });
    }

    document.getElementById('modal-agenda').classList.add('hidden');
    state.modalAgendaCtx = null;
    await carregarOrcamentos();
  });

  // =========================================================
  // MODAL REPASSAR ORÇAMENTO
  // =========================================================
  function abrirModalRepasse(orcamento) {
    state.modalRepasseId = orcamento.id;
    const select = document.getElementById('repasse-prestador');
    select.innerHTML = '';

    state.prestadores
      .filter((p) => p.id !== orcamento.prestador_id)
      .forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nome;
        opt.dataset.telefone = p.telefone || '';
        select.appendChild(opt);
      });

    document.getElementById('repasse-wa-box').classList.add('hidden');
    document.getElementById('modal-repasse').classList.remove('hidden');
  }

  document.getElementById('btn-fechar-modal-repasse').addEventListener('click', () => {
    document.getElementById('modal-repasse').classList.add('hidden');
  });

  document.getElementById('btn-confirmar-repasse').addEventListener('click', async () => {
    const select = document.getElementById('repasse-prestador');
    const novoId = select.value;
    if (!novoId) return;

    const res = await apiFetch(`/orcamentos/${state.modalRepasseId}/repassar`, {
      method: 'POST',
      body: JSON.stringify({ novo_prestador_id: Number(novoId) }),
    });

    const destTel = String(res.prestador_destino?.telefone || '').replace(/\D/g, '');
    const msg = `Olá ${res.prestador_destino?.nome || ''}, acabei de te repassar o orçamento #${state.modalRepasseId} no painel da Piratinha Transporte. Dá uma olhada lá para aceitar!`;
    const waLink = document.getElementById('repasse-wa-link');
    waLink.href = `https://wa.me/${destTel}?text=${encodeURIComponent(msg)}`;
    document.getElementById('repasse-wa-box').classList.remove('hidden');

    await carregarOrcamentos();
  });

  // =========================================================
  // MODAL CANCELAR ORÇAMENTO
  // =========================================================
  function abrirModalCancelar(orcamento) {
    state.modalCancelarId = orcamento.id;
    document.getElementById('cancelar-motivo').value = '';
    document.getElementById('modal-cancelar').classList.remove('hidden');
  }

  document.getElementById('btn-fechar-modal-cancelar').addEventListener('click', () => {
    document.getElementById('modal-cancelar').classList.add('hidden');
  });

  document.getElementById('btn-confirmar-cancelar').addEventListener('click', async () => {
    const motivo = document.getElementById('cancelar-motivo').value.trim();
    await apiFetch(`/orcamentos/${state.modalCancelarId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelado', motivo_cancelamento: motivo }),
    });
    document.getElementById('modal-cancelar').classList.add('hidden');
    await carregarOrcamentos();
  });

  // =========================================================
  // AGENDA / CALENDÁRIO DE SERVIÇOS FECHADOS
  // =========================================================
  const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  document.getElementById('cal-prev').addEventListener('click', () => {
    state.calMes--;
    if (state.calMes < 0) {
      state.calMes = 11;
      state.calAno--;
    }
    state.calDiaSelecionado = null;
    renderAgenda();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    state.calMes++;
    if (state.calMes > 11) {
      state.calMes = 0;
      state.calAno++;
    }
    state.calDiaSelecionado = null;
    renderAgenda();
  });

  function renderAgenda() {
    const fechados = state.orcamentos
      .filter((o) => o.status === 'fechado' && o.data_servico)
      .sort((a, b) => {
        const dtA = `${a.data_servico} ${a.horario_servico || '00:00'}`;
        const dtB = `${b.data_servico} ${b.horario_servico || '00:00'}`;
        return dtA.localeCompare(dtB);
      });

    document.getElementById('cal-mes-titulo').textContent = `${MESES[state.calMes]} ${state.calAno}`;

    const diasContainer = document.getElementById('calendar-days');
    diasContainer.innerHTML = '';

    const primeiroDiaSemana = new Date(state.calAno, state.calMes, 1).getDay();
    const totalDiasMes = new Date(state.calAno, state.calMes + 1, 0).getDate();

    for (let i = 0; i < primeiroDiaSemana; i++) {
      const empty = document.createElement('div');
      diasContainer.appendChild(empty);
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const mm = String(state.calMes + 1).padStart(2, '0');
      const dd = String(dia).padStart(2, '0');
      const iso = `${state.calAno}-${mm}-${dd}`;
      const temEvento = fechados.some((o) => o.data_servico === iso);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-day';
      if (temEvento) cell.classList.add('has-event');
      if (state.calDiaSelecionado === iso) cell.classList.add('selected-day');

      cell.innerHTML = `<span>${dia}</span>${temEvento ? '<span class="calendar-dot"></span>' : ''}`;
      cell.addEventListener('click', () => {
        state.calDiaSelecionado = state.calDiaSelecionado === iso ? null : iso;
        renderAgenda();
      });

      diasContainer.appendChild(cell);
    }

    const listaFiltrada = state.calDiaSelecionado
      ? fechados.filter((o) => o.data_servico === state.calDiaSelecionado)
      : fechados;

    document.getElementById('agenda-lista-titulo').textContent = state.calDiaSelecionado
      ? `Serviços Fechados em ${formatarDataBR(state.calDiaSelecionado)}`
      : 'Serviços Fechados (Ordem Cronológica)';

    const listaEl = document.getElementById('agenda-lista');
    if (listaFiltrada.length === 0) {
      listaEl.innerHTML = '<p class="label-hint">Nenhum serviço fechado para exibir.</p>';
      return;
    }

    listaEl.innerHTML = '';
    listaFiltrada.forEach((o) => {
      const div = document.createElement('div');
      div.className = 'item-row';
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>#${o.id} — ${formatarDataBR(o.data_servico)} às ${o.horario_servico || '--:--'}</strong>
          <span class="badge badge-fechado">Fechado</span>
        </div>
        <div style="margin-top: 6px; font-size: 0.9rem;">
          <strong>Cliente:</strong> ${escapeHtml(o.cliente_nome)} (${escapeHtml(o.cliente_whatsapp)})<br />
          <strong>Prestador:</strong> ${escapeHtml(o.prestador_nome)}
          ${o.valor_orcado ? ` | <strong>Valor:</strong> R$ ${Number(o.valor_orcado).toFixed(2)}` : ''}
        </div>
      `;
      listaEl.appendChild(div);
    });
  }

  // =========================================================
  // CENTRAL DE AJUDA / CHAMADOS
  // =========================================================
  document.getElementById('form-chamado').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = document.getElementById('chamado-tipo').value;
    const titulo = document.getElementById('chamado-titulo').value.trim();
    const descricao = document.getElementById('chamado-descricao').value.trim();

    await apiFetch('/chamados', {
      method: 'POST',
      body: JSON.stringify({ tipo, titulo, descricao }),
    });

    document.getElementById('chamado-titulo').value = '';
    document.getElementById('chamado-descricao').value = '';
    await carregarChamados();
  });

  async function carregarChamados() {
    const data = await apiFetch('/chamados');
    state.chamados = data.chamados || [];
    renderChamados();
  }

  function renderChamados() {
    const container = document.getElementById('chamados-lista');
    if (state.chamados.length === 0) {
      container.innerHTML = '<p class="label-hint">Nenhum chamado registrado.</p>';
      return;
    }

    container.innerHTML = '';
    const isAdmin = state.usuario?.perfil === 'admin';

    state.chamados.forEach((ch) => {
      const div = document.createElement('div');
      div.className = 'item-row';

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <strong>#${ch.id} — ${escapeHtml(ch.titulo)}</strong>
            <div class="label-hint">Tipo: ${escapeHtml(ch.tipo.toUpperCase())} | Aberto por: ${escapeHtml(ch.autor_nome)}</div>
          </div>
          <span class="badge badge-${ch.status}">${formatarStatusLabel(ch.status)}</span>
        </div>
        <p style="margin-top: 8px; font-size: 0.92rem;">${escapeHtml(ch.descricao)}</p>
        ${
          ch.resposta_admin
            ? `<div class="sub-box" style="font-size: 0.88rem;"><strong>Resposta Admin:</strong> ${escapeHtml(ch.resposta_admin)}</div>`
            : ''
        }
        ${
          isAdmin
            ? `
          <div class="sub-box">
            <div class="form-group">
              <label>Alterar Status</label>
              <select class="ch-status-select">
                <option value="aberto" ${ch.status === 'aberto' ? 'selected' : ''}>Aberto</option>
                <option value="em_analise" ${ch.status === 'em_analise' ? 'selected' : ''}>Em Análise</option>
                <option value="em_desenvolvimento" ${ch.status === 'em_desenvolvimento' ? 'selected' : ''}>Em Desenvolvimento</option>
                <option value="finalizado" ${ch.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
              </select>
            </div>
            <div class="form-group">
              <label>Resposta do Administrador</label>
              <textarea class="ch-resposta-input" placeholder="Escreva um retorno para o prestador...">${escapeHtml(
                ch.resposta_admin || ''
              )}</textarea>
            </div>
            <button type="button" class="btn btn-navy btn-sm btn-block btn-salvar-chamado">Salvar Atualização</button>
          </div>
        `
            : ''
        }
      `;

      if (isAdmin) {
        div.querySelector('.btn-salvar-chamado').addEventListener('click', async () => {
          const status = div.querySelector('.ch-status-select').value;
          const resposta_admin = div.querySelector('.ch-resposta-input').value;
          await apiFetch(`/chamados/${ch.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, resposta_admin }),
          });
          await carregarChamados();
        });
      }

      container.appendChild(div);
    });
  }

  // =========================================================
  // ATUALIZAR WHATSAPP DO PRESTADOR
  // =========================================================
  document.getElementById('form-whatsapp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgBox = document.getElementById('whatsapp-msg');
    msgBox.classList.add('hidden');
    const telefone = document.getElementById('perfil-whatsapp').value.trim();

    try {
      const res = await apiFetch('/prestadores/meu-whatsapp', {
        method: 'PATCH',
        body: JSON.stringify({ telefone }),
      });
      state.usuario = res.usuario;
      msgBox.className = 'alert alert-info';
      msgBox.textContent = 'WhatsApp atualizado com sucesso!';
      msgBox.classList.remove('hidden');
    } catch (err) {
      msgBox.className = 'alert alert-danger';
      msgBox.textContent = err.message;
      msgBox.classList.remove('hidden');
    }
  });

  verificarSessao();
})();
