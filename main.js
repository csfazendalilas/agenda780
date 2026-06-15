// ============================================
// CONFIGURAÇÕES
// ============================================
// Web App da planilha 780 (deploy via clasp).
const API_URL = 'https://script.google.com/macros/s/AKfycbxE6yRTJCa_dI7OmirMoKCN-sKgVeiO-5y8-ojKVcVoPqppHt8IV_4GhfS86eZ9n_1R/exec';
let WHATSAPP_DESTINO = '5548920039171'; // sobrescrito por _config.whatsapp (getConfig)

/**
 * Adapta a resposta do backend novo (slot_id) para o formato que este front já usa.
 * Novo getSlots: { ok, data: { slots: [{ slot_id, date, time, weekday, professional_type }] } }
 * Formato interno: { slot_id, data, hora, diaSemana, origem } (origem F=médico, O=enfermeira).
 */
function extrairSlots(json) {
  const lista = (json && json.data && json.data.slots)
    ? json.data.slots
    : (Array.isArray(json) ? json : []);
  return lista.map(function (s) {
    return {
      slot_id: s.slot_id,
      data: s.date || s.data,
      hora: s.time || s.hora,
      diaSemana: s.weekday || s.diaSemana || '',
      origem: (s.professional_type === 'enfermagem') ? 'O' : 'F'
    };
  });
}

// ============================================
// CONFIG DINÂMICA (_config / _services via getConfig)
// ============================================
async function carregarConfig() {
  try {
    const resp = await fetch(API_URL + '?action=getConfig', { method: 'GET', mode: 'cors', cache: 'no-cache' });
    if (!resp.ok) return;
    const json = await resp.json();
    if (json && json.ok && json.data) {
      aplicarConfig(json.data.config || {}, json.data.services || []);
    }
  } catch (e) {
    // Sem rede / backend: mantém os textos estáticos do HTML (defaults sensatos).
  }
}

// Aplica os valores de _config nos elementos da home (só sobrescreve o que vier preenchido).
function aplicarConfig(config, services) {
  const teamName = config.team_name || 'Equipe';
  const teamCode = config.team_code != null ? String(config.team_code) : '';
  const titulo = teamName + (teamCode && teamName.indexOf(teamCode) < 0 ? ' - ' + teamCode : '');

  setText('cfg-team-name', titulo);
  setText('cfg-unit-name', config.unit_name);
  setText('cfg-addr-title', config.unit_name);
  setText('cfg-footer', '© 2026 ' + titulo + (config.unit_name ? '. ' + config.unit_name : '') + '.');

  if (config.whatsapp) WHATSAPP_DESTINO = String(config.whatsapp).replace(/\D/g, '');

  // Avisos
  showOrHideText('cfg-alert-default', 'cfg-intro-alert', config.intro_alert);
  setText('cfg-urgencia', config.urgencia_text);

  // Alô Saúde
  applyBlock('cfg-alo-card', !!(config.alo_saude_phone || config.alo_saude_tel), function () {
    if (config.alo_saude_tel) setAttr('cfg-alo-card', 'href', 'tel:' + String(config.alo_saude_tel).replace(/\D/g, ''));
    setText('cfg-alo-title', config.alo_saude_label);
    setText('cfg-alo-desc', config.alo_saude_desc);
    setText('cfg-alo-phone', config.alo_saude_phone);
  });

  // Fila de espera
  setHrefOrHide('cfg-fila-municipal', config.fila_municipal_url);
  setHrefOrHide('cfg-fila-estadual', config.fila_estadual_url);

  // Odontologia
  applyBlock('cfg-odonto-card', !!config.odonto_whatsapp, function () {
    setAttr('cfg-odonto-card', 'href', 'https://wa.me/' + String(config.odonto_whatsapp).replace(/\D/g, ''));
    setText('cfg-odonto-text', config.odonto_text);
    setText('cfg-odonto-num', config.odonto_whatsapp_label);
  });

  // Endereço / mapa
  if (config.address) {
    const html = String(config.address).split(/\\n|\r?\n/).map(escapeHtml).join('<br>');
    const el = document.getElementById('cfg-addr-text');
    if (el) el.innerHTML = html;
  }
  setHrefOrHide('cfg-maps', config.maps_url);

  aplicarServices(services);
}

