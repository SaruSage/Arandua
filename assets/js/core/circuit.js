/**
 * circuit.js — Grafo do circuito e propagação de sinais.
 * Responsável por manter o estado de todos os pinos e resolver
 * a lógica combinacional até estabilizar.
 */

import { avaliarPorta, normalizar } from './gate.js';
import { criarFio, fioExiste } from './wire.js';

let contadorComponentes = 0;

/** Limite de iterações da propagação, para evitar loop infinito em realimentação instável. */
const MAX_ITERACOES = 100;

/** Tipos de porta combinacional pura. */
const TIPOS_COMBINACIONAIS = new Set([
  'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUFFER',
]);

/** Tipos sequenciais que só mudam na borda de clock. */
const TIPOS_SEQUENCIAIS = new Set([
  'DFF', 'JKFF', 'TFF', 'SRFF', 'COUNTER', 'REGISTER',
]);

/**
 * Estado inicial padrão por tipo de componente.
 * Garante que nenhum componente nasça com estado indefinido.
 */
function estadoInicial(tipo, numSaidas) {
  switch (tipo) {
    case 'SWITCH':
      return { ativo: 0 };
    case 'LED':
      return { aceso: false };
    case 'CLOCK':
      return { nivel: 0, frequenciaHz: 1, rodando: false, ciclos: 0 };
    case 'DFF':
    case 'JKFF':
    case 'TFF':
    case 'SRFF':
      return { q: 0 };
    case 'COUNTER':
      return { bits: numSaidas || 4, valor: 0 };
    case 'REGISTER':
      return { bits: numSaidas || 4, valor: new Array(numSaidas || 4).fill(0) };
    default:
      return {};
  }
}

/**
 * Cria um componente genérico.
 * @param {string} tipo - tipo do componente (AND, OR, DFF, LED, SWITCH...)
 * @param {object} opcoes - { numEntradas, numSaidas, posicao, rotulo }
 */
export function criarComponente(tipo, opcoes = {}) {
  const {
    numEntradas = 2,
    numSaidas = 1,
    posicao = { x: 0, y: 0 },
    rotulo = tipo,
  } = opcoes;

  const entradas = [];
  for (let i = 0; i < numEntradas; i++) {
    entradas.push({ id: `in${i}`, valor: null });
  }

  const saidas = [];
  for (let i = 0; i < numSaidas; i++) {
    saidas.push({ id: `out${i}`, valor: null });
  }

  const componente = {
    id: `comp_${++contadorComponentes}`,
    tipo,
    rotulo,
    posicao: { ...posicao },
    entradas,
    saidas,
    estado: estadoInicial(tipo, numSaidas),
  };

  // Sequenciais já nascem com as saídas coerentes com o estado inicial
  if (['DFF', 'JKFF', 'TFF', 'SRFF'].includes(tipo)) {
    componente.saidas[0].valor = 0;
    if (componente.saidas[1]) componente.saidas[1].valor = 1;
  } else if (tipo === 'COUNTER' || tipo === 'REGISTER') {
    for (const s of componente.saidas) s.valor = 0;
  } else if (tipo === 'SWITCH' || tipo === 'CLOCK') {
    componente.saidas[0].valor = 0;
  }

  return componente;
}

/** Cria um circuito vazio. */
export function criarCircuito() {
  return {
    componentes: [],
    fios: [],
    iteracoesUltimaPropagacao: 0,
    estavel: true,
  };
}

/** Adiciona um componente ao circuito. */
export function adicionarComponente(circuito, componente) {
  circuito.componentes.push(componente);
  return componente;
}

/** Remove um componente e todos os fios ligados a ele. */
export function removerComponente(circuito, componenteId) {
  circuito.componentes = circuito.componentes.filter((c) => c.id !== componenteId);
  circuito.fios = circuito.fios.filter(
    (f) =>
      f.origem.componente !== componenteId &&
      f.destino.componente !== componenteId
  );
}

/** Busca um componente pelo id. */
export function buscarComponente(circuito, componenteId) {
  return circuito.componentes.find((c) => c.id === componenteId) || null;
}

/** Busca um pino específico. Retorna { componente, pino, direcao }. */
export function buscarPino(circuito, componenteId, pinoId) {
  const comp = buscarComponente(circuito, componenteId);
  if (!comp) return null;

  const entrada = comp.entradas.find((p) => p.id === pinoId);
  if (entrada) return { componente: comp, pino: entrada, direcao: 'entrada' };

  const saida = comp.saidas.find((p) => p.id === pinoId);
  if (saida) return { componente: comp, pino: saida, direcao: 'saida' };

  return null;
}

