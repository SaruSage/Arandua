const progressoEstiloRealista = { valor: 0 };
const GROSSURA_PINO = 3;

const PINOS_CHAVE = {
  p1: { x: -7.5, y: -14.7, nome: 'A' },
  p1b: { x: -7.5, y: 15.7, nome: 'A' },
  p2: { x: 6.1, y: -14.7, nome: 'B' },
  p2b: { x: 6.1, y: 15.7, nome: 'B' },
};

const TERMINAIS_CHAVE = [
  { x1: 74, y1: 35, x2: 74, y2: 130, cor: '#888888', apagar: { x: 55, y: 0, w: 38, h: 131 } },
  { x1: 298, y1: 35, x2: 298, y2: 130, cor: '#888888', apagar: { x: 279, y: 0, w: 38, h: 131 } },
  { x1: 74, y1: 443, x2: 74, y2: 535, cor: '#888888', apagar: { x: 55, y: 444, w: 38, h: 109 } },
  { x1: 298, y1: 443, x2: 298, y2: 535, cor: '#888888', apagar: { x: 279, y: 444, w: 38, h: 109 } },
];

export const ARTES_REALISTAS = {
  LED: {
    arquivo: 'led.png',
    largura: 32,
    altura: 32 * 607 / 335,
    pinos: {
      p1: { x: 4.1, y: 26.9, nome: 'Anodo' },
      p2: { x: -5.5, y: 17.8, nome: 'Catodo' },
    },
    terminais: [
      { x1: 210, y1: 372, x2: 210, y2: 585, cor: '#888888', apagar: { x: 192, y: 370, w: 36, h: 218 } },
      { x1: 110, y1: 372, x2: 110, y2: 490, cor: '#888888', apagar: { x: 92, y: 370, w: 36, h: 125 } },
    ],
  },
  DIODO: {
    arquivo: 'diodo.png',
    largura: 48,
    altura: 48 * 441 / 200,
    pinos: {
      p1: { x: -1, y: -44, nome: 'A' },
      p2: { x: -1, y: 48, nome: 'K' },
    },
    terminais: [
      { x1: 96, y1: 37, x2: 96, y2: 142, cor: '#888888', apagar: { x: 82, y: 30, w: 28, h: 114 } },
      { x1: 96, y1: 314, x2: 96, y2: 420, cor: '#888888', apagar: { x: 82, y: 314, w: 28, h: 113 } },
    ],
  },
  RESISTOR: {
    arquivo: 'resistor.png',
    largura: 48,
    altura: 48 * 458 / 262,
    pinos: {
      p1: { x: 0, y: -29.8, nome: 'A' },
      p2: { x: 0, y: 30, nome: 'B' },
    },
  },
  FONTE_AC: {
    arquivo: 'fonte-ac.png',
    largura: 48,
    altura: 48 * 491 / 248,
    pinos: {
      p1: { x: 15.19, y: -6.19, nome: 'A' },
      p2: { x: 14.81, y: 10.26, nome: 'B' },
    },
    terminais: [
      { x1: 140, y1: 213.5, x2: 202.5, y2: 213.5, cor: '#ff0000', apagar: { x: 136, y: 196, w: 71, h: 36 } },
      { x1: 138, y1: 298.5, x2: 200.5, y2: 298.5, cor: '#080808', apagar: { x: 134, y: 281, w: 71, h: 36 } },
    ],
  },
  INDUTOR: {
    arquivo: 'indutor.png',
    largura: 68,
    altura: 68 * 219 / 667,
    pinos: {
      p1: { x: -30.1, y: 1.4, nome: 'A' },
      p2: { x: 30.6, y: 2.7, nome: 'B' },
    },
  },
  CAPACITOR: {
    arquivo: 'capacitor-polarizado.png',
    largura: 48,
    altura: 48 * 663 / 368,
    pinos: {
      p1: { x: 6.1, y: 42.6, nome: '+' },
      p2: { x: -9.1, y: 32.4, nome: '−' },
    },
    terminais: [
      { x1: 231, y1: 388, x2: 231, y2: 658, cor: '#888888', apagar: { x: 208, y: 388, w: 47, h: 272 } },
      { x1: 114.5, y1: 388, x2: 114.5, y2: 580, cor: '#888888', apagar: { x: 92, y: 388, w: 46, h: 195 } },
    ],
  },
  CAPACITOR_NAO_POLARIZADO: {
    arquivo: 'capacitor-nao-polarizado.png',
    largura: 48,
    altura: 48 * 367 / 320,
    pinos: {
      p1: { x: -9, y: 24, nome: '1' },
      p2: { x: 8.1, y: 24, nome: '2' },
    },
    terminais: [
      { x1: 100, y1: 244, x2: 100, y2: 343, cor: '#888888', apagar: { x: 88, y: 244, w: 24, h: 101 } },
      { x1: 214, y1: 244, x2: 214, y2: 343, cor: '#888888', apagar: { x: 202, y: 244, w: 24, h: 101 } },
    ],
  },
  POTENCIOMETRO: {
    arquivo: 'potenciometro.png',
    largura: 48,
    altura: 48 * 557 / 512,
    pinos: {
      p1: { x: -13.7, y: 24.1, nome: 'A' },
      p2: { x: 14.9, y: 24.1, nome: 'B' },
      p3: { x: 0.4, y: 24.1, nome: 'Cursor' },
    },
    terminais: [
      { x1: 110, y1: 435, x2: 110, y2: 535, cor: '#888888', apagar: { x: 94, y: 435, w: 32, h: 104 } },
      { x1: 260, y1: 435, x2: 260, y2: 535, cor: '#888888', apagar: { x: 244, y: 435, w: 32, h: 104 } },
      { x1: 415, y1: 435, x2: 415, y2: 535, cor: '#888888', apagar: { x: 399, y: 435, w: 32, h: 104 } },
    ],
  },
  CHAVE: {
    arquivo: 'botao-chave.png',
    largura: 24,
    altura: 24 * 553 / 395,
    pinos: PINOS_CHAVE,
    terminais: TERMINAIS_CHAVE,
  },
  BOTAO: {
    arquivo: 'botao-chave.png',
    largura: 24,
    altura: 24 * 553 / 395,
    pinos: PINOS_CHAVE,
    terminais: TERMINAIS_CHAVE,
  },
  BATERIA: {
    arquivo: 'bateria.png',
    largura: 48,
    altura: 48 * 627 / 341,
    pinos: {
      p1: { x: 8.22, y: -42.1, nome: '+' },
      p2: { x: -9.92, y: -42.1, nome: '−' },
    },
    terminais: [
      { x1: 229, y1: 15, x2: 229, y2: 94, cor: '#ff0000', apagar: { x: 177, y: 12, w: 22, h: 85 } },
      { x1: 100, y1: 15, x2: 100, y2: 94, cor: '#080808', apagar: { x: 124, y: 12, w: 22, h: 85 } },
    ],
  },
  FUSIVEL: {
    arquivo: 'fusivel.png',
    arquivoQueimado: 'fusivel-queimado.png',
    deslocamentoImagemQueimada: { x: 48, y: 2 },
    largura: 48,
    altura: 48 * 532 / 275,
    pinos: {
      p1: { x: -0.96, y: -40.67, nome: 'A' },
      p2: { x: -0.96, y: 39.8, nome: 'B' },
    },
    terminais: [
      { x1: 132, y1: 33, x2: 132, y2: 103, cor: '#888888', apagar: { x: 122, y: 30, w: 20, h: 73 } },
      { x1: 132, y1: 422, x2: 132, y2: 494, cor: '#888888', apagar: { x: 122, y: 422, w: 20, h: 73 } },
    ],
  },
  FONTE_POSITIVA: {
    arquivo: 'fonte-positiva.png',
    largura: 64,
    altura: 64 * 283 / 456,
    pinos: {
      p: { x: 27.8, y: 0.3, nome: '+' },
    },
    terminais: [
      { x1: 299, y1: 143, x2: 426, y2: 143, cor: '#ff0000', apagar: { x: 298, y: 125, w: 130, h: 37 } },
    ],
  },
  GND: {
    arquivo: 'gnd.png',
    largura: 64,
    altura: 64 * 267 / 470,
    pinos: {
      p: { x: 27.8, y: 0, nome: 'GND' },
    },
    terminais: [
      { x1: 314, y1: 133, x2: 439, y2: 133, cor: '#080808', apagar: { x: 313, y: 115, w: 128, h: 37 } },
    ],
  },
  TRANSFORMADOR: {
    arquivo: 'transformador.png',
    largura: 128,
    altura: 128 * 505 / 435,
    pinos: {
      p1: { x: -50.32, y: 64.58, nome: 'P1' },
      p2: { x: -39.72, y: 64.58, nome: 'P2' },
      s1: { x: 43.43, y: 64.58, nome: 'S1' },
      s2: { x: 53.57, y: 64.58, nome: 'S2' },
    },
    terminais: [
      { x1: 46.5, y1: 312, x2: 46.5, y2: 472, cor: '#aa4512', apagar: { x: 37, y: 312, w: 19, h: 163 } },
      { x1: 82.5, y1: 312, x2: 82.5, y2: 472, cor: '#aa4512', apagar: { x: 73, y: 312, w: 19, h: 163 } },
      { x1: 365, y1: 312, x2: 365, y2: 472, cor: '#000000', apagar: { x: 355, y: 312, w: 20, h: 163 } },
      { x1: 399.5, y1: 312, x2: 399.5, y2: 472, cor: '#000000', apagar: { x: 389, y: 312, w: 21, h: 163 } },
    ],
  },
  TRANSISTOR_NPN: {
    arquivo: 'transistor-npn.png',
    largura: 64,
    altura: 64 * 612 / 530,
    pinos: {
      c: { x: -18.17, y: 31.64, nome: 'C' },
      b: { x: -0.3, y: 31.4, nome: 'B' },
      e: { x: 17.69, y: 31.04, nome: 'E' },
    },
  },
  TRANSISTOR_PNP: {
    arquivo: 'transistor-pnp.png',
    largura: 64 * 500 / 530,
    altura: 64 * 612 / 530,
    pinos: {
      e: { x: -16.84, y: 32.72, nome: 'E' },
      b: { x: 1.03, y: 32.48, nome: 'B' },
      c: { x: 19.01, y: 32.11, nome: 'C' },
    },
  },
  BARRAMENTO: {
    arquivo: 'barramento.png',
    largura: 36,
    altura: 36 * 541 / 177,
    pinos: {},
  },
};

