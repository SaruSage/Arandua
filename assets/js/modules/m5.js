import {
  criarCircuito,
  criarComponente,
  adicionarComponente,
  conectar,
  propagar,
  acionarSwitch,
  lerSaidas,
} from '../core/circuit.js';
import { tictac, resetar } from '../core/clock.js';
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
    canvas.view.zoom = Math.max(0.25, Math.min(
      1,
      (retangulo.width - 32) / larguraMundo,
      (retangulo.height - 32) / alturaMundo,
    ));
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

function criarClock(circuito, posicao) {
  return adicionar(circuito, 'CLOCK', {
    numEntradas: 0,
    numSaidas: 1,
    rotulo: 'CLOCK',
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

function criarBotaoSwitch(container, circuito, componente, rotulo, atualizar) {
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

function mostrarLed(container, rotulo, aceso) {
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

function mostrarSaidas(container, rotulos, valores) {
  rotulos.forEach((rotulo, indice) => mostrarLed(container, rotulo, valores[indice] === 1));
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

function configurarControlesClock(container, circuito, atualizar) {
  const clock = circuito.componentes.find((componente) => componente.tipo === 'CLOCK');
  const botaoPulso = container.querySelector('[data-acao="pulso"]');
  const botaoAutomatico = container.querySelector('[data-acao="automatico"]');
  const ciclos = container.querySelector('[data-ciclos]');
  let intervalo = null;

  function atualizarStatus() {
    ciclos.textContent = `Ciclos: ${clock.estado.ciclos}`;
    botaoAutomatico.textContent = intervalo ? 'Parar automático' : 'Clock automático';
    botaoAutomatico.setAttribute('aria-pressed', String(Boolean(intervalo)));
    atualizar();
  }

  function pulsar() {
    tictac(circuito);
    atualizarStatus();
  }

  botaoPulso.addEventListener('click', () => {
    const nivel = clock.estado.nivel;
    if (nivel === 1) {
      clock.estado.nivel = 0;
      clock.saidas[0].valor = 0;
    }
    tictac(circuito);
    atualizarStatus();
  });
  botaoAutomatico.addEventListener('click', () => {
    if (intervalo) {
      window.clearInterval(intervalo);
      intervalo = null;
    } else {
      intervalo = window.setInterval(pulsar, 500);
    }
    atualizarStatus();
  });
  window.addEventListener('pagehide', () => {
    if (intervalo) window.clearInterval(intervalo);
  }, { once: true });

  return {
    atualizar: atualizarStatus,
    parar() {
      if (intervalo) window.clearInterval(intervalo);
      intervalo = null;
      atualizarStatus();
    },
  };
}

function montarFlipFlopD(container) {
  const circuito = criarCircuito();
  const entrada = criarSwitch(circuito, 'D', { x: 30, y: 100 });
  criarClock(circuito, { x: 170, y: 100 });
  const flipFlop = adicionar(circuito, 'DFF', {
    numEntradas: 1,
    numSaidas: 2,
    rotulo: 'Flip-flop D',
    posicao: { x: 310, y: 100 },
  });
  const leds = [
    criarLed(circuito, 'Q', { x: 470, y: 65 }),
    criarLed(circuito, 'Q̄', { x: 470, y: 145 }),
  ];
  ligar(circuito, entrada, 'out0', flipFlop, 'in0');
  ligar(circuito, flipFlop, 'out0', leds[0], 'in0');
  ligar(circuito, flipFlop, 'out1', leds[1], 'in0');
  const controles = container.querySelector('#m5-d-controles');
  const atualizarSwitch = criarBotaoSwitch(controles, circuito, entrada, 'D', atualizar);
  const leituras = container.querySelector('#m5-d-saidas');
  const ciclos = container.querySelector('[data-ciclos="d"]');
  const desenho = montarCanvas(container.querySelector('#m5-d-canvas'), circuito);

  function atualizar() {
    propagar(circuito);
    atualizarSwitch?.();
    mostrarSaidas(leituras, ['Q', 'Q̄'], lerSaidas(circuito, flipFlop.id));
    ciclos.textContent = `Ciclos: ${circuito.componentes.find((item) => item.tipo === 'CLOCK').estado.ciclos}`;
    desenho.renderizar();
  }

  const controlesClock = configurarControlesClock(container.querySelector('#m5-d-bloco'), circuito, atualizar);
  container.querySelector('#m5-d-reset').addEventListener('click', () => {
    resetar(circuito);
    controlesClock.atualizar();
  });
  atualizar();
}

function montarFlipFlopJk(container) {
  const circuito = criarCircuito();
  const j = criarSwitch(circuito, 'J', { x: 30, y: 65 });
  const k = criarSwitch(circuito, 'K', { x: 30, y: 155 });
  criarClock(circuito, { x: 170, y: 100 });
  const flipFlop = adicionar(circuito, 'JKFF', {
    numEntradas: 2,
    numSaidas: 2,
    rotulo: 'Flip-flop JK',
    posicao: { x: 310, y: 100 },
  });
  const leds = [
    criarLed(circuito, 'Q', { x: 470, y: 65 }),
    criarLed(circuito, 'Q̄', { x: 470, y: 145 }),
  ];
  ligar(circuito, j, 'out0', flipFlop, 'in0');
  ligar(circuito, k, 'out0', flipFlop, 'in1');
  ligar(circuito, flipFlop, 'out0', leds[0], 'in0');
  ligar(circuito, flipFlop, 'out1', leds[1], 'in0');

  const controles = container.querySelector('#m5-jk-controles');
  const atualizarJ = criarBotaoSwitch(controles, circuito, j, 'J', atualizar);
  const atualizarK = criarBotaoSwitch(controles, circuito, k, 'K', atualizar);
  const leituras = container.querySelector('#m5-jk-saidas');
  const tabela = container.querySelector('#m5-jk-tabela');
  const desenho = montarCanvas(container.querySelector('#m5-jk-canvas'), circuito);
  const controlesClock = configurarControlesClock(container.querySelector('#m5-jk-bloco'), circuito, atualizar);

  function atualizar() {
    propagar(circuito);
    atualizarJ?.();
    atualizarK?.();
    mostrarSaidas(leituras, ['Q', 'Q̄'], lerSaidas(circuito, flipFlop.id));
    tabela.querySelectorAll('tbody tr').forEach((linha) => {
      const ativa = Number(linha.dataset.j) === j.estado.ativo
        && Number(linha.dataset.k) === k.estado.ativo;
      linha.classList.toggle('linha-ativa', ativa);
    });
    desenho.renderizar();
  }

  container.querySelector('#m5-jk-reset').addEventListener('click', () => {
    resetar(circuito);
    controlesClock.atualizar();
  });
  atualizar();
}

function montarContador(container) {
  const circuito = criarCircuito();
  criarClock(circuito, { x: 30, y: 100 });
  const contador = adicionar(circuito, 'COUNTER', {
    numEntradas: 0,
    numSaidas: 4,
    rotulo: 'Contador 4 bits',
    posicao: { x: 190, y: 100 },
  });
  const leds = [];
  for (let indice = 0; indice < 4; indice++) {
    const led = criarLed(circuito, `Q${indice}`, { x: 360, y: 35 + indice * 72 });
    ligar(circuito, contador, `out${indice}`, led, 'in0');
    leds.push(led);
  }
  const leituras = container.querySelector('#m5-contador-saidas');
  const valor = container.querySelector('#m5-contador-valor');
  const desenho = montarCanvas(container.querySelector('#m5-contador-canvas'), circuito);

  function atualizar() {
    propagar(circuito);
    const valores = lerSaidas(circuito, contador.id);
    mostrarSaidas(leituras, ['Q0', 'Q1', 'Q2', 'Q3'], valores);
    valor.textContent = `Valor decimal: ${contador.estado.valor}`;
    desenho.renderizar();
  }

  const controlesClock = configurarControlesClock(
    container.querySelector('#m5-contador-bloco'),
    circuito,
    atualizar,
  );
  container.querySelector('#m5-contador-reset').addEventListener('click', () => {
    resetar(circuito);
    controlesClock.atualizar();
  });
  atualizar();
}

function montarRegistrador(container) {
  const circuito = criarCircuito();
  const entradas = [];
  const atualizarControles = [];
  const controles = container.querySelector('#m5-reg-controles');
  for (let indice = 0; indice < 4; indice++) {
    entradas.push(criarSwitch(circuito, `D${indice}`, { x: 30, y: 35 + indice * 72 }));
  }
  criarClock(circuito, { x: 180, y: 120 });
  const registrador = adicionar(circuito, 'REGISTER', {
    numEntradas: 4,
    numSaidas: 4,
    rotulo: 'Registrador 4 bits',
    posicao: { x: 320, y: 100 },
  });
  const leds = [];
  entradas.forEach((entrada, indice) => {
    ligar(circuito, entrada, 'out0', registrador, `in${indice}`);
    atualizarControles.push(criarBotaoSwitch(
      controles,
      circuito,
      entrada,
      `D${indice}`,
      atualizar,
    ));
  });
  for (let indice = 0; indice < 4; indice++) {
    const led = criarLed(circuito, `Q${indice}`, { x: 490, y: 35 + indice * 72 });
    ligar(circuito, registrador, `out${indice}`, led, 'in0');
    leds.push(led);
  }

  const leituras = container.querySelector('#m5-reg-saidas');
  const desenho = montarCanvas(container.querySelector('#m5-reg-canvas'), circuito);
  const ciclo = container.querySelector('#m5-reg-ciclos');

  function atualizar() {
    propagar(circuito);
    atualizarControles.forEach((atualizarControle) => atualizarControle());
    mostrarSaidas(leituras, ['Q0', 'Q1', 'Q2', 'Q3'], lerSaidas(circuito, registrador.id));
    ciclo.textContent = `Ciclos: ${circuito.componentes.find((item) => item.tipo === 'CLOCK').estado.ciclos}`;
    desenho.renderizar();
  }

  container.querySelector('#m5-reg-carregar').addEventListener('click', () => {
    const clock = circuito.componentes.find((componente) => componente.tipo === 'CLOCK');
    if (clock.estado.nivel === 1) {
      clock.estado.nivel = 0;
      clock.saidas[0].valor = 0;
    }
    tictac(circuito);
    atualizar();
  });
  atualizar();
}

export function inicializarM5(container) {
  container.innerHTML = `
    <section class="widget-bloco" id="m5-d-bloco" aria-labelledby="m5-d-titulo">
      <h3 id="m5-d-titulo">Flip-flop D com clock</h3>
      <div class="simulador-grade">
        <div class="simulador-painel">
          <div class="simulador-chaves" id="m5-d-controles"></div>
          <div class="simulador-acoes">
            <button class="btn btn--ghost" data-acao="pulso" type="button">Pulso de clock</button>
            <button class="btn btn--ghost" data-acao="automatico" type="button" aria-pressed="false">Clock automático</button>
            <button class="btn btn--ghost" id="m5-d-reset" type="button">Reset</button>
          </div>
          <p class="widget-resultado" data-ciclos="d" role="status" aria-live="polite">Ciclos: 0</p>
          <div class="simulador-leituras" id="m5-d-saidas" role="status" aria-live="polite" aria-label="Saídas do flip-flop D"></div>
          <p class="widget-explicacao">Q só muda quando o clock sobe (0→1). Mude D e observe: nada acontece até você pulsar o clock.</p>
        </div>
        <canvas class="simulador-canvas" id="m5-d-canvas" aria-label="Circuito com flip-flop D"></canvas>
      </div>
    </section>
    <section class="widget-bloco" id="m5-jk-bloco" aria-labelledby="m5-jk-titulo">
      <h3 id="m5-jk-titulo">Flip-flop JK</h3>
      <div class="simulador-grade">
        <div class="simulador-painel">
          <div class="simulador-chaves" id="m5-jk-controles"></div>
          <div class="simulador-acoes">
            <button class="btn btn--ghost" data-acao="pulso" type="button">Pulso de clock</button>
            <button class="btn btn--ghost" data-acao="automatico" type="button" aria-pressed="false">Clock automático</button>
          </div>
          <button class="btn btn--ghost" id="m5-jk-reset" type="button">Reset</button>
          <p class="widget-resultado" data-ciclos="jk" role="status" aria-live="polite">Ciclos: 0</p>
          <div class="simulador-leituras" id="m5-jk-saidas" role="status" aria-live="polite" aria-label="Saídas do flip-flop JK"></div>
          <div class="widget-tabela-scroll">
            <table class="widget-tabela-verdade" id="m5-jk-tabela">
              <thead><tr><th>J</th><th>K</th><th>Q seguinte</th></tr></thead>
              <tbody>
                <tr data-j="0" data-k="0"><td>0</td><td>0</td><td>Mantém</td></tr>
                <tr data-j="0" data-k="1"><td>0</td><td>1</td><td>0</td></tr>
                <tr data-j="1" data-k="0"><td>1</td><td>0</td><td>1</td></tr>
                <tr data-j="1" data-k="1"><td>1</td><td>1</td><td>Inverte</td></tr>
              </tbody>
            </table>
          </div>
          <p class="widget-explicacao">A linha destacada mostra o comportamento na próxima borda de subida.</p>
        </div>
        <canvas class="simulador-canvas" id="m5-jk-canvas" aria-label="Circuito com flip-flop JK"></canvas>
      </div>
    </section>
    <section class="widget-bloco" id="m5-contador-bloco" aria-labelledby="m5-contador-titulo">
      <h3 id="m5-contador-titulo">Contador de 4 bits</h3>
      <div class="simulador-grade">
        <div class="simulador-painel">
          <div class="simulador-acoes">
            <button class="btn btn--ghost" data-acao="pulso" type="button">Pulso</button>
            <button class="btn btn--ghost" data-acao="automatico" type="button" aria-pressed="false">Automático</button>
            <button class="btn btn--ghost" id="m5-contador-reset" type="button">Reset</button>
          </div>
          <div class="simulador-leituras" id="m5-contador-saidas" role="status" aria-live="polite" aria-label="Bits do contador"></div>
          <p class="widget-resultado" id="m5-contador-valor" role="status" aria-live="polite">Valor decimal: 0</p>
          <p class="widget-resultado" data-ciclos="contador" role="status" aria-live="polite">Ciclos: 0</p>
          <p class="widget-explicacao">Cada borda de subida incrementa o contador. Após 15, volta a 0.</p>
        </div>
        <canvas class="simulador-canvas" id="m5-contador-canvas" aria-label="Circuito contador de quatro bits"></canvas>
      </div>
    </section>
    <section class="widget-bloco" aria-labelledby="m5-reg-titulo">
      <h3 id="m5-reg-titulo">Registrador de 4 bits</h3>
      <div class="simulador-grade">
        <div class="simulador-painel">
          <div class="simulador-chaves" id="m5-reg-controles"></div>
          <button class="btn btn--primary" id="m5-reg-carregar" type="button">Carregar</button>
          <div class="simulador-leituras" id="m5-reg-saidas" role="status" aria-live="polite" aria-label="Saídas do registrador"></div>
          <p class="widget-resultado" id="m5-reg-ciclos" role="status" aria-live="polite">Ciclos: 0</p>
          <p class="widget-explicacao">O registrador só copia os dados quando o clock sobe. Mude os switches e veja: a saída não muda até você carregar.</p>
        </div>
        <canvas class="simulador-canvas" id="m5-reg-canvas" aria-label="Circuito registrador de quatro bits"></canvas>
      </div>
    </section>
  `;

  montarFlipFlopD(container);
  montarFlipFlopJk(container);
  montarContador(container);
  montarRegistrador(container);
  configurarExercicios(container);
}
