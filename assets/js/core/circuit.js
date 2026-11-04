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

  return {
    id: `comp_${++contadorComponentes}`,
    tipo,
    rotulo,
    posicao: { ...posicao },
    entradas,
    saidas,
    // Estado interno (usado por flip-flops, contadores, etc.)
    estado: {},
  };
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
  // Componentes de IO e sequenciais têm comportamento próprio
  switch (comp.tipo) {
    case 'SWITCH':
      // Switch controla sua própria saída via estado
      comp.saidas[0].valor = normalizar(comp.estado.ativo ?? 0);
      return;

    case 'LED':
      // LED apenas reflete a entrada; não tem saída
      comp.estado.aceso = normalizar(lerEntrada(circuito, comp.id, 'in0')) === 1;
      return;

    case 'CLOCK':
      // Clock controla sua própria saída via estado
      comp.saidas[0].valor = normalizar(comp.estado.nivel ?? 0);
      return;

    case 'DFF':
    case 'JKFF':
    case 'TFF':
    case 'SRFF':
    case 'COUNTER':
    case 'REGISTER':
      // Sequenciais: só mudam na borda de clock (ver clock.js)
      return;

    default:
      // Portas combinacionais puras
      if (comp.tipo in { AND: 1, OR: 1, NOT: 1, NAND: 1, NOR: 1, XOR: 1, XNOR: 1, BUFFER: 1 }) {
        const entradas = comp.entradas.map((p) =>
          lerEntrada(circuito, comp.id, p.id)
        );
        comp.saidas[0].valor = avaliarPorta(comp.tipo, entradas);
      }
      return;
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