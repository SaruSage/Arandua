import test from 'node:test';
import assert from 'node:assert/strict';

import { CATALOGO, obterDimensoesComponente, obterPinosComponente } from '../assets/js/catalogo.js';
import { adicionarComponente, criarCircuito } from '../assets/js/circuito.js';
import {
  analisarSelecaoParaConstruir,
  executarSubstituicaoConstruir,
} from '../assets/js/construir.js';
import { carregarExemploCircuito, EXEMPLOS_CIRCUITOS } from '../assets/js/exemplos.js';
import { boundsDoComponente } from '../assets/js/grupos.js';
import { inicializar } from '../assets/js/historico.js';
import { executarTrazerAoProjeto } from '../assets/js/montagem.js';
import { MONTAGENS } from '../assets/js/montagens.js';
import { configurarInteracao } from '../assets/js/selecao.js';
import { pontosDoFio } from '../assets/js/fios.js';
import { rotearFios } from '../assets/js/roteamento.js';
import { simular } from '../assets/js/solver.js';

function criarCircuitoDeExemplo(exemplo, entradas = {}) {
  const circuito = criarCircuito();
  const componentes = {};

  for (const definicao of exemplo.componentes) {
    const componente = adicionarComponente(
      circuito,
      definicao.tipo,
      definicao.x,
      definicao.y
    );
    componentes[definicao.ref] = componente;
    if (definicao.rotacao) componente.rotacao = definicao.rotacao;
    Object.assign(componente.propriedades, definicao.propriedades || {});
    if (definicao.nomeCustom) componente.nomeCustom = definicao.nomeCustom;
  }

  for (const [referencia, valor] of Object.entries(entradas)) {
    componentes[referencia].propriedades.fechada = Boolean(valor);
  }

  for (const [pinoA, pinoB, cor, dobras] of exemplo.ligacoes) {
    const [referenciaA, idPinoA] = pinoA.split('.');
    const [referenciaB, idPinoB] = pinoB.split('.');
    circuito.fios.push({
      id: `${pinoA}-${pinoB}`,
      origem: { componente: componentes[referenciaA].id, pino: idPinoA },
      destino: { componente: componentes[referenciaB].id, pino: idPinoB },
      dobras: dobras || [],
      cor,
      espessura: 2,
    });
  }

  rotearFios(circuito);
  return { circuito, componentes };
}

function saidaEsperada(exemploId, entradas) {
  const a = entradas[0] || 0;
  const b = entradas[1] || 0;
  const c = entradas[2] || 0;
  switch (exemploId) {
    case 'led-fonte-positiva': return [1];
    case 'chave-fonte-positiva':
    case 'transistor-fonte-positiva': return [a];
    case 'meio-somador': return [a ^ b, a & b];
    case 'somador-completo': return [a ^ b ^ c, Number(a + b + c >= 2)];
    case 'xor-combinacional':
    case 'xor-basica': return [Number((a + b) % 2 === 1)];
    case 'and-industrial':
    case 'and-didatica':
    case 'and-basica': return [a & b];
    case 'or-industrial':
    case 'or-didatica':
    case 'or-basica': return [a | b];
    case 'not-industrial':
    case 'not-didatica':
    case 'not-basica': return [1 - a];
    case 'nand-industrial':
    case 'nand-didatica':
    case 'nand-basica': return [Number(!(a && b))];
    case 'nor-industrial':
    case 'nor-didatica':
    case 'nor-basica': return [Number(!(a || b))];
    default: return null;
  }
}

function saidasLed(circuito) {
  return circuito.componentes
    .filter((componente) => componente.tipo === 'LED')
    .map((componente) => Number(componente.estado?.aceso === true));
}

function avaliarLogica(tipo, entradas) {
  switch (tipo) {
    case 'AND': return Number(entradas.every(Boolean));
    case 'OR': return Number(entradas.some(Boolean));
    case 'NOT': return Number(!entradas[0]);
    case 'NAND': return Number(!entradas.every(Boolean));
    case 'NOR': return Number(!entradas.some(Boolean));
    case 'XOR': return entradas.filter(Boolean).length % 2;
    case 'XNOR': return Number(entradas.filter(Boolean).length % 2 === 0);
    case 'BUFFER': return Number(Boolean(entradas[0]));
    default: return null;
  }
}

