import {
  criarCircuito,
  criarComponente,
  adicionarComponente,
  conectar,
  propagar,
  acionarSwitch,
} from '../core/circuit.js';
import { criarCanvas, LARGURA_COMPONENTE, ALTURA_COMPONENTE } from '../editor/canvas.js';

const OPERACOES = [
  'SOMA',
  'SUB',
  'AND',
  'OR',
  'XOR',
  'NOT A',
  'SHIFT LEFT',
  'SHIFT RIGHT',
];

const EXPLICACOES_CAMINHO = {
  pc: 'O contador de programa (PC) guarda o endereço da próxima instrução que será buscada na memória.',
  memoria: 'A memória fornece a instrução armazenada no endereço indicado pelo PC. Também guarda dados usados pelo programa.',
  instrucao: 'O registrador de instrução mantém a instrução atual disponível enquanto a unidade de controle a interpreta.',
  controle: 'A unidade de controle decodifica a instrução e coordena os sinais que selecionam operações e movimentam dados.',
  ula: 'A ULA realiza operações aritméticas e lógicas sobre os valores recebidos.',
  acumulador: 'O acumulador guarda resultados produzidos pela ULA para uso em etapas seguintes.',
};

const NIVEIS_ESCALA = [
  {
    nome: 'Transistor',
    quantidade: 'Unidade básica de chaveamento',
    largura: '15%',
    texto: 'Transistores controlam a passagem de corrente e formam a base física dos circuitos digitais.',
  },
  {
    nome: 'Porta Lógica',
    quantidade: 'Uma NAND pode usar cerca de 4 transistores',
    largura: '32%',
    texto: 'Transistores conectados implementam funções como AND, OR e NOT. Portas NAND podem ser usadas para construir outras funções lógicas.',
  },
  {
    nome: 'Circuito',
    quantidade: 'Um somador de 4 bits usa dezenas de portas',
    largura: '52%',
    texto: 'Portas combinacionais e elementos de memória trabalham juntos para criar somadores, contadores e outros blocos funcionais.',
  },
  {
    nome: 'ULA/CPU',
    quantidade: 'Uma CPU reúne milhares ou milhões de elementos lógicos',
    largura: '76%',
    texto: 'A ULA, os registradores e a unidade de controle formam uma estrutura que executa operações e coordena dados.',
  },
  {
    nome: 'Programa',
    quantidade: 'Instruções controlam os blocos físicos',
    largura: '100%',
    texto: 'Um programa escolhe quais operações o processador executará. Cada instrução acaba sendo realizada por circuitos construídos com os níveis anteriores.',
  },
];

function adicionar(circuito, tipo, opcoes) {
  return adicionarComponente(circuito, criarComponente(tipo, opcoes));
}

function ligar(circuito, origem, pinoOrigem, destino, pinoDestino) {
  const fio = conectar(circuito, {
    componente: origem.id,
    pino: pinoOrigem,
  }, {
    componente: destino.id,
    pino: pinoDestino,
  });
  if (!fio) throw new Error(`Não foi possível conectar ${origem.rotulo} a ${destino.rotulo}.`);
  return fio;
}

function montarCanvas(elemento, circuito) {
  const canvas = criarCanvas(elemento);
  const redimensionar = () => {
    canvas.redimensionar();
    const retangulo = elemento.getBoundingClientRect();
    const limites = circuito.componentes.reduce((resultado, componente) => ({
      minimoX: Math.min(resultado.minimoX, componente.posicao.x),
      minimoY: Math.min(resultado.minimoY, componente.posicao.y),
      maximoX: Math.max(resultado.maximoX, componente.posicao.x + LARGURA_COMPONENTE),
      maximoY: Math.max(resultado.maximoY, componente.posicao.y + ALTURA_COMPONENTE),
    }), {
      minimoX: Infinity,
      minimoY: Infinity,
      maximoX: -Infinity,
      maximoY: -Infinity,
    });
    const largura = limites.maximoX - limites.minimoX;
    const altura = limites.maximoY - limites.minimoY;
    canvas.view.zoom = Math.max(0.3, Math.min(
      1,
      (retangulo.width - 32) / largura,
      (retangulo.height - 32) / altura,
    ));
    canvas.view.panX = (retangulo.width - largura * canvas.view.zoom) / 2
      - limites.minimoX * canvas.view.zoom;
    canvas.view.panY = (retangulo.height - altura * canvas.view.zoom) / 2
      - limites.minimoY * canvas.view.zoom;
    canvas.render(circuito);
  };

  const observador = new ResizeObserver(redimensionar);
  observador.observe(elemento);
  window.addEventListener('pagehide', () => observador.disconnect(), { once: true });
  redimensionar();
  return { renderizar: redimensionar };
}

