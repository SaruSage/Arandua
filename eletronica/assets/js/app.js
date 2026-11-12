/**
 * app.js — Orquestrador da aplicação de eletrônica.
 * Monta a interface, paleta, canvas e painel.
 */

import {
  CATALOGO,
  CATEGORIAS,
  itensDaCategoria,
  obterDimensoesComponente,
  obterPinosComponente,
} from './catalogo.js';
import { ARTES_REALISTAS, carregarArtesRealistas } from './visual.js';
import {
  criarCircuito,
  adicionarComponente,
  removerComponente,
  componenteEm,
} from './circuito.js';
import { criarCanvas } from './canvas.js';
import { configurarInteracao } from './selecao.js';
import { configurarFios, removerFio } from './fios.js';
import {
  renderizarPainel as renderizarPainelNovo,
  montarPropriedadesComponente,
  montarPropriedadesFio,
  montarPropriedadesArea,
  montarListaComandos,
  montarCorpoConstruir,
  montarCorpoMontagem,
} from './painel.js';
import {
  analisarSelecaoParaConstruir,
  executarSubstituicaoConstruir,
} from './construir.js';
import {
  gerarMontagem,
  executarTrazerAoProjeto,
} from './montagem.js';
import { abrirModalExemplos } from './exemplos.js';
import { simular, tensaoEm, correnteEm } from './solver.js';
import { obterMontagem, desenharMontagem } from './montagens.js';
import {
  desenharComponente,
  definirProgressoEstiloRealista,
  obterProgressoEstiloRealista,
} from './simbolos.js';
import { configurarGrupos, juntarSelecionados, desfazerGrupo, atualizarTodosBounds, recalcularMembros, pontoDentroDoGrupo, grupoDentroDeGrupo, CORES_GRUPO } from './grupos.js';
import { exportarPNG } from './exportar.js';
import {
  baixarArquivo,
  abrirArquivo,
  reconstruir,
  agendarAutosave,
  carregarLocal,
  temAutosave,
  limparLocal,
} from './persistencia.js';
import {
  registrar,
  desfazer,
  refazer,
  podeDesfazer,
  podeRefazer,
  inicializar,
  limpar as limparHistorico,
} from './historico.js';

const estado = {
  circuito: criarCircuito(),
  selecionados: [],
  grupoSelecionadoId: null,
  resultado: null,
  simulando: false,
  selecaoRetangular: null,
  ultimoMouse: { x: 0, y: 0 },
  _ultimoDx: 0,
  _ultimoDy: 0,
  popups: {},
  popupAtivo: null,
  zIndexPopup: 100,
  arrastoInicial: null,
  fecharPopupsNaoFixados() {
    return fecharPopupsNaoFixados();
  },
  abrirPopupComponente(compId) {
    abrirPopupEntidade('comp', compId);
  },
  abrirPopupEntidade(tipo, id) {
    abrirPopupEntidade(tipo, id);
  },
  renderizarPopups(forcar = false) {
    renderizarPopups(forcar);
  },
  removerComponentePorId(compId) {
    if (estado.simulando) {
      pararSimulacao();
    }
    removerComponente(estado.circuito, compId);
    const chave = `comp:${compId}`;
    delete estado.popups[chave];
    delete estado.popups[compId];
    if (estado.popupAtivo === chave || estado.popupAtivo === compId) {
      estado.popupAtivo = null;
    }
    estado.selecionados = estado.selecionados.filter((id) => id !== compId);
    registrar(estado.circuito, 'remover', true);
    renderizarTudo();
    renderizarPopups(true);
  },
  removerFioPorId(fioId) {
    removerFio(estado.circuito, fioId);
    const chave = `fio:${fioId}`;
    delete estado.popups[chave];
    if (estado.popupAtivo === chave) {
      estado.popupAtivo = null;
    }
    if (estado.fioSelecionadoId === fioId) {
      estado.fioSelecionadoId = null;
    }
    renderizarTudo();
    renderizarPopups(true);
  },
  removerAreaPorId(areaId) {
    desfazerGrupo(estado.circuito, areaId);
    const chave = `area:${areaId}`;
    delete estado.popups[chave];
    if (estado.popupAtivo === chave) {
      estado.popupAtivo = null;
    }
    if (estado.grupoSelecionadoId === areaId) {
      estado.grupoSelecionadoId = null;
    }
    estado.selecionados = estado.selecionados.filter((id) => id !== areaId);
    renderizarTudo();
    renderizarPopups(true);
  },
  adicionar(tipo, x, y) {
    if (estado.simulando) {
      pararSimulacao();
    }
    for (const id of estado.selecionados) {
      const g = estado.circuito.grupos.find((x) => x.id === id);
      if (g) recalcularMembros(g);
    }
    const novoComp = adicionarComponente(estado.circuito, tipo, x, y);

    // Adquire área se o componente caiu dentro de uma
    const areas = estado.circuito.grupos
      .filter((g) => pontoDentroDoGrupo(novoComp, g))
      .sort((a, b) => (a.w * a.h) - (b.w * b.h)); // menor primeiro

    if (areas.length > 0) {
      areas[0].membros.push(novoComp.id);
    }

    registrar(estado.circuito, 'adicionar', true);
    estado.selecionados = [novoComp.id];
    estado.grupoSelecionadoId = null;
    abrirPopupEntidade('comp', novoComp.id);
    renderizarTudo();
  },
  removerSelecionados() {
    if (estado.simulando) {
      pararSimulacao();
    }
    for (const id of estado.selecionados) {
      removerComponente(estado.circuito, id);
      const chave = `comp:${id}`;
      delete estado.popups[chave];
      delete estado.popups[id];
      if (estado.popupAtivo === chave || estado.popupAtivo === id) {
        estado.popupAtivo = null;
      }
    }
    registrar(estado.circuito, 'remover', true);
    estado.selecionados = [];
    estado.grupoSelecionadoId = null;
    renderizarTudo();
    renderizarPopups(true);
  },
  recalcular() {
    recalcular();
  },
};

let canvas = null;
let elPainel = null;
let areaTransferencia = null;
let timerDanoCapacitor = null;

function pararSimulacao() {
  estado.simulando = false;
  estado.resultado = null;
  if (timerDanoCapacitor !== null) {
    clearInterval(timerDanoCapacitor);
    timerDanoCapacitor = null;
  }

  // Limpa o estado de todos os componentes
  for (const comp of estado.circuito.componentes) {
    comp.estado = {};
    for (const p of comp.pinos || []) {
      p.valor = null;
    }
  }

  // Restaura o botão
  const btn = document.getElementById('btn-simular');
  if (btn) {
    btn.textContent = 'Simular';
    btn.classList.remove('btn-simulando');
  }

  // Remove o aviso SIMULANDO e avisos da simulação
  const aviso = document.getElementById('aviso-simulando');
  if (aviso) aviso.remove();
  const avisosSim = document.getElementById('avisos-simulacao');
  if (avisosSim) avisosSim.remove();

  renderizarTudo();
}

function limparResultados() {
  estado.resultado = null;
  for (const comp of estado.circuito.componentes) {
    comp.estado = {};
    for (const p of comp.pinos || []) {
      p.valor = null;
    }
  }
  const avisosSim = document.getElementById('avisos-simulacao');
  if (avisosSim) avisosSim.remove();
  renderizarTudo();
}

function iniciarSimulacao() {
  estado.simulando = true;

  const btn = document.getElementById('btn-simular');
  if (btn) {
    btn.textContent = 'Parar simulação';
    btn.classList.add('btn-simulando');
  }

  mostrarAvisoSimulando();
  recalcular();
  if (estado.circuito.componentes.some((comp) => comp.tipo === 'CAPACITOR')) {
    timerDanoCapacitor = setInterval(() => {
      if (estado.simulando) recalcular();
    }, 250);
  }
  renderizarPainel();
}

function mostrarAvisoSimulando() {
  if (document.getElementById('aviso-simulando')) return;

  const aviso = document.createElement('div');
  aviso.id = 'aviso-simulando';
  aviso.className = 'aviso-simulando';
  aviso.textContent = 'SIMULANDO';

  const area = document.querySelector('.area-canvas') || canvas.elemento.parentElement;
  area.appendChild(aviso);
}

