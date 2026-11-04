/**
 * gate.js — Tipos de porta lógica e avaliação booleana.
 * Puro, sem dependências. Cada porta é uma função de N entradas → 1 saída.
 */

/** Valores lógicos possíveis. null = indefinido (entrada não conectada). */
export const LOGICO = Object.freeze({
  ZERO: 0,
  UM: 1,
  INDEFINIDO: null,
});

/**
 * Normaliza um valor bruto para 0, 1 ou null.
 * Aceita boolean, number e string numérica.
 */
export function normalizar(valor) {
  if (valor === null || valor === undefined) return null;
  if (valor === true) return 1;
  if (valor === false) return 0;
  const n = Number(valor);
  if (Number.isNaN(n)) return null;
  return n === 0 ? 0 : 1;
}

/** Inverte um valor lógico. Indefinido permanece indefinido. */
export function nao(valor) {
  const v = normalizar(valor);
  if (v === null) return null;
  return v === 0 ? 1 : 0;
}

/**
 * Tabela de avaliação por tipo de porta.
 * Cada função recebe um array de entradas já normalizadas.
 * Retorna 0, 1 ou null.
 */
const AVALIADORES = {
  AND(entradas) {
    if (entradas.some((e) => e === 0)) return 0;
    if (entradas.some((e) => e === null)) return null;
    return 1;
  },

  OR(entradas) {
    if (entradas.some((e) => e === 1)) return 1;
    if (entradas.some((e) => e === null)) return null;
    return 0;
  },

  NOT(entradas) {
    return nao(entradas[0]);
  },

  NAND(entradas) {
    return nao(AVALIADORES.AND(entradas));
  },

  NOR(entradas) {
    return nao(AVALIADORES.OR(entradas));
  },

  XOR(entradas) {
    if (entradas.some((e) => e === null)) return null;
    // XOR de N entradas: 1 se a quantidade de 1s for ímpar
    const uns = entradas.filter((e) => e === 1).length;
    return uns % 2 === 1 ? 1 : 0;
  },

  XNOR(entradas) {
    return nao(AVALIADORES.XOR(entradas));
  },

  BUFFER(entradas) {
    return normalizar(entradas[0]);
  },
};

/**
 * Avalia uma porta pelo tipo.
 * @param {string} tipo - AND, OR, NOT, NAND, NOR, XOR, XNOR, BUFFER
 * @param {Array<number|null>} entradas
 * @returns {number|null}
 */
export function avaliarPorta(tipo, entradas) {
  const avaliador = AVALIADORES[tipo];
  if (!avaliador) {
    throw new Error(`Tipo de porta desconhecido: ${tipo}`);
  }
  return avaliador(entradas.map(normalizar));
}

/** Lista de tipos de porta disponíveis. */
export const TIPOS_PORTA = Object.keys(AVALIADORES);

/**
 * Gera a tabela-verdade de uma porta de N entradas.
 * Útil para os módulos pedagógicos (Módulo 3).
 * @param {string} tipo
 * @param {number} numEntradas
 * @returns {Array<{entradas: number[], saida: number|null}>}
 */
export function tabelaVerdade(tipo, numEntradas) {
  const linhas = [];
  const total = 2 ** numEntradas;
  for (let i = 0; i < total; i++) {
    const entradas = [];
    for (let bit = numEntradas - 1; bit >= 0; bit--) {
      entradas.push((i >> bit) & 1);
    }
    linhas.push({ entradas, saida: avaliarPorta(tipo, entradas) });
  }
  return linhas;
}