function configurarExercicios(container) {
  container.closest('main')?.querySelectorAll('.widget-exercicio').forEach((formulario) => {
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const resposta = formulario.querySelector('input[type="radio"]:checked');
      const retorno = formulario.querySelector('[aria-live="polite"]');
      const correto = resposta?.value === formulario.dataset.resposta;
      retorno.textContent = resposta
        ? correto ? 'Correto! Muito bem.' : 'Ainda não. Reveja a teoria e tente novamente.'
        : 'Escolha uma alternativa antes de conferir.';
      retorno.classList.toggle('correto', Boolean(correto));
    });
  });
}

function criarSwitch(circuito, rotulo, posicao, valor = 0) {
  const componente = adicionar(circuito, 'SWITCH', {
    numEntradas: 0,
    numSaidas: 1,
    rotulo,
    posicao,
  });
  componente.estado.ativo = valor;
  return componente;
}

function criarPorta(circuito, tipo, rotulo, posicao) {
  return adicionar(circuito, tipo, {
    numEntradas: 2,
    numSaidas: 1,
    rotulo,
    posicao,
  });
}

function criarMux(circuito, tipo, rotulo, posicao) {
  return adicionar(circuito, tipo, {
    numEntradas: tipo === 'MUX_4_1' ? 6 : 3,
    numSaidas: 1,
    rotulo,
    posicao,
  });
}

function criarLed(circuito, rotulo, posicao) {
  return adicionar(circuito, 'LED', {
    numEntradas: 1,
    numSaidas: 0,
    rotulo,
    posicao,
  });
}

