/**
 * wire.js — Representação de conexões entre pinos.
 * Um fio liga SEMPRE uma saída a uma entrada. Nunca saída-saída.
 */

let contadorFios = 0;

/**
 * Cria um fio entre dois pinos.
 * @param {string} origemComp - id do componente de origem
 * @param {string} origemPino - id do pino de saída
 * @param {string} destinoComp - id do componente de destino
 * @param {string} destinoPino - id do pino de entrada
 */
export function criarFio(origemComp, origemPino, destinoComp, destinoPino) {
  return {
    id: `fio_${++contadorFios}`,
    origem: { componente: origemComp, pino: origemPino },
    destino: { componente: destinoComp, pino: destinoPino },
  };
}

/** Verifica se dois fios são iguais (mesma origem e destino). */
export function fiosIguais(a, b) {
  return (
    a.origem.componente === b.origem.componente &&
    a.origem.pino === b.origem.pino &&
    a.destino.componente === b.destino.componente &&
    a.destino.pino === b.destino.pino
  );
}

/** Verifica se um fio já existe na lista. */
export function fioExiste(fios, candidato) {
  return fios.some((f) => fiosIguais(f, candidato));
}

/** Remove um fio pelo id. Retorna a nova lista. */
export function removerFio(fios, fioId) {
  return fios.filter((f) => f.id !== fioId);
}

/** Retorna todos os fios que chegam a um componente. */
export function fiosDeEntrada(fios, componenteId) {
  return fios.filter((f) => f.destino.componente === componenteId);
}

/** Retorna todos os fios que saem de um componente. */
export function fiosDeSaida(fios, componenteId) {
  return fios.filter((f) => f.origem.componente === componenteId);
}