const artesCarregadas = new Map();
const artesQueimadas = new Map();
const artesBarramentoPorQuantidade = new Map();
let carregamentoArtes = null;

export function obterProgressoEstiloRealista() {
  return progressoEstiloRealista.valor;
}

export function definirProgressoEstiloRealista(valor) {
  progressoEstiloRealista.valor = Math.max(0, Math.min(1, valor));
}

function removerFundoBranco(tela, contexto) {
  const largura = tela.width;
  const altura = tela.height;
  const pixels = contexto.getImageData(0, 0, largura, altura);
  const visitados = new Uint8Array(largura * altura);
  const fila = new Int32Array(largura * altura);
  let inicio = 0;
  let fim = 0;

  const branco = (indice) => {
    const base = indice * 4;
    return pixels.data[base + 3] > 0
      && pixels.data[base] > 248
      && pixels.data[base + 1] > 248
      && pixels.data[base + 2] > 248;
  };
  const enfileirar = (indice) => {
    if (visitados[indice]) return;
    visitados[indice] = 1;
    if (branco(indice)) fila[fim++] = indice;
  };

  for (let x = 0; x < largura; x++) {
    enfileirar(x);
    enfileirar((altura - 1) * largura + x);
  }
  for (let y = 1; y < altura - 1; y++) {
    enfileirar(y * largura);
    enfileirar(y * largura + largura - 1);
  }

  while (inicio < fim) {
    const indice = fila[inicio++];
    pixels.data[indice * 4 + 3] = 0;
    const x = indice % largura;
    const y = Math.floor(indice / largura);
    if (x > 0) enfileirar(indice - 1);
    if (x < largura - 1) enfileirar(indice + 1);
    if (y > 0) enfileirar(indice - largura);
    if (y < altura - 1) enfileirar(indice + largura);
  }

  contexto.putImageData(pixels, 0, 0);
}

