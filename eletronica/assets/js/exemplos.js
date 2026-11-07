/**
 * exemplos.js — Catálogo e motor de injeção de circuitos de exemplo de portas lógicas,
 * construções industriais (transistores), didáticas (chaves) e circuitos de soma (somadores).
 * Todos os esquemas utilizam espaçamento amplo e roteamento limpo com trilhas dedicadas
 * para evitar cabos alinhados ou sobrepostos.
 */

import { adicionarComponente } from './circuito.js';
import { registrar } from './historico.js';
import { CORES_FIO } from './fios.js';
import { CATALOGO } from './catalogo.js';
import { posicaoPino } from './simbolos.js';
import { rotearFios } from './roteamento.js';
import { esquemaIndustrial, rotaEntradaOrtogonal, rotaSaidaOrtogonal } from './montagem.js';

export const CATEGORIAS_EXEMPLOS = [
  { id: 'somas', rotulo: 'Somas de Portas Lógicas', icone: '➕' },
  { id: 'industrial', rotulo: 'Construção Industrial (BJT)', icone: '🏭' },
  { id: 'didatica', rotulo: 'Demonstração Didática (Chaves)', icone: '💡' },
  { id: 'basica', rotulo: 'Aplicações Básicas', icone: '⚡' },
];

/**
 * Gera o exemplo industrial (AND ou OR) com o esquema de transistores desenhado pelo
 * usuário, ligado a duas chaves com resistores de pull-down e a um LED de saída.
 * Todas as dobras são calculadas a partir da posição real dos pinos (rotas ortogonais).
 */