function assertComportamentoComponentes(circuito, resultado, contexto) {
  for (const componente of circuito.componentes) {
    const def = CATALOGO[componente.tipo];
    assert.ok(def, `${contexto}: tipo desconhecido ${componente.tipo}`);
    for (const pino of componente.pinos) {
      assert.ok(
        Number.isFinite(resultado.tensoes[`${componente.id}:${pino.id}`]),
        `${contexto}: tensão inválida em ${componente.tipo} ${componente.id}.${pino.id}`
      );
    }

    const corrente = resultado.correntes[componente.id];
    assert.ok(
      Number.isFinite(corrente),
      `${contexto}: corrente inválida em ${componente.tipo} ${componente.id}`
    );

    if (componente.tipo === 'RESISTOR') {
      const tensao = resultado.tensoes[`${componente.id}:p1`]
        - resultado.tensoes[`${componente.id}:p2`];
      const correnteEsperada = tensao / componente.propriedades.resistencia;
      assert.ok(
        Math.abs(corrente - correnteEsperada) <= Math.max(1e-9, Math.abs(correnteEsperada) * 1e-6),
        `${contexto}: lei de Ohm não respeitada em ${componente.id}`
      );
    }

    if (componente.tipo === 'BATERIA') {
      const tensao = resultado.tensoes[`${componente.id}:p1`]
        - resultado.tensoes[`${componente.id}:p2`];
      assert.ok(
        Math.abs(tensao - componente.propriedades.tensao) < 1e-6,
        `${contexto}: tensão da bateria ${componente.id} deveria ser ${componente.propriedades.tensao} V, recebeu ${tensao} V`
      );
    }

    if (def.modelo === 'logica') {
      const entradas = componente.pinos
        .filter((pino) => pino.id !== 'y')
        .map((pino) => pino.valor);
      assert.equal(
        componente.estado.saida,
        avaliarLogica(componente.tipo, entradas),
        `${contexto}: saída lógica incorreta em ${componente.id}`
      );
      assert.equal(
        componente.pinos.find((pino) => pino.id === 'y')?.valor,
        componente.estado.saida,
        `${contexto}: nível lógico do pino de saída incorreto em ${componente.id}`
      );
    }

    if (componente.tipo === 'LED') {
      assert.equal(
        componente.estado.aceso,
        Math.abs(corrente) > 0.001,
        `${contexto}: estado visual do LED inconsistente em ${componente.id}`
      );
    }

    if (componente.tipo === 'CHAVE' && componente.propriedades.fechada) {
      const tensao = resultado.tensoes[`${componente.id}:p1`]
        - resultado.tensoes[`${componente.id}:p2`];
      assert.ok(
        Math.abs(tensao) < 0.01,
        `${contexto}: chave fechada ${componente.id} não conduz`
      );
    }

    if (def.modelo === 'chave-controlada') {
      const controle = componente.pinos.find((pino) => pino.id === 'controle')?.valor === 1;
      assert.equal(
        componente.estado.condutora,
        controle,
        `${contexto}: estado da chave controlada ${componente.id} não corresponde ao pino de controle`
      );
    }
  }
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

function assertSemColisoesGeometricas(circuito, contexto) {
  const componentes = circuito.componentes;
  for (let indice = 0; indice < componentes.length; indice++) {
    const bounds = boundsDoComponente(componentes[indice]);
    for (let outro = indice + 1; outro < componentes.length; outro++) {
      const boundsOutro = boundsDoComponente(componentes[outro]);
      const sobreposicaoX = Math.min(bounds.x + bounds.w, boundsOutro.x + boundsOutro.w)
        - Math.max(bounds.x, boundsOutro.x);
      const sobreposicaoY = Math.min(bounds.y + bounds.h, boundsOutro.y + boundsOutro.h)
        - Math.max(bounds.y, boundsOutro.y);
      assert.ok(
        sobreposicaoX <= 1 || sobreposicaoY <= 1,
        `${contexto}: componentes ${componentes[indice].id} e ${componentes[outro].id} sobrepostos`
      );
    }
  }

  const segmentos = [];
  for (const fio of circuito.fios) {
    const pontos = pontosDoFio(circuito, fio);
    for (let indice = 0; indice < pontos.length - 1; indice++) {
      const segmento = { fio, indice, inicio: pontos[indice], fim: pontos[indice + 1] };
      for (const componente of componentes) {
        const terminalDaOrigem = componente.id === fio.origem.componente && indice === 0;
        const terminalDoDestino =
          componente.id === fio.destino.componente && indice === pontos.length - 2;
        if (terminalDaOrigem || terminalDoDestino) continue;
        assert.ok(
          !segmentoAtravessaBounds(segmento.inicio, segmento.fim, boundsDoComponente(componente)),
          `${contexto}: fio ${fio.id} atravessa componente ${componente.id}`
        );
      }
      segmentos.push(segmento);
    }
  }

  for (let indice = 0; indice < segmentos.length; indice++) {
    const atual = segmentos[indice];
    for (let outro = indice + 1; outro < segmentos.length; outro++) {
      const comparado = segmentos[outro];
      if (atual.fio === comparado.fio) continue;
      const horizontalAtual = Math.abs(atual.inicio.y - atual.fim.y) < 1e-6;
      const horizontalComparado = Math.abs(comparado.inicio.y - comparado.fim.y) < 1e-6;
      const verticalAtual = Math.abs(atual.inicio.x - atual.fim.x) < 1e-6;
      const verticalComparado = Math.abs(comparado.inicio.x - comparado.fim.x) < 1e-6;
      if (horizontalAtual && horizontalComparado
        && Math.abs(atual.inicio.y - comparado.inicio.y) < 1e-6) {
        const sobreposicao = Math.min(
          Math.max(atual.inicio.x, atual.fim.x),
          Math.max(comparado.inicio.x, comparado.fim.x)
        ) - Math.max(
          Math.min(atual.inicio.x, atual.fim.x),
          Math.min(comparado.inicio.x, comparado.fim.x)
        );
        assert.ok(
          sobreposicao <= 1e-6,
          `${contexto}: fios ${atual.fio.id} e ${comparado.fio.id} compartilham um trecho`
        );
      } else if (verticalAtual && verticalComparado
        && Math.abs(atual.inicio.x - comparado.inicio.x) < 1e-6) {
        const sobreposicao = Math.min(
          Math.max(atual.inicio.y, atual.fim.y),
          Math.max(comparado.inicio.y, comparado.fim.y)
        ) - Math.max(
          Math.min(atual.inicio.y, atual.fim.y),
          Math.min(comparado.inicio.y, comparado.fim.y)
        );
        assert.ok(
          sobreposicao <= 1e-6,
          `${contexto}: fios ${atual.fio.id} e ${comparado.fio.id} compartilham um trecho`
        );
      }
    }
  }
}

test('todas as portas padrão respeitam suas tabelas-verdade', () => {
  const funcoes = {
    AND: (a, b) => a & b,
    OR: (a, b) => a | b,
    NOT: (a) => 1 - a,
    NAND: (a, b) => Number(!(a && b)),
    NOR: (a, b) => Number(!(a || b)),
    XOR: (a, b) => (a + b) % 2,
    XNOR: (a, b) => Number((a + b) % 2 === 0),
    BUFFER: (a) => a,
  };

  for (const [tipo, funcao] of Object.entries(funcoes)) {
    const numeroEntradas = tipo === 'NOT' || tipo === 'BUFFER' ? 1 : 2;
    for (let bits = 0; bits < 2 ** numeroEntradas; bits++) {
      const entradas = Array.from(
        { length: numeroEntradas },
        (_, indice) => (bits >> (numeroEntradas - indice - 1)) & 1
      );
      const { circuito, componentes } = criarCircuitoDeExemplo({
        componentes: [
          { ref: 'bat', tipo: 'BATERIA', x: 0, y: 120, propriedades: { tensao: 5 } },
          ...entradas.map((_, indice) => ({ ref: `sw${indice}`, tipo: 'CHAVE', x: 100, y: indice * 80 })),
          ...entradas.map((_, indice) => ({ ref: `pull${indice}`, tipo: 'RESISTOR', x: 180, y: indice * 80, propriedades: { resistencia: 10000 } })),
          { ref: 'gate', tipo, x: 320, y: 80 },
          { ref: 'rLed', tipo: 'RESISTOR', x: 440, y: 80, propriedades: { resistencia: 220 } },
          { ref: 'led', tipo: 'LED', x: 540, y: 80 },
        ],
        ligacoes: [
          ...entradas.flatMap((_, indice) => [
            [`bat.p1`, `sw${indice}.p1`],
            [`sw${indice}.p2`, `pull${indice}.p1`],
            [`sw${indice}.p2`, `gate.${indice === 0 ? 'a' : 'b'}`],
            [`pull${indice}.p2`, 'bat.p2'],
          ]),
          ['gate.y', 'rLed.p1'],
          ['rLed.p2', 'led.p1'],
          ['led.p2', 'bat.p2'],
        ],
      }, Object.fromEntries(entradas.map((valor, indice) => [`sw${indice}`, valor])));

      const resultado = simular(circuito);
      assertComportamentoComponentes(circuito, resultado, `${tipo}: ${entradas}`);
      assertSemColisoesGeometricas(circuito, `${tipo}: ${entradas}`);
      assert.equal(resultado.convergiu, true, `${tipo} com entradas ${entradas}`);
      assert.equal(componentes.led.estado.aceso, Boolean(funcao(...entradas)), `${tipo} com entradas ${entradas}`);
    }
  }
});

test('todos os circuitos de exemplo correspondem à tabela-verdade', () => {
  for (const exemplo of EXEMPLOS_CIRCUITOS) {
    const chaves = exemplo.componentes
      .filter((componente) => componente.tipo === 'CHAVE')
      .map((componente) => componente.ref);

    for (let bits = 0; bits < 2 ** chaves.length; bits++) {
      const entradas = Array.from(
        { length: chaves.length },
        (_, indice) => (bits >> (chaves.length - indice - 1)) & 1
      );
      const esperado = saidaEsperada(exemplo.id, entradas);
      assert.ok(esperado, `${exemplo.id} precisa de uma tabela-verdade esperada`);

      const { circuito } = criarCircuitoDeExemplo(
        exemplo,
        Object.fromEntries(chaves.map((referencia, indice) => [referencia, entradas[indice]]))
      );
      const resultado = simular(circuito);
      assertComportamentoComponentes(circuito, resultado, `${exemplo.id}: ${entradas}`);
      assert.equal(resultado.convergiu, true, `${exemplo.id} com entradas ${entradas}`);
      assert.deepEqual(saidasLed(circuito), esperado, `${exemplo.id} com entradas ${entradas}`);
    }
  }
});

test('fonte positiva fornece tensão em relação a todos os símbolos GND', () => {
  const { circuito, componentes } = criarCircuitoDeExemplo({
    componentes: [
      { ref: 'vcc', tipo: 'FONTE_POSITIVA', x: 0, y: 0, propriedades: { tensao: 5 } },
      { ref: 'rLed', tipo: 'RESISTOR', x: 100, y: 0, propriedades: { resistencia: 220 } },
      { ref: 'led', tipo: 'LED', x: 200, y: 0 },
      { ref: 'gnd1', tipo: 'GND', x: 300, y: 0 },
      { ref: 'gnd2', tipo: 'GND', x: 400, y: 0 },
    ],
    ligacoes: [
      ['vcc.p', 'rLed.p1'],
      ['rLed.p2', 'led.p1'],
      ['led.p2', 'gnd1.p'],
    ],
  });

  const resultado = simular(circuito);
  assert.equal(resultado.convergiu, true);
  assert.equal(resultado.tensoes[`${componentes.vcc.id}:p`], 5);
  assert.equal(resultado.tensoes[`${componentes.gnd1.id}:p`], 0);
  assert.equal(resultado.tensoes[`${componentes.gnd2.id}:p`], 0);
  assert.equal(componentes.led.estado.aceso, true);
});

test('barramento padrão tem quatro pinos e permite configurar até dezesseis', () => {
  const barramento = adicionarComponente(criarCircuito(), 'BARRAMENTO', 0, 0);
  assert.equal(barramento.pinos.length, 4);
  assert.equal(barramento.propriedades.conectadoInternamente, false);

  const pinosMaximos = obterPinosComponente('BARRAMENTO', { quantidadePinos: 16 });
  assert.equal(pinosMaximos.length, 16);
  assert.equal(pinosMaximos[15].id, 'p16');
  assert.deepEqual(obterDimensoesComponente('BARRAMENTO', { quantidadePinos: 16 }), { w: 48, h: 400 });
});

test('barramento só une os pinos quando a opção interna está ativada', () => {
  const circuito = criarCircuito();
  const bateria = adicionarComponente(circuito, 'BATERIA', 0, 0);
  const barramento = adicionarComponente(circuito, 'BARRAMENTO', 120, 0);
  circuito.fios.push({
    id: 'fio-fonte-barramento',
    origem: { componente: bateria.id, pino: 'p1' },
    destino: { componente: barramento.id, pino: 'p1' },
    dobras: [],
  });

  const resultadoIndependente = simular(circuito);
  assert.equal(resultadoIndependente.tensoes[`${barramento.id}:p1`], 5);
  assert.equal(resultadoIndependente.tensoes[`${barramento.id}:p4`], null);

  barramento.propriedades.conectadoInternamente = true;
  const resultadoConectado = simular(circuito);
  assert.equal(resultadoConectado.tensoes[`${barramento.id}:p4`], 5);
});

test('circuito sem fonte não atribui tensões arbitrárias nem energiza componentes', () => {
  const circuito = criarCircuito();
  const porta = adicionarComponente(circuito, 'NOT', 0, 0);
  const led = adicionarComponente(circuito, 'LED', 120, 0);

  const resultado = simular(circuito);

  assert.equal(resultado.avisos.some((aviso) => aviso.includes('referência de terra arbitrária')), false);
  assert.equal(porta.estado.saida, null);
  assert.ok(porta.pinos.every((pino) => pino.valor === null));
  assert.ok(led.pinos.every((pino) => pino.valor === null));
  assert.equal(led.estado.aceso, false);
});

test('componentes em uma ilha sem alimentação não são energizados por uma fonte isolada', () => {
  const circuito = criarCircuito();
  const bateria = adicionarComponente(circuito, 'BATERIA', 0, 0);
  const porta = adicionarComponente(circuito, 'NOT', 120, 0);

  const resultado = simular(circuito);

  assert.equal(resultado.tensoes[`${bateria.id}:p1`], 5);
  assert.equal(resultado.tensoes[`${bateria.id}:p2`], 0);
  assert.equal(porta.estado.saida, null);
  assert.ok(porta.pinos.every((pino) => pino.valor === null));
});

test('Construir reconhece circuitos de exemplo completos pelas ligações e topologia', () => {
  for (const [id, alvo] of [['and-didatica', 'AND'], ['or-didatica', 'OR'], ['and-industrial', 'AND']]) {
    const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === id);
    const { circuito } = criarCircuitoDeExemplo(exemplo);
    const resultado = analisarSelecaoParaConstruir({
      circuito,
      selecionados: circuito.componentes.map((componente) => componente.id),
    });
    assert.equal(resultado.encontrado, true, `${id} deveria ser reconhecido`);
    assert.equal(resultado.alvo, alvo, `${id} deveria ser identificado como ${alvo}`);
  }
});

