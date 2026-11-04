import {
  criarCircuito,
  criarComponente,
  adicionarComponente as adicionarAoCircuito,
  removerComponente as removerDoCircuito,
  conectar,
  desconectar,
  propagar,
} from '../core/circuit.js';
import { serializar, desserializar } from '../core/serializer.js';
import {
  criarCanvas,
  LARGURA_COMPONENTE,
  ALTURA_COMPONENTE,
} from './canvas.js';
import { criarPaleta } from './palette.js';
import { configurarInteracao } from './interaction.js';
import { configurarFios } from './wiring.js';
import { criarHistorico } from './history.js';

const TAMANHO_GRADE = 20;

function ajustarAGrade(valor) {
  return Math.round(valor / TAMANHO_GRADE) * TAMANHO_GRADE;
}

export function inicializarEditor({ canvas: elementoCanvas, paleta }) {
  const circuitoAtual = criarCircuito();
  const superficie = criarCanvas(elementoCanvas);
  const historico = criarHistorico();
  let idSelecionado = null;
  let idFioSelecionado = null;
  let fios = null;
  let aoSelecionar = null;
  let painelPropriedades = null;

  function renderizar() {
    superficie.render(circuitoAtual, idSelecionado, idFioSelecionado, fios?.fioFantasma);
    if (painelPropriedades) painelPropriedades.atualizar();
  }

  function notificarSelecao() {
    aoSelecionar?.(
      circuitoAtual.componentes.find((componente) => componente.id === idSelecionado) || null,
    );
  }

  function registrarHistorico() {
    historico.registrar(serializar(circuitoAtual));
  }

  function selecionar(id) {
    const novoId = circuitoAtual.componentes.some((componente) => componente.id === id)
      ? id
      : null;
    const mudou = idSelecionado !== novoId || idFioSelecionado !== null;
    idSelecionado = novoId;
    idFioSelecionado = null;
    if (mudou) notificarSelecao();
    renderizar();
  }

  function selecionarFio(id) {
    const novoId = circuitoAtual.fios.some((fio) => fio.id === id) ? id : null;
    const mudou = idFioSelecionado !== novoId || idSelecionado !== null;
    idFioSelecionado = novoId;
    idSelecionado = null;
    if (mudou) notificarSelecao();
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
    idFioSelecionado = null;
    registrarHistorico();
    notificarSelecao();
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
    idFioSelecionado = null;
    propagar(circuitoAtual);
    registrarHistorico();
    notificarSelecao();
    renderizar();
  }

  function conectarPinos(origem, destino) {
    const fio = conectar(circuitoAtual, origem, destino);
    if (!fio) return null;
    propagar(circuitoAtual);
    registrarHistorico();
    renderizar();
    return fio;
  }

  function desconectarFio(fioId) {
    if (!circuitoAtual.fios.some((fio) => fio.id === fioId)) return;
    desconectar(circuitoAtual, fioId);
    if (idFioSelecionado === fioId) idFioSelecionado = null;
    propagar(circuitoAtual);
    registrarHistorico();
    renderizar();
  }

  function aplicarSnapshot(snapshot) {
    if (!snapshot) return;
    const idsAnteriores = new Set(circuitoAtual.componentes.map((componente) => componente.id));
    const restaurado = desserializar(snapshot);
    circuitoAtual.componentes = restaurado.componentes;
    circuitoAtual.fios = restaurado.fios;
    circuitoAtual.componentes
      .filter((componente) => componente.tipo === 'CLOCK')
      .forEach((componente) => {
        componente.estado.rodando = false;
      });
    propagar(circuitoAtual);
    if (!circuitoAtual.componentes.some((componente) => componente.id === idSelecionado)) {
      idSelecionado = null;
    }
    if (idSelecionado === null) {
      for (let indice = circuitoAtual.componentes.length - 1; indice >= 0; indice--) {
        const componente = circuitoAtual.componentes[indice];
        if (!idsAnteriores.has(componente.id)) {
          idSelecionado = componente.id;
          break;
        }
      }
    }
    if (!circuitoAtual.fios.some((fio) => fio.id === idFioSelecionado)) {
      idFioSelecionado = null;
    }
    notificarSelecao();
    renderizar();
  }

  function desfazer() {
    aplicarSnapshot(historico.desfazer());
  }

  function refazer() {
    aplicarSnapshot(historico.refazer());
  }

  historico.registrar(serializar(circuitoAtual));

  const editor = {
    get circuito() {
      return circuitoAtual;
    },
    get selecionadoId() {
      return idSelecionado;
    },
    get fioSelecionadoId() {
      return idFioSelecionado;
    },
    get historico() {
      return historico;
    },
    get aoSelecionar() {
      return aoSelecionar;
    },
    set aoSelecionar(callback) {
      aoSelecionar = callback;
      notificarSelecao();
    },
    renderizar,
    selecionar,
    selecionarFio,
    componenteEm,
    adicionarComponente,
    moverComponente,
    removerSelecionado,
    conectarPinos,
    desconectarFio,
    desfazer,
    refazer,
    registrarHistorico,
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

  fios = configurarFios(superficie, editor);
  configurarInteracao(superficie, editor, fios);
  editor.configurarPainel = (painel) => {
    painelPropriedades = painel;
  };

  function redimensionar() {
    superficie.redimensionar();
    renderizar();
  }

  redimensionar();
  window.addEventListener('resize', redimensionar);

  return editor;
}