function montarUla(container) {
  const circuito = criarCircuito();
  const entradasA = [];
  const entradasB = [];
  const bitsResultado = [];
  const portas = { AND: [], OR: [], XOR: [], NOT: [] };
  const leds = [];

  for (let bit = 0; bit < 4; bit++) {
    entradasA.push(criarSwitch(circuito, `A${bit}`, { x: 20, y: 35 + bit * 105 }));
    entradasB.push(criarSwitch(circuito, `B${bit}`, { x: 130, y: 35 + bit * 105 }));
  }

  const zeroSoma = criarSwitch(circuito, 'Cin=0', { x: 170, y: 510 });
  const zeroSubtracao = criarSwitch(circuito, 'Bin=0', { x: 270, y: 510 });
  const zeroDados = criarSwitch(circuito, '0', { x: 380, y: 510 });
  const somador = adicionar(circuito, 'SOMADOR_4BITS', {
    numEntradas: 9,
    numSaidas: 5,
    rotulo: 'Soma',
    posicao: { x: 300, y: 90 },
  });
  const subtrator = adicionar(circuito, 'SUBTRATOR_4BITS', {
    numEntradas: 9,
    numSaidas: 5,
    rotulo: 'Subtração',
    posicao: { x: 300, y: 365 },
  });
  ligar(circuito, zeroSoma, 'out0', somador, 'in8');
  ligar(circuito, zeroSubtracao, 'out0', subtrator, 'in8');
  const seletores = [
    criarSwitch(circuito, 'S0', { x: 760, y: 25 }),
    criarSwitch(circuito, 'S1', { x: 760, y: 90 }),
    criarSwitch(circuito, 'S2', { x: 760, y: 155 }),
  ];

  for (let bit = 0; bit < 4; bit++) {
    ligar(circuito, entradasA[bit], 'out0', somador, `in${bit}`);
    ligar(circuito, entradasB[bit], 'out0', somador, `in${bit + 4}`);
    ligar(circuito, entradasA[bit], 'out0', subtrator, `in${bit}`);
    ligar(circuito, entradasB[bit], 'out0', subtrator, `in${bit + 4}`);

    for (const [indice, tipo] of ['AND', 'OR', 'XOR', 'NOT'].entries()) {
      const porta = tipo === 'NOT'
        ? adicionar(circuito, 'NOT', {
          numEntradas: 1,
          numSaidas: 1,
          rotulo: `¬A${bit}`,
          posicao: { x: 460 + indice * 80, y: 40 + bit * 115 },
        })
        : criarPorta(circuito, tipo, `${tipo}${bit}`, {
          x: 460 + indice * 80,
          y: 40 + bit * 115,
        });
      ligar(circuito, entradasA[bit], 'out0', porta, 'in0');
      if (tipo !== 'NOT') ligar(circuito, entradasB[bit], 'out0', porta, 'in1');
      portas[tipo].push(porta);
    }

    const muxBaixo = criarMux(circuito, 'MUX_4_1', `MUX L${bit}`, {
      x: 840,
      y: 90 + bit * 120,
    });
    const muxAlto = criarMux(circuito, 'MUX_4_1', `MUX H${bit}`, {
      x: 840,
      y: 550 + bit * 120,
    });
    const muxFinal = criarMux(circuito, 'MUX_2_1', `MUX saída ${bit}`, {
      x: 1010,
      y: 335 + bit * 90,
    });
    const led = criarLed(circuito, `R${bit}`, { x: 1170, y: 335 + bit * 90 });
    const deslocaEsquerda = bit === 0 ? zeroDados : entradasA[bit - 1];
    const deslocaDireita = bit === 3 ? zeroDados : entradasA[bit + 1];
    const dadosBaixos = [
      [somador, `out${bit}`],
      [subtrator, `out${bit}`],
      [portas.AND[bit], 'out0'],
      [portas.OR[bit], 'out0'],
    ];
    const dadosAltos = [
      [portas.XOR[bit], 'out0'],
      [portas.NOT[bit], 'out0'],
      [deslocaEsquerda, 'out0'],
      [deslocaDireita, 'out0'],
    ];

    dadosBaixos.forEach(([origem, pino], indice) => ligar(
      circuito,
      origem,
      pino,
      muxBaixo,
      `in${indice}`,
    ));
    dadosAltos.forEach(([origem, pino], indice) => ligar(
      circuito,
      origem,
      pino,
      muxAlto,
      `in${indice}`,
    ));
    [muxBaixo, muxAlto].forEach((mux) => {
      ligar(circuito, seletores[0], 'out0', mux, 'in4');
      ligar(circuito, seletores[1], 'out0', mux, 'in5');
    });
    ligar(circuito, muxBaixo, 'out0', muxFinal, 'in0');
    ligar(circuito, muxAlto, 'out0', muxFinal, 'in1');
    ligar(circuito, seletores[2], 'out0', muxFinal, 'in2');
    ligar(circuito, muxFinal, 'out0', led, 'in0');
    bitsResultado.push(muxFinal);
    leds.push(led);
  }

  propagar(circuito);
  const elementoCanvas = container.querySelector('#m7-ula-canvas');
  const desenho = montarCanvas(elementoCanvas, circuito);
  const controlesA = container.querySelector('#m7-ula-a');
  const controlesB = container.querySelector('#m7-ula-b');
  const seletorOperacao = container.querySelector('#m7-ula-operacao');
  const resultado = container.querySelector('#m7-ula-resultado');
  const binario = container.querySelector('#m7-ula-binario');
  const carry = container.querySelector('#m7-ula-carry');
  const zero = container.querySelector('#m7-ula-zero');
  const botoes = [];

  function criarControle(containerControles, componente, rotulo) {
    const botao = document.createElement('button');
    botao.className = 'simulador-chave';
    botao.type = 'button';
    botao.setAttribute('aria-pressed', 'false');
    botao.addEventListener('click', () => {
      acionarSwitch(circuito, componente.id, componente.estado.ativo === 1 ? 0 : 1);
      atualizar();
    });
    containerControles.append(botao);
    botoes.push(() => {
      const valor = componente.estado.ativo;
      botao.textContent = `${rotulo}: ${valor}`;
      botao.classList.toggle('ativo', valor === 1);
      botao.setAttribute('aria-pressed', String(valor === 1));
    });
  }

  entradasA.forEach((componente, bit) => criarControle(controlesA, componente, `A${bit}`));
  entradasB.forEach((componente, bit) => criarControle(controlesB, componente, `B${bit}`));

  function atualizar() {
    const codigo = OPERACOES.indexOf(seletorOperacao.value);
    acionarSwitch(circuito, seletores[0].id, codigo & 1);
    acionarSwitch(circuito, seletores[1].id, (codigo >> 1) & 1);
    acionarSwitch(circuito, seletores[2].id, (codigo >> 2) & 1);
    propagar(circuito);
    botoes.forEach((atualizarBotao) => atualizarBotao());

    const valores = bitsResultado.map((mux) => mux.saidas[0].valor);
    const valorDecimal = valores.reduce((total, bit, indice) => total + bit * (2 ** indice), 0);
    const valorBinario = [...valores].reverse().join('');
    resultado.textContent = `Resultado: ${valorDecimal}`;
    binario.textContent = `Binário: ${valorBinario}`;
    const valorCarry = codigo === 0
      ? somador.saidas[4].valor
      : codigo === 1
        ? subtrator.saidas[4].valor
        : codigo === 6
          ? entradasA[3].estado.ativo
          : codigo === 7
            ? entradasA[0].estado.ativo
            : 0;
    carry.textContent = `Carry/Borrow: ${valorCarry}`;
    carry.classList.toggle('aceso', valorCarry === 1);
    const zeroAtivo = valores.every((bit) => bit === 0);
    zero.textContent = `Zero: ${zeroAtivo ? 1 : 0}`;
    zero.classList.toggle('aceso', zeroAtivo);
    leds.forEach((led, indice) => {
      led.entradas[0].valor = valores[indice];
      led.estado.aceso = valores[indice] === 1;
    });
    desenho.renderizar();
  }

  seletorOperacao.addEventListener('change', atualizar);
  atualizar();
}