test('Construir reconhece montagem industrial da porta criada pelo botão Construir', () => {
  const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === 'and-basica');
  const { circuito, componentes } = criarCircuitoDeExemplo(exemplo);
  const estado = { circuito, selecionados: [] };
  inicializar(circuito);
  assert.equal(executarTrazerAoProjeto(componentes.gate, 'industrial', estado, () => {}, () => {}), true);

  const resultado = analisarSelecaoParaConstruir(estado);
  assert.equal(resultado.encontrado, true);
  assert.equal(resultado.alvo, 'AND');
});

test('Construir encontra uma estrutura válida dentro de uma seleção maior', () => {
  const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === 'and-didatica');
  const { circuito } = criarCircuitoDeExemplo(exemplo);
  const extra = adicionarComponente(circuito, 'RESISTOR', 900, 600);
  const resultado = analisarSelecaoParaConstruir({
    circuito,
    selecionados: circuito.componentes.map((componente) => componente.id),
  });

  assert.equal(resultado.encontrado, true);
  assert.equal(resultado.alvo, 'AND');
  assert.equal(resultado.componentes.includes(extra), false);
  assert.equal(resultado.componentes.length, exemplo.componentes.length);
});

test('Construir reconhece montagem de display de sete segmentos', () => {
  const circuito = criarCircuito();
  const montagem = MONTAGENS.DISPLAY_7SEG;
  const componentes = montagem.componentes.map((definicao, indice) => {
    const componente = adicionarComponente(circuito, definicao.tipo, definicao.x, definicao.y);
    if (definicao.rotacao) componente.rotacao = definicao.rotacao;
    Object.assign(componente.propriedades, definicao.propriedades || {});
    return componente;
  });
  circuito.fios = montagem.fios.map(({ de, para }, indice) => ({
    id: `fio-display-${indice}`,
    origem: { componente: componentes[de.comp].id, pino: de.pino },
    destino: { componente: componentes[para.comp].id, pino: para.pino },
    dobras: [],
    cor: '#111827',
    espessura: 2,
  }));
  const resultado = analisarSelecaoParaConstruir({
    circuito,
    selecionados: componentes.map((componente) => componente.id),
  });

  assert.equal(resultado.encontrado, true);
  assert.equal(resultado.alvo, 'DISPLAY_7SEG');
  assert.equal(Object.keys(resultado.mapeamentoPinos).length, 15);
});

