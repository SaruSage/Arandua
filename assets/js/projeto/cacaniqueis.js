import {
  criarCircuito,
  criarComponente,
  adicionarComponente,
  conectar,
  propagar,
  acionarSwitch,
} from '../core/circuit.js';
import { desenharDiagramaBlocos } from './diagrama.js';

const SEGMENTOS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const EXPLICACOES_BLOCOS = {
  'Botões': 'ALAVANCA inicia uma rodada, APOSTA representa a aposta da rodada e RESET reinicia a máquina. Entradas digitais foram estudadas no Módulo 1.',
  'Máquina de Estados': 'Dois flip-flops D guardam os estados IDLE, GIRANDO e RESULTADO. A memória de estados e os flip-flops foram estudados no Módulo 5.',
  'Contador 1': 'Este contador de 4 bits avança a primeira roleta durante a rodada. Contadores foram estudados no Módulo 5.',
  'Contador 2': 'Este contador de 4 bits avança a segunda roleta em um ritmo diferente. Contadores foram estudados no Módulo 5.',
  'Contador 3': 'Este contador de 4 bits avança a terceira roleta em um ritmo diferente. Contadores foram estudados no Módulo 5.',
  'Comparador': 'Dois comparadores de 4 bits verificam se os símbolos coincidem. Comparadores e lógica combinacional foram estudados no Módulo 4.',
  'Créditos': 'Um contador de 8 bits armazena os créditos ganhos ou gastos. Contadores e memória sequencial foram estudados no Módulo 5.',
  'Display 1': 'Um decodificador BCD transforma o valor da primeira roleta nos segmentos do display. Decodificadores foram estudados no Módulo 4.',
  'Display 2': 'Um decodificador BCD transforma o valor da segunda roleta nos segmentos do display. Decodificadores foram estudados no Módulo 4.',
  'Display 3': 'Um decodificador BCD transforma o valor da terceira roleta nos segmentos do display. Decodificadores foram estudados no Módulo 4.',
};

function criarComponenteNoCircuito(circuito, tipo, opcoes) {
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
  if (!fio) {
    throw new Error(`Não foi possível conectar ${origem.rotulo} a ${destino.rotulo}.`);
  }
}