// Mostra/esconde os botões de serviço conforme _services (a lista só traz os habilitados).
function aplicarServices(services) {
  if (!services || !services.length) return; // sem dados: mantém o estático

  ['prenatal', 'puericultura', 'preventivo'].forEach(function (id) {
    const b = document.querySelector('[data-tipo="' + id + '"]');
    if (b) b.style.display = 'none';
  });
  const renov = document.getElementById('cfg-card-renovacao');
  if (renov) renov.style.display = 'none';
  let temGeral = false;

  services.forEach(function (svc) {
    if (!svc.enabled) return;
    const id = svc.service_id;
    if (id === 'prenatal' || id === 'puericultura' || id === 'preventivo') {
      const b = document.querySelector('[data-tipo="' + id + '"]');
      if (b) {
        b.style.display = '';
        const strong = b.querySelector('.featured-btn-content strong');
        const span = b.querySelector('.featured-btn-content span');
        if (strong && svc.label) strong.textContent = svc.label;
        if (span && svc.description) span.textContent = svc.description;
      }
    } else if (id === 'renovacao') {
      if (renov) renov.style.display = '';
    } else if (id === 'medico' || id === 'enfermagem') {
      temGeral = true;
    }
  });

  const outras = document.getElementById('cfg-card-outras');
  if (outras) outras.style.display = temGeral ? '' : 'none';
}

// Helpers de injeção (não sobrescrevem com vazio).
function setText(id, t) { const e = document.getElementById(id); if (e && t != null && t !== '') e.textContent = t; }
function setAttr(id, a, v) { const e = document.getElementById(id); if (e) e.setAttribute(a, v); }
function applyBlock(cardId, visible, fill) {
  const c = document.getElementById(cardId); if (!c) return;
  if (!visible) { c.style.display = 'none'; return; }
  if (fill) fill();
}
function showOrHideText(cardId, textId, t) {
  if (t == null || t === '') { const c = document.getElementById(cardId); if (c) c.style.display = 'none'; return; }
  setText(textId, t);
}
function setHrefOrHide(id, url) {
  const e = document.getElementById(id); if (!e) return;
  if (url) e.setAttribute('href', url); else e.style.display = 'none';
}
// Estado global
let slotsGlobais = [];        // todos os slots livres (médico + enfermagem) — buscados fresco a cada uso
let slotsExibidos = [];       // os que aparecem no select (após filtro de fluxo)
let currentStep = 1;

// Fluxo de triagem ativo (pré-natal / puericultura / preventivo) ou null para "Outras consultas".
// { tipo: 'prenatal'|'puericultura'|'preventivo', professional: 'F'|'O', triagem: {...} }
let fluxoTriagem = null;

// ============================================
// VALIDAÇÃO INICIAL
// ============================================
(function () {
  console.log('🔧 API_URL configurada:', API_URL);
  if (!API_URL || API_URL.includes('SEU_ID_AQUI') || !API_URL.includes('script.google.com')) {
    console.error('❌ ERRO: API_URL não configurada corretamente!', API_URL);
    alert('ERRO: URL do Google Apps Script não configurada. Verifique o código.');
  }
})();

// ============================================
// PROGRESS STEPS
// ============================================
function updateProgressSteps(step) {
  currentStep = step;
  const steps = document.querySelectorAll('.step');
  const lines = document.querySelectorAll('.step-line');

  steps.forEach((stepEl, index) => {
    const stepNum = index + 1;
    stepEl.classList.remove('active', 'completed');
    
    if (stepNum < step) {
      stepEl.classList.add('completed');
    } else if (stepNum === step) {
      stepEl.classList.add('active');
    }
  });

  lines.forEach((line, index) => {
    line.classList.remove('completed');
    if (index < step - 1) {
      line.classList.add('completed');
    }
  });
}

// ============================================
// NAVEGAÇÃO ENTRE TELAS
// ============================================
function esconderTodosCards() {
  ['intro-card', 'agendamento-card', 'card-prenatal', 'card-puericultura', 'card-preventivo']
    .forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
}