test('Construir sugere circuitos compatíveis e enumera as ligações ausentes', () => {
  const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === 'and-didatica');
  const { circuito } = criarCircuitoDeExemplo(exemplo);
  circuito.fios.pop();
  const resultado = analisarSelecaoParaConstruir({
    circuito,
    selecionados: circuito.componentes.map((componente) => componente.id),
  });

  assert.equal(resultado.encontrado, false);
  assert.equal(resultado.motivo, 'ligacoes-incompletas');
  assert.ok(resultado.sugestoes.length > 0);
  assert.ok(resultado.sugestoes.some((sugestao) => sugestao.faltantes.length > 0));
  assert.ok(resultado.sugestoes.some((sugestao) =>
    sugestao.faltantes.some((ligacao) => ligacao.includes('↔'))
  ));
});

test('Construir sugere o circuito completo quando falta uma ligação na montagem industrial', () => {
  const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === 'and-industrial');
  for (let indice = 0; indice < exemplo.ligacoes.length; indice++) {
    const { circuito } = criarCircuitoDeExemplo(exemplo);
    circuito.fios.splice(indice, 1);
    const resultado = analisarSelecaoParaConstruir({
      circuito,
      selecionados: circuito.componentes.map((componente) => componente.id),
    });

    assert.equal(resultado.encontrado, false, `não deve substituir com a ligação ${indice} ausente`);
    assert.equal(resultado.motivo, 'ligacoes-incompletas');
    assert.ok(
      resultado.sugestoes.some((sugestao) => sugestao.faltantes.length > 0),
      `deve sugerir a ligação ${indice} que falta`
    );
  }
});

test('Construir reconecta entradas e saída externas ao substituir a montagem industrial', () => {
  const circuito = criarCircuito();
  const gate = adicionarComponente(circuito, 'AND', 500, 300);
  const entradaA = adicionarComponente(circuito, 'NO', 200, 260);
  const entradaB = adicionarComponente(circuito, 'NO', 200, 360);
  const saida = adicionarComponente(circuito, 'LED', 800, 300);
  circuito.fios.push(
    { id: 'entrada-a', origem: { componente: entradaA.id, pino: 'p' }, destino: { componente: gate.id, pino: 'a' }, dobras: [] },
    { id: 'entrada-b', origem: { componente: entradaB.id, pino: 'p' }, destino: { componente: gate.id, pino: 'b' }, dobras: [] },
    { id: 'saida-y', origem: { componente: gate.id, pino: 'y' }, destino: { componente: saida.id, pino: 'p1' }, dobras: [] },
  );
  const estado = { circuito, selecionados: [] };
  inicializar(circuito);
  assert.equal(executarTrazerAoProjeto(gate, 'industrial', estado, () => {}, () => {}), true);

  const componentesMontagem = circuito.componentes.filter((componente) =>
    estado.selecionados.includes(componente.id)
  );
  const resultado = analisarSelecaoParaConstruir({
    circuito,
    selecionados: componentesMontagem.map((componente) => componente.id),
  });
  assert.equal(resultado.encontrado, true);
  assert.equal(executarSubstituicaoConstruir(resultado, estado, () => {}), true);

  const porta = circuito.componentes.find((componente) => componente.tipo === 'AND');
  const externas = circuito.fios.filter((fio) =>
    fio.origem.componente === porta.id || fio.destino.componente === porta.id
  );
  assert.deepEqual(new Set(externas.map((fio) =>
    fio.origem.componente === porta.id ? fio.origem.pino : fio.destino.pino
  )), new Set(['a', 'b', 'y']));
  assert.equal(externas.length, 3);
  assert.ok(externas.some((fio) => [fio.origem.componente, fio.destino.componente].includes(entradaA.id)));
  assert.ok(externas.some((fio) => [fio.origem.componente, fio.destino.componente].includes(entradaB.id)));
  assert.ok(externas.some((fio) => [fio.origem.componente, fio.destino.componente].includes(saida.id)));
});

test('todos os exemplos prontos têm componentes e rotas sem colisões', () => {
  for (const exemplo of EXEMPLOS_CIRCUITOS) {
    const circuito = criarCircuito();
    inicializar(circuito);
    assert.equal(
      carregarExemploCircuito(exemplo.id, { circuito, selecionados: [] }, () => {}, () => {}),
      true
    );
    assertSemColisoesGeometricas(circuito, exemplo.id);
  }
});

