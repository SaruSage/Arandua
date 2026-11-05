/**
 * grupos.js — Agrupamento visual de componentes.
 *
 * Comportamento:
 * - Arrastar com botão direito cria uma seleção retangular
 * - Componentes dentro do retângulo ficam selecionados
 * - Botão "Juntar" cria um grupo com contorno tracejado e nome editável
 * - Selecionar dois ou mais grupos e clicar "Juntar" cria um grupo maior
 * - Grupos podem ser renomeados clicando no nome
 * - Grupos podem ser desfeitos (mantendo os componentes)
 */

import { CATALOGO } from './catalogo.js';
import { registrar } from './historico.js';
import { CORES } from './simbolos.js';

export const CORES_GRUPO = [
  '#53b588', '#3a8fe8', '#8a4ae8', '#e84a9e', '#e05a5a',
  '#e88a3a', '#e8c33a', '#8fbf3a', '#3ab8b8', '#8a5a3a',
];

/* ===== CRIAÇÃO E MANIPULAÇÃO ===== */

/**
 * Cria um grupo a partir de uma lista de ids de componentes ou grupos.
 * Calcula o retângulo delimitador automaticamente.
 */
export function criarGrupo(circuito, membros, nome = 'Novo grupo') {
  if (membros.length === 0) return null;

  const bounds = calcularBounds(circuito, membros);
  if (!bounds) return null;

  const cor = CORES_GRUPO[circuito.grupos.length % CORES_GRUPO.length];

  const geometria = {
    x: bounds.x - 16,
    y: bounds.y - 40,
    w: bounds.w + 32,
    h: bounds.h + 56,
  };
  const grupo = {
    id: `grupo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nome,
    membros: [...membros],
    cor,
    ...geometria,
    vertices: null,
    bounds: { ...geometria },
    nomeEditando: false,
  };

  circuito.grupos.push(grupo);
  return grupo;
}

/** Calcula o retângulo delimitador de um conjunto de membros. */
export function calcularBounds(circuito, membros) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let encontrou = false;

  for (const id of membros) {
    // Componente?
    const comp = circuito.componentes.find((c) => c.id === id);
    if (comp) {
      const dim = CATALOGO[comp.tipo].dimensoes;
      minX = Math.min(minX, comp.x);
      minY = Math.min(minY, comp.y);
      maxX = Math.max(maxX, comp.x + dim.w);
      maxY = Math.max(maxY, comp.y + dim.h);
      encontrou = true;
      continue;
    }

    // Grupo?
    const grupo = circuito.grupos.find((g) => g.id === id);
    if (grupo) {
      const b = grupo.bounds || grupo;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
      encontrou = true;
      }
      }

  if (!encontrou) return null;

  const margem = 16;
  return {
    x: minX - margem,
    y: minY - margem - 20,
    w: maxX - minX + margem * 2,
    h: maxY - minY + margem * 2 + 20,
  };
}

function geometria(grupo) {
  const bounds = grupo.bounds || {};
  return {
    x: grupo.x ?? bounds.x ?? 0,
    y: grupo.y ?? bounds.y ?? 0,
    w: grupo.w ?? bounds.w ?? 0,
    h: grupo.h ?? bounds.h ?? 0,
  };
}

function sincronizarBounds(grupo) {
  grupo.bounds = { x: grupo.x, y: grupo.y, w: grupo.w, h: grupo.h };
}

function atualizarGeometriaBase(grupo) {
  const vertices = grupo.vertices || cantosDoGrupo(grupo);
  const xs = vertices.map((ponto) => ponto.x);
  const ys = vertices.map((ponto) => ponto.y);
  grupo.x = Math.min(...xs);
  grupo.y = Math.min(...ys);
  grupo.w = Math.max(...xs) - grupo.x;
  grupo.h = Math.max(...ys) - grupo.y;
  sincronizarBounds(grupo);
}

function moverGeometria(grupo, dx, dy) {
  const b = geometria(grupo);
  grupo.x = b.x + dx;
  grupo.y = b.y + dy;
  if (grupo.vertices) {
    grupo.vertices = grupo.vertices.map((ponto) => ({ x: ponto.x + dx, y: ponto.y + dy }));
  }
  sincronizarBounds(grupo);
}

/** Retorna os cantos do grupo, incluindo contornos subdivididos. */
export function cantosDoGrupo(grupo) {
  if (grupo.vertices) return grupo.vertices;
  const b = geometria(grupo);
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
}

/** Retorna os pontos médios das arestas do contorno. */
export function pontosMedios(grupo) {
  const cantos = cantosDoGrupo(grupo);
  return cantos.map((ponto, indice) => {
    const proximo = cantos[(indice + 1) % cantos.length];
    return {
      x: (ponto.x + proximo.x) / 2,
      y: (ponto.y + proximo.y) / 2,
      aresta: indice,
    };
  });
}

/** Retorna a aresta mais próxima quando o ponto está sobre o contorno. */
export function noContorno(grupo, x, y, tolerancia = 8) {
  const cantos = cantosDoGrupo(grupo);
  for (let indice = 0; indice < cantos.length; indice++) {
    const a = cantos[indice];
    const b = cantos[(indice + 1) % cantos.length];
    const distancia = distanciaPontoSegmento(x, y, a.x, a.y, b.x, b.y);
    if (distancia < tolerancia) return { aresta: indice, distancia };
  }
  return null;
}

function distanciaPontoSegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Retorna o índice do canto mais próximo ou -1. */
export function noCanto(grupo, x, y, tolerancia = 10) {
  const cantos = cantosDoGrupo(grupo);
  for (let indice = 0; indice < cantos.length; indice++) {
    if (Math.hypot(x - cantos[indice].x, y - cantos[indice].y) < tolerancia) return indice;
  }
  return -1;
}

/** Verifica se o ponto está sobre a caixa do nome do grupo. */
export function noNome(grupo, x, y) {
  const b = geometria(grupo);
  const largura = Math.max(70, grupo.nome.length * 7 + 16);
  return x >= b.x && x <= b.x + largura && y >= b.y - 22 && y <= b.y;
}

function pontoDentroDoGrupo(grupo, x, y) {
  const cantos = cantosDoGrupo(grupo);
  let dentro = false;
  for (let i = 0, j = cantos.length - 1; i < cantos.length; j = i++) {
    const a = cantos[i];
    const b = cantos[j];
    const cruza = ((a.y > y) !== (b.y > y)) &&
      (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Insere um novo vértice no ponto médio de uma aresta. */
export function subdividirAresta(grupo, aresta) {
  const cantos = cantosDoGrupo(grupo);
  const a = cantos[aresta];
  const b = cantos[(aresta + 1) % cantos.length];
  if (!a || !b) return;
  const vertices = [...cantos];
  vertices.splice(aresta + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  grupo.vertices = vertices;
  atualizarGeometriaBase(grupo);
}

/** Move um vértice do contorno. */
export function moverVertice(grupo, indice, x, y) {
  if (!grupo.vertices) grupo.vertices = cantosDoGrupo(grupo);
  if (!grupo.vertices[indice]) return;
  grupo.vertices[indice] = { x, y };
  atualizarGeometriaBase(grupo);
}

/** Remove um vértice, mantendo no mínimo quatro. */
export function removerVertice(grupo, indice) {
  if (!grupo.vertices || grupo.vertices.length <= 4) return;
  grupo.vertices.splice(indice, 1);
  atualizarGeometriaBase(grupo);
}

/** Mantido por compatibilidade: a geometria do grupo é independente dos membros. */
export function atualizarBounds() {}

/** Mantido por compatibilidade: a geometria do grupo é independente dos membros. */
export function atualizarTodosBounds() {}

/** Remove um grupo, mantendo os componentes. */
export function desfazerGrupo(circuito, grupoId) {
  const existe = circuito.grupos.some((g) => g.id === grupoId);
  if (!existe) return;
  circuito.grupos = circuito.grupos.filter((g) => g.id !== grupoId);
  // Remove referências de grupos pais
  for (const g of circuito.grupos) {
    g.membros = g.membros.filter((m) => m !== grupoId);
  }
  registrar(circuito, 'desfazer-grupo', true);
}

/** Renomeia um grupo. */
export function renomearGrupo(circuito, grupoId, novoNome) {
  const grupo = circuito.grupos.find((g) => g.id === grupoId);
  if (grupo && grupo.nome !== novoNome) {
    grupo.nome = novoNome;
    registrar(circuito, 'propriedade');
  }
}

/** Retorna o grupo cujo retângulo contém o ponto. */
export function grupoEm(circuito, x, y) {
  for (let i = circuito.grupos.length - 1; i >= 0; i--) {
    const grupo = circuito.grupos[i];
    if (pontoDentroDoGrupo(grupo, x, y)) return grupo;
  }
  return null;
}

/** Retorna o grupo cujo cabeçalho (área do nome) contém o ponto. */
export function cabecalhoGrupoEm(circuito, x, y) {
  for (let i = circuito.grupos.length - 1; i >= 0; i--) {
    const grupo = circuito.grupos[i];
    if (noNome(grupo, x, y)) return grupo;
  }
  return null;
}

/**
 * Move um grupo inteiro: desloca todos os componentes e grupos
 * membros pelo delta informado.
 */
export function moverGrupo(circuito, grupoId, dx, dy) {
  const grupo = circuito.grupos.find((g) => g.id === grupoId);
  if (!grupo) return;

  const movidos = new Set();

  function moverMembro(id) {
    if (movidos.has(id)) return;
    movidos.add(id);

    const comp = circuito.componentes.find((c) => c.id === id);
    if (comp) {
      comp.x += dx;
      comp.y += dy;
      return;
    }

    const subgrupo = circuito.grupos.find((g) => g.id === id);
    if (subgrupo) {
      moverGeometria(subgrupo, dx, dy);
      for (const membro of subgrupo.membros) {
        moverMembro(membro);
      }
    }
  }

  moverGeometria(grupo, dx, dy);
  movidos.add(grupo.id);
  for (const membro of grupo.membros) {
    moverMembro(membro);
  }
}

/* ===== SELEÇÃO RETANGULAR ===== */

/**
 * Retorna os componentes e grupos dentro de um retângulo.
 */
export function itensNoRetangulo(circuito, x1, y1, x2, y2) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  const componentes = [];
  for (const comp of circuito.componentes) {
    const dim = CATALOGO[comp.tipo].dimensoes;
    const cx = comp.x + dim.w / 2;
    const cy = comp.y + dim.h / 2;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      componentes.push(comp.id);
    }
  }

  const grupos = [];
  for (const g of circuito.grupos) {
    const b = g.bounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      grupos.push(g.id);
    }
  }

  return { componentes, grupos };
}

/* ===== DESENHO ===== */

/** Desenha todos os grupos. */
export function desenharGrupos(ctx, circuito, view, grupoSelecionadoId = null) {
  for (const grupo of circuito.grupos) {
    const cantos = cantosDoGrupo(grupo);
    const selecionado = grupo.id === grupoSelecionadoId;
    const tela = (ponto) => ({
      x: ponto.x * view.zoom + view.panX,
      y: ponto.y * view.zoom + view.panY,
    });
    const pontosTela = cantos.map(tela);
    const pos = geometria(grupo);
    const nomeTela = tela({ x: pos.x, y: pos.y });
    const larguraNome = Math.max(70, grupo.nome.length * 7 + 16) * view.zoom;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pontosTela[0].x, pontosTela[0].y);
    for (let i = 1; i < pontosTela.length; i++) {
      ctx.lineTo(pontosTela[i].x, pontosTela[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = grupo.cor + '14';
    ctx.fill();
    ctx.strokeStyle = selecionado ? CORES.primaria : grupo.cor;
    ctx.lineWidth = (selecionado ? 2 : 1.5) * view.zoom;
    ctx.setLineDash([6 * view.zoom, 4 * view.zoom]);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = grupo.cor + 'dd';
    ctx.beginPath();
    ctx.roundRect(nomeTela.x, nomeTela.y - 20 * view.zoom, larguraNome, 18 * view.zoom, [4, 4, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${10 * view.zoom}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(grupo.nome, nomeTela.x + 8 * view.zoom, nomeTela.y - 11 * view.zoom);
    ctx.restore();

    if (selecionado) {
      for (const ponto of pontosTela) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ponto.x, ponto.y, 4 * view.zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = CORES.primaria;
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

/** Desenha o retângulo de seleção em andamento. */
export function desenharSelecaoRetangular(ctx, x1, y1, x2, y2) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  ctx.save();
  ctx.fillStyle = 'rgba(83, 181, 136, 0.08)';
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  ctx.strokeStyle = '#53b588';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
  ctx.restore();
}

/* ===== INTERAÇÃO ===== */

/**
 * Configura a interação de seleção retangular e grupos.
 * Deve ser chamado ANTES de selecao.js para ter prioridade no botão direito.
 */
export function configurarGrupos(canvas, estado, aoMudar) {
  const el = canvas.elemento;

  let selecaoIniciada = null; // { x1, y1, x2, y2 }
  let nomeEditando = null;    // { grupo, input }
  let arrastandoGrupo = null;

  function telaParaMundo(e) {
    const rect = el.getBoundingClientRect();
    return canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function iniciarArrastoGrupo(grupo, inicio) {
    arrastandoGrupo = {
      id: grupo.id,
      inicioX: inicio.x,
      inicioY: inicio.y,
      ultimoX: inicio.x,
      ultimoY: inicio.y,
      moveu: false,
    };
    el.style.cursor = 'grabbing';
    window.addEventListener('mousemove', moverGrupoArrastado);
    window.addEventListener('mouseup', finalizarArrastoGrupo);
  }

  function moverGrupoArrastado(e) {
    if (!arrastandoGrupo) return;
    const mundo = telaParaMundo(e);
    const dxInicial = mundo.x - arrastandoGrupo.inicioX;
    const dyInicial = mundo.y - arrastandoGrupo.inicioY;
    if (!arrastandoGrupo.moveu && (Math.abs(dxInicial) > 2 || Math.abs(dyInicial) > 2)) {
      arrastandoGrupo.moveu = true;
    }
    if (!arrastandoGrupo.moveu) return;

    moverGrupo(
      estado.circuito,
      arrastandoGrupo.id,
      mundo.x - arrastandoGrupo.ultimoX,
      mundo.y - arrastandoGrupo.ultimoY
    );
    arrastandoGrupo.ultimoX = mundo.x;
    arrastandoGrupo.ultimoY = mundo.y;
    aoMudar();
  }

  function finalizarArrastoGrupo() {
    if (!arrastandoGrupo) return;
    if (arrastandoGrupo.moveu) registrar(estado.circuito, 'mover-grupo', true);
    arrastandoGrupo = null;
    el.style.cursor = 'default';
    window.removeEventListener('mousemove', moverGrupoArrastado);
    window.removeEventListener('mouseup', finalizarArrastoGrupo);
  }

  function iniciarRedimensionamento(grupo, indice) {
    const cantoInicial = cantosDoGrupo(grupo)[indice];
    let moveu = false;
    const aoMover = (e) => {
      const mundo = telaParaMundo(e);
      if (Math.hypot(mundo.x - cantoInicial.x, mundo.y - cantoInicial.y) > 0.5) moveu = true;
      moverVertice(grupo, indice, mundo.x, mundo.y);
      aoMudar();
    };
    const aoSoltar = () => {
      if (moveu) registrar(estado.circuito, 'redimensionar-grupo', true);
      window.removeEventListener('mousemove', aoMover);
      window.removeEventListener('mouseup', aoSoltar);
      el.style.cursor = 'default';
    };
    el.style.cursor = 'nwse-resize';
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);
  }

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.shiftKey) return;
    const mundo = telaParaMundo(e);
    const grupos = [...estado.circuito.grupos].reverse();

    for (const grupo of grupos) {
      if (grupo.id !== estado.grupoSelecionadoId) continue;
      const indice = noCanto(grupo, mundo.x, mundo.y);
      if (indice >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        iniciarRedimensionamento(grupo, indice);
        return;
      }
    }

    for (const grupo of grupos) {
      if (!noContorno(grupo, mundo.x, mundo.y)) continue;
      e.preventDefault();
      e.stopImmediatePropagation();
      estado.grupoSelecionadoId = grupo.id;
      estado.selecionados = [grupo.id];
      iniciarArrastoGrupo(grupo, mundo);
      aoMudar();
      return;
    }

    for (const grupo of grupos) {
      if (!noNome(grupo, mundo.x, mundo.y)) continue;
      e.preventDefault();
      e.stopImmediatePropagation();
      estado.grupoSelecionadoId = grupo.id;
      estado.selecionados = [grupo.id];
      iniciarArrastoGrupo(grupo, mundo);
      aoMudar();
      return;
    }
  });

  // ---- Botão direito: seleção retangular ----
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    e.preventDefault();

    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    selecaoIniciada = { x1: mx, y1: my, x2: mx, y2: my };
    el.style.cursor = 'crosshair';
  });

  el.addEventListener('mousemove', (e) => {
    if (!selecaoIniciada) return;
    const rect = el.getBoundingClientRect();
    selecaoIniciada.x2 = e.clientX - rect.left;
    selecaoIniciada.y2 = e.clientY - rect.top;
    estado.selecaoRetangular = selecaoIniciada;
    aoMudar();
  });

  el.addEventListener('mouseup', (e) => {
    if (e.button !== 2 || !selecaoIniciada) return;

    const rect = el.getBoundingClientRect();
    const m1 = canvas.telaParaMundo(selecaoIniciada.x1, selecaoIniciada.y1);
    const m2 = canvas.telaParaMundo(selecaoIniciada.x2, selecaoIniciada.y2);

    const { componentes, grupos } = itensNoRetangulo(
      estado.circuito, m1.x, m1.y, m2.x, m2.y
    );

    estado.selecionados = [...componentes, ...grupos];
    estado.grupoSelecionadoId = grupos.length === 1 && componentes.length === 0 ? grupos[0] : null;
    estado.selecaoRetangular = null;
    selecaoIniciada = null;
    el.style.cursor = 'default';
    aoMudar();
  });

  // Impede o menu de contexto padrão
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- Duplo clique no nome do grupo: renomear ----
  el.addEventListener('dblclick', (e) => {
    const rect = el.getBoundingClientRect();
    const mundo = canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);

    const grupo = cabecalhoGrupoEm(estado.circuito, mundo.x, mundo.y);
    if (!grupo) return;

    abrirEditorNome(grupo);
  });

  function abrirEditorNome(grupo) {
    if (nomeEditando) nomeEditando.remove();

    const rect = el.getBoundingClientRect();
    const b = grupo.bounds;
    const x = b.x * canvas.view.zoom + canvas.view.panX;
    const y = b.y * canvas.view.zoom + canvas.view.panY;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = grupo.nome;
    input.className = 'grupo-nome-input';
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y - 24}px`;
    input.style.width = `${Math.max(120, b.w * canvas.view.zoom)}px`;
    input.style.zIndex = '100';

    el.parentElement.appendChild(input);
    input.focus();
    input.select();

    const confirmar = () => {
      const novoNome = input.value.trim() || 'Grupo';
      renomearGrupo(estado.circuito, grupo.id, novoNome);
      input.remove();
      nomeEditando = null;
      aoMudar();
    };

    input.addEventListener('blur', confirmar);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') confirmar();
      if (ev.key === 'Escape') {
        input.remove();
        nomeEditando = null;
      }
    });

    nomeEditando = input;
  }

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Tab' && estado.grupoSelecionadoId) {
      const grupo = estado.circuito.grupos.find((item) => item.id === estado.grupoSelecionadoId);
      const ponto = canvas.ultimoMouse || { x: 0, y: 0 };
      const mundo = canvas.telaParaMundo(ponto.x, ponto.y);
      const contorno = grupo && noContorno(grupo, mundo.x, mundo.y);
      if (contorno) {
        e.preventDefault();
        subdividirAresta(grupo, contorno.aresta);
        registrar(estado.circuito, 'subdividir-grupo', true);
        aoMudar();
        return;
      }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const ponto = canvas.ultimoMouse || { x: 0, y: 0 };
      const mundo = canvas.telaParaMundo(ponto.x, ponto.y);
      const grupo = [...estado.circuito.grupos].reverse().find((item) =>
        noContorno(item, mundo.x, mundo.y) || noNome(item, mundo.x, mundo.y)
      );
      if (grupo) {
        e.preventDefault();
        desfazerGrupo(estado.circuito, grupo.id);
        if (estado.grupoSelecionadoId === grupo.id) estado.grupoSelecionadoId = null;
        estado.selecionados = estado.selecionados.filter((id) => id !== grupo.id);
        aoMudar();
      }
    }
  });

  return {
    abrirEditorNome,
  };
}

/* ===== API DE AGRUPAMENTO ===== */

/**
 * Junta os itens selecionados em um grupo.
 * Retorna o grupo criado ou null.
 */
export function juntarSelecionados(circuito, selecionados) {
  if (selecionados.length < 2) return null;

  // Filtra apenas ids válidos (componentes ou grupos)
  const membros = selecionados.filter((id) => {
    return circuito.componentes.some((c) => c.id === id) ||
           circuito.grupos.some((g) => g.id === id);
  });

  if (membros.length < 2) return null;

  // Remove grupos que estão sendo absorvidos
  const gruposAbsorvidos = membros.filter((id) =>
    circuito.grupos.some((g) => g.id === id)
  );
  circuito.grupos = circuito.grupos.filter((g) => !gruposAbsorvidos.includes(g.id));

  // Remove os membros absorvidos de outros grupos pais
  for (const g of circuito.grupos) {
    g.membros = g.membros.filter((m) => !membros.includes(m));
  }

  const grupo = criarGrupo(circuito, membros, 'Novo grupo');
  if (grupo) registrar(circuito, 'grupo', true);
  return grupo;
}