function mostrarFormulario(scrollIntoView = false) {
  esconderTodosCards();

  const agendamentoCard = document.getElementById('agendamento-card');
  if (agendamentoCard) {
    agendamentoCard.classList.remove('hidden');
    if (scrollIntoView) {
      setTimeout(() => {
        agendamentoCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }

  // Carregar horários ao mostrar o formulário
  carregarHorarios();
}

function voltarParaIntro() {
  fluxoTriagem = null;
  esconderTodosCards();
  const introCard = document.getElementById('intro-card');
  if (introCard) introCard.classList.remove('hidden');

  // Restaura o formulário de agendamento para um próximo uso.
  const formFields = document.getElementById('form-fields');
  if (formFields) formFields.style.display = '';
  const waDiv = document.getElementById('whatsapp-container');
  if (waDiv) waDiv.style.display = 'none';
  const msgDiv = document.getElementById('mensagem');
  if (msgDiv) msgDiv.style.display = 'none';
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('btn-loading'); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// CARREGAMENTO DE HORÁRIOS (EM BACKGROUND)
// ============================================

/**
 * Converte data no formato DD/MM/YYYY para objeto Date
 */
function parseDataBR(dataStr) {
  const partes = dataStr.split('/');
  if (partes.length !== 3) return new Date(0);
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1; // Mês começa em 0
  const ano = parseInt(partes[2], 10);
  return new Date(ano, mes, dia);
}

/**
 * Converte hora no formato HH:MM para minutos (para ordenação)
 */
function parseHora(horaStr) {
  const partes = horaStr.split(':');
  if (partes.length !== 2) return 0;
  return parseInt(partes[0], 10) * 60 + parseInt(partes[1], 10);
}

/**
 * Ordena os slots por data e hora crescente
 */
function ordenarSlots(slots) {
  return slots.sort((a, b) => {
    const dataA = parseDataBR(a.data);
    const dataB = parseDataBR(b.data);
    
    // Primeiro compara por data
    if (dataA.getTime() !== dataB.getTime()) {
      return dataA.getTime() - dataB.getTime();
    }
    
    // Se mesma data, compara por hora
    return parseHora(a.hora) - parseHora(b.hora);
  });
}

/**
 * Exibe os horários na tela (usa dados já carregados se disponíveis)
 */
async function carregarHorarios() {
  const loading = document.getElementById('loading');
  const formContainer = document.getElementById('form-container');
  const select = document.getElementById('slotSelect');

  loading.style.display = 'block';
  formContainer.style.display = 'none';

  try {
    // SEMPRE busca fresco no momento de escolher o horário (depois da triagem / ao abrir
    // "Outras consultas"). Evita lista velha caso alguém tenha agendado durante a triagem.
    if (!API_URL || API_URL.includes('SEU_ID_AQUI')) {
      throw new Error('URL do Google Apps Script não configurada. Verifique a constante API_URL no código.');
    }

    const url = API_URL + '?action=getSlots';
    const resp = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });

    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error('Script não encontrado. Verifique se o Google Apps Script está publicado corretamente.');
      }
      throw new Error('Erro ao carregar horários (HTTP ' + resp.status + ')');
    }

    const json = await resp.json();
    slotsGlobais = ordenarSlots(extrairSlots(json));

    // Filtra pelo profissional do fluxo de triagem (F=médico, O=enfermagem). Sem triagem = todos.
    slotsExibidos = fluxoTriagem
      ? slotsGlobais.filter(function (s) { return s.origem === fluxoTriagem.professional; })
      : slotsGlobais.slice();

    if (!slotsExibidos.length) {
      loading.innerHTML = `
        <div class="loading-card">
          <div class="loading-icon" style="background: #fef3c7; color: #d97706;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="loading-text" style="color: #92400e;">Não há consultas disponíveis no momento, orientamos procurar o Centro de Saúde Fazenda do Rio Tavares às 7h, quando são distribuídas as fichas para atendimento no mesmo dia.</p>
        </div>
      `;
      return;
    }

    select.innerHTML = '<option value="">Escolha um horário</option>';
    slotsExibidos.forEach((slot, index) => {
      const option = document.createElement('option');
      option.value = index;

      const diaSemanaLabel = slot.diaSemana
        ? slot.diaSemana.replace('-feira', '')
        : '';

      const dataComDia = diaSemanaLabel
        ? diaSemanaLabel + ', ' + slot.data
        : slot.data;

      // Define o tipo de profissional baseado na origem (F=médico, O=enfermeira, vazio=médico)
      const origem = (slot.origem || 'F').toUpperCase();
      const tipoProfissional = origem === 'O' ? '(enfermeira)' : '(médico)';

      option.text = dataComDia + ' às ' + slot.hora + ' ' + tipoProfissional;
      select.appendChild(option);
    });

    loading.style.display = 'none';
    formContainer.style.display = 'block';
  } catch (err) {
    console.error(err);
    loading.innerHTML = `
      <div class="loading-card">
        <div class="loading-icon" style="background: #fee2e2; color: #dc2626;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <p class="loading-text" style="color: #991b1b; margin-bottom: 16px;">
          ${err.message || 'Não foi possível carregar os horários'}
        </p>
        <button type="button" class="btn btn-primary" onclick="carregarHorarios()" style="max-width: 200px;">
          Tentar novamente
        </button>
      </div>
    `;
  }
}

// ============================================
// VALIDAÇÕES
// ============================================
function validarTelefone(telefone) {
  const apenasNumeros = telefone.replace(/\D/g, '');
  return apenasNumeros.length >= 10 && apenasNumeros.length <= 11;
}

