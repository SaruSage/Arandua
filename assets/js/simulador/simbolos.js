/**
 * simbolos.js — Desenho dos símbolos reais dos componentes.
 * Estilo minimalista técnico: traço escuro fino sobre branco,
 * pinos como círculos vazados, sem sombras pesadas.
 */

/** Paleta dos símbolos — minimalista, alto contraste. */
export const CORES_SIMBOLO = {
  traco: '#2b2b2b',
  tracoFino: '#5a5a5a',
  preenchimento: '#ffffff',
  preenchimentoAtivo: '#e8f5ee',
  primaria: '#53b588',
  primariaEscura: '#3e9670',
  acento: '#ffb340',
  erro: '#e05a5a',
  texto: '#2b2b2b',
  pino: '#2b2b2b',
  pinoAtivo: '#53b588',
  pinoIndefinido: '#b8b8b8',
  ledApagado: '#ffffff',
  ledAceso: '#ffb340',
  displayFundo: '#ffffff',
  displaySegApagado: '#e0e0e0',
  displaySegAceso: '#ffb340',
};

const TRACO = 2;
const RAIO_PINO = 5;

function preparar(ctx) {
  ctx.lineWidth = TRACO;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = CORES_SIMBOLO.traco;
  ctx.fillStyle = CORES_SIMBOLO.preenchimento;
}

/** Pino: círculo vazado com preenchimento por valor. */
function desenharPinoSimbolo(ctx, x, y, valor, raio = RAIO_PINO) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  if (valor === 1) ctx.fillStyle = CORES_SIMBOLO.pinoAtivo;
  else if (valor === 0) ctx.fillStyle = CORES_SIMBOLO.preenchimento;
  else ctx.fillStyle = CORES_SIMBOLO.pinoIndefinido;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES_SIMBOLO.traco;
  ctx.stroke();
  ctx.restore();
}

/** Linha curta do pino até o corpo do componente. */
function desenharHastePino(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES_SIMBOLO.traco;
  ctx.stroke();
  ctx.restore();
}

