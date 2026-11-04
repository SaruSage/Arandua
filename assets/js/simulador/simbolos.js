/**
 * simbolos.js — Desenho dos símbolos reais dos componentes.
 * Cada função desenha no contexto 2D dentro de uma caixa (x, y, w, h).
 * Estilo: traço grosso arredondado, cores alegres, fiel ao padrão IEC.
 */

/** Paleta de cores dos símbolos. */
export const CORES_SIMBOLO = {
  traco: '#2f3e36',
  preenchimento: '#ffffff',
  preenchimentoAtivo: '#d8f5e8',
  primaria: '#53b588',
  primariaEscura: '#3e9670',
  acento: '#ffb340',
  acentoEscuro: '#e09a24',
  erro: '#e05a5a',
  texto: '#191919',
  pino: '#53b588',
  pinoAtivo: '#3e9670',
  pinoIndefinido: '#b8c4be',
  ledApagado: '#d4ddd8',
  ledAceso: '#ffb340',
  sombra: 'rgba(25, 25, 25, 0.08)',
};

/** Espessura do traço dos símbolos. */
const TRACO = 3;

/** Configura o contexto para desenho de símbolo. */
function preparar(ctx) {
  ctx.lineWidth = TRACO;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = CORES_SIMBOLO.traco;
  ctx.fillStyle = CORES_SIMBOLO.preenchimento;
}

/** Desenha um pino (círculo) na posição. */
function desenharPinoSimbolo(ctx, x, y, valor, raio = 5) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  if (valor === 1) ctx.fillStyle = CORES_SIMBOLO.pinoAtivo;
  else if (valor === 0) ctx.fillStyle = CORES_SIMBOLO.pino;
  else ctx.fillStyle = CORES_SIMBOLO.pinoIndefinido;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES_SIMBOLO.traco;
  ctx.stroke();
  ctx.restore();
}