/**
 * Conecta dois pinos criando um fio.
 * Valida que origem é saída e destino é entrada.
 * Retorna o fio criado ou null se inválido.
 */
export function conectar(circuito, origem, destino) {
  const pinoOrigem = buscarPino(circuito, origem.componente, origem.pino);
  const pinoDestino = buscarPino(circuito, destino.componente, destino.pino);

  if (!pinoOrigem || !pinoDestino) return null;
  if (pinoOrigem.direcao !== 'saida') return null;
  if (pinoDestino.direcao !== 'entrada') return null;
  if (origem.componente === destino.componente) return null;

  const novo = criarFio(
    origem.componente,
    origem.pino,
    destino.componente,
    destino.pino
  );

  if (fioExiste(circuito.fios, novo)) return null;

  circuito.fios.push(novo);
  return novo;
}

/** Desconecta um fio pelo id. */
export function desconectar(circuito, fioId) {
  circuito.fios = circuito.fios.filter((f) => f.id !== fioId);
}

/**
 * Resolve o valor de um pino de entrada lendo o fio que chega nele.
 * Se não houver fio, retorna null (indefinido).
 */
function lerEntrada(circuito, componenteId, pinoId) {
  const fio = circuito.fios.find(
    (f) => f.destino.componente === componenteId && f.destino.pino === pinoId
  );
  if (!fio) return null;

  const origem = buscarPino(circuito, fio.origem.componente, fio.origem.pino);
  return origem ? origem.pino.valor : null;
}

/**
 * Avalia um componente combinacional e escreve nas saídas.
 * Componentes sequenciais são tratados em clock.js.
 */
function avaliarComponente(circuito, comp) {
  if (comp.tipo === 'SWITCH') {
    comp.saidas[0].valor = normalizar(comp.estado.ativo ?? 0);
    return;
  }

  if (comp.tipo === 'LED') {
    comp.estado.aceso = normalizar(lerEntrada(circuito, comp.id, 'in0')) === 1;
    return;
  }

  if (comp.tipo === 'CLOCK') {
    comp.saidas[0].valor = normalizar(comp.estado.nivel ?? 0);
    return;
  }

  if (TIPOS_SEQUENCIAIS.has(comp.tipo)) {
    return;
  }

  if (TIPOS_COMBINACIONAIS.has(comp.tipo)) {
    const entradas = comp.entradas.map((p) =>
      lerEntrada(circuito, comp.id, p.id)
    );
    comp.saidas[0].valor = avaliarPorta(comp.tipo, entradas);
  }
}

/**
 * Propaga sinais por todo o circuito até estabilizar.
 * Retorna o número de iterações usadas.
 */
export function propagar(circuito) {
  let iteracoes = 0;
  let mudou = true;

  while (mudou && iteracoes < MAX_ITERACOES) {
    mudou = false;
    iteracoes++;

    for (const comp of circuito.componentes) {
      const antes = comp.saidas.map((s) => s.valor);
      avaliarComponente(circuito, comp);
      const depois = comp.saidas.map((s) => s.valor);

      if (antes.some((v, i) => v !== depois[i])) {
        mudou = true;
      }
    }
  }

  circuito.iteracoesUltimaPropagacao = iteracoes;
  circuito.estavel = iteracoes < MAX_ITERACOES;
  return iteracoes;
}

/**
 * Define o estado de um switch manualmente.
 * @param {object} circuito
 * @param {string} componenteId
 * @param {number} valor - 0 ou 1
 */
export function acionarSwitch(circuito, componenteId, valor) {
  const comp = buscarComponente(circuito, componenteId);
  if (!comp || comp.tipo !== 'SWITCH') return false;
  comp.estado.ativo = normalizar(valor);
  propagar(circuito);
  return true;
}

/**
 * Lê o estado de um LED.
 */
export function lerLed(circuito, componenteId) {
  const comp = buscarComponente(circuito, componenteId);
  if (!comp || comp.tipo !== 'LED') return null;
  return comp.estado.aceso ?? false;
}

/** Retorna todos os valores de saída de um componente. */
export function lerSaidas(circuito, componenteId) {
  const comp = buscarComponente(circuito, componenteId);
  if (!comp) return null;
  return comp.saidas.map((s) => s.valor);
}