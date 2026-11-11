/**
 * montagens.js — Sub-circuitos internos para "Ver montagem".
 * Cada montagem descreve como um componente composto é construído
 * a partir de peças menores, com posições relativas em um canvas
 * virtual de 800x500.
 */

import { posicaoPino } from './simbolos.js';
import { obterDimensoesComponente } from './catalogo.js';

/**
 * Estrutura de uma montagem:
 * {
 *   titulo: string,
 *   descricao: string,
 *   componentes: [{ tipo, x, y, rotacao, propriedades, rotulo }],
 *   fios: [{ de: {comp, pino}, para: {comp, pino} }],
 *   notas: [{ x, y, texto }],
 * }
 */

/* ===== PORTAS LÓGICAS EM CMOS ===== */

const MONTAGEM_NOT = {
  titulo: 'NOT em CMOS',
  descricao: 'Um inversor CMOS usa dois transistores: um PMOS em cima (pull-up) e um NMOS embaixo (pull-down). Quando a entrada é 0, o PMOS conduz e a saída vai para Vcc. Quando a entrada é 1, o NMOS conduz e a saída vai para GND.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 260, y: 90, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS (pull-up)' },
    { tipo: 'TRANSISTOR_NPN', x: 260, y: 260, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS (pull-down)' },
    { tipo: 'BATERIA', x: 60, y: 380, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 520, y: 180, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 2, pino: 'c' } },
    { de: { comp: 2, pino: 'e' }, para: { comp: 3, pino: 'p1' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 4, pino: 'p1' } },
    { de: { comp: 4, pino: 'p2' }, para: { comp: 3, pino: 'p1' } },
  ],
  notas: [
    { x: 380, y: 60, texto: 'Entrada A → base dos dois transistores' },
    { x: 380, y: 340, texto: 'Saída Y no ponto entre os transistores' },
  ],
};

const MONTAGEM_NAND = {
  titulo: 'NAND em CMOS',
  descricao: 'A NAND CMOS usa 4 transistores: dois PMOS em paralelo (pull-up) e dois NMOS em série (pull-down). A saída só vai a 0 quando ambas as entradas são 1.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 240, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS A' },
    { tipo: 'TRANSISTOR_PNP', x: 380, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS B' },
    { tipo: 'TRANSISTOR_NPN', x: 300, y: 240, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS A' },
    { tipo: 'TRANSISTOR_NPN', x: 300, y: 360, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS B' },
    { tipo: 'BATERIA', x: 60, y: 440, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 560, y: 200, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 2, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 3, pino: 'c' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 3, pino: 'c' } },
    { de: { comp: 3, pino: 'e' }, para: { comp: 4, pino: 'c' } },
    { de: { comp: 4, pino: 'e' }, para: { comp: 5, pino: 'p1' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 6, pino: 'p1' } },
    { de: { comp: 6, pino: 'p2' }, para: { comp: 5, pino: 'p1' } },
  ],
  notas: [
    { x: 480, y: 60, texto: 'PMOS em paralelo (pull-up)' },
    { x: 480, y: 320, texto: 'NMOS em série (pull-down)' },
  ],
};