/** Desenha o rótulo do componente centralizado. */
function desenharRotulo(ctx, texto, cx, cy, tamanho = 11) {
  ctx.save();
  ctx.fillStyle = CORES_SIMBOLO.texto;
  ctx.font = `700 ${tamanho}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, cx, cy);
  ctx.restore();
}

/** Desenha o rótulo de um pino ao lado do círculo. */
function desenharRotuloPino(ctx, texto, x, y, alinhamento = 'left') {
  ctx.save();
  ctx.fillStyle = CORES_SIMBOLO.traco;
  ctx.font = '600 9px system-ui, sans-serif';
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'middle';
  const offset = alinhamento === 'left' ? 10 : -10;
  ctx.fillText(texto, x + offset, y);
  ctx.restore();
}

/**
 * Desenha uma porta AND (formato D).
 * Corpo: retângulo com lado direito semicircular.
 */
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

/** Desenha uma porta OR (formato curvo). */
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

/** Desenha uma porta XOR (OR com curva extra na entrada). */
export function desenharXOR(ctx, x, y, w, h) {
  preparar(ctx);
  // Corpo da OR
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.quadraticCurveTo(x + w * 0.5 + 8, y, x + w, y + h / 2);
  ctx.quadraticCurveTo(x + w * 0.5 + 8, y + h, x + 8, y + h);
  ctx.quadraticCurveTo(x + w * 0.2 + 8, y + h / 2, x + 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Curva extra da XOR
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w * 0.2, y + h / 2, x, y + h);
  ctx.stroke();
}

/** Desenha uma porta NOT (triângulo com bolinha). */
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
  // Bolinha de negação
  ctx.beginPath();
  ctx.arc(x + larguraTriangulo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fillStyle = CORES_SIMBOLO.preenchimento;
  ctx.fill();
  ctx.stroke();
}

/** Desenha uma porta NAND (AND com bolinha). */
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

/** Desenha uma porta NOR (OR com bolinha). */
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

/** Desenha uma porta XNOR (XOR com bolinha). */
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

/** Desenha um switch (alavanca). */
export function desenharSWITCH(ctx, x, y, w, h, ativo) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) / 2 - 4;

  // Base circular
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = ativo ? CORES_SIMBOLO.preenchimentoAtivo : CORES_SIMBOLO.preenchimento;
  ctx.fill();
  ctx.stroke();

  // Alavanca
  ctx.beginPath();
  ctx.moveTo(cx, cy + raio * 0.5);
  const angulo = ativo ? -Math.PI / 4 : Math.PI / 4;
  ctx.lineTo(cx + Math.cos(angulo) * raio * 0.8, cy + Math.sin(angulo) * raio * 0.8);
  ctx.lineWidth = 4;
  ctx.strokeStyle = ativo ? CORES_SIMBOLO.primariaEscura : CORES_SIMBOLO.traco;
  ctx.stroke();

  // Bolinha da ponta
  ctx.beginPath();
  ctx.arc(cx + Math.cos(angulo) * raio * 0.8, cy + Math.sin(angulo) * raio * 0.8, 4, 0, Math.PI * 2);
  ctx.fillStyle = ativo ? CORES_SIMBOLO.primaria : CORES_SIMBOLO.traco;
  ctx.fill();
}

/** Desenha um LED (círculo com brilho quando aceso). */
export function desenharLED(ctx, x, y, w, h, aceso) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) / 2 - 4;

  // Brilho externo quando aceso
  if (aceso) {
    ctx.save();
    const gradiente = ctx.createRadialGradient(cx, cy, raio * 0.5, cx, cy, raio * 2);
    gradiente.addColorStop(0, 'rgba(255, 179, 64, 0.5)');
    gradiente.addColorStop(1, 'rgba(255, 179, 64, 0)');
    ctx.fillStyle = gradiente;
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Corpo do LED
  preparar(ctx);
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = aceso ? CORES_SIMBOLO.ledAceso : CORES_SIMBOLO.ledApagado;
  ctx.fill();
  ctx.stroke();

  // Reflexo
  ctx.beginPath();
  ctx.arc(cx - raio * 0.3, cy - raio * 0.3, raio * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();
}

/** Desenha um clock (onda quadrada). */
export function desenharCLOCK(ctx, x, y, w, h) {
  preparar(ctx);
  const margem = 8;
  const x0 = x + margem;
  const x1 = x + w - margem;
  const y0 = y + h / 2;
  const amplitude = h / 2 - margem;
  const larguraQuarto = (x1 - x0) / 4;

  ctx.beginPath();
  ctx.moveTo(x0, y0 + amplitude);
  ctx.lineTo(x0 + larguraQuarto, y0 + amplitude);
  ctx.lineTo(x0 + larguraQuarto, y0 - amplitude);
  ctx.lineTo(x0 + larguraQuarto * 3, y0 - amplitude);
  ctx.lineTo(x0 + larguraQuarto * 3, y0 + amplitude);
  ctx.lineTo(x1, y0 + amplitude);
  ctx.strokeStyle = CORES_SIMBOLO.primaria;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Desenha um flip-flop genérico (caixa com pinos e rótulo). */
export function desenharFLIPFLOP(ctx, x, y, w, h, rotulo, entradas, saidas) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();

  // Rótulo central
  desenharRotulo(ctx, rotulo, x + w / 2, y + h / 2, 11);

  // Pinos de entrada (esquerda)
  const numEntradas = entradas.length;
  for (let i = 0; i < numEntradas; i++) {
    const py = y + h * ((i + 1) / (numEntradas + 1));
    desenharPinoSimbolo(ctx, x, py, entradas[i].valor);
    if (entradas[i].nome) {
      desenharRotuloPino(ctx, entradas[i].nome, x, py, 'left');
    }
  }

  // Pinos de saída (direita)
  const numSaidas = saidas.length;
  for (let i = 0; i < numSaidas; i++) {
    const py = y + h * ((i + 1) / (numSaidas + 1));
    desenharPinoSimbolo(ctx, x + w, py, saidas[i].valor);
    if (saidas[i].nome) {
      desenharRotuloPino(ctx, saidas[i].nome, x + w, py, 'right');
    }
  }

  // Triângulo do clock (entrada inferior esquerda)
  if (rotulo.includes('FF')) {
    const py = y + h * 0.75;
    ctx.beginPath();
    ctx.moveTo(x, py - 6);
    ctx.lineTo(x + 10, py);
    ctx.lineTo(x, py + 6);
    ctx.strokeStyle = CORES_SIMBOLO.traco;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** Desenha um contador (caixa com pinos de saída binária). */
export function desenharCONTADOR(ctx, x, y, w, h, valor, bits) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();

  // Rótulo "CTR"
  desenharRotulo(ctx, 'CTR', x + w / 2, y + 14, 10);

  // Valor decimal no centro
  ctx.save();
  ctx.fillStyle = CORES_SIMBOLO.primariaEscura;
  ctx.font = '800 16px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(valor), x + w / 2, y + h / 2 + 4);
  ctx.restore();

  // Pinos de saída
  for (let i = 0; i < bits; i++) {
    const py = y + h * ((i + 1) / (bits + 1));
    const bit = (valor >> i) & 1;
    desenharPinoSimbolo(ctx, x + w, py, bit);
    desenharRotuloPino(ctx, `Q${i}`, x + w, py, 'right');
  }
}

/** Desenha um registrador (caixa com pinos de entrada e saída). */
export function desenharREGISTRADOR(ctx, x, y, w, h, bits) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();

  desenharRotulo(ctx, 'REG', x + w / 2, y + 14, 10);

  for (let i = 0; i < bits; i++) {
    const py = y + h * ((i + 1) / (bits + 1));
    desenharPinoSimbolo(ctx, x, py, null);
    desenharRotuloPino(ctx, `D${i}`, x, py, 'left');
    desenharPinoSimbolo(ctx, x + w, py, null);
    desenharRotuloPino(ctx, `Q${i}`, x + w, py, 'right');
  }
}

/** Desenha um display de 7 segmentos (formato real). */
export function desenharDISPLAY7SEG(ctx, x, y, w, h, segmentos) {
  preparar(ctx);
  // Corpo
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fillStyle = '#1a1d27';
  ctx.fill();
  ctx.stroke();

  // Segmentos (a, b, c, d, e, f, g)
  const margem = 8;
  const larguraSeg = w - margem * 2;
  const alturaSeg = h - margem * 2;
  const espessura = 6;

  const segmentosPos = {
    a: { x: x + margem + espessura, y: y + margem, w: larguraSeg - espessura * 2, h: espessura },
    b: { x: x + w - margem - espessura, y: y + margem + espessura, w: espessura, h: alturaSeg / 2 - espessura },
    c: { x: x + w - margem - espessura, y: y + h / 2 + espessura / 2, w: espessura, h: alturaSeg / 2 - espessura },
    d: { x: x + margem + espessura, y: y + h - margem - espessura, w: larguraSeg - espessura * 2, h: espessura },
    e: { x: x + margem, y: y + h / 2 + espessura / 2, w: espessura, h: alturaSeg / 2 - espessura },
    f: { x: x + margem, y: y + margem + espessura, w: espessura, h: alturaSeg / 2 - espessura },
    g: { x: x + margem + espessura, y: y + h / 2 - espessura / 2, w: larguraSeg - espessura * 2, h: espessura },
  };

  const nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (let i = 0; i < 7; i++) {
    const nome = nomes[i];
    const pos = segmentosPos[nome];
    const aceso = segmentos[i] === 1;
    ctx.beginPath();
    ctx.roundRect(pos.x, pos.y, pos.w, pos.h, espessura / 2);
    ctx.fillStyle = aceso ? '#ffb340' : '#2a2f3e';
    ctx.fill();
  }
}

/** Desenha um componente composto genérico (caixa com rótulo e pinos). */
export function desenharCOMPOSTO(ctx, x, y, w, h, rotulo, entradas, saidas) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  desenharRotulo(ctx, rotulo, x + w / 2, y + h / 2, 10);

  const numEntradas = entradas.length;
  for (let i = 0; i < numEntradas; i++) {
    const py = y + h * ((i + 1) / (numEntradas + 1));
    desenharPinoSimbolo(ctx, x, py, entradas[i].valor);
    if (entradas[i].nome && numEntradas <= 6) {
      desenharRotuloPino(ctx, entradas[i].nome, x, py, 'left');
    }
  }

  const numSaidas = saidas.length;
  for (let i = 0; i < numSaidas; i++) {
    const py = y + h * ((i + 1) / (numSaidas + 1));
    desenharPinoSimbolo(ctx, x + w, py, saidas[i].valor);
    if (saidas[i].nome && numSaidas <= 6) {
      desenharRotuloPino(ctx, saidas[i].nome, x + w, py, 'right');
    }
  }
}

/**
 * Mapa de funções de desenho por tipo de componente.
 * Recebe (ctx, x, y, w, h, comp) e desenha o símbolo.
 */
export const DESENHADORES = {
  AND: (ctx, x, y, w, h) => desenharAND(ctx, x, y, w, h),
  OR: (ctx, x, y, w, h) => desenharOR(ctx, x, y, w, h),
  NOT: (ctx, x, y, w, h) => desenharNOT(ctx, x, y, w, h),
  NAND: (ctx, x, y, w, h) => desenharNAND(ctx, x, y, w, h),
  NOR: (ctx, x, y, w, h) => desenharNOR(ctx, x, y, w, h),
  XOR: (ctx, x, y, w, h) => desenharXOR(ctx, x, y, w, h),
  XNOR: (ctx, x, y, w, h) => desenharXNOR(ctx, x, y, w, h),
  BUFFER: (ctx, x, y, w, h) => desenharNOT(ctx, x, y, w, h),
  SWITCH: (ctx, x, y, w, h, comp) =>
    desenharSWITCH(ctx, x, y, w, h, comp.estado.ativo === 1),
  LED: (ctx, x, y, w, h, comp) =>
    desenharLED(ctx, x, y, w, h, comp.estado.aceso === true),
  CLOCK: (ctx, x, y, w, h) => desenharCLOCK(ctx, x, y, w, h),
  DFF: (ctx, x, y, w, h, comp) =>
    desenharFLIPFLOP(ctx, x, y, w, h, 'D', comp.entradas, comp.saidas),
  JKFF: (ctx, x, y, w, h, comp) =>
    desenharFLIPFLOP(ctx, x, y, w, h, 'JK', comp.entradas, comp.saidas),
  TFF: (ctx, x, y, w, h, comp) =>
    desenharFLIPFLOP(ctx, x, y, w, h, 'T', comp.entradas, comp.saidas),
  SRFF: (ctx, x, y, w, h, comp) =>
    desenharFLIPFLOP(ctx, x, y, w, h, 'SR', comp.entradas, comp.saidas),
  COUNTER: (ctx, x, y, w, h, comp) =>
    desenharCONTADOR(ctx, x, y, w, h, comp.estado.valor || 0, comp.saidas.length),
  REGISTER: (ctx, x, y, w, h, comp) =>
    desenharREGISTRADOR(ctx, x, y, w, h, comp.saidas.length),
  DISPLAY_7SEG: (ctx, x, y, w, h, comp) => {
    const segs = comp.saidas.map((s) => s.valor === 1 ? 1 : 0);
    desenharDISPLAY7SEG(ctx, x, y, w, h, segs);
  },
};

/** Desenha um componente usando o desenhador apropriado. */
export function desenharSimbolo(ctx, comp, x, y, w, h) {
  const desenhador = DESENHADORES[comp.tipo];
  if (desenhador) {
    desenhador(ctx, x, y, w, h, comp);
  } else {
    // Fallback: componente composto genérico
    const entradas = comp.entradas.map((p, i) => ({ valor: p.valor, nome: p.nome || `I${i}` }));
    const saidas = comp.saidas.map((p, i) => ({ valor: p.valor, nome: p.nome || `O${i}` }));
    desenharCOMPOSTO(ctx, x, y, w, h, comp.rotulo, entradas, saidas);
  }
}

/** Retorna as dimensões ideais de um componente para o desenho. */
export function dimensoesSimbolo(tipo) {
  const especiais = {
    SWITCH: { w: 50, h: 50 },
    LED: { w: 50, h: 50 },
    CLOCK: { w: 70, h: 50 },
    DISPLAY_7SEG: { w: 60, h: 90 },
    COUNTER: { w: 90, h: 80 },
    REGISTER: { w: 100, h: 100 },
    DFF: { w: 80, h: 70 },
    JKFF: { w: 80, h: 80 },
    TFF: { w: 80, h: 70 },
    SRFF: { w: 80, h: 80 },
  };
  return especiais[tipo] || { w: 80, h: 60 };
}