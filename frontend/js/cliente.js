(function () {
  const ITENS_PADRAO = [
    'Geladeira',
    'Fogão',
    'Máquina de Lavar',
    'Micro-ondas',
    'Cama de Casal',
    'Cama de Solteiro',
    'Guarda-roupa',
    'Sofá',
    'Rack / Painel',
    'TV',
    'Mesa com Cadeiras',
    'Armário de Cozinha',
    'Cômoda',
    'Ventilador / Ar-condicionado',
    'Mesa de Escritório',
    'Freezer',
    'Tanquinho',
    'Berço',
  ];

  const state = {
    prestadores: [],
    prestadorSelecionado: null,
    enderecos: {
      ret: { tipo_imovel: 'casa', tem_elevador: false, cabe_elevador: true },
      ent: { tipo_imovel: 'casa', tem_elevador: false, cabe_elevador: true },
    },
    precisa_ajudante: false,
    qtd_ajudantes: 1,
    precisa_caixas: false,
    qtd_caixas: 5,
    itens: ITENS_PADRAO.map((nome, idx) => ({
      id: idx,
      nome_item: nome,
      selecionado: false,
      quantidade: 1,
      observacao_item: '',
    })),
    extras: [],
    extraQtd: 1,
  };

  // Carregar prestadores da API
  async function carregarPrestadores() {
    const container = document.getElementById('prestadores-container');
    try {
      const resp = await fetch(`${window.API_BASE_URL}/prestadores`);
      const data = await resp.json();
      state.prestadores = data.prestadores || [];

      if (state.prestadores.length === 0) {
        container.innerHTML = '<p class="alert alert-warning">Nenhum prestador disponível no momento.</p>';
        return;
      }

      container.innerHTML = '';
      state.prestadores.forEach((p, index) => {
        const label = document.createElement('label');
        label.className = 'prestador-option' + (index === 0 ? ' selected' : '');
        if (index === 0) state.prestadorSelecionado = p;

        const tagHtml = p.cargo_tag
          ? `<span class="tag-fundador">${escapeHtml(p.cargo_tag)}</span>`
          : '';

        label.innerHTML = `
          <span class="prestador-radio">
            <input type="radio" name="prestador_id" value="${p.id}" ${index === 0 ? 'checked' : ''} />
            <span>${escapeHtml(p.nome)}</span>
          </span>
          ${tagHtml}
        `;

        label.querySelector('input').addEventListener('change', () => {
          state.prestadorSelecionado = p;
          document.querySelectorAll('.prestador-option').forEach((el) => el.classList.remove('selected'));
          label.classList.add('selected');
        });

        container.appendChild(label);
      });
    } catch (err) {
      container.innerHTML =
        '<p class="alert alert-danger">Não foi possível carregar os prestadores. Verifique se o servidor está rodando.</p>';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Contadores de caracteres
  function bindCounter(inputId, counterId, max) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    input.addEventListener('input', () => {
      if (input.value.length > max) {
        input.value = input.value.slice(0, max);
      }
      counter.textContent = `${input.value.length}/${max}`;
    });
  }

  bindCounter('ret_obs', 'ret_obs_count', 100);
  bindCounter('ent_obs', 'ent_obs_count', 100);
  bindCounter('extra-obs', 'extra-obs-count', 50);

  // Toggles de Imóvel / Elevador (Retirada e Entrega)
  document.querySelectorAll('[data-imovel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.imovel;
      const val = btn.dataset.val;
      state.enderecos[prefix].tipo_imovel = val;

      document.querySelectorAll(`[data-imovel="${prefix}"]`).forEach((b) => {
        b.classList.remove('active-yes');
      });
      btn.classList.add('active-yes');

      const aptoBox = document.getElementById(`${prefix}-apto-box`);
      if (val === 'apartamento') {
        aptoBox.classList.remove('hidden');
      } else {
        aptoBox.classList.add('hidden');
      }
    });
  });

  document.querySelectorAll('[data-elevador]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.elevador;
      const sim = btn.dataset.val === 'sim';
      state.enderecos[prefix].tem_elevador = sim;

      document.querySelectorAll(`[data-elevador="${prefix}"]`).forEach((b) => {
        b.classList.remove('active-yes', 'active-no');
      });
      btn.classList.add(sim ? 'active-yes' : 'active-no');

      const cabeBox = document.getElementById(`${prefix}-cabe-box`);
      if (sim) {
        cabeBox.classList.remove('hidden');
      } else {
        cabeBox.classList.add('hidden');
      }
    });
  });

  document.querySelectorAll('[data-cabe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.cabe;
      const sim = btn.dataset.val === 'sim';
      state.enderecos[prefix].cabe_elevador = sim;

      document.querySelectorAll(`[data-cabe="${prefix}"]`).forEach((b) => {
        b.classList.remove('active-yes', 'active-no');
      });
      btn.classList.add(sim ? 'active-yes' : 'active-no');
    });
  });

  // Ajudantes
  document.querySelectorAll('[data-ajudante]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sim = btn.dataset.ajudante === 'sim';
      state.precisa_ajudante = sim;
      document.querySelectorAll('[data-ajudante]').forEach((b) => b.classList.remove('active-yes', 'active-no'));
      btn.classList.add(sim ? 'active-yes' : 'active-no');
      document.getElementById('ajudante-qtd-box').classList.toggle('hidden', !sim);
    });
  });

  document.getElementById('ajudante-minus').addEventListener('click', () => {
    if (state.qtd_ajudantes > 1) {
      state.qtd_ajudantes--;
      document.getElementById('ajudante-val').textContent = state.qtd_ajudantes;
    }
  });

  document.getElementById('ajudante-plus').addEventListener('click', () => {
    state.qtd_ajudantes++;
    document.getElementById('ajudante-val').textContent = state.qtd_ajudantes;
  });

  // Caixas
  document.querySelectorAll('[data-caixas]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sim = btn.dataset.caixas === 'sim';
      state.precisa_caixas = sim;
      document.querySelectorAll('[data-caixas]').forEach((b) => b.classList.remove('active-yes', 'active-no'));
      btn.classList.add(sim ? 'active-yes' : 'active-no');
      document.getElementById('caixas-qtd-box').classList.toggle('hidden', !sim);
    });
  });

  document.getElementById('caixas-minus').addEventListener('click', () => {
    if (state.qtd_caixas > 1) {
      state.qtd_caixas--;
      document.getElementById('caixas-val').textContent = state.qtd_caixas;
    }
  });

  document.getElementById('caixas-plus').addEventListener('click', () => {
    state.qtd_caixas++;
    document.getElementById('caixas-val').textContent = state.qtd_caixas;
  });

  // Renderizar Lista de Itens da Casa (todos padrão "Não")
  function renderItens() {
    const container = document.getElementById('itens-lista-container');
    container.innerHTML = '';

    state.itens.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'item-row';

      row.innerHTML = `
        <div class="item-header">
          <span class="item-name">${escapeHtml(item.nome_item)}</span>
          <div class="item-toggle-mini">
            <button type="button" class="btn-sim ${item.selecionado ? 'active-yes' : ''}">Sim</button>
            <button type="button" class="btn-nao ${!item.selecionado ? 'active-no' : ''}">Não</button>
          </div>
        </div>
        <div class="item-details ${item.selecionado ? '' : 'hidden'}">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.9rem; font-weight: 600;">Quantidade:</span>
            <div class="stepper">
              <button type="button" class="stepper-btn btn-qtd-minus">-</button>
              <span class="stepper-val qtd-display">${item.quantidade}</span>
              <button type="button" class="stepper-btn btn-qtd-plus">+</button>
            </div>
          </div>
          <div>
            <input type="text" class="obs-item-input" maxlength="50"
              placeholder="Obs. curta (ex: duplex grande, 3 lugares)"
              value="${escapeHtml(item.observacao_item)}" />
            <div class="char-counter obs-item-counter">${item.observacao_item.length}/50</div>
          </div>
        </div>
      `;

      const btnSim = row.querySelector('.btn-sim');
      const btnNao = row.querySelector('.btn-nao');
      const details = row.querySelector('.item-details');

      btnSim.addEventListener('click', () => {
        item.selecionado = true;
        btnSim.classList.add('active-yes');
        btnNao.classList.remove('active-no');
        details.classList.remove('hidden');
      });

      btnNao.addEventListener('click', () => {
        item.selecionado = false;
        btnNao.classList.add('active-no');
        btnSim.classList.remove('active-yes');
        details.classList.add('hidden');
      });

      row.querySelector('.btn-qtd-minus').addEventListener('click', () => {
        if (item.quantidade > 1) {
          item.quantidade--;
          row.querySelector('.qtd-display').textContent = item.quantidade;
        }
      });

      row.querySelector('.btn-qtd-plus').addEventListener('click', () => {
        item.quantidade++;
        row.querySelector('.qtd-display').textContent = item.quantidade;
      });

      const obsInput = row.querySelector('.obs-item-input');
      const obsCounter = row.querySelector('.obs-item-counter');
      obsInput.addEventListener('input', () => {
        if (obsInput.value.length > 50) {
          obsInput.value = obsInput.value.slice(0, 50);
        }
        item.observacao_item = obsInput.value;
        obsCounter.textContent = `${obsInput.value.length}/50`;
      });

      container.appendChild(row);
    });
  }

  // Itens Extras
  document.getElementById('extra-minus').addEventListener('click', () => {
    if (state.extraQtd > 1) {
      state.extraQtd--;
      document.getElementById('extra-val').textContent = state.extraQtd;
    }
  });

  document.getElementById('extra-plus').addEventListener('click', () => {
    state.extraQtd++;
    document.getElementById('extra-val').textContent = state.extraQtd;
  });

  function renderExtras() {
    const container = document.getElementById('extras-adicionados');
    container.innerHTML = '';

    state.extras.forEach((ext, idx) => {
      const div = document.createElement('div');
      div.className = 'item-row';
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.alignItems = 'center';
      div.innerHTML = `
        <div>
          <strong>${ext.quantidade}x ${escapeHtml(ext.nome_item)}</strong>
          ${ext.observacao_item ? `<div class="label-hint">${escapeHtml(ext.observacao_item)}</div>` : ''}
        </div>
        <button type="button" class="btn btn-danger btn-sm">Remover</button>
      `;
      div.querySelector('button').addEventListener('click', () => {
        state.extras.splice(idx, 1);
        renderExtras();
      });
      container.appendChild(div);
    });
  }

  document.getElementById('btn-add-extra').addEventListener('click', () => {
    const nomeInput = document.getElementById('extra-nome');
    const obsInput = document.getElementById('extra-obs');
    const nome = nomeInput.value.trim();

    if (!nome) {
      alert('Digite o nome do item extra.');
      return;
    }

    state.extras.push({
      nome_item: nome,
      quantidade: state.extraQtd,
      observacao_item: obsInput.value.trim().slice(0, 50),
    });

    nomeInput.value = '';
    obsInput.value = '';
    state.extraQtd = 1;
    document.getElementById('extra-val').textContent = '1';
    document.getElementById('extra-obs-count').textContent = '0/50';
    renderExtras();
  });

  // Envio do Formulário
  document.getElementById('form-orcamento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroBox = document.getElementById('form-erro');
    erroBox.classList.add('hidden');

    const clienteNome = document.getElementById('cliente_nome').value.trim();
    const clienteWhatsapp = document.getElementById('cliente_whatsapp').value.trim();
    const retEndereco = document.getElementById('ret_endereco').value.trim();
    const entEndereco = document.getElementById('ent_endereco').value.trim();

    if (!clienteNome || clienteWhatsapp.replace(/\D/g, '').length < 10) {
      erroBox.textContent = 'Por favor, informe seu nome e um WhatsApp válido com DDD.';
      erroBox.classList.remove('hidden');
      erroBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!state.prestadorSelecionado) {
      erroBox.textContent = 'Selecione um prestador de serviço.';
      erroBox.classList.remove('hidden');
      return;
    }

    if (!retEndereco || !entEndereco) {
      erroBox.textContent = 'Preencha os endereços completos de retirada e entrega.';
      erroBox.classList.remove('hidden');
      erroBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const itensSelecionados = [
      ...state.itens
        .filter((i) => i.selecionado)
        .map((i) => ({
          nome_item: i.nome_item,
          quantidade: i.quantidade,
          observacao_item: i.observacao_item.trim().slice(0, 50),
        })),
      ...state.extras,
    ];

    const payload = {
      cliente_nome: clienteNome,
      cliente_whatsapp: clienteWhatsapp,
      prestador_id: state.prestadorSelecionado.id,
      data_servico: document.getElementById('data_servico').value || null,
      horario_servico: document.getElementById('horario_servico').value || null,
      precisa_ajudante: state.precisa_ajudante,
      qtd_ajudantes: state.precisa_ajudante ? state.qtd_ajudantes : 0,
      precisa_caixas: state.precisa_caixas,
      qtd_caixas: state.precisa_caixas ? state.qtd_caixas : 0,
      observacao_geral: document.getElementById('observacao_geral').value.trim(),
      enderecos: [
        {
          tipo: 'retirada',
          endereco_completo: retEndereco,
          tipo_imovel: state.enderecos.ret.tipo_imovel,
          tem_elevador: state.enderecos.ret.tem_elevador,
          cabe_elevador: state.enderecos.ret.cabe_elevador,
          andares_escada: Number(document.getElementById('ret_escada').value || 0),
          observacoes: document.getElementById('ret_obs').value.trim().slice(0, 100),
        },
        {
          tipo: 'entrega',
          endereco_completo: entEndereco,
          tipo_imovel: state.enderecos.ent.tipo_imovel,
          tem_elevador: state.enderecos.ent.tem_elevador,
          cabe_elevador: state.enderecos.ent.cabe_elevador,
          andares_escada: Number(document.getElementById('ent_escada').value || 0),
          observacoes: document.getElementById('ent_obs').value.trim().slice(0, 100),
        },
      ],
      itens: itensSelecionados,
    };

    const btnEnviar = document.getElementById('btn-enviar');
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando orçamento...';

    try {
      const resp = await fetch(`${window.API_BASE_URL}/orcamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.erro || 'Erro ao enviar orçamento.');
      }

      const orcamentoId = data.id;
      const telefonePrestador = String(data.prestador?.telefone || '').replace(/\D/g, '');
      const msg = `Olá, me chamo ${clienteNome}, criei o orçamento de número #${orcamentoId}, estou no aguardo do contato.`;
      const waUrl = `https://wa.me/${telefonePrestador}?text=${encodeURIComponent(msg)}`;

      document.getElementById('modal-orcamento-id').textContent = `#${orcamentoId}`;
      document.getElementById('btn-ir-whatsapp').href = waUrl;
      document.getElementById('modal-sucesso').classList.remove('hidden');

      setTimeout(() => {
        window.location.href = waUrl;
      }, 2000);
    } catch (err) {
      erroBox.textContent = err.message;
      erroBox.classList.remove('hidden');
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Solicitar Orçamento';
    }
  });

  carregarPrestadores();
  renderItens();
})();