function recalcular() {
  if (!estado.simulando) return;

  const statusCapacitorAnterior = new Map(
    estado.circuito.componentes
      .filter((comp) => comp.tipo === 'CAPACITOR')
      .map((comp) => [comp.id, comp.estado?.statusDano || 'integro'])
  );
  let statusCapacitorAlterado = false;
  try {
    const resultado = simular(estado.circuito);
    estado.resultado = resultado;

    // Aplica o estado calculado em cada componente
    for (const comp of estado.circuito.componentes) {
      const r = resultado.componentes?.find((x) => x.id === comp.id);
      if (r) {
        comp.estado = { ...comp.estado, ...r.estado };
        if (r.pinos) {
          comp.estado.pinos = r.pinos;
        }
      }
    }
    statusCapacitorAlterado = estado.circuito.componentes.some((comp) => (
      comp.tipo === 'CAPACITOR'
      && statusCapacitorAnterior.get(comp.id) !== (comp.estado?.statusDano || 'integro')
    ));
  } catch (e) {
    // Circuito inválido durante a edição: mantém o último resultado
    console.warn('Simulação falhou durante edição:', e);
  }

  // Mostra avisos da simulação
  const avisos = estado.resultado?.avisos || [];
  let caixaAvisos = document.getElementById('avisos-simulacao');

  if (avisos.length > 0) {
    if (!caixaAvisos) {
      caixaAvisos = document.createElement('div');
      caixaAvisos.id = 'avisos-simulacao';
      caixaAvisos.className = 'avisos-simulacao';
      const area = document.querySelector('.area-canvas')
                 || canvas.elemento.parentElement;
      area.appendChild(caixaAvisos);
    }
    caixaAvisos.innerHTML = avisos
      .map((a) => `<div class="aviso-item">${a}</div>`)
      .join('');
  } else if (caixaAvisos) {
    caixaAvisos.remove();
  }

  canvas.render(
    estado.circuito,
    estado.selecionados,
    estado.fioSelecionadoId,
    null,
    estado.fioFantasma,
    estado.selecaoRetangular,
    estado.grupoSelecionadoId
  );

  if (estado.resultado?.queimouFusivel || statusCapacitorAlterado) {
    renderizarPainel(true);
  }
}

function copiarSelecionados() {
  // Prioridade 1: grupo selecionado
  const grupoSel = estado.circuito.grupos.find(
    (g) => estado.selecionados.includes(g.id)
  );

  if (grupoSel) {
    copiarGrupo(grupoSel);
    return;
  }

  // Prioridade 2: componentes avulsos
  if (estado.selecionados.length === 0) return;

  const componentes = estado.circuito.componentes.filter((c) =>
    estado.selecionados.includes(c.id)
  );

  const fios = estado.circuito.fios.filter(
    (f) =>
      estado.selecionados.includes(f.origem.componente) &&
      estado.selecionados.includes(f.destino.componente)
  );

  areaTransferencia = {
    tipo: 'componentes',
    componentes: componentes.map((c) => ({
      tipo: c.tipo,
      x: c.x,
      y: c.y,
      rotacao: c.rotacao || 0,
      propriedades: { ...c.propriedades },
      idOriginal: c.id,
    })),
    fios: fios.map((f) => ({
      origem: { ...f.origem },
      destino: { ...f.destino },
      dobras: (f.dobras || []).map((d) => ({ x: d.x, y: d.y })),
      cor: f.cor,
    })),
  };
}

function copiarGrupo(grupo) {
  // Coleta recursivamente todos os ids de membros
  const idsMembros = new Set();
  const idsGrupos = new Set();

  function coletar(id) {
    if (idsMembros.has(id)) return;
    idsMembros.add(id);

    const sub = estado.circuito.grupos.find((g) => g.id === id);
    if (sub) {
      idsGrupos.add(sub.id);
      for (const m of sub.membros) coletar(m);
    }
  }

  idsGrupos.add(grupo.id);
  for (const m of grupo.membros) coletar(m);

  const componentes = estado.circuito.componentes.filter((c) =>
    idsMembros.has(c.id)
  );

  const fios = estado.circuito.fios.filter(
    (f) =>
      idsMembros.has(f.origem.componente) &&
      idsMembros.has(f.destino.componente)
  );

  // Coleta os subgrupos (todos, menos o raiz, que vai separado)
  const subgrupos = estado.circuito.grupos
    .filter((g) => idsGrupos.has(g.id) && g.id !== grupo.id)
    .map((g) => ({
      idOriginal: g.id,
      nome: g.nome,
      cor: g.cor,
      posicaoNome: g.posicaoNome ? { ...g.posicaoNome } : null,
      x: g.x,
      y: g.y,
      w: g.w,
      h: g.h,
      vertices: g.vertices
        ? g.vertices.map((v) => ({ x: v.x, y: v.y }))
        : null,
      membros: [...g.membros],
    }));

  areaTransferencia = {
    tipo: 'grupo',
    nome: grupo.nome,
    cor: grupo.cor,
    posicaoNome: grupo.posicaoNome ? { ...grupo.posicaoNome } : null,
    x: grupo.x,
    y: grupo.y,
    w: grupo.w,
    h: grupo.h,
    vertices: grupo.vertices
      ? grupo.vertices.map((v) => ({ x: v.x, y: v.y }))
      : null,
    membros: [...grupo.membros],
    subgrupos,
    componentes: componentes.map((c) => ({
      tipo: c.tipo,
      x: c.x,
      y: c.y,
      rotacao: c.rotacao || 0,
      propriedades: { ...c.propriedades },
      idOriginal: c.id,
    })),
    fios: fios.map((f) => ({
      origem: { ...f.origem },
      destino: { ...f.destino },
      dobras: (f.dobras || []).map((d) => ({ x: d.x, y: d.y })),
      cor: f.cor,
    })),
  };
}

/**
 * Encontra uma posição livre para colar, próxima ao mouse, sem
 * sobrepor nenhuma área existente.
 * Testa direita, acima, abaixo e esquerda, nessa ordem.
 */
function posicaoLivre(w, h, mouse) {
  const MARGEM = 24;
  const grupos = estado.circuito.grupos;

  const candidatos = [
    { x: mouse.x + MARGEM, y: mouse.y - h / 2 },              // direita
    { x: mouse.x - w / 2, y: mouse.y - h - MARGEM },          // acima
    { x: mouse.x - w / 2, y: mouse.y + MARGEM },              // abaixo
    { x: mouse.x - w - MARGEM, y: mouse.y - h / 2 },          // esquerda
  ];

  for (const c of candidatos) {
    const sobrepoe = grupos.some((g) => {
      return !(
        c.x + w < g.x ||
        c.x > g.x + g.w ||
        c.y + h < g.y ||
        c.y > g.y + g.h
      );
    });
    if (!sobrepoe) return c;
  }

  // Se todos sobrepõem, afasta mais para a direita
  return { x: mouse.x + w + MARGEM * 2, y: mouse.y - h / 2 };
}

