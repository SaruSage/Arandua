/**
 * clock.js — Gerador de clock e disparo de componentes sequenciais.
 * A borda de subida (0 → 1) é o que faz flip-flops capturarem dados.
 */

import { normalizar } from './gate.js';
import { buscarComponente, propagar } from './circuit.js';

/**
 * Cria um componente de clock.
 * @param {number} frequenciaHz - frequência em Hz (para animação)
 */
export function criarClock(frequenciaHz = 1) {
  return {
    id: `clock_${Date.now()}`,
    tipo: 'CLOCK',
    rotulo: 'Clock',
    posicao: { x: 0, y: 0 },
    entradas: [],
    saidas: [{ id: 'out0', valor: 0 }],
    estado: {
      nivel: 0,
      frequenciaHz,
      rodando: false,
      ciclos: 0,
    },
  };
}

/**
 * Avança o clock em um semiciclo (toggle).
 * Detecta a borda e dispara os sequenciais.
 * @returns {{ bordaSubida: boolean, bordaDescida: boolean }}
 */
export function tictac(circuito) {
  const clock = circuito.componentes.find((c) => c.tipo === 'CLOCK');
  if (!clock) return { bordaSubida: false, bordaDescida: false };

  const nivelAnterior = clock.estado.nivel;
  const nivelNovo = nivelAnterior === 0 ? 1 : 0;

  clock.estado.nivel = nivelNovo;
  clock.saidas[0].valor = nivelNovo;

  const bordaSubida = nivelAnterior === 0 && nivelNovo === 1;
  const bordaDescida = nivelAnterior === 1 && nivelNovo === 0;

  if (bordaSubida) {
    clock.estado.ciclos++;
    dispararSequenciais(circuito);
  }

  propagar(circuito);

  return { bordaSubida, bordaDescida };
}

/**
 * Dispara todos os componentes sequenciais na borda de subida.
 * Cada tipo tem sua regra de captura.
 */
function dispararSequenciais(circuito) {
  // Ordem importa: primeiro capturamos os valores de entrada de todos,
  // depois aplicamos. Isso evita que um flip-flop veja a saída já
  // atualizada de outro no mesmo ciclo.
  const capturas = [];

  for (const comp of circuito.componentes) {
    if (comp.tipo === 'DFF') {
      const d = lerEntrada(circuito, comp.id, 'in0');
      capturas.push({ comp, novoEstado: { q: normalizar(d) } });
    } else if (comp.tipo === 'TFF') {
      const t = lerEntrada(circuito, comp.id, 'in0');
      const qAtual = comp.estado.q ?? 0;
      const qNovo = normalizar(t) === 1 ? (qAtual === 1 ? 0 : 1) : qAtual;
      capturas.push({ comp, novoEstado: { q: qNovo } });
    } else if (comp.tipo === 'SRFF') {
      const s = normalizar(lerEntrada(circuito, comp.id, 'in0'));
      const r = normalizar(lerEntrada(circuito, comp.id, 'in1'));
      const qAtual = comp.estado.q ?? 0;
      let qNovo = qAtual;
      if (s === 1 && r === 0) qNovo = 1;
      else if (s === 0 && r === 1) qNovo = 0;
      else if (s === 1 && r === 1) qNovo = null; // estado inválido
      capturas.push({ comp, novoEstado: { q: qNovo } });
    } else if (comp.tipo === 'JKFF') {
      const j = normalizar(lerEntrada(circuito, comp.id, 'in0'));
      const k = normalizar(lerEntrada(circuito, comp.id, 'in1'));
      const qAtual = comp.estado.q ?? 0;
      let qNovo = qAtual;
      if (j === 1 && k === 0) qNovo = 1;
      else if (j === 0 && k === 1) qNovo = 0;
      else if (j === 1 && k === 1) qNovo = qAtual === 1 ? 0 : 1;
      capturas.push({ comp, novoEstado: { q: qNovo } });
    } else if (comp.tipo === 'COUNTER') {
      const bits = comp.estado.bits ?? 4;
      const valorAtual = comp.estado.valor ?? 0;
      const valorNovo = (valorAtual + 1) % 2 ** bits;
      capturas.push({ comp, novoEstado: { valor: valorNovo } });
    } else if (comp.tipo === 'REGISTER') {
      const bits = comp.estado.bits ?? 4;
      const valores = [];
      for (let i = 0; i < bits; i++) {
        valores.push(normalizar(lerEntrada(circuito, comp.id, `in${i}`)) ?? 0);
      }
      capturas.push({ comp, novoEstado: { valor: valores } });
    }
  }

  // Aplica todas as capturas de uma vez
  for (const { comp, novoEstado } of capturas) {
    Object.assign(comp.estado, novoEstado);
    aplicarSaidasSequencial(comp);
  }
}

/** Escreve o estado interno de um sequencial nas suas saídas. */
function aplicarSaidasSequencial(comp) {
  if (comp.tipo === 'COUNTER') {
    const bits = comp.estado.bits ?? 4;
    const valor = comp.estado.valor ?? 0;
    for (let i = 0; i < bits; i++) {
      comp.saidas[i].valor = (valor >> i) & 1;
    }
  } else if (comp.tipo === 'REGISTER') {
    const valores = comp.estado.valor ?? [];
    for (let i = 0; i < valores.length; i++) {
      comp.saidas[i].valor = valores[i];
    }
  } else {
    // Flip-flops simples: saída Q e Q-negado
    comp.saidas[0].valor = comp.estado.q ?? null;
    if (comp.saidas[1]) {
      comp.saidas[1].valor =
        comp.estado.q === null ? null : comp.estado.q === 1 ? 0 : 1;
    }
  }
}

/** Lê o valor de uma entrada (helper local, evita import circular). */
function lerEntrada(circuito, componenteId, pinoId) {
  const fio = circuito.fios.find(
    (f) => f.destino.componente === componenteId && f.destino.pino === pinoId
  );
  if (!fio) return null;
  const origem = buscarComponente(circuito, fio.origem.componente);
  if (!origem) return null;
  const pino = origem.saidas.find((p) => p.id === fio.origem.pino);
  return pino ? pino.valor : null;
}

/**
 * Reseta o clock e todos os sequenciais ao estado inicial.
 */
export function resetar(circuito) {
  const clock = circuito.componentes.find((c) => c.tipo === 'CLOCK');
  if (clock) {
    clock.estado.nivel = 0;
    clock.estado.ciclos = 0;
    clock.saidas[0].valor = 0;
  }

  for (const comp of circuito.componentes) {
    if (['DFF', 'TFF', 'JKFF', 'SRFF'].includes(comp.tipo)) {
      comp.estado.q = 0;
      comp.saidas[0].valor = 0;
      if (comp.saidas[1]) comp.saidas[1].valor = 1;
    } else if (comp.tipo === 'COUNTER') {
      comp.estado.valor = 0;
      for (const s of comp.saidas) s.valor = 0;
    } else if (comp.tipo === 'REGISTER') {
      comp.estado.valor = new Array(comp.estado.bits ?? 4).fill(0);
      for (const s of comp.saidas) s.valor = 0;
    }
  }

  propagar(circuito);
}