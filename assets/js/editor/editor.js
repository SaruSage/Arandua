import {
  criarCircuito,
  criarComponente,
  adicionarComponente as adicionarAoCircuito,
  removerComponente as removerDoCircuito,
  propagar,
} from '../core/circuit.js';
import {
  criarCanvas,
  LARGURA_COMPONENTE,
  ALTURA_COMPONENTE,
} from './canvas.js';
import { criarPaleta } from './palette.js';
import { configurarInteracao } from './interaction.js';

const TAMANHO_GRADE = 20;

function ajustarAGrade(valor) {
  return Math.round(valor / TAMANHO_GRADE) * TAMANHO_GRADE;
}

export function inicializarEditor({ canvas: elementoCanvas, paleta }) {
  const circuitoAtual = criarCircuito();
  const superficie = criarCanvas(elementoCanvas);
  let idSelecionado = null;

  function renderizar() {
    superficie.render(circuitoAtual, idSelecionado);
  }

  function selecionar(id) {
    idSelecionado = circuitoAtual.componentes.some((componente) => componente.id === id)
      ? id
      : null;
    renderizar();
  }

  function componenteEm(x, y) {
    for (let indice = circuitoAtual.componentes.length - 1; indice >= 0; indice--) {
      const componente = circuitoAtual.componentes[indice];
      if (
        x >= componente.posicao.x
        && x <= componente.posicao.x + LARGURA_COMPONENTE
        && y >= componente.posicao.y
        && y <= componente.posicao.y + ALTURA_COMPONENTE
      ) {
        return componente;
      }
    }

    return null;
  }

  function adicionarComponente(item, posicao) {
    const componente = criarComponente(item.tipo, {
      numEntradas: item.numEntradas,
      numSaidas: item.numSaidas,
      rotulo: item.rotulo,
      posicao: {
        x: ajustarAGrade(posicao.x),
        y: ajustarAGrade(posicao.y),
      },
    });
    adicionarAoCircuito(circuitoAtual, componente);
    propagar(circuitoAtual);
    idSelecionado = componente.id;
    renderizar();
    return componente;
  }

  function moverComponente(id, x, y) {
    const componente = circuitoAtual.componentes.find((item) => item.id === id);
    if (!componente) return;
    componente.posicao.x = ajustarAGrade(x);
    componente.posicao.y = ajustarAGrade(y);
    renderizar();
  }

  function removerSelecionado() {
    if (idSelecionado === null) return;
    removerDoCircuito(circuitoAtual, idSelecionado);
    idSelecionado = null;
    propagar(circuitoAtual);
    renderizar();
  }

  const editor = {
    get circuito() {
      return circuitoAtual;
    },
    get selecionadoId() {
      return idSelecionado;
    },
    renderizar,
    selecionar,
    componenteEm,
    adicionarComponente,
    moverComponente,
    removerSelecionado,
  };

  criarPaleta(paleta, (item) => {
    const centro = superficie.telaParaMundo(
      elementoCanvas.clientWidth / 2,
      elementoCanvas.clientHeight / 2,
    );
    adicionarComponente(item, {
      x: centro.x - LARGURA_COMPONENTE / 2,
      y: centro.y - ALTURA_COMPONENTE / 2,
    });
  });

  configurarInteracao(superficie, editor);

  function redimensionar() {
    superficie.redimensionar();
    renderizar();
  }

  redimensionar();
  window.addEventListener('resize', redimensionar);

  return editor;
}