function criarArteResistor(arte) {
  const tela = document.createElement('canvas');
  tela.width = 262;
  tela.height = 458;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a arte realista do resistor.');

  ctx.lineWidth = GROSSURA_PINO * tela.width / arte.largura;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#888888';
  ctx.beginPath();
  ctx.moveTo(131, 66.3);
  ctx.lineTo(131, 122);
  ctx.moveTo(131, 335);
  ctx.lineTo(131, 392.7);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(131, 122);
  ctx.bezierCurveTo(95, 122, 88, 147, 96, 177);
  ctx.bezierCurveTo(100, 193, 103, 205, 103, 228);
  ctx.bezierCurveTo(103, 251, 100, 264, 96, 280);
  ctx.bezierCurveTo(88, 310, 95, 335, 131, 335);
  ctx.bezierCurveTo(167, 335, 174, 310, 166, 280);
  ctx.bezierCurveTo(162, 264, 159, 251, 159, 228);
  ctx.bezierCurveTo(159, 205, 162, 193, 166, 177);
  ctx.bezierCurveTo(174, 147, 167, 122, 131, 122);
  ctx.closePath();
  ctx.fillStyle = '#d9b477';
  ctx.fill();
  return tela;
}

function normalizarGrossuraPinos(tela, arte) {
  if (!arte.terminais?.length) return;
  const contexto = tela.getContext('2d');
  contexto.save();
  for (const terminal of arte.terminais) {
    const { x, y, w, h } = terminal.apagar;
    contexto.clearRect(x, y, w, h);
  }
  contexto.lineWidth = GROSSURA_PINO * tela.width / arte.largura;
  contexto.lineCap = 'butt';
  for (const terminal of arte.terminais) {
    contexto.beginPath();
    contexto.moveTo(terminal.x1, terminal.y1);
    contexto.lineTo(terminal.x2, terminal.y2);
    contexto.strokeStyle = terminal.cor;
    contexto.stroke();

    const centroX = tela.width / 2;
    const centroY = tela.height / 2;
    const distInicio = (terminal.x1 - centroX) ** 2 + (terminal.y1 - centroY) ** 2;
    const distFim = (terminal.x2 - centroX) ** 2 + (terminal.y2 - centroY) ** 2;
    const xPonta = distInicio > distFim ? terminal.x1 : terminal.x2;
    const yPonta = distInicio > distFim ? terminal.y1 : terminal.y2;
    contexto.beginPath();
    contexto.arc(xPonta, yPonta, contexto.lineWidth / 2, 0, Math.PI * 2);
    contexto.fillStyle = terminal.cor;
    contexto.fill();
  }
  contexto.restore();
}

