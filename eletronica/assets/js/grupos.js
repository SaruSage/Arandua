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
import { componenteEm } from './circuito.js';

export const CORES_GRUPO = [
  '#53b588', '#3a8fe8', '#8a4ae8', '#e84a9e', '#e05a5a',
  '#e88a3a', '#e8c33a', '#8fbf3a', '#3ab8b8', '#8a5a3a',
];

let estado = null;

/* ===== CRIAÇÃO E MANIPULAÇÃO ===== */

export const MARGEM_AREA = 24;

export function boundsDoComponente(comp) {
  const dim = comp.dimensoes || CATALOGO[comp.tipo]?.dimensoes || { w: 64, h: 30 };
  const rot = (comp.rotacao || 0) % 360;
  if (!rot || rot % 180 === 0) {
    return { x: comp.x, y: comp.y, w: dim.w, h: dim.h };
  }
  const cx = comp.x + dim.w / 2;
  const cy = comp.y + dim.h / 2;
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = dim.w * cos + dim.h * sin;
  const h = dim.w * sin + dim.h * cos;
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}

export function boundsDosFilhos(circuito, membros) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  let encontrou = false;

  for (const id of membros) {
    const comp = circuito.componentes.find((c) => c.id === id);
    if (comp) {
      const b = boundsDoComponente(comp);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
      encontrou = true;
      continue;
    }

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
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Cria um grupo a partir de uma lista de ids de componentes ou grupos.
 * Calcula o retângulo delimitador automaticamente com margem uniforme.
 */
export function criarGrupo(circuito, membros, nome = 'Novo grupo') {
  if (membros.length === 0) return null;

  const bounds = calcularBounds(circuito, membros);
  if (!bounds) return null;

  const cor = CORES_GRUPO[circuito.grupos.length % CORES_GRUPO.length];

  const geometria = { ...bounds };
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

/** Calcula o retângulo delimitador de um conjunto de membros com margem uniforme. */
export function calcularBounds(circuito, membros) {
  const b = boundsDosFilhos(circuito, membros);
  if (!b) return null;

  return {
    x: b.x - MARGEM_AREA,
    y: b.y - MARGEM_AREA,
    w: b.w + MARGEM_AREA * 2,
    h: b.h + MARGEM_AREA * 2,
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

function anguloAlvoDeSnap(ponto, fixo) {
  const dx = ponto.x - fixo.x;
  const dy = ponto.y - fixo.y;
  if (!dx && !dy) return null;

  const angulo = Math.atan2(dy, dx);
  const eixo = Math.round(angulo / (Math.PI / 2)) * (Math.PI / 2);
  if (Math.abs(angulo - eixo) < 20 * Math.PI / 180) {
    return eixo;
  }
  const diagonal = Math.round(angulo / (Math.PI / 4)) * (Math.PI / 4);
  const ehDiagonal = Math.abs(Math.round(diagonal / (Math.PI / 4)) % 2) === 1;
  return ehDiagonal && Math.abs(angulo - diagonal) < 15 * Math.PI / 180
    ? diagonal
    : null;
}

function eixoProximo(ponto, fixo, tolerancia) {
  const dx = ponto.x - fixo.x;
  const dy = ponto.y - fixo.y;
  if (!dx && !dy) return null;
  const angulo = ((Math.atan2(dy, dx) % Math.PI) + Math.PI) % Math.PI;
  const horizontal = Math.min(angulo, Math.PI - angulo);
  const vertical = Math.abs(angulo - Math.PI / 2);
  if (horizontal < tolerancia) return 'x';
  if (vertical < tolerancia) return 'y';
  return null;
}

function intersecaoDirecionada(fixoA, anguloA, fixoB, anguloB) {
  const ax = Math.cos(anguloA), ay = Math.sin(anguloA);
  const bx = Math.cos(anguloB), by = Math.sin(anguloB);
  const determinante = ax * by - ay * bx;
  if (Math.abs(determinante) < 1e-8) return null;
  const dx = fixoB.x - fixoA.x;
  const dy = fixoB.y - fixoA.y;
  const distancia = (dx * by - dy * bx) / determinante;
  return { x: fixoA.x + distancia * ax, y: fixoA.y + distancia * ay };
}

function ajustarVerticeAoAngulo(grupo, indice, ponto) {
  const vertices = grupo.vertices;
  const anterior = vertices[(indice - 1 + vertices.length) % vertices.length];
  const proximo = vertices[(indice + 1) % vertices.length];
  const anguloAnterior = anguloAlvoDeSnap(ponto, anterior);
  const anguloProximo = anguloAlvoDeSnap(ponto, proximo);
  const eixoAnterior = eixoProximo(ponto, anterior, 22 * Math.PI / 180);
  const eixoProximoAtual = eixoProximo(ponto, proximo, 22 * Math.PI / 180);

  if (eixoAnterior && eixoProximoAtual && eixoAnterior !== eixoProximoAtual) {
    const anguloX = eixoAnterior === 'x' ? 0 : Math.PI / 2;
    const anguloY = eixoProximoAtual === 'x' ? 0 : Math.PI / 2;
    return intersecaoDirecionada(anterior, anguloX, proximo, anguloY) || ponto;
  }

  if (anguloAnterior !== null && anguloProximo !== null) {
    return intersecaoDirecionada(anterior, anguloAnterior, proximo, anguloProximo) || ponto;
  }

  if (anguloAnterior !== null) {
    const anguloPreservado = Math.atan2(ponto.y - proximo.y, ponto.x - proximo.x);
    return intersecaoDirecionada(anterior, anguloAnterior, proximo, anguloPreservado) || ponto;
  }

  if (anguloProximo !== null) {
    const anguloPreservado = Math.atan2(ponto.y - anterior.y, ponto.x - anterior.x);
    return intersecaoDirecionada(anterior, anguloPreservado, proximo, anguloProximo) || ponto;
  }

  return ponto;
}

/** Identifica a alça de canto ou lateral sob o ponto. */
export function alcaEm(grupo, x, y, tolerancia = 9) {
  const cantos = cantosDoGrupo(grupo);
  for (let indice = 0; indice < cantos.length; indice++) {
    if (Math.hypot(x - cantos[indice].x, y - cantos[indice].y) < tolerancia) {
      return { tipo: 'canto', indice };
    }
  }

  const nomes = ['topo', 'direita', 'base', 'esquerda'];
  for (const ponto of pontosMedios(grupo)) {
    if (Math.hypot(x - ponto.x, y - ponto.y) < tolerancia) {
      return { tipo: 'lateral', indice: ponto.aresta, nome: nomes[ponto.aresta] };
    }
  }
  return null;
}

/** Translada uma aresta em um único eixo da tela, preservando sua geometria. */
export function redimensionarLateral(grupo, aresta, x, y, inicio = null, verticesOriginais = null, eixo = null) {
  if (!grupo.vertices) grupo.vertices = cantosDoGrupo(grupo).map((ponto) => ({ ...ponto }));

  const quantidade = grupo.vertices.length;
  const indice = aresta % quantidade;
  const proximo = (indice + 1) % quantidade;
  const originais = verticesOriginais || grupo.vertices.map((ponto) => ({ ...ponto }));
  const a = originais[indice];
  const b = originais[proximo];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comprimento = Math.hypot(dx, dy);
  if (!comprimento) return;

  const origem = inicio || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const deltaX = x - origem.x;
  const deltaY = y - origem.y;
  const eixoArrasto = eixo || (Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y');
  const deslocamentoX = eixoArrasto === 'x' ? deltaX : 0;
  const deslocamentoY = eixoArrasto === 'y' ? deltaY : 0;
  grupo.vertices[indice] = { ...a, x: a.x + deslocamentoX, y: a.y + deslocamentoY };
  grupo.vertices[proximo] = { ...b, x: b.x + deslocamentoX, y: b.y + deslocamentoY };

  atualizarRetanguloBase(grupo);
}

function ajustarArestasVizinhas(grupo, aresta) {
  const quantidade = grupo.vertices.length;
  const indice = aresta % quantidade;
  const proximo = (indice + 1) % quantidade;
  const vizinhos = new Set([
    (indice - 1 + quantidade) % quantidade,
    (proximo + 1) % quantidade,
  ]);
  for (const indiceVizinho of vizinhos) {
    const vertice = grupo.vertices[indiceVizinho];
    const ajustado = ajustarVerticeAoAngulo(grupo, indiceVizinho, vertice);
    grupo.vertices[indiceVizinho] = { ...vertice, x: ajustado.x, y: ajustado.y };
    atualizarRetanguloBase(grupo);
  }
}

/** Atualiza o retângulo base e os bounds após editar vértices. */
export function atualizarRetanguloBase(grupo) {
  atualizarGeometriaBase(grupo);
}

/** Calcula a caixa do nome e seu ponto de contato com o contorno. */
export function caixaNomeGrupo(grupo) {
  const b = geometria(grupo);
  const largura = Math.min(Math.max(0, b.w), Math.max(70, grupo.nome.length * 7 + 16));
  const fracao = Number.isFinite(grupo.posicaoNome?.fracao)
    ? Math.max(0, Math.min(1, grupo.posicaoNome.fracao)) : 0;
  const lado = grupo.posicaoNome?.lado === 'base' ? 'base' : 'topo';
  const x = b.x + (b.w - largura) * fracao;
  const centro = x + largura / 2;
  const intersecoes = [];
  const cantos = cantosDoGrupo(grupo);
  for (let i = 0; i < cantos.length; i++) {
    const a = cantos[i];
    const prox = cantos[(i + 1) % cantos.length];
    if (centro < Math.min(a.x, prox.x) || centro > Math.max(a.x, prox.x)) continue;
    if (a.x === prox.x) {
      if (centro === a.x) intersecoes.push(a.y, prox.y);
    } else {
      intersecoes.push(a.y + (prox.y - a.y) * (centro - a.x) / (prox.x - a.x));
    }
  }
  const contato = intersecoes.length
    ? (lado === 'base' ? Math.max(...intersecoes) : Math.min(...intersecoes))
    : (lado === 'base' ? b.y + b.h : b.y);
  return { x, y: lado === 'base' ? contato : contato - 18, largura, altura: 18, contato, lado };
}

/** Verifica se o ponto está sobre a caixa do nome do grupo. */
export function noNome(grupo, x, y) {
  const caixa = caixaNomeGrupo(grupo);
  return x >= caixa.x && x <= caixa.x + caixa.largura && y >= caixa.y && y <= caixa.y + caixa.altura;
}

function coordenadaDentroDoGrupo(grupo, x, y) {
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

/**
 * Verifica se o centro do componente está dentro do grupo.
 * Se o grupo tiver contorno poligonal (vertices), usa
 * point-in-polygon. Caso contrário, usa o retângulo.
 */
export function pontoDentroDoGrupo(comp, grupo) {
  const dim = comp.dimensoes || CATALOGO[comp.tipo]?.dimensoes || { w: 64, h: 30 };
  const cx = comp.x + dim.w / 2;
  const cy = comp.y + dim.h / 2;

  if (grupo.vertices && grupo.vertices.length >= 3) {
    return pontoEmPoligono(cx, cy, grupo.vertices);
  }

  return cx >= grupo.x && cx <= grupo.x + grupo.w
      && cy >= grupo.y && cy <= grupo.y + grupo.h;
}

/**
 * Teste de ponto-em-polígono (ray casting).
 */
export function pontoEmPoligono(px, py, vertices) {
  let dentro = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;

    const intersecta = ((yi > py) !== (yj > py))
      && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);

    if (intersecta) dentro = !dentro;
  }
  return dentro;
}

/**
 * Verifica se o grupo sub está dentro do grupo pai.
 * Usa os vértices reais de sub quando existirem; senão, o
 * retângulo delimitador.
 */
export function grupoDentroDeGrupo(sub, pai) {
  // Pontos de sub: vértices reais ou cantos do retângulo
  const pontosSub = (sub.vertices && sub.vertices.length >= 3)
    ? sub.vertices.map((v) => ({ x: v.x, y: v.y }))
    : [
        { x: sub.x, y: sub.y },
        { x: sub.x + sub.w, y: sub.y },
        { x: sub.x + sub.w, y: sub.y + sub.h },
        { x: sub.x, y: sub.y + sub.h },
      ];

  // Se pai não tem polígono, teste retangular simples
  if (!pai.vertices || pai.vertices.length < 3) {
    return pontosSub.every((p) =>
      p.x >= pai.x && p.x <= pai.x + pai.w
      && p.y >= pai.y && p.y <= pai.y + pai.h
    );
  }

  // Todos os pontos de sub devem estar dentro do polígono do pai
  if (!pontosSub.every((p) => pontoEmPoligono(p.x, p.y, pai.vertices))) {
    return false;
  }

  // Nenhuma aresta de sub pode cruzar aresta do pai
  for (let i = 0; i < pontosSub.length; i++) {
    const p = pontosSub[i];
    const q = pontosSub[(i + 1) % pontosSub.length];

    for (let j = 0; j < pai.vertices.length; j++) {
      const a = pai.vertices[j];
      const b = pai.vertices[(j + 1) % pai.vertices.length];

      if (segmentosCruzam(p, q, a, b)) return false;
    }
  }

  return true;
}

/**
 * Verifica se dois segmentos se cruzam (excluindo toque em
 * extremidades, que é permitido).
 */
export function segmentosCruzam(p1, p2, p3, p4) {
  const d = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);

  // Cruzamento real: sinais opostos nos dois lados
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
      && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Verifica se o grupo g contém o id procurado (recursivo).
 * Evita ciclos de aninhamento.
 */
export function grupoContem(g, idProcurado, visitados = new Set(), circuito = estado?.circuito) {
  if (g.id === idProcurado) return true;
  if (visitados.has(g.id)) return false;
  visitados.add(g.id);

  if (!circuito) return false;
  for (const m of g.membros) {
    if (m === idProcurado) return true;
    const sub = circuito.grupos.find((x) => x.id === m);
    if (sub && grupoContem(sub, idProcurado, visitados, circuito)) return true;
  }
  return false;
}

/**
 * Retorna o id do grupo que já contém este componente, ou null.
 */
export function encontrarDono(componenteId, grupoIgnorar, circuito = estado?.circuito) {
  if (!circuito) return null;
  for (const g of circuito.grupos) {
    if (g.id === grupoIgnorar) continue;
    if (g.membros.includes(componenteId)) return g.id;
  }
  return null;
}

/**
 * Recalcula os membros de um grupo com base na posição atual.
 * Só adquire componentes que NÃO pertencem a nenhum outro grupo.
 */
export function recalcularMembros(grupo, circuito = estado?.circuito) {
  if (!grupo || !circuito) return;
  const novosMembros = [];

  // Componentes: só adquire se não tem dono
  for (const comp of circuito.componentes) {
    if (!pontoDentroDoGrupo(comp, grupo)) continue;

    const dono = encontrarDono(comp.id, grupo.id, circuito);
    if (dono) continue; // já pertence a outra área: não rouba

    novosMembros.push(comp.id);
  }

  // Subgrupos: aninha (mantém identidade e membros)
  for (const sub of circuito.grupos) {
    if (sub.id === grupo.id) continue;
    if (!grupoDentroDeGrupo(sub, grupo)) continue;

    // Não pode haver ciclo: sub não pode já conter grupo
    if (grupoContem(sub, grupo.id, new Set(), circuito)) continue;

    novosMembros.push(sub.id);
  }

  grupo.membros = novosMembros;
}

/**
 * Recalcula os membros de todos os grupos atualmente selecionados antes de limpar a seleção.
 */
export function recalcularGruposSelecionados(estadoAtual = estado) {
  if (!estadoAtual?.circuito || !Array.isArray(estadoAtual.selecionados)) return;
  for (const id of estadoAtual.selecionados) {
    const g = estadoAtual.circuito.grupos.find((x) => x.id === id);
    if (g) recalcularMembros(g, estadoAtual.circuito);
  }
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
export function moverVertice(grupo, indice, x, y, circuito = estado?.circuito) {
  if (!grupo.vertices) grupo.vertices = cantosDoGrupo(grupo).map((ponto) => ({ ...ponto }));
  if (!grupo.vertices[indice]) return;
  grupo.vertices[indice] = { ...grupo.vertices[indice], x, y };
  atualizarGeometriaBase(grupo);
  if (circuito) sincronizarVerticesVinculados(circuito, [grupo.id]);
}

/** Remove um vértice do contorno. */
export function removerVertice(grupo, indice) {
  if (!grupo.vertices || !grupo.vertices[indice]) return false;
  grupo.vertices.splice(indice, 1);
  atualizarGeometriaBase(grupo);
  return true;
}

/** Mantido por compatibilidade: a geometria do grupo é independente dos membros. */
export function atualizarBounds() {}

/** Mantido por compatibilidade: a geometria do grupo é independente dos membros. */
export function atualizarTodosBounds() {}

/** Remove um grupo, mantendo os componentes. */
export function desfazerGrupo(circuito, grupoId) {
  const grupo = circuito.grupos.find((g) => g.id === grupoId);
  if (!grupo) return;
  for (const vertice of grupo.vertices || []) removerVinculoVertice(circuito, vertice);
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
    if (coordenadaDentroDoGrupo(grupo, x, y)) return grupo;
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

function verticeEm(circuito, x, y, tolerancia = 10) {
  for (let i = circuito.grupos.length - 1; i >= 0; i--) {
    const grupo = circuito.grupos[i];
    const vertices = cantosDoGrupo(grupo);
    for (let indice = 0; indice < vertices.length; indice++) {
      if (Math.hypot(vertices[indice].x - x, vertices[indice].y - y) <= tolerancia) {
        return { grupo, indice };
      }
    }
  }
  return null;
}

function indiceVerticeProximo(grupo, x, y, tolerancia) {
  const vertices = cantosDoGrupo(grupo);
  let indiceProximo = -1;
  let menorDistancia = tolerancia;
  for (let indice = 0; indice < vertices.length; indice++) {
    const distancia = Math.hypot(vertices[indice].x - x, vertices[indice].y - y);
    if (distancia <= menorDistancia) {
      menorDistancia = distancia;
      indiceProximo = indice;
    }
  }
  return indiceProximo;
}

function garantirVertices(grupo) {
  if (!grupo.vertices) grupo.vertices = cantosDoGrupo(grupo).map((ponto) => ({ ...ponto }));
  return grupo.vertices;
}

function removerVinculoVertice(circuito, vertice) {
  if (!vertice?.vinculoId) return;
  const { vinculoId } = vertice;
  delete vertice.vinculoId;
  for (const grupo of circuito.grupos) {
    for (const outro of grupo.vertices || []) {
      if (outro.vinculoId === vinculoId) delete outro.vinculoId;
    }
  }
}

export function sincronizarVerticesVinculados(circuito, gruposOrigem) {
  const idsOrigem = gruposOrigem ? new Set(gruposOrigem) : null;
  const posicoes = new Map();
  for (const grupo of circuito.grupos) {
    if (idsOrigem && !idsOrigem.has(grupo.id)) continue;
    for (const vertice of grupo.vertices || []) {
      if (vertice.vinculoId) posicoes.set(vertice.vinculoId, { x: vertice.x, y: vertice.y });
    }
  }

  const alterados = new Set();
  for (const grupo of circuito.grupos) {
    for (const vertice of grupo.vertices || []) {
      const posicao = posicoes.get(vertice.vinculoId);
      if (!posicao || (vertice.x === posicao.x && vertice.y === posicao.y)) continue;
      vertice.x = posicao.x;
      vertice.y = posicao.y;
      alterados.add(grupo);
    }
  }
  for (const grupo of alterados) atualizarRetanguloBase(grupo);
}

const tiposAgrupaveis = (comp) => {
  // Qualquer componente que não seja grupo entra
  return comp && comp.tipo !== 'GRUPO';
};

function moverMembro(id, dx, dy, movidos, circuito = estado?.circuito) {
  if (!circuito || movidos.has(id)) return;
  movidos.add(id);

  const comp = circuito.componentes.find((c) => c.id === id);
  if (comp) {
    comp.x += dx;
    comp.y += dy;
    return;
  }

  const sub = circuito.grupos.find((g) => g.id === id);
  if (sub) {
    sub.x += dx;
    sub.y += dy;
    if (sub.vertices) {
      sub.vertices = sub.vertices.map((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
    sincronizarBounds(sub);
    for (const m of sub.membros) moverMembro(m, dx, dy, movidos, circuito);
  }
}

/**
 * Move um grupo inteiro: desloca APENAS os membros já registrados no grupo.
 * Nenhuma aquisição ocorre durante o arrasto.
 */
export function moverGrupo(grupoOuCircuito, dxOuGrupoId, dyOuDx, dyOpcional) {
  let circuito = estado?.circuito;
  let grupo = grupoOuCircuito;
  let dx = dxOuGrupoId;
  let dy = dyOuDx;

  if (grupoOuCircuito && Array.isArray(grupoOuCircuito.grupos)) {
    circuito = grupoOuCircuito;
    grupo = circuito.grupos.find((g) => g.id === dxOuGrupoId);
    dx = dyOuDx;
    dy = dyOpcional;
  }
  if (!grupo || !circuito) return;

  // Move o contorno
  grupo.x += dx;
  grupo.y += dy;
  if (grupo.vertices) {
    grupo.vertices = grupo.vertices.map((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }
  sincronizarBounds(grupo);

  // Move APENAS os membros já registrados. Nenhuma aquisição.
  const movidos = new Set();
  for (const id of grupo.membros) moverMembro(id, dx, dy, movidos, circuito);
  sincronizarVerticesVinculados(circuito, new Set([grupo.id, ...movidos]));

  // Move as dobras dos fios internos (ambos extremos membros)
  const membros = new Set([...grupo.membros, ...movidos]);
  for (const fio of circuito.fios) {
    if (membros.has(fio.origem.componente) && membros.has(fio.destino.componente)) {
      if (fio.dobras?.length) {
        fio.dobras = fio.dobras.map((d) => ({ x: d.x + dx, y: d.y + dy }));
      }
    }
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
    if (!tiposAgrupaveis(comp)) continue;
    const dim = comp.dimensoes || CATALOGO[comp.tipo]?.dimensoes || { w: 64, h: 30 };
    const cx = comp.x + dim.w / 2;
    const cy = comp.y + dim.h / 2;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      componentes.push(comp.id);
    }
  }

  const grupos = [];
  for (const g of circuito.grupos) {
    const b = g.bounds || g;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      grupos.push(g.id);
    }
  }

  return { componentes, grupos };
}

/* ===== DESENHO ===== */

/**
 * Retorna a profundidade de aninhamento do grupo.
 * Grupo raiz = 0; dentro de um grupo = 1; etc.
 */
function profundidadeGrupo(grupo, visitados = new Set(), circuito = estado?.circuito) {
  if (!circuito || visitados.has(grupo.id)) return 0;
  visitados.add(grupo.id);

  const pai = circuito.grupos.find(
    (g) => g.id !== grupo.id && g.membros.includes(grupo.id)
  );

  if (!pai) return 0;
  return 1 + profundidadeGrupo(pai, visitados, circuito);
}

/**
 * Verifica se dois grupos se sobrepõem pelos retângulos delimitadores.
 */
function retangulosSeSobrepoem(a, b) {
  return !(
    a.x + a.w < b.x ||
    a.x > b.x + b.w ||
    a.y + a.h < b.y ||
    a.y > b.y + b.h
  );
}

/** Desenha todos os grupos. */
export function desenharGrupos(ctx, circuito, view, grupoSelecionadoId = null) {
  const gruposOrdenados = [...circuito.grupos].sort((a, b) => {
    const profA = profundidadeGrupo(a, new Set(), circuito);
    const profB = profundidadeGrupo(b, new Set(), circuito);
    return profA - profB; // raiz primeiro
  });

  const offX = view.offsetOrigemX || 0;
  const tela = (ponto) => ({
    x: ponto.x * view.zoom + view.panX + offX,
    y: ponto.y * view.zoom + view.panY,
  });

  /**
   * Adiciona o contorno de um grupo ao path atual do contexto.
   */
  function adicionarContornoAoPath(ctx, g) {
    if (g.vertices && g.vertices.length >= 3) {
      const p0 = tela(g.vertices[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < g.vertices.length; i++) {
        const p = tela(g.vertices[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    } else {
      const a = tela({ x: g.x, y: g.y });
      const b = tela({ x: g.x + g.w, y: g.y + g.h });
      ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
  }

  const jaDesenhados = [];

  for (const grupo of gruposOrdenados) {
    const cantos = cantosDoGrupo(grupo);
    const selecionado = grupo.id === grupoSelecionadoId;
    const pontosTela = cantos.map(tela);
    const caixaNome = caixaNomeGrupo(grupo);
    const nomeTela = tela(caixaNome);
    const larguraNome = caixaNome.largura * view.zoom;

    // 1) Desenha o preenchimento da área atual com o vazado das
    //    subáreas diretas
    ctx.save();
    ctx.beginPath();
    adicionarContornoAoPath(ctx, grupo);
    ctx.clip();

    for (const idMembro of grupo.membros) {
      const sub = circuito.grupos.find((g) => g.id === idMembro);
      if (!sub) continue;
      ctx.beginPath();
      adicionarContornoAoPath(ctx, grupo);
      adicionarContornoAoPath(ctx, sub);
      ctx.clip('evenodd');
    }

    // 2) Aplica um clip adicional para cada área anterior que
    //    se sobrepõe (exceto ancestrais)
    for (const anterior of jaDesenhados) {
      if (grupo.membros.includes(anterior.id)) continue;
      if (grupoContem(anterior, grupo.id, new Set(), circuito)) continue; // ancestral
      if (!retangulosSeSobrepoem(grupo, anterior)) continue;

      ctx.beginPath();
      adicionarContornoAoPath(ctx, grupo);
      adicionarContornoAoPath(ctx, anterior);
      ctx.clip('evenodd'); // subtrai a região desta área
    }

    // 3) Pinta o retângulo da área atual
    const a = tela({ x: grupo.x, y: grupo.y });
    const b = tela({ x: grupo.x + grupo.w, y: grupo.y + grupo.h });
    ctx.fillStyle = grupo.cor + '14';
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);

    ctx.restore();

    // 4) Desenha o contorno tracejado (fora do clip)
    ctx.save();
    ctx.beginPath();
    adicionarContornoAoPath(ctx, grupo);
    ctx.strokeStyle = selecionado ? CORES.primaria : grupo.cor;

    // Se este grupo pertence a outro, desenha com traço mais fino
    const pai = circuito.grupos.find(
      (g) => g.id !== grupo.id && g.membros.includes(grupo.id)
    );
    ctx.setLineDash(pai ? [4, 4] : [8, 4]);
    ctx.lineWidth = pai ? 1 : 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = grupo.cor + 'dd';
    ctx.beginPath();
    ctx.roundRect(nomeTela.x, nomeTela.y, larguraNome, 18 * view.zoom, caixaNome.lado === 'topo' ? [4, 4, 0, 0] : [0, 0, 4, 4]);
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${10 * view.zoom}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(grupo.nome, nomeTela.x + 8 * view.zoom, nomeTela.y + 9 * view.zoom);
    ctx.restore();

    if (selecionado) {
      const alcas = [
        ...pontosTela.map((ponto) => ({ ...ponto, tipo: 'canto' })),
        ...pontosMedios(grupo).map((ponto) => ({ ...tela(ponto), tipo: 'lateral' })),
      ];

      for (const alca of alcas) {
        ctx.save();
        ctx.beginPath();
        if (alca.tipo === 'canto') {
          ctx.arc(alca.x, alca.y, 4.5 * view.zoom, 0, Math.PI * 2);
        } else {
          const tamanho = 8 * view.zoom;
          ctx.rect(alca.x - tamanho / 2, alca.y - tamanho / 2, tamanho, tamanho);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = CORES.primaria;
        ctx.stroke();
        ctx.restore();
      }
    }

    jaDesenhados.push(grupo);
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
export function configurarGrupos(canvas, estadoParam, aoMudar) {
  estado = estadoParam;
  const el = canvas.elemento;

  let selecaoIniciada = null; // { x1, y1, x2, y2 }
  let nomeEditando = null;    // { grupo, input }
  let arrastandoGrupo = null;
  let arrastandoNome = null;
  let verticeConexaoPendente = null;

  function telaParaMundo(e) {
    const rect = el.getBoundingClientRect();
    return canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function moverNome(e) {
    if (!arrastandoNome) return;
    const mundo = telaParaMundo(e);
    const { grupo, inicio, deslocamentoX } = arrastandoNome;
    if (!arrastandoNome.moveu && Math.hypot(mundo.x - inicio.x, mundo.y - inicio.y) <= 2) return;
    arrastandoNome.moveu = true;
    const b = geometria(grupo);
    const largura = caixaNomeGrupo(grupo).largura;
    const disponivel = Math.max(0, b.w - largura);
    const fracao = disponivel ? Math.max(0, Math.min(1, (mundo.x - deslocamentoX - b.x) / disponivel)) : 0;
    grupo.posicaoNome = { fracao, lado: 'topo' };
    const topo = caixaNomeGrupo(grupo).contato;
    grupo.posicaoNome.lado = 'base';
    const base = caixaNomeGrupo(grupo).contato;
    grupo.posicaoNome.lado = Math.abs(mundo.y - topo) <= Math.abs(mundo.y - base) ? 'topo' : 'base';
    aoMudar();
  }

  function finalizarNome(e) {
    if (!arrastandoNome || e.button !== 2) return;
    const moveu = arrastandoNome.moveu;
    arrastandoNome = null;
    window.removeEventListener('mousemove', moverNome);
    window.removeEventListener('mouseup', finalizarNome);
    el.style.cursor = 'default';
    if (moveu) registrar(estado.circuito, 'mover-nome-area', true);
    aoMudar();
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
    const vinculos = new Set((grupo.vertices || []).map((vertice) => vertice.vinculoId).filter(Boolean));
    const gruposVinculados = estado.circuito.grupos
      .filter((item) => item.id !== grupo.id &&
        (item.vertices || []).some((vertice) => vinculos.has(vertice.vinculoId)))
      .map((item) => ({
        id: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        bounds: item.bounds ? { ...item.bounds } : null,
        vertices: item.vertices ? item.vertices.map((vertice) => ({ ...vertice })) : null,
      }));
    estado.arrastoInicial = {
      tipo: 'area',
      id: grupo.id,
      x: grupo.x,
      y: grupo.y,
      w: grupo.w,
      h: grupo.h,
      bounds: grupo.bounds ? { ...grupo.bounds } : null,
      vertices: grupo.vertices ? grupo.vertices.map((v) => ({ ...v })) : null,
      gruposVinculados,
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
      if (estado.arrastoInicial) estado.arrastoInicial.moveu = true;
    }
    if (!arrastandoGrupo.moveu) return;

    const grupo = estado.circuito.grupos.find((g) => g.id === arrastandoGrupo.id);
    if (grupo) {
      moverGrupo(
        grupo,
        mundo.x - arrastandoGrupo.ultimoX,
        mundo.y - arrastandoGrupo.ultimoY
      );
    }
    arrastandoGrupo.ultimoX = mundo.x;
    arrastandoGrupo.ultimoY = mundo.y;
    aoMudar();
  }

  function finalizarArrastoGrupo() {
    if (!arrastandoGrupo) return;
    const moveu = arrastandoGrupo.moveu;
    arrastandoGrupo = null;
    estado.arrastoInicial = null;
    el.style.cursor = 'default';
    window.removeEventListener('mousemove', moverGrupoArrastado);
    window.removeEventListener('mouseup', finalizarArrastoGrupo);
    if (moveu) {
      registrar(estado.circuito, 'mover-grupo', true);
      aoMudar();
    }
  }

  function iniciarRedimensionamento(grupo, alca, inicioCursor) {
    if (!grupo.vertices) grupo.vertices = cantosDoGrupo(grupo).map((ponto) => ({ ...ponto }));
    const verticesOriginais = grupo.vertices.map((ponto) => ({ ...ponto }));
    const pontoInicial = alca.tipo === 'canto'
      ? verticesOriginais[alca.indice]
      : pontosMedios({ ...grupo, vertices: verticesOriginais })[alca.indice];
    const origemArrasto = inicioCursor || pontoInicial;
    let eixoArrasto = null;
    let moveu = false;
    const aplicarPosicao = (e) => {
      const mundo = telaParaMundo(e);
      const referenciaMovimento = alca.tipo === 'lateral' ? origemArrasto : pontoInicial;
      if (Math.hypot(mundo.x - referenciaMovimento.x, mundo.y - referenciaMovimento.y) > 0.5) moveu = true;
      if (!moveu) return;
      if (alca.tipo === 'canto') {
        const vertice = grupo.vertices[alca.indice];
        const ajustado = ajustarVerticeAoAngulo(grupo, alca.indice, mundo);
        grupo.vertices[alca.indice] = { ...vertice, x: ajustado.x, y: ajustado.y };
        atualizarRetanguloBase(grupo);
        sincronizarVerticesVinculados(estado.circuito, [grupo.id]);
      } else {
        if (!eixoArrasto) {
          eixoArrasto = Math.abs(mundo.x - origemArrasto.x) >= Math.abs(mundo.y - origemArrasto.y)
            ? 'x' : 'y';
        }
        grupo.vertices = verticesOriginais.map((ponto) => ({ ...ponto }));
        redimensionarLateral(
          grupo, alca.indice, mundo.x, mundo.y, origemArrasto, verticesOriginais, eixoArrasto
        );
        ajustarArestasVizinhas(grupo, alca.indice);
        sincronizarVerticesVinculados(estado.circuito, [grupo.id]);
      }
    };
    const aoMover = (e) => {
      aplicarPosicao(e);
      if (!moveu) return;
      aoMudar();
    };
    const aoSoltar = (e) => {
      aplicarPosicao(e);
      window.removeEventListener('mousemove', aoMover);
      window.removeEventListener('mouseup', aoSoltar);
      el.style.cursor = 'default';
      if (moveu) {
        registrar(estado.circuito, 'redimensionar-grupo', true);
        aoMudar();
      }
    };
    el.style.cursor = alca.tipo === 'lateral' ? 'ew-resize' : 'nwse-resize';
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);
  }

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.shiftKey) return;
    const mundo = telaParaMundo(e);
    const grupos = [...estado.circuito.grupos].reverse();

    for (const grupo of grupos) {
      if (grupo.id !== estado.grupoSelecionadoId) continue;
      const alca = alcaEm(grupo, mundo.x, mundo.y);
      if (alca) {
        e.preventDefault();
        e.stopImmediatePropagation();
        iniciarRedimensionamento(grupo, alca, mundo);
        return;
      }
    }

    for (const grupo of grupos) {
      if (!noContorno(grupo, mundo.x, mundo.y)) continue;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!estado.selecionados.includes(grupo.id)) {
        recalcularGruposSelecionados(estado);
      }
      estado.grupoSelecionadoId = grupo.id;
      estado.selecionados = [grupo.id];
      estado.abrirPopupEntidade?.('area', grupo.id);
      iniciarArrastoGrupo(grupo, mundo);
      aoMudar();
      return;
    }

    for (const grupo of grupos) {
      if (!noNome(grupo, mundo.x, mundo.y)) continue;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!estado.selecionados.includes(grupo.id)) {
        recalcularGruposSelecionados(estado);
      }
      estado.grupoSelecionadoId = grupo.id;
      estado.selecionados = [grupo.id];
      estado.abrirPopupEntidade?.('area', grupo.id);
      iniciarArrastoGrupo(grupo, mundo);
      aoMudar();
      return;
    }
  });

  // ---- Botão direito: seleção retangular ----
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    e.preventDefault();

    const mundo = telaParaMundo(e);
    if (estado.componenteNomeEm?.(mundo.x, mundo.y)) return;
    const grupo = cabecalhoGrupoEm(estado.circuito, mundo.x, mundo.y);
    if (grupo) {
      const caixa = caixaNomeGrupo(grupo);
      arrastandoNome = {
        grupo, inicio: mundo, deslocamentoX: mundo.x - caixa.x,
        posicaoInicial: grupo.posicaoNome ? { ...grupo.posicaoNome } : null,
        moveu: false,
      };
      el.style.cursor = 'grabbing';
      window.addEventListener('mousemove', moverNome);
      window.addEventListener('mouseup', finalizarNome);
      e.stopImmediatePropagation();
      return;
    }
    if (componenteEm(estado.circuito, mundo.x, mundo.y)?.tipo === 'NO') return;

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

    recalcularGruposSelecionados(estado);
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

    const alvoVertice = verticeEm(
      estado.circuito, mundo.x, mundo.y, 8 / canvas.view.zoom
    );
    if (alvoVertice) {
      e.preventDefault();
      e.stopPropagation();
      const { grupo, indice } = alvoVertice;
      garantirVertices(grupo);
      if (verticeConexaoPendente) {
        const origem = estado.circuito.grupos.find(
          (item) => item.id === verticeConexaoPendente.grupoId
        );
        const verticeOrigem = origem?.vertices?.[verticeConexaoPendente.indice];
        const verticeDestino = grupo.vertices[indice];

        if (origem && verticeOrigem && origem.id !== grupo.id &&
            verticeOrigem.vinculoId && verticeOrigem.vinculoId === verticeDestino.vinculoId) {
          removerVinculoVertice(estado.circuito, verticeOrigem);
          registrar(estado.circuito, 'desconectar-vertices', true);
          verticeConexaoPendente = null;
          aoMudar();
          return;
        }

        if (origem && verticeOrigem && origem.id !== grupo.id &&
            !verticeOrigem.vinculoId && !verticeDestino.vinculoId) {
          const vinculoId = `vinculo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          verticeOrigem.vinculoId = vinculoId;
          verticeDestino.x = verticeOrigem.x;
          verticeDestino.y = verticeOrigem.y;
          verticeDestino.vinculoId = vinculoId;
          atualizarRetanguloBase(origem);
          atualizarRetanguloBase(grupo);
          registrar(estado.circuito, 'conectar-vertices', true);
          verticeConexaoPendente = null;
          aoMudar();
          return;
        }
      }

      verticeConexaoPendente = { grupoId: grupo.id, indice };
      return;
    }

    const grupo = cabecalhoGrupoEm(estado.circuito, mundo.x, mundo.y);
    if (!grupo) return;

    abrirEditorNome(grupo);
  });

  function abrirEditorNome(grupo) {
    if (nomeEditando) nomeEditando.remove();

    const rect = el.getBoundingClientRect();
    const caixa = caixaNomeGrupo(grupo);
    const offX = canvas.view.offsetOrigemX || 0;
    const x = caixa.x * canvas.view.zoom + canvas.view.panX + offX;
    const y = caixa.y * canvas.view.zoom + canvas.view.panY;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = grupo.nome;
    input.className = 'grupo-nome-input';
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.width = `${Math.max(120, caixa.largura * canvas.view.zoom)}px`;
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
        ev.stopPropagation();
        input.remove();
        nomeEditando = null;
      }
    });

    nomeEditando = input;
  }

  estado.cancelarEdicaoTexto = () => {
    if (nomeEditando) {
      nomeEditando.remove();
      nomeEditando = null;
      return true;
    }
    return false;
  };

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      if (verticeConexaoPendente) {
        verticeConexaoPendente = null;
        e.stopPropagation();
        return;
      }
      if (arrastandoNome) {
        const { grupo, posicaoInicial } = arrastandoNome;
        if (posicaoInicial) grupo.posicaoNome = posicaoInicial;
        else delete grupo.posicaoNome;
        arrastandoNome = null;
        window.removeEventListener('mousemove', moverNome);
        window.removeEventListener('mouseup', finalizarNome);
        el.style.cursor = 'default';
        e.stopPropagation();
        aoMudar();
        return;
      }
      if (estado.arrastoInicial?.tipo === 'area') {
        const a = estado.arrastoInicial;
        const grupo = estado.circuito.grupos.find((g) => g.id === a.id);
        if (grupo && a.moveu) {
          grupo.x = a.x;
          grupo.y = a.y;
          grupo.w = a.w;
          grupo.h = a.h;
          if (a.bounds) grupo.bounds = { ...a.bounds };
          if (a.vertices) grupo.vertices = a.vertices.map((v) => ({ ...v }));
        }
        for (const info of a.gruposVinculados || []) {
          const vinculado = estado.circuito.grupos.find((item) => item.id === info.id);
          if (!vinculado) continue;
          vinculado.x = info.x;
          vinculado.y = info.y;
          vinculado.w = info.w;
          vinculado.h = info.h;
          if (info.bounds) vinculado.bounds = { ...info.bounds };
          if (info.vertices) vinculado.vertices = info.vertices.map((vertice) => ({ ...vertice }));
        }
        if (arrastandoGrupo) {
          arrastandoGrupo = null;
          el.style.cursor = 'default';
          window.removeEventListener('mousemove', moverGrupoArrastado);
          window.removeEventListener('mouseup', finalizarArrastoGrupo);
        }
        estado.arrastoInicial = null;

        if (!a.moveu) {
          estado.grupoSelecionadoId = null;
          estado.selecionados = [];
          estado.fecharPopupsNaoFixados?.();
        }

        e.stopPropagation();
        aoMudar();
        return;
      }
    }

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
        const indiceVertice = noContorno(grupo, mundo.x, mundo.y)
          ? indiceVerticeProximo(grupo, mundo.x, mundo.y, 8 / canvas.view.zoom)
          : -1;
        if (indiceVertice >= 0) {
          const vertices = garantirVertices(grupo);
          removerVinculoVertice(estado.circuito, vertices[indiceVertice]);
          removerVertice(grupo, indiceVertice);
          if (grupo.vertices.length < 3) {
            desfazerGrupo(estado.circuito, grupo.id);
            if (estado.grupoSelecionadoId === grupo.id) estado.grupoSelecionadoId = null;
            estado.selecionados = estado.selecionados.filter((id) => id !== grupo.id);
          } else {
            registrar(estado.circuito, 'remover-vertice', true);
          }
          aoMudar();
          return;
        }

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
 * Subgrupos selecionados são aninhados (mantêm sua identidade e membros),
 * e componentes que já têm dono não são roubados de outros grupos.
 * Retorna o grupo criado ou null.
 */
export function juntarSelecionados(circuito, selecionados) {
  if (selecionados.length < 2) return null;

  // Filtra apenas ids válidos (componentes agrupáveis ou grupos)
  const membrosDiretos = selecionados.filter((id) => {
    const comp = circuito.componentes.find((c) => c.id === id);
    if (comp) return tiposAgrupaveis(comp);
    return circuito.grupos.some((g) => g.id === id);
  });

  if (membrosDiretos.length < 2) return null;

  const gruposSelecionados = circuito.grupos.filter((g) =>
    membrosDiretos.includes(g.id)
  );
  const idsGruposSelecionados = new Set(gruposSelecionados.map((g) => g.id));

  // Componentes sem dono + subgrupos selecionados (aninhamento, sem fusão)
  const membrosFinais = [];
  for (const id of membrosDiretos) {
    if (idsGruposSelecionados.has(id)) {
      // Só adiciona o subgrupo se ele não pertencer já a outro subgrupo selecionado
      const jaAninhadoEmSelecionado = gruposSelecionados.some(
        (outro) => outro.id !== id && grupoContem(outro, id, new Set(), circuito)
      );
      if (!jaAninhadoEmSelecionado && !membrosFinais.includes(id)) {
        membrosFinais.push(id);
      }
    } else {
      // Componente: só entra diretamente se não tiver dono
      const dono = encontrarDono(id, null, circuito);
      if (!dono && !membrosFinais.includes(id)) {
        membrosFinais.push(id);
      }
    }
  }

  if (membrosFinais.length < 2) return null;

  const grupo = criarGrupo(circuito, membrosFinais, 'Novo grupo');
  if (!grupo) return null;

  registrar(circuito, 'grupo', true);
  return grupo;
}