test('substituir uma porta por montagem industrial ou didática preserva sua função', () => {
  const portas = {
    AND: 'and-basica',
    OR: 'or-basica',
    NOT: 'not-basica',
    NAND: 'nand-basica',
    NOR: 'nor-basica',
  };
  const funcoes = {
    AND: (a, b) => a & b,
    OR: (a, b) => a | b,
    NOT: (a) => 1 - a,
    NAND: (a, b) => Number(!(a && b)),
    NOR: (a, b) => Number(!(a || b)),
  };

  for (const [tipo, exemploId] of Object.entries(portas)) {
    const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === exemploId);
    for (const modo of ['industrial', 'didatica']) {
      const { circuito, componentes } = criarCircuitoDeExemplo(exemplo);
      inicializar(circuito);
      assert.equal(
        executarTrazerAoProjeto(
          componentes.gate,
          modo,
          { circuito, selecionados: [] },
          () => {},
          () => {}
        ),
        true
      );
      assertSemColisoesGeometricas(circuito, `${tipo}/${modo}`);

      const chaves = exemplo.componentes
        .filter((componente) => componente.tipo === 'CHAVE')
        .map((componente) => componente.ref);
      for (let bits = 0; bits < 2 ** chaves.length; bits++) {
        const entradas = Array.from(
          { length: chaves.length },
          (_, indice) => (bits >> (chaves.length - indice - 1)) & 1
        );
        chaves.forEach((referencia, indice) => {
          componentes[referencia].propriedades.fechada = Boolean(entradas[indice]);
        });

        const resultado = simular(circuito);
        assertComportamentoComponentes(circuito, resultado, `${tipo}/${modo}: ${entradas}`);
        const led = circuito.componentes.find((componente) => componente.tipo === 'LED');
        assert.equal(resultado.convergiu, true, `${tipo}/${modo} com entradas ${entradas}`);
        assert.equal(
          led.estado.aceso,
          Boolean(funcoes[tipo](...entradas)),
          `${tipo}/${modo} com entradas ${entradas}`
        );
      }
    }
  }
});

test('montagens industriais usam a fonte do próprio exemplo, não a do primeiro circuito', () => {
  for (const tipo of ['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR']) {
    const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === `${tipo.toLowerCase()}-basica`);
    const definicaoPorta = exemplo.componentes.find((item) => item.tipo === tipo);
    const entradas = exemplo.componentes
      .filter((item) => item.tipo === 'CHAVE')
      .map((item) => item.ref);

    for (let bits = 0; bits < 2 ** entradas.length; bits++) {
      const circuito = criarCircuito();
      inicializar(circuito);
      const estado = { circuito, selecionados: [] };
      assert.equal(carregarExemploCircuito('and-basica', estado, () => {}, () => {}), true);
      const primeiroExemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === 'and-basica');
      const componentesPrimeiro = circuito.componentes.slice(0, primeiroExemplo.componentes.length);
      const contagemAntes = circuito.componentes.length;
      assert.equal(carregarExemploCircuito(exemplo.id, estado, () => {}, () => {}), true);
      const componentesNovos = circuito.componentes.slice(contagemAntes);
      const componentesPorRef = Object.fromEntries(
        exemplo.componentes.map((definicao, indice) => [
          definicao.ref,
          componentesNovos[indice],
        ])
      );
      entradas.forEach((referencia, indice) => {
        componentesPorRef[referencia].propriedades.fechada =
          Boolean((bits >> (entradas.length - indice - 1)) & 1);
      });

      const fonteDoSegundo = componentesPorRef.bat;
      const fonteDoPrimeiro = componentesPrimeiro.find((item) => item.tipo === 'BATERIA');
      const porta = componentesPorRef[definicaoPorta.ref];
      assert.equal(
        executarTrazerAoProjeto(porta, 'industrial', estado, () => {}, () => {}),
        true
      );

      const bateriaMontagem = circuito.componentes
        .filter((item) => item.tipo === 'BATERIA')
        .find((item) => item.id !== fonteDoSegundo.id && item.id !== fonteDoPrimeiro.id);
      assert.ok(bateriaMontagem, `${exemplo.id}: fonte interna não foi criada`);
      const fioTerraMontagem = circuito.fios.find((fio) => {
        const pontaInterna = [fio.origem, fio.destino].find(
          (ponta) => ponta.componente === bateriaMontagem.id && ponta.pino === 'p2'
        );
        const outraPonta = pontaInterna === fio.origem ? fio.destino : fio.origem;
        return pontaInterna && circuito.componentes.some(
          (item) => item.id === outraPonta.componente && item.tipo === 'BATERIA'
        );
      });
      assert.ok(fioTerraMontagem, `${exemplo.id}: fonte interna sem referência`);
      const outraPonta = fioTerraMontagem.origem.componente === bateriaMontagem.id
        ? fioTerraMontagem.destino
        : fioTerraMontagem.origem;
      assert.equal(outraPonta.componente, fonteDoSegundo.id, `${exemplo.id}: fonte incorreta`);
      assert.notEqual(outraPonta.componente, fonteDoPrimeiro.id);

      const resultado = simular(circuito);
      const esperado = saidaEsperada(exemplo.id, entradas.map((ref, indice) =>
        (bits >> (entradas.length - indice - 1)) & 1
      ));
      assert.equal(resultado.convergiu, true, `${exemplo.id}: ${bits}`);
      assertComportamentoComponentes(circuito, resultado, `${exemplo.id}: ${bits}`);
      assert.deepEqual(
        saidasLed(circuito).slice(-esperado.length),
        esperado,
        `${exemplo.id}: ${bits}`
      );
      assertSemColisoesGeometricas(circuito, `${exemplo.id}/industrial: ${bits}`);
    }
  }
});

test('XOR, XNOR e BUFFER preservam suas tabelas nas montagens', () => {
  const funcoes = {
    XOR: (a, b) => Number(a !== b),
    XNOR: (a, b) => Number(a === b),
    BUFFER: (a) => a,
  };

  for (const [tipo, funcao] of Object.entries(funcoes)) {
    const quantidadeEntradas = tipo === 'BUFFER' ? 1 : 2;
    const exemplo = {
      componentes: [
        { ref: 'bat', tipo: 'BATERIA', x: 0, y: 180, propriedades: { tensao: 5 } },
        ...Array.from({ length: quantidadeEntradas }, (_, indice) => ({
          ref: `sw${indice}`,
          tipo: 'CHAVE',
          x: 100,
          y: indice * 80,
        })),
        ...Array.from({ length: quantidadeEntradas }, (_, indice) => ({
          ref: `pull${indice}`,
          tipo: 'RESISTOR',
          x: 180,
          y: indice * 80,
          propriedades: { resistencia: 10000 },
        })),
        { ref: 'gate', tipo, x: 320, y: 80 },
        { ref: 'rLed', tipo: 'RESISTOR', x: 440, y: 80, propriedades: { resistencia: 220 } },
        { ref: 'led', tipo: 'LED', x: 540, y: 80 },
      ],
      ligacoes: [
        ...Array.from({ length: quantidadeEntradas }, (_, indice) => [
          [`bat.p1`, `sw${indice}.p1`],
          [`sw${indice}.p2`, `pull${indice}.p1`],
          [`sw${indice}.p2`, `gate.${indice === 0 ? 'a' : 'b'}`],
          [`pull${indice}.p2`, 'bat.p2'],
        ]).flat(),
        ['gate.y', 'rLed.p1'],
        ['rLed.p2', 'led.p1'],
        ['led.p2', 'bat.p2'],
      ],
    };

    for (const modo of ['industrial', 'didatica']) {
      const { circuito, componentes } = criarCircuitoDeExemplo(exemplo);
      inicializar(circuito);
      assert.equal(
        executarTrazerAoProjeto(
          componentes.gate,
          modo,
          { circuito, selecionados: [] },
          () => {},
          () => {}
        ),
        true,
        `${tipo}/${modo}`
      );

      for (let bits = 0; bits < 2 ** quantidadeEntradas; bits++) {
        const entradas = Array.from(
          { length: quantidadeEntradas },
          (_, indice) => (bits >> (quantidadeEntradas - indice - 1)) & 1
        );
        entradas.forEach((valor, indice) => {
          componentes[`sw${indice}`].propriedades.fechada = Boolean(valor);
        });
        const resultado = simular(circuito);
        assertComportamentoComponentes(circuito, resultado, `${tipo}/${modo}: ${entradas}`);
        const led = circuito.componentes.find((componente) => componente.tipo === 'LED');
        assert.equal(resultado.convergiu, true, `${tipo}/${modo} com entradas ${entradas}`);
        assert.equal(
          led.estado.aceso,
          Boolean(funcao(...entradas)),
          `${tipo}/${modo} com entradas ${entradas}`
        );
      }
    }
  }
});