function validarDataNascimento(data) {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!regex.test(data)) {
    return { valido: false, mensagem: 'Use o formato DD/MM/AAAA' };
  }

  const partes = data.split('/');
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);
  const ano = parseInt(partes[2], 10);

  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900 || ano > new Date().getFullYear()) {
    return { valido: false, mensagem: 'Data inválida. Verifique dia, mês e ano.' };
  }

  return { valido: true };
}

// ============================================
// GERENCIAMENTO DE ERROS
// ============================================
function mostrarErroCampo(campoId, mensagem) {
  const campo = document.getElementById(campoId);
  const errorSpan = document.getElementById(campoId + '-error');

  if (campo) {
    campo.setAttribute('aria-invalid', 'true');
    campo.classList.add('error');
  }

  if (errorSpan) {
    errorSpan.textContent = mensagem;
  }
}

function limparErroCampo(campoId) {
  const campo = document.getElementById(campoId);
  const errorSpan = document.getElementById(campoId + '-error');

  if (campo) {
    campo.removeAttribute('aria-invalid');
    campo.classList.remove('error');
  }

  if (errorSpan) {
    errorSpan.textContent = '';
  }
}

function limparTodosErros() {
  ['slotSelect', 'nome', 'dataNascimento', 'telefone', 'observacoes'].forEach(limparErroCampo);
}

// ============================================
// VALIDAÇÃO DO FORMULÁRIO
// ============================================
function validarFormulario() {
  limparTodosErros();

  const select = document.getElementById('slotSelect');
  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const dataNascimento = document.getElementById('dataNascimento').value.trim();
  const observacoes = document.getElementById('observacoes').value.trim();

  let valido = true;
  let primeiroCampoComErro = null;

  if (!select.value) {
    mostrarErroCampo('slotSelect', 'Selecione um horário');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = select;
  }

  if (!nome || nome.length < 3) {
    mostrarErroCampo('nome', 'Informe seu nome completo');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('nome');
  }

  if (!dataNascimento) {
    mostrarErroCampo('dataNascimento', 'Informe sua data de nascimento');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('dataNascimento');
  } else {
    const validacaoData = validarDataNascimento(dataNascimento);
    if (!validacaoData.valido) {
      mostrarErroCampo('dataNascimento', validacaoData.mensagem);
      valido = false;
      if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('dataNascimento');
    }
  }

  if (!telefone) {
    mostrarErroCampo('telefone', 'Informe seu telefone');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('telefone');
  } else if (!validarTelefone(telefone)) {
    mostrarErroCampo('telefone', 'Telefone inválido');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('telefone');
  }

  if (!observacoes || observacoes.length < 5) {
    mostrarErroCampo('observacoes', 'Descreva o motivo da consulta');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('observacoes');
  }

  if (!valido && primeiroCampoComErro) {
    primeiroCampoComErro.focus();
  }

  return valido;
}

// ============================================
// SANITIZAÇÃO DE HTML
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// CONSTRUÇÃO DO RESUMO
// ============================================
function construirResumoAgendamento(slot, nome, telefone, dataNascimento, observacoes) {
  const diaSemana = slot.diaSemana ? slot.diaSemana.replace('-feira', '') : '';
  const dataFormatada = diaSemana ? `${diaSemana}, ${slot.data}` : slot.data;

  // Define o tipo de profissional baseado na origem (F=médico, O=enfermeira, vazio=médico)
  const origem = (slot.origem || 'F').toUpperCase();
  const tipoProfissional = origem === 'O' ? 'Enfermeira' : 'Médico';
  const iconeProfissional = origem === 'O' ? '👩‍⚕️' : '👨‍⚕️';

  // Escape user-provided data to prevent XSS
  const nomeEscaped = escapeHtml(nome);
  const telefoneEscaped = escapeHtml(telefone);
  const dataNascimentoEscaped = escapeHtml(dataNascimento);
  const observacoesEscaped = escapeHtml(observacoes);

  return `
    <div class="resumo-header">
      <div class="icon-ok" aria-hidden="true">✓</div>
      <div>
        <div class="resumo-titulo">Agendamento realizado!</div>
        <div class="resumo-subtitulo">Confira os dados e confirme no WhatsApp</div>
      </div>
    </div>
    
    <ul class="resumo-lista">
      <li>
        <strong>Data</strong>
        <span>${dataFormatada}</span>
      </li>
      <li>
        <strong>Horário</strong>
        <span class="resumo-chip">🕐 ${slot.hora}</span>
      </li>
      <li>
        <strong>Profissional</strong>
        <span class="resumo-chip">${iconeProfissional} ${tipoProfissional}</span>
      </li>
      <li>
        <strong>Paciente</strong>
        <span>${nomeEscaped}</span>
      </li>
      <li>
        <strong>Telefone</strong>
        <span>${telefoneEscaped}</span>
      </li>
      <li>
        <strong>Nascimento</strong>
        <span>${dataNascimentoEscaped}</span>
      </li>
      <li>
        <strong>Motivo</strong>
        <span>${observacoesEscaped}</span>
      </li>
    </ul>

    <p class="resumo-footer">
      <strong>Importante:</strong> Para confirmar seu agendamento, clique no botão abaixo 
      e envie a mensagem pelo WhatsApp. Sem essa confirmação, o horário poderá não ser reservado.
    </p>
  `;
}

