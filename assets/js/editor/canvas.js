export const LARGURA_COMPONENTE = 80;
export const ALTURA_COMPONENTE = 60;

const TAMANHO_GRADE = 20;
const CORES = {
  fundo: '#0f1117',
  superficie: '#1a1d27',
  borda: '#2a2f3e',
  texto: '#e8eaed',
  textoSecundario: '#9aa0ac',
  acento: '#4f8cff',
  acentoSecundario: '#00d4a0',
  pinoUm: '#00d4a0',
  pinoZero: '#4f8cff',
  pinoIndefinido: '#9aa0ac',
};

function corDoPino(valor) {
  if (valor === 1) return CORES.pinoUm;
  if (valor === 0) return CORES.pinoZero;
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
    ctx.strokeStyle = forte ? '#3a4052' : '#252a37';
    ctx.lineWidth = forte ? 1.5 : 1;
    ctx.moveTo(x, inicioY);
    ctx.lineTo(x, fimY);
    ctx.stroke();
  }

  for (let y = inicioY; y <= fimY; y += TAMANHO_GRADE) {
    const forte = y % (TAMANHO_GRADE * 5) === 0;
    ctx.beginPath();
    ctx.strokeStyle = forte ? '#3a4052' : '#252a37';
    ctx.lineWidth = forte ? 1.5 : 1;
    ctx.moveTo(inicioX, y);
    ctx.lineTo(fimX, y);
    ctx.stroke();
  }
}

function desenharComponente(ctx, componente, selecionado) {
  const { x, y } = componente.posicao;

  ctx.beginPath();
  ctx.roundRect(x, y, LARGURA_COMPONENTE, ALTURA_COMPONENTE, 8);
  ctx.fillStyle = CORES.superficie;
  ctx.fill();
  ctx.lineWidth = selecionado ? 2 : 1;
  ctx.strokeStyle = selecionado ? CORES.acento : CORES.borda;
  ctx.stroke();

  ctx.fillStyle = CORES.texto;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(componente.rotulo, x + LARGURA_COMPONENTE / 2, y + ALTURA_COMPONENTE / 2);

  const entradas = componente.entradas || [];
  entradas.forEach((pino, indice) => {
    const posicaoY = y + ((indice + 1) * ALTURA_COMPONENTE) / (entradas.length + 1);
    ctx.beginPath();
    ctx.arc(x, posicaoY, 5, 0, Math.PI * 2);
    ctx.fillStyle = corDoPino(pino.valor);
    ctx.fill();
    ctx.strokeStyle = CORES.fundo;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  const saidas = componente.saidas || [];
  saidas.forEach((pino, indice) => {
    const posicaoY = y + ((indice + 1) * ALTURA_COMPONENTE) / (saidas.length + 1);
    ctx.beginPath();
    ctx.arc(x + LARGURA_COMPONENTE, posicaoY, 5, 0, Math.PI * 2);
    ctx.fillStyle = corDoPino(pino.valor);
    ctx.fill();
    ctx.strokeStyle = CORES.fundo;
    ctx.lineWidth = 1;
    ctx.stroke();
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

  function render(circuito, selecionadoId = null) {
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
    circuito.componentes.forEach((componente) => {
      desenharComponente(ctx, componente, componente.id === selecionadoId);
    });
  }

  return {
    view,
    redimensionar,
    render,
    telaParaMundo,
    mundoParaTela,
    posicaoPinoTela,
    ctx,
    elemento,
  };
}