function colarGrupo(mouse) {
  const t = areaTransferencia;
  const pos = posicaoLivre(t.w, t.h, mouse);

  const dx = pos.x - t.x;
  const dy = pos.y - t.y;

  const mapaIds = new Map();
  const novosIds = [];

  // Cria os componentes
  for (const c of t.componentes) {
    const novoId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    mapaIds.set(c.idOriginal, novoId);
    novosIds.push(novoId);

    estado.circuito.componentes.push({
      id: novoId,
      tipo: c.tipo,
      x: c.x + dx,
      y: c.y + dy,
      rotacao: c.rotacao,
      propriedades: { ...c.propriedades },
      pinos: obterPinosComponente(c.tipo, c.propriedades),
      dimensoes: obterDimensoesComponente(c.tipo, c.propriedades),
      estado: {},
    });
  }

  // Cria os fios internos
  for (const f of t.fios) {
    const novaOrigem = mapaIds.get(f.origem.componente);
    const novoDestino = mapaIds.get(f.destino.componente);
    if (!novaOrigem || !novoDestino) continue;

    estado.circuito.fios.push({
      id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      origem: { componente: novaOrigem, pino: f.origem.pino },
      destino: { componente: novoDestino, pino: f.destino.pino },
      dobras: (f.dobras || []).map((d) => ({ x: d.x + dx, y: d.y + dy })),
      cor: f.cor,
    });
  }

  // Recria os subgrupos
  const mapaGrupos = new Map();
  for (const sg of (t.subgrupos || [])) {
    const novoSubId = `grupo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    mapaGrupos.set(sg.idOriginal, novoSubId);
  }

  for (const sg of (t.subgrupos || [])) {
    const novoSubId = mapaGrupos.get(sg.idOriginal);

    estado.circuito.grupos.push({
      id: novoSubId,
      nome: sg.nome,
      cor: sg.cor,
      posicaoNome: sg.posicaoNome ? { ...sg.posicaoNome } : null,
      x: sg.x + dx,
      y: sg.y + dy,
      w: sg.w,
      h: sg.h,
      bounds: {
        x: sg.x + dx,
        y: sg.y + dy,
        w: sg.w,
        h: sg.h,
      },
      vertices: sg.vertices
        ? sg.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy }))
        : null,
      membros: sg.membros
        .map((m) => mapaIds.get(m) || mapaGrupos.get(m))
        .filter(Boolean),
    });
  }

  // Cria o grupo com o mesmo nome e cor
  const novoGrupoId = `grupo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  estado.circuito.grupos.push({
    id: novoGrupoId,
    nome: t.nome,
    cor: t.cor,
    posicaoNome: t.posicaoNome ? { ...t.posicaoNome } : null,
    x: t.x + dx,
    y: t.y + dy,
    w: t.w,
    h: t.h,
    bounds: {
      x: t.x + dx,
      y: t.y + dy,
      w: t.w,
      h: t.h,
    },
    vertices: t.vertices
      ? t.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy }))
      : null,
    membros: (t.membros || [])
      .map((m) => mapaIds.get(m) || mapaGrupos.get(m))
      .filter(Boolean),
  });

  // Aninha imediatamente se o novo grupo caiu dentro de outro
  const novoGrupo = estado.circuito.grupos.find(
    (g) => g.id === novoGrupoId
  );

  if (novoGrupo) {
    const pais = estado.circuito.grupos
      .filter((g) =>
        g.id !== novoGrupoId && grupoDentroDeGrupo(novoGrupo, g)
      )
      .sort((a, b) => (a.w * a.h) - (b.w * b.h)); // menor primeiro

    if (pais.length > 0) {
      const pai = pais[0];
      if (!pai.membros.includes(novoGrupoId)) {
        pai.membros.push(novoGrupoId);
      }
    }
  }

  estado.selecionados = [novoGrupoId];
  estado.grupoSelecionadoId = novoGrupoId;
  estado.fioSelecionadoId = null;
}

function colarComponentes(mouse) {
  const t = areaTransferencia;
  const DESLOCAMENTO = 24;

  const mapaIds = new Map();
  const novosIds = [];

  for (const c of t.componentes) {
    const novoId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    mapaIds.set(c.idOriginal, novoId);
    novosIds.push(novoId);

    const novoComp = {
      id: novoId,
      tipo: c.tipo,
      x: c.x + DESLOCAMENTO,
      y: c.y + DESLOCAMENTO,
      rotacao: c.rotacao,
      propriedades: { ...c.propriedades },
      pinos: obterPinosComponente(c.tipo, c.propriedades),
      dimensoes: obterDimensoesComponente(c.tipo, c.propriedades),
      estado: {},
    };
    estado.circuito.componentes.push(novoComp);

    // Adquire área se o componente caiu dentro de uma
    const areas = estado.circuito.grupos
      .filter((g) => pontoDentroDoGrupo(novoComp, g))
      .sort((a, b) => (a.w * a.h) - (b.w * b.h)); // menor primeiro

    if (areas.length > 0) {
      areas[0].membros.push(novoComp.id);
    }
  }

  for (const f of t.fios) {
    const novaOrigem = mapaIds.get(f.origem.componente);
    const novoDestino = mapaIds.get(f.destino.componente);
    if (!novaOrigem || !novoDestino) continue;

    estado.circuito.fios.push({
      id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      origem: { componente: novaOrigem, pino: f.origem.pino },
      destino: { componente: novoDestino, pino: f.destino.pino },
      dobras: (f.dobras || []).map((d) => ({
        x: d.x + DESLOCAMENTO,
        y: d.y + DESLOCAMENTO,
      })),
      cor: f.cor,
    });
  }

  estado.selecionados = novosIds;
  estado.grupoSelecionadoId = null;
  estado.fioSelecionadoId = null;
}

function colar() {
  if (!areaTransferencia) return;

  // Posição do mouse no momento do Ctrl+V
  const mouse = estado.ultimoMouse || { x: 0, y: 0 };

  if (areaTransferencia.tipo === 'grupo') {
    colarGrupo(mouse);
  } else {
    colarComponentes(mouse);
  }

  registrar(estado.circuito, 'colar', true);
  renderizarTudo();
  if (typeof recalcular === 'function') recalcular();
}

function duplicarSelecionados() {
  if (estado.selecionados.length === 0) return;

  // Copia e cola imediatamente, com deslocamento fixo
  copiarSelecionados();

  // Guarda a posição atual do mouse para o posicionamento
  const mouse = estado.ultimoMouse || { x: 0, y: 0 };

  if (areaTransferencia?.tipo === 'grupo') {
    colarGrupo(mouse);
  } else if (areaTransferencia?.tipo === 'componentes') {
    colarComponentes(mouse);
  }

  registrar(estado.circuito, 'duplicar', true);

  renderizarTudo();
  if (typeof recalcular === 'function') recalcular();
}

function atualizarBotoesHistorico() {
  const btnD = document.getElementById('btn-desfazer');
  const btnR = document.getElementById('btn-refazer');
  if (btnD) btnD.disabled = !podeDesfazer();
  if (btnR) btnR.disabled = !podeRefazer();
}