// ============================================
// CONSTRUÇÃO DA URL DO WHATSAPP
// ============================================
function construirUrlWhatsApp(slot, nome) {
  const diaSemana = slot.diaSemana ? slot.diaSemana.replace('-feira', '') : '';
  const dataFormatada = diaSemana ? `${diaSemana}, ${slot.data}` : slot.data;
  const origem = (slot.origem || 'F').toUpperCase();
  const tipoProfissional = origem === 'O' ? 'enfermeira' : 'médico';

  // Sem triagem (Outras consultas): mensagem simples.
  if (!fluxoTriagem) {
    const texto = `Olá! Aqui é ${nome}. Acabei de solicitar um agendamento com ${tipoProfissional} para ${dataFormatada} às ${slot.hora}. Poderia confirmar, por favor?`;
    return `https://wa.me/${WHATSAPP_DESTINO}?text=${encodeURIComponent(texto)}`;
  }

  // Com triagem (pré-natal / puericultura / preventivo): mensagem detalhada (igual ao pueripre).
  const t = fluxoTriagem.triagem || {};
  const tituloTipo = fluxoTriagem.tipo === 'prenatal' ? 'Pre-natal'
    : (fluxoTriagem.tipo === 'puericultura' ? 'Puericultura' : 'Preventivo');

  let texto = `*SOLICITACAO DE AGENDAMENTO*\n`;
  texto += `*${tituloTipo}* (${tipoProfissional})\n\n`;
  texto += `Data: ${dataFormatada}\n`;
  texto += `Horario: ${slot.hora}\n\n`;
  texto += `*PACIENTE*\n`;
  texto += `Nome: ${nome}\n`;

  if (fluxoTriagem.tipo === 'prenatal') {
    texto += `\n*PRE-NATAL*\n`;
    texto += t.ultimaConsulta === 'primeira'
      ? `- Primeira consulta de pre-natal\n`
      : `- Ultima consulta: ${t.dataUltimaConsulta || 'nao informada'}\n`;
    texto += t.semanasGestacao === 'semanas'
      ? `- Idade gestacional: ${t.numeroSemanas} semanas\n`
      : `- Idade gestacional: nao lembra\n`;
    texto += `- Ultima consulta foi com: ${t.ultimoProfissional === 'medico' ? 'Medico(a)' : 'Enfermeiro(a)'}\n`;
  } else if (fluxoTriagem.tipo === 'puericultura') {
    texto += `\n*PUERICULTURA*\n`;
    texto += `- Idade da crianca: ${t.mesesCrianca} meses\n`;
    texto += `- Ultima consulta com: ${t.ultimaConsultaMeses} meses\n`;
    texto += `- Ultima consulta foi com: ${t.ultimoProfissional === 'medico' ? 'Medico(a)' : 'Enfermeiro(a)'}\n`;
  } else if (fluxoTriagem.tipo === 'preventivo') {
    texto += `\n*PREVENTIVO*\n`;
    texto += t.naoLembraPreventivos
      ? `- Preventivos anteriores: nao lembra / nunca fez\n`
      : `- Ultimos preventivos: ${t.anoPreventivo1 || '-'} e ${t.anoPreventivo2 || '-'}\n`;
  }

  texto += `\nAguardo confirmacao!`;
  return `https://wa.me/${WHATSAPP_DESTINO}?text=${encodeURIComponent(texto)}`;
}