function configurarCaminho(container) {
  const ids = ['pc', 'memoria', 'instrucao', 'controle', 'ula', 'acumulador'];
  const descricao = container.querySelector('#m7-caminho-explicacao');
  const blocos = [...container.querySelectorAll('[data-bloco]')];
  const botaoExecutar = container.querySelector('#m7-executar-ciclo');
  const contador = container.querySelector('#m7-ciclos');
  let ciclos = 0;
  let executando = false;

  function selecionar(id) {
    blocos.forEach((bloco) => {
      const ativo = bloco.dataset.bloco === id;
      bloco.classList.toggle('ativo', ativo);
      bloco.setAttribute('aria-pressed', String(ativo));
    });
    descricao.textContent = EXPLICACOES_CAMINHO[id];
  }

  blocos.forEach((bloco) => {
    bloco.addEventListener('click', () => selecionar(bloco.dataset.bloco));
    bloco.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        selecionar(bloco.dataset.bloco);
      }
    });
  });

  botaoExecutar.addEventListener('click', async () => {
    if (executando) return;
    executando = true;
    botaoExecutar.disabled = true;
    for (const id of ids) {
      selecionar(id);
      await new Promise((resolver) => window.setTimeout(resolver, 400));
    }
    ciclos++;
    contador.textContent = `Ciclos executados: ${ciclos}`;
    botaoExecutar.disabled = false;
    executando = false;
  });
  selecionar(ids[0]);
}

function configurarEscala(container) {
  const botoes = [...container.querySelectorAll('[data-nivel]')];
  const explicacao = container.querySelector('#m7-escala-explicacao');

  function selecionar(indice) {
    botoes.forEach((botao, indiceBotao) => {
      const ativo = indice === indiceBotao;
      botao.classList.toggle('ativo', ativo);
      botao.setAttribute('aria-pressed', String(ativo));
    });
    explicacao.textContent = NIVEIS_ESCALA[indice].texto;
  }

  botoes.forEach((botao, indice) => {
    botao.addEventListener('click', () => selecionar(indice));
  });
  selecionar(0);
}

