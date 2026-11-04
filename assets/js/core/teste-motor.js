/**
 * teste-motor.js — Testes manuais do motor lógico.
 * Abra o console do navegador para ver os resultados.
 * NÃO é carregado em produção.
 */

import {
  criarCircuito,
  criarComponente,
  adicionarComponente,
  conectar,
  propagar,
  acionarSwitch,
  lerLed,
  lerSaidas,
} from './circuit.js';

import { criarClock, tictac, resetar } from './clock.js';
import { tabelaVerdade } from './gate.js';

function titulo(texto) {
  console.log(`\n=== ${texto} ===`);
}

function verificar(descricao, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(`${ok ? '✓' : '✗'} ${descricao}: ${JSON.stringify(obtido)}${ok ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
  return ok;
}

// ---- Teste 1: tabela-verdade AND ----
titulo('Tabela-verdade AND');
const ttAnd = tabelaVerdade('AND', 2);
verificar('AND(0,0)', ttAnd[0].saida, 0);
verificar('AND(0,1)', ttAnd[1].saida, 0);
verificar('AND(1,0)', ttAnd[2].saida, 0);
verificar('AND(1,1)', ttAnd[3].saida, 1);

// ---- Teste 2: meio-somador ----
titulo('Meio-somador (XOR + AND)');
const c1 = criarCircuito();
const swA = adicionarComponente(c1, criarComponente('SWITCH', { rotulo: 'A' }));
const swB = adicionarComponente(c1, criarComponente('SWITCH', { rotulo: 'B' }));
const xor = adicionarComponente(c1, criarComponente('XOR', { numEntradas: 2, rotulo: 'Soma' }));
const and = adicionarComponente(c1, criarComponente('AND', { numEntradas: 2, rotulo: 'Vai-um' }));
const ledS = adicionarComponente(c1, criarComponente('LED', { numEntradas: 1, numSaidas: 0, rotulo: 'S' }));
const ledC = adicionarComponente(c1, criarComponente('LED', { numEntradas: 1, numSaidas: 0, rotulo: 'C' }));

conectar(c1, { componente: swA.id, pino: 'out0' }, { componente: xor.id, pino: 'in0' });
conectar(c1, { componente: swB.id, pino: 'out0' }, { componente: xor.id, pino: 'in1' });
conectar(c1, { componente: swA.id, pino: 'out0' }, { componente: and.id, pino: 'in0' });
conectar(c1, { componente: swB.id, pino: 'out0' }, { componente: and.id, pino: 'in1' });
conectar(c1, { componente: xor.id, pino: 'out0' }, { componente: ledS.id, pino: 'in0' });
conectar(c1, { componente: and.id, pino: 'out0' }, { componente: ledC.id, pino: 'in0' });

const casos = [
  [0, 0, 0, 0],
  [0, 1, 1, 0],
  [1, 0, 1, 0],
  [1, 1, 0, 1],
];

for (const [a, b, somaEsp, carryEsp] of casos) {
  acionarSwitch(c1, swA.id, a);
  acionarSwitch(c1, swB.id, b);
  const soma = lerLed(c1, ledS.id) ? 1 : 0;
  const carry = lerLed(c1, ledC.id) ? 1 : 0;
  verificar(`A=${a} B=${b}`, { soma, carry }, { soma: somaEsp, carry: carryEsp });
}

// ---- Teste 3: flip-flop D ----
titulo('Flip-flop D');
const c2 = criarCircuito();
const clock = criarClock(1);
adicionarComponente(c2, clock);
const swD = adicionarComponente(c2, criarComponente('SWITCH', { rotulo: 'D' }));
const dff = adicionarComponente(c2, criarComponente('DFF', { numEntradas: 1, numSaidas: 2, rotulo: 'DFF' }));
conectar(c2, { componente: swD.id, pino: 'out0' }, { componente: dff.id, pino: 'in0' });

acionarSwitch(c2, swD.id, 1);
verificar('Q antes da borda', dff.estado.q, 0);

tictac(c2); // borda de subida
verificar('Q após borda de subida', dff.estado.q, 1);

acionarSwitch(c2, swD.id, 0);
verificar('Q após D=0 (sem borda)', dff.estado.q, 1);

tictac(c2); // borda de descida
tictac(c2); // borda de subida
verificar('Q após nova borda com D=0', dff.estado.q, 0);

// ---- Teste 4: contador de 4 bits ----
titulo('Contador de 4 bits');
const c3 = criarCircuito();
const clock3 = criarClock(1);
adicionarComponente(c3, clock3);
const contador = adicionarComponente(c3, criarComponente('COUNTER', {
  numEntradas: 0,
  numSaidas: 4,
  rotulo: 'Contador',
}));
contador.estado.bits = 4;
contador.estado.valor = 0;

for (let i = 1; i <= 5; i++) {
  tictac(c3);
  tictac(c3); // dois semiciclos = um ciclo completo
  verificar(`Após ${i} ciclo(s)`, contador.estado.valor, i % 16);
}

resetar(c3);
verificar('Após reset', contador.estado.valor, 0);

console.log('\n=== Testes concluídos ===');