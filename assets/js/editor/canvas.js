import { desenharFioFantasma, desenharFios } from './wiring.js';
import { METADADOS_COMPOSTOS } from '../components/compostos.js';

export const LARGURA_COMPONENTE = 80;
export const ALTURA_COMPONENTE = 60;

const TAMANHO_GRADE = 20;
const CORES = {
  fundo: '#ffffff',
  grade: '#f0f4f2',
  gradeForte: '#e0e8e4',
  componente: '#ffffff',
  componenteBorda: '#d4ddd8',
  componenteSelecionado: '#53b588',
  texto: '#191919',
  pino: '#53b588',
  pinoAtivo: '#3e9670',
  pinoIndefinido: '#9a9a9a',
};

function corDoPino(valor) {
  if (valor === 1) return CORES.pinoAtivo;
  if (valor === 0) return CORES.pino;
  return CORES.pinoIndefinido;
}

function desenharGrade(ctx, largura, altura, telaParaMundo) {
  const cantoSuperior = telaParaMundo(0, 0);
  const cantoInferior = telaParaMundo(largura, altura);
  const inicioX = Math.floor(cantoSuperior.x / TAMANHO_GRADE) * TAMANHO_GRADE;
  const fimX = Math.ceil(cantoInferior.x / TAMANHO_GRADE) * TAMANHO_GRADE;
  const inicioY = Math.floor(cantoSuperior.y / TAMANHO_GRADE) * TAMANHO_GRADE;
  const fimY = Math.ceil(cantoInferior.y / TAMANHO_GRADE) * TAMANHO_GRADE;

  for (let x = inicioX; x <= fimX; x += TAMANHO_GRADE) {
    const forte = x % (TAMANHO_GRADE * 5) === 0;
    ctx.beginPath();
    ctx.strokeStyle = forte ? CORES.gradeForte : CORES.grade;
    ctx.lineWidth = forte ? 1.5 : 1;
    ctx.moveTo(x, inicioY);
    ctx.lineTo(x, fimY);
    ctx.stroke();
  }

  for (let y = inicioY; y <= fimY; y += TAMANHO_GRADE) {
    const forte = y % (TAMANHO_GRADE * 5) === 0;
    ctx.beginPath();
    ctx.strokeStyle = forte ? CORES.gradeForte : CORES.grade;
    ctx.lineWidth = forte ? 1.5 : 1;
    ctx.moveTo(inicioX, y);
    ctx.lineTo(fimX, y);
    ctx.stroke();
  }
}

