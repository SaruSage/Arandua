const RAIO_SELECAO_FIO = 8;
const LARGURA_COMPONENTE = 80;
const ALTURA_COMPONENTE = 60;

function buscarPino(circuito, referencia, direcao) {
  const componente = circuito.componentes.find((item) => item.id === referencia.componente);
  if (!componente) return null;
  const pinos = direcao === 'entrada' ? componente.entradas : componente.saidas;
  const pino = pinos.find((item) => item.id === referencia.pino);
  return pino ? { componente, pino } : null;
}

function posicaoPino(componente, pino, direcao) {
  const pinos = direcao === 'entrada' ? componente.entradas : componente.saidas;
  const indice = pinos.findIndex((item) => item.id === pino.id);
  if (indice < 0) return null;
  return {
    x: componente.posicao.x + (direcao === 'entrada' ? 0 : LARGURA_COMPONENTE),
    y: componente.posicao.y + ((indice + 1) * ALTURA_COMPONENTE) / (pinos.length + 1),
  };
}

function pontoDoFio(circuito, fio) {
  const origem = buscarPino(circuito, fio.origem, 'saida');
  const destino = buscarPino(circuito, fio.destino, 'entrada');
  if (!origem || !destino) return null;

  const inicio = posicaoPino(origem.componente, origem.pino, 'saida');
  const fim = posicaoPino(destino.componente, destino.pino, 'entrada');
  if (!inicio || !fim) return null;
  return { inicio, fim, valor: origem.pino.valor };
}

function distanciaAoSegmento(ponto, inicio, fim) {
  const deltaX = fim.x - inicio.x;
  const deltaY = fim.y - inicio.y;
  const comprimento = deltaX * deltaX + deltaY * deltaY;
  const proporcao = comprimento === 0
    ? 0
    : Math.max(0, Math.min(1, ((ponto.x - inicio.x) * deltaX + (ponto.y - inicio.y) * deltaY) / comprimento));
  const x = inicio.x + proporcao * deltaX;
  const y = inicio.y + proporcao * deltaY;
  return Math.hypot(ponto.x - x, ponto.y - y);
}

function controlesDaCurva(inicio, fim) {
  const distancia = Math.max(40, Math.abs(fim.x - inicio.x) * 0.5);
  return {
    controle1: { x: inicio.x + distancia, y: inicio.y },
    controle2: { x: fim.x - distancia, y: fim.y },
  };
}

function pontoNaCurva(inicio, controles, fim, t) {
  const inverso = 1 - t;
  return {
    x: inverso ** 3 * inicio.x
      + 3 * inverso ** 2 * t * controles.controle1.x
      + 3 * inverso * t ** 2 * controles.controle2.x
      + t ** 3 * fim.x,
    y: inverso ** 3 * inicio.y
      + 3 * inverso ** 2 * t * controles.controle1.y
      + 3 * inverso * t ** 2 * controles.controle2.y
      + t ** 3 * fim.y,
  };
}

function corDoValor(valor) {
  if (valor === 1) return '#00d4a0';
  if (valor === 0) return '#4f8cff';
  return '#9aa0ac';
}

export function desenharFios(ctx, circuito, canvas, fioSelecionadoId) {
  circuito.fios.forEach((fio) => {
    const pontos = pontoDoFio(circuito, fio);
    if (!pontos) return;

    const controles = controlesDaCurva(pontos.inicio, pontos.fim);
    ctx.beginPath();
    ctx.moveTo(pontos.inicio.x, pontos.inicio.y);
    ctx.bezierCurveTo(
      controles.controle1.x,
      controles.controle1.y,
      controles.controle2.x,
      controles.controle2.y,
      pontos.fim.x,
      pontos.fim.y,
    );
    ctx.strokeStyle = fio.id === fioSelecionadoId ? '#ff6b6b' : corDoValor(pontos.valor);
    ctx.lineWidth = fio.id === fioSelecionadoId ? 3 : 2;
    ctx.stroke();
  });
}

export function desenharFioFantasma(ctx, canvas, origem, cursorAtual) {
  if (!origem || !cursorAtual) return;
  const pinoOrigem = buscarPino(canvas.circuito, origem, 'saida');
  if (!pinoOrigem) return;
  const inicio = posicaoPino(pinoOrigem.componente, pinoOrigem.pino, 'saida');
  const controles = controlesDaCurva(inicio, cursorAtual);

  ctx.beginPath();
  ctx.moveTo(inicio.x, inicio.y);
  ctx.bezierCurveTo(
    controles.controle1.x,
    controles.controle1.y,
    controles.controle2.x,
    controles.controle2.y,
    cursorAtual.x,
    cursorAtual.y,
  );
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#9aa0ac';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
}

export function configurarFios(canvas, editor) {
  let origemAtiva = null;
  let cursorAtual = null;

  function iniciar(pino) {
    if (pino.direcao !== 'saida') return true;
    origemAtiva = {
      componente: pino.componente.id,
      pino: pino.pino.id,
    };
    editor.selecionar(null);
    editor.selecionarFio(null);
    editor.renderizar();
    return true;
  }

  function atualizar(cursor, pino) {
    const novoHover = pino
      ? {
        componenteId: pino.componente.id,
        pinoId: pino.pino.id,
        direcao: pino.direcao,
      }
      : null;
    const hoverMudou = JSON.stringify(canvas.pinoSobCursor) !== JSON.stringify(novoHover);
    canvas.pinoSobCursor = novoHover;

    if (origemAtiva) cursorAtual = cursor;
    if (hoverMudou || origemAtiva) editor.renderizar();
  }

  function finalizar(pino) {
    if (!origemAtiva) return false;
    if (
      pino?.direcao === 'entrada'
      && pino.componente.id !== origemAtiva.componente
    ) {
      editor.conectarPinos(origemAtiva, {
        componente: pino.componente.id,
        pino: pino.pino.id,
      });
    }
    origemAtiva = null;
    cursorAtual = null;
    editor.renderizar();
    return true;
  }

  function cancelar() {
    if (!origemAtiva) return false;
    origemAtiva = null;
    cursorAtual = null;
    editor.renderizar();
    return true;
  }

  function selecionarFioEm(x, y) {
    const ponto = { x, y };
    let fioMaisProximo = null;
    let menorDistancia = RAIO_SELECAO_FIO / canvas.view.zoom;

    editor.circuito.fios.forEach((fio) => {
      const pontos = pontoDoFio(editor.circuito, fio);
      if (!pontos) return;
      const controles = controlesDaCurva(pontos.inicio, pontos.fim);
      let anterior = pontos.inicio;

      for (let indice = 1; indice <= 24; indice++) {
        const atual = pontoNaCurva(pontos.inicio, controles, pontos.fim, indice / 24);
        const distancia = distanciaAoSegmento(ponto, anterior, atual);
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          fioMaisProximo = fio;
        }
        anterior = atual;
      }
    });

    if (!fioMaisProximo) return false;
    editor.selecionarFio(fioMaisProximo.id);
    return true;
  }

  return {
    iniciar,
    atualizar,
    finalizar,
    cancelar,
    selecionarFioEm,
    get fioFantasma() {
      return origemAtiva ? { origem: origemAtiva, cursorAtual } : null;
    },
    get desenhando() {
      return origemAtiva !== null;
    },
  };
}