export function inicializarM7(container) {
  container.innerHTML = `
    <section class="widget-bloco" aria-labelledby="m7-ula-titulo">
      <h3 id="m7-ula-titulo">ULA interativa de 4 bits</h3>
      <div class="widget-ula">
        <div class="widget-ula-controles">
          <fieldset>
            <legend>Operando A</legend>
            <div class="simulador-chaves" id="m7-ula-a"></div>
          </fieldset>
          <fieldset>
            <legend>Operando B</legend>
            <div class="simulador-chaves" id="m7-ula-b"></div>
          </fieldset>
          <label class="propriedades-campo" for="m7-ula-operacao">Operação
            <select id="m7-ula-operacao">
              ${OPERACOES.map((operacao) => `<option value="${operacao}">${operacao}</option>`).join('')}
            </select>
          </label>
          <p class="widget-resultado" id="m7-ula-resultado" role="status" aria-live="polite"></p>
          <p class="widget-resultado" id="m7-ula-binario" role="status" aria-live="polite"></p>
          <div class="simulador-leituras" role="status" aria-live="polite">
            <span class="simulador-indicador" id="m7-ula-zero">Zero: 0</span>
            <span class="simulador-indicador" id="m7-ula-carry">Carry/Borrow: 0</span>
          </div>
        </div>
        <canvas class="simulador-canvas widget-ula-canvas" id="m7-ula-canvas" aria-label="Circuito interno da ULA de quatro bits"></canvas>
      </div>
    </section>
    <section class="widget-bloco" aria-labelledby="m7-caminho-titulo">
      <h3 id="m7-caminho-titulo">Caminho de dados</h3>
      <p>Selecione um bloco para conhecer seu papel no processador.</p>
      <div class="widget-caminho-scroll" role="region" aria-label="Diagrama do caminho de dados; role horizontalmente em telas pequenas" tabindex="0">
        <svg class="widget-caminho-dados" viewBox="0 0 900 240" role="group" aria-label="Diagrama do caminho de dados do processador">
          <defs>
            <marker id="m7-seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker>
          </defs>
          <path class="caminho-seta" d="M130 90 H165"></path>
          <path class="caminho-seta" d="M270 90 H305"></path>
          <path class="caminho-seta" d="M425 90 H460"></path>
          <path class="caminho-seta" d="M580 90 H615"></path>
          <path class="caminho-seta" d="M735 90 H770"></path>
          <path class="caminho-retorno" d="M825 130 V200 H215 V130"></path>
          <g class="caminho-bloco" data-bloco="pc" tabindex="0" role="button" aria-label="Contador de programa">
            <rect x="20" y="55" width="110" height="70" rx="10"></rect><text x="75" y="95">PC</text>
          </g>
          <g class="caminho-bloco" data-bloco="memoria" tabindex="0" role="button" aria-label="Memória">
            <rect x="165" y="55" width="105" height="70" rx="10"></rect><text x="217" y="95">Memória</text>
          </g>
          <g class="caminho-bloco" data-bloco="instrucao" tabindex="0" role="button" aria-label="Registrador de instrução">
            <rect x="305" y="55" width="120" height="70" rx="10"></rect><text x="365" y="87">Registrador</text><text x="365" y="105">de instrução</text>
          </g>
          <g class="caminho-bloco" data-bloco="controle" tabindex="0" role="button" aria-label="Unidade de controle">
            <rect x="460" y="55" width="120" height="70" rx="10"></rect><text x="520" y="87">Unidade de</text><text x="520" y="105">controle</text>
          </g>
          <g class="caminho-bloco" data-bloco="ula" tabindex="0" role="button" aria-label="Unidade lógica e aritmética">
            <rect x="615" y="55" width="120" height="70" rx="10"></rect><text x="675" y="95">ULA</text>
          </g>
          <g class="caminho-bloco" data-bloco="acumulador" tabindex="0" role="button" aria-label="Registrador acumulador">
            <rect x="770" y="55" width="110" height="70" rx="10"></rect><text x="825" y="87">Registrador</text><text x="825" y="105">acumulador</text>
          </g>
        </svg>
      </div>
      <div class="widget-caminho-controles">
        <button class="btn btn--primary" id="m7-executar-ciclo" type="button">Executar ciclo</button>
        <p class="widget-resultado" id="m7-ciclos" role="status" aria-live="polite">Ciclos executados: 0</p>
      </div>
      <p class="widget-fluxo-explicacao" id="m7-caminho-explicacao" role="status" aria-live="polite"></p>
    </section>
    <section class="widget-bloco" aria-labelledby="m7-escala-titulo">
      <h3 id="m7-escala-titulo">Do transistor ao programa</h3>
      <div class="widget-escala">
        ${NIVEIS_ESCALA.map((nivel, indice) => `
          <button class="widget-escala-nivel" type="button" data-nivel="${indice}" aria-pressed="false">
            <span class="widget-escala-cabecalho"><strong>${nivel.nome}</strong><span>${nivel.quantidade}</span></span>
            <span class="widget-escala-barra"><span style="width:${nivel.largura}"></span></span>
          </button>
        `).join('')}
      </div>
      <p class="widget-fluxo-explicacao" id="m7-escala-explicacao" role="status" aria-live="polite"></p>
    </section>
  `;

  montarUla(container);
  configurarCaminho(container);
  configurarEscala(container);
  configurarExercicios(container);
}