function montarInterface() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="eletronica-layout">
      <header class="eletronica-toolbar eletronica-cabecalho">
        <div class="cabecalho-esquerda">
          <a href="#" class="cabecalho-logo" title="Arandua">
            <img src="assets/img/logo-arandua.png?v=2" alt="Arandua">
          </a>
        </div>
        <div class="cabecalho-acoes">
          <button type="button" class="btn-simular" id="btn-simular">Simular</button>
          <button type="button" class="btn-juntar" id="btn-juntar">Criar área</button>
          <button id="btn-construir" class="cabecalho-btn cabecalho-btn-construir" type="button" disabled>Construir</button>
          <button type="button" class="btn-toolbar" id="btn-desfazer" title="Desfazer (Ctrl+Z)">↶</button>
          <button type="button" class="btn-toolbar" id="btn-refazer" title="Refazer (Ctrl+Y)">↷</button>
        </div>
        <div class="menu-container">
          <button type="button" id="btn-estilo-realista" class="btn-estilo-realista"
                  title="Ativar design realista" aria-label="Ativar design realista" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle class="icone-circulo-vazio" cx="8.5" cy="12" r="6.25"/>
              <circle class="icone-circulo-cheio" cx="15.5" cy="12" r="6.25"/>
            </svg>
          </button>
          <button type="button" id="btn-exemplos" class="cabecalho-btn cabecalho-btn-exemplos" title="Exemplos de Portas Lógicas e Somadores">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span>Exemplos</span>
          </button>
          <button type="button" id="btn-menu" class="btn-icone" title="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div id="menu-dropdown" class="menu-dropdown oculto">
            <button type="button" id="btn-comandos" class="menu-item">Comandos</button>
            <button type="button" id="btn-salvar">Salvar</button>
            <button type="button" id="btn-abrir">Abrir</button>
            <button type="button" id="btn-exportar">PNG</button>
          </div>
        </div>
      </header>
      <div id="paleta-wrap" class="paleta-wrap">
        <aside id="paleta" class="eletronica-paleta"></aside>
        <button type="button" id="btn-recolher-paleta" class="paleta-aba" title="Recolher painel">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6l-6 6 6 6z"/>
          </svg>
        </button>
      </div>
      <div id="area-simulacao" class="eletronica-canvas eletronica-canvas-wrap">
        <canvas id="canvas"></canvas>
        <div id="popups-container" class="popups-container"></div>
        <input id="input-renomear" class="input-renomear oculto"
               maxlength="15" placeholder="Nome (máx. 15)"
               autocomplete="off">
      </div>
    </div>
  `;

  montarPaleta(document.getElementById('paleta'));
  const btnRecolher = document.getElementById('btn-recolher-paleta');
  const paletaWrap = document.getElementById('paleta-wrap');

  const recolhida = localStorage.getItem('paletaRecolhida') === '1';
  if (recolhida && paletaWrap) {
    paletaWrap.classList.add('recolhida');
    if (btnRecolher) btnRecolher.title = 'Abrir painel';
  }
  estado.offsetOrigemX = paletaWrap?.classList.contains('recolhida')
    ? 0
    : (paletaWrap?.offsetWidth || 260);

  elPainel = document.getElementById('popups-container');
  canvas = criarCanvas(document.getElementById('canvas'), estado);
  estado.view = canvas.view;
  estado.canvasElemento = canvas.elemento;
  estado.iniciarSimulacao = iniciarSimulacao;
  estado.pararSimulacao = pararSimulacao;
  estado.recalcular = recalcular;
  canvas.redimensionar();

  document.addEventListener('mousedown', (e) => {
    if (e.target?.closest?.('.popup-propriedades')) return;

    if (canvas.elemento.contains(e.target)) {
      const rect = canvas.elemento.getBoundingClientRect();
      const mundo = canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
      const comp = componenteEm(estado.circuito, mundo.x, mundo.y);
      if (comp && (
        estado.popups[`comp:${comp.id}`]
        || estado.popups[`montagem:${comp.id}`]
      )) return;
    }

    fecharPopupsNaoFixados();
  });

  try {
    // Recupera autosave, se existir
    if (temAutosave()) {
      const dados = carregarLocal();
      if (dados) {
        const { circuito, view } = reconstruir(dados);
        estado.circuito = circuito;
        canvas.view.zoom = view.zoom;
        canvas.view.panX = view.panX;
        canvas.view.panY = view.panY;
      }
    }
  } catch (erro) {
    console.error('Erro ao recuperar autosave:', erro);
  }
  inicializar(estado.circuito);

  const fios = configurarFios(canvas, estado, renderizarTudo);
  const grupos = configurarGrupos(canvas, estado, renderizarTudo);
  estado.fioSelecionadoId = null;
  estado.fioFantasma = null;
  configurarInteracao(canvas, estado, renderizarTudo);

  document.getElementById('btn-simular').addEventListener('click', () => {
    if (estado.simulando) {
      // Parar + limpar
      pararSimulacao();
      limparResultados();
    } else {
      iniciarSimulacao();
    }
  });

  document.getElementById('btn-juntar').addEventListener('click', () => {
    const grupo = juntarSelecionados(estado.circuito, estado.selecionados);
    if (grupo) {
      estado.selecionados = [grupo.id];
      estado.grupoSelecionadoId = grupo.id;
      abrirPopupEntidade('area', grupo.id);
      renderizarTudo();
    }
  });

  const btnConstruir = document.getElementById('btn-construir');
  if (btnConstruir) {
    btnConstruir.addEventListener('click', () => {
      const resultado = analisarSelecaoParaConstruir(estado);
      if (!resultado.encontrado) {
        if (!resultado.sugestoes?.length) {
          mostrarToastConstruir('Nenhum circuito correspondente encontrado');
          return;
        }
      }
      estado.resultadoConstruir = resultado;
      if (canvas && typeof canvas.iniciarContornoConstruir === 'function') {
        canvas.iniciarContornoConstruir(resultado.componentes || obterComponentesSelecionados(estado));
      }
      abrirPopupEntidade('construir', 'modal');
    });
  }

  const btnExemplos = document.getElementById('btn-exemplos');
  if (btnExemplos) {
    btnExemplos.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown?.classList.add('oculto');
      abrirModalExemplos(estado, () => {
        renderizarTudo();
        atualizarBotoesHistorico();
      });
    });
  }

  const btnEstiloRealista = document.getElementById('btn-estilo-realista');
  if (btnEstiloRealista) {
    btnEstiloRealista.addEventListener('click', async (e) => {
      e.stopPropagation();
      menuDropdown?.classList.add('oculto');
      const ativo = btnEstiloRealista.getAttribute('aria-pressed') !== 'true';
      if (ativo) {
        btnEstiloRealista.disabled = true;
        try {
          await carregarArtesRealistas();
        } catch (erro) {
          console.error(erro);
          mostrarToastConstruir(erro.message);
          btnEstiloRealista.disabled = false;
          return;
        }
        btnEstiloRealista.disabled = false;
      }
      btnEstiloRealista.setAttribute('aria-pressed', String(ativo));
      btnEstiloRealista.classList.toggle('ativo', ativo);
      btnEstiloRealista.title = ativo ? 'Ativar design técnico' : 'Ativar design realista';
      btnEstiloRealista.setAttribute('aria-label', btnEstiloRealista.title);
      const circuloSuperior = btnEstiloRealista.querySelector(
        ativo ? '.icone-circulo-vazio' : '.icone-circulo-cheio'
      );
      btnEstiloRealista.querySelector('svg').appendChild(circuloSuperior);
      animarEstiloRealista(ativo);
    });
  }

  const btnMenu = document.getElementById('btn-menu');
  const menuDropdown = document.getElementById('menu-dropdown');

  btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('oculto');
  });

  // Fecha ao clicar fora
  document.addEventListener('click', () => {
    menuDropdown.classList.add('oculto');
  });

  // Impede que cliques dentro do menu o fechem antes do handler
  menuDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  if (btnRecolher && paletaWrap) {
    btnRecolher.addEventListener('click', (e) => {
      e.stopPropagation();
      const recolhida = paletaWrap.classList.toggle('recolhida');
      btnRecolher.title = recolhida ? 'Abrir painel' : 'Recolher painel';

      const offsetAnterior = estado.offsetOrigemX ?? (recolhida ? (paletaWrap.offsetWidth || 260) : 0);
      const offsetNovo = recolhida ? 0 : (paletaWrap.offsetWidth || 260);

      const delta = offsetNovo - offsetAnterior;
      if (canvas?.view) {
        canvas.view.panX -= delta;
      } else if (estado.view) {
        estado.view.panX -= delta;
      }

      estado.offsetOrigemX = offsetNovo;
      localStorage.setItem('paletaRecolhida', recolhida ? '1' : '0');
      renderizarTudo();
    });
  }

  document.getElementById('btn-comandos').addEventListener('click', () => {
    menuDropdown.classList.add('oculto');
    abrirPopupEntidade('comandos', 'lista');
  });

  document.getElementById('btn-salvar').addEventListener('click', () => {
    menuDropdown.classList.add('oculto');
    baixarArquivo(estado, 'circuito.json');
  });

  document.getElementById('btn-abrir').addEventListener('click', async () => {
    menuDropdown.classList.add('oculto');
    const resultado = await abrirArquivo();
    if (!resultado.ok) {
      alert(resultado.erro);
      return;
    }
    const { circuito, view } = reconstruir(resultado.dados);
    estado.circuito = circuito;
    estado.selecionados = [];
    estado.fioSelecionadoId = null;
    estado.grupoSelecionadoId = null;
    estado.resultado = null;
    if (canvas.view) {
      canvas.view.zoom = view.zoom;
      canvas.view.panX = view.panX;
      canvas.view.panY = view.panY;
    }
    limparHistorico();
    inicializar(estado.circuito);
    renderizarTudo();
  });

  document.getElementById('btn-exportar').addEventListener('click', () => {
    menuDropdown.classList.add('oculto');
    exportarPNG(estado.circuito, 'circuito.png');
  });

  document.getElementById('btn-desfazer').addEventListener('click', () => {
    const novo = desfazer(CATALOGO);
    if (novo) {
      estado.circuito = novo;
      estado.selecionados = [];
      estado.fioSelecionadoId = null;
      estado.grupoSelecionadoId = null;
      estado.resultado = null;
      renderizarTudo();
      atualizarBotoesHistorico();
    }
  });

  document.getElementById('btn-refazer').addEventListener('click', () => {
    const novo = refazer(CATALOGO);
    if (novo) {
      estado.circuito = novo;
      estado.selecionados = [];
      estado.fioSelecionadoId = null;
      estado.grupoSelecionadoId = null;
      estado.resultado = null;
      renderizarTudo();
      atualizarBotoesHistorico();
    }
  });

  let timerResize = null;

  window.addEventListener('resize', () => {
    canvas.redimensionar();
    renderizarTudo();

    clearTimeout(timerResize);
    timerResize = setTimeout(() => {
      const container = document.getElementById('popups-container');
      if (!container) return;

      const largura = container.clientWidth;
      const altura = container.clientHeight;
      let mudou = false;

      for (const cfg of Object.values(estado.popups)) {
        const maxX = Math.max(0, largura - 224);
        const maxY = Math.max(0, altura - 100);

        if (cfg.x > maxX) { cfg.x = maxX; mudou = true; }
        if (cfg.y > maxY) { cfg.y = maxY; mudou = true; }
        if (cfg.x < 0) { cfg.x = 0; mudou = true; }
        if (cfg.y < 0) { cfg.y = 0; mudou = true; }
      }

      if (mudou) renderizarPopups(true);
    }, 150);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName))) return;
    const tecla = e.key.toLowerCase();

    if (e.key === 'Escape') {
      if (estado.popups['construir']) {
        fecharPopupConstruir();
      }
    }
    if ((e.ctrlKey || e.metaKey) && tecla === 'c') {
      e.preventDefault();
      copiarSelecionados();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && tecla === 'v') {
      e.preventDefault();
      colar();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && tecla === 'd') {
      e.preventDefault();
      duplicarSelecionados();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && tecla === 's') {
      e.preventDefault();
      baixarArquivo(estado, 'circuito.json');
    }
    if ((e.ctrlKey || e.metaKey) && tecla === 'o') {
      e.preventDefault();
      document.getElementById('btn-abrir')?.click();
    }
    if ((e.ctrlKey || e.metaKey) && tecla === 'z' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('btn-desfazer')?.click();
    }
    if ((e.ctrlKey || e.metaKey) && (tecla === 'y' || (tecla === 'z' && e.shiftKey))) {
      e.preventDefault();
      document.getElementById('btn-refazer')?.click();
    }
    if ((e.ctrlKey || e.metaKey) && tecla === 'e') {
      e.preventDefault();
      exportarPNG(estado.circuito, 'circuito.png');
    }
  });

  canvas.redimensionar();
  try {
    renderizarTudo();
  } catch (erro) {
    console.error('Erro na inicialização:', erro);
    // Mesmo que algo falhe (ex.: autosave corrompido), garante que a grade e o canvas apareçam
    try {
      canvas.render(estado.circuito, [], null, null, null, null);
    } catch (_) {}
  }
}

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function filtrarPaleta(container, termo) {
  const busca = normalizar(termo.trim());

  container.querySelectorAll('.paleta-grupo').forEach((cat) => {
    const nomeCategoria = normalizar(
      cat.querySelector('.paleta-titulo')?.textContent || ''
    );
    const categoriaCorresponde = nomeCategoria.includes(busca);

    let algumVisivel = false;

    cat.querySelectorAll('.paleta-item').forEach((item) => {
      const nomeItem = normalizar(
        item.querySelector('.paleta-label')?.textContent || ''
      );

      const corresponde =
        busca === '' ||
        categoriaCorresponde ||
        nomeItem.includes(busca);

      item.classList.toggle('oculto', !corresponde);
      if (corresponde) algumVisivel = true;
    });

    // Esconde a categoria inteira se nada sobrou
    cat.classList.toggle('oculto', busca !== '' && !algumVisivel);
  });

  const nadaEncontrado =
    busca !== '' &&
    container.querySelectorAll('.paleta-item:not(.oculto)').length === 0;
  container.querySelector('.paleta-vazio')
    ?.classList.toggle('oculto', !nadaEncontrado);
}

function montarPaleta(container) {
  container.innerHTML = '';

  const busca = document.createElement('div');
  busca.className = 'paleta-busca';
  busca.innerHTML = `
    <input type="search" id="busca-componentes"
           placeholder="Buscar componente..."
           autocomplete="off">
  `;
  container.appendChild(busca);

  const vazio = document.createElement('p');
  vazio.className = 'paleta-vazio oculto';
  vazio.textContent = 'Nenhum componente encontrado';
  container.appendChild(vazio);

  busca.querySelector('input').addEventListener('input', (e) => {
    filtrarPaleta(container, e.target.value);
  });

  for (const categoria of CATEGORIAS) {
    const itens = itensDaCategoria(categoria);
    if (itens.length === 0) continue;

    const secao = document.createElement('section');
    secao.className = 'paleta-grupo';

    const titulo = document.createElement('h3');
    titulo.className = 'paleta-titulo';
    titulo.textContent = categoria;
    secao.appendChild(titulo);

    const grade = document.createElement('div');
    grade.className = 'paleta-grade';

    for (const item of itens) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'paleta-item';
      botao.draggable = true;
      botao.title = item.rotulo;

      const miniatura = document.createElement('canvas');
      miniatura.className = 'paleta-miniatura';
      miniatura.dataset.tipo = item.tipo;
      botao.appendChild(miniatura);

      const label = document.createElement('span');
      label.className = 'paleta-label';
      label.textContent = item.rotulo;
      botao.appendChild(label);

      requestAnimationFrame(() => desenharMiniatura(miniatura, item.tipo));

      botao.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-eletronica', item.tipo);
        e.dataTransfer.effectAllowed = 'copy';
      });

      botao.addEventListener('click', () => {
        const centro = canvas.telaParaMundo(
          canvas.elemento.getBoundingClientRect().width / 2,
          canvas.elemento.getBoundingClientRect().height / 2
        );
        const dim = obterDimensoesComponente(item.tipo);
        estado.adicionar(item.tipo, centro.x - dim.w / 2, centro.y - dim.h / 2);
      });

      grade.appendChild(botao);
    }

    secao.appendChild(grade);
    container.insertBefore(secao, vazio);
  }
}

function desenharMiniatura(canvasMini, tipo) {
  const ctx = canvasMini.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const largura = 64;
  const altura = 52;
  canvasMini.width = largura * dpr;
  canvasMini.height = altura * dpr;
  canvasMini.style.width = `${largura}px`;
  canvasMini.style.height = `${altura}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largura, altura);

  const propriedades = Object.fromEntries(
    Object.entries(CATALOGO[tipo]?.propriedades || {})
      .map(([chave, definicao]) => [chave, definicao.valor])
  );
  const dim = obterDimensoesComponente(tipo, propriedades);
  const escala = Math.min((largura - 20) / dim.w, (altura - 14) / dim.h);
  const compFake = {
    tipo,
    x: 0, y: 0,
    rotacao: 0,
    propriedades,
    pinos: obterPinosComponente(tipo, propriedades),
    dimensoes: dim,
  };

  const w = dim.w * escala;
  const h = dim.h * escala;
  const x = (largura - w) / 2;
  const y = (altura - h) / 2;
  desenharComponente(ctx, compFake, x, y, escala);
}