const MONTAGEM_AND = {
  titulo: 'AND em CMOS',
  descricao: 'A AND é uma NAND seguida de um inversor. São 6 transistores no total: 4 para a NAND e 2 para o NOT.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 220, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS A' },
    { tipo: 'TRANSISTOR_PNP', x: 340, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS B' },
    { tipo: 'TRANSISTOR_NPN', x: 280, y: 240, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS A' },
    { tipo: 'TRANSISTOR_NPN', x: 280, y: 360, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS B' },
    { tipo: 'TRANSISTOR_PNP', x: 500, y: 160, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS inv' },
    { tipo: 'TRANSISTOR_NPN', x: 500, y: 300, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS inv' },
    { tipo: 'BATERIA', x: 60, y: 440, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 660, y: 220, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 2, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 3, pino: 'c' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 3, pino: 'c' } },
    { de: { comp: 3, pino: 'e' }, para: { comp: 4, pino: 'c' } },
    { de: { comp: 4, pino: 'e' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 5, pino: 'b' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 6, pino: 'b' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 5, pino: 'e' } },
    { de: { comp: 6, pino: 'e' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 5, pino: 'c' }, para: { comp: 8, pino: 'p1' } },
    { de: { comp: 8, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
  ],
  notas: [
    { x: 200, y: 40, texto: 'NAND (4 transistores)' },
    { x: 500, y: 40, texto: 'Inversor (2 transistores)' },
  ],
};

const MONTAGEM_OR = {
  titulo: 'OR em CMOS',
  descricao: 'A OR é uma NOR seguida de um inversor. A NOR usa dois PMOS em série e dois NMOS em paralelo.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 220, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS A' },
    { tipo: 'TRANSISTOR_PNP', x: 220, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS B' },
    { tipo: 'TRANSISTOR_NPN', x: 380, y: 100, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS A' },
    { tipo: 'TRANSISTOR_NPN', x: 380, y: 240, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS B' },
    { tipo: 'TRANSISTOR_PNP', x: 540, y: 160, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS inv' },
    { tipo: 'TRANSISTOR_NPN', x: 540, y: 300, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS inv' },
    { tipo: 'BATERIA', x: 60, y: 440, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 700, y: 220, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 2, pino: 'e' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 3, pino: 'c' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 4, pino: 'c' } },
    { de: { comp: 3, pino: 'e' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 4, pino: 'e' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 5, pino: 'b' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 6, pino: 'b' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 5, pino: 'e' } },
    { de: { comp: 6, pino: 'e' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 5, pino: 'c' }, para: { comp: 8, pino: 'p1' } },
    { de: { comp: 8, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
  ],
  notas: [
    { x: 200, y: 40, texto: 'NOR (4 transistores)' },
    { x: 540, y: 40, texto: 'Inversor (2 transistores)' },
  ],
};

const MONTAGEM_NOR = {
  titulo: 'NOR em CMOS',
  descricao: 'A NOR usa dois PMOS em série (pull-up) e dois NMOS em paralelo (pull-down). A saída só vai a 1 quando ambas as entradas são 0.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 240, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS A' },
    { tipo: 'TRANSISTOR_PNP', x: 240, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS B' },
    { tipo: 'TRANSISTOR_NPN', x: 400, y: 100, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS A' },
    { tipo: 'TRANSISTOR_NPN', x: 400, y: 240, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS B' },
    { tipo: 'BATERIA', x: 60, y: 440, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 580, y: 180, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 2, pino: 'e' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 3, pino: 'c' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 4, pino: 'c' } },
    { de: { comp: 3, pino: 'e' }, para: { comp: 5, pino: 'p1' } },
    { de: { comp: 4, pino: 'e' }, para: { comp: 5, pino: 'p1' } },
    { de: { comp: 2, pino: 'c' }, para: { comp: 6, pino: 'p1' } },
    { de: { comp: 6, pino: 'p2' }, para: { comp: 5, pino: 'p1' } },
  ],
  notas: [
    { x: 200, y: 40, texto: 'PMOS em série (pull-up)' },
    { x: 480, y: 320, texto: 'NMOS em paralelo (pull-down)' },
  ],
};

const MONTAGEM_XOR = {
  titulo: 'XOR em CMOS',
  descricao: 'A XOR é a mais complexa das portas básicas: usa 12 transistores. É construída como (A NAND (A NAND B)) NAND (B NAND (A NAND B)) — quatro NANDs de 3 transistores cada.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 200, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 1' },
    { tipo: 'TRANSISTOR_NPN', x: 200, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 1' },
    { tipo: 'TRANSISTOR_PNP', x: 360, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 2' },
    { tipo: 'TRANSISTOR_NPN', x: 360, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 2' },
    { tipo: 'TRANSISTOR_PNP', x: 520, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 3' },
    { tipo: 'TRANSISTOR_NPN', x: 520, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 3' },
    { tipo: 'TRANSISTOR_PNP', x: 680, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 4' },
    { tipo: 'TRANSISTOR_NPN', x: 680, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 4' },
    { tipo: 'BATERIA', x: 60, y: 440, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 680, y: 340, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 3, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 5, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 7, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 2, pino: 'c' } },
    { de: { comp: 3, pino: 'c' }, para: { comp: 4, pino: 'c' } },
    { de: { comp: 5, pino: 'c' }, para: { comp: 6, pino: 'c' } },
    { de: { comp: 7, pino: 'c' }, para: { comp: 8, pino: 'c' } },
    { de: { comp: 2, pino: 'e' }, para: { comp: 9, pino: 'p1' } },
    { de: { comp: 4, pino: 'e' }, para: { comp: 9, pino: 'p1' } },
    { de: { comp: 6, pino: 'e' }, para: { comp: 9, pino: 'p1' } },
    { de: { comp: 8, pino: 'e' }, para: { comp: 9, pino: 'p1' } },
    { de: { comp: 7, pino: 'c' }, para: { comp: 10, pino: 'p1' } },
    { de: { comp: 10, pino: 'p2' }, para: { comp: 9, pino: 'p1' } },
  ],
  notas: [
    { x: 200, y: 40, texto: '4 NANDs em cascata' },
    { x: 620, y: 400, texto: '12 transistores no total' },
  ],
};

const MONTAGEM_XNOR = {
  titulo: 'XNOR em CMOS',
  descricao: 'A XNOR é uma XOR seguida de um inversor. São 14 transistores: 12 da XOR mais 2 do inversor final.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 180, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 1' },
    { tipo: 'TRANSISTOR_NPN', x: 180, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 1' },
    { tipo: 'TRANSISTOR_PNP', x: 320, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 2' },
    { tipo: 'TRANSISTOR_NPN', x: 320, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 2' },
    { tipo: 'TRANSISTOR_PNP', x: 460, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 3' },
    { tipo: 'TRANSISTOR_NPN', x: 460, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 3' },
    { tipo: 'TRANSISTOR_PNP', x: 600, y: 80, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 4' },
    { tipo: 'TRANSISTOR_NPN', x: 600, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 4' },
    { tipo: 'TRANSISTOR_PNP', x: 720, y: 140, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS inv' },
    { tipo: 'TRANSISTOR_NPN', x: 720, y: 280, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS inv' },
    { tipo: 'BATERIA', x: 60, y: 440, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 720, y: 400, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 3, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 5, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 7, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 2, pino: 'c' } },
    { de: { comp: 3, pino: 'c' }, para: { comp: 4, pino: 'c' } },
    { de: { comp: 5, pino: 'c' }, para: { comp: 6, pino: 'c' } },
    { de: { comp: 7, pino: 'c' }, para: { comp: 8, pino: 'c' } },
    { de: { comp: 2, pino: 'e' }, para: { comp: 11, pino: 'p1' } },
    { de: { comp: 4, pino: 'e' }, para: { comp: 11, pino: 'p1' } },
    { de: { comp: 6, pino: 'e' }, para: { comp: 11, pino: 'p1' } },
    { de: { comp: 8, pino: 'e' }, para: { comp: 11, pino: 'p1' } },
    { de: { comp: 7, pino: 'c' }, para: { comp: 9, pino: 'b' } },
    { de: { comp: 7, pino: 'c' }, para: { comp: 10, pino: 'b' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 9, pino: 'e' } },
    { de: { comp: 10, pino: 'e' }, para: { comp: 11, pino: 'p1' } },
    { de: { comp: 9, pino: 'c' }, para: { comp: 12, pino: 'p1' } },
    { de: { comp: 12, pino: 'p2' }, para: { comp: 11, pino: 'p1' } },
  ],
  notas: [
    { x: 180, y: 40, texto: '4 NANDs (12 transistores)' },
    { x: 720, y: 40, texto: 'Inversor (2 transistores)' },
  ],
};

const MONTAGEM_BUFFER = {
  titulo: 'Buffer em CMOS',
  descricao: 'Um buffer CMOS usa dois inversores em cascata. São 4 transistores no total. O primeiro inverte, o segundo inverte de volta — o resultado é o sinal original com mais força para alimentar cargas.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 220, y: 100, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 1' },
    { tipo: 'TRANSISTOR_NPN', x: 220, y: 240, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 1' },
    { tipo: 'TRANSISTOR_PNP', x: 440, y: 100, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS 2' },
    { tipo: 'TRANSISTOR_NPN', x: 440, y: 240, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS 2' },
    { tipo: 'BATERIA', x: 60, y: 440, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 620, y: 180, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 3, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 2, pino: 'c' } },
    { de: { comp: 3, pino: 'c' }, para: { comp: 4, pino: 'c' } },
    { de: { comp: 2, pino: 'e' }, para: { comp: 5, pino: 'p1' } },
    { de: { comp: 4, pino: 'e' }, para: { comp: 5, pino: 'p1' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 3, pino: 'b' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 4, pino: 'b' } },
    { de: { comp: 3, pino: 'c' }, para: { comp: 6, pino: 'p1' } },
    { de: { comp: 6, pino: 'p2' }, para: { comp: 5, pino: 'p1' } },
  ],
  notas: [
    { x: 220, y: 40, texto: 'Inversor 1' },
    { x: 440, y: 40, texto: 'Inversor 2' },
  ],
};

/* ===== DISPLAY 7 SEGMENTOS ===== */

const MONTAGEM_DISPLAY = {
  titulo: 'Display 7 segmentos',
  descricao: 'Um display de 7 segmentos é feito de 7 LEDs individuais (a, b, c, d, e, f, g) mais o ponto decimal. Cada LED é um diodo emissor de luz. Todos compartilham o mesmo cátodo (ou ânodo, dependendo do tipo).',
  componentes: [
    { tipo: 'LED', x: 300, y: 80, rotacao: 0, propriedades: { cor: '#ff3b30', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'a (topo)' },
    { tipo: 'LED', x: 420, y: 140, rotacao: 90, propriedades: { cor: '#ff3b30', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'b (sup. dir.)' },
    { tipo: 'LED', x: 420, y: 260, rotacao: 90, propriedades: { cor: '#ff3b30', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'c (inf. dir.)' },
    { tipo: 'LED', x: 300, y: 320, rotacao: 0, propriedades: { cor: '#ff3b30', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'd (base)' },
    { tipo: 'LED', x: 180, y: 260, rotacao: 90, propriedades: { cor: '#ff3b30', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'e (inf. esq.)' },
    { tipo: 'LED', x: 180, y: 140, rotacao: 90, propriedades: { cor: '#ff3b30', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'f (sup. esq.)' },
    { tipo: 'LED', x: 300, y: 200, rotacao: 0, propriedades: { cor: '#ff3b30', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'g (meio)' },
    { tipo: 'BATERIA', x: 60, y: 440, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Comum' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 1, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 2, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 3, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 4, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 5, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 6, pino: 'p2' }, para: { comp: 7, pino: 'p1' } },
  ],
  notas: [
    { x: 300, y: 30, texto: '7 LEDs dispostos no formato de 8' },
    { x: 540, y: 200, texto: 'Todos compartilham o cátodo (COM)' },
  ],
};

/* ===== AMPLIFICADOR OPERACIONAL ===== */

const MONTAGEM_AMP_OP = {
  titulo: 'Amplificador Operacional',
  descricao: 'Um amp-op é um circuito complexo com cerca de 20 transistores. Internamente tem três estágios: diferencial de entrada (compara + e −), ganho intermediário (amplifica) e saída push-pull (entrega corrente). Aqui está uma versão simplificada com 6 transistores.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 12 }, rotulo: 'V+' },
    { tipo: 'BATERIA', x: 60, y: 400, rotacao: 90, propriedades: { tensao: 12 }, rotulo: 'V−' },
    { tipo: 'TRANSISTOR_NPN', x: 220, y: 140, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'Q1 (entrada +)' },
    { tipo: 'TRANSISTOR_NPN', x: 220, y: 280, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'Q2 (entrada −)' },
    { tipo: 'TRANSISTOR_NPN', x: 400, y: 200, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'Q3 (ganho)' },
    { tipo: 'TRANSISTOR_PNP', x: 560, y: 140, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'Q4 (push)' },
    { tipo: 'TRANSISTOR_NPN', x: 560, y: 280, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'Q5 (pull)' },
    { tipo: 'LED', x: 720, y: 210, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 2, pino: 'c' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 3, pino: 'c' } },
    { de: { comp: 2, pino: 'e' }, para: { comp: 4, pino: 'b' } },
    { de: { comp: 3, pino: 'e' }, para: { comp: 4, pino: 'b' } },
    { de: { comp: 4, pino: 'c' }, para: { comp: 5, pino: 'b' } },
    { de: { comp: 4, pino: 'c' }, para: { comp: 6, pino: 'b' } },
    { de: { comp: 0, pino: 'p1' }, para: { comp: 5, pino: 'e' } },
    { de: { comp: 6, pino: 'e' }, para: { comp: 1, pino: 'p1' } },
    { de: { comp: 5, pino: 'c' }, para: { comp: 7, pino: 'p1' } },
    { de: { comp: 7, pino: 'p2' }, para: { comp: 1, pino: 'p1' } },
  ],
  notas: [
    { x: 220, y: 60, texto: 'Par diferencial' },
    { x: 400, y: 60, texto: 'Estágio de ganho' },
    { x: 560, y: 60, texto: 'Saída push-pull' },
  ],
};

/* ===== CI GENÉRICO ===== */

const MONTAGEM_CI = {
  titulo: 'Circuito Integrado',
  descricao: 'Um CI genérico é um encapsulamento que contém circuitos internos. Dependendo da função escolhida, pode ser um buffer, inversor ou porta lógica. Aqui está a versão de inversor (2 transistores) como exemplo.',
  componentes: [
    { tipo: 'BATERIA', x: 60, y: 100, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'Vcc' },
    { tipo: 'TRANSISTOR_PNP', x: 260, y: 100, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: -0.7 }, rotulo: 'PMOS' },
    { tipo: 'TRANSISTOR_NPN', x: 260, y: 240, rotacao: 0, propriedades: { ganho: 100, tensaoBaseEmissor: 0.7 }, rotulo: 'NMOS' },
    { tipo: 'BATERIA', x: 60, y: 400, rotacao: 90, propriedades: { tensao: 5 }, rotulo: 'GND' },
    { tipo: 'LED', x: 460, y: 180, rotacao: 0, propriedades: { cor: '#53b588', tensaoDireta: 2, correnteNominal: 0.02 }, rotulo: 'Saída' },
  ],
  fios: [
    { de: { comp: 0, pino: 'p1' }, para: { comp: 1, pino: 'e' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 2, pino: 'c' } },
    { de: { comp: 2, pino: 'e' }, para: { comp: 3, pino: 'p1' } },
    { de: { comp: 1, pino: 'c' }, para: { comp: 4, pino: 'p1' } },
    { de: { comp: 4, pino: 'p2' }, para: { comp: 3, pino: 'p1' } },
  ],
  notas: [
    { x: 260, y: 60, texto: 'Circuito interno depende da função' },
  ],
};

/* ===== MAPA ===== */

export const MONTAGENS = {
  AND: MONTAGEM_AND,
  OR: MONTAGEM_OR,
  NOT: MONTAGEM_NOT,
  NAND: MONTAGEM_NAND,
  NOR: MONTAGEM_NOR,
  XOR: MONTAGEM_XOR,
  XNOR: MONTAGEM_XNOR,
  BUFFER: MONTAGEM_BUFFER,
  DISPLAY_7SEG: MONTAGEM_DISPLAY,
  AMP_OP: MONTAGEM_AMP_OP,
  CI_GENERICO: MONTAGEM_CI,
};

/** Retorna a montagem de um tipo, ou null. */
export function obterMontagem(tipo) {
  return MONTAGENS[tipo] || null;
}

/**
 * Desenha uma montagem em um canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} montagem
 * @param {object} desenharComponente - função do simbolos.js
 * @param {object} CATALOGO - catálogo de componentes
 */
export function desenharMontagem(ctx, montagem, desenharComponente, CATALOGO) {
  // Fundo
  ctx.save();
  ctx.fillStyle = '#f5f6f7';
  ctx.fillRect(0, 0, 800, 500);

  // Grade
  ctx.strokeStyle = '#e4e6e8';
  ctx.lineWidth = 1;
  for (let x = 0; x < 800; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 500);
    ctx.stroke();
  }
  for (let y = 0; y < 500; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
    ctx.stroke();
  }
  ctx.restore();

  // Fios primeiro
  ctx.save();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const fio of montagem.fios) {
    const compO = montagem.componentes[fio.de.comp];
    const compD = montagem.componentes[fio.para.comp];
    if (!compO || !compD) continue;

    const pO = posicaoPino({ ...compO, pinos: CATALOGO[compO.tipo].pinos, dimensoes: obterDimensoesComponente(compO.tipo, compO.propriedades), rotacao: compO.rotacao || 0 }, fio.de.pino);
    const pD = posicaoPino({ ...compD, pinos: CATALOGO[compD.tipo].pinos, dimensoes: obterDimensoesComponente(compD.tipo, compD.propriedades), rotacao: compD.rotacao || 0 }, fio.para.pino);
    if (!pO || !pD) continue;
    const x1 = pO.x;
    const y1 = pO.y;
    const x2 = pD.x;
    const y2 = pD.y;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  // Componentes
  for (const comp of montagem.componentes) {
    const def = CATALOGO[comp.tipo];
    if (!def) continue;
    const dim = obterDimensoesComponente(comp.tipo, comp.propriedades);

    const compFake = {
      tipo: comp.tipo,
      x: comp.x,
      y: comp.y,
      rotacao: comp.rotacao || 0,
      propriedades: comp.propriedades || {},
      pinos: def.pinos.map((p) => ({ ...p })),
      dimensoes: dim,
      estado: {},
    };

    desenharComponente(ctx, compFake, comp.x, comp.y, 1);

    // Rótulo do componente
    if (comp.rotulo) {
      ctx.save();
      ctx.fillStyle = '#2b2b2b';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(comp.rotulo, comp.x + dim.w / 2, comp.y + dim.h + 14);
      ctx.restore();
    }
  }

  // Notas
  for (const nota of montagem.notas || []) {
    ctx.save();
    ctx.fillStyle = '#3e9670';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(nota.texto, nota.x, nota.y);
    ctx.restore();
  }
}