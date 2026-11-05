/**
 * app.js — Orquestrador da aplicação de eletrônica.
 * Monta a interface, paleta, canvas e painel.
 */

import { CATALOGO, CATEGORIAS, itensDaCategoria } from './catalogo.js';
import { criarCircuito, adicionarComponente, removerComponente } from './circuito.js';
import { criarCanvas } from './canvas.js';
import { configurarInteracao } from './selecao.js';
import { configurarFios, removerFio } from './fios.js';
import {
  renderizarPainel as renderizarPainelNovo,
  montarPropriedadesComponente,
  montarPropriedadesFio,
  montarPropriedadesArea,
} from './painel.js';
import { simular, tensaoEm, correnteEm } from './solver.js';
import { obterMontagem, desenharMontagem } from './montagens.js';
import { desenharComponente } from './simbolos.js';
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
    if (estado.simulando) {
      pararSimulacao();
    }
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

function pararSimulacao() {
  estado.simulando = false;
  estado.resultado = null;

  // Limpa o estado de todos os componentes
  for (const comp of estado.circuito.componentes) {
    comp.estado = {};
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

  if (estado.resultado?.queimouFusivel) {
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
    const def = CATALOGO[c.tipo];
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
      pinos: def.pinos.map((p) => ({ ...p })),
      dimensoes: { ...def.dimensoes },
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
    const def = CATALOGO[c.tipo];
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
      pinos: def.pinos.map((p) => ({ ...p })),
      dimensoes: { ...def.dimensoes },
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
      <header class="eletronica-toolbar">
        <h1>Arandua</h1>
        <button type="button" class="btn-simular" id="btn-simular">Simular</button>
        <button type="button" class="btn-juntar" id="btn-juntar">Juntar</button>
        <button type="button" class="btn-toolbar" id="btn-desfazer" title="Desfazer (Ctrl+Z)">↶</button>
        <button type="button" class="btn-toolbar" id="btn-refazer" title="Refazer (Ctrl+Y)">↷</button>
        <div class="menu-container">
          <button type="button" id="btn-menu" class="btn-icone" title="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div id="menu-dropdown" class="menu-dropdown oculto">
            <button type="button" id="btn-salvar">Salvar</button>
            <button type="button" id="btn-abrir">Abrir</button>
            <button type="button" id="btn-exportar">PNG</button>
          </div>
        </div>
      </header>
      <aside class="eletronica-paleta" id="paleta"></aside>
      <div id="area-simulacao" class="eletronica-canvas eletronica-canvas-wrap">
        <canvas id="canvas"></canvas>
        <div id="popups-container" class="popups-container"></div>
      </div>
    </div>
  `;

  montarPaleta(document.getElementById('paleta'));
  elPainel = document.getElementById('popups-container');
  canvas = criarCanvas(document.getElementById('canvas'), estado);
  estado.view = canvas.view;
  canvas.redimensionar();

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

  window.addEventListener('resize', () => {
    canvas.redimensionar();
    renderizarTudo();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName))) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      copiarSelecionados();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      colar();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      duplicarSelecionados();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      baixarArquivo(estado, 'circuito.json');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      document.getElementById('btn-abrir')?.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('btn-desfazer')?.click();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      document.getElementById('btn-refazer')?.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      exportarPNG(estado.circuito, 'circuito.png');
    }
  });

  const legenda = document.createElement('div');
  legenda.className = 'legenda-atalhos';
  legenda.innerHTML = `
    <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> desfazer</span>
    <span><kbd>Ctrl</kbd>+<kbd>Y</kbd> refazer</span>
    <span><kbd>Ctrl</kbd>+<kbd>S</kbd> salvar</span>
    <span><kbd>Ctrl</kbd>+<kbd>O</kbd> abrir</span>
    <span><kbd>Tab</kbd> dobra do fio</span>
    <span><kbd>Del</kbd> remover</span>
  `;
  canvas.elemento.parentElement.appendChild(legenda);

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

function montarPaleta(container) {
  container.innerHTML = '';

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
        const dim = CATALOGO[item.tipo].dimensoes;
        estado.adicionar(item.tipo, centro.x - dim.w / 2, centro.y - dim.h / 2);
      });

      grade.appendChild(botao);
    }

    secao.appendChild(grade);
    container.appendChild(secao);
  }
}

async function desenharMiniatura(canvasMini, tipo) {
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

  const dim = CATALOGO[tipo].dimensoes;
  const escala = Math.min((largura - 20) / dim.w, (altura - 14) / dim.h);
  const compFake = {
    tipo,
    x: 0, y: 0,
    rotacao: 0,
    propriedades: {},
    pinos: CATALOGO[tipo].pinos.map((p) => ({ ...p })),
    dimensoes: dim,
  };

  const w = dim.w * escala;
  const h = dim.h * escala;
  const x = (largura - w) / 2;
  const y = (altura - h) / 2;
  desenharComponente(ctx, compFake, x, y, escala);
}

function renderizarTudo() {
  if (!canvas) return;
  atualizarTodosBounds(estado.circuito);
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

    const tensao = tensaoEm(estado.resultado, comp.id, comp.pinos[0]?.id);
    const corrente = correnteEm(estado.resultado, comp.id);

    const linhaT = document.createElement('p');
    linhaT.className = 'painel-resultado';
    linhaT.textContent = `Tensão: ${tensao.toFixed(3)} V`;
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

function obterTituloPopup(tipo, entidade) {
  if (tipo === 'comp') return entidade.tipo;
  if (tipo === 'fio') return 'FIO';
  if (tipo === 'area') return entidade.nome || 'ÁREA';
  return '';
}

function montarCorpoPopup(corpo, tipo, id) {
  if (tipo === 'comp') {
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

function calcularPosicaoPadrao(container) {
  const largura = container ? container.clientWidth : 800;
  const altura = container ? container.clientHeight : 600;
  const LARGURA_POPUP = 260;
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
  const chave = `${tipo}:${id}`;

  // 1. Se o popup anterior não está fixado, remove
  if (estado.popupAtivo && estado.popupAtivo !== chave) {
    const anterior = estado.popups[estado.popupAtivo];
    if (!anterior || !anterior.fixado) {
      delete estado.popups[estado.popupAtivo];
    }
  }

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

function ligarEventosPopup(el, chave) {
  const cfg = estado.popups[chave];
  if (!cfg) return;
  const btnAlfinete = el.querySelector('.popup-alfinete');
  const cabecalho = el.querySelector('.popup-cabecalho');

  el.addEventListener('mousedown', () => {
    estado.zIndexPopup += 1;
    cfg.zIndex = estado.zIndexPopup;
    el.style.zIndex = estado.zIndexPopup;
  });

  // Alfinete
  btnAlfinete.addEventListener('click', (e) => {
    e.stopPropagation();
    cfg.fixado = !cfg.fixado;
    renderizarPopups(true);
  });

  // Arrasto pelo cabeçalho
  let arrastando = false;
  let offsetX = 0;
  let offsetY = 0;

  cabecalho.addEventListener('mousedown', (e) => {
    if (e.target.closest('.popup-alfinete')) return;
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

    const el = document.createElement('div');
    el.className = 'popup-propriedades';
    el.style.left = cfg.x + 'px';
    el.style.top = cfg.y + 'px';
    if (!cfg.zIndex) {
      estado.zIndexPopup += 1;
      cfg.zIndex = estado.zIndexPopup;
    }
    el.style.zIndex = cfg.zIndex;
    el.dataset.popupKey = chave;
    if (tipo === 'comp') el.dataset.compId = id;

    const tituloPopup = obterTituloPopup(tipo, entidade);

    el.innerHTML = `
      <div class="popup-cabecalho">
        <button type="button" class="popup-alfinete ${cfg.fixado ? 'ativo' : ''}"
                title="${cfg.fixado ? 'Desafixar' : 'Fixar'}">
          <svg width="14" height="14" viewBox="0 0 24 24"
               fill="${cfg.fixado ? 'currentColor' : 'none'}"
               stroke="currentColor" stroke-width="2">
            <path d="M12 17v5"/>
            <path d="M9 10.76V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5.76
                     l2 3.24H7l2-3.24Z"/>
          </svg>
        </button>
        <span class="popup-titulo">${tituloPopup}</span>
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
  const montagem = obterMontagem(comp.tipo);
  if (!montagem) {
    alert('Este componente não tem montagem interna disponível.');
    return;
  }

  // Cria o modal
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-montagem';

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titulo = document.createElement('h2');
  titulo.textContent = montagem.titulo;
  header.appendChild(titulo);

  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.className = 'modal-fechar';
  fechar.textContent = '×';
  fechar.setAttribute('aria-label', 'Fechar');
  fechar.addEventListener('click', () => overlay.remove());
  header.appendChild(fechar);

  modal.appendChild(header);

  const descricao = document.createElement('p');
  descricao.className = 'modal-descricao';
  descricao.textContent = montagem.descricao;
  modal.appendChild(descricao);

  const canvasMontagem = document.createElement('canvas');
  canvasMontagem.className = 'modal-canvas';
  canvasMontagem.width = 800;
  canvasMontagem.height = 500;
  canvasMontagem.style.width = '100%';
  canvasMontagem.style.maxWidth = '800px';
  canvasMontagem.style.height = 'auto';
  modal.appendChild(canvasMontagem);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Desenha a montagem
  const ctx = canvasMontagem.getContext('2d');
  desenharMontagem(ctx, montagem, desenharComponente, CATALOGO);

  // Fecha ao clicar fora
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Fecha com Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      window.removeEventListener('keydown', escHandler);
    }
  };
  window.addEventListener('keydown', escHandler);
}

montarInterface();