let timerToastConstruir = null;
function mostrarToastConstruir(texto = 'Nenhum circuito correspondente encontrado') {
  let toast = document.querySelector('.toast-construir');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast-construir';
    document.body.appendChild(toast);
  }
  toast.textContent = texto;
  toast.classList.add('visivel');
  if (timerToastConstruir) clearTimeout(timerToastConstruir);
  timerToastConstruir = setTimeout(() => {
    toast.classList.remove('visivel');
    timerToastConstruir = null;
  }, 2200);
}
estado.mostrarToast = mostrarToastConstruir;

function fecharPopupConstruir() {
  if (canvas && typeof canvas.pararContornoConstruir === 'function') {
    canvas.pararContornoConstruir();
  }
  delete estado.popups['construir'];
  if (estado.popupAtivo === 'construir') estado.popupAtivo = null;
  estado.resultadoConstruir = null;
  renderizarPopups(true);
}

function atualizarBotaoConstruir() {
  const btn = document.getElementById('btn-construir');
  if (!btn) return;
  const comps = (estado.selecionados || [])
    .map((id) => (estado.circuito?.componentes || []).find((c) => c.id === id))
    .filter((c) => c && c.tipo !== 'fio' && c.tipo !== 'grupo');
  btn.disabled = comps.length < 2;
}