test('substituições mantêm a lógica nos exemplos compostos', () => {
  for (const exemplo of EXEMPLOS_CIRCUITOS.filter((item) =>
    ['not-basica', 'and-basica', 'or-basica', 'nand-basica', 'nor-basica', 'xor-basica']
      .includes(item.id)
  )) {
    const exemploId = exemplo.id;
    const portasSubstituiveis = exemplo.componentes.filter((componente) =>
      ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'].includes(componente.tipo)
    );
    if (portasSubstituiveis.length === 0) continue;
    const chaves = exemplo.componentes
      .filter((componente) => componente.tipo === 'CHAVE')
      .map((componente) => componente.ref);

    for (const modo of ['industrial', 'didatica']) {
      for (const porta of portasSubstituiveis) {
        for (let bits = 0; bits < 2 ** chaves.length; bits++) {
          const entradas = Array.from(
            { length: chaves.length },
            (_, indice) => (bits >> (chaves.length - indice - 1)) & 1
          );
          const { circuito, componentes } = criarCircuitoDeExemplo(
            exemplo,
            Object.fromEntries(chaves.map((referencia, indice) => [referencia, entradas[indice]]))
          );
          inicializar(circuito);
          assert.equal(
            executarTrazerAoProjeto(
              componentes[porta.ref],
              modo,
              { circuito, selecionados: [] },
              () => {},
              () => {}
            ),
            true,
            `${exemploId}/${porta.ref}/${modo}`
          );

          const resultado = simular(circuito);
          const esperado = saidaEsperada(exemploId, entradas);
          assertComportamentoComponentes(
            circuito,
            resultado,
            `${exemploId}/${porta.ref}/${modo}: ${entradas}`
          );
          assertSemColisoesGeometricas(circuito, `${exemploId}/${porta.ref}/${modo}: ${entradas}`);
          assert.equal(resultado.convergiu, true, `${exemploId}/${porta.ref}/${modo}: ${entradas}`);
          assert.deepEqual(saidasLed(circuito), esperado, `${exemploId}/${porta.ref}/${modo}: ${entradas}`);
        }
      }
    }
  }
});

test('circuitos compostos seguem funcionando com todas as portas substituídas', () => {
  for (const exemploId of ['meio-somador', 'somador-completo', 'xor-combinacional']) {
    const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === exemploId);
    const portasSubstituiveis = exemplo.componentes.filter((componente) =>
      ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'].includes(componente.tipo)
    );
    const chaves = exemplo.componentes
      .filter((componente) => componente.tipo === 'CHAVE')
      .map((componente) => componente.ref);

    for (const modo of ['industrial', 'didatica']) {
      for (let bits = 0; bits < 2 ** chaves.length; bits++) {
        const entradas = Array.from(
          { length: chaves.length },
          (_, indice) => (bits >> (chaves.length - indice - 1)) & 1
        );
        const { circuito, componentes } = criarCircuitoDeExemplo(
          exemplo,
          Object.fromEntries(chaves.map((referencia, indice) => [referencia, entradas[indice]]))
        );
        inicializar(circuito);
        for (const porta of portasSubstituiveis) {
          assert.equal(
            executarTrazerAoProjeto(
              componentes[porta.ref],
              modo,
              { circuito, selecionados: [] },
              () => {},
              () => {}
            ),
            true,
            `${exemploId}/${porta.ref}/${modo}`
          );
        }

        const resultado = simular(circuito);
        assertComportamentoComponentes(circuito, resultado, `${exemploId}/${modo}: ${entradas}`);
        assert.equal(resultado.convergiu, true, `${exemploId}/${modo}: ${entradas}`);
        assert.deepEqual(
          saidasLed(circuito),
          saidaEsperada(exemploId, entradas),
          `${exemploId}/${modo}: ${entradas}`
        );
      }
    }
  }
});

test('carregar exemplos acrescenta circuitos sem remover os existentes', () => {
  const circuito = criarCircuito();
  const anterior = adicionarComponente(circuito, 'RESISTOR', 20, 40);
  const noAnterior = adicionarComponente(circuito, 'NO', 120, 40);
  const fioAnterior = {
    id: 'fio-existente',
    origem: { componente: anterior.id, pino: 'p1' },
    destino: { componente: noAnterior.id, pino: 'p' },
    dobras: [],
    cor: '#111827',
    espessura: 2,
  };
  circuito.fios.push(fioAnterior);
  const grupo = { id: 'grupo-existente', nome: 'Mantido', membros: [anterior.id] };
  circuito.grupos.push(grupo);
  circuito.proximoId = 1;
  const quantidadeFiosInicial = circuito.fios.length;
  inicializar(circuito);

  const estado = { circuito, selecionados: [] };
  for (const id of ['and-basica', 'or-basica']) {
    assert.equal(carregarExemploCircuito(id, estado, () => {}, () => {}), true);
  }

  assert.equal(circuito.componentes[0], anterior);
  assert.equal(circuito.componentes[1], noAnterior);
  assert.equal(circuito.fios[0], fioAnterior);
  assert.equal(circuito.grupos[0], grupo);
  assert.equal(circuito.componentes.length, 2 + 16);
  assert.ok(circuito.fios.length > quantidadeFiosInicial);
  assert.equal(new Set(circuito.componentes.map((componente) => componente.id)).size, circuito.componentes.length);
  const limiteExistente = noAnterior.x + noAnterior.dimensoes.w;
  const menorXExemplo = Math.min(...circuito.componentes.slice(2).map((componente) => componente.x));
  assert.ok(menorXExemplo >= limiteExistente + 100);
});