function exemploIndustrialPorta(tipo) {
  const ehAnd = tipo === 'AND';
  const dim = (t) => CATALOGO[t].dimensoes;
  const peca = (ref, t, cx, cy, extra = {}) => ({
    ref,
    tipo: t,
    x: cx - dim(t).w / 2,
    y: cy - dim(t).h / 2,
    ...extra,
  });
  const pino = (t, cx, cy, rotacao, id) =>
    posicaoPino({ tipo: t, x: cx - dim(t).w / 2, y: cy - dim(t).h / 2, rotacao }, id);

  // Entrada e pull-downs (mesma geometria dos demais exemplos)
  const bat = { cx: 100, cy: 255 };
  const swA = { cx: 264, cy: 137 };
  const swB = { cx: 264, cy: 297 };
  const rPullA = { cx: 320, cy: 195 };
  const rPullB = { cx: 320, cy: 355 };
  const rLed = { cx: 872, cy: 215 };
  const led = { cx: 960, cy: 215 };
  const terra = { cx: 404, cy: 420 };

  const esq = esquemaIndustrial(tipo, 550, 186);
  const nomePeca = (ref) => `${tipo} - ${ref}`;

  const swA2 = pino('CHAVE', swA.cx, swA.cy, 0, 'p2');
  const swB2 = pino('CHAVE', swB.cx, swB.cy, 0, 'p2');
  const ledA = pino('RESISTOR', rLed.cx, rLed.cy, 0, 'p1');
  const entA = esq.pino(...esq.entradas.a);
  const entB = esq.pino(...esq.entradas.b);
  const sai = esq.pino(...esq.saida);
  const v1B = esq.pino('V1', 'p2');

  const componentes = [
    { ref: 'bat', tipo: 'BATERIA', x: bat.cx - 20, y: bat.cy - 15, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
    peca('swA', 'CHAVE', swA.cx, swA.cy, { propriedades: { fechada: false }, nomeCustom: 'Entrada A' }),
    peca('rPullA', 'RESISTOR', rPullA.cx, rPullA.cy, { propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' }),
    peca('swB', 'CHAVE', swB.cx, swB.cy, { propriedades: { fechada: false }, nomeCustom: 'Entrada B' }),
    peca('rPullB', 'RESISTOR', rPullB.cx, rPullB.cy, { propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' }),
    ...esq.pecas.map((p) => ({
      ref: p.ref,
      tipo: p.tipo,
      x: p.x,
      y: p.y,
      rotacao: p.rotacao,
      ...(p.propriedades ? { propriedades: p.propriedades } : {}),
      nomeCustom: nomePeca(p.ref),
    })),
    peca('rLed', 'RESISTOR', rLed.cx, rLed.cy, { propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' }),
    peca('led', 'LED', led.cx, led.cy, { propriedades: { cor: '#34C759' }, nomeCustom: 'Saída (Y)' }),
    peca('terra', 'NO', terra.cx, terra.cy, { nomeCustom: 'GND' }),
  ];

  const ligacoes = [
    // Alimentação das chaves
    ['bat.p1', 'swA.p1', '#FF3B30', [{ x: bat.cx, y: swA.cy }]],
    ['swA.p1', 'swB.p1', '#FF3B30'],
    // Entrada A: pull-down desce primeiro e o sinal segue reto até o nó InA
    ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: swA2.x, y: rPullA.cy }]],
    ['swA.p2', `${esq.entradas.a[0]}.${esq.entradas.a[1]}`, '#007AFF', rotaEntradaOrtogonal(swA2, entA)],
    // Entrada B
    ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: swB2.x, y: rPullB.cy }]],
    ['swB.p2', `${esq.entradas.b[0]}.${esq.entradas.b[1]}`, '#00C7BE', rotaEntradaOrtogonal(swB2, entB)],
    // Esquema industrial do usuário
    ...esq.fios,
    // Saída: nó OutY → resistor → LED
    [`${esq.saida[0]}.${esq.saida[1]}`, 'rLed.p1', '#34C759', rotaSaidaOrtogonal(sai, ledA)],
    ['rLed.p2', 'led.p1', '#34C759'],
    // Terra comum num nó, com uma direção de entrada para cada fio
    ['rPullA.p2', 'rPullB.p2', '#111827'],
    ['rPullB.p2', 'terra.p', '#111827'],
    ['terra.p', 'bat.p2', '#111827', [{ x: bat.cx, y: terra.cy }]],
    ['led.p2', 'terra.p', '#111827', [{ x: led.cx + 20, y: terra.cy + 40 }, { x: terra.cx, y: terra.cy + 40 }]],
    ['V1.p2', 'terra.p', '#111827', [{ x: v1B.x + 36, y: v1B.y }, { x: v1B.x + 36, y: terra.cy }]],
  ];

  return {
    id: ehAnd ? 'and-industrial' : 'or-industrial',
    categoria: 'industrial',
    titulo: ehAnd ? 'AND Industrial (Rede RTL)' : 'OR Industrial (Rede RTL)',
    badge: 'Lógica RTL / Transistor',
    descricao: ehAnd
      ? 'Rede RTL em duas etapas (NAND seguida de inversor), com resistores de base e pull-up para recuperar o nível lógico. O LED acende somente quando as duas entradas estão em 1.'
      : 'Rede RTL em duas etapas (NOR seguida de inversor), com resistores de base e pull-up para recuperar o nível lógico. O LED acende quando qualquer entrada está em 1.',
    componentes,
    ligacoes,
  };
}

export const EXEMPLOS_CIRCUITOS = [
  /* ================= SOMAS DE PORTAS LÓGICAS ================= */
  {
    id: 'meio-somador',
    categoria: 'somas',
    titulo: 'Meio-Somador (Half Adder)',
    badge: 'Aritmética Binária',
    descricao:
      'Soma dois bits (A e B). A porta XOR produz a Soma (S) no LED Verde e a porta AND gera o Vai-um (Cout) no LED Amarelo. Teste 1+1 = 10₂ (Soma 0, Cout 1). Layout conciso e harmonioso.',
    tabela: [
      { a: '0', b: '0', s: '0', c: '0' },
      { a: '0', b: '1', s: '1', c: '0' },
      { a: '1', b: '0', s: '1', c: '0' },
      { a: '1', b: '1', s: '0', c: '1' },
    ],
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 320, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 380, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'xorGate', tipo: 'XOR', x: 640, y: 160, nomeCustom: 'XOR (Soma)' },
      { ref: 'andGate', tipo: 'AND', x: 640, y: 320, nomeCustom: 'AND (Vai-um)' },
      { ref: 'rLedS', tipo: 'RESISTOR', x: 820, y: 160, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'ledS', tipo: 'LED', x: 960, y: 160, propriedades: { cor: '#34C759' }, nomeCustom: 'Soma (S)' },
      { ref: 'rLedC', tipo: 'RESISTOR', x: 820, y: 320, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'ledC', tipo: 'LED', x: 960, y: 320, propriedades: { cor: '#FFCC00' }, nomeCustom: 'Vai-um (C)' },
    ],
    ligacoes: [
      // VCC
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      // Entrada A
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['swA.p2', 'xorGate.a', '#007AFF', [{ x: 608, y: 120 }]],
      ['swA.p2', 'andGate.a', '#007AFF', [{ x: 480, y: 120 }, { x: 480, y: 311 }]],
      // Entrada B
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 380 }]],
      ['swB.p2', 'andGate.b', '#00C7BE', [{ x: 608, y: 329 }]],
      ['swB.p2', 'xorGate.b', '#00C7BE', [{ x: 520, y: 320 }, { x: 520, y: 169 }]],
      // Saída Soma
      ['xorGate.y', 'rLedS.p1', '#34C759'],
      ['rLedS.p2', 'ledS.p1', '#34C759'],
      // Saída Vai-um
      ['andGate.y', 'rLedC.p1', '#FFCC00'],
      ['rLedC.p2', 'ledC.p1', '#FFCC00'],
      // GND
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 430 }, { x: 90, y: 430 }, { x: 90, y: 260 }]],
      ['ledS.p2', 'ledC.p2', '#111827'],
      ['ledC.p2', 'bat.p2', '#111827', [{ x: 984, y: 460 }, { x: 80, y: 460 }]],
    ],
  },

  {
    id: 'somador-completo',
    categoria: 'somas',
    titulo: 'Somador Completo (Full Adder)',
    badge: 'Aritmética 3 Bits',
    descricao:
      'Soma 3 entradas: Bit A, Bit B e Vem-um (Cin). Gera Saída Soma (S) no LED Verde e Saída Vai-um (Cout) no LED Vermelho utilizando cascateamento limpo e bem alinhado.',
    tabela: [
      { a: '0', b: '0', c: '0', s: '0', cout: '0' },
      { a: '1', b: '1', c: '0', s: '0', cout: '1' },
      { a: '1', b: '1', c: '1', s: '1', cout: '1' },
    ],
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 260, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 220, y: 100, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 320, y: 160, propriedades: { resistencia: 10000 }, nomeCustom: 'Pull A' },
      { ref: 'swB', tipo: 'CHAVE', x: 220, y: 240, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 320, y: 300, propriedades: { resistencia: 10000 }, nomeCustom: 'Pull B' },
      { ref: 'swCin', tipo: 'CHAVE', x: 220, y: 380, propriedades: { fechada: false }, nomeCustom: 'Vem-um (Cin)' },
      { ref: 'rPullCin', tipo: 'RESISTOR', x: 320, y: 440, propriedades: { resistencia: 10000 }, nomeCustom: 'Pull Cin' },
      { ref: 'xor1', tipo: 'XOR', x: 520, y: 140, nomeCustom: 'XOR 1' },
      { ref: 'xor2', tipo: 'XOR', x: 740, y: 180, nomeCustom: 'XOR 2 (Soma)' },
      { ref: 'and1', tipo: 'AND', x: 520, y: 280, nomeCustom: 'AND 1' },
      { ref: 'and2', tipo: 'AND', x: 740, y: 320, nomeCustom: 'AND 2' },
      { ref: 'or1', tipo: 'OR', x: 960, y: 340, nomeCustom: 'OR (Cout)' },
      { ref: 'rLedS', tipo: 'RESISTOR', x: 960, y: 180, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'ledS', tipo: 'LED', x: 1100, y: 180, propriedades: { cor: '#34C759' }, nomeCustom: 'Soma (S)' },
      { ref: 'rLedC', tipo: 'RESISTOR', x: 1120, y: 340, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'ledC', tipo: 'LED', x: 1260, y: 340, propriedades: { cor: '#FF3B30' }, nomeCustom: 'Cout (Vai-um)' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 100 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['swB.p1', 'swCin.p1', '#FF3B30'],
      // Sinais de entrada
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 244, y: 160 }]],
      ['swA.p2', 'xor1.a', '#007AFF', [{ x: 488, y: 100 }]],
      ['swA.p2', 'and1.a', '#007AFF', [{ x: 420, y: 100 }, { x: 420, y: 271 }]],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 244, y: 300 }]],
      ['swB.p2', 'xor1.b', '#00C7BE', [{ x: 488, y: 240 }, { x: 488, y: 149 }]],
      ['swB.p2', 'and1.b', '#00C7BE', [{ x: 450, y: 240 }, { x: 450, y: 289 }]],
      ['swCin.p2', 'rPullCin.p1', '#AF52DE', [{ x: 244, y: 440 }]],
      ['swCin.p2', 'xor2.b', '#AF52DE', [{ x: 680, y: 380 }, { x: 680, y: 189 }]],
      ['swCin.p2', 'and2.b', '#AF52DE', [{ x: 708, y: 380 }, { x: 708, y: 329 }]],
      // Intermediários
      ['xor1.y', 'xor2.a', '#34C759'],
      ['xor1.y', 'and2.a', '#34C759', [{ x: 620, y: 140 }, { x: 620, y: 311 }]],
      ['and1.y', 'or1.a', '#FF9500'],
      ['and2.y', 'or1.b', '#FF9500'],
      // Saídas
      ['xor2.y', 'rLedS.p1', '#34C759'],
      ['rLedS.p2', 'ledS.p1', '#34C759'],
      ['or1.y', 'rLedC.p1', '#FF3B30'],
      ['rLedC.p2', 'ledC.p1', '#FF3B30'],
      // Barramento de Terra
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'rPullCin.p2', '#111827'],
      ['rPullCin.p2', 'bat.p2', '#111827', [{ x: 352, y: 490 }, { x: 90, y: 490 }, { x: 90, y: 280 }]],
      ['ledS.p2', 'bat.p2', '#111827', [{ x: 1124, y: 520 }, { x: 80, y: 520 }]],
      ['ledC.p2', 'bat.p2', '#111827', [{ x: 1284, y: 550 }, { x: 80, y: 550 }]],
    ],
  },

  {
    id: 'xor-combinacional',
    categoria: 'somas',
    titulo: 'XOR por Soma de Produtos',
    badge: 'Lógica Combinacional',
    descricao:
      'Construção da função Ou-Exclusivo a partir da forma canônica: Y = (A · B̄) + (Ā · B). Utiliza inversores NOT, portas AND e porta OR com disposição ampla e clara.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 } },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 360, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 420, propriedades: { resistencia: 10000 } },
      { ref: 'notA', tipo: 'NOT', x: 480, y: 200, nomeCustom: 'NOT A' },
      { ref: 'notB', tipo: 'NOT', x: 480, y: 280, nomeCustom: 'NOT B' },
      { ref: 'and1', tipo: 'AND', x: 680, y: 140, nomeCustom: 'A · B̄' },
      { ref: 'and2', tipo: 'AND', x: 680, y: 340, nomeCustom: 'Ā · B' },
      { ref: 'orGate', tipo: 'OR', x: 880, y: 240, nomeCustom: 'OR' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 1040, y: 240, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 1180, y: 240, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída XOR' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['swA.p2', 'and1.a', '#007AFF', [{ x: 648, y: 120 }, { x: 648, y: 131 }]],
      ['swA.p2', 'notA.a', '#007AFF', [{ x: 420, y: 120 }, { x: 420, y: 200 }]],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 420 }]],
      ['swB.p2', 'and2.b', '#00C7BE', [{ x: 648, y: 360 }, { x: 648, y: 349 }]],
      ['swB.p2', 'notB.a', '#00C7BE', [{ x: 450, y: 360 }, { x: 450, y: 280 }]],
      ['notB.y', 'and1.b', '#AF52DE'],
      ['notA.y', 'and2.a', '#AF52DE'],
      ['and1.y', 'orGate.a', '#34C759'],
      ['and2.y', 'orGate.b', '#34C759'],
      ['orGate.y', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 470 }, { x: 90, y: 470 }, { x: 90, y: 260 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 1204, y: 500 }, { x: 80, y: 500 }]],
    ],
  },

  /* ================= CONSTRUÇÃO INDUSTRIAL (TRANSISTORES BJT) ================= */
  // Esquemas desenhados pelo usuário (montagem industrial AND / OR) aplicados a um circuito de entrada
  exemploIndustrialPorta('AND'),
  exemploIndustrialPorta('OR'),

  {
    id: 'not-industrial',
    categoria: 'industrial',
    titulo: 'NOT Industrial (Inversor BJT com Pull-up)',
    badge: 'Lógica RTL / Transistor',
    descricao:
      'Inversor RTL clássico: chave aberta (0) deixa o transistor cortado e o resistor pull-up acende o LED (1). Ao fechar a chave (1), o transistor satura e aterra o coletor, apagando o LED (0).',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 200, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 280, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'rBase', tipo: 'RESISTOR', x: 480, y: 200, propriedades: { resistencia: 1000 }, nomeCustom: '1 kΩ' },
      { ref: 'rPullUp', tipo: 'RESISTOR', x: 620, y: 90, propriedades: { resistencia: 1000 }, nomeCustom: 'Pull-up 1 kΩ' },
      { ref: 'q1', tipo: 'TRANSISTOR_NPN', x: 620, y: 200, nomeCustom: 'Q1 (NPN)' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 800, y: 200, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 940, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída Y' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 150 }, { x: 216, y: 150 }]],
      ['bat.p1', 'rPullUp.p1', '#FF3B30', [{ x: 80, y: 60 }, { x: 588, y: 60 }, { x: 588, y: 90 }]],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 280 }]],
      ['swA.p2', 'rBase.p1', '#007AFF'],
      ['rBase.p2', 'q1.b', '#007AFF'],
      ['rPullUp.p2', 'q1.c', '#34C759'],
      ['q1.c', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'bat.p2', '#111827', [{ x: 372, y: 360 }, { x: 80, y: 360 }]],
      ['q1.e', 'bat.p2', '#111827', [{ x: 652, y: 360 }, { x: 372, y: 360 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 964, y: 400 }, { x: 80, y: 400 }]],
    ],
  },

  {
    id: 'nand-industrial',
    categoria: 'industrial',
    titulo: 'NAND Industrial (RTL Série com Pull-up)',
    badge: 'Lógica RTL / Transistor',
    descricao:
      'Porta Não-E (NAND) industrial com dois transistores NPN em série até o terra e resistor pull-up. O LED só apaga quando ambas as entradas estiverem em 1.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 } },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 280, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 340, propriedades: { resistencia: 10000 } },
      { ref: 'rPullUp', tipo: 'RESISTOR', x: 560, y: 30, propriedades: { resistencia: 1000 }, nomeCustom: 'Pull-up 1 kΩ' },
      { ref: 'q1', tipo: 'TRANSISTOR_NPN', x: 560, y: 120, nomeCustom: 'Q1 (NPN)' },
      { ref: 'q2', tipo: 'TRANSISTOR_NPN', x: 560, y: 260, nomeCustom: 'Q2 (NPN)' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 780, y: 120, propriedades: { resistencia: 220 } },
      { ref: 'led', tipo: 'LED', x: 940, y: 120, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída Y' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['bat.p1', 'rPullUp.p1', '#FF3B30', [{ x: 80, y: 30 }, { x: 528, y: 30 }]],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['rPullA.p1', 'q1.b', '#007AFF'],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 340 }]],
      ['rPullB.p1', 'q2.b', '#00C7BE'],
      ['rPullUp.p2', 'q1.c', '#34C759'],
      ['q1.c', 'rLed.p1', '#34C759'],
      ['q1.e', 'q2.c', '#FF9500'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 390 }, { x: 80, y: 390 }]],
      ['q2.e', 'bat.p2', '#111827', [{ x: 592, y: 390 }, { x: 372, y: 390 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 964, y: 420 }, { x: 80, y: 420 }]],
    ],
  },

  {
    id: 'nor-industrial',
    categoria: 'industrial',
    titulo: 'NOR Industrial (RTL Paralelo com Pull-up)',
    badge: 'Lógica RTL / Transistor',
    descricao:
      'Porta Não-OU (NOR) industrial com dois transistores NPN em paralelo aterrando a saída com resistor pull-up. O LED só acende quando ambas as entradas forem 0.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 } },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 280, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 340, propriedades: { resistencia: 10000 } },
      { ref: 'rPullUp', tipo: 'RESISTOR', x: 420, y: 40, propriedades: { resistencia: 1000 }, nomeCustom: 'Pull-up 1 kΩ' },
      { ref: 'q1', tipo: 'TRANSISTOR_NPN', x: 540, y: 120, nomeCustom: 'Q1 (NPN)' },
      { ref: 'q2', tipo: 'TRANSISTOR_NPN', x: 700, y: 120, nomeCustom: 'Q2 (NPN)' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 860, y: 120, propriedades: { resistencia: 220 } },
      { ref: 'led', tipo: 'LED', x: 1000, y: 120, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída Y' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['bat.p1', 'rPullUp.p1', '#FF3B30', [{ x: 80, y: 40 }, { x: 388, y: 40 }]],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['rPullA.p1', 'q1.b', '#007AFF'],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 340 }]],
      ['rPullB.p1', 'q2.b', '#00C7BE', [{ x: 640, y: 340 }, { x: 640, y: 120 }]],
      ['rPullUp.p2', 'q1.c', '#34C759'],
      ['q1.c', 'q2.c', '#34C759'],
      ['q2.c', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 390 }, { x: 80, y: 390 }]],
      ['q1.e', 'bat.p2', '#111827', [{ x: 572, y: 390 }, { x: 372, y: 390 }]],
      ['q2.e', 'bat.p2', '#111827', [{ x: 732, y: 390 }, { x: 572, y: 390 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 1024, y: 420 }, { x: 80, y: 420 }]],
    ],
  },

  /* ================= DEMONSTRAÇÃO DIDÁTICA (CHAVES DISCRETAS) ================= */
  {
    id: 'and-didatica',
    categoria: 'didatica',
    titulo: 'AND Didática (Chaves em Série)',
    badge: 'Contatos Mecânicos',
    descricao:
      'Demonstração puramente discreta da função E (AND). O LED só recebe corrente quando ambas as chaves mecânicas estão fechadas simultaneamente.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 200, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 260, y: 200, propriedades: { fechada: false }, nomeCustom: 'Chave A' },
      { ref: 'swB', tipo: 'CHAVE', x: 440, y: 200, propriedades: { fechada: false }, nomeCustom: 'Chave B' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 640, y: 200, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 800, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída Y' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 150 }, { x: 236, y: 150 }, { x: 236, y: 200 }]],
      ['swA.p2', 'swB.p1', '#007AFF'],
      ['swB.p2', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['led.p2', 'bat.p2', '#111827', [{ x: 824, y: 340 }, { x: 80, y: 340 }]],
    ],
  },

  {
    id: 'or-didatica',
    categoria: 'didatica',
    titulo: 'OR Didática (Chaves em Paralelo)',
    badge: 'Contatos Mecânicos',
    descricao:
      'Demonstração puramente discreta da função OU (OR). As duas chaves formam caminhos paralelos: se qualquer uma for fechada, o LED acende.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 200, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 280, y: 120, propriedades: { fechada: false }, nomeCustom: 'Chave A' },
      { ref: 'swB', tipo: 'CHAVE', x: 280, y: 280, propriedades: { fechada: false }, nomeCustom: 'Chave B' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 520, y: 200, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 680, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída Y' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['swA.p2', 'rLed.p1', '#34C759', [{ x: 380, y: 120 }, { x: 440, y: 120 }, { x: 440, y: 200 }]],
      ['swB.p2', 'rLed.p1', '#34C759', [{ x: 380, y: 280 }, { x: 440, y: 280 }, { x: 440, y: 200 }]],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['led.p2', 'bat.p2', '#111827', [{ x: 704, y: 360 }, { x: 80, y: 360 }]],
    ],
  },

  {
    id: 'not-didatica',
    categoria: 'didatica',
    titulo: 'NOT Didática (Inversão com Pull-up)',
    badge: 'Contatos Mecânicos',
    descricao:
      'Chave inversora com resistor pull-up. Com a chave aberta (0), o resistor alimenta o LED (1). Ao fechar a chave (1), a corrente é desviada para o terra e o LED apaga (0).',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 200, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'rPullUp', tipo: 'RESISTOR', x: 300, y: 90, propriedades: { resistencia: 330 }, nomeCustom: 'Pull-up 330 Ω' },
      { ref: 'swA', tipo: 'CHAVE', x: 300, y: 270, propriedades: { fechada: false }, nomeCustom: 'Chave A' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 540, y: 180, propriedades: { resistencia: 100 }, nomeCustom: '100 Ω' },
      { ref: 'led', tipo: 'LED', x: 700, y: 180, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída Y' },
    ],
    ligacoes: [
      ['bat.p1', 'rPullUp.p1', '#FF3B30', [{ x: 80, y: 90 }]],
      ['rPullUp.p2', 'swA.p1', '#34C759', [{ x: 332, y: 180 }, { x: 276, y: 180 }, { x: 276, y: 270 }]],
      ['rPullUp.p2', 'rLed.p1', '#34C759', [{ x: 332, y: 180 }, { x: 508, y: 180 }]],
      ['swA.p2', 'bat.p2', '#111827', [{ x: 324, y: 360 }, { x: 80, y: 360 }]],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['led.p2', 'bat.p2', '#111827', [{ x: 724, y: 390 }, { x: 80, y: 390 }]],
    ],
  },

  {
    id: 'nand-didatica',
    categoria: 'didatica',
    titulo: 'NAND Didática (Série com Pull-up)',
    badge: 'Contatos Mecânicos',
    descricao:
      'Duas chaves em série ligadas para o terra. O LED permanece aceso por pull-up, e só apaga quando AMBAS as chaves forem fechadas simultaneamente.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 200, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'rPullUp', tipo: 'RESISTOR', x: 300, y: 70, propriedades: { resistencia: 330 }, nomeCustom: 'Pull-up 330 Ω' },
      { ref: 'swA', tipo: 'CHAVE', x: 300, y: 180, propriedades: { fechada: false }, nomeCustom: 'Chave A' },
      { ref: 'swB', tipo: 'CHAVE', x: 300, y: 290, propriedades: { fechada: false }, nomeCustom: 'Chave B' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 560, y: 130, propriedades: { resistencia: 100 } },
      { ref: 'led', tipo: 'LED', x: 720, y: 130, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída Y' },
    ],
    ligacoes: [
      ['bat.p1', 'rPullUp.p1', '#FF3B30', [{ x: 80, y: 70 }]],
      ['rPullUp.p2', 'swA.p1', '#34C759', [{ x: 332, y: 130 }, { x: 276, y: 130 }, { x: 276, y: 180 }]],
      ['rPullUp.p2', 'rLed.p1', '#34C759', [{ x: 332, y: 130 }, { x: 528, y: 130 }]],
      ['swA.p2', 'swB.p1', '#007AFF', [{ x: 324, y: 235 }, { x: 276, y: 235 }, { x: 276, y: 290 }]],
      ['swB.p2', 'bat.p2', '#111827', [{ x: 324, y: 380 }, { x: 80, y: 380 }]],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['led.p2', 'bat.p2', '#111827', [{ x: 744, y: 410 }, { x: 80, y: 410 }]],
    ],
  },

  {
    id: 'nor-didatica',
    categoria: 'didatica',
    titulo: 'NOR Didática (Paralelo com Pull-up)',
    badge: 'Contatos Mecânicos',
    descricao:
      'Duas chaves em paralelo para o terra. O LED só acende quando nenhuma chave estiver fechada (ambas em 0).',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 200, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'rPullUp', tipo: 'RESISTOR', x: 300, y: 70, propriedades: { resistencia: 330 }, nomeCustom: 'Pull-up 330 Ω' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 250, propriedades: { fechada: false }, nomeCustom: 'Chave A' },
      { ref: 'swB', tipo: 'CHAVE', x: 400, y: 250, propriedades: { fechada: false }, nomeCustom: 'Chave B' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 600, y: 160, propriedades: { resistencia: 100 } },
      { ref: 'led', tipo: 'LED', x: 760, y: 160, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída Y' },
    ],
    ligacoes: [
      ['bat.p1', 'rPullUp.p1', '#FF3B30', [{ x: 80, y: 70 }]],
      ['rPullUp.p2', 'swA.p1', '#34C759', [{ x: 332, y: 160 }, { x: 216, y: 160 }, { x: 216, y: 250 }]],
      ['swA.p1', 'swB.p1', '#34C759', [{ x: 216, y: 160 }, { x: 376, y: 160 }, { x: 376, y: 250 }]],
      ['rPullUp.p2', 'rLed.p1', '#34C759', [{ x: 332, y: 160 }, { x: 568, y: 160 }]],
      ['swA.p2', 'bat.p2', '#111827', [{ x: 264, y: 360 }, { x: 80, y: 360 }]],
      ['swB.p2', 'bat.p2', '#111827', [{ x: 424, y: 360 }, { x: 264, y: 360 }]],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['led.p2', 'bat.p2', '#111827', [{ x: 784, y: 390 }, { x: 80, y: 390 }]],
    ],
  },

  /* ================= APLICAÇÕES BÁSICAS (PORTAS LÓGICAS) ================= */
  {
    id: 'led-fonte-positiva',
    categoria: 'basica',
    titulo: 'LED com Fonte Positiva e GND',
    badge: 'Alimentação DC',
    descricao:
      'Demonstra a fonte positiva de 5 V referida ao GND global. O resistor limita a corrente do LED; conecte o terminal de retorno ao símbolo GND.',
    componentes: [
      { ref: 'vcc', tipo: 'FONTE_POSITIVA', x: 80, y: 180, propriedades: { tensao: 5 }, nomeCustom: '+5 V' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 250, y: 188, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 400, y: 190, propriedades: { cor: '#34C759' }, nomeCustom: 'LED' },
      { ref: 'gnd', tipo: 'GND', x: 540, y: 170, nomeCustom: 'GND' },
    ],
    ligacoes: [
      ['vcc.p', 'rLed.p1', '#FF3B30'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['led.p2', 'gnd.p', '#111827'],
    ],
  },

  {
    id: 'chave-fonte-positiva',
    categoria: 'basica',
    titulo: 'Chave e LED com GND',
    badge: 'Alimentação DC',
    descricao:
      'A fonte positiva alimenta o LED através de uma chave e de um resistor limitador. A chave aberta interrompe a corrente; o GND fornece a referência e o retorno.',
    componentes: [
      { ref: 'vcc', tipo: 'FONTE_POSITIVA', x: 80, y: 180, propriedades: { tensao: 5 }, nomeCustom: '+5 V' },
      { ref: 'swA', tipo: 'CHAVE', x: 230, y: 187, propriedades: { fechada: false }, nomeCustom: 'Chave' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 350, y: 188, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 500, y: 190, propriedades: { cor: '#34C759' }, nomeCustom: 'LED' },
      { ref: 'gnd', tipo: 'GND', x: 640, y: 170, nomeCustom: 'GND' },
    ],
    ligacoes: [
      ['vcc.p', 'swA.p1', '#FF3B30'],
      ['swA.p2', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['led.p2', 'gnd.p', '#111827'],
    ],
  },

  {
    id: 'transistor-fonte-positiva',
    categoria: 'basica',
    titulo: 'Transistor NPN como Chave',
    badge: 'Alimentação DC',
    descricao:
      'Uma chave polariza a base do transistor NPN e controla o LED. O resistor entre base e GND mantém o transistor desligado quando a chave está aberta.',
    componentes: [
      { ref: 'vcc', tipo: 'FONTE_POSITIVA', x: 60, y: 170, propriedades: { tensao: 5 }, nomeCustom: '+5 V' },
      { ref: 'swA', tipo: 'CHAVE', x: 220, y: 110, propriedades: { fechada: false }, nomeCustom: 'Entrada' },
      { ref: 'rBase', tipo: 'RESISTOR', x: 340, y: 110, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'rPull', tipo: 'RESISTOR', x: 440, y: 230, propriedades: { resistencia: 100000 }, nomeCustom: '100 kΩ' },
      { ref: 'q1', tipo: 'TRANSISTOR_NPN', x: 600, y: 180, nomeCustom: 'Q1 (NPN)' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 760, y: 90, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 900, y: 92, propriedades: { cor: '#34C759' }, nomeCustom: 'LED' },
      { ref: 'gnd', tipo: 'GND', x: 760, y: 270, nomeCustom: 'GND' },
    ],
    ligacoes: [
      ['vcc.p', 'swA.p1', '#FF3B30'],
      ['swA.p2', 'rBase.p1', '#007AFF'],
      ['rBase.p2', 'q1.b', '#007AFF'],
      ['rPull.p1', 'q1.b', '#007AFF'],
      ['rPull.p2', 'gnd.p', '#111827'],
      ['vcc.p', 'rLed.p1', '#FF3B30'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['led.p2', 'q1.c', '#34C759'],
      ['q1.e', 'gnd.p', '#111827'],
    ],
  },

  {
    id: 'and-basica',
    categoria: 'basica',
    titulo: 'Porta AND com Chaves e LED',
    badge: 'Lógica Digital',
    descricao:
      'Aplicação direta da porta lógica E (AND). Permite ao usuário clicar nas Chaves A e B para alternar entre nível alto (1) e baixo (0) e ver o LED acender quando ambas forem 1. Layout limpo e perfeitamente ortogonal.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 280, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 340, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'gate', tipo: 'AND', x: 640, y: 200, nomeCustom: 'AND' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 800, y: 200, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 940, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída (Y)' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['swA.p2', 'gate.a', '#007AFF', [{ x: 608, y: 120 }]],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 340 }]],
      ['swB.p2', 'gate.b', '#00C7BE', [{ x: 608, y: 280 }]],
      ['gate.y', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 390 }, { x: 80, y: 390 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 964, y: 420 }, { x: 80, y: 420 }]],
    ],
  },

  {
    id: 'or-basica',
    categoria: 'basica',
    titulo: 'Porta OR com Chaves e LED',
    badge: 'Lógica Digital',
    descricao:
      'Aplicação direta da porta lógica OU (OR). Chave aberta = 0 e fechada = 1: com ambas abertas (00), o LED fica apagado; feche qualquer uma para acendê-lo. Layout idêntico ao modelo de referência do usuário.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 280, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 340, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'gate', tipo: 'OR', x: 640, y: 200, nomeCustom: 'OR' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 800, y: 200, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 940, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída (Y)' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['swA.p2', 'gate.a', '#007AFF', [{ x: 608, y: 120 }]],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 340 }]],
      ['swB.p2', 'gate.b', '#00C7BE', [{ x: 608, y: 280 }]],
      ['gate.y', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 390 }, { x: 80, y: 390 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 964, y: 420 }, { x: 80, y: 420 }]],
    ],
  },

  {
    id: 'not-basica',
    categoria: 'basica',
    titulo: 'Porta NOT (Inversor) com Chave e LED',
    badge: 'Lógica Digital',
    descricao:
      'Aplicação direta do Inversor (NOT). A saída inverte o estado da entrada: chave aberta (0) acende o LED (1); chave fechada (1) apaga o LED (0). Disposição alinhada e concisa.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 200, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 280, propriedades: { resistencia: 10000 }, nomeCustom: '10 kΩ' },
      { ref: 'gate', tipo: 'NOT', x: 640, y: 200, nomeCustom: 'NOT' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 800, y: 200, propriedades: { resistencia: 220 }, nomeCustom: '220 Ω' },
      { ref: 'led', tipo: 'LED', x: 940, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída (Y)' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 150 }, { x: 216, y: 150 }]],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 280 }]],
      ['swA.p2', 'gate.a', '#007AFF'],
      ['gate.y', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'bat.p2', '#111827', [{ x: 372, y: 360 }, { x: 80, y: 360 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 964, y: 400 }, { x: 80, y: 400 }]],
    ],
  },

  {
    id: 'nand-basica',
    categoria: 'basica',
    titulo: 'Porta NAND com Chaves e LED',
    badge: 'Lógica Digital',
    descricao:
      'Porta Não-E (NAND): O LED permanece ligado a menos que AMBAS as chaves sejam fechadas (nível 1). Disposição concisa e perfeitamente ortogonal.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 } },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 280, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 340, propriedades: { resistencia: 10000 } },
      { ref: 'gate', tipo: 'NAND', x: 640, y: 200, nomeCustom: 'NAND' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 800, y: 200, propriedades: { resistencia: 220 } },
      { ref: 'led', tipo: 'LED', x: 940, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída (Y)' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['swA.p2', 'gate.a', '#007AFF', [{ x: 608, y: 120 }]],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 340 }]],
      ['swB.p2', 'gate.b', '#00C7BE', [{ x: 608, y: 280 }]],
      ['gate.y', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 390 }, { x: 80, y: 390 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 964, y: 420 }, { x: 80, y: 420 }]],
    ],
  },

  {
    id: 'nor-basica',
    categoria: 'basica',
    titulo: 'Porta NOR com Chaves e LED',
    badge: 'Lógica Digital',
    descricao:
      'Porta Não-OU (NOR): O LED acende exclusivamente quando ambas as chaves estiverem abertas (nível 0). Disposição concisa e perfeitamente ortogonal.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 } },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 280, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 340, propriedades: { resistencia: 10000 } },
      { ref: 'gate', tipo: 'NOR', x: 640, y: 200, nomeCustom: 'NOR' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 800, y: 200, propriedades: { resistencia: 220 } },
      { ref: 'led', tipo: 'LED', x: 940, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída (Y)' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['swA.p2', 'gate.a', '#007AFF', [{ x: 608, y: 120 }]],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 340 }]],
      ['swB.p2', 'gate.b', '#00C7BE', [{ x: 608, y: 280 }]],
      ['gate.y', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 390 }, { x: 80, y: 390 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 964, y: 420 }, { x: 80, y: 420 }]],
    ],
  },

  {
    id: 'xor-basica',
    categoria: 'basica',
    titulo: 'Porta XOR com Chaves e LED',
    badge: 'Lógica Digital',
    descricao:
      'Porta Ou-Exclusivo (XOR): O LED acende quando as entradas forem diferentes (uma em 1 e a outra em 0). Disposição concisa e perfeitamente ortogonal.',
    componentes: [
      { ref: 'bat', tipo: 'BATERIA', x: 80, y: 240, rotacao: 90, propriedades: { tensao: 5 }, nomeCustom: 'Vcc 5V' },
      { ref: 'swA', tipo: 'CHAVE', x: 240, y: 120, propriedades: { fechada: false }, nomeCustom: 'Entrada A' },
      { ref: 'rPullA', tipo: 'RESISTOR', x: 340, y: 180, propriedades: { resistencia: 10000 } },
      { ref: 'swB', tipo: 'CHAVE', x: 240, y: 280, propriedades: { fechada: false }, nomeCustom: 'Entrada B' },
      { ref: 'rPullB', tipo: 'RESISTOR', x: 340, y: 340, propriedades: { resistencia: 10000 } },
      { ref: 'gate', tipo: 'XOR', x: 640, y: 200, nomeCustom: 'XOR' },
      { ref: 'rLed', tipo: 'RESISTOR', x: 800, y: 200, propriedades: { resistencia: 220 } },
      { ref: 'led', tipo: 'LED', x: 940, y: 200, propriedades: { cor: '#34C759' }, nomeCustom: 'Saída (Y)' },
    ],
    ligacoes: [
      ['bat.p1', 'swA.p1', '#FF3B30', [{ x: 80, y: 120 }]],
      ['swA.p1', 'swB.p1', '#FF3B30'],
      ['swA.p2', 'rPullA.p1', '#007AFF', [{ x: 264, y: 180 }]],
      ['swA.p2', 'gate.a', '#007AFF', [{ x: 608, y: 120 }]],
      ['swB.p2', 'rPullB.p1', '#00C7BE', [{ x: 264, y: 340 }]],
      ['swB.p2', 'gate.b', '#00C7BE', [{ x: 608, y: 280 }]],
      ['gate.y', 'rLed.p1', '#34C759'],
      ['rLed.p2', 'led.p1', '#34C759'],
      ['rPullA.p2', 'rPullB.p2', '#111827'],
      ['rPullB.p2', 'bat.p2', '#111827', [{ x: 372, y: 390 }, { x: 80, y: 390 }]],
      ['led.p2', 'bat.p2', '#111827', [{ x: 964, y: 420 }, { x: 80, y: 420 }]],
    ],
  },
];