function renderizarTudo() {
  if (!canvas) return;
  atualizarTodosBounds(estado.circuito);

  if (estado.resultadoConstruir) {
    const selIds = new Set(estado.selecionados || []);
    const compIds = (estado.resultadoConstruir.componentes || []).map((c) => c.id);
    const mesmaSelecao = compIds.length === selIds.size && compIds.every((id) => selIds.has(id));
    if (!mesmaSelecao) {
      fecharPopupConstruir();
    }
  }

  if (estado.simulando) {
    recalcular();
  } else {
    canvas.render(
      estado.circuito,
      estado.selecionados,
      estado.fioSelecionadoId,
      null,
      estado.fioFantasma,
      estado.selecaoRetangular,
      estado.grupoSelecionadoId
    );
  }
  renderizarPainel();
  agendarAutosave(estado);
  atualizarBotoesHistorico();
  atualizarBotaoConstruir();
}

let animacaoEstiloRealista = null;
function animarEstiloRealista(ativo) {
  if (animacaoEstiloRealista !== null) cancelAnimationFrame(animacaoEstiloRealista);
  const inicial = obterProgressoEstiloRealista();
  const alvo = ativo ? 1 : 0;
  const duracao = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320;
  let inicio = null;

  const atualizar = (agora) => {
    if (inicio === null) inicio = agora;
    const progresso = duracao === 0 ? 1 : Math.min(1, (agora - inicio) / duracao);
    const suavizado = progresso * progresso * (3 - 2 * progresso);
    definirProgressoEstiloRealista(inicial + (alvo - inicial) * suavizado);
    atualizarGeometriaEstilo(estado.circuito);

    if (canvas) {
      canvas.render(
        estado.circuito,
        estado.selecionados,
        estado.fioSelecionadoId,
        null,
        estado.fioFantasma,
        estado.selecaoRetangular,
        estado.grupoSelecionadoId
      );
    }
    document.querySelectorAll('.paleta-miniatura[data-tipo]').forEach((miniatura) => {
      desenharMiniatura(miniatura, miniatura.dataset.tipo);
    });

    if (progresso < 1) {
      animacaoEstiloRealista = requestAnimationFrame(atualizar);
    } else {
      animacaoEstiloRealista = null;
    }
  };

  animacaoEstiloRealista = requestAnimationFrame(atualizar);
}

function atualizarGeometriaEstilo(circuito) {
  for (const comp of circuito.componentes) {
    if (!ARTES_REALISTAS[comp.tipo]) continue;
    const dimensoesAtuais = comp.dimensoes || CATALOGO[comp.tipo].dimensoes;
    const dimensoesNovas = obterDimensoesComponente(comp.tipo, comp.propriedades);
    const centroX = comp.x + dimensoesAtuais.w / 2;
    const centroY = comp.y + dimensoesAtuais.h / 2;
    comp.x = centroX - dimensoesNovas.w / 2;
    comp.y = centroY - dimensoesNovas.h / 2;
    comp.dimensoes = dimensoesNovas;

    const pinosAtuais = comp.pinos || [];
    comp.pinos = obterPinosComponente(comp.tipo, comp.propriedades).map((pino) => ({
      ...pinosAtuais.find((atual) => atual.id === pino.id),
      ...pino,
    }));
  }
  atualizarTodosBounds(circuito);
}

let limpezasPopups = [];

function limparListenersPopups() {
  for (const limpar of limpezasPopups) {
    limpar();
  }
  limpezasPopups = [];
}

function atualizarSecaoSimulacaoNoCorpo(corpo, comp) {
  if (!corpo || !comp) return;
  const antigaSecao = corpo.querySelector('.painel-secao-simulacao');
  if (antigaSecao) antigaSecao.remove();
  const antigoAviso = corpo.querySelector('.painel-aviso');
  if (antigoAviso) antigoAviso.remove();

  if (estado.resultado) {
    const secao = document.createElement('div');
    secao.className = 'painel-secao painel-secao-simulacao';
    const titulo = document.createElement('h4');
    titulo.textContent = 'Simulação';
    secao.appendChild(titulo);

    const pino1 = comp.pinos[0];
    const pino2 = comp.pinos[1];
    const tensaoPino1 = tensaoEm(estado.resultado, comp.id, pino1?.id);
    const tensao = comp.pinos.length === 2 && pino2
      ? tensaoPino1 - tensaoEm(estado.resultado, comp.id, pino2.id)
      : tensaoPino1;
    const corrente = correnteEm(estado.resultado, comp.id);

    const linhaT = document.createElement('p');
    linhaT.className = 'painel-resultado';
    const rotuloTensao = comp.pinos.length === 2
      ? 'Tensão entre terminais'
      : `Tensão no pino ${pino1?.nome || pino1?.id || ''}`.trim();
    linhaT.textContent = `${rotuloTensao}: ${tensao.toFixed(3)} V`;
    secao.appendChild(linhaT);

    const linhaI = document.createElement('p');
    linhaI.className = 'painel-resultado';
    const mA = corrente * 1000;
    linhaI.textContent = `Corrente: ${Math.abs(mA) < 1 ? (corrente * 1e6).toFixed(1) + ' µA' : mA.toFixed(2) + ' mA'}`;
    secao.appendChild(linhaI);

    corpo.appendChild(secao);

    if (!estado.resultado.convergiu && estado.resultado.erro) {
      const aviso = document.createElement('div');
      aviso.className = 'painel-aviso';
      aviso.textContent = estado.resultado.erro;
      corpo.appendChild(aviso);
    }
  }
}

function montarPropriedades(corpo, comp) {
  montarPropriedadesComponente(corpo, comp, estado, renderizarTudo, abrirMontagem);
  atualizarSecaoSimulacaoNoCorpo(corpo, comp);
}