function desenharRotulo(ctx, texto, cx, cy, tamanho = 11) {
  ctx.save();
  ctx.fillStyle = CORES_SIMBOLO.texto;
  ctx.font = `600 ${tamanho}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, cx, cy);
  ctx.restore();
}

function desenharRotuloPino(ctx, texto, x, y, alinhamento = 'left') {
  ctx.save();
  ctx.fillStyle = CORES_SIMBOLO.tracoFino;
  ctx.font = '500 9px system-ui, sans-serif';
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'middle';
  const offset = alinhamento === 'left' ? 10 : -10;
  ctx.fillText(texto, x + offset, y);
  ctx.restore();
}

/* ===== PORTAS LÓGICAS ===== */

export function desenharAND(ctx, x, y, w, h) {
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

export function desenharOR(ctx, x, y, w, h) {
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

export function desenharXOR(ctx, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.quadraticCurveTo(x + w * 0.5 + 8, y, x + w, y + h / 2);
  ctx.quadraticCurveTo(x + w * 0.5 + 8, y + h, x + 8, y + h);
  ctx.quadraticCurveTo(x + w * 0.2 + 8, y + h / 2, x + 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w * 0.2, y + h / 2, x, y + h);
  ctx.stroke();
}

export function desenharNOT(ctx, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 5;
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
  ctx.fillStyle = CORES_SIMBOLO.preenchimento;
  ctx.fill();
  ctx.stroke();
}

export function desenharNAND(ctx, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 5;
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
  ctx.fillStyle = CORES_SIMBOLO.preenchimento;
  ctx.fill();
  ctx.stroke();
}

export function desenharNOR(ctx, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 5;
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
  ctx.fillStyle = CORES_SIMBOLO.preenchimento;
  ctx.fill();
  ctx.stroke();
}

export function desenharXNOR(ctx, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 5;
  const larguraCorpo = w - raioBolinha * 2;
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5 + 8, y, x + larguraCorpo, y + h / 2);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5 + 8, y + h, x + 8, y + h);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.2 + 8, y + h / 2, x + 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.2, y + h / 2, x, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraCorpo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fillStyle = CORES_SIMBOLO.preenchimento;
  ctx.fill();
  ctx.stroke();
}

/* ===== ENTRADAS E SAÍDAS ===== */

/**
 * Switch: símbolo esquemático com dois terminais e alavanca.
 * Pino de saída desenhado à direita, com haste até o corpo.
 */
export function desenharSWITCH(ctx, x, y, w, h, ativo) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) / 2 - 8;

  // Corpo circular
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = ativo ? CORES_SIMBOLO.preenchimentoAtivo : CORES_SIMBOLO.preenchimento;
  ctx.fill();
  ctx.stroke();

  // Alavanca interna
  const angulo = ativo ? -Math.PI / 4 : Math.PI / 4;
  const pontaX = cx + Math.cos(angulo) * raio * 0.75;
  const pontaY = cy + Math.sin(angulo) * raio * 0.75;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(pontaX, pontaY);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ativo ? CORES_SIMBOLO.primariaEscura : CORES_SIMBOLO.traco;
  ctx.stroke();

  // Bolinha da ponta
  ctx.beginPath();
  ctx.arc(pontaX, pontaY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = ativo ? CORES_SIMBOLO.primaria : CORES_SIMBOLO.traco;
  ctx.fill();

  // Pino de saída (direita) — haste + círculo vazado
  const pinoX = x + w;
  const pinoY = cy;
  desenharHastePino(ctx, cx + raio, cy, pinoX - RAIO_PINO, pinoY);
  desenharPinoSimbolo(ctx, pinoX, pinoY, ativo ? 1 : 0);
}

/**
 * LED: círculo com pino de entrada à esquerda e brilho quando aceso.
 */
export function desenharLED(ctx, x, y, w, h, aceso) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) / 2 - 8;

  // Brilho suave quando aceso
  if (aceso) {
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, raio * 0.4, cx, cy, raio * 1.8);
    grad.addColorStop(0, 'rgba(255, 179, 64, 0.45)');
    grad.addColorStop(1, 'rgba(255, 179, 64, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Corpo
  preparar(ctx);
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = aceso ? CORES_SIMBOLO.ledAceso : CORES_SIMBOLO.ledApagado;
  ctx.fill();
  ctx.stroke();

  // Reflexo
  ctx.beginPath();
  ctx.arc(cx - raio * 0.3, cy - raio * 0.3, raio * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fill();

  // Pino de entrada (esquerda) — haste + círculo vazado
  const pinoX = x;
  const pinoY = cy;
  desenharHastePino(ctx, pinoX + RAIO_PINO, pinoY, cx - raio, cy);
  desenharPinoSimbolo(ctx, pinoX, pinoY, aceso ? 1 : 0);
}

/** Clock: onda quadrada com pino de saída à direita. */
export function desenharCLOCK(ctx, x, y, w, h) {
  preparar(ctx);
  const margem = 10;
  const x0 = x + margem;
  const x1 = x + w - margem;
  const y0 = y + h / 2;
  const amp = h / 2 - margem;
  const q = (x1 - x0) / 4;

  ctx.beginPath();
  ctx.moveTo(x0, y0 + amp);
  ctx.lineTo(x0 + q, y0 + amp);
  ctx.lineTo(x0 + q, y0 - amp);
  ctx.lineTo(x0 + q * 3, y0 - amp);
  ctx.lineTo(x0 + q * 3, y0 + amp);
  ctx.lineTo(x1, y0 + amp);
  ctx.strokeStyle = CORES_SIMBOLO.traco;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pino de saída
  desenharHastePino(ctx, x1, y0 + amp, x + w - RAIO_PINO, y0);
  desenharPinoSimbolo(ctx, x + w, y0, null);
}

/* ===== SEQUENCIAIS ===== */

export function desenharFLIPFLOP(ctx, x, y, w, h, rotulo, entradas, saidas) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();

  desenharRotulo(ctx, rotulo, x + w / 2, y + h / 2, 11);

  const nE = entradas.length;
  for (let i = 0; i < nE; i++) {
    const py = y + h * ((i + 1) / (nE + 1));
    desenharHastePino(ctx, x - RAIO_PINO, py, x, py);
    desenharPinoSimbolo(ctx, x - RAIO_PINO, py, entradas[i].valor);
    if (entradas[i].nome) desenharRotuloPino(ctx, entradas[i].nome, x, py, 'left');
  }

  const nS = saidas.length;
  for (let i = 0; i < nS; i++) {
    const py = y + h * ((i + 1) / (nS + 1));
    desenharHastePino(ctx, x + w, py, x + w + RAIO_PINO, py);
    desenharPinoSimbolo(ctx, x + w + RAIO_PINO, py, saidas[i].valor);
    if (saidas[i].nome) desenharRotuloPino(ctx, saidas[i].nome, x + w, py, 'right');
  }

  // Triângulo de clock
  const py = y + h * 0.8;
  ctx.beginPath();
  ctx.moveTo(x, py - 5);
  ctx.lineTo(x + 9, py);
  ctx.lineTo(x, py + 5);
  ctx.strokeStyle = CORES_SIMBOLO.traco;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function desenharCONTADOR(ctx, x, y, w, h, valor, bits) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();

  desenharRotulo(ctx, 'CTR', x + w / 2, y + 14, 10);

  ctx.save();
  ctx.fillStyle = CORES_SIMBOLO.primariaEscura;
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(valor), x + w / 2, y + h / 2 + 4);
  ctx.restore();

  for (let i = 0; i < bits; i++) {
    const py = y + h * ((i + 1) / (bits + 1));
    const bit = (valor >> i) & 1;
    desenharHastePino(ctx, x + w, py, x + w + RAIO_PINO, py);
    desenharPinoSimbolo(ctx, x + w + RAIO_PINO, py, bit);
    desenharRotuloPino(ctx, `Q${i}`, x + w, py, 'right');
  }
}

export function desenharREGISTRADOR(ctx, x, y, w, h, bits) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();

  desenharRotulo(ctx, 'REG', x + w / 2, y + 14, 10);

  for (let i = 0; i < bits; i++) {
    const py = y + h * ((i + 1) / (bits + 1));
    desenharHastePino(ctx, x - RAIO_PINO, py, x, py);
    desenharPinoSimbolo(ctx, x - RAIO_PINO, py, null);
    desenharRotuloPino(ctx, `D${i}`, x, py, 'left');
    desenharHastePino(ctx, x + w, py, x + w + RAIO_PINO, py);
    desenharPinoSimbolo(ctx, x + w + RAIO_PINO, py, null);
    desenharRotuloPino(ctx, `Q${i}`, x + w, py, 'right');
  }
}

/* ===== DISPLAY 7 SEGMENTOS ===== */

export function desenharDISPLAY7SEG(ctx, x, y, w, h, segmentos) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fillStyle = CORES_SIMBOLO.displayFundo;
  ctx.fill();
  ctx.stroke();

  const m = 10;
  const largura = w - m * 2;
  const altura = h - m * 2;
  const esp = 5;

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
    const aceso = segmentos[i] === 1;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, esp / 2);
    ctx.fillStyle = aceso ? CORES_SIMBOLO.displaySegAceso : CORES_SIMBOLO.displaySegApagado;
    ctx.fill();
  }

  // Pinos de entrada (esquerda) e saída (direita)
  const nE = 4;
  for (let i = 0; i < nE; i++) {
    const py = y + h * ((i + 1) / (nE + 1));
    desenharHastePino(ctx, x - RAIO_PINO, py, x, py);
    desenharPinoSimbolo(ctx, x - RAIO_PINO, py, null);
  }
  const nS = 7;
  for (let i = 0; i < nS; i++) {
    const py = y + h * ((i + 1) / (nS + 1));
    desenharHastePino(ctx, x + w, py, x + w + RAIO_PINO, py);
    desenharPinoSimbolo(ctx, x + w + RAIO_PINO, py, segmentos[i]);
  }
}

/* ===== COMPOSTOS GENÉRICOS ===== */

export function desenharCOMPOSTO(ctx, x, y, w, h, rotulo, entradas, saidas) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();

  desenharRotulo(ctx, rotulo, x + w / 2, y + h / 2, 10);

  const nE = entradas.length;
  for (let i = 0; i < nE; i++) {
    const py = y + h * ((i + 1) / (nE + 1));
    desenharHastePino(ctx, x - RAIO_PINO, py, x, py);
    desenharPinoSimbolo(ctx, x - RAIO_PINO, py, entradas[i].valor);
    if (entradas[i].nome && nE <= 6) desenharRotuloPino(ctx, entradas[i].nome, x, py, 'left');
  }

  const nS = saidas.length;
  for (let i = 0; i < nS; i++) {
    const py = y + h * ((i + 1) / (nS + 1));
    desenharHastePino(ctx, x + w, py, x + w + RAIO_PINO, py);
    desenharPinoSimbolo(ctx, x + w + RAIO_PINO, py, saidas[i].valor);
    if (saidas[i].nome && nS <= 6) desenharRotuloPino(ctx, saidas[i].nome, x + w, py, 'right');
  }
}

/* ===== MAPA DE DESENHADORES ===== */

export const DESENHADORES = {
  AND: (ctx, x, y, w, h) => desenharAND(ctx, x, y, w, h),
  OR: (ctx, x, y, w, h) => desenharOR(ctx, x, y, w, h),
  NOT: (ctx, x, y, w, h) => desenharNOT(ctx, x, y, w, h),
  NAND: (ctx, x, y, w, h) => desenharNAND(ctx, x, y, w, h),
  NOR: (ctx, x, y, w, h) => desenharNOR(ctx, x, y, w, h),
  XOR: (ctx, x, y, w, h) => desenharXOR(ctx, x, y, w, h),
  XNOR: (ctx, x, y, w, h) => desenharXNOR(ctx, x, y, w, h),
  BUFFER: (ctx, x, y, w, h) => desenharNOT(ctx, x, y, w, h),
  SWITCH: (ctx, x, y, w, h, comp) => desenharSWITCH(ctx, x, y, w, h, comp.estado.ativo === 1),
  LED: (ctx, x, y, w, h, comp) => desenharLED(ctx, x, y, w, h, comp.estado.aceso === true),
  CLOCK: (ctx, x, y, w, h) => desenharCLOCK(ctx, x, y, w, h),
  DFF: (ctx, x, y, w, h, comp) => desenharFLIPFLOP(ctx, x, y, w, h, 'D', comp.entradas, comp.saidas),
  JKFF: (ctx, x, y, w, h, comp) => desenharFLIPFLOP(ctx, x, y, w, h, 'JK', comp.entradas, comp.saidas),
  TFF: (ctx, x, y, w, h, comp) => desenharFLIPFLOP(ctx, x, y, w, h, 'T', comp.entradas, comp.saidas),
  SRFF: (ctx, x, y, w, h, comp) => desenharFLIPFLOP(ctx, x, y, w, h, 'SR', comp.entradas, comp.saidas),
  COUNTER: (ctx, x, y, w, h, comp) => desenharCONTADOR(ctx, x, y, w, h, comp.estado.valor || 0, comp.saidas.length),
  REGISTER: (ctx, x, y, w, h, comp) => desenharREGISTRADOR(ctx, x, y, w, h, comp.saidas.length),
  DISPLAY_7SEG: (ctx, x, y, w, h, comp) => {
    const segs = comp.saidas.map((s) => (s.valor === 1 ? 1 : 0));
    desenharDISPLAY7SEG(ctx, x, y, w, h, segs);
  },
};

export function desenharSimbolo(ctx, comp, x, y, w, h) {
  const desenhador = DESENHADORES[comp.tipo];
  if (desenhador) {
    desenhador(ctx, x, y, w, h, comp);
  } else {
    const entradas = comp.entradas.map((p, i) => ({ valor: p.valor, nome: p.nome || `I${i}` }));
    const saidas = comp.saidas.map((p, i) => ({ valor: p.valor, nome: p.nome || `O${i}` }));
    desenharCOMPOSTO(ctx, x, y, w, h, comp.rotulo, entradas, saidas);
  }
}

/**
 * Dimensões do componente.
 * IMPORTANTE: os pinos ficam FORA da caixa (à esquerda e à direita),
 * então a caixa é o corpo e o pino é desenhado em x-RAIO e x+w+RAIO.
 */
export function dimensoesSimbolo(tipo) {
  const especiais = {
    SWITCH: { w: 60, h: 60 },
    LED: { w: 60, h: 60 },
    CLOCK: { w: 80, h: 60 },
    DISPLAY_7SEG: { w: 70, h: 100 },
    COUNTER: { w: 100, h: 90 },
    REGISTER: { w: 110, h: 110 },
    DFF: { w: 90, h: 80 },
    JKFF: { w: 90, h: 90 },
    TFF: { w: 90, h: 80 },
    SRFF: { w: 90, h: 90 },
  };
  return especiais[tipo] || { w: 90, h: 70 };
}