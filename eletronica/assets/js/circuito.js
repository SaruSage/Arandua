/**
 * circuito.js — Estado do circuito: componentes, fios e grupos.
 * Não desenha nada; só guarda e manipula dados.
 */

import { criarInstancia, CATALOGO, obterDimensoesComponente } from './catalogo.js';

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
  const proximoIdDisponivel = circuito.componentes.reduce((proximo, componente) => {
    const correspondencia = /^c(\d+)$/.exec(componente.id || '');
    return correspondencia ? Math.max(proximo, Number(correspondencia[1]) + 1) : proximo;
  }, 1);
  if (
    !Number.isInteger(circuito.proximoId)
    || circuito.proximoId < proximoIdDisponivel
  ) {
    circuito.proximoId = proximoIdDisponivel;
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

/** Retorna o componente cujo corpo ou pino contém o ponto. */
export function componenteEm(circuito, x, y) {
  for (let i = circuito.componentes.length - 1; i >= 0; i--) {
    const c = circuito.componentes[i];
    const dim = c.tipo === 'LED' && c.propriedades?.estilo === 'Alternativo'
      ? obterDimensoesComponente(c.tipo, c.propriedades)
      : c.dimensoes || CATALOGO[c.tipo]?.dimensoes || { w: 64, h: 30 };
    const cx = c.x + dim.w / 2;
    const cy = c.y + dim.h / 2;
    const rad = ((c.rotacao || 0) * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const localX = dx * Math.cos(rad) + dy * Math.sin(rad);
    const localY = -dx * Math.sin(rad) + dy * Math.cos(rad);

    if (c.tipo === 'NO') {
      if (Math.hypot(x - cx, y - cy) <= 12) {
        return c;
      }
    } else if (
      Math.abs(localX) <= dim.w / 2 + 10
      && Math.abs(localY) <= dim.h / 2 + 10
    ) {
      return c;
    }

    const pinos = c.pinos || CATALOGO[c.tipo]?.pinos || [];
    for (const pino of pinos) {
      const pinoX = cx + pino.x * Math.cos(rad) - pino.y * Math.sin(rad);
      const pinoY = cy + pino.x * Math.sin(rad) + pino.y * Math.cos(rad);
      if (Math.hypot(x - pinoX, y - pinoY) <= 10) return c;
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
  return c.tipo === 'LED' && c.propriedades?.estilo === 'Alternativo'
    ? obterDimensoesComponente(c.tipo, c.propriedades)
    : c.dimensoes || CATALOGO[c.tipo].dimensoes;
}