function desenharComponente(ctx, componente, selecionado, pinoSobCursor) {
  const { x, y } = componente.posicao;

  ctx.beginPath();
  ctx.roundRect(x, y, LARGURA_COMPONENTE, ALTURA_COMPONENTE, 8);
  ctx.fillStyle = CORES.componente;
  ctx.fill();
  ctx.lineWidth = selecionado ? 2 : 1;
  ctx.strokeStyle = selecionado ? CORES.componenteSelecionado : CORES.componenteBorda;
  ctx.stroke();

  ctx.fillStyle = CORES.texto;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(componente.rotulo, x + LARGURA_COMPONENTE / 2, y + ALTURA_COMPONENTE / 2);

  const entradas = componente.entradas || [];
  const nomesEntradas = METADADOS_COMPOSTOS[componente.tipo]?.nomesEntradas || [];
  entradas.forEach((pino, indice) => {
    const posicaoY = y + ((indice + 1) * ALTURA_COMPONENTE) / (entradas.length + 1);
    const emHover = pinoSobCursor?.componenteId === componente.id
      && pinoSobCursor.pinoId === pino.id
      && pinoSobCursor.direcao === 'entrada';
    ctx.beginPath();
    ctx.arc(x, posicaoY, emHover ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = emHover ? '#ffffff' : corDoPino(pino.valor);
    ctx.fill();
    ctx.strokeStyle = emHover ? CORES.componenteSelecionado : CORES.fundo;
    ctx.lineWidth = emHover ? 2 : 1;
    ctx.stroke();
    if (nomesEntradas[indice]) {
      ctx.fillStyle = CORES.texto;
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(nomesEntradas[indice], x - 5, posicaoY);
    }
  });

  const saidas = componente.saidas || [];
  const nomesSaidas = METADADOS_COMPOSTOS[componente.tipo]?.nomesSaidas || [];
  saidas.forEach((pino, indice) => {
    const posicaoY = y + ((indice + 1) * ALTURA_COMPONENTE) / (saidas.length + 1);
    const emHover = pinoSobCursor?.componenteId === componente.id
      && pinoSobCursor.pinoId === pino.id
      && pinoSobCursor.direcao === 'saida';
    ctx.beginPath();
    ctx.arc(x + LARGURA_COMPONENTE, posicaoY, emHover ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = emHover ? '#ffffff' : corDoPino(pino.valor);
    ctx.fill();
    ctx.strokeStyle = emHover ? CORES.componenteSelecionado : CORES.fundo;
    ctx.lineWidth = emHover ? 2 : 1;
    ctx.stroke();
    if (nomesSaidas[indice]) {
      ctx.fillStyle = CORES.texto;
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(nomesSaidas[indice], x + LARGURA_COMPONENTE + 5, posicaoY);
    }
  });
}

export function criarCanvas(elemento) {
  const ctx = elemento.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível inicializar o canvas 2D.');
  }

  const view = { zoom: 1, panX: 0, panY: 0 };
  let largura = 0;
  let altura = 0;
  let pinoSobCursor = null;
  let circuitoAtual = null;

  function telaParaMundo(x, y) {
    return {
      x: (x - view.panX) / view.zoom,
      y: (y - view.panY) / view.zoom,
    };
  }

  function mundoParaTela(x, y) {
    return {
      x: x * view.zoom + view.panX,
      y: y * view.zoom + view.panY,
    };
  }

  function posicaoPinoTela(componente, direcao, indice) {
    const pinos = direcao === 'entrada' ? componente.entradas : componente.saidas;
    if (!pinos || indice < 0 || indice >= pinos.length) return null;

    const x = componente.posicao.x + (direcao === 'entrada' ? 0 : LARGURA_COMPONENTE);
    const y = componente.posicao.y
      + ((indice + 1) * ALTURA_COMPONENTE) / (pinos.length + 1);
    return mundoParaTela(x, y);
  }

  function redimensionar() {
    const escala = window.devicePixelRatio || 1;
    const retangulo = elemento.getBoundingClientRect();
    largura = retangulo.width;
    altura = retangulo.height;
    elemento.width = Math.round(largura * escala);
    elemento.height = Math.round(altura * escala);
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
  }

  function pinoEm(x, y) {
    let maisProximo = null;
    let menorDistancia = 10;

    (circuitoAtual?.componentes || []).forEach((componente) => {
      for (const [direcao, pinos] of [
        ['entrada', componente.entradas],
        ['saida', componente.saidas],
      ]) {
        pinos.forEach((pino, indice) => {
          const posicao = {
            x: componente.posicao.x + (direcao === 'entrada' ? 0 : LARGURA_COMPONENTE),
            y: componente.posicao.y
              + ((indice + 1) * ALTURA_COMPONENTE) / (pinos.length + 1),
          };
          const distancia = Math.hypot(x - posicao.x, y - posicao.y);
          if (distancia <= menorDistancia) {
            menorDistancia = distancia;
            maisProximo = { componente, pino, direcao };
          }
        });
      }
    });

    return maisProximo;
  }

  function render(circuito, selecionadoId = null, fioSelecionadoId = null, fioFantasma = null) {
    circuitoAtual = circuito;
    const escala = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, elemento.width, elemento.height);
    ctx.fillStyle = CORES.fundo;
    ctx.fillRect(0, 0, elemento.width, elemento.height);
    ctx.setTransform(
      escala * view.zoom,
      0,
      0,
      escala * view.zoom,
      escala * view.panX,
      escala * view.panY,
    );

    desenharGrade(ctx, largura, altura, telaParaMundo);
    desenharFios(ctx, circuito, api, fioSelecionadoId);
    circuito.componentes.forEach((componente) => {
      desenharComponente(
        ctx,
        componente,
        componente.id === selecionadoId,
        pinoSobCursor,
      );
    });
    if (fioFantasma) {
      desenharFioFantasma(ctx, api, fioFantasma.origem, fioFantasma.cursorAtual);
    }
  }

  const api = {
    view,
    redimensionar,
    render,
    pinoEm,
    telaParaMundo,
    mundoParaTela,
    posicaoPinoTela,
    ctx,
    elemento,
    get circuito() {
      return circuitoAtual;
    },
    get pinoSobCursor() {
      return pinoSobCursor;
    },
    set pinoSobCursor(valor) {
      pinoSobCursor = valor;
    },
  };

  return api;
}
