/**
 * simbolos.js — Desenho técnico de cada componente eletrônico.
 * Padrão IEC, traço fino escuro sobre branco, pinos como círculos vazados.
 * Cada desenhador recebe (ctx, comp, x, y, w, h) em coordenadas de tela.
 */

export const CORES = {
  traco: '#2b2b2b',
  tracoFino: '#6b6b6b',
  preenchimento: '#ffffff',
  preenchimentoSuave: '#f5f6f7',
  primaria: '#53b588',
  acento: '#ffb340',
  erro: '#e05a5a',
  texto: '#2b2b2b',
  pino: '#2b2b2b',
  pinoAtivo: '#53b588',
  pinoIndefinido: '#b8b8b8',
  displayFundo: '#1a1d27',
  displaySegApagado: '#2a2f3e',
};

const TRACO = 2;
const RAIO_PINO = 4;

/* ===== UTILITÁRIOS ===== */

function preparar(ctx) {
  ctx.lineWidth = TRACO;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = CORES.traco;
  ctx.fillStyle = CORES.preenchimento;
}

function desenharPino(ctx, x, y, valor) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, RAIO_PINO, 0, Math.PI * 2);
  if (valor === 1) ctx.fillStyle = CORES.pinoAtivo;
  else if (valor === 0) ctx.fillStyle = CORES.preenchimento;
  else ctx.fillStyle = CORES.pinoIndefinido;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
  ctx.restore();
}