export function carregarArtesRealistas() {
  if (!carregamentoArtes) {
    carregamentoArtes = Promise.all(
      Object.entries(ARTES_REALISTAS).map(([tipo, arte]) => new Promise((resolve, reject) => {
        if (tipo === 'RESISTOR') {
          artesCarregadas.set(tipo, criarArteResistor(arte));
          resolve();
          return;
        }

        const imagem = new Image();
        imagem.onload = () => {
          let tela = document.createElement('canvas');
          tela.width = imagem.naturalWidth;
          tela.height = imagem.naturalHeight;
          const contexto = tela.getContext('2d', { willReadFrequently: true });
          if (!contexto) {
            reject(new Error(`Não foi possível preparar a arte realista ${arte.arquivo}.`));
            return;
          }
          contexto.drawImage(imagem, 0, 0);
          removerFundoBranco(tela, contexto);
          normalizarGrossuraPinos(tela, arte);
          if (!arte.arquivoQueimado) {
            artesCarregadas.set(tipo, tela);
            resolve();
            return;
          }

          const imagemQueimada = new Image();
          imagemQueimada.onload = () => {
            const telaQueimada = document.createElement('canvas');
            telaQueimada.width = imagem.naturalWidth;
            telaQueimada.height = imagem.naturalHeight;
            const contextoQueimado = telaQueimada.getContext('2d', { willReadFrequently: true });
            if (!contextoQueimado) {
              reject(new Error(`Não foi possível preparar a arte realista ${arte.arquivoQueimado}.`));
              return;
            }
            contextoQueimado.drawImage(
              imagemQueimada,
              arte.deslocamentoImagemQueimada.x,
              arte.deslocamentoImagemQueimada.y
            );
            removerFundoBranco(telaQueimada, contextoQueimado);
            normalizarGrossuraPinos(telaQueimada, arte);
            artesCarregadas.set(tipo, tela);
            artesQueimadas.set(tipo, telaQueimada);
            resolve();
          };
          imagemQueimada.onerror = () => reject(new Error(`Não foi possível carregar a arte realista ${arte.arquivoQueimado}.`));
          imagemQueimada.src = new URL(`../img/componentes/${arte.arquivoQueimado}`, import.meta.url).href;
        };
        imagem.onerror = () => reject(new Error(`Não foi possível carregar a arte realista ${arte.arquivo}.`));
        imagem.src = new URL(`../img/componentes/${arte.arquivo}`, import.meta.url).href;
      }))
    ).catch((erro) => {
      carregamentoArtes = null;
      throw erro;
    });
  }
  return carregamentoArtes;
}