function obterEntidadePopup(tipo, id) {
  if (tipo === 'comandos') {
    return { id: 'comandos', nome: 'Lista de comandos' };
  }
  if (tipo === 'construir') {
    return estado.resultadoConstruir || { id: 'construir', nome: 'Construir' };
  }
  if (tipo === 'montagem') {
    const comp = estado.circuito.componentes.find((c) => c.id === id);
    if (!comp) return null;
    return { id, comp, montagem: gerarMontagem(comp) };
  }
  if (tipo === 'comp') {
    return estado.circuito.componentes.find((c) => c.id === id) || null;
  }
  if (tipo === 'fio') {
    return estado.circuito.fios.find((f) => f.id === id) || null;
  }
  if (tipo === 'area') {
    const listaAreas = estado.circuito.areas || estado.circuito.grupos || [];
    return listaAreas.find((a) => a.id === id) || null;
  }
  return null;
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function obterTituloPopup(tipo, entidade) {
  if (tipo === 'comandos') return 'Lista de comandos';
  if (tipo === 'construir') return 'Construir';
  if (tipo === 'montagem') return 'Montagem';
  if (tipo === 'comp') {
    return entidade.nomeCustom
      ? `${entidade.nomeCustom} (${entidade.tipo})`
      : entidade.tipo;
  }
  if (tipo === 'fio') return 'FIO';
  if (tipo === 'area') return entidade.nome || 'ÁREA';
  return '';
}

function montarCorpoPopup(corpo, tipo, id) {
  if (tipo === 'comandos') {
    montarListaComandos(corpo);
  } else if (tipo === 'construir') {
    montarCorpoConstruir(
      corpo,
      estado.resultadoConstruir,
      estado,
      () => {
        fecharPopupConstruir();
        renderizarTudo();
      },
      () => {
        fecharPopupConstruir();
      }
    );
  } else if (tipo === 'montagem') {
    const comp = estado.circuito.componentes.find((c) => c.id === id);
    if (comp) {
      const montagem = gerarMontagem(comp);
      montarCorpoMontagem(
        corpo,
        montagem,
        estado,
        () => {
          delete estado.popups[`montagem:${id}`];
          delete estado.popups[`comp:${id}`];
          if (estado.popupAtivo === `montagem:${id}` || estado.popupAtivo === `comp:${id}`) {
            estado.popupAtivo = null;
          }
          renderizarTudo();
        },
        () => {
          delete estado.popups[`montagem:${id}`];
          if (estado.popupAtivo === `montagem:${id}`) estado.popupAtivo = null;
          renderizarPopups(true);
        }
      );
    }
  } else if (tipo === 'comp') {
    const comp = estado.circuito.componentes.find((c) => c.id === id);
    if (comp) montarPropriedades(corpo, comp);
  } else if (tipo === 'fio') {
    const fio = estado.circuito.fios.find((f) => f.id === id);
    if (fio) montarPropriedadesFio(corpo, fio, estado, renderizarTudo);
  } else if (tipo === 'area') {
    const listaAreas = estado.circuito.areas || estado.circuito.grupos || [];
    const area = listaAreas.find((a) => a.id === id);
    if (area) montarPropriedadesArea(corpo, area, estado, renderizarTudo);
  }
}

function removerPopupsTransitorios(exceto = []) {
  const manter = new Set(exceto);
  let fechou = false;
  for (const [chave, cfg] of Object.entries(estado.popups || {})) {
    if (!cfg.fixado && !manter.has(chave)) {
      delete estado.popups[chave];
      fechou = true;
    }
  }
  if (estado.popupAtivo && !estado.popups[estado.popupAtivo]) {
    estado.popupAtivo = null;
    fechou = true;
  }
  return fechou;
}

function fecharPopupsNaoFixados() {
  const fechou = removerPopupsTransitorios();
  if (fechou) {
    renderizarPopups(true);
  }
  return fechou;
}

function calcularPosicaoPadrao(container) {
  const largura = container ? container.clientWidth : 800;
  const altura = container ? container.clientHeight : 600;
  const LARGURA_POPUP = 224;
  const MARGEM = 12;
  const PASSO_CASCATA = 24;

  let x = Math.max(MARGEM, largura - LARGURA_POPUP - MARGEM);
  let y = MARGEM;

  // Desloca em cascata enquanto houver popup na posição
  let tentativas = 0;
  while (tentativas < 10) {
    const ocupado = Object.values(estado.popups).some(
      (p) => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 8
    );
    if (!ocupado) break;
    x = Math.max(MARGEM, x - PASSO_CASCATA);
    y = y + PASSO_CASCATA;
    tentativas++;
  }

  // Garante que não saia do container
  x = Math.max(MARGEM, Math.min(x, largura - LARGURA_POPUP - MARGEM));
  y = Math.max(MARGEM, Math.min(y, altura - 100));

  return { x, y };
}

function abrirPopupEntidade(tipo, id) {
  const chave = (tipo === 'comandos' || tipo === 'construir') ? tipo : `${tipo}:${id}`;

  if (tipo === 'montagem') {
    const chaveMontagem = `montagem:${id}`;
    const chaveComp = `comp:${id}`;
    removerPopupsTransitorios([chaveMontagem, chaveComp]);
    if (estado.popups[chaveMontagem]) {
      estado.zIndexPopup += 1;
      estado.popups[chaveMontagem].zIndex = estado.zIndexPopup;
      estado.popupAtivo = chaveMontagem;
      renderizarPopups(true);
      return;
    }
    const container = document.getElementById('popups-container');
    const popupComp = estado.popups[chaveComp];

    let x, y;
    const LARGURA_POPUP = 540;
    const MARGEM = 12;

    if (popupComp) {
      const contWidth = container ? container.clientWidth : 800;
      if (popupComp.x - LARGURA_POPUP - MARGEM >= MARGEM) {
        x = popupComp.x - LARGURA_POPUP - MARGEM;
      } else if (popupComp.x + 224 + MARGEM + LARGURA_POPUP <= contWidth) {
        x = popupComp.x + 224 + MARGEM;
      } else {
        x = Math.max(MARGEM, Math.min(contWidth - LARGURA_POPUP - MARGEM, popupComp.x + 24));
      }
      y = Math.max(MARGEM, popupComp.y);
    } else {
      const pos = calcularPosicaoPadrao(container);
      x = pos.x;
      y = pos.y;
    }

    estado.popups[chaveMontagem] = {
      fixado: false,
      minimizado: false,
      semAlfinete: false,
      x,
      y,
      zIndex: ++estado.zIndexPopup,
    };
    estado.popupAtivo = chaveMontagem;
    renderizarPopups(true);
    return;
  }

  if (tipo === 'comandos' || tipo === 'construir') {
    if (estado.popups[chave]) {
      estado.zIndexPopup += 1;
      estado.popups[chave].zIndex = estado.zIndexPopup;
      estado.popupAtivo = chave;
      renderizarPopups(true);
      return;
    }
    const container = document.getElementById('popups-container');
    const pos = calcularPosicaoPadrao(container);
    estado.popups[chave] = {
      fixado: true,
      minimizado: false,
      semAlfinete: true,
      x: pos.x,
      y: pos.y,
    };
    estado.popupAtivo = chave;
    renderizarPopups(true);
    return;
  }

  const relacionados = tipo === 'comp' ? [chave, `montagem:${id}`] : [chave];
  removerPopupsTransitorios(relacionados);

  // 2. Se a entidade já tem popup fixado, não cria outro
  if (estado.popups[chave]?.fixado) {
    estado.zIndexPopup += 1;
    estado.popups[chave].zIndex = estado.zIndexPopup;
    estado.popupAtivo = chave;
    renderizarPopups(true);
    return;
  }

  // 3. Cria o popup no canto superior direito (ou em cascata se ocupado)
  if (!estado.popups[chave]) {
    const container = document.getElementById('popups-container');
    const pos = calcularPosicaoPadrao(container);
    estado.popups[chave] = {
      fixado: false,
      minimizado: false,
      x: pos.x,
      y: pos.y,
    };
  }

  estado.popupAtivo = chave;
  renderizarPopups(true);
}

function abrirPopupComponente(compId) {
  abrirPopupEntidade('comp', compId);
}

function iniciarEdicaoTitulo(tituloEl) {
  if (tituloEl.dataset.editando === '1') return;

  const id = tituloEl.dataset.id;
  const tipo = tituloEl.dataset.tipo || 'componente';
  const ehGrupo = tipo === 'grupo' || tipo === 'area';

  const listaAreas = estado.circuito.areas || estado.circuito.grupos || [];
  const entidade = ehGrupo
    ? listaAreas.find((g) => g.id === id)
    : estado.circuito.componentes.find((c) => c.id === id);

  if (!entidade) return;

  tituloEl.dataset.editando = '1';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'popup-titulo-input';
  input.maxLength = 15;
  input.value = ehGrupo ? (entidade.nome || '') : (entidade.nomeCustom || '');
  input.placeholder = 'Nome (máx. 15)';

  tituloEl.replaceWith(input);
  input.focus();
  input.select();

  let finalizado = false;

  function finalizar(salvar) {
    if (finalizado) return;
    finalizado = true;

    if (salvar) {
      const nome = input.value.trim().slice(0, 15);
      if (ehGrupo) {
        entidade.nome = nome || 'Novo grupo';
      } else {
        if (nome) {
          entidade.nomeCustom = nome;
        } else {
          delete entidade.nomeCustom;
        }
      }
      registrar(estado.circuito, 'propriedade', true);
    }

    const novoTitulo = document.createElement('span');
    novoTitulo.className = 'popup-titulo popup-titulo-editavel';
    novoTitulo.dataset.id = id;
    novoTitulo.dataset.tipo = tipo;
    novoTitulo.title = 'Clique duas vezes para renomear';
    novoTitulo.innerHTML = `
      ${escaparHtml(obterTituloPopup(ehGrupo ? 'area' : 'comp', entidade))}
      <svg class="popup-titulo-lapis" viewBox="0 0 24 24"
           width="11" height="11" aria-hidden="true">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    `;

    input.replaceWith(novoTitulo);

    novoTitulo.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      iniciarEdicaoTitulo(novoTitulo);
    });

    renderizarTudo();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finalizar(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finalizar(false);
    }
    e.stopPropagation();
  });

  input.addEventListener('blur', () => finalizar(true));
  input.addEventListener('mousedown', (e) => e.stopPropagation());
}