function criarDisplay(container, indice) {
  const figura = document.createElement('figure');
  figura.className = 'cacaniqueis-display-figura';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cacaniqueis-display');
  svg.setAttribute('viewBox', '0 0 120 160');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Símbolo ${indice + 1}: 0`);
  svg.innerHTML = `
    <rect class="display-fundo" x="4" y="4" width="112" height="152" rx="12"></rect>
    <rect data-segmento="a" x="30" y="16" width="60" height="10" rx="4"></rect>
    <rect data-segmento="b" x="90" y="26" width="10" height="48" rx="4"></rect>
    <rect data-segmento="c" x="90" y="86" width="10" height="48" rx="4"></rect>
    <rect data-segmento="d" x="30" y="134" width="60" height="10" rx="4"></rect>
    <rect data-segmento="e" x="20" y="86" width="10" height="48" rx="4"></rect>
    <rect data-segmento="f" x="20" y="26" width="10" height="48" rx="4"></rect>
    <rect data-segmento="g" x="30" y="75" width="60" height="10" rx="4"></rect>
  `;
  const legenda = document.createElement('figcaption');
  legenda.textContent = `Símbolo ${indice + 1}`;
  figura.append(svg, legenda);
  container.append(figura);
  return svg;
}

function definirValorContador(componente, valor) {
  componente.estado.valor = valor;
  componente.saidas.forEach((pino, indice) => {
    pino.valor = (valor >> indice) & 1;
  });
}

function definirEstado(estado, flipFlops) {
  const codigos = {
    IDLE: [0, 0],
    GIRANDO: [1, 0],
    RESULTADO: [0, 1],
  };
  const [bitMenosSignificativo, bitMaisSignificativo] = codigos[estado];
  [bitMenosSignificativo, bitMaisSignificativo].forEach((valor, indice) => {
    flipFlops[indice].estado.q = valor;
    flipFlops[indice].saidas[0].valor = valor;
    flipFlops[indice].saidas[1].valor = valor === 1 ? 0 : 1;
  });
}

function montarCircuito() {
  const circuito = criarCircuito();
  const roletas = [];
  const decodificadores = [];
  const controles = {};

  controles.ALAVANCA = criarComponenteNoCircuito(circuito, 'SWITCH', {
    numEntradas: 0,
    numSaidas: 1,
    rotulo: 'ALAVANCA',
    posicao: { x: 0, y: 0 },
  });
  controles.APOSTA = criarComponenteNoCircuito(circuito, 'SWITCH', {
    numEntradas: 0,
    numSaidas: 1,
    rotulo: 'APOSTA',
    posicao: { x: 0, y: 80 },
  });
  controles.RESET = criarComponenteNoCircuito(circuito, 'SWITCH', {
    numEntradas: 0,
    numSaidas: 1,
    rotulo: 'RESET',
    posicao: { x: 0, y: 160 },
  });

  for (let indice = 0; indice < 3; indice++) {
    const contador = criarComponenteNoCircuito(circuito, 'COUNTER', {
      numEntradas: 0,
      numSaidas: 4,
      rotulo: `Contador ${indice + 1}`,
      posicao: { x: 200, y: indice * 120 },
    });
    const display = criarComponenteNoCircuito(circuito, 'DISPLAY_7SEG', {
      numEntradas: 4,
      numSaidas: 7,
      rotulo: `Decodificador BCD ${indice + 1}`,
      posicao: { x: 390, y: indice * 120 },
    });
    for (let bit = 0; bit < 4; bit++) {
      ligar(circuito, contador, `out${3 - bit}`, display, `in${bit}`);
    }
    roletas.push(contador);
    decodificadores.push(display);
  }

  const comparador01 = criarComponenteNoCircuito(circuito, 'COMPARADOR_4BITS', {
    numEntradas: 8,
    numSaidas: 3,
    rotulo: 'Comparador 1–2',
    posicao: { x: 590, y: 80 },
  });
  const comparador02 = criarComponenteNoCircuito(circuito, 'COMPARADOR_4BITS', {
    numEntradas: 8,
    numSaidas: 3,
    rotulo: 'Comparador 1–3',
    posicao: { x: 590, y: 270 },
  });
  for (let bit = 0; bit < 4; bit++) {
    ligar(circuito, roletas[0], `out${bit}`, comparador01, `in${bit}`);
    ligar(circuito, roletas[1], `out${bit}`, comparador01, `in${bit + 4}`);
    ligar(circuito, roletas[0], `out${bit}`, comparador02, `in${bit}`);
    ligar(circuito, roletas[2], `out${bit}`, comparador02, `in${bit + 4}`);
  }

  const testePar = criarComponenteNoCircuito(circuito, 'OR', {
    numEntradas: 2,
    numSaidas: 1,
    rotulo: 'Há um par?',
    posicao: { x: 790, y: 125 },
  });
  const testeJackpot = criarComponenteNoCircuito(circuito, 'AND', {
    numEntradas: 2,
    numSaidas: 1,
    rotulo: 'Três iguais?',
    posicao: { x: 790, y: 245 },
  });
  ligar(circuito, comparador01, 'out1', testePar, 'in0');
  ligar(circuito, comparador02, 'out1', testePar, 'in1');
  ligar(circuito, comparador01, 'out1', testeJackpot, 'in0');
  ligar(circuito, comparador02, 'out1', testeJackpot, 'in1');

  const creditos = criarComponenteNoCircuito(circuito, 'COUNTER', {
    numEntradas: 0,
    numSaidas: 8,
    rotulo: 'Créditos',
    posicao: { x: 940, y: 180 },
  });
  const flipFlopsEstado = [
    criarComponenteNoCircuito(circuito, 'DFF', {
      numEntradas: 1,
      numSaidas: 2,
      rotulo: 'Estado 0',
      posicao: { x: 940, y: 0 },
    }),
    criarComponenteNoCircuito(circuito, 'DFF', {
      numEntradas: 1,
      numSaidas: 2,
      rotulo: 'Estado 1',
      posicao: { x: 1080, y: 0 },
    }),
  ];
  propagar(circuito);
  definirEstado('IDLE', flipFlopsEstado);

  return {
    circuito,
    roletas,
    decodificadores,
    comparador01,
    comparador02,
    testePar,
    testeJackpot,
    creditos,
    flipFlopsEstado,
    controles,
  };
}

function criarMensagemDiagrama(svg, painel) {
  svg.addEventListener('bloco-selecionado', (evento) => {
    const nome = evento.detail.nome;
    painel.textContent = EXPLICACOES_BLOCOS[nome] || 'Bloco do circuito do caça-níqueis.';
    svg.querySelectorAll('.cacaniqueis-bloco').forEach((bloco) => {
      const ativo = bloco.dataset.bloco === nome;
      bloco.classList.toggle('ativo', ativo);
      bloco.setAttribute('aria-pressed', String(ativo));
    });
  });
}

export function inicializarCacaniqueis(container) {
  const circuitoMontado = montarCircuito();
  const circuito = circuitoMontado.circuito;
  acionarSwitch(circuito, circuitoMontado.controles.APOSTA.id, 1);
  const displays = [];
  const roletasParadas = [true, true, true];
  let creditosAtuais = 10;
  let estadoAtual = 'IDLE';
  let temporizadorGiro = null;
  let temporizadorParada = null;
  let temporizadorResultado = null;
  let temporizadoresPisca = [];
  let passo = 0;
  let executando = false;
  let apostaArmada = true;

  container.innerHTML = `
    <section class="cacaniqueis-maquina" aria-labelledby="cacaniqueis-titulo">
      <h3 id="cacaniqueis-titulo">Caça-Níqueis Arandua</h3>
      <div class="cacaniqueis-displays" id="cacaniqueis-displays" aria-label="Três roletas do caça-níqueis"></div>
      <p class="cacaniqueis-creditos" role="status" aria-live="polite">Créditos: <span id="cacaniqueis-creditos">10</span></p>
      <div class="cacaniqueis-mensagem" id="cacaniqueis-mensagem" role="status" aria-live="polite">Pronto para jogar!</div>
      <div class="cacaniqueis-acoes">
        <button class="cacaniqueis-botao-girar" id="cacaniqueis-girar" type="button">GIRAR</button>
        <button class="btn btn--ghost cacaniqueis-aposta-botao" id="cacaniqueis-apostar" type="button" aria-pressed="true">APOSTA: armada</button>
        <button class="btn btn--ghost" id="cacaniqueis-reset" type="button">RESET</button>
      </div>
      <p class="cacaniqueis-aposta" id="cacaniqueis-aposta">Aposta: 1 crédito</p>
      <div class="cacaniqueis-game-over" id="cacaniqueis-game-over" hidden>
        <p>GAME OVER</p>
        <span>Pressione RESET para começar outra vez.</span>
      </div>
      <details class="cacaniqueis-circuito">
        <summary>Ver circuito</summary>
        <div class="cacaniqueis-diagrama-area">
          <svg class="cacaniqueis-diagrama" id="cacaniqueis-diagrama" role="group" aria-label="Diagrama de blocos do caça-níqueis" data-painel="cacaniqueis-diagrama-info"></svg>
        </div>
        <p class="cacaniqueis-diagrama-info" id="cacaniqueis-diagrama-info" role="status" aria-live="polite">Clique em um bloco para ver sua função e o módulo relacionado.</p>
      </details>
    </section>
  `;

  const faixaDisplays = container.querySelector('#cacaniqueis-displays');
  for (let indice = 0; indice < 3; indice++) {
    displays.push(criarDisplay(faixaDisplays, indice));
  }
  const creditosVisiveis = container.querySelector('#cacaniqueis-creditos');
  const mensagem = container.querySelector('#cacaniqueis-mensagem');
  const botaoGirar = container.querySelector('#cacaniqueis-girar');
  const botaoAposta = container.querySelector('#cacaniqueis-apostar');
  const botaoReset = container.querySelector('#cacaniqueis-reset');
  const gameOver = container.querySelector('#cacaniqueis-game-over');

  function atualizarCircuito() {
    propagar(circuito);
    displays.forEach((svg, indice) => {
      const valor = circuitoMontado.roletas[indice].estado.valor;
      const segmentos = circuitoMontado.decodificadores[indice].saidas;
      svg.setAttribute('aria-label', `Símbolo ${indice + 1}: ${valor}`);
      SEGMENTOS.forEach((segmento, indiceSegmento) => {
        svg.querySelector(`[data-segmento="${segmento}"]`)
          ?.classList.toggle('aceso', segmentos[indiceSegmento].valor === 1);
      });
    });
    circuitoMontado.creditos.estado.valor = creditosAtuais;
    circuitoMontado.creditos.saidas.forEach((pino, indice) => {
      pino.valor = (creditosAtuais >> indice) & 1;
    });
    creditosVisiveis.textContent = String(creditosAtuais);
    gameOver.hidden = creditosAtuais > 0;
    botaoGirar.disabled = creditosAtuais <= 0 || executando || !apostaArmada;
    botaoAposta.disabled = executando;
    botaoAposta.textContent = apostaArmada ? 'APOSTA: armada' : 'APOSTA: pausada';
    botaoAposta.setAttribute('aria-pressed', String(apostaArmada));
  }

  function mostrarMensagem(texto) {
    mensagem.classList.remove('animar');
    requestAnimationFrame(() => {
      mensagem.textContent = texto;
      mensagem.classList.add('animar');
    });
  }

  function piscar(indice, classe, vezes) {
    const display = displays[indice];
    let piscadas = 0;
    const alternar = () => {
      display.classList.toggle(classe);
      piscadas++;
      if (piscadas < vezes * 2) {
        temporizadoresPisca.push(window.setTimeout(alternar, 220));
      } else {
        display.classList.remove(classe);
      }
    };
    alternar();
  }

  function pararRelota(indice) {
    roletasParadas[indice] = true;
    if (indice < 2) {
      temporizadorParada = window.setTimeout(() => pararRelota(indice + 1), 300);
      return;
    }
    if (temporizadorGiro !== null) window.clearInterval(temporizadorGiro);
    temporizadorGiro = null;
    finalizarRodada();
  }

  function finalizarRodada() {
    estadoAtual = 'RESULTADO';
    definirEstado(estadoAtual, circuitoMontado.flipFlopsEstado);

    propagar(circuito);
    const igualdade01 = circuitoMontado.comparador01.saidas[1].valor === 1;
    const igualdade02 = circuitoMontado.comparador02.saidas[1].valor === 1;
    const valores = circuitoMontado.roletas.map((roleta) => roleta.estado.valor);
    const haPar = circuitoMontado.testePar.saidas[0].valor === 1
      || valores[1] === valores[2];
    const jackpot = circuitoMontado.testeJackpot.saidas[0].valor === 1;

    if (jackpot) {
      creditosAtuais = Math.min(255, creditosAtuais + 50);
      mostrarMensagem('Jackpot! +50 créditos');
      displays.forEach((_, indice) => piscar(indice, 'cacaniqueis-display--jackpot', 3));
    } else if (haPar) {
      creditosAtuais = Math.min(255, creditosAtuais + 5);
      mostrarMensagem('Boa! Você ganhou 5 créditos');
      const indicesIguais = igualdade01 ? [0, 1] : igualdade02 ? [0, 2] : [1, 2];
      indicesIguais.forEach((indice) => piscar(indice, 'cacaniqueis-display--par', 3));
    } else {
      creditosAtuais = Math.max(0, creditosAtuais - 1);
      mostrarMensagem(creditosAtuais === 0 ? 'Tente de novo — seus créditos acabaram.' : 'Tente de novo');
    }

    atualizarCircuito();
    temporizadorResultado = window.setTimeout(() => {
      estadoAtual = 'IDLE';
      definirEstado(estadoAtual, circuitoMontado.flipFlopsEstado);
      executando = false;
      circuitoMontado.controles.ALAVANCA.estado.ativo = 0;
      circuitoMontado.controles.APOSTA.estado.ativo = apostaArmada ? 1 : 0;
      roletas.forEach((_, indice) => { roletasParadas[indice] = true; });
      mostrarMensagem(creditosAtuais > 0 ? 'Pronto para jogar!' : 'GAME OVER — pressione RESET.');
      atualizarCircuito();
    }, 2000);
  }

  function iniciarRodada() {
    if (executando || estadoAtual !== 'IDLE' || creditosAtuais <= 0 || !apostaArmada) return;
    executando = true;
    passo = 0;
    estadoAtual = 'GIRANDO';
    definirEstado(estadoAtual, circuitoMontado.flipFlopsEstado);
    acionarSwitch(circuito, circuitoMontado.controles.ALAVANCA.id, 1);
    acionarSwitch(circuito, circuitoMontado.controles.APOSTA.id, 1);
    roletas.forEach((roleta, indice) => {
      definirValorContador(roleta, Math.floor(Math.random() * 10));
      roletasParadas[indice] = false;
      displays[indice].classList.remove('cacaniqueis-display--jackpot', 'cacaniqueis-display--par');
    });
    mostrarMensagem('Girando...');
    atualizarCircuito();

    temporizadorGiro = window.setInterval(() => {
      passo++;
      roletas.forEach((roleta, indice) => {
        const frequencia = indice + 1;
        if (!roletasParadas[indice] && (passo + indice) % frequencia === 0) {
          definirValorContador(roleta, (roleta.estado.valor + 1) % 10);
        }
      });
      atualizarCircuito();
      if (passo === 36) {
        pararRelota(0);
      }
    }, 50);
  }

  function reiniciar() {
    if (temporizadorGiro !== null) window.clearInterval(temporizadorGiro);
    if (temporizadorParada !== null) window.clearTimeout(temporizadorParada);
    if (temporizadorResultado !== null) window.clearTimeout(temporizadorResultado);
    temporizadoresPisca.forEach((temporizador) => window.clearTimeout(temporizador));
    temporizadoresPisca = [];
    temporizadorGiro = null;
    temporizadorParada = null;
    temporizadorResultado = null;
    executando = false;
    estadoAtual = 'IDLE';
    passo = 0;
    creditosAtuais = 10;
    apostaArmada = true;
    roletas.forEach((roleta, indice) => {
      definirValorContador(roleta, 0);
      roletasParadas[indice] = true;
      displays[indice].classList.remove('cacaniqueis-display--jackpot', 'cacaniqueis-display--par');
    });
    Object.values(circuitoMontado.controles).forEach((componente) => {
      acionarSwitch(circuito, componente.id, 0);
    });
    acionarSwitch(circuito, circuitoMontado.controles.APOSTA.id, 1);
    definirEstado(estadoAtual, circuitoMontado.flipFlopsEstado);
    mostrarMensagem('Pronto para jogar!');
    atualizarCircuito();
  }

  const roletas = circuitoMontado.roletas;
  botaoGirar.addEventListener('click', () => {
    acionarSwitch(circuito, circuitoMontado.controles.ALAVANCA.id, 1);
    acionarSwitch(circuito, circuitoMontado.controles.APOSTA.id, 1);
    iniciarRodada();
  });
  botaoAposta.addEventListener('click', () => {
    if (executando) return;
    apostaArmada = !apostaArmada;
    acionarSwitch(circuito, circuitoMontado.controles.APOSTA.id, apostaArmada ? 1 : 0);
    atualizarCircuito();
  });
  botaoReset.addEventListener('click', () => {
    acionarSwitch(circuito, circuitoMontado.controles.RESET.id, 1);
    reiniciar();
  });
  document.querySelectorAll('.cacaniqueis-diagrama').forEach((diagrama) => {
    desenharDiagramaBlocos(diagrama);
    criarMensagemDiagrama(
      diagrama,
      document.getElementById(diagrama.dataset.painel),
    );
  });
  atualizarCircuito();
  window.addEventListener('pagehide', () => {
    if (temporizadorGiro !== null) window.clearInterval(temporizadorGiro);
    if (temporizadorParada !== null) window.clearTimeout(temporizadorParada);
    if (temporizadorResultado !== null) window.clearTimeout(temporizadorResultado);
    temporizadoresPisca.forEach((temporizador) => window.clearTimeout(temporizador));
  }, { once: true });
}