function criarArteBarramento(quantidade) {
  const tela = document.createElement('canvas');
  tela.width = 177;
  tela.height = 541 + (quantidade - 4) * 118;
  const contexto = tela.getContext('2d');
  if (!contexto) throw new Error('Não foi possível preparar a arte realista do barramento.');

  contexto.beginPath();
  contexto.roundRect(21, 21, 118, tela.height - 32, 22);
  contexto.fillStyle = '#d1d1d1';
  contexto.fill();
  contexto.lineWidth = 6;
  contexto.strokeStyle = '#adadad';
  contexto.stroke();

  for (let indice = 0; indice < quantidade; indice++) {
    const y = 97 + indice * 118;
    contexto.beginPath();
    contexto.arc(64.5, y, 31, 0, Math.PI * 2);
    contexto.fillStyle = '#808080';
    contexto.fill();
    contexto.beginPath();
    contexto.arc(64.5, y, 25, 0, Math.PI * 2);
    contexto.fillStyle = '#000000';
    contexto.fill();
  }
  return tela;
}

export function obterArteRealista(tipo, propriedades = {}) {
  if (tipo === 'BARRAMENTO') {
    const quantidadeInformada = Number(propriedades.quantidadePinos);
    const quantidade = Number.isInteger(quantidadeInformada)
      ? Math.max(4, Math.min(16, quantidadeInformada))
      : 4;
    if (quantidade === 4) return artesCarregadas.get(tipo) || null;
    if (!artesBarramentoPorQuantidade.has(quantidade)) {
      artesBarramentoPorQuantidade.set(quantidade, criarArteBarramento(quantidade));
    }
    return artesBarramentoPorQuantidade.get(quantidade);
  }
  return artesCarregadas.get(tipo) || null;
}

export function obterArteRealistaQueimada(tipo) {
  return artesQueimadas.get(tipo) || null;
}
