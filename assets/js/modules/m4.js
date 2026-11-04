import {
  criarCircuito,
  criarComponente,
  adicionarComponente,
  conectar,
  propagar,
  acionarSwitch,
} from '../core/circuit.js';
import { criarCanvas, LARGURA_COMPONENTE, ALTURA_COMPONENTE } from '../editor/canvas.js';

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
    if (!circuito.componentes.length) {
      canvas.render(circuito);
      return;
    }

    const limite = circuito.componentes.reduce((resultado, componente) => ({
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
    const larguraMundo = limite.maximoX - limite.minimoX;
    const alturaMundo = limite.maximoY - limite.minimoY;
    const escalaX = (retangulo.width - 32) / larguraMundo;
    const escalaY = (retangulo.height - 32) / alturaMundo;
    canvas.view.zoom = Math.max(0.25, Math.min(1, escalaX, escalaY));
    canvas.view.panX = (retangulo.width - larguraMundo * canvas.view.zoom) / 2
      - limite.minimoX * canvas.view.zoom;
    canvas.view.panY = (retangulo.height - alturaMundo * canvas.view.zoom) / 2
      - limite.minimoY * canvas.view.zoom;
    canvas.render(circuito);
  };

  const observador = new ResizeObserver(redimensionar);
  observador.observe(elemento);
  window.addEventListener('pagehide', () => observador.disconnect(), { once: true });
  redimensionar();
  return { renderizar: redimensionar };
}

function criarSwitch(circuito, rotulo, posicao) {
  return adicionar(circuito, 'SWITCH', {
    numEntradas: 0,
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

function adicionarControleSwitch(container, circuito, componente, rotulo, atualizar) {
  const botao = document.createElement('button');
  botao.className = 'simulador-chave';
  botao.type = 'button';
  botao.setAttribute('aria-pressed', 'false');
  botao.addEventListener('click', () => {
    acionarSwitch(circuito, componente.id, componente.estado.ativo === 1 ? 0 : 1);
    atualizar();
  });
  container.append(botao);

  return () => {
    const valor = componente.estado.ativo;
    botao.textContent = `${rotulo}: ${valor}`;
    botao.classList.toggle('ativo', valor === 1);
    botao.setAttribute('aria-pressed', String(valor === 1));
  };
}

function atualizarLed(container, rotulo, aceso) {
  let indicador = container.querySelector(`[data-led="${rotulo}"]`);
  if (!indicador) {
    indicador = document.createElement('span');
    indicador.className = 'simulador-indicador';
    indicador.dataset.led = rotulo;
    container.append(indicador);
  }
  indicador.classList.toggle('aceso', aceso);
  indicador.textContent = `${rotulo}: ${aceso ? '1' : '0'}`;
  indicador.setAttribute('aria-label', `${rotulo}: ${aceso ? 'aceso' : 'apagado'}`);
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

function montarSomador(container) {
  const circuito = criarCircuito();
  const entradasA = [];
  const entradasB = [];
  const controles = [];
  const leds = [];
  const controlesElemento = container.querySelector('#m4-somador-controles');
  const leiturasElemento = container.querySelector('#m4-somador-saidas');
  const resultadoElemento = container.querySelector('#m4-somador-resultado');
  const novoCircuito = container.querySelector('#m4-somador-novo');

  for (let indice = 0; indice < 4; indice++) {
    entradasA.push(criarSwitch(circuito, `A${indice}`, { x: 30, y: 30 + indice * 82 }));
    entradasB.push(criarSwitch(circuito, `B${indice}`, { x: 145, y: 30 + indice * 82 }));
  }
  const entradas = [...entradasA, ...entradasB];

  const transporte = criarSwitch(circuito, 'Cin = 0', { x: 270, y: 350 });
  transporte.estado.ativo = 0;
  const somador = adicionar(circuito, 'SOMADOR_4BITS', {
    numEntradas: 9,
    numSaidas: 5,
    rotulo: 'Somador 4 bits',
    posicao: { x: 300, y: 125 },
  });
  entradas.forEach((componente, indice) => {
    ligar(circuito, componente, 'out0', somador, `in${indice}`);
  });
  ligar(circuito, transporte, 'out0', somador, 'in8');

  for (let indice = 0; indice < 5; indice++) {
    const led = criarLed(circuito, indice < 4 ? `S${indice}` : 'Cout', {
      x: 490,
      y: 45 + indice * 72,
    });
    ligar(circuito, somador, `out${indice}`, led, 'in0');
    leds.push(led);
  }

  entradas.forEach((componente, indice) => {
    const bit = indice < 4 ? indice : indice - 4;
    const nome = indice < 4 ? `A${bit}` : `B${bit}`;
    controles.push(adicionarControleSwitch(
      controlesElemento,
      circuito,
      componente,
      nome,
      atualizar,
    ));
  });

  const desenho = montarCanvas(container.querySelector('#m4-somador-canvas'), circuito);

  function atualizar() {
    propagar(circuito);
    controles.forEach((atualizarControle) => atualizarControle());
    leds.forEach((led, indice) => {
      atualizarLed(leiturasElemento, indice < 4 ? `S${indice}` : 'Cout', led.estado.aceso);
    });
    const valorA = entradas.slice(0, 4)
      .reduce((valor, componente, indice) => valor + componente.estado.ativo * (2 ** indice), 0);
    const valorB = entradas.slice(4, 8)
      .reduce((valor, componente, indice) => valor + componente.estado.ativo * (2 ** indice), 0);
    const soma = leds.slice(0, 4)
      .reduce((valor, led, indice) => valor + Number(led.estado.aceso) * (2 ** indice), 0)
      + Number(leds[4].estado.aceso) * 16;
    resultadoElemento.textContent = `A=${valorA}, B=${valorB} → Soma=${soma}`;
    desenho.renderizar();
  }

  novoCircuito.addEventListener('click', () => {
    entradas.forEach((componente) => {
      acionarSwitch(circuito, componente.id, Math.random() < 0.5 ? 0 : 1);
    });
    atualizar();
  });
  atualizar();
}

function montarDecodificador(container) {
  const circuito = criarCircuito();
  const entradas = [];
  const controles = [];
  const ledsCodigo = [];
  const controlesElemento = container.querySelector('#m4-bcd-controles');
  const display = container.querySelector('#m4-display');
  const aviso = container.querySelector('#m4-bcd-aviso');
  const bcd = adicionar(circuito, 'DISPLAY_7SEG', {
    numEntradas: 4,
    numSaidas: 7,
    rotulo: 'BCD → 7 segmentos',
    posicao: { x: 310, y: 125 },
  });
  const decodificador = adicionar(circuito, 'DECODIFICADOR_2_4', {
    numEntradas: 2,
    numSaidas: 4,
    rotulo: 'Decodificador 2:4',
    posicao: { x: 180, y: 290 },
  });

  for (let indice = 0; indice < 4; indice++) {
    const componente = criarSwitch(circuito, `BCD ${8 >> indice}`, {
      x: 30,
      y: 35 + indice * 76,
    });
    entradas.push(componente);
    ligar(circuito, componente, 'out0', bcd, `in${indice}`);
    controles.push(adicionarControleSwitch(
      controlesElemento,
      circuito,
      componente,
      ['A (8)', 'B (4)', 'C (2)', 'D (1)'][indice],
      atualizar,
    ));
  }

  ligar(circuito, entradas[2], 'out0', decodificador, 'in0');
  ligar(circuito, entradas[3], 'out0', decodificador, 'in1');
  for (let indice = 0; indice < 4; indice++) {
    const led = criarLed(circuito, `Y${indice}`, {
      x: 310,
      y: 290 + indice * 72,
    });
    ligar(circuito, decodificador, `out${indice}`, led, 'in0');
    ledsCodigo.push(led);
  }

  const desenho = montarCanvas(container.querySelector('#m4-bcd-canvas'), circuito);
  const segmentos = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const sinalizar = (valor, aceso) => {
    const segmento = display.querySelector(`[data-segmento="${valor}"]`);
    segmento?.classList.toggle('aceso', aceso);
  };

  function atualizar() {
    propagar(circuito);
    controles.forEach((atualizarControle) => atualizarControle());
    const valor = entradas.reduce(
      (total, componente, indice) => total + componente.estado.ativo * (2 ** (3 - indice)),
      0,
    );
    bcd.saidas.forEach((pino, indice) => sinalizar(segmentos[indice], pino.valor === 1));
    aviso.hidden = valor <= 9;
    aviso.textContent = valor > 9 ? 'Valor inválido: o display apaga para entradas acima de 9.' : '';
    ledsCodigo.forEach((led, indice) => atualizarLed(
      container.querySelector('#m4-bcd-decodificado'),
      `Y${indice}`,
      led.estado.aceso,
    ));
    desenho.renderizar();
  }

  atualizar();
}

function montarMux(container) {
  const circuito = criarCircuito();
  const controlesElemento = container.querySelector('#m4-mux-controles');
  const entradas = [];
  const controles = [];
  const multiplexador = adicionar(circuito, 'MUX_4_1', {
    numEntradas: 6,
    numSaidas: 1,
    rotulo: 'MUX 4:1',
    posicao: { x: 260, y: 110 },
  });
  const led = criarLed(circuito, 'Y', { x: 410, y: 130 });

  for (let indice = 0; indice < 6; indice++) {
    const rotulo = indice < 4 ? ['A', 'B', 'C', 'D'][indice] : `S${indice - 4}`;
    const componente = criarSwitch(circuito, rotulo, {
      x: 30 + (indice >= 4 ? 125 : 0),
      y: 35 + (indice % 4) * 72,
    });
    entradas.push(componente);
    ligar(circuito, componente, 'out0', multiplexador, `in${indice}`);
    controles.push(adicionarControleSwitch(
      controlesElemento,
      circuito,
      componente,
      rotulo,
      atualizar,
    ));
  }
  ligar(circuito, multiplexador, 'out0', led, 'in0');

  const desenho = montarCanvas(container.querySelector('#m4-mux-canvas'), circuito);
  const selecionada = container.querySelector('#m4-mux-selecionada');
  const saida = container.querySelector('#m4-mux-saida');
  const botoesDados = [...controlesElemento.querySelectorAll('.simulador-chave')].slice(0, 4);

  function atualizar() {
    propagar(circuito);
    controles.forEach((atualizarControle) => atualizarControle());
    const indice = entradas[4].estado.ativo + 2 * entradas[5].estado.ativo;
    const nome = ['A', 'B', 'C', 'D'][indice];
    selecionada.textContent = `Entrada selecionada: ${nome}`;
    selecionada.dataset.selecionada = nome;
    botoesDados.forEach((botao, indiceBotao) => {
      botao.classList.toggle('selecionado', indiceBotao === indice);
    });
    atualizarLed(saida, 'Y', led.estado.aceso);
    desenho.renderizar();
  }

  atualizar();
}

export function inicializarM4(container) {
  container.innerHTML = `
    <section class="widget-bloco" aria-labelledby="m4-somador-titulo">
      <h3 id="m4-somador-titulo">Monte seu somador</h3>
      <p>Altere os bits de A e B. O transporte de entrada Cin fica em 0.</p>
      <div class="simulador-grade">
        <div class="simulador-painel">
          <div class="simulador-chaves" id="m4-somador-controles"></div>
          <div class="simulador-leituras" id="m4-somador-saidas" aria-label="Saídas do somador"></div>
          <p class="widget-resultado" id="m4-somador-resultado" aria-live="polite"></p>
          <button class="btn btn--ghost" id="m4-somador-novo" type="button">Novo circuito</button>
        </div>
        <canvas class="simulador-canvas" id="m4-somador-canvas" aria-label="Circuito somador de quatro bits"></canvas>
      </div>
    </section>
    <section class="widget-bloco" aria-labelledby="m4-bcd-titulo">
      <h3 id="m4-bcd-titulo">Decodificador BCD</h3>
      <p>Os bits A–D representam 8, 4, 2 e 1. O decodificador 2:4 demonstra a seleção pelos dois bits menos significativos.</p>
      <div class="simulador-grade">
        <div class="simulador-painel">
          <div class="simulador-chaves" id="m4-bcd-controles"></div>
          <svg class="simulador-display" id="m4-display" viewBox="0 0 120 190" role="img" aria-label="Display de sete segmentos">
            <rect class="display-fundo" x="5" y="5" width="110" height="180" rx="12"></rect>
            <rect data-segmento="a" x="28" y="18" width="64" height="12" rx="5"></rect>
            <rect data-segmento="b" x="92" y="28" width="12" height="58" rx="5"></rect>
            <rect data-segmento="c" x="92" y="104" width="12" height="58" rx="5"></rect>
            <rect data-segmento="d" x="28" y="162" width="64" height="12" rx="5"></rect>
            <rect data-segmento="e" x="16" y="104" width="12" height="58" rx="5"></rect>
            <rect data-segmento="f" x="16" y="28" width="12" height="58" rx="5"></rect>
            <rect data-segmento="g" x="28" y="90" width="64" height="12" rx="5"></rect>
          </svg>
          <p class="widget-erro" id="m4-bcd-aviso" role="status" aria-live="polite" hidden></p>
          <div class="simulador-leituras" id="m4-bcd-decodificado" aria-label="Saídas do decodificador 2 para 4"></div>
        </div>
        <canvas class="simulador-canvas" id="m4-bcd-canvas" aria-label="Circuito de decodificação BCD"></canvas>
      </div>
    </section>
    <section class="widget-bloco" aria-labelledby="m4-mux-titulo">
      <h3 id="m4-mux-titulo">MUX 4:1</h3>
      <p>Configure A, B, C e D e use S1S0 para selecionar qual sinal chega à saída.</p>
      <div class="simulador-grade">
        <div class="simulador-painel">
          <div class="simulador-chaves" id="m4-mux-controles"></div>
          <p class="widget-resultado" id="m4-mux-selecionada" aria-live="polite"></p>
          <div class="simulador-leituras" id="m4-mux-saida" aria-label="Saída do multiplexador"></div>
        </div>
        <canvas class="simulador-canvas" id="m4-mux-canvas" aria-label="Circuito multiplexador 4 para 1"></canvas>
      </div>
    </section>
  `;

  montarSomador(container);
  montarDecodificador(container);
  montarMux(container);
  configurarExercicios(container);
}
