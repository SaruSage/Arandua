/**
 * montagem.js — Motor de montagem paramétrica com suporte a construção industrial e didática.
 */

import { CATALOGO, obterDimensoesComponente, obterPinosComponente } from './catalogo.js';
import { adicionarComponente, removerComponente } from './circuito.js';
import { registrar } from './historico.js';
import { recalcularMembros, atualizarTodosBounds, boundsDoComponente } from './grupos.js';
import { CORES_FIO, pontosDoFio } from './fios.js';
import { desenharComponente, posicaoPino } from './simbolos.js';
import { rotearFios } from './roteamento.js';

function sobrepoeBounds(a, b, margem = 12) {
  return a.x < b.x + b.w + margem
    && a.x + a.w + margem > b.x
    && a.y < b.y + b.h + margem
    && a.y + a.h + margem > b.y;
}

function segmentoAtravessaBounds(inicio, fim, bounds) {
  const deltaX = fim.x - inicio.x;
  const deltaY = fim.y - inicio.y;
  let tMin = 0;
  let tMax = 1;
  for (const [posicao, delta, minimo, maximo] of [
    [inicio.x, deltaX, bounds.x + 1e-6, bounds.x + bounds.w - 1e-6],
    [inicio.y, deltaY, bounds.y + 1e-6, bounds.y + bounds.h - 1e-6],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (posicao <= minimo || posicao >= maximo) return false;
      continue;
    }
    const t1 = (minimo - posicao) / delta;
    const t2 = (maximo - posicao) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin >= tMax) return false;
  }
  return tMax > 0 && tMin < 1;
}

function deslocamentoSemColisao(circuito, pecas) {
  const existentes = circuito.componentes.map((comp) => boundsDoComponente(comp));
  const segmentosExistentes = circuito.fios.flatMap((fio) => {
    const pontos = pontosDoFio(circuito, fio);
    return pontos.slice(1).map((fim, indice) => ({
      inicio: pontos[indice],
      fim,
    }));
  });
  const boundsOriginais = pecas.map((peca) =>
    boundsDoComponente({ tipo: peca.tipo, x: peca.x, y: peca.y, rotacao: peca.rotacao })
  );
  const candidatos = [{ dx: 0, dy: 0 }];
  for (let raio = 1; raio <= 80; raio++) {
    for (let dx = -raio; dx <= raio; dx++) {
      const dy = raio - Math.abs(dx);
      candidatos.push({ dx: dx * 40, dy: -dy * 40 });
      if (dy !== 0) candidatos.push({ dx: dx * 40, dy: dy * 40 });
    }
  }

  for (const deslocamento of candidatos) {
    const movidos = boundsOriginais.map((bounds) => ({
      ...bounds,
      x: bounds.x + deslocamento.dx,
      y: bounds.y + deslocamento.dy,
    }));
    let colisao = false;
    for (let indice = 0; indice < movidos.length && !colisao; indice++) {
      if (existentes.some((bounds) => sobrepoeBounds(movidos[indice], bounds))
        || segmentosExistentes.some((segmento) =>
          segmentoAtravessaBounds(segmento.inicio, segmento.fim, movidos[indice])
        )) {
        colisao = true;
        break;
      }
      for (let outro = indice + 1; outro < movidos.length; outro++) {
        if (sobrepoeBounds(movidos[indice], movidos[outro], 0)) {
          colisao = true;
          break;
        }
      }
    }
    if (!colisao) return deslocamento;
  }
  throw new Error('Não foi possível posicionar a montagem sem sobrepor componentes existentes.');
}