// ============================================
// ENVIO DO AGENDAMENTO
// ============================================
async function enviarAgendamento(event) {
  if (event) event.preventDefault();

  if (!validarFormulario()) return;

  const select = document.getElementById('slotSelect');
  const idx = parseInt(select.value, 10);
  const slot = slotsExibidos[idx];

  if (!slot) {
    mostrarErroCampo('slotSelect', 'Horário inválido');
    return;
  }

  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const dataNascimento = document.getElementById('dataNascimento').value.trim();
  const observacoes = document.getElementById('observacoes').value.trim();

  const msgDiv = document.getElementById('mensagem');
  const waDiv = document.getElementById('whatsapp-container');
  const waLink = document.getElementById('whatsapp-link');
  const formFields = document.getElementById('form-fields');
  const submitBtn = document.getElementById('submit-btn');

  waDiv.style.display = 'none';

  // Estado de loading
  submitBtn.disabled = true;
  submitBtn.classList.add('btn-loading');

  msgDiv.className = 'msg';
  msgDiv.style.display = 'block';
  msgDiv.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px 0;">
      <div style="width: 24px; height: 24px; border: 2.5px solid #e2e8f0; border-top-color: #21a366; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span style="color: #64748b; font-weight: 500;">Processando agendamento...</span>
    </div>
  `;

  const dados = {
    action: 'bookSlot',
    slot_id: slot.slot_id,
    // No fluxo de triagem o service_id é o tipo (prenatal/puericultura/preventivo);
    // senão é o profissional do próprio slot.
    service_id: fluxoTriagem ? fluxoTriagem.tipo : (slot.origem === 'O' ? 'enfermagem' : 'medico'),
    patient_name: nome,
    phone: telefone,
    birthdate: dataNascimento,
    reason: observacoes,
    triagem: fluxoTriagem ? fluxoTriagem.triagem : {}
  };

  console.log('Enviando para API:', dados);

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(dados)
    });

    if (!resp.ok) {
      throw new Error('Erro ao agendar (HTTP ' + resp.status + ')');
    }

    const res = await resp.json();
    console.log('Resposta da API:', res);

    // Backend novo responde { ok, error }. Se a vaga sumiu, mostra o erro.
    if (!res.ok) {
      throw new Error(res.error || 'Não foi possível agendar. Tente outro horário.');
    }

    msgDiv.className = 'msg sucesso';
    msgDiv.innerHTML = construirResumoAgendamento(slot, nome, telefone, dataNascimento, observacoes);

    waLink.href = construirUrlWhatsApp(slot, nome);
    waDiv.style.display = 'block';

    if (formFields) {
      formFields.style.display = 'none';
    }

    // Atualizar para step 3 (confirmar)
    updateProgressSteps(3);

    msgDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error(err);

    submitBtn.disabled = false;
    submitBtn.classList.remove('btn-loading');

    msgDiv.className = 'msg erro';
    msgDiv.innerHTML = `
      <div style="text-align: center;">
        <p style="font-weight: 600; margin-bottom: 8px;">Erro ao realizar agendamento</p>
        <p style="font-size: 14px; margin-bottom: 16px;">${err.message || 'Verifique sua conexão e tente novamente.'}</p>
      </div>
    `;

    msgDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ============================================
// MÁSCARAS DE INPUT
// ============================================
function aplicarMascaraTelefone(input) {
  let value = input.value.replace(/\D/g, '');

  if (value.length <= 2) {
    input.value = value ? '(' + value : '';
  } else if (value.length <= 7) {
    input.value = '(' + value.substring(0, 2) + ') ' + value.substring(2);
  } else if (value.length <= 10) {
    input.value = '(' + value.substring(0, 2) + ') ' + value.substring(2, 6) + '-' + value.substring(6);
  } else {
    input.value = '(' + value.substring(0, 2) + ') ' + value.substring(2, 7) + '-' + value.substring(7, 11);
  }
}

function aplicarMascaraData(input) {
  let value = input.value.replace(/\D/g, '');

  if (value.length > 2) {
    value = value.substring(0, 2) + '/' + value.substring(2);
  }
  if (value.length > 5) {
    value = value.substring(0, 5) + '/' + value.substring(5, 9);
  }

  input.value = value;
}

// ============================================
// VALIDAÇÃO EM TEMPO REAL
// ============================================
function configurarValidacaoEmTempoReal() {
  const campos = ['slotSelect', 'nome', 'dataNascimento', 'telefone', 'observacoes'];

  campos.forEach(campoId => {
    const campo = document.getElementById(campoId);
    if (!campo) return;

    campo.addEventListener('input', () => limparErroCampo(campoId));

    campo.addEventListener('blur', function () {
      const valor = campo.value.trim();
      if (!valor) return;

      if (campoId === 'telefone' && !validarTelefone(valor)) {
        mostrarErroCampo(campoId, 'Telefone inválido');
      } else if (campoId === 'dataNascimento') {
        const validacao = validarDataNascimento(valor);
        if (!validacao.valido) {
          mostrarErroCampo(campoId, validacao.mensagem);
        }
      }
    });

    // Atualizar steps baseado no preenchimento
    campo.addEventListener('change', function () {
      if (campoId === 'slotSelect' && campo.value) {
        updateProgressSteps(2);
      }
    });
  });
}

// ============================================
// TRIAGEM (pré-natal / puericultura / preventivo) — integrado do pueripre
// ============================================
function mostrarCardTriagem(tipo) {
  esconderTodosCards();
  const map = { prenatal: 'card-prenatal', puericultura: 'card-puericultura', preventivo: 'card-preventivo' };
  const el = document.getElementById(map[tipo]);
  if (el) el.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Define o fluxo (tipo + profissional roteado) e abre o agendamento já filtrado.
function irParaAgendamento(tipo, professional, triagem) {
  fluxoTriagem = { tipo: tipo, professional: professional, triagem: triagem };
  mostrarFormulario(true);
}

function inicializarTriagem() {
  const q = function (sel) { return document.querySelector(sel); };

  // Abre o card de triagem ao escolher o serviço na home.
  document.querySelectorAll('[data-action="triagem"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      mostrarCardTriagem(btn.getAttribute('data-tipo'));
    });
  });

  // ----- Pré-natal: campos condicionais -----
  document.querySelectorAll('input[name="ultimaConsulta"]').forEach(function (r) {
    r.addEventListener('change', function () {
      const campo = document.getElementById('campo-data-consulta');
      if (!campo) return;
      if (this.value === 'data') {
        campo.style.display = 'block';
      } else {
        campo.style.display = 'none';
        const i = document.getElementById('dataUltimaConsulta');
        if (i) i.value = '';
      }
    });
  });
  document.querySelectorAll('input[name="semanasGestacao"]').forEach(function (r) {
    r.addEventListener('change', function () {
      const campo = document.getElementById('campo-semanas');
      if (campo) campo.style.display = (this.value === 'semanas') ? 'block' : 'none';
    });
  });
  const inputDataUC = document.getElementById('dataUltimaConsulta');
  if (inputDataUC) inputDataUC.addEventListener('input', function (e) { aplicarMascaraData(e.target); });

  // ----- Pré-natal: submit + roteamento -----
  const formPre = document.getElementById('form-prenatal');
  if (formPre) formPre.addEventListener('submit', function (e) {
    e.preventDefault();
    const ultimaConsulta = q('input[name="ultimaConsulta"]:checked');
    const semanas = q('input[name="semanasGestacao"]:checked');
    const ultimoProf = q('input[name="ultimoProfissional"]:checked');
    if (!ultimaConsulta) { alert('Informe quando foi sua última consulta.'); return; }
    if (!semanas) { alert('Informe as semanas de gestação.'); return; }
    if (!ultimoProf) { alert('Informe com quem foi sua última consulta.'); return; }
    const dataUC = document.getElementById('dataUltimaConsulta');
    if (ultimaConsulta.value === 'data' && (!dataUC || !dataUC.value.trim())) {
      alert('Informe a data da última consulta.'); if (dataUC) dataUC.focus(); return;
    }
    const numSem = document.getElementById('numeroSemanas');
    const triagem = {
      tipo: 'prenatal',
      ultimaConsulta: ultimaConsulta.value,
      dataUltimaConsulta: (ultimaConsulta.value === 'data' && dataUC) ? dataUC.value : '',
      semanasGestacao: semanas.value,
      numeroSemanas: (semanas.value === 'semanas' && numSem) ? numSem.value : '',
      ultimoProfissional: ultimoProf.value
    };
    // Primeira consulta -> enfermagem (O). Senão alterna: último enfermeiro -> médico (F); último médico -> enfermagem (O).
    let professional;
    if (ultimaConsulta.value === 'primeira') professional = 'O';
    else professional = (ultimoProf.value === 'enfermeiro') ? 'F' : 'O';
    irParaAgendamento('prenatal', professional, triagem);
  });

  // ----- Puericultura: submit + roteamento -----
  const formPue = document.getElementById('form-puericultura');
  if (formPue) formPue.addEventListener('submit', function (e) {
    e.preventDefault();
    const meses = document.getElementById('mesesCrianca');
    const ultMeses = document.getElementById('ultimaConsultaMeses');
    const ultimoProf = q('input[name="ultimoProfissionalPuericultura"]:checked');
    if (!meses || !meses.value) { alert('Informe quantos meses a criança tem.'); return; }
    if (!ultMeses || !ultMeses.value) { alert('Informe com quantos meses foi a última consulta.'); return; }
    if (!ultimoProf) { alert('Informe com quem foi a última consulta.'); return; }
    const triagem = {
      tipo: 'puericultura',
      mesesCrianca: meses.value,
      ultimaConsultaMeses: ultMeses.value,
      ultimoProfissional: ultimoProf.value
    };
    const professional = (ultimoProf.value === 'enfermeiro') ? 'F' : 'O';
    irParaAgendamento('puericultura', professional, triagem);
  });

  // ----- Preventivo: idade / checkbox / intervalo -----
  const btnPrevAvancar = document.getElementById('btn-preventivo-avancar');
  const prev1 = document.getElementById('preventivo1');
  const prev2 = document.getElementById('preventivo2');
  const chkNaoLembro = document.getElementById('naoLembroPreventivos');

  function verificarIntervalo() {
    const a1 = parseInt(prev1 && prev1.value, 10);
    const a2 = parseInt(prev2 && prev2.value, 10);
    const ai = document.getElementById('aviso-intervalo');
    const anoAtual = new Date().getFullYear();
    if (ai) ai.style.display = (a1 && a2 && (anoAtual - a2) < 3) ? 'flex' : 'none';
  }

  document.querySelectorAll('input[name="maiorQue25"]').forEach(function (r) {
    r.addEventListener('change', function () {
      const campos = document.getElementById('campo-ultimos-preventivos');
      const aviso = document.getElementById('aviso-menor-25');
      if (this.value === 'sim') {
        if (campos) campos.style.display = 'block';
        if (aviso) aviso.style.display = 'none';
        if (btnPrevAvancar) btnPrevAvancar.disabled = false;
      } else {
        if (campos) campos.style.display = 'none';
        if (aviso) aviso.style.display = 'flex';
        const ai = document.getElementById('aviso-intervalo');
        if (ai) ai.style.display = 'none';
        if (btnPrevAvancar) btnPrevAvancar.disabled = true;
      }
    });
  });
  if (chkNaoLembro) chkNaoLembro.addEventListener('change', function () {
    if (this.checked) {
      if (prev1) { prev1.value = ''; prev1.disabled = true; }
      if (prev2) { prev2.value = ''; prev2.disabled = true; }
      const ai = document.getElementById('aviso-intervalo');
      if (ai) ai.style.display = 'none';
    } else {
      if (prev1) prev1.disabled = false;
      if (prev2) prev2.disabled = false;
    }
  });
  if (prev1) prev1.addEventListener('input', verificarIntervalo);
  if (prev2) prev2.addEventListener('input', verificarIntervalo);

  // ----- Preventivo: submit (sempre enfermagem) -----
  const formPrev = document.getElementById('form-preventivo');
  if (formPrev) formPrev.addEventListener('submit', function (e) {
    e.preventDefault();
    const maior = q('input[name="maiorQue25"]:checked');
    if (!maior || maior.value !== 'sim') { alert('O rastreio preventivo é indicado a partir dos 25 anos.'); return; }
    const naoLembro = chkNaoLembro ? chkNaoLembro.checked : false;
    const triagem = {
      tipo: 'preventivo',
      maiorQue25: 'sim',
      naoLembraPreventivos: naoLembro,
      anoPreventivo1: naoLembro ? '' : (prev1 ? prev1.value : ''),
      anoPreventivo2: naoLembro ? '' : (prev2 ? prev2.value : '')
    };
    irParaAgendamento('preventivo', 'O', triagem);
  });
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', function () {
  // ⚙️ Carrega textos/WhatsApp/serviços de _config e _services (mantém estático se falhar).
  carregarConfig();

  // Os horários NÃO são pré-carregados — buscamos fresco só ao chegar na escolha de horário
  // (depois da triagem / ao abrir "Outras consultas"), pra lista nunca ficar velha.

  // Máscaras
  const dataNascInput = document.getElementById('dataNascimento');
  if (dataNascInput) {
    dataNascInput.addEventListener('input', (e) => aplicarMascaraData(e.target));
  }

  const telefoneInput = document.getElementById('telefone');
  if (telefoneInput) {
    telefoneInput.addEventListener('input', (e) => aplicarMascaraTelefone(e.target));
  }

  // Validação em tempo real
  configurarValidacaoEmTempoReal();

  // Submit do formulário
  const form = document.getElementById('agendamento-form');
  if (form) {
    form.addEventListener('submit', enviarAgendamento);
  }

  // "Outras consultas": fluxo direto, sem triagem (mostra médico + enfermagem).
  const btnAgendar = document.querySelectorAll('[data-action="agendar"]');
  btnAgendar.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      fluxoTriagem = null;
      mostrarFormulario(true);
    });
  });

  // Botões "Voltar" (no agendamento e nas triagens) retornam ao início.
  const btnVoltar = document.querySelectorAll('[data-action="voltar"]');
  btnVoltar.forEach(btn => {
    btn.addEventListener('click', voltarParaIntro);
  });

  // Triagem: pré-natal / puericultura / preventivo (sistema pueripre integrado).
  inicializarTriagem();
});