test('exemplos independentes acrescentados juntos convergem e preservam os componentes', () => {
  for (let indice = 0; indice < EXEMPLOS_CIRCUITOS.length; indice++) {
    const primeiro = EXEMPLOS_CIRCUITOS[indice];
    const segundo = EXEMPLOS_CIRCUITOS[(indice + 1) % EXEMPLOS_CIRCUITOS.length];
    const circuito = criarCircuito();
    inicializar(circuito);
    const estado = { circuito, selecionados: [] };
    assert.equal(carregarExemploCircuito(primeiro.id, estado, () => {}, () => {}), true);
    assert.equal(carregarExemploCircuito(segundo.id, estado, () => {}, () => {}), true);

    const resultado = simular(circuito);
    const contexto = `${primeiro.id} + ${segundo.id}`;
    assert.equal(resultado.convergiu, true, `${contexto}: não convergiu`);
    assertComportamentoComponentes(circuito, resultado, contexto);
    assertSemColisoesGeometricas(circuito, contexto);
  }
});

test('carregar um exemplo não inicia a simulação', () => {
  const circuito = criarCircuito();
  inicializar(circuito);
  const estado = {
    circuito,
    selecionados: [],
    simulando: false,
    iniciarSimulacao() {
      this.simulando = true;
    },
    recalcular() {
      assert.fail('não deve recalcular antes de iniciar pelo botão');
    },
  };

  assert.equal(carregarExemploCircuito('and-basica', estado, () => {}, () => {}), true);
  assert.equal(estado.simulando, false);
});

test('mover componentes e clicar em chaves não inicia a simulação', () => {
  const documentoAnterior = globalThis.document;
  const janelaAnterior = globalThis.window;
  const listeners = {};
  const elemento = {
    style: {},
    addEventListener(tipo, callback) {
      listeners[tipo] = callback;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
  };
  const canvas = {
    elemento,
    view: { panX: 0, panY: 0 },
    telaParaMundo(x, y) {
      return { x, y };
    },
  };
  const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === 'or-basica');
  const { circuito, componentes } = criarCircuitoDeExemplo(exemplo);
  const led = componentes.led;
  let recalculos = 0;
  const estado = {
    circuito,
    selecionados: [],
    simulando: false,
    iniciarSimulacao() {
      this.simulando = true;
      this.recalcular();
    },
    recalcular() {
      recalculos++;
      const resultado = simular(circuito);
      assertComportamentoComponentes(circuito, resultado, `OR/UI: ${componentes.swA.propriedades.fechada ? 1 : 0}${componentes.swB.propriedades.fechada ? 1 : 0}`);
      assert.equal(resultado.convergiu, true);
    },
  };

  globalThis.document = { getElementById: () => null };
  globalThis.window = { addEventListener() {} };
  try {
    inicializar(circuito);
    configurarInteracao(canvas, estado, () => {});

    const clicarChave = (chave) => {
      const evento = {
        button: 0,
        clientX: chave.x + 24,
        clientY: chave.y + 17,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault() {},
      };
      listeners.mousedown(evento);
      listeners.mouseup({ button: 0 });
    };

    const pontoLed = {
      x: led.x + led.dimensoes.w / 2,
      y: led.y + led.dimensoes.h / 2,
    };
    listeners.mousedown({
      button: 0,
      clientX: pontoLed.x,
      clientY: pontoLed.y,
      preventDefault() {},
    });
    listeners.mousemove({
      button: 0,
      clientX: pontoLed.x + 32,
      clientY: pontoLed.y + 32,
    });
    listeners.mouseup({ button: 0 });
    assert.equal(estado.simulando, false);
    assert.equal(recalculos, 0);

    clicarChave(componentes.swA);
    assert.equal(componentes.swA.propriedades.fechada, true);
    assert.equal(estado.simulando, false);
    assert.equal(recalculos, 0);

    estado.iniciarSimulacao();
    assert.equal(estado.simulando, true);
    assert.equal(led.estado.aceso, true);

    clicarChave(componentes.swA);
    assert.equal(componentes.swA.propriedades.fechada, false);
    assert.equal(led.estado.aceso, false);

    clicarChave(componentes.swB);
    assert.equal(componentes.swB.propriedades.fechada, true);
    assert.equal(led.estado.aceso, true);
  } finally {
    if (documentoAnterior === undefined) delete globalThis.document;
    else globalThis.document = documentoAnterior;
    if (janelaAnterior === undefined) delete globalThis.window;
    else globalThis.window = janelaAnterior;
  }
});