/**
 * Carrega um circuito de exemplo no circuito atual com enquadramento e espaçamento otimizados.
 */
export function carregarExemploCircuito(exemploId, estado, aoFinalizar, avisarToast) {
  if (!estado?.circuito) return false;
  const exemplo = EXEMPLOS_CIRCUITOS.find((e) => e.id === exemploId);
  if (!exemplo) return false;

  const circuito = estado.circuito;
  const limitesXExistentes = circuito.componentes.map((comp) => {
    const dimensao = CATALOGO[comp.tipo]?.dimensoes || { w: 0 };
    return comp.x + dimensao.w;
  });
  for (const fio of circuito.fios) {
    for (const dobra of fio.dobras || []) limitesXExistentes.push(dobra.x);
  }
  const limiteXExistente = limitesXExistentes.length
    ? Math.max(...limitesXExistentes)
    : null;
  const menorXExemplo = Math.min(...exemplo.componentes.map((comp) => comp.x));
  const deslocamentoX = limiteXExistente === null
    ? 0
    : Math.ceil((limiteXExistente + 100 - menorXExemplo) / 10) * 10;

  // Dicionário de mapeamento ref -> novoComponente
  const compsMapeados = {};

  for (const cDef of exemplo.componentes) {
    const comp = adicionarComponente(circuito, cDef.tipo, cDef.x + deslocamentoX, cDef.y);
    if (!comp) continue;

    if (cDef.rotacao) comp.rotacao = cDef.rotacao;
    if (cDef.nomeCustom) comp.nomeCustom = cDef.nomeCustom;
    if (cDef.propriedades) {
      Object.assign(comp.propriedades, cDef.propriedades);
    }
    compsMapeados[cDef.ref] = comp;
  }

  // Adiciona fios com dobras dedicadas para evitar sobreposições
  for (const lig of exemplo.ligacoes) {
    const [pA, pB, corCustom, dobrasCustom] = lig;
    const [refA, pinoA] = pA.split('.');
    const [refB, pinoB] = pB.split('.');
    const compA = compsMapeados[refA];
    const compB = compsMapeados[refB];

    if (compA && compB) {
      circuito.fios.push({
        id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        origem: { componente: compA.id, pino: pinoA },
        destino: { componente: compB.id, pino: pinoB },
        dobras: Array.isArray(dobrasCustom)
          ? dobrasCustom.map((d) => ({ x: d.x + deslocamentoX, y: d.y }))
          : [],
        cor: corCustom || CORES_FIO[0],
        espessura: 2,
      });
    }
  }

  rotearFios(circuito);

  // Limpa seleções e popups
  estado.selecionados = [];
  estado.popupAtivo = null;
  estado.popups = {};

  // Enquadra a visão no circuito com margens confortáveis
  if (estado.view && estado.canvasElemento) {
    const el = estado.canvasElemento;
    const limitesX = [];
    const limitesY = [];
    for (const comp of circuito.componentes) {
      const dimensao = CATALOGO[comp.tipo]?.dimensoes || { w: 0, h: 0 };
      limitesX.push(comp.x, comp.x + dimensao.w);
      limitesY.push(comp.y, comp.y + dimensao.h);
    }
    for (const fio of circuito.fios) {
      for (const dobra of fio.dobras || []) {
        limitesX.push(dobra.x);
        limitesY.push(dobra.y);
      }
    }
    const minX = Math.min(...limitesX) - 40;
    const maxX = Math.max(...limitesX) + 40;
    const minY = Math.min(...limitesY) - 40;
    const maxY = Math.max(...limitesY) + 40;

    const largCircuito = maxX - minX;
    const altCircuito = maxY - minY;
    const margemX = 70;
    const margemY = 50;

    const zoomX = (el.clientWidth - margemX * 2) / Math.max(largCircuito, 200);
    const zoomY = (el.clientHeight - margemY * 2) / Math.max(altCircuito, 200);
    const novoZoom = Math.min(1.0, Math.max(0.2, Math.min(zoomX, zoomY)));

    estado.view.zoom = novoZoom;
    const centroX = (minX + maxX) / 2;
    const centroY = (minY + maxY) / 2;
    estado.view.panX = el.clientWidth / 2 - centroX * novoZoom;
    estado.view.panY = el.clientHeight / 2 - centroY * novoZoom;
  }

  // Registra no histórico de undo
  registrar(circuito, 'carregar-exemplo', true);

  // Inicia simulação imediatamente para o usuário ver tudo funcionando
  if (typeof estado.iniciarSimulacao === 'function' && !estado.simulando) {
    estado.iniciarSimulacao();
  } else if (typeof estado.recalcular === 'function') {
    estado.recalcular();
  }

  if (typeof avisarToast === 'function') {
    avisarToast(`Exemplo "${exemplo.titulo}" carregado! Clique nas chaves para testar 0 e 1.`);
  }

  if (typeof aoFinalizar === 'function') {
    aoFinalizar();
  }

  return true;
}