function criarReceitaXor(inverterSaida) {
  const nome = inverterSaida ? 'XNOR' : 'XOR';
  const pecasTransistores = Array.from({ length: inverterSaida ? 9 : 8 }, (_, indice) => ({
    ref: `Q${indice + 1}`,
    tipo: 'TRANSISTOR_NPN',
    rotulo: `Transistor Q${indice + 1} (NPN)`,
    valor: 'Ganho 100',
  }));
  const valoresResistores = [
    ['Pull-up do NAND de entrada', 1000],
    ['Pull-up do NOR de entrada', 1000],
    ['Pull-up do inversor OR', 1000],
    ['Base do transistor A (NAND)', 10000],
    ['Base do transistor B (NAND)', 10000],
    ['Base do transistor A (NOR)', 10000],
    ['Base do transistor B (NOR)', 10000],
    ['Base do inversor OR', 10000],
    ['Base do transistor A (AND)', 10000],
    ['Base do transistor B (AND)', 10000],
    ['Pull-up do NAND de saída', 1000],
    ['Base do inversor de saída', 10000],
    ['Pull-up da saída XOR', 1000],
    ...(inverterSaida ? [['Base do inversor XNOR', 10000], ['Pull-up da saída XNOR', 1000]] : []),
  ];
  const pecasResistores = valoresResistores.map(([rotulo, resistencia], indice) => ({
    ref: `R${indice + 1}`,
    tipo: 'RESISTOR',
    rotulo,
    valor: resistencia === 1000 ? '1 kΩ' : '10 kΩ',
    propriedades: { resistencia },
  }));
  const ligacoes = [
    ['V1.p1', 'R1.p1'], ['R1.p2', 'Q1.c'], ['Q1.e', 'Q2.c'], ['Q2.e', 'V1.p2'],
    ['InA.p', 'R4.p1'], ['R4.p2', 'Q1.b'],
    ['InB.p', 'R5.p1'], ['R5.p2', 'Q2.b'],
    ['V1.p1', 'R2.p1'], ['R2.p2', 'Q3.c'], ['R2.p2', 'Q4.c'],
    ['Q3.e', 'V1.p2'], ['Q4.e', 'V1.p2'],
    ['InA.p', 'R6.p1'], ['R6.p2', 'Q3.b'],
    ['InB.p', 'R7.p1'], ['R7.p2', 'Q4.b'],
    ['R2.p2', 'R8.p1'], ['R8.p2', 'Q5.b'],
    ['V1.p1', 'R3.p1'], ['R3.p2', 'Q5.c'], ['Q5.e', 'V1.p2'],
    ['R1.p2', 'R9.p1'], ['R9.p2', 'Q6.b'],
    ['R3.p2', 'R10.p1'], ['R10.p2', 'Q7.b'],
    ['V1.p1', 'R11.p1'], ['R11.p2', 'Q6.c'],
    ['Q6.e', 'Q7.c'], ['Q7.e', 'V1.p2'],
    ['R11.p2', 'R12.p1'], ['R12.p2', 'Q8.b'],
    ['V1.p1', 'R13.p1'], ['R13.p2', 'Q8.c'], ['Q8.e', 'V1.p2'],
  ];
  let referenciaSaida = 'Q8.c';

  if (inverterSaida) {
    ligacoes.push(
      ['Q8.c', 'R14.p1'], ['R14.p2', 'Q9.b'],
      ['V1.p1', 'R15.p1'], ['R15.p2', 'Q9.c'], ['Q9.e', 'V1.p2']
    );
    referenciaSaida = 'Q9.c';
  }

  ligacoes.push([referenciaSaida, 'OutY.p']);

  const pecasDidaticas = [
    { ref: 'S1', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S1 (entrada A)' },
    { ref: 'S2', tipo: 'CHAVE_CONTROLADA', rotulo: `Chave S2 (entrada ${inverterSaida ? 'B' : 'não B'})` },
    { ref: 'S3', tipo: 'CHAVE_CONTROLADA', rotulo: `Chave S3 (entrada ${inverterSaida ? 'não A' : 'não A'})` },
    { ref: 'S4', tipo: 'CHAVE_CONTROLADA', rotulo: `Chave S4 (entrada ${inverterSaida ? 'não B' : 'B'})` },
    { ref: 'Q1', tipo: 'TRANSISTOR_NPN', rotulo: 'Inversor da entrada A', valor: 'Ganho 100' },
    { ref: 'Q2', tipo: 'TRANSISTOR_NPN', rotulo: 'Inversor da entrada B', valor: 'Ganho 100' },
    ...Array.from({ length: 5 }, (_, indice) => ({
      ref: `R${indice + 1}`,
      tipo: 'RESISTOR',
      rotulo: indice < 2 ? `Pull-up do inversor ${indice === 0 ? 'A' : 'B'}` : indice < 4 ? `Base do inversor ${indice === 2 ? 'A' : 'B'}` : 'Pull-down da saída',
      valor: indice < 2 || indice === 4 ? (indice === 4 ? '10 kΩ' : '1 kΩ') : '10 kΩ',
      propriedades: { resistencia: indice < 2 ? 1000 : 10000 },
    })),
    { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
    { ref: 'InA', tipo: 'NO', rotulo: 'Entrada A', propriedades: { cor: '#e05a5a' } },
    { ref: 'InB', tipo: 'NO', rotulo: 'Entrada B', propriedades: { cor: '#e05a5a' } },
    { ref: 'OutY', tipo: 'NO', rotulo: 'Saída Y', propriedades: { cor: '#34C759' } },
  ];
  const ligacoesDidaticas = [
    ['V1.p1', 'R1.p1'], ['R1.p2', 'Q1.c'], ['Q1.e', 'V1.p2'],
    ['InA.p', 'R3.p1'], ['R3.p2', 'Q1.b'],
    ['V1.p1', 'R2.p1'], ['R2.p2', 'Q2.c'], ['Q2.e', 'V1.p2'],
    ['InB.p', 'R4.p1'], ['R4.p2', 'Q2.b'],
    ['V1.p1', 'S1.p1'], ['S1.p2', 'S2.p1'], ['S2.p2', 'OutY.p'],
    ['V1.p1', 'S3.p1'], ['S3.p2', 'S4.p1'], ['S4.p2', 'OutY.p'],
    ['OutY.p', 'R5.p1'], ['R5.p2', 'V1.p2'],
    ['InA.p', 'S1.controle'],
    [inverterSaida ? 'InB.p' : 'Q2.c', 'S2.controle'],
    ['Q1.c', 'S3.controle'],
    [inverterSaida ? 'Q2.c' : 'InB.p', 'S4.controle'],
  ];

  return {
    titulo: `Porta ${nome}`,
    industrial: {
      titulo: 'Construção Industrial',
      subtitulo: 'Rede RTL com Transistores BJT',
      descricao: inverterSaida
        ? 'Redes RTL de NAND, NOR e inversores NPN em cascata implementam a função XNOR.'
        : 'Redes RTL de NAND, NOR e inversores NPN em cascata implementam a função XOR.',
      pecas: [
        ...pecasTransistores,
        ...pecasResistores,
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
        { ref: 'InA', tipo: 'NO', rotulo: 'Entrada A (Nó)', propriedades: { cor: '#e05a5a' } },
        { ref: 'InB', tipo: 'NO', rotulo: 'Entrada B (Nó)', propriedades: { cor: '#e05a5a' } },
        { ref: 'OutY', tipo: 'NO', rotulo: 'Saída Y (Nó)', propriedades: { cor: '#34C759' } },
      ],
      ligacoes,
      entradas: ['InA.p', 'InB.p'],
      saidas: ['OutY.p'],
      mapeamentoPinos: {
        a: { ref: 'InA', pino: 'p' },
        b: { ref: 'InB', pino: 'p' },
        y: { ref: 'OutY', pino: 'p' },
      },
    },
    didatica: {
      titulo: 'Demonstração Didática',
      subtitulo: 'Chaves Controladas e Inversores',
      descricao: inverterSaida
        ? 'Dois ramos em paralelo representam A·B e não A·não B; inversores NPN fornecem os sinais complementares.'
        : 'Dois ramos em paralelo representam A·não B e não A·B; inversores NPN fornecem os sinais complementares.',
      pecas: pecasDidaticas,
      ligacoes: ligacoesDidaticas,
      entradas: ['InA.p', 'InB.p'],
      saidas: ['OutY.p'],
      mapeamentoPinos: {
        a: { ref: 'InA', pino: 'p' },
        b: { ref: 'InB', pino: 'p' },
        y: { ref: 'OutY', pino: 'p' },
      },
    },
  };
}

function criarReceitaBuffer() {
  return {
    titulo: 'Porta BUFFER',
    industrial: {
      titulo: 'Construção Industrial',
      subtitulo: 'Buffer RTL com Dois Transistores',
      descricao: 'Dois estágios inversores NPN em cascata restauram o nível lógico sem inverter o sinal.',
      pecas: [
        { ref: 'Q1', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q1 (1º inversor)', valor: 'Ganho 100' },
        { ref: 'Q2', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q2 (2º inversor)', valor: 'Ganho 100' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Base de Q1', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'R2', tipo: 'RESISTOR', rotulo: 'Pull-up de Q1', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'R3', tipo: 'RESISTOR', rotulo: 'Base de Q2', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'R4', tipo: 'RESISTOR', rotulo: 'Pull-up de Q2', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
        { ref: 'InA', tipo: 'NO', rotulo: 'Entrada A (Nó)', propriedades: { cor: '#e05a5a' } },
        { ref: 'OutY', tipo: 'NO', rotulo: 'Saída Y (Nó)', propriedades: { cor: '#34C759' } },
      ],
      ligacoes: [
        ['InA.p', 'R1.p1'], ['R1.p2', 'Q1.b'],
        ['V1.p1', 'R2.p1'], ['R2.p2', 'Q1.c'], ['Q1.e', 'V1.p2'],
        ['Q1.c', 'R3.p1'], ['R3.p2', 'Q2.b'],
        ['V1.p1', 'R4.p1'], ['R4.p2', 'Q2.c'], ['Q2.e', 'V1.p2'],
        ['Q2.c', 'OutY.p'],
      ],
      entradas: ['InA.p'],
      saidas: ['OutY.p'],
      mapeamentoPinos: {
        a: { ref: 'InA', pino: 'p' },
        y: { ref: 'OutY', pino: 'p' },
      },
    },
    didatica: {
      titulo: 'Demonstração Didática',
      subtitulo: 'Chave Controlada com Pull-down',
      descricao: 'Uma chave controlada pela entrada conecta a saída à alimentação e o resistor a mantém em nível baixo quando aberta.',
      pecas: [
        { ref: 'S1', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S1 (entrada A)' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor pull-down', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
        { ref: 'InA', tipo: 'NO', rotulo: 'Entrada A', propriedades: { cor: '#e05a5a' } },
        { ref: 'OutY', tipo: 'NO', rotulo: 'Saída Y', propriedades: { cor: '#34C759' } },
      ],
      ligacoes: [
        ['V1.p1', 'S1.p1'], ['S1.p2', 'OutY.p'], ['OutY.p', 'R1.p1'],
        ['R1.p2', 'V1.p2'], ['InA.p', 'S1.controle'],
      ],
      entradas: ['InA.p'],
      saidas: ['OutY.p'],
      mapeamentoPinos: {
        a: { ref: 'InA', pino: 'p' },
        y: { ref: 'OutY', pino: 'p' },
      },
    },
  };
}

const SEGMENTOS_DISPLAY = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

function criarReceitaDisplay(tipoComum = 'cátodo comum', corLED = '#ff3b30') {
  const anodoComum = tipoComum === 'ânodo comum';
  const pecas = [];
  const ligacoes = [];
  const mapeamentoPinos = {};
  const entradas = [];

  SEGMENTOS_DISPLAY.forEach((segmento) => {
    const refResistor = `R${segmento}`;
    const refLed = `LED${segmento}`;
    const refComum = `COM${segmento.toUpperCase()}`;
    pecas.push(
      {
        ref: refResistor,
        tipo: 'RESISTOR',
        rotulo: `R ${segmento}`,
        valor: '330 Ω',
        propriedades: { resistencia: 330 },
        rotacao: { a: 90, b: 180, c: 180, d: 270 }[segmento] || 0,
      },
      {
        ref: refLed,
        tipo: 'LED',
        rotulo: `LED ${segmento}`,
        valor: 'Vermelho · 2 V',
        propriedades: { cor: corLED, tensaoDireta: 2, correnteNominal: 0.02 },
        rotacao: { b: 90, c: 90, e: 90, f: 90 }[segmento] || 0,
      },
      {
        ref: refComum,
        tipo: 'NO',
        rotulo: `COM ${segmento}`,
        propriedades: { cor: '#3e9670' },
      }
    );

    ligacoes.push(
      anodoComum
        ? [`${refComum}.p`, `${refLed}.p1`]
        : [`${refResistor}.p2`, `${refLed}.p1`],
      anodoComum
        ? [`${refLed}.p2`, `${refResistor}.p2`]
        : [`${refLed}.p2`, `${refComum}.p`]
    );
    mapeamentoPinos[segmento] = { ref: refResistor, pino: 'p1' };
    entradas.push(`${refResistor}.p1`);
  });

  const ordemComum = anodoComum
    ? ['a', 'f', 'g', 'e', 'd', 'c', 'b']
    : ['a', 'b', 'g', 'c', 'd', 'e', 'f'];
  for (let indice = 1; indice < ordemComum.length; indice++) {
    ligacoes.push([
      `COM${ordemComum[indice - 1].toUpperCase()}.p`,
      `COM${ordemComum[indice].toUpperCase()}.p`,
    ]);
  }
  mapeamentoPinos.com = { ref: 'COMG', pino: 'p' };
  entradas.push('COMG.p');

  return {
    titulo: 'Display de sete segmentos',
    industrial: {
      titulo: 'Montagem funcional',
      subtitulo: 'Sete LEDs com resistores limitadores',
      descricao: `Um LED e um resistor de 330 Ω em cada segmento, ligados ao barramento de ${anodoComum ? 'ânodo' : 'cátodo'} comum.`,
      pecas: pecas.map((peca) =>
        peca.tipo === 'RESISTOR'
          ? { ...peca, valor: '330 Ω', propriedades: { resistencia: 330 } }
          : peca
      ),
      ligacoes,
      entradas,
      saidas: [],
      mapeamentoPinos,
    },
    didatica: {
      titulo: 'Versão de menor corrente',
      subtitulo: 'Sete LEDs com resistores de 470 Ω',
      descricao: `O mesmo arranjo com 470 Ω por segmento, reduzindo a corrente e o brilho. O barramento é de ${anodoComum ? 'ânodo' : 'cátodo'} comum.`,
      pecas: pecas.map((peca) =>
        peca.tipo === 'RESISTOR'
          ? { ...peca, valor: '470 Ω', propriedades: { resistencia: 470 } }
          : peca
      ),
      ligacoes,
      entradas,
      saidas: [],
      mapeamentoPinos,
    },
  };
}

function criarReceitaAmpOp(comBuffer) {
  const pecas = [
    { ref: 'RINP', tipo: 'RESISTOR', rotulo: 'Resistor de entrada +', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
    { ref: 'RINM', tipo: 'RESISTOR', rotulo: 'Resistor de entrada −', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
    { ref: 'Q1', tipo: 'TRANSISTOR_NPN', rotulo: 'Q1 · entrada +', valor: 'NPN' },
    { ref: 'Q2', tipo: 'TRANSISTOR_NPN', rotulo: 'Q2 · entrada −', valor: 'NPN' },
    { ref: 'RC1', tipo: 'RESISTOR', rotulo: 'Carga do coletor Q1', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
    { ref: 'RC2', tipo: 'RESISTOR', rotulo: 'Carga do coletor Q2', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
    { ref: 'RT', tipo: 'RESISTOR', rotulo: 'Resistor de cauda', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
    { ref: 'VP', tipo: 'NO', rotulo: 'Trilho positivo', propriedades: { cor: '#e05a5a' } },
    { ref: 'VN', tipo: 'NO', rotulo: 'Trilho negativo', propriedades: { cor: '#5271c4' } },
    { ref: 'OUT', tipo: 'NO', rotulo: 'Saída', propriedades: { cor: '#3e9670' } },
  ];
  const ligacoes = [
    ['RINP.p2', 'Q1.b'],
    ['RINM.p2', 'Q2.b'],
    ['VP.p', 'RC1.p1'],
    ['VP.p', 'RC2.p1'],
    ['RC1.p2', 'Q1.c'],
    ['RC2.p2', 'Q2.c'],
    ['Q1.e', 'RT.p1'],
    ['Q2.e', 'RT.p1'],
    ['RT.p2', 'VN.p'],
    ['Q2.c', 'Q3.b'],
    ['VP.p', 'Q3.c'],
    ['Q3.e', 'OUT.p'],
    ['OUT.p', 'RL.p1'],
    ['RL.p2', 'VN.p'],
  ];

  if (comBuffer) {
    pecas.push(
      { ref: 'Q3', tipo: 'TRANSISTOR_NPN', rotulo: 'Q3 · buffer de saída', valor: 'NPN' },
      { ref: 'RL', tipo: 'RESISTOR', rotulo: 'Carga da saída', valor: '10 kΩ', propriedades: { resistencia: 10000 } }
    );
  } else {
    ligacoes.splice(9);
    ligacoes.push(['Q2.c', 'OUT.p']);
  }

  const receita = {
    pecas,
    ligacoes,
    entradas: ['RINP.p1', 'RINM.p1', 'VP.p', 'VN.p'],
    saidas: ['OUT.p'],
    mapeamentoPinos: {
      inp: { ref: 'RINP', pino: 'p1' },
      inm: { ref: 'RINM', pino: 'p1' },
      vmais: { ref: 'VP', pino: 'p' },
      vmenos: { ref: 'VN', pino: 'p' },
      out: { ref: 'OUT', pino: 'p' },
    },
  };

  return {
    ...receita,
    titulo: comBuffer ? 'Par diferencial com buffer de saída' : 'Par diferencial básico',
    subtitulo: comBuffer ? 'Transistores NPN e cargas resistivas' : 'Dois transistores e três resistores',
    descricao: comBuffer
      ? 'O par diferencial compara as entradas; um seguidor de emissor fornece uma saída com menor impedância. Conecte os trilhos positivo e negativo aos pinos V+ e V−.'
      : 'Dois transistores compartilham a corrente de cauda e convertem a diferença entre as entradas em uma variação de tensão no coletor Q2. Conecte os trilhos aos pinos V+ e V−.',
  };
}

function criarReceitaCiGenerico(funcao = 'buffer') {
  const tiposPorta = {
    buffer: 'BUFFER',
    inversor: 'NOT',
    AND: 'AND',
    OR: 'OR',
    NAND: 'NAND',
    NOR: 'NOR',
  };
  const tipoPorta = tiposPorta[funcao] || 'BUFFER';
  const portaBinaria = ['AND', 'OR', 'NAND', 'NOR'].includes(tipoPorta);
  const pinosLivres = ['p2', 'p3', 'p4', 'p6', 'p7', 'p8']
    .filter((pino) => !(portaBinaria && pino === 'p2'));
  const pecas = [
    { ref: 'U1', tipo: tipoPorta, rotulo: `Função interna · ${funcao}`, valor: tipoPorta },
    ...pinosLivres.map((pino) => ({
      ref: `NC${pino.slice(1)}`,
      tipo: 'NO',
      rotulo: `Pino ${pino.slice(1)} sem função interna`,
      propriedades: { cor: '#8a8a8a' },
    })),
  ];
  const mapeamentoPinos = {
    p1: { ref: 'U1', pino: 'a' },
    p5: { ref: 'U1', pino: 'y' },
  };
  if (portaBinaria) mapeamentoPinos.p2 = { ref: 'U1', pino: 'b' };
  for (const pino of pinosLivres) {
    mapeamentoPinos[pino] = { ref: `NC${pino.slice(1)}`, pino: 'p' };
  }

  return {
    titulo: `CI genérico · ${funcao}`,
    industrial: {
      titulo: 'Equivalente funcional',
      subtitulo: `Função lógica ${funcao}`,
      descricao: 'A função selecionada é representada pela porta lógica equivalente do catálogo. As conexões dos demais pinos são preservadas como nós sem ligação interna.',
      pecas,
      ligacoes: [],
      entradas: portaBinaria ? ['U1.a', 'U1.b'] : ['U1.a'],
      saidas: ['U1.y'],
      mapeamentoPinos,
    },
  };
}

/**
 * Tabela de receitas de montagem paramétrica para portas lógicas e componentes compostos.
 * Cada tipo pode oferecer uma ou duas variantes:
 * 1. industrial: Construção convencional industrial utilizando transistores e componentes convencionais com lógica real.
 * 2. didatica: Demonstração didática funcional utilizando chaves mecânicas/circuitos discretos de contato.
 */
export const RECEITAS_MONTAGEM = {
  AND: {
    titulo: 'Porta AND',
    industrial: {
      titulo: 'Construção Industrial',
      subtitulo: 'Rede RTL com Transistores BJT',
      descricao: 'Dois transistores NPN em série formam uma NAND, seguida por um inversor NPN para restaurar o nível lógico da saída AND.',
      pecas: [
        { ref: 'Q1', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q1 (NPN)', valor: 'Ganho 100' },
        { ref: 'Q2', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q2 (NPN)', valor: 'Ganho 100' },
        { ref: 'Q3', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q3 (Inversor)', valor: 'Ganho 100' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Pull-up do estágio NAND', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'R2', tipo: 'RESISTOR', rotulo: 'Resistor de base Q3', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'R3', tipo: 'RESISTOR', rotulo: 'Pull-up da saída', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'R4', tipo: 'RESISTOR', rotulo: 'Resistor de base Q1', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'R5', tipo: 'RESISTOR', rotulo: 'Resistor de base Q2', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
        { ref: 'InA', tipo: 'NO', rotulo: 'Entrada A (Nó)', propriedades: { cor: '#e05a5a' } },
        { ref: 'InB', tipo: 'NO', rotulo: 'Entrada B (Nó)', propriedades: { cor: '#e05a5a' } },
      ],
      ligacoes: [
        ['V1.p1', 'R1.p1'],
        ['R1.p2', 'Q1.c'],
        ['Q1.e', 'Q2.c'],
        ['Q2.e', 'V1.p2'],
        ['R1.p2', 'R2.p1'],
        ['R2.p2', 'Q3.b'],
        ['V1.p1', 'R3.p1'],
        ['R3.p2', 'Q3.c'],
        ['Q3.e', 'V1.p2'],
        ['InA.p', 'R4.p1'],
        ['R4.p2', 'Q1.b'],
        ['InB.p', 'R5.p1'],
        ['R5.p2', 'Q2.b'],
      ],
      entradas: ['InA.p', 'InB.p'],
      saidas: ['Q3.c'],
      mapeamentoPinos: {
        a: { ref: 'InA', pino: 'p' },
        b: { ref: 'InB', pino: 'p' },
        y: { ref: 'Q3', pino: 'c' },
      },
    },
    didatica: {
      titulo: 'Demonstração Didática',
      subtitulo: 'Chaves em Série',
      descricao: 'Duas chaves controladas pelas entradas em série demonstrando a função lógica E (AND).',
      pecas: [
        { ref: 'S1', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S1 (entrada A)' },
        { ref: 'S2', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S2 (entrada B)' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor pull-down', propriedades: { resistencia: 10000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
      ],
      ligacoes: [
        ['V1.p1', 'S1.p1'],
        ['S1.p2', 'S2.p1'],
        ['S2.p2', 'R1.p1'],
        ['R1.p2', 'V1.p2'],
      ],
      entradas: ['S1.controle', 'S2.controle'],
      saidas: ['S2.p2'],
      mapeamentoPinos: {
        a: { ref: 'S1', pino: 'controle' },
        b: { ref: 'S2', pino: 'controle' },
        y: { ref: 'S2', pino: 'p2' },
      },
    },
  },
  OR: {
    titulo: 'Porta OR',
    industrial: {
      titulo: 'Construção Industrial',
      subtitulo: 'Rede RTL com Transistores BJT',
      descricao: 'Dois transistores NPN em paralelo formam uma NOR, seguida por um inversor NPN para restaurar o nível lógico da saída OR.',
      pecas: [
        { ref: 'Q1', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q1 (NPN)', valor: 'Ganho 100' },
        { ref: 'Q2', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q2 (NPN)', valor: 'Ganho 100' },
        { ref: 'Q3', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q3 (Inversor)', valor: 'Ganho 100' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Pull-up do estágio NOR', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'R2', tipo: 'RESISTOR', rotulo: 'Resistor de base Q3', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'R3', tipo: 'RESISTOR', rotulo: 'Pull-up da saída', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'R4', tipo: 'RESISTOR', rotulo: 'Resistor de base Q1', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'R5', tipo: 'RESISTOR', rotulo: 'Resistor de base Q2', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
        { ref: 'InA', tipo: 'NO', rotulo: 'Entrada A (Nó)', propriedades: { cor: '#e05a5a' } },
        { ref: 'InB', tipo: 'NO', rotulo: 'Entrada B (Nó)', propriedades: { cor: '#e05a5a' } },
      ],
      ligacoes: [
        ['V1.p1', 'R1.p1'],
        ['R1.p2', 'Q1.c'],
        ['R1.p2', 'Q2.c'],
        ['Q1.e', 'V1.p2'],
        ['Q2.e', 'V1.p2'],
        ['R1.p2', 'R2.p1'],
        ['R2.p2', 'Q3.b'],
        ['V1.p1', 'R3.p1'],
        ['R3.p2', 'Q3.c'],
        ['Q3.e', 'V1.p2'],
        ['InA.p', 'R4.p1'],
        ['R4.p2', 'Q1.b'],
        ['InB.p', 'R5.p1'],
        ['R5.p2', 'Q2.b'],
      ],
      entradas: ['InA.p', 'InB.p'],
      saidas: ['Q3.c'],
      mapeamentoPinos: {
        a: { ref: 'InA', pino: 'p' },
        b: { ref: 'InB', pino: 'p' },
        y: { ref: 'Q3', pino: 'c' },
      },
    },
    didatica: {
      titulo: 'Demonstração Didática',
      subtitulo: 'Chaves em Paralelo',
      descricao: 'Duas chaves controladas pelas entradas em paralelo demonstrando a função lógica OU (OR).',
      pecas: [
        { ref: 'S1', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S1 (entrada A)' },
        { ref: 'S2', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S2 (entrada B)' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor pull-down', propriedades: { resistencia: 10000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
      ],
      ligacoes: [
        ['V1.p1', 'S1.p1'],
        ['V1.p1', 'S2.p1'],
        ['S1.p2', 'S2.p2'],
        ['S2.p2', 'R1.p1'],
        ['R1.p2', 'V1.p2'],
      ],
      entradas: ['S1.controle', 'S2.controle'],
      saidas: ['S2.p2'],
      mapeamentoPinos: {
        a: { ref: 'S1', pino: 'controle' },
        b: { ref: 'S2', pino: 'controle' },
        y: { ref: 'S2', pino: 'p2' },
      },
    },
  },
  NOT: {
    titulo: 'Porta NOT (Inversor)',
    industrial: {
      titulo: 'Construção Industrial',
      subtitulo: 'Inversor RTL com Transistor',
      descricao: 'Transistor NPN com resistor de base e pull-up para Vcc.',
      pecas: [
        { ref: 'Q1', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q1 (NPN)', valor: 'Ganho 100' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor de Base', valor: '10 kΩ', propriedades: { resistencia: 10000 } },
        { ref: 'R2', tipo: 'RESISTOR', rotulo: 'Resistor Pull-up', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
      ],
      ligacoes: [
        ['R1.p2', 'Q1.b'],
        ['V1.p1', 'R2.p1'],
        ['R2.p2', 'Q1.c'],
        ['Q1.e', 'V1.p2'],
      ],
      entradas: ['R1.p1'],
      saidas: ['Q1.c'],
      mapeamentoPinos: {
        a: { ref: 'R1', pino: 'p1' },
        y: { ref: 'Q1', pino: 'c' },
      },
    },
    didatica: {
      titulo: 'Demonstração Didática',
      subtitulo: 'Chave Inversora com Pull-up',
      descricao: 'Chave controlada pela entrada para GND com resistor pull-up.',
      pecas: [
        { ref: 'S1', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S1 (entrada A)' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor Pull-up', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
      ],
      ligacoes: [
        ['V1.p1', 'R1.p1'],
        ['R1.p2', 'S1.p1'],
        ['S1.p2', 'V1.p2'],
      ],
      entradas: ['S1.controle'],
      saidas: ['R1.p2'],
      mapeamentoPinos: {
        a: { ref: 'S1', pino: 'controle' },
        y: { ref: 'R1', pino: 'p2' },
      },
    },
  },
  NAND: {
    titulo: 'Porta NAND',
    industrial: {
      titulo: 'Construção Industrial',
      subtitulo: 'NAND RTL com Transistores',
      descricao: 'Dois transistores NPN em série aterrando a saída com pull-up.',
      pecas: [
        { ref: 'Q1', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q1 (NPN)', valor: 'Ganho 100' },
        { ref: 'Q2', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q2 (NPN)', valor: 'Ganho 100' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor Pull-up', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
      ],
      ligacoes: [
        ['V1.p1', 'R1.p1'],
        ['R1.p2', 'Q1.c'],
        ['Q1.e', 'Q2.c'],
        ['Q2.e', 'V1.p2'],
      ],
      entradas: ['Q1.b', 'Q2.b'],
      saidas: ['Q1.c'],
      mapeamentoPinos: {
        a: { ref: 'Q1', pino: 'b' },
        b: { ref: 'Q2', pino: 'b' },
        y: { ref: 'Q1', pino: 'c' },
      },
    },
    didatica: {
      titulo: 'Demonstração Didática',
      subtitulo: 'Chaves em Série com Pull-up',
      descricao: 'Duas chaves controladas pelas entradas em série para GND com resistor pull-up.',
      pecas: [
        { ref: 'S1', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S1 (entrada A)' },
        { ref: 'S2', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S2 (entrada B)' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor Pull-up', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
      ],
      ligacoes: [
        ['V1.p1', 'R1.p1'],
        ['R1.p2', 'S1.p1'],
        ['S1.p2', 'S2.p1'],
        ['S2.p2', 'V1.p2'],
      ],
      entradas: ['S1.controle', 'S2.controle'],
      saidas: ['S1.p1'],
      mapeamentoPinos: {
        a: { ref: 'S1', pino: 'controle' },
        b: { ref: 'S2', pino: 'controle' },
        y: { ref: 'R1', pino: 'p2' },
      },
    },
  },
  NOR: {
    titulo: 'Porta NOR',
    industrial: {
      titulo: 'Construção Industrial',
      subtitulo: 'NOR RTL com Transistores',
      descricao: 'Dois transistores NPN em paralelo aterrando a saída com pull-up.',
      pecas: [
        { ref: 'Q1', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q1 (NPN)', valor: 'Ganho 100' },
        { ref: 'Q2', tipo: 'TRANSISTOR_NPN', rotulo: 'Transistor Q2 (NPN)', valor: 'Ganho 100' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor Pull-up', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
      ],
      ligacoes: [
        ['V1.p1', 'R1.p1'],
        ['R1.p2', 'Q1.c'],
        ['R1.p2', 'Q2.c'],
        ['Q1.e', 'V1.p2'],
        ['Q2.e', 'V1.p2'],
      ],
      entradas: ['Q1.b', 'Q2.b'],
      saidas: ['Q1.c'],
      mapeamentoPinos: {
        a: { ref: 'Q1', pino: 'b' },
        b: { ref: 'Q2', pino: 'b' },
        y: { ref: 'Q1', pino: 'c' },
      },
    },
    didatica: {
      titulo: 'Demonstração Didática',
      subtitulo: 'Chaves em Paralelo com Pull-up',
      descricao: 'Duas chaves controladas pelas entradas em paralelo para GND com resistor pull-up.',
      pecas: [
        { ref: 'S1', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S1 (entrada A)' },
        { ref: 'S2', tipo: 'CHAVE_CONTROLADA', rotulo: 'Chave S2 (entrada B)' },
        { ref: 'R1', tipo: 'RESISTOR', rotulo: 'Resistor Pull-up', valor: '1 kΩ', propriedades: { resistencia: 1000 } },
        { ref: 'V1', tipo: 'BATERIA', rotulo: 'Alimentação Vcc', valor: '5 V', propriedades: { tensao: 5 } },
      ],
      ligacoes: [
        ['V1.p1', 'R1.p1'],
        ['R1.p2', 'S1.p1'],
        ['R1.p2', 'S2.p1'],
        ['S1.p2', 'V1.p2'],
        ['S2.p2', 'V1.p2'],
      ],
      entradas: ['S1.controle', 'S2.controle'],
      saidas: ['R1.p2'],
      mapeamentoPinos: {
        a: { ref: 'S1', pino: 'controle' },
        b: { ref: 'S2', pino: 'controle' },
        y: { ref: 'R1', pino: 'p2' },
      },
    },
  },
  XOR: criarReceitaXor(false),
  XNOR: criarReceitaXor(true),
  BUFFER: criarReceitaBuffer(),
  DISPLAY_7SEG: criarReceitaDisplay(),
  AMP_OP: {
    titulo: 'Amplificador operacional',
    industrial: criarReceitaAmpOp(true),
    didatica: criarReceitaAmpOp(false),
  },
  CI_GENERICO: criarReceitaCiGenerico(),
};

function receitasDoComponente(componente) {
  if (componente.tipo === 'DISPLAY_7SEG') {
    return criarReceitaDisplay(
      componente.propriedades?.tipo,
      componente.propriedades?.cor || '#ff3b30'
    );
  }
  if (componente.tipo === 'CI_GENERICO') {
    return criarReceitaCiGenerico(componente.propriedades?.funcao);
  }
  return RECEITAS_MONTAGEM[componente.tipo];
}

/* ===== ESQUEMAS INDUSTRIAIS FIXOS (AND e OR) ===== */

const COR_FIO_VERMELHO = '#FF3B30';
const COR_FIO_LARANJA = '#FF9500';
const COR_FIO_VERDE = '#34C759';
const COR_FIO_TERRA = '#1a1d27';

/**
 * Esquemas industriais desenhados pelo usuário na própria plataforma.
 * Todas as coordenadas são RELATIVAS ao centro do transistor Q1 (em unidades de mundo).
 * - pecas: posição do CENTRO de cada peça e rotação em graus
 * - fios: [pinoOrigem, pinoDestino, cor, dobras] (dobras na ordem origem → destino)
 * - entradas/saida: onde as ligações externas da porta substituída devem chegar
 */
export const LAYOUT_INDUSTRIAL = {
  AND: {
    pecas: [
      { ref: 'Q1', tipo: 'TRANSISTOR_NPN', cx: 0, cy: 0, rot: 0 },
      { ref: 'Q2', tipo: 'TRANSISTOR_NPN', cx: 0, cy: 100, rot: 0 },
      { ref: 'Q3', tipo: 'TRANSISTOR_NPN', cx: 220, cy: 0, rot: 0 },
      { ref: 'R1', tipo: 'RESISTOR', cx: 100, cy: -70, rot: 0, propriedades: { resistencia: 1000 } },
      { ref: 'R2', tipo: 'RESISTOR', cx: 100, cy: 20, rot: 0, propriedades: { resistencia: 10000 } },
      { ref: 'R3', tipo: 'RESISTOR', cx: 320, cy: -70, rot: 0, propriedades: { resistencia: 1000 } },
      { ref: 'R4', tipo: 'RESISTOR', cx: -100, cy: 0, rot: 0, propriedades: { resistencia: 10000 } },
      { ref: 'R5', tipo: 'RESISTOR', cx: -100, cy: 100, rot: 0, propriedades: { resistencia: 10000 } },
      { ref: 'V1', tipo: 'BATERIA', cx: 100, cy: -120, rot: 90, propriedades: { tensao: 5 } },
      { ref: 'InA', tipo: 'NO', cx: -180, cy: 0, rot: 0, propriedades: { cor: '#e05a5a' } },
      { ref: 'InB', tipo: 'NO', cx: -180, cy: 100, rot: 0, propriedades: { cor: '#e05a5a' } },
    ],
    fios: [
      ['V1.p1', 'R1.p1', COR_FIO_VERMELHO, []],
      ['R1.p2', 'Q1.c', COR_FIO_VERDE, [{ x: 32, y: -70 }]],
      ['Q1.e', 'Q2.c', COR_FIO_LARANJA, []],
      ['Q2.e', 'V1.p2', COR_FIO_TERRA, []],
      ['R1.p2', 'R2.p1', COR_FIO_VERDE, []],
      ['R2.p2', 'Q3.b', COR_FIO_LARANJA, []],
      ['V1.p1', 'R3.p1', COR_FIO_VERMELHO, []],
      ['R3.p2', 'Q3.c', COR_FIO_VERDE, []],
      ['Q3.e', 'V1.p2', COR_FIO_TERRA, []],
      ['InA.p', 'R4.p1', COR_FIO_TERRA, []],
      ['R4.p2', 'Q1.b', COR_FIO_TERRA, []],
      ['InB.p', 'R5.p1', COR_FIO_TERRA, []],
      ['R5.p2', 'Q2.b', COR_FIO_TERRA, []],
    ],
    entradas: { a: ['InA', 'p'], b: ['InB', 'p'] },
    saida: ['Q3', 'c'],
  },
  OR: {
    pecas: [
      { ref: 'Q1', tipo: 'TRANSISTOR_NPN', cx: 0, cy: -20, rot: 0 },
      { ref: 'Q2', tipo: 'TRANSISTOR_NPN', cx: 0, cy: 80, rot: 0 },
      { ref: 'Q3', tipo: 'TRANSISTOR_NPN', cx: 220, cy: 0, rot: 0 },
      { ref: 'R1', tipo: 'RESISTOR', cx: 100, cy: -70, rot: 0, propriedades: { resistencia: 1000 } },
      { ref: 'R2', tipo: 'RESISTOR', cx: 100, cy: 20, rot: 0, propriedades: { resistencia: 10000 } },
      { ref: 'R3', tipo: 'RESISTOR', cx: 320, cy: -70, rot: 0, propriedades: { resistencia: 1000 } },
      { ref: 'R4', tipo: 'RESISTOR', cx: -100, cy: -20, rot: 0, propriedades: { resistencia: 10000 } },
      { ref: 'R5', tipo: 'RESISTOR', cx: -100, cy: 80, rot: 0, propriedades: { resistencia: 10000 } },
      { ref: 'V1', tipo: 'BATERIA', cx: 100, cy: -120, rot: 90, propriedades: { tensao: 5 } },
      { ref: 'InA', tipo: 'NO', cx: -180, cy: -20, rot: 0, propriedades: { cor: '#e05a5a' } },
      { ref: 'InB', tipo: 'NO', cx: -180, cy: 80, rot: 0, propriedades: { cor: '#e05a5a' } },
    ],
    fios: [
      ['V1.p1', 'R1.p1', COR_FIO_VERMELHO, []],
      ['R1.p2', 'Q1.c', COR_FIO_VERDE, [{ x: 32, y: -70 }]],
      ['R1.p2', 'Q2.c', COR_FIO_VERDE, [{ x: 32, y: 80 }]],
      ['Q1.e', 'V1.p2', COR_FIO_TERRA, []],
      ['Q2.e', 'V1.p2', COR_FIO_TERRA, []],
      ['R1.p2', 'R2.p1', COR_FIO_VERDE, []],
      ['R2.p2', 'Q3.b', COR_FIO_LARANJA, []],
      ['V1.p1', 'R3.p1', COR_FIO_VERMELHO, []],
      ['R3.p2', 'Q3.c', COR_FIO_VERDE, []],
      ['Q3.e', 'V1.p2', COR_FIO_TERRA, []],
      ['InA.p', 'R4.p1', COR_FIO_TERRA, []],
      ['R4.p2', 'Q1.b', COR_FIO_TERRA, []],
      ['InB.p', 'R5.p1', COR_FIO_TERRA, []],
      ['R5.p2', 'Q2.b', COR_FIO_TERRA, []],
    ],
    entradas: { a: ['InA', 'p'], b: ['InB', 'p'] },
    saida: ['Q3', 'c'],
  },
};

/**
 * Instancia (sem criar nada no circuito) o esquema industrial de `tipo`, com Q1 centrado
 * em (qcx, qcy). Devolve as peças com posição de canto superior esquerdo, os fios com
 * dobras em coordenadas de mundo e uma função para obter a posição de qualquer pino.
 */
export function esquemaIndustrial(tipo, qcx, qcy) {
  const layout = LAYOUT_INDUSTRIAL[tipo];
  if (!layout) return null;

  const pecas = layout.pecas.map((p) => {
    const dim = CATALOGO[p.tipo].dimensoes;
    const cx = qcx + p.cx;
    const cy = qcy + p.cy;
    return {
      ref: p.ref,
      tipo: p.tipo,
      x: cx - dim.w / 2,
      y: cy - dim.h / 2,
      cx,
      cy,
      rotacao: p.rot,
      propriedades: p.propriedades ? { ...p.propriedades } : null,
    };
  });

  const fios = layout.fios.map(([a, b, cor, dobras]) => [
    a,
    b,
    cor,
    dobras.map((d) => ({ x: qcx + d.x, y: qcy + d.y })),
  ]);

  const porRef = Object.fromEntries(pecas.map((p) => [p.ref, p]));
  const pino = (ref, pinoId) => {
    const p = porRef[ref];
    return posicaoPino({ tipo: p.tipo, x: p.x, y: p.y, rotacao: p.rotacao }, pinoId);
  };

  return { pecas, fios, pino, entradas: layout.entradas, saida: layout.saida };
}

/** Rota ortogonal para um fio que parte de P e chega à entrada T pela esquerda. */
export function rotaEntradaOrtogonal(P, T) {
  if (Math.abs(P.y - T.y) < 1) return [];
  let xm = T.x - 28;
  if (xm <= P.x + 10) xm = (P.x + T.x) / 2;
  return [{ x: xm, y: P.y }, { x: xm, y: T.y }];
}

/** Rota ortogonal para um fio que parte da saída T e chega à carga P pela esquerda. */
export function rotaSaidaOrtogonal(T, P) {
  if (Math.abs(P.y - T.y) < 1) return [];
  let xm = P.x - 28;
  if (xm <= T.x + 10) xm = (P.x + T.x) / 2;
  return [{ x: xm, y: T.y }, { x: xm, y: P.y }];
}

/** Desenha o esquema industrial real (peças e fios) numa prévia 2D. */
function desenharPreviaEsquema(ctx, w, h, tipoPorta) {
  const esq = esquemaIndustrial(tipoPorta, 0, 0);
  if (!esq) return;

  const minX = -105;
  const maxX = 140;
  const minY = -64;
  const maxY = Math.max(...esq.pecas.map((p) => p.cy)) + 36;
  const escala = Math.min((w - 20) / (maxX - minX), (h - 20) / (maxY - minY));
  const ox = (w - (maxX - minX) * escala) / 2 - minX * escala;
  const oy = (h - (maxY - minY) * escala) / 2 - minY * escala;
  const tela = (p) => ({ x: ox + p.x * escala, y: oy + p.y * escala });

  ctx.save();

  // Fios
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, 2 * escala);
  for (const [a, b, cor, dobras] of esq.fios) {
    const [refA, pinoA] = a.split('.');
    const [refB, pinoB] = b.split('.');
    const pts = [esq.pino(refA, pinoA), ...dobras, esq.pino(refB, pinoB)].map(tela);
    ctx.strokeStyle = cor;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  // Componentes
  for (const p of esq.pecas) {
    const comp = {
      tipo: p.tipo,
      x: 0,
      y: 0,
      rotacao: p.rotacao,
      propriedades: p.propriedades ? { ...p.propriedades } : {},
      pinos: obterPinosComponente(p.tipo, p.propriedades),
      dimensoes: obterDimensoesComponente(p.tipo, p.propriedades),
    };
    const t = tela({ x: p.x, y: p.y });
    desenharComponente(ctx, comp, t.x, t.y, escala);
  }

  // Rótulos de entrada e saída
  ctx.fillStyle = '#6b7280';
  ctx.font = '600 9px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  const entA = tela(esq.pino(...esq.entradas.a));
  const entB = tela(esq.pino(...esq.entradas.b));
  ctx.fillText('In A', entA.x - 10 * escala, entA.y);
  ctx.fillText('In B', entB.x - 10 * escala, entB.y);
  ctx.textAlign = 'left';
  const sai = tela(esq.pino(...esq.saida));
  ctx.fillText('Out Y', sai.x + 10 * escala, sai.y + 8);

  ctx.restore();
}

/**
 * Extrai valores atuais lendo SEMPRE do componente real.
 */
export function extrairValoresAtuais(componente) {
  const valores = {};
  if (!componente) return valores;

  valores.nomeCustom = componente.nomeCustom || '—';
  valores.cor = componente.propriedades?.cor || componente.cor || '—';

  if (componente.propriedades) {
    if (componente.propriedades.resistencia !== undefined) {
      valores.resistencia = `${componente.propriedades.resistencia} Ω`;
    }
    if (componente.propriedades.capacitancia !== undefined) {
      valores.capacitancia = `${componente.propriedades.capacitancia} F`;
    }
    if (componente.propriedades.indutancia !== undefined) {
      valores.indutancia = `${componente.propriedades.indutancia} H`;
    }
    if (componente.propriedades.tensao !== undefined) {
      valores.tensao = `${componente.propriedades.tensao} V`;
    }
    if (componente.propriedades.frequencia !== undefined) {
      valores.frequencia = `${componente.propriedades.frequencia} Hz`;
    }
    if (componente.propriedades.fechada !== undefined) {
      valores.estado = componente.propriedades.fechada ? 'Fechada' : 'Aberta';
    }
    if (componente.propriedades.pressionado !== undefined) {
      valores.estado = componente.propriedades.pressionado ? 'Pressionado' : 'Solto';
    }
  }

  return valores;
}

/**
 * Gera os dados da montagem a partir do estado atual do componente.
 */
export function gerarMontagem(componente) {
  if (!componente) {
    return { disponivel: false, motivo: 'invalido' };
  }

  const receita = receitasDoComponente(componente);
  if (!receita) {
    return {
      disponivel: false,
      motivo: 'sem-receita',
      tipo: componente.tipo,
      nome: componente.nomeCustom || null,
      comp: componente,
    };
  }

  return {
    disponivel: true,
    tipo: componente.tipo,
    nome: componente.nomeCustom || null,
    titulo: receita.titulo,
    industrial: receita.industrial,
    didatica: receita.didatica,
    valores: extrairValoresAtuais(componente),
    comp: componente,
  };
}

/**
 * Desenha a prévia esquemática de uma das opções (industrial ou didática).
 */
export function desenharPreviaOpcao(canvasEl, opcao, tipoPorta, componente) {
  if (!canvasEl || !opcao) return;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;

  const w = (canvasEl.width = canvasEl.clientWidth || 240);
  const h = (canvasEl.height = canvasEl.clientHeight || 220);

  // Fundo limpo
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Grade suave no estilo Arandua
  ctx.save();
  ctx.strokeStyle = '#f0f1f3';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 15) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 15) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  const cy = h / 2;

  if (tipoPorta === 'DISPLAY_7SEG') {
    const resistencia = opcao.subtitulo?.includes('470') ? '470' : '330';
    const corLED = componente?.propriedades?.cor || '#ff3b30';
    const escala = Math.min(1, (w - 56) / 190, (h - 40) / 200);
    const centroX = w / 2;
    const centroY = h / 2;
    const segmentos = {
      a: { x: 0, y: -60, horizontal: true },
      b: { x: 40, y: -30, horizontal: false },
      c: { x: 40, y: 30, horizontal: false },
      d: { x: 0, y: 60, horizontal: true },
      e: { x: -40, y: 30, horizontal: false },
      f: { x: -40, y: -30, horizontal: false },
      g: { x: 0, y: 0, horizontal: true },
    };

    ctx.save();
    ctx.font = '600 7px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#315b89';
    ctx.fillStyle = '#536273';
    ctx.lineWidth = 1;
    Object.entries(segmentos).forEach(([segmento, geometria]) => {
      const x = centroX + geometria.x * escala;
      const y = centroY + geometria.y * escala;
      const largura = (geometria.horizontal ? 42 : 10) * escala;
      const altura = (geometria.horizontal ? 10 : 42) * escala;
      ctx.fillStyle = corLED;
      ctx.strokeStyle = '#4b5563';
      ctx.beginPath();
      ctx.roundRect(x - largura / 2, y - altura / 2, largura, altura, altura / 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#536273';
      ctx.textAlign = 'center';
      const rotuloX = geometria.horizontal
        ? x
        : x + Math.sign(geometria.x || 1) * 31 * escala;
      const rotuloY = geometria.horizontal
        ? y + Math.sign(geometria.y || -1) * 11 * escala
        : y;
      ctx.fillText(segmento.toUpperCase(), rotuloX, rotuloY);

      const resistorX = geometria.horizontal
        ? x
        : x + Math.sign(geometria.x || 1) * 82 * escala;
      const resistorY = geometria.horizontal
        ? y + Math.sign(geometria.y || -1) * 34 * escala
        : y;
      const resistorW = 26 * escala;
      const resistorH = 10 * escala;
      const lado = Math.sign(resistorX - x) || 1;
      const acima = Math.sign(resistorY - y) || 1;
      ctx.strokeStyle = '#315b89';
      ctx.beginPath();
      if (geometria.horizontal) {
        ctx.moveTo(x, y + acima * altura / 2);
        ctx.lineTo(resistorX, resistorY - acima * resistorH / 2);
      } else {
        ctx.moveTo(x + lado * largura / 2, y);
        ctx.lineTo(resistorX - lado * resistorW / 2, resistorY);
      }
      ctx.stroke();
      ctx.strokeRect(
        resistorX - resistorW / 2,
        resistorY - resistorH / 2,
        resistorW,
        resistorH
      );
      ctx.fillStyle = '#536273';
      ctx.font = '600 5px system-ui, sans-serif';
      ctx.fillText(resistencia, resistorX, resistorY);
      ctx.font = '600 7px system-ui, sans-serif';
    });
    ctx.fillStyle = '#536273';
    ctx.textAlign = 'right';
    ctx.fillText('COM', w - 7, cy);
    ctx.restore();
    return;
  }

  if (tipoPorta === 'AMP_OP') {
    const industrial = opcao.titulo?.includes('buffer');
    const cores = { fio: '#315b89', texto: '#536273', transistor: '#fff' };
    const resistor = (x, y, nome) => {
      ctx.strokeRect(x - 7, y - 12, 14, 24);
      ctx.fillStyle = cores.texto;
      ctx.font = '600 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nome, x, y + 3);
    };

    ctx.save();
    ctx.strokeStyle = cores.fio;
    ctx.fillStyle = cores.texto;
    ctx.lineWidth = 1.5;
    ctx.font = '600 8px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const q1 = { x: 104, y: 76 };
    const q2 = { x: 148, y: 126 };
    ctx.fillText('V+', 72, 22);
    ctx.beginPath();
    ctx.moveTo(84, 26);
    ctx.lineTo(164, 26);
    ctx.stroke();
    resistor(104, 45, 'RC1');
    resistor(148, 45, 'RC2');
    ctx.beginPath();
    ctx.moveTo(q1.x, 26);
    ctx.lineTo(q1.x, 33);
    ctx.moveTo(q1.x, 57);
    ctx.lineTo(q1.x, q1.y - 12);
    ctx.moveTo(q2.x, 26);
    ctx.lineTo(q2.x, 33);
    ctx.moveTo(q2.x, 57);
    ctx.lineTo(q2.x, q2.y - 12);
    ctx.stroke();

    for (const [q, label] of [[q1, 'Q1'], [q2, 'Q2']]) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = cores.transistor;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = cores.texto;
      ctx.textAlign = 'center';
      ctx.fillText(label, q.x, q.y);
    }

    ctx.strokeStyle = cores.fio;
    ctx.beginPath();
    ctx.moveTo(8, q1.y);
    ctx.lineTo(q1.x - 13, q1.y);
    ctx.moveTo(8, q2.y);
    ctx.lineTo(q2.x - 13, q2.y);
    ctx.stroke();
    ctx.fillStyle = cores.texto;
    ctx.textAlign = 'left';
    ctx.fillText('IN+', 8, q1.y - 9);
    ctx.fillText('IN−', 8, q2.y - 9);

    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y + 13);
    ctx.lineTo(q1.x, 164);
    ctx.lineTo(q2.x, 164);
    ctx.moveTo(q2.x, q2.y + 13);
    ctx.lineTo(q2.x, 164);
    ctx.stroke();
    resistor(126, 181, 'RT');
    ctx.beginPath();
    ctx.moveTo(126, 164);
    ctx.lineTo(126, 169);
    ctx.moveTo(126, 193);
    ctx.lineTo(126, 202);
    ctx.stroke();
    ctx.fillText('V−', 132, 202);

    if (industrial) {
      ctx.beginPath();
      ctx.moveTo(q2.x + 13, q2.y);
      ctx.lineTo(184, q2.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(198, q2.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = cores.transistor;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = cores.texto;
      ctx.textAlign = 'center';
      ctx.fillText('Q3', 198, q2.y);
      ctx.beginPath();
      ctx.moveTo(211, q2.y);
      ctx.lineTo(w - 18, q2.y);
      ctx.stroke();
      ctx.fillStyle = cores.texto;
      ctx.textAlign = 'right';
      ctx.fillText('OUT', w - 7, q2.y - 9);
    } else {
      ctx.beginPath();
      ctx.moveTo(q2.x + 13, q2.y);
      ctx.lineTo(w - 18, q2.y);
      ctx.stroke();
      ctx.fillStyle = cores.texto;
      ctx.textAlign = 'right';
      ctx.fillText('OUT', w - 7, q2.y - 9);
    }
    ctx.restore();
    return;
  }

  if (tipoPorta === 'CI_GENERICO') {
    const funcao = componente?.propriedades?.funcao || 'buffer';
    const nomePorta = ({ inversor: 'NOT', buffer: 'BUFFER' })[funcao] || funcao;
    ctx.save();
    ctx.strokeStyle = '#315b89';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(w * 0.27, h * 0.2, w * 0.46, h * 0.6, 8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.2, 7, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    for (let indice = 0; indice < 4; indice++) {
      const y = h * 0.29 + indice * h * 0.14;
      ctx.moveTo(w * 0.27, y);
      ctx.lineTo(w * 0.18, y);
      ctx.moveTo(w * 0.73, y);
      ctx.lineTo(w * 0.82, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#536273';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CI GENÉRICO', w / 2, h * 0.34);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(nomePorta, w / 2, h * 0.55);
    ctx.font = '600 8px system-ui, sans-serif';
    ctx.fillText('p1 · entrada', w * 0.3, h * 0.9);
    ctx.fillText('p5 · saída', w * 0.7, h * 0.9);
    ctx.restore();
    return;
  }

  if (opcao.subtitulo?.includes('Transistores') || opcao.titulo?.includes('Industrial')) {
    // ===== DESENHO DA OPÇÃO INDUSTRIAL (TRANSISTORES) =====
    ctx.save();
    ctx.strokeStyle = '#002776';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (LAYOUT_INDUSTRIAL[tipoPorta]) {
      // Esquema industrial real desenhado pelo usuário (AND e OR)
      desenharPreviaEsquema(ctx, w, h, tipoPorta);
    } else if (tipoPorta === 'AND') {
      // Dois transistores NPN em série com resistor
      const xQ1 = w * 0.35;
      const xQ2 = w * 0.65;
      const yQ = cy - 10;

      // Linha de Vcc
      ctx.beginPath();
      ctx.moveTo(xQ1, yQ - 25);
      ctx.lineTo(xQ1, yQ);
      ctx.stroke();

      // Ligação em série Q1.e -> Q2.c
      ctx.beginPath();
      ctx.moveTo(xQ1, yQ + 20);
      ctx.lineTo(xQ1 + 15, yQ + 20);
      ctx.lineTo(xQ1 + 15, yQ);
      ctx.lineTo(xQ2, yQ);
      ctx.stroke();

      // Saída Q2.e -> Resistor -> GND
      ctx.beginPath();
      ctx.moveTo(xQ2, yQ + 20);
      ctx.lineTo(xQ2, yQ + 38);
      ctx.lineTo(w - 20, yQ + 20);
      ctx.stroke();

      // Entradas de base
      ctx.beginPath();
      ctx.moveTo(xQ1 - 30, yQ + 10);
      ctx.lineTo(xQ1 - 10, yQ + 10);
      ctx.moveTo(xQ2 - 30, yQ + 10);
      ctx.lineTo(xQ2 - 10, yQ + 10);
      ctx.stroke();

      // Símbolos NPN
      const fakeQ1 = { tipo: 'TRANSISTOR_NPN', x: xQ1 - 20, y: yQ - 10, rotacao: 0, propriedades: {} };
      const fakeQ2 = { tipo: 'TRANSISTOR_NPN', x: xQ2 - 20, y: yQ - 10, rotacao: 0, propriedades: {} };
      desenharComponente(ctx, fakeQ1, xQ1 - 20, yQ - 10, 0.75);
      desenharComponente(ctx, fakeQ2, xQ2 - 20, yQ - 10, 0.75);

      // Rótulos
      ctx.fillStyle = '#009C3B';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Q1 (NPN)', xQ1, yQ - 30);
      ctx.fillText('Q2 (NPN)', xQ2, yQ - 30);

      ctx.fillStyle = '#6b7280';
      ctx.font = '600 8px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('In A', xQ1 - 32, yQ + 13);
      ctx.fillText('In B', xQ2 - 32, yQ + 13);
      ctx.textAlign = 'left';
      ctx.fillText('Out Y', w - 18, yQ + 23);
    } else {
      // OR / NOT / Geral com transistores
      const xQ1 = w * 0.45;
      const xQ2 = w * 0.75;
      const yQ1 = cy - 25;
      const yQ2 = cy + 25;

      // Linhas de alimentação e transistores
      ctx.beginPath();
      ctx.moveTo(20, yQ1);
      ctx.lineTo(xQ1 - 10, yQ1);
      ctx.moveTo(20, yQ2);
      ctx.lineTo(xQ1 - 10, yQ2);
      ctx.moveTo(xQ1 + 20, cy);
      ctx.lineTo(w - 20, cy);
      ctx.stroke();

      const fakeQ1 = { tipo: 'TRANSISTOR_NPN', x: xQ1 - 15, y: yQ1 - 15, rotacao: 0, propriedades: {} };
      const fakeQ2 = { tipo: 'TRANSISTOR_NPN', x: xQ1 - 15, y: yQ2 - 15, rotacao: 0, propriedades: {} };
      desenharComponente(ctx, fakeQ1, xQ1 - 15, yQ1 - 15, 0.7);
      desenharComponente(ctx, fakeQ2, xQ1 - 15, yQ2 - 15, 0.7);

      ctx.fillStyle = '#009C3B';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Q1', xQ1 + 25, yQ1);
      ctx.fillText('Q2', xQ1 + 25, yQ2);

      ctx.fillStyle = '#6b7280';
      ctx.font = '600 8px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('In A', 18, yQ1 + 3);
      ctx.fillText('In B', 18, yQ2 + 3);
      ctx.textAlign = 'left';
      ctx.fillText('Out Y', w - 18, cy + 3);
    }
    ctx.restore();
  } else {
    // ===== DESENHO DA OPÇÃO DIDÁTICA (CHAVES) =====
    ctx.save();
    ctx.strokeStyle = '#002776';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (tipoPorta === 'AND') {
      const compW = 40;
      const gap = 14;
      const totalW = compW * 2 + gap;
      const startX = (w - totalW) / 2;
      const x1 = startX;
      const x2 = startX + compW + gap;

      ctx.beginPath();
      ctx.moveTo(startX - 20, cy);
      ctx.lineTo(x1, cy);
      ctx.moveTo(x1 + compW, cy);
      ctx.lineTo(x2, cy);
      ctx.moveTo(x2 + compW, cy);
      ctx.lineTo(x2 + compW + 20, cy);
      ctx.stroke();

      const fakeS1 = { tipo: 'CHAVE', x: x1, y: cy - 14, rotacao: 0, propriedades: { fechada: false }, dimensoes: { w: 40, h: 28 } };
      const fakeS2 = { tipo: 'CHAVE', x: x2, y: cy - 14, rotacao: 0, propriedades: { fechada: false }, dimensoes: { w: 40, h: 28 } };
      desenharComponente(ctx, fakeS1, x1, cy - 14, 0.85);
      desenharComponente(ctx, fakeS2, x2, cy - 14, 0.85);

      ctx.fillStyle = '#009C3B';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S1', x1 + compW / 2, cy - 18);
      ctx.fillText('S2', x2 + compW / 2, cy - 18);

      ctx.fillStyle = '#6b7280';
      ctx.font = '600 8px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('In (A)', startX - 22, cy + 3);
      ctx.textAlign = 'left';
      ctx.fillText('Out (Y)', x2 + compW + 22, cy + 3);
    } else {
      // OR paralelo
      const compW = 40;
      const xCenter = (w - compW) / 2;
      const y1 = cy - 28;
      const y2 = cy + 18;
      const barEsq = xCenter - 14;
      const barDir = xCenter + compW + 14;

      ctx.beginPath();
      ctx.moveTo(barEsq - 16, cy);
      ctx.lineTo(barEsq, cy);
      ctx.moveTo(barEsq, y1 + 8);
      ctx.lineTo(barEsq, y2 + 8);
      ctx.moveTo(barEsq, y1 + 8);
      ctx.lineTo(xCenter, y1 + 8);
      ctx.moveTo(barEsq, y2 + 8);
      ctx.lineTo(xCenter, y2 + 8);

      ctx.moveTo(xCenter + compW, y1 + 8);
      ctx.lineTo(barDir, y1 + 8);
      ctx.moveTo(xCenter + compW, y2 + 8);
      ctx.lineTo(barDir, y2 + 8);
      ctx.moveTo(barDir, y1 + 8);
      ctx.lineTo(barDir, y2 + 8);
      ctx.moveTo(barDir, cy);
      ctx.lineTo(barDir + 16, cy);
      ctx.stroke();

      const fakeS1 = { tipo: 'CHAVE', x: xCenter, y: y1 - 6, rotacao: 0, propriedades: { fechada: false }, dimensoes: { w: 40, h: 28 } };
      const fakeS2 = { tipo: 'CHAVE', x: xCenter, y: y2 - 6, rotacao: 0, propriedades: { fechada: false }, dimensoes: { w: 40, h: 28 } };
      desenharComponente(ctx, fakeS1, xCenter, y1 - 6, 0.85);
      desenharComponente(ctx, fakeS2, xCenter, y2 - 6, 0.85);

      ctx.fillStyle = '#009C3B';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S1', xCenter + compW / 2, y1 - 8);
      ctx.fillText('S2', xCenter + compW / 2, y2 + 25);

      ctx.fillStyle = '#6b7280';
      ctx.font = '600 8px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('In (A)', barEsq - 18, cy + 3);
      ctx.textAlign = 'left';
      ctx.fillText('Out (Y)', barDir + 18, cy + 3);
    }
    ctx.restore();
  }
}

/**
 * Maior Y ocupado por componentes e dobras de fios (usado para criar trilhas de retorno
 * abaixo de todo o circuito, sem sobrepor nada).
 */
function yInferiorDoCircuito(circuito) {
  let maximo = -Infinity;
  for (const comp of circuito.componentes) {
    const b = boundsDoComponente(comp);
    maximo = Math.max(maximo, b.y + b.h);
  }
  for (const fio of circuito.fios) {
    for (const d of fio.dobras || []) maximo = Math.max(maximo, d.y);
  }
  return Number.isFinite(maximo) ? maximo : 0;
}

function fonteConectadaAoComponente(circuito, componente) {
  const componentes = circuito.componentes;
  const pai = new Map();
  const encontrar = (pino) => {
    if (!pai.has(pino)) pai.set(pino, pino);
    let raiz = pino;
    while (pai.get(raiz) !== raiz) raiz = pai.get(raiz);
    let atual = pino;
    while (pai.get(atual) !== raiz) {
      const proximo = pai.get(atual);
      pai.set(atual, raiz);
      atual = proximo;
    }
    return raiz;
  };
  const unir = (a, b) => {
    const raizA = encontrar(a);
    const raizB = encontrar(b);
    if (raizA !== raizB) pai.set(raizA, raizB);
  };
  const chavePino = (id, pino) => `${id}:${pino}`;

  for (const comp of componentes) {
    const pinos = comp.pinos.map((pino) => chavePino(comp.id, pino.id));
    for (const pino of pinos) encontrar(pino);
    if (comp.tipo === 'TRANSFORMADOR') {
      for (const enrolamento of [['p1', 'p2'], ['s1', 's2']]) {
        const presentes = enrolamento
          .map((id) => chavePino(comp.id, id))
          .filter((id) => pai.has(id));
        if (presentes.length > 1) unir(presentes[0], presentes[1]);
      }
    } else {
      for (let indice = 1; indice < pinos.length; indice++) {
        unir(pinos[0], pinos[indice]);
      }
    }
  }

  for (const fio of circuito.fios) {
    const origem = chavePino(fio.origem.componente, fio.origem.pino);
    const destino = chavePino(fio.destino.componente, fio.destino.pino);
    if (pai.has(origem) && pai.has(destino)) unir(origem, destino);
  }

  const raizesComponente = new Set(
    componente.pinos.map((pino) => encontrar(chavePino(componente.id, pino.id)))
  );
  const fontesConectadas = componentes.filter(
    (comp) => comp.tipo === 'BATERIA' || comp.tipo === 'FONTE_AC'
  ).filter((fonte) =>
    fonte.pinos.some((pino) => raizesComponente.has(encontrar(chavePino(fonte.id, pino.id))))
  );
  const fontesPrincipais = fontesConectadas.filter(
    (fonte) => !fonte.propriedades?.montagemInterna
      && !fonte.nomeCustom?.endsWith(' - V1')
  );
  const fontes = fontesPrincipais.length > 0 ? fontesPrincipais : fontesConectadas;
  const centro = boundsDoComponente(componente);
  const centroX = centro.x + centro.w / 2;
  const centroY = centro.y + centro.h / 2;
  fontes.sort((a, b) => {
    const boundsA = boundsDoComponente(a);
    const boundsB = boundsDoComponente(b);
    const distanciaA = Math.hypot(
      boundsA.x + boundsA.w / 2 - centroX,
      boundsA.y + boundsA.h / 2 - centroY
    );
    const distanciaB = Math.hypot(
      boundsB.x + boundsB.w / 2 - centroX,
      boundsB.y + boundsB.h / 2 - centroY
    );
    return distanciaA - distanciaB || String(a.id).localeCompare(String(b.id));
  });
  return fontes[0] || null;
}

/**
 * Cria no circuito o esquema industrial fixo (AND ou OR) no lugar da porta `gate`,
 * religa os fios externos com rotas ortogonais e devolve os ids dos novos componentes.
 */
function trazerEsquemaIndustrial(circuito, gate, conexoesExternas, receita, fonteExterna) {
  const tipo = gate.tipo;
  const dimGate = CATALOGO[tipo].dimensoes;
  const gcx = gate.x + dimGate.w / 2;
  const gcy = gate.y + dimGate.h / 2;

  // Centro de Q1 alinhado à grade; o esquema fica centrado verticalmente na porta
  let qcx = Math.round((gcx - 76) / 10) * 10 + 36;
  let qcy = Math.round((gcy - 66) / 10) * 10 + 36;
  let esq = esquemaIndustrial(tipo, qcx, qcy);
  const deslocamento = deslocamentoSemColisao(circuito, esq.pecas);
  qcx += deslocamento.dx;
  qcy += deslocamento.dy;
  esq = esquemaIndustrial(tipo, qcx, qcy);

  const novos = {};
  for (const peca of esq.pecas) {
    const novo = adicionarComponente(circuito, peca.tipo, peca.x, peca.y);
    if (!novo) continue;
    novo.rotacao = peca.rotacao;
    if (peca.propriedades) Object.assign(novo.propriedades, peca.propriedades);
    if (peca.ref === 'V1') novo.propriedades.montagemInterna = true;
    if (gate.nomeCustom) {
      novo.nomeCustom = `${gate.nomeCustom} - ${peca.ref}`;
    } else {
      if (peca.ref === 'InA') novo.nomeCustom = 'In A';
      else if (peca.ref === 'InB') novo.nomeCustom = 'In B';
      else if (peca.ref === 'OutY') novo.nomeCustom = 'Out Y';
    }
    novos[peca.ref] = novo;
  }

  // A alimentação interna acompanha a tensão do projeto, para os níveis lógicos baterem
  if (fonteExterna?.tipo === 'BATERIA' && novos.V1 && fonteExterna.propriedades?.tensao) {
    novos.V1.propriedades.tensao = fonteExterna.propriedades.tensao;
  }

  const novoFio = (origem, destino, cor, dobras) => {
    circuito.fios.push({
      id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      origem,
      destino,
      dobras: dobras.map((d) => ({ x: d.x, y: d.y })),
      cor,
      espessura: 2,
    });
  };

  // Fios internos do esquema
  for (const [a, b, cor, dobras] of esq.fios) {
    const [refA, pinoA] = a.split('.');
    const [refB, pinoB] = b.split('.');
    if (!novos[refA] || !novos[refB]) continue;
    novoFio(
      { componente: novos[refA].id, pino: pinoA },
      { componente: novos[refB].id, pino: pinoB },
      cor,
      dobras
    );
  }

  // Fios externos: a e b chegam aos resistores de base; y sai do coletor inversor.
  const mapaPinos = {
    a: esq.entradas.a,
    b: esq.entradas.b,
    y: esq.saida,
  };
  for (const conexao of conexoesExternas) {
    const alvo = mapaPinos[conexao.meuPino];
    if (!alvo || !novos[alvo[0]]) continue;

    const compNovo = novos[alvo[0]];
    const pontaNova = { componente: compNovo.id, pino: alvo[1] };
    const T = posicaoPino(compNovo, alvo[1]);
    const outro = circuito.componentes.find((c) => c.id === conexao.outraPonta.componente);
    const P = outro ? posicaoPino(outro, conexao.outraPonta.pino) : null;

    let dobras = [];
    if (P && T) {
      if (conexao.meuPino === 'y') {
        dobras = rotaSaidaOrtogonal(T, P); // ordem: novo pino → outra ponta
        if (!conexao.souOrigem) dobras.reverse();
      } else {
        dobras = rotaEntradaOrtogonal(P, T); // ordem: outra ponta → novo pino
        if (conexao.souOrigem) dobras.reverse();
      }
    }

    novoFio(
      conexao.souOrigem ? pontaNova : conexao.outraPonta,
      conexao.souOrigem ? conexao.outraPonta : pontaNova,
      conexao.cor || CORES_FIO[0],
      dobras
    );
  }

  // Terra comum: o "−" da alimentação interna precisa compartilhar a referência do projeto
  if (fonteExterna && novos.V1 && conexoesExternas.length > 0) {
    const B = posicaoPino(novos.V1, 'p2');
    const terra = posicaoPino(fonteExterna, 'p2');
    if (B && terra) {
      const yTrilha = Math.ceil((yInferiorDoCircuito(circuito) + 30) / 10) * 10;
      novoFio(
        { componente: novos.V1.id, pino: 'p2' },
        { componente: fonteExterna.id, pino: 'p2' },
        COR_FIO_TERRA,
        [
          { x: B.x + 36, y: B.y },
          { x: B.x + 36, y: yTrilha },
          { x: terra.x - 30, y: yTrilha },
          { x: terra.x - 30, y: terra.y },
        ]
      );
    }
  }

  return Object.values(novos).map((c) => c.id);
}

/**
 * Executa a substituição do componente pela montagem selecionada ('industrial' ou 'didatica').
 * Registra tudo em um ÚNICO passo de histórico (undo atômico).
 */
export function executarTrazerAoProjeto(componente, modo, estado, aoFinalizar, avisarToast) {
  if (!componente || !estado?.circuito) return false;
  const receitaCompleta = receitasDoComponente(componente);
  if (!receitaCompleta) return false;

  const receita = receitaCompleta[modo];
  if (!receita) return false;

  const circuito = estado.circuito;
  const { id, x, y, nomeCustom, tipo } = componente;
  const fonteExterna = fonteConectadaAoComponente(circuito, componente);
  const fiosExistentes = new Set(circuito.fios);

  // 1. Guardar conexões externas existentes antes de remover
  const fiosConectados = (circuito.fios || []).filter(
    (f) => f && (f.origem?.componente === id || f.destino?.componente === id)
  );
  const conexoesExternas = fiosConectados.map((f) => {
    const souOrigem = f.origem.componente === id;
    const meuPino = souOrigem ? f.origem.pino : f.destino.pino;
    const outraPonta = souOrigem ? { ...f.destino } : { ...f.origem };
    return {
      meuPino,
      outraPonta,
      souOrigem,
      cor: f.cor,
      espessura: f.espessura,
    };
  });

  // 2. Remover o componente original e os fios associados
  removerComponente(circuito, id);
  recalcularMembros(circuito);
  atualizarTodosBounds(circuito);

  // 2b. Esquemas industriais fixos (AND e OR): reproduz exatamente o esquema do usuário
  if (modo === 'industrial' && LAYOUT_INDUSTRIAL[tipo]) {
    const novosIdsFixos = trazerEsquemaIndustrial(
      circuito,
      componente,
      conexoesExternas,
      receita,
      fonteExterna
    );
    rotearFios(circuito, circuito.fios.filter((fio) => !fiosExistentes.has(fio)));
    estado.selecionados = novosIdsFixos;
    registrar(circuito, 'trazer-montagem', true);
    if (typeof aoFinalizar === 'function') aoFinalizar();
    return true;
  }

  // 3. Instanciar os componentes discretos da receita selecionada com espaçamento amplo
  const novosComps = {};
  let centroX = Math.round(x / 10) * 10;
  let centroY = Math.round(y / 10) * 10;

  // Mapa de posições harmonioso e conciso, com perfeito alinhamento às linhas de sinal
  // A fonte V1 usa rotação vertical (90°) e fica elevada à direita sem cruzar cabos
  const MAPA_LAYOUT = {
    AND: {
      industrial: {
        Q1: { x: centroX - 40, y: centroY - 80 },
        Q2: { x: centroX - 40, y: centroY + 80 },
        R1: { x: centroX + 60, y: centroY + 80 },
        V1: { x: centroX + 60, y: centroY - 140, rotacao: 90 },
      },
      didatica: {
        S1: { x: centroX - 100, y: centroY },
        S2: { x: centroX + 100, y: centroY },
        R1: { x: centroX + 40, y: centroY + 70 },
        V1: { x: centroX - 100, y: centroY - 100, rotacao: 90 },
      },
    },
    OR: {
      industrial: {
        Q1: { x: centroX - 40, y: centroY - 80 },
        Q2: { x: centroX - 40, y: centroY + 80 },
        R1: { x: centroX + 60, y: centroY },
        V1: { x: centroX + 60, y: centroY - 140, rotacao: 90 },
      },
      didatica: {
        S1: { x: centroX - 100, y: centroY - 50 },
        S2: { x: centroX - 100, y: centroY + 50 },
        R1: { x: centroX + 60, y: centroY },
        V1: { x: centroX - 100, y: centroY - 140, rotacao: 90 },
      },
    },
    NOT: {
      industrial: {
        R1: { x: centroX - 80, y: centroY },
        Q1: { x: centroX, y: centroY },
        R2: { x: centroX + 40, y: centroY - 80, rotacao: 90 },
        V1: { x: centroX - 40, y: centroY - 80, rotacao: 90 },
      },
      didatica: {
        R1: { x: centroX + 60, y: centroY - 60 },
        S1: { x: centroX + 60, y: centroY + 40 },
        V1: { x: centroX - 100, y: centroY - 120, rotacao: 90 },
      },
    },
    NAND: {
      industrial: {
        Q1: { x: centroX - 40, y: centroY - 60 },
        Q2: { x: centroX - 40, y: centroY + 60 },
        R1: { x: centroX + 40, y: centroY - 110, rotacao: 90 },
        V1: { x: centroX + 100, y: centroY - 110, rotacao: 90 },
      },
      didatica: {
        R1: { x: centroX + 60, y: centroY - 100 },
        S1: { x: centroX - 80, y: centroY - 60 },
        S2: { x: centroX - 80, y: centroY + 60 },
        V1: { x: centroX - 110, y: centroY - 120, rotacao: 90 },
      },
    },
    NOR: {
      industrial: {
        Q1: { x: centroX - 40, y: centroY - 80 },
        Q2: { x: centroX - 40, y: centroY + 80 },
        R1: { x: centroX + 40, y: centroY - 140, rotacao: 90 },
        V1: { x: centroX + 100, y: centroY - 140, rotacao: 90 },
      },
      didatica: {
        R1: { x: centroX + 60, y: centroY - 60 },
        S1: { x: centroX - 100, y: centroY - 50 },
        S2: { x: centroX - 100, y: centroY + 50 },
        V1: { x: centroX - 110, y: centroY - 120, rotacao: 90 },
      },
    },
  };

  const posicoesRelativas = {};
  const posicao = (dx, dy, rotacao) => ({
    x: centroX + dx,
    y: centroY + dy,
    ...(rotacao === undefined ? {} : { rotacao }),
  });
  const posicaoCentro = (tipoPeca, dx, dy) => {
    const dimensoes = obterDimensoesComponente(tipoPeca);
    return posicao(dx - dimensoes.w / 2, dy - dimensoes.h / 2);
  };
  if (tipo === 'BUFFER') {
    posicoesRelativas.industrial = {
      InA: posicao(-250, 0), R1: posicao(-150, 0), Q1: posicao(-50, 0),
      R2: posicao(-50, -100), R3: posicao(100, 0), Q2: posicao(250, 0),
      R4: posicao(250, -100), V1: posicao(100, -190, 90), OutY: posicao(400, 0),
    };
    posicoesRelativas.didatica = {
      InA: posicao(-160, 0), S1: posicao(0, 0), R1: posicao(100, 70),
      V1: posicao(-100, -110, 90), OutY: posicao(160, 0),
    };
  } else if (tipo === 'XOR' || tipo === 'XNOR') {
    posicoesRelativas.industrial = {
      InA: posicao(-450, -120), InB: posicao(-450, 120), V1: posicao(300, -300, 90),
      OutY: posicao(tipo === 'XNOR' ? 1300 : 1050, 0),
      Q1: posicao(-100, -120), Q2: posicao(-100, 120),
      Q3: posicao(150, -120), Q4: posicao(150, 120), Q5: posicao(400, 0),
      Q6: posicao(650, -120), Q7: posicao(650, 120), Q8: posicao(900, 0),
      Q9: posicao(1150, 0),
      R1: posicao(-100, -220), R2: posicao(150, -220), R3: posicao(400, -120),
      R4: posicao(-300, -120), R5: posicao(-300, 120), R6: posicao(0, -120),
      R7: posicao(0, 120), R8: posicao(300, 0), R9: posicao(550, -120),
      R10: posicao(550, 120), R11: posicao(650, -220), R12: posicao(800, 0),
      R13: posicao(900, -120), R14: posicao(1050, 0), R15: posicao(1150, -120),
    };
    posicoesRelativas.didatica = {
      InA: posicao(-380, -100), InB: posicao(-380, 100), OutY: posicao(300, 0),
      V1: posicao(0, -440, 90), S1: posicao(-120, -100), S2: posicao(80, -100),
      S3: posicao(-120, 100), S4: posicao(80, 100),
      Q1: posicao(-120, -260), Q2: posicao(80, -260),
      R1: posicao(-120, -360), R2: posicao(80, -360),
      R3: posicao(-220, -260), R4: posicao(-20, -260), R5: posicao(200, 30),
    };
  } else if (tipo === 'DISPLAY_7SEG') {
    const layoutDisplay = {};
    const anodoComum = componente.propriedades?.tipo === 'ânodo comum';
    const segmentos = {
      a: { x: 0, y: -130, rotacao: 0 },
      b: { x: 55, y: -65, rotacao: 90 },
      c: { x: 55, y: 65, rotacao: 90 },
      d: { x: 0, y: 130, rotacao: 0 },
      e: { x: -55, y: 65, rotacao: 90 },
      f: { x: -55, y: -65, rotacao: 90 },
      g: { x: 0, y: 0, rotacao: 0 },
    };
    const resistores = {
      a: { x: 0, y: -200 },
      b: { x: 145, y: -65 },
      c: { x: 145, y: 65 },
      d: { x: 0, y: 200 },
      e: { x: -145, y: 65 },
      f: { x: -145, y: -65 },
      g: { x: -145, y: 0 },
    };
    const comuns = anodoComum
      ? {
        a: { x: -80, y: -130 },
        b: { x: 100, y: -85 },
        c: { x: 100, y: 45 },
        d: { x: -80, y: 130 },
        e: { x: -100, y: 45 },
        f: { x: -100, y: -85 },
        g: { x: -80, y: 0 },
      }
      : {
        a: { x: 80, y: -130 },
        b: { x: 100, y: -45 },
        c: { x: 100, y: 85 },
        d: { x: 80, y: 130 },
        e: { x: -100, y: 85 },
        f: { x: -100, y: -45 },
        g: { x: 80, y: 0 },
      };
    SEGMENTOS_DISPLAY.forEach((segmento) => {
      const geometria = segmentos[segmento];
      layoutDisplay[`R${segmento}`] = posicaoCentro(
        'RESISTOR',
        resistores[segmento].x,
        resistores[segmento].y
      );
      layoutDisplay[`LED${segmento}`] = {
        ...posicaoCentro('LED', geometria.x, geometria.y),
        rotacao: geometria.rotacao,
      };
      layoutDisplay[`COM${segmento.toUpperCase()}`] = posicaoCentro(
        'NO',
        comuns[segmento].x,
        comuns[segmento].y
      );
    });
    posicoesRelativas.industrial = layoutDisplay;
    posicoesRelativas.didatica = layoutDisplay;
  } else if (tipo === 'AMP_OP') {
    const layoutAmpOp = {
      RINP: posicao(-260, -80),
      RINM: posicao(-260, 80),
      Q1: posicao(-100, -80),
      Q2: posicao(-100, 80),
      RC1: posicao(20, -130),
      RC2: posicao(20, 30),
      RT: posicao(-80, 190),
      VP: posicao(180, -150),
      VN: posicao(180, 190),
      OUT: posicao(300, 30),
      Q3: posicao(180, 20),
      RL: posicao(300, 100),
    };
    posicoesRelativas.industrial = layoutAmpOp;
    posicoesRelativas.didatica = layoutAmpOp;
  } else if (tipo === 'CI_GENERICO') {
    posicoesRelativas.industrial = {
      U1: posicao(-40, -20),
      NC2: posicao(-150, 100),
      NC3: posicao(-100, 120),
      NC4: posicao(-50, 130),
      NC6: posicao(30, 130),
      NC7: posicao(80, 120),
      NC8: posicao(130, 100),
    };
  }

  const layoutEspecifico = MAPA_LAYOUT[tipo]?.[modo] || {};
  const layoutComposto = posicoesRelativas[modo] || {};

  const posicoesPecas = new Map();
  receita.pecas.forEach((peca, idx) => {
    const pos = layoutEspecifico[peca.ref] || layoutComposto[peca.ref] || {
      x: centroX + (idx % 2 === 0 ? -1 : 1) * (80 + idx * 30),
      y: centroY + Math.floor(idx / 2) * 80,
    };
    posicoesPecas.set(peca.ref, {
      ...pos,
      rotacao: peca.rotacao ?? pos.rotacao ?? 0,
    });
  });
  const deslocamento = deslocamentoSemColisao(
    circuito,
    receita.pecas.map((peca) => ({
      tipo: peca.tipo,
      ...posicoesPecas.get(peca.ref),
    }))
  );
  centroX += deslocamento.dx;
  centroY += deslocamento.dy;
  for (const pos of posicoesPecas.values()) {
    pos.x += deslocamento.dx;
    pos.y += deslocamento.dy;
  }

  receita.pecas.forEach((peca, idx) => {
    const pos = posicoesPecas.get(peca.ref);
    const novo = adicionarComponente(circuito, peca.tipo, pos.x, pos.y);
    if (novo) {
      if (pos.rotacao !== undefined) novo.rotacao = pos.rotacao;
      if (peca.rotacao !== undefined) novo.rotacao = peca.rotacao;
      if (peca.propriedades) Object.assign(novo.propriedades, peca.propriedades);
      if (peca.ref === 'V1') novo.propriedades.montagemInterna = true;
      if (nomeCustom) {
        novo.nomeCustom = `${nomeCustom} - ${peca.ref}`;
      } else if (['DISPLAY_7SEG', 'AMP_OP', 'CI_GENERICO'].includes(tipo) && peca.rotulo) {
        novo.nomeCustom = peca.rotulo;
      }
      novosComps[peca.ref] = novo;
    }
  });

  // Função auxiliar para dobras internas limpas e ortogonais (Manhattan)
  function calcularDobrasInternas(tPorta, mModo, rA, pA, rB, pB) {
    if (mModo === 'industrial') {
      if (tPorta === 'AND') {
        if (rA === 'V1' && rB === 'Q1') return { dobras: [{ x: centroX - 8, y: centroY - 160 }], cor: '#FF3B30' };
        if (rA === 'Q1' && rB === 'Q2') return { dobras: [], cor: '#FF9500' };
        if (rA === 'Q2' && rB === 'R1') return { dobras: [{ x: centroX + 10, y: centroY + 112 }, { x: centroX + 10, y: centroY + 80 }], cor: '#34C759' };
        if (rA === 'R1' && rB === 'V1') return { dobras: [{ x: centroX + 120, y: centroY + 80 }, { x: centroX + 120, y: centroY - 120 }], cor: '#111827' };
      } else if (tPorta === 'OR') {
        if (rA === 'V1' && rB === 'Q1') return { dobras: [{ x: centroX - 8, y: centroY - 160 }], cor: '#FF3B30' };
        if (rA === 'V1' && rB === 'Q2') return { dobras: [{ x: centroX - 8, y: centroY - 160 }, { x: centroX - 8, y: centroY + 48 }], cor: '#FF3B30' };
        if (rA === 'Q1' && rB === 'Q2') return { dobras: [{ x: centroX + 15, y: centroY - 48 }, { x: centroX + 15, y: centroY + 112 }], cor: '#34C759' };
        if (rA === 'Q2' && rB === 'R1') return { dobras: [{ x: centroX + 15, y: centroY }], cor: '#34C759' };
        if (rA === 'R1' && rB === 'V1') return { dobras: [{ x: centroX + 120, y: centroY }, { x: centroX + 120, y: centroY - 120 }], cor: '#111827' };
      }
    }
    return { dobras: [], cor: CORES_FIO[0] };
  }

  // 4. Criar fios internos da montagem com roteamento limpo
  for (const ligacao of receita.ligacoes) {
    const [pA, pB] = ligacao;
    const [refA, pinoA] = pA.split('.');
    const [refB, pinoB] = pB.split('.');
    const compA = novosComps[refA];
    const compB = novosComps[refB];
    if (compA && compB) {
      const roteamento = calcularDobrasInternas(tipo, modo, refA, pinoA, refB, pinoB);
      circuito.fios.push({
        id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        origem: { componente: compA.id, pino: pinoA },
        destino: { componente: compB.id, pino: pinoB },
        dobras: roteamento.dobras,
        cor: roteamento.cor,
        espessura: 2,
      });
    }
  }

  // 5. Reconectar fios externos de forma limpa e ortogonal
  const temTerminais =
    (receita.entradas && receita.entradas.length > 0) ||
    (receita.saidas && receita.saidas.length > 0);

  if (!temTerminais && conexoesExternas.length > 0) {
    if (typeof avisarToast === 'function') {
      avisarToast(
        'Montagem criada. Os fios externos não foram reconectados porque esta montagem não define terminais de entrada e saída.'
      );
    }
  } else if (temTerminais) {
    for (const conexao of conexoesExternas) {
      const { meuPino, outraPonta, souOrigem, cor, espessura } = conexao;
      let alvoMapeado = receita.mapeamentoPinos?.[meuPino];

      if (!alvoMapeado) {
        if (meuPino === 'y' || meuPino === 'out') {
          const saida = receita.saidas[0];
          if (saida) {
            const [ref, pino] = saida.split('.');
            alvoMapeado = { ref, pino };
          }
        } else if (meuPino === 'b' && receita.entradas.length > 1) {
          const entrada = receita.entradas[1];
          if (entrada) {
            const [ref, pino] = entrada.split('.');
            alvoMapeado = { ref, pino };
          }
        } else if (receita.entradas.length > 0) {
          const entrada = receita.entradas[0];
          if (entrada) {
            const [ref, pino] = entrada.split('.');
            alvoMapeado = { ref, pino };
          }
        }
      }

      if (alvoMapeado && novosComps[alvoMapeado.ref]) {
        const compNovo = novosComps[alvoMapeado.ref];
        const pontaNova = { componente: compNovo.id, pino: alvoMapeado.pino };

        let dobrasExternas = [];
        if (tipo === 'AND' && modo === 'industrial' && (meuPino === 'y' || meuPino === 'out')) {
          dobrasExternas = [{ x: centroX + 20, y: centroY + 112 }, { x: centroX + 20, y: centroY }];
        }

        circuito.fios.push({
          id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          origem: souOrigem ? pontaNova : outraPonta,
          destino: souOrigem ? outraPonta : pontaNova,
          dobras: dobrasExternas,
          cor: cor || CORES_FIO[0],
          espessura: espessura || 2,
        });
      }
    }
  }

  const fonteInterna = novosComps.V1;
  if (fonteExterna && fonteInterna) {
    const tensaoExterna = fonteExterna.propriedades?.tensao
      ?? fonteExterna.propriedades?.amplitude;
    if (Number.isFinite(tensaoExterna)) {
      fonteInterna.propriedades.tensao = tensaoExterna;
    }
    circuito.fios.push({
      id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      origem: { componente: fonteInterna.id, pino: 'p2' },
      destino: { componente: fonteExterna.id, pino: 'p2' },
      dobras: [],
      cor: '#111827',
      espessura: 2,
    });
  }

  rotearFios(circuito, circuito.fios.filter((fio) => !fiosExistentes.has(fio)));

  // 6. Atualizar seleção para os novos componentes discretos
  const novosIds = Object.values(novosComps).map((c) => c.id);
  estado.selecionados = novosIds;

  // 7. Se a montagem tiver mais de 6 componentes, ajustar zoom da visualização
  if (novosIds.length > 6 && estado.view) {
    const fatorZoom = novosIds.length > 20 ? 0.6 : 0.85;
    estado.view.zoom = Math.max(0.35, estado.view.zoom * fatorZoom);
  }

  // 8. Registrar tudo em UM ÚNICO passo de histórico (undo atômico)
  registrar(circuito, 'trazer-montagem', true);

  if (typeof aoFinalizar === 'function') {
    aoFinalizar();
  }

  return true;
}