test('cliques nas chaves do AND industrial são independentes e só acendem o LED juntas', () => {
  const documentoAnterior = globalThis.document;
  const janelaAnterior = globalThis.window;
  const listeners = {};
  const elemento = {
    style: {},
    addEventListener(tipo, callback) {
      listeners[tipo] = callback;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
  };
  const canvas = {
    elemento,
    view: { zoom: 1, panX: 0, panY: 0 },
    telaParaMundo(x, y) {
      return { x, y };
    },
  };
  const exemplo = EXEMPLOS_CIRCUITOS.find((item) => item.id === 'and-industrial');
  const { circuito, componentes } = criarCircuitoDeExemplo(exemplo);
  let resultado;
  const estado = {
    circuito,
    selecionados: [],
    simulando: true,
    recalcular() {
      resultado = simular(circuito);
    },
  };

  globalThis.document = { getElementById: () => null };
  globalThis.window = { addEventListener() {} };
  try {
    inicializar(circuito);
    configurarInteracao(canvas, estado, () => {});

    const clicarChave = (chave) => {
      const evento = {
        button: 0,
        clientX: chave.x + chave.dimensoes.w / 2,
        clientY: chave.y + chave.dimensoes.h / 2,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault() {},
      };
      listeners.mousedown(evento);
      listeners.mouseup({ button: 0 });
      assert.equal(resultado.convergiu, true);
    };

    clicarChave(componentes.swA);
    assert.equal(componentes.swA.propriedades.fechada, true);
    assert.equal(componentes.swB.propriedades.fechada, false);
    assert.equal(componentes.led.estado.aceso, false);

    clicarChave(componentes.swB);
    assert.equal(componentes.swA.propriedades.fechada, true);
    assert.equal(componentes.swB.propriedades.fechada, true);
    assert.equal(componentes.led.estado.aceso, true);
    assert.ok(Math.abs(resultado.correntes[componentes.led.id]) > 0.001);
  } finally {
    if (documentoAnterior === undefined) delete globalThis.document;
    else globalThis.document = documentoAnterior;
    if (janelaAnterior === undefined) delete globalThis.window;
    else globalThis.window = janelaAnterior;
  }
});

test('LED com bateria de retorno aberta não conduz até fechar o caminho elétrico', () => {
  const circuito = criarCircuito();
  const vcc = adicionarComponente(circuito, 'BATERIA', 0, 0);
  vcc.propriedades.tensao = 5;
  const resistor = adicionarComponente(circuito, 'RESISTOR', 100, 0);
  resistor.propriedades.resistencia = 1000;
  const led = adicionarComponente(circuito, 'LED', 200, 0);
  const bateriaRetorno = adicionarComponente(circuito, 'BATERIA', 300, 0);
  bateriaRetorno.propriedades.tensao = 5;

  circuito.fios.push(
    { id: 'vcc-resistor', origem: { componente: vcc.id, pino: 'p1' }, destino: { componente: resistor.id, pino: 'p1' }, dobras: [] },
    { id: 'resistor-led', origem: { componente: resistor.id, pino: 'p2' }, destino: { componente: led.id, pino: 'p1' }, dobras: [] },
    { id: 'led-bateria-retorno', origem: { componente: led.id, pino: 'p2' }, destino: { componente: bateriaRetorno.id, pino: 'p2' }, dobras: [] },
  );

  let resultado = simular(circuito);
  assert.equal(resultado.convergiu, true);
  assert.ok(resultado.tensoes[`${led.id}:p1`] > 4.9);
  assert.ok(Math.abs(resultado.tensoes[`${led.id}:p1`] - resultado.tensoes[`${led.id}:p2`]) < 0.01);
  assert.ok(Math.abs(resultado.correntes[led.id]) < 0.001);
  assert.equal(led.estado.aceso, false);

  circuito.fios = circuito.fios.filter((fio) => fio.id !== 'led-bateria-retorno');
  circuito.fios.push({
    id: 'led-terra-comum',
    origem: { componente: led.id, pino: 'p2' },
    destino: { componente: vcc.id, pino: 'p2' },
    dobras: [],
  });
  resultado = simular(circuito);
  assert.equal(resultado.convergiu, true);
  assert.ok(Math.abs(resultado.correntes[led.id]) > 0.001);
  assert.equal(led.estado.aceso, true);
});

test('arrastar a área vazia desloca o canvas em pixels e preserva o zoom pela roda', () => {
  const documentoAnterior = globalThis.document;
  const janelaAnterior = globalThis.window;
  const listeners = {};
  const listenersJanela = {};
  const elemento = {
    style: {},
    addEventListener(tipo, callback) {
      listeners[tipo] = callback;
    },
    getBoundingClientRect() {
      return { left: 10, top: 20 };
    },
  };
  const canvas = {
    elemento,
    view: { zoom: 1, panX: 0, panY: 0 },
    telaParaMundo(x, y) {
      return {
        x: (x - this.view.panX) / this.view.zoom,
        y: (y - this.view.panY) / this.view.zoom,
      };
    },
  };
  const circuito = criarCircuito();
  const estado = { circuito, selecionados: [] };
  globalThis.document = { getElementById: () => null };
  globalThis.window = {
    addEventListener(tipo, callback) {
      listenersJanela[tipo] = callback;
    },
  };

  try {
    inicializar(circuito);
    configurarInteracao(canvas, estado, () => {});

    listeners.mousedown({
      button: 0,
      clientX: 30,
      clientY: 50,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault() {},
    });
    listeners.mousemove({ target: elemento, clientX: 55, clientY: 30 });
    assert.equal(canvas.view.panX, 25);
    assert.equal(canvas.view.panY, -20);

    listenersJanela.mousemove({ target: {}, clientX: 85, clientY: 100 });
    assert.equal(canvas.view.panX, 55);
    assert.equal(canvas.view.panY, 50);
    listenersJanela.mouseup({ button: 0 });
    assert.equal(elemento.style.cursor, 'default');

    const mundoAntes = canvas.telaParaMundo(100, 100);
    listeners.wheel({
      clientX: 110,
      clientY: 120,
      deltaY: -1,
      preventDefault() {},
    });
    const mundoDepois = canvas.telaParaMundo(100, 100);
    assert.equal(canvas.view.zoom, 1.1);
    assert.ok(Math.abs(mundoDepois.x - mundoAntes.x) < 1e-10);
    assert.ok(Math.abs(mundoDepois.y - mundoAntes.y) < 1e-10);
  } finally {
    if (documentoAnterior === undefined) delete globalThis.document;
    else globalThis.document = documentoAnterior;
    if (janelaAnterior === undefined) delete globalThis.window;
    else globalThis.window = janelaAnterior;
  }
});

test('chaves e botões da gaveta isolam a carga quando estão abertos', () => {
  for (const tipo of ['CHAVE', 'BOTAO']) {
    const circuito = criarCircuito();
    const bateria = adicionarComponente(circuito, 'BATERIA', 0, 0);
    bateria.propriedades.tensao = 5;
    const chave = adicionarComponente(circuito, tipo, 100, 0);
    const resistor = adicionarComponente(circuito, 'RESISTOR', 200, 0);
    resistor.propriedades.resistencia = 10000;

    circuito.fios.push(
      { id: 'positivo-chave', origem: { componente: bateria.id, pino: 'p1' }, destino: { componente: chave.id, pino: 'p1' }, dobras: [] },
    );
    let resultado = simular(circuito);
    assert.equal(resultado.convergiu, true, `${tipo}: circuito aberto não convergiu`);
    assert.ok(
      resultado.tensoes[`${chave.id}:p1`] > 4.9,
      `${tipo}: o lado da fonte deveria permanecer energizado`
    );
    assert.ok(
      Math.abs(resultado.tensoes[`${chave.id}:p2`]) < 0.01,
      `${tipo}: o terminal desconectado foi energizado com a chave aberta`
    );

    circuito.fios.push(
      { id: 'chave-carga', origem: { componente: chave.id, pino: 'p2' }, destino: { componente: resistor.id, pino: 'p1' }, dobras: [] },
      { id: 'carga-negativo', origem: { componente: resistor.id, pino: 'p2' }, destino: { componente: bateria.id, pino: 'p2' }, dobras: [] },
    );

    const propriedadeFechada = tipo === 'BOTAO' ? 'pressionado' : 'fechada';
    assert.equal(chave.propriedades[propriedadeFechada], false);
    resultado = simular(circuito);
    assert.equal(resultado.convergiu, true, `${tipo}: circuito aberto não convergiu`);
    assert.ok(
      resultado.tensoes[`${chave.id}:p1`] > 4.9,
      `${tipo}: o lado da fonte deveria permanecer energizado`
    );
    assert.ok(
      Math.abs(resultado.tensoes[`${chave.id}:p2`]) < 0.01,
      `${tipo}: a carga foi energizada com a chave aberta`
    );

    chave.propriedades[propriedadeFechada] = true;
    resultado = simular(circuito);
    assert.equal(resultado.convergiu, true, `${tipo}: circuito fechado não convergiu`);
    assert.ok(
      resultado.tensoes[`${chave.id}:p2`] > 4.9,
      `${tipo}: a carga não foi energizada ao fechar a chave`
    );
  }
});