function desenharRotulo(ctx, texto, cx, cy, tamanho = 10) {
  ctx.save();
  ctx.fillStyle = CORES.texto;
  ctx.font = `600 ${tamanho}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, cx, cy);
  ctx.restore();
}

function desenharRotuloPino(ctx, texto, x, y, alinhamento = 'left') {
  ctx.save();
  ctx.fillStyle = CORES.tracoFino;
  ctx.font = '500 8px system-ui, sans-serif';
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'middle';
  const offset = alinhamento === 'left' ? 8 : -8;
  ctx.fillText(texto, x + offset, y);
  ctx.restore();
}

/** Desenha todos os pinos de um componente a partir das posições relativas. */
function desenharPinosDoComponente(ctx, comp, x, y, w, h) {
  const dim = comp.dimensoes || { w, h };
  const escalaX = w / dim.w;
  const escalaY = h / dim.h;

  for (const pino of comp.pinos) {
    const px = x + w / 2 + pino.x * escalaX;
    const py = y + h / 2 + pino.y * escalaY;
    desenharPino(ctx, px, py, pino.valor);
    if (pino.nome && comp.pinos.length <= 8) {
      const alinhamento = pino.x < 0 ? 'left' : 'right';
      desenharRotuloPino(ctx, pino.nome, px, py, alinhamento);
    }
  }
}

/* ===== PASSIVOS ===== */

/** Resistor: retângulo com zigue-zague interno (padrão IEC). */
export function desenharRESISTOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const corpoW = w * 0.6;
  const corpoH = h * 0.5;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Hastes
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - corpoW / 2, cy);
  ctx.moveTo(cx + corpoW / 2, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  // Corpo retangular
  ctx.beginPath();
  ctx.rect(cx - corpoW / 2, cy - corpoH / 2, corpoW, corpoH);
  ctx.fill();
  ctx.stroke();
}

/** Potenciômetro: resistor com seta diagonal. */
export function desenharPOTENCIOMETRO(ctx, comp, x, y, w, h) {
  desenharRESISTOR(ctx, comp, x, y, w, h);
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Seta do cursor
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy - 18);
  ctx.lineTo(cx + 4, cy - 6);
  ctx.stroke();

  // Ponta da seta
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 6);
  ctx.lineTo(cx - 1, cy - 8);
  ctx.lineTo(cx + 2, cy - 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Capacitor: duas placas paralelas. */
export function desenharCAPACITOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gap = 6;
  const placaH = h * 0.55;

  // Hastes
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  // Placas
  ctx.beginPath();
  ctx.moveTo(cx - gap, cy - placaH / 2);
  ctx.lineTo(cx - gap, cy + placaH / 2);
  ctx.moveTo(cx + gap, cy - placaH / 2);
  ctx.lineTo(cx + gap, cy + placaH / 2);
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Indutor: bobina em espiral. */
export function desenharINDUTOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cy = y + h / 2;
  const inicio = x + w * 0.15;
  const fim = x + w * 0.85;
  const n = 4;
  const passo = (fim - inicio) / n;
  const raio = h * 0.22;

  // Hastes
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(inicio, cy);
  ctx.moveTo(fim, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  // Bobinas
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const cx = inicio + passo * (i + 0.5);
    ctx.arc(cx, cy, passo / 2, Math.PI, 0);
  }
  ctx.stroke();
}

/** Transformador: dois enrolamentos com núcleo. */
export function desenharTRANSFORMADOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Núcleo (duas linhas verticais)
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - h * 0.35);
  ctx.lineTo(cx - 2, cy + h * 0.35);
  ctx.moveTo(cx + 2, cy - h * 0.35);
  ctx.lineTo(cx + 2, cy + h * 0.35);
  ctx.stroke();

  // Enrolamento primário (esquerda)
  const n = 4;
  const passo = (h * 0.6) / n;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const yy = cy - h * 0.3 + passo * (i + 0.5);
    ctx.arc(cx - 10, yy, passo / 2, Math.PI / 2, -Math.PI / 2, true);
  }
  ctx.stroke();

  // Enrolamento secundário (direita)
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const yy = cy - h * 0.3 + passo * (i + 0.5);
    ctx.arc(cx + 10, yy, passo / 2, -Math.PI / 2, Math.PI / 2, true);
  }
  ctx.stroke();
}

/* ===== SENSORES ===== */

/** LDR: resistor com setas apontando para ele. */
export function desenharLDR(ctx, comp, x, y, w, h) {
  desenharRESISTOR(ctx, comp, x, y, w, h);
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Duas setas diagonais
  for (let i = 0; i < 2; i++) {
    const ox = cx - 8 + i * 10;
    ctx.beginPath();
    ctx.moveTo(ox, cy - 16);
    ctx.lineTo(ox + 6, cy - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + 6, cy - 6);
    ctx.lineTo(ox + 2, cy - 8);
    ctx.lineTo(ox + 5, cy - 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** Termistor: resistor com barra diagonal. */
export function desenharTERMISTOR(ctx, comp, x, y, w, h) {
  desenharRESISTOR(ctx, comp, x, y, w, h);
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.beginPath();
  ctx.moveTo(cx - 14, cy + 12);
  ctx.lineTo(cx + 14, cy - 12);
  ctx.stroke();
}

/** Fotodiodo: diodo com setas entrando. */
export function desenharFOTODIODO(ctx, comp, x, y, w, h) {
  desenharDIODO(ctx, comp, x, y, w, h);
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;

  for (let i = 0; i < 2; i++) {
    const ox = cx - 10 + i * 8;
    ctx.beginPath();
    ctx.moveTo(ox, cy - 18);
    ctx.lineTo(ox + 4, cy - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + 4, cy - 10);
    ctx.lineTo(ox, cy - 12);
    ctx.lineTo(ox + 3, cy - 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/* ===== SEMICONDUTORES ===== */

/** Diodo: triângulo com barra. */
export function desenharDIODO(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tam = h * 0.4;

  // Hastes
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - tam, cy);
  ctx.moveTo(cx + tam, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  // Triângulo
  ctx.beginPath();
  ctx.moveTo(cx - tam, cy - tam);
  ctx.lineTo(cx + tam, cy);
  ctx.lineTo(cx - tam, cy + tam);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Barra (cátodo)
  ctx.beginPath();
  ctx.moveTo(cx + tam, cy - tam);
  ctx.lineTo(cx + tam, cy + tam);
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** LED: diodo com setas saindo, cor configurável. */
export function desenharLED(ctx, comp, x, y, w, h) {
  desenharDIODO(ctx, comp, x, y, w, h);
  const cor = comp.propriedades?.cor || '#ff3b30';
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Setas de emissão
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const ox = cx + 4 + i * 8;
    ctx.beginPath();
    ctx.moveTo(ox, cy - 14);
    ctx.lineTo(ox + 6, cy - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + 6, cy - 20);
    ctx.lineTo(ox + 1, cy - 19);
    ctx.lineTo(ox + 4, cy - 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Brilho quando aceso
  if (comp.estado?.aceso) {
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 30);
    grad.addColorStop(0, cor + '99');
    grad.addColorStop(1, cor + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Transistor NPN: círculo com base, coletor e emissor. */
export function desenharTRANSISTOR_NPN(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) * 0.38;

  // Círculo
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Base (linha vertical)
  const baseX = cx - raio * 0.35;
  ctx.beginPath();
  ctx.moveTo(baseX, cy - raio * 0.55);
  ctx.lineTo(baseX, cy + raio * 0.55);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Coletor (diagonal para cima-direita)
  ctx.beginPath();
  ctx.moveTo(baseX, cy - raio * 0.3);
  ctx.lineTo(cx + raio * 0.5, cy - raio * 0.7);
  ctx.stroke();

  // Emissor (diagonal para baixo-direita) com seta
  ctx.beginPath();
  ctx.moveTo(baseX, cy + raio * 0.3);
  ctx.lineTo(cx + raio * 0.5, cy + raio * 0.7);
  ctx.stroke();

  // Seta do emissor (apontando para fora)
  const ax = cx + raio * 0.5;
  const ay = cy + raio * 0.7;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - 6, ay - 2);
  ctx.lineTo(ax - 3, ay - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Transistor PNP: igual ao NPN, seta do emissor apontando para dentro. */
export function desenharTRANSISTOR_PNP(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) * 0.38;

  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const baseX = cx - raio * 0.35;
  ctx.beginPath();
  ctx.moveTo(baseX, cy - raio * 0.55);
  ctx.lineTo(baseX, cy + raio * 0.55);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Coletor (para baixo-direita no PNP)
  ctx.beginPath();
  ctx.moveTo(baseX, cy + raio * 0.3);
  ctx.lineTo(cx + raio * 0.5, cy + raio * 0.7);
  ctx.stroke();

  // Emissor (para cima-direita) com seta apontando para dentro
  ctx.beginPath();
  ctx.moveTo(baseX, cy - raio * 0.3);
  ctx.lineTo(cx + raio * 0.5, cy - raio * 0.7);
  ctx.stroke();

  const ax = baseX + 4;
  const ay = cy - raio * 0.3 - 4;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax + 6, ay + 2);
  ctx.lineTo(ax + 3, ay + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/* ===== FONTES E CHAVES ===== */

/** Bateria: símbolo de pilha com + e −. */
export function desenharBATERIA(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Hastes
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  // Placas (longa = +, curta = −)
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - h * 0.3);
  ctx.lineTo(cx - 8, cy + h * 0.3);
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + 8, cy - h * 0.18);
  ctx.lineTo(cx + 8, cy + h * 0.18);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Sinal +
  ctx.save();
  ctx.fillStyle = CORES.traco;
  ctx.font = '700 10px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('+', cx - 16, cy - h * 0.35);
  ctx.restore();
}

/** Fonte AC: círculo com senoide. */
export function desenharFONTE_AC(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) * 0.38;

  // Hastes
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - raio, cy);
  ctx.moveTo(cx + raio, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  // Círculo
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Senoide interna
  ctx.beginPath();
  ctx.moveTo(cx - raio * 0.6, cy);
  ctx.quadraticCurveTo(cx - raio * 0.3, cy - raio * 0.5, cx, cy);
  ctx.quadraticCurveTo(cx + raio * 0.3, cy + raio * 0.5, cx + raio * 0.6, cy);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Chave: contato aberto/fechado. */
export function desenharCHAVE(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const fechada = comp.propriedades?.fechada === true;

  // Hastes
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - 12, cy);
  ctx.moveTo(cx + 12, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  // Círculos de contato
  ctx.beginPath();
  ctx.arc(cx - 12, cy, 3, 0, Math.PI * 2);
  ctx.arc(cx + 12, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Alavanca
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  if (fechada) {
    ctx.lineTo(cx + 12, cy);
  } else {
    ctx.lineTo(cx + 10, cy - 12);
  }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = fechada ? CORES.primaria : CORES.traco;
  ctx.stroke();
}

/** Botão: contato momentâneo. */
export function desenharBOTAO(ctx, comp, x, y, w, h) {
  desenharCHAVE(ctx, comp, x, y, w, h);
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Haste do botão
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, cy - 20);
  ctx.stroke();

  // Tampo do botão
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 20);
  ctx.lineTo(cx + 6, cy - 20);
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* ===== LÓGICA ===== */

/** AND: formato D. */
export function desenharAND(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raio = h / 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - raio, y);
  ctx.arc(x + w - raio, y + raio, raio, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** OR: formato curvo. */
export function desenharOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w * 0.5, y, x + w, y + h / 2);
  ctx.quadraticCurveTo(x + w * 0.5, y + h, x, y + h);
  ctx.quadraticCurveTo(x + w * 0.2, y + h / 2, x, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** NOT: triângulo com bolinha. */
export function desenharNOT(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 4;
  const larguraTriangulo = w - raioBolinha * 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + larguraTriangulo, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraTriangulo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** NAND: AND com bolinha. */
export function desenharNAND(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 4;
  const larguraCorpo = w - raioBolinha * 2;
  const raio = h / 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + larguraCorpo - raio, y);
  ctx.arc(x + larguraCorpo - raio, y + raio, raio, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraCorpo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** NOR: OR com bolinha. */
export function desenharNOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 4;
  const larguraCorpo = w - raioBolinha * 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5, y, x + larguraCorpo, y + h / 2);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5, y + h, x, y + h);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.2, y + h / 2, x, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraCorpo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** XOR: OR com curva extra. */
export function desenharXOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.quadraticCurveTo(x + w * 0.5 + 6, y, x + w, y + h / 2);
  ctx.quadraticCurveTo(x + w * 0.5 + 6, y + h, x + 6, y + h);
  ctx.quadraticCurveTo(x + w * 0.2 + 6, y + h / 2, x + 6, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w * 0.2, y + h / 2, x, y + h);
  ctx.stroke();
}

/** XNOR: XOR com bolinha. */
export function desenharXNOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 4;
  const larguraCorpo = w - raioBolinha * 2;
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5 + 6, y, x + larguraCorpo, y + h / 2);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5 + 6, y + h, x + 6, y + h);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.2 + 6, y + h / 2, x + 6, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.2, y + h / 2, x, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraCorpo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Buffer: triângulo sem bolinha. */
export function desenharBUFFER(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/* ===== COMPOSTOS ===== */

/** Display 7 segmentos: retângulo escuro com segmentos. */
export function desenharDISPLAY_7SEG(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fillStyle = CORES.displayFundo;
  ctx.fill();
  ctx.stroke();

  const cor = comp.propriedades?.cor || '#ff3b30';
  const segs = comp.estado?.segmentos || [0, 0, 0, 0, 0, 0, 0];

  const m = 8;
  const largura = w - m * 2;
  const altura = h - m * 2;
  const esp = 4;

  const pos = {
    a: { x: x + m + esp, y: y + m, w: largura - esp * 2, h: esp },
    b: { x: x + w - m - esp, y: y + m + esp, w: esp, h: altura / 2 - esp },
    c: { x: x + w - m - esp, y: y + h / 2 + esp / 2, w: esp, h: altura / 2 - esp },
    d: { x: x + m + esp, y: y + h - m - esp, w: largura - esp * 2, h: esp },
    e: { x: x + m, y: y + h / 2 + esp / 2, w: esp, h: altura / 2 - esp },
    f: { x: x + m, y: y + m + esp, w: esp, h: altura / 2 - esp },
    g: { x: x + m + esp, y: y + h / 2 - esp / 2, w: largura - esp * 2, h: esp },
  };

  const nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (let i = 0; i < 7; i++) {
    const p = pos[nomes[i]];
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, esp / 2);
    ctx.fillStyle = segs[i] === 1 ? cor : CORES.displaySegApagado;
    ctx.fill();
  }
}

/** Amplificador operacional: triângulo com + e −. */
export function desenharAMP_OP(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Símbolos + e −
  ctx.save();
  ctx.fillStyle = CORES.traco;
  ctx.font = '700 11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('−', x + 10, y + h * 0.28);
  ctx.fillText('+', x + 10, y + h * 0.72);
  ctx.restore();
}

/** CI genérico: retângulo com pinos numerados. */
export function desenharCI_GENERICO(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();

  // Entalhe de orientação
  ctx.beginPath();
  ctx.arc(x + w / 2, y, 5, 0, Math.PI);
  ctx.fillStyle = CORES.preenchimentoSuave;
  ctx.fill();
  ctx.stroke();

  // Rótulo da função
  const funcao = comp.propriedades?.funcao || 'CI';
  desenharRotulo(ctx, funcao.toUpperCase(), x + w / 2, y + h / 2, 9);
}

/* ===== MAPA DE DESENHADORES ===== */

export const DESENHADORES = {
  RESISTOR: desenharRESISTOR,
  POTENCIOMETRO: desenharPOTENCIOMETRO,
  CAPACITOR: desenharCAPACITOR,
  INDUTOR: desenharINDUTOR,
  TRANSFORMADOR: desenharTRANSFORMADOR,
  LDR: desenharLDR,
  TERMISTOR: desenharTERMISTOR,
  FOTODIODO: desenharFOTODIODO,
  DIODO: desenharDIODO,
  LED: desenharLED,
  TRANSISTOR_NPN: desenharTRANSISTOR_NPN,
  TRANSISTOR_PNP: desenharTRANSISTOR_PNP,
  BATERIA: desenharBATERIA,
  FONTE_AC: desenharFONTE_AC,
  CHAVE: desenharCHAVE,
  BOTAO: desenharBOTAO,
  AND: desenharAND,
  OR: desenharOR,
  NOT: desenharNOT,
  NAND: desenharNAND,
  NOR: desenharNOR,
  XOR: desenharXOR,
  XNOR: desenharXNOR,
  BUFFER: desenharBUFFER,
  DISPLAY_7SEG: desenharDISPLAY_7SEG,
  AMP_OP: desenharAMP_OP,
  CI_GENERICO: desenharCI_GENERICO,
};

/**
 * Desenha um componente completo: corpo + pinos.
 * Aplica rotação em torno do centro.
 */
export function desenharComponente(ctx, comp, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((comp.rotacao || 0) * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  const desenhador = DESENHADORES[comp.tipo];
  if (desenhador) {
    desenhador(ctx, comp, x, y, w, h);
  } else {
    preparar(ctx);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    desenharRotulo(ctx, comp.tipo, cx, cy, 9);
  }

  desenharPinosDoComponente(ctx, comp, x, y, w, h);

  ctx.restore();
}

/**
 * Calcula a posição absoluta de um pino, considerando rotação.
 */
export function posicaoPino(comp, pinoId, w, h) {
  const pino = comp.pinos.find((p) => p.id === pinoId);
  if (!pino) return null;

  const dim = comp.dimensoes || { w, h };
  const escalaX = w / dim.w;
  const escalaY = h / dim.h;

  const px = pino.x * escalaX;
  const py = pino.y * escalaY;

  const rad = ((comp.rotacao || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotX = px * cos - py * sin;
  const rotY = px * sin + py * cos;

  return {
    x: comp.x + w / 2 + rotX,
    y: comp.y + h / 2 + rotY,
  };
}