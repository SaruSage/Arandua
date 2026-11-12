/**
 * historico.js — Undo/redo por snapshot.
 *
 * Estratégia:
 * - Cada operação que altera o circuito empilha um snapshot completo
 * - Alterações dentro de uma janela de 300ms são agrupadas num só passo
 * - Limite de 50 estados (o mais antigo é descartado)
 * - Redo é limpo quando uma nova ação é registrada
 */

import { obterDimensoesComponente, obterPinosComponente } from './catalogo.js';

const LIMITE = 50;
const JANELA_AGRUPAMENTO_MS = 300;

let pilha = [];
let indice = -1;
let ultimoRegistro = 0;
let rotuloUltimo = null;

/* ===== SERIALIZAÇÃO DO ESTADO ===== */

/**
 * Cria um snapshot imutável do circuito.
 * Não guarda seleção, resultado de simulação nem view.
 */
function snapshot(circuito) {
  return {
    componentes: circuito.componentes.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      x: c.x,
      y: c.y,
      rotacao: c.rotacao || 0,
      ...(c.nomeCustom ? { nomeCustom: c.nomeCustom } : {}),
      propriedades: { ...c.propriedades },
    })),
    fios: circuito.fios.map((f) => ({
      id: f.id,
      origem: { ...f.origem },
      destino: { ...f.destino },
      dobras: (f.dobras || []).map((d) => ({ x: d.x, y: d.y })),
      cor: f.cor,
    })),
    grupos: circuito.grupos.map((g) => ({
      id: g.id,
      nome: g.nome,
      membros: [...g.membros],
      cor: g.cor,
      ...(g.posicaoNome ? { posicaoNome: { ...g.posicaoNome } } : {}),
      x: g.x ?? g.bounds?.x ?? 0,
      y: g.y ?? g.bounds?.y ?? 0,
      w: g.w ?? g.bounds?.w ?? 0,
      h: g.h ?? g.bounds?.h ?? 0,
      vertices: g.vertices?.map((ponto) => ({ ...ponto })) ?? null,
    })),
  };
}

/**
 * Reconstrói o circuito a partir de um snapshot.
 * Reanexa pinos e dimensões do catálogo.
 */
function reconstruir(snap, CATALOGO) {
  const componentes = snap.componentes.map((c) => {
    const def = CATALOGO[c.tipo];
    if (!def) return null;
    return {
      id: c.id,
      tipo: c.tipo,
      x: c.x,
      y: c.y,
      rotacao: c.rotacao || 0,
      ...(c.nomeCustom ? { nomeCustom: c.nomeCustom } : {}),
      propriedades: { ...def.padrao, ...c.propriedades },
      pinos: obterPinosComponente(c.tipo, { ...def.padrao, ...c.propriedades }),
      dimensoes: obterDimensoesComponente(c.tipo, { ...def.padrao, ...c.propriedades }),
      estado: {},
    };
  }).filter(Boolean);

  const fios = snap.fios.map((f) => ({
    id: f.id,
    origem: { ...f.origem },
    destino: { ...f.destino },
    dobras: (f.dobras || []).map((d) => ({ x: d.x, y: d.y })),
    cor: f.cor || '#2b2b2b',
  }));

  const grupos = snap.grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    membros: [...g.membros],
    cor: g.cor,
    ...(g.posicaoNome ? { posicaoNome: { ...g.posicaoNome } } : {}),
    x: g.x ?? g.bounds?.x ?? 0,
    y: g.y ?? g.bounds?.y ?? 0,
    w: g.w ?? g.bounds?.w ?? 0,
    h: g.h ?? g.bounds?.h ?? 0,
    vertices: g.vertices?.map((ponto) => ({ ...ponto })) ?? null,
    bounds: {
      x: g.x ?? g.bounds?.x ?? 0,
      y: g.y ?? g.bounds?.y ?? 0,
      w: g.w ?? g.bounds?.w ?? 0,
      h: g.h ?? g.bounds?.h ?? 0,
    },
    nomeEditando: false,
  }));

  const proximoId = componentes.reduce((proximo, comp) => {
    const correspondencia = /^c(\d+)$/.exec(comp.id);
    return correspondencia ? Math.max(proximo, Number(correspondencia[1]) + 1) : proximo;
  }, 1);

  return { componentes, fios, grupos, proximoId };
}

/* ===== API PÚBLICA ===== */

/**
 * Registra um novo estado no histórico.
 *
 * @param {object} circuito - circuito atual
 * @param {string} rotulo - descrição da ação ("mover", "adicionar", etc.)
 * @param {boolean} forcarNovoPasso - ignora o agrupamento temporal
 */
export function registrar(circuito, rotulo = 'editar', forcarNovoPasso = false) {
  const agora = Date.now();
  const mesmoRotulo = rotulo === rotuloUltimo;
  const dentroDaJanela = agora - ultimoRegistro < JANELA_AGRUPAMENTO_MS;

  // Agrupa alterações rápidas do mesmo tipo
  if (!forcarNovoPasso && mesmoRotulo && dentroDaJanela && indice >= 0) {
    // Substitui o snapshot do topo em vez de empilhar
    pilha[indice] = snapshot(circuito);
    ultimoRegistro = agora;
    return;
  }

  // Descarta o redo ao registrar nova ação
  if (indice < pilha.length - 1) {
    pilha = pilha.slice(0, indice + 1);
  }

  pilha.push(snapshot(circuito));
  indice = pilha.length - 1;

  // Limita o tamanho
  if (pilha.length > LIMITE) {
    pilha.shift();
    indice--;
  }

  ultimoRegistro = agora;
  rotuloUltimo = rotulo;
}

/** Retorna true se há algo para desfazer. */
export function podeDesfazer() {
  return indice > 0;
}

/** Retorna true se há algo para refazer. */
export function podeRefazer() {
  return indice < pilha.length - 1;
}

/**
 * Desfaz a última ação.
 * Retorna o circuito anterior ou null se não houver nada.
 */
export function desfazer(CATALOGO) {
  if (!podeDesfazer()) return null;
  indice--;
  // Reseta o agrupamento para que a próxima ação seja um novo passo
  ultimoRegistro = 0;
  rotuloUltimo = null;
  return reconstruir(pilha[indice], CATALOGO);
}

/**
 * Refaz a última ação desfeita.
 * Retorna o circuito ou null se não houver nada.
 */
export function refazer(CATALOGO) {
  if (!podeRefazer()) return null;
  indice++;
  ultimoRegistro = 0;
  rotuloUltimo = null;
  return reconstruir(pilha[indice], CATALOGO);
}

/** Limpa o histórico. */
export function limpar() {
  pilha = [];
  indice = -1;
  ultimoRegistro = 0;
  rotuloUltimo = null;
}

/** Inicializa o histórico com o estado atual (sem contar como ação). */
export function inicializar(circuito) {
  pilha = [snapshot(circuito)];
  indice = 0;
  ultimoRegistro = 0;
  rotuloUltimo = null;
}

/** Retorna o tamanho atual da pilha (para debug). */
export function tamanho() {
  return pilha.length;
}