/**
 * Cria ou abre a modal de exemplos de portas lógicas e somadores.
 */
export function abrirModalExemplos(estado, aoFinalizar) {
  let modalExistente = document.getElementById('modal-exemplos-overlay');
  if (modalExistente) modalExistente.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-exemplos-overlay';
  overlay.className = 'modal-exemplos-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-exemplos';

  // Cabeçalho
  const cabecalho = document.createElement('div');
  cabecalho.className = 'modal-exemplos-cabecalho';
  cabecalho.innerHTML = `
    <div class="modal-exemplos-titulo-wrap">
      <h2 class="modal-exemplos-titulo">Exemplos de Circuitos Eletrônicos</h2>
      <p class="modal-exemplos-subtitulo">
        Escolha um circuito de exemplo completo, com componentes e alimentação para explorar a simulação.
      </p>
    </div>
    <button type="button" class="modal-exemplos-fechar" title="Fechar (Esc)">&times;</button>
  `;

  // Barra de Categorias / Abas
  const abasNav = document.createElement('div');
  abasNav.className = 'modal-exemplos-abas';

  let categoriaAtiva = 'somas';

  const containerCards = document.createElement('div');
  containerCards.className = 'modal-exemplos-cards-container';

  function renderizarCards() {
    containerCards.innerHTML = '';
    const filtrados = EXEMPLOS_CIRCUITOS.filter((e) => e.categoria === categoriaAtiva);

    for (const ex of filtrados) {
      const card = document.createElement('div');
      card.className = 'modal-exemplo-card';

      let tabelaHtml = '';
      if (ex.tabela) {
        const colunas = Object.keys(ex.tabela[0]);
        tabelaHtml = `
          <div class="modal-exemplo-tabela-wrap">
            <span class="modal-exemplo-tabela-label">Tabela Verdade:</span>
            <table class="modal-exemplo-tabela">
              <thead>
                <tr>${colunas.map((c) => `<th>${c.toUpperCase()}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${ex.tabela
                  .map(
                    (row) =>
                      `<tr>${colunas
                        .map((c) => `<td><strong>${row[c]}</strong></td>`)
                        .join('')}</tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="modal-exemplo-card-topo">
          <span class="modal-exemplo-badge">${ex.badge || 'Circuito'}</span>
          <h3 class="modal-exemplo-card-titulo">${ex.titulo}</h3>
        </div>
        <p class="modal-exemplo-card-desc">${ex.descricao}</p>
        ${tabelaHtml}
        <div class="modal-exemplo-card-rodape">
          <span class="modal-exemplo-pecas-count">${ex.componentes.length} componentes</span>
          <button type="button" class="btn-carregar-exemplo" data-id="${ex.id}">
            Carregar no Canvas
          </button>
        </div>
      `;

      const btnCarregar = card.querySelector('.btn-carregar-exemplo');
      btnCarregar.addEventListener('click', () => {
        carregarExemploCircuito(
          ex.id,
          estado,
          () => {
            overlay.remove();
            if (aoFinalizar) aoFinalizar();
          },
          (msg) => {
            if (typeof estado?.mostrarToast === 'function') {
              estado.mostrarToast(msg);
            }
          }
        );
      });

      containerCards.appendChild(card);
    }
  }

  function atualizarAbas() {
    abasNav.innerHTML = '';
    for (const cat of CATEGORIAS_EXEMPLOS) {
      const btnAba = document.createElement('button');
      btnAba.type = 'button';
      btnAba.className = 'modal-exemplos-aba' + (cat.id === categoriaAtiva ? ' ativa' : '');
      btnAba.innerHTML = `<span class="aba-icone">${cat.icone}</span> <span>${cat.rotulo}</span>`;
      btnAba.addEventListener('click', () => {
        categoriaAtiva = cat.id;
        atualizarAbas();
        renderizarCards();
      });
      abasNav.appendChild(btnAba);
    }
  }

  atualizarAbas();
  renderizarCards();

  modal.appendChild(cabecalho);
  modal.appendChild(abasNav);
  modal.appendChild(containerCards);
  overlay.appendChild(modal);

  // Ações de fechamento
  const fechar = () => overlay.remove();
  cabecalho.querySelector('.modal-exemplos-fechar').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fechar();
  });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      fechar();
      window.removeEventListener('keydown', onKey);
    }
  };
  window.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
}
