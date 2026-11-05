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

const CORES_GRUPO = [
  '#53b588', // verde
  '#ffb340', // amarelo
  '#7c9ef5', // azul
  '#e07a9a', // rosa
  '#a78bfa', // roxo
  '#5ec8c8', // ciano
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

  const grupo = {
    id: `g${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nome,
    membros: [...membros],
    bounds,
    cor,
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
      minX = Math.min(minX, grupo.bounds.x);
      minY = Math.min(minY, grupo.bounds.y);
      maxX = Math.max(maxX, grupo.bounds.x + grupo.bounds.w);
      maxY = Math.max(maxY, grupo.bounds.y + grupo.bounds.h);
      encontrou = true;
    }
  }

  if (!encontrou) return null;

  const margem = 16;
  return {
    x: minX - margem,
    y: minY - margem - 20, // espaço extra para o nome
    w: maxX - minX + margem * 2,
    h: maxY - minY + margem * 2 + 20,
  };
}

/** Recalcula os bounds de um grupo (após mover componentes). */
export function atualizarBounds(circuito, grupo) {
  const bounds = calcularBounds(circuito, grupo.membros);
  if (bounds) grupo.bounds = bounds;
}

/** Recalcula os bounds de todos os grupos. */
export function atualizarTodosBounds(circuito) {
  for (const grupo of circuito.grupos) {
    atualizarBounds(circuito, grupo);
  }
}

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
  // Percorre de trás para frente (grupos mais recentes primeiro)
  for (let i = circuito.grupos.length - 1; i >= 0; i--) {
    const g = circuito.grupos[i];
    const b = g.bounds;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return g;
    }
  }
  return null;
}

/** Retorna o grupo cujo cabeçalho (área do nome) contém o ponto. */
export function cabecalhoGrupoEm(circuito, x, y) {
  for (let i = circuito.grupos.length - 1; i >= 0; i--) {
    const g = circuito.grupos[i];
    const b = g.bounds;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + 24) {
      return g;
    }
  }
  return null;
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
    const b = grupo.bounds;
    const x = b.x * view.zoom + view.panX;
    const y = b.y * view.zoom + view.panY;
    const w = b.w * view.zoom;
    const h = b.h * view.zoom;

    const selecionado = grupo.id === grupoSelecionadoId;

    ctx.save();

    // Fundo suave
    ctx.fillStyle = grupo.cor + '0d'; // 5% de opacidade
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8 * view.zoom);
    ctx.fill();

    // Contorno tracejado
    ctx.strokeStyle = grupo.cor;
    ctx.lineWidth = (selecionado ? 2.5 : 1.5) * view.zoom;
    ctx.setLineDash([8 * view.zoom, 5 * view.zoom]);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8 * view.zoom);
    ctx.stroke();

    // Faixa do nome
    ctx.setLineDash([]);
    ctx.fillStyle = grupo.cor;
    const larguraNome = Math.max(80, grupo.nome.length * 7 + 20) * view.zoom;
    ctx.beginPath();
    ctx.roundRect(x, y - 22 * view.zoom, larguraNome, 20 * view.zoom, 6 * view.zoom);
    ctx.fill();

    // Texto do nome
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${11 * view.zoom}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(grupo.nome, x + 8 * view.zoom, y - 12 * view.zoom);

    ctx.restore();
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

  function telaParaMundo(e) {
    const rect = el.getBoundingClientRect();
    return canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
  }

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