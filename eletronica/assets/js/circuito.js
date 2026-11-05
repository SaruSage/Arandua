/**
 * circuito.js — Estado do circuito: componentes, fios e grupos.
 * Não desenha nada; só guarda e manipula dados.
 */

import { criarInstancia, CATALOGO } from './catalogo.js';

export function criarCircuito() {
  return {
    componentes: [],
    fios: [],
    grupos: [],
    proximoId: 1,
  };
}

/** Adiciona um componente ao circuito. */
export function adicionarComponente(circuito, tipo, x, y) {
  if (!Number.isInteger(circuito.proximoId) || circuito.proximoId < 1) {
    circuito.proximoId = circuito.componentes.reduce((proximo, componente) => {
      const correspondencia = /^c(\d+)$/.exec(componente.id || '');
      return correspondencia ? Math.max(proximo, Number(correspondencia[1]) + 1) : proximo;
    }, 1);
  }
  const comp = criarInstancia(tipo, x, y);
  comp.id = `c${circuito.proximoId++}`;
  circuito.componentes.push(comp);
  return comp;
}

/** Remove um componente e todos os fios ligados a ele. */
export function removerComponente(circuito, id) {
  circuito.componentes = circuito.componentes.filter((c) => c.id !== id);
  circuito.fios = circuito.fios.filter(
    (f) => f.origem.componente !== id && f.destino.componente !== id
  );
}

/** Busca componente por id. */
export function buscarComponente(circuito, id) {
  return circuito.componentes.find((c) => c.id === id) || null;
}

/** Retorna o componente cujo corpo contém o ponto. */
export function componenteEm(circuito, x, y) {
  for (let i = circuito.componentes.length - 1; i >= 0; i--) {
    const c = circuito.componentes[i];
    const dim = CATALOGO[c.tipo].dimensoes;
    if (
      x >= c.x - 10 && x <= c.x + dim.w + 10 &&
      y >= c.y - 10 && y <= c.y + dim.h + 10
    ) {
      return c;
    }
  }
  return null;
}

/** Move um componente, com snap à grade. */
export function moverComponente(circuito, id, x, y, grade = 10) {
  const c = buscarComponente(circuito, id);
  if (!c) return;
  c.x = Math.round(x / grade) * grade;
  c.y = Math.round(y / grade) * grade;
}

/** Rotaciona um componente em graus. */
export function rotacionarComponente(circuito, id, angulo) {
  const c = buscarComponente(circuito, id);
  if (!c) return;
  c.rotacao = ((angulo % 360) + 360) % 360;
}

/** Atualiza uma propriedade de um componente. */
export function atualizarPropriedade(circuito, id, chave, valor) {
  const c = buscarComponente(circuito, id);
  if (!c) return;
  c.propriedades[chave] = valor;
}

/** Retorna as dimensões de um componente. */
export function dimensoes(circuito, id) {
  const c = buscarComponente(circuito, id);
  if (!c) return { w: 0, h: 0 };
  return CATALOGO[c.tipo].dimensoes;
}