function ligarEventosPopup(el, chave) {
  const cfg = estado.popups[chave];
  if (!cfg) return;
  const btnAlfinete = el.querySelector('.popup-alfinete');
  const btnMinimizar = el.querySelector('.popup-minimizar');
  const btnFechar = el.querySelector('.popup-fechar');
  const cabecalho = el.querySelector('.popup-cabecalho');

  const tituloEl = el.querySelector('.popup-titulo-editavel');
  tituloEl?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    iniciarEdicaoTitulo(tituloEl);
  });

  el.addEventListener('mousedown', () => {
    estado.zIndexPopup += 1;
    cfg.zIndex = estado.zIndexPopup;
    el.style.zIndex = estado.zIndexPopup;
  });

  // Alfinete
  if (btnAlfinete) {
    btnAlfinete.addEventListener('click', (e) => {
      e.stopPropagation();
      cfg.fixado = !cfg.fixado;
      renderizarPopups(true);
    });
  }

  // Minimizar / expandir (atualiza classe e ícone preservando o estado do DOM interno)
  btnMinimizar.addEventListener('click', (e) => {
    e.stopPropagation();
    cfg.minimizado = !cfg.minimizado;
    el.className = 'popup-propriedades' + (cfg.minimizado ? ' minimizado' : '');
    btnMinimizar.title = cfg.minimizado ? 'Expandir' : 'Minimizar';
    btnMinimizar.innerHTML = cfg.minimizado
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9l6 6 6-6z"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 15l6-6 6 6z"/></svg>';
  });

  // Fechar
  btnFechar.addEventListener('click', (e) => {
    e.stopPropagation();
    if (chave === 'construir') {
      fecharPopupConstruir();
      return;
    }
    delete estado.popups[chave];
    if (estado.popupAtivo === chave) estado.popupAtivo = null;
    renderizarPopups(true);
  });

  // Arrasto pelo cabeçalho
  let arrastando = false;
  let offsetX = 0;
  let offsetY = 0;

  cabecalho.addEventListener('mousedown', (e) => {
    if (e.target.closest('.popup-alfinete, .popup-minimizar, .popup-fechar, .popup-titulo-input')) return;
    arrastando = true;
    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  function mover(e) {
    if (!arrastando || !el.parentElement) return;
    const contRect = el.parentElement.getBoundingClientRect();
    let nx = e.clientX - contRect.left - offsetX;
    let ny = e.clientY - contRect.top - offsetY;

    // Limita ao espaço do container
    const maxX = Math.max(0, contRect.width - el.offsetWidth);
    const maxY = Math.max(0, contRect.height - el.offsetHeight);
    nx = Math.max(0, Math.min(nx, maxX));
    ny = Math.max(0, Math.min(ny, maxY));

    cfg.x = nx;
    cfg.y = ny;
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
  }

  function soltar() {
    arrastando = false;
  }

  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);

  limpezasPopups.push(() => {
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup', soltar);
  });
}

function extrairTipoEId(chave) {
  if (chave === 'comandos') return { tipo: 'comandos', id: 'lista' };
  if (chave === 'construir') return { tipo: 'construir', id: 'modal' };
  if (chave.startsWith('montagem:')) return { tipo: 'montagem', id: chave.slice(9) };
  const idx = chave.indexOf(':');
  if (idx === -1) return { tipo: 'comp', id: chave };
  return {
    tipo: chave.slice(0, idx),
    id: chave.slice(idx + 1),
  };
}

function renderizarPopups(forcar = false) {
  const container = document.getElementById('popups-container');
  if (!container) return;

  // Se o usuário estiver digitando num input dentro de um popup, não destrói o DOM em foco
  const ativo = document.activeElement;
  if (
    !forcar &&
    ativo &&
    container.contains(ativo) &&
    ativo.tagName === 'INPUT' &&
    (ativo.type === 'number' || ativo.type === 'text')
  ) {
    atualizarSecaoSimulacaoPainel();
    return;
  }

  limparListenersPopups();
  container.innerHTML = '';

  for (const [chave, cfg] of Object.entries(estado.popups)) {
    const { tipo, id } = extrairTipoEId(chave);
    const entidade = obterEntidadePopup(tipo, id);
    if (!entidade) {
      delete estado.popups[chave];
      continue;
    }

    const ehGrupo = tipo === 'area' || tipo === 'grupo';
    const ehMontagem = tipo === 'montagem';
    const ehComandos = tipo === 'comandos';
    const el = document.createElement('div');
    el.className =
      'popup-propriedades' +
      (ehGrupo ? ' popup-grupo' : '') +
      (ehMontagem ? ' popup-montagem-largo' : '') +
      (ehComandos ? ' popup-comandos' : '') +
      (cfg.minimizado ? ' minimizado' : '');
    el.style.left = cfg.x + 'px';
    el.style.top = cfg.y + 'px';
    if (!cfg.zIndex) {
      estado.zIndexPopup += 1;
      cfg.zIndex = estado.zIndexPopup;
    }
    el.style.zIndex = cfg.zIndex;
    el.dataset.popupKey = chave;
    if (tipo === 'comp') el.dataset.compId = id;
    if (ehGrupo) el.dataset.grupoId = id;

    const tituloPopup = obterTituloPopup(tipo, entidade);
    let tituloHtml = `<span class="popup-titulo">${escaparHtml(tituloPopup)}</span>`;
    const lapisSvg = `
      <svg class="popup-titulo-lapis" viewBox="0 0 24 24"
           width="11" height="11" aria-hidden="true">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71
                 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41
                 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    `;

    if (tipo === 'comandos') {
      tituloHtml = `<span class="popup-titulo">Comandos</span>`;
    } else if (tipo === 'construir') {
      tituloHtml = `<span class="popup-titulo">Construir</span>`;
    } else if (tipo === 'montagem') {
      tituloHtml = `<span class="popup-titulo">Montagem</span>`;
    } else if (tipo === 'comp') {
      tituloHtml = `
        <span class="popup-titulo popup-titulo-editavel"
              data-id="${id}"
              data-tipo="componente"
              title="Clique duas vezes para renomear">
          ${escaparHtml(tituloPopup)}
          ${lapisSvg}
        </span>
      `;
    } else if (ehGrupo) {
      tituloHtml = `
        <span class="popup-titulo popup-titulo-editavel"
              data-id="${id}"
              data-tipo="grupo"
              title="Clique duas vezes para renomear">
          ${escaparHtml(tituloPopup)}
          ${lapisSvg}
        </span>
      `;
    }

    const botaoAlfinete = cfg.semAlfinete
      ? ''
      : `
        <button type="button" class="popup-alfinete ${cfg.fixado ? 'ativo' : ''}"
                title="${cfg.fixado ? 'Desafixar' : 'Fixar'}">
          <svg width="21" height="21" viewBox="0 0 24 24"
               fill="${cfg.fixado ? 'currentColor' : 'none'}"
               stroke="currentColor" stroke-width="2">
            <path d="M12 17v5"/>
            <path d="M9 10.76V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5.76
                     l2 3.24H7l2-3.24Z"/>
          </svg>
        </button>
      `;

    el.innerHTML = `
      <div class="popup-cabecalho">
        ${botaoAlfinete}
        ${tituloHtml}
        <button type="button" class="popup-minimizar" title="${cfg.minimizado ? 'Expandir' : 'Minimizar'}">
          ${cfg.minimizado
            ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9l6 6 6-6z"/></svg>'
            : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 15l6-6 6 6z"/></svg>'}
        </button>
        <button type="button" class="popup-fechar" title="Fechar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="popup-corpo"></div>
    `;

    const corpo = el.querySelector('.popup-corpo');
    montarCorpoPopup(corpo, tipo, id);

    container.appendChild(el);
    ligarEventosPopup(el, chave);
  }
}

function atualizarSecaoSimulacaoPainel() {
  const container = document.getElementById('popups-container');
  if (!container) return;
  for (const el of container.querySelectorAll('.popup-propriedades')) {
    const compId = el.dataset.compId;
    const comp = estado.circuito.componentes.find((c) => c.id === compId);
    const corpo = el.querySelector('.popup-corpo');
    if (comp && corpo) {
      atualizarSecaoSimulacaoNoCorpo(corpo, comp);
    }
  }
}

function renderizarPainel(forcar = false) {
  renderizarPopups(forcar);
}

function abrirMontagem(comp) {
  if (!comp) return;
  abrirPopupEntidade('montagem', comp.id);
}

montarInterface();
