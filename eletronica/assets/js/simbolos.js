/**
 * simbolos.js — Desenho técnico de cada componente eletrônico.
 *
 * Regras:
 * - Desenho em coordenadas LOCAIS fixas (dim.w × dim.h)
 * - Letra/número único do pino: DENTRO do círculo
 * - Nome com mais de um caractere: FORA, acima ou abaixo do pino
 * - Haste do pino encosta no corpo, sem invadir o desenho
 * - Setas dos transistores: simétricas, na direção da linha
 */

import { CATALOGO } from './catalogo.js';

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

/**
 * Desenha um pino com rótulo.
 * - Rótulo de 1 caractere: desenhado DENTRO do círculo
 * - Rótulo com 2+ caracteres: desenhado FORA, acima ou abaixo
 */
function desenharPinoComRotulo(ctx, x, y, valor, nome, posicaoRotulo) {
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

  if (!nome) return;

  const curto = nome.length <= 1;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (curto) {
    // Dentro do pino
    ctx.fillStyle = valor === 1 ? '#ffffff' : CORES.traco;
    ctx.font = '700 6px system-ui, sans-serif';
    ctx.fillText(nome, x, y + 0.5);
  } else {
    // Fora do pino, acima ou abaixo
    ctx.fillStyle = CORES.tracoFino;
    ctx.font = '600 7px system-ui, sans-serif';
    const offsetY = posicaoRotulo === 'baixo' ? RAIO_PINO + 7 : -(RAIO_PINO + 7);
    ctx.fillText(nome, x, y + offsetY);
  }

  ctx.restore();
}

/**
 * Desenha uma haste de pino: linha curta do círculo até o corpo.
 * x1,y1 = centro do pino; x2,y2 = ponto onde encosta no corpo.
 */
function haste(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.lineCap = 'round';
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

/**
 * Desenha uma seta com geometria correta ao longo de uma linha.
 * A ponta é simétrica e apontada na direção (dx, dy).
 */
function desenharSeta(ctx, x, y, dx, dy, tamanho = 7, cor = CORES.traco) {
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const px = -uy;
  const py = ux;

  const pontaX = x + ux * tamanho;
  const pontaY = y + uy * tamanho;
  const largura = tamanho * 0.42;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pontaX, pontaY);
  ctx.lineTo(x + px * largura, y + py * largura);
  ctx.lineTo(x - px * largura, y - py * largura);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = cor;
  ctx.stroke();
  ctx.restore();
}

/* ===== PASSIVOS ===== */

/**
 * Formata o valor de resistência para exibição.
 * Até 999 Ω, até 999,99 kΩ, acima disso MΩ.
 * Máximo 5 dígitos significativos.
 */
export function formatarResistencia(ohms) {
  if (!Number.isFinite(ohms) || ohms <= 0) return '—';

  const formatar = (valor) => {
    const arredondado = Math.round(valor * 100) / 100;
    if (arredondado >= 100) return String(Math.round(arredondado));
    if (arredondado >= 10) return arredondado.toFixed(1).replace(/\.0$/, '');
    return arredondado.toFixed(2).replace(/\.?0+$/, '');
  };

  if (ohms < 1000) return `${formatar(ohms)} Ω`;
  const kiloohms = ohms / 1000;
  if (Math.round(kiloohms * 100) / 100 < 1000) return `${formatar(kiloohms)} kΩ`;
  return `${formatar(ohms / 1e6)} MΩ`;
}

export function desenharRESISTOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const corpoW = w * 0.55;
  const corpoH = h * 0.42;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - corpoW / 2, cy);
  ctx.moveTo(cx + corpoW / 2, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(cx - corpoW / 2, cy - corpoH / 2, corpoW, corpoH);
  ctx.fill();
  ctx.stroke();

  const valor = comp.propriedades?.resistencia;
  if (valor !== undefined) {
    ctx.save();
    ctx.fillStyle = CORES.texto;
    ctx.font = '700 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatarResistencia(valor), cx, cy);
    ctx.restore();
  }
}

/**
 * Fusível: retângulo (padrão IEC) com a linha condutora
 * atravessando o corpo de ponta a ponta.
 * Quando queimado, a linha é rompida com um vão visível e as
 * pontas ficam afastadas, em vermelho, com um X no centro.
 */
export function desenharFUSIVEL(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const corpoW = w * 0.55;
  const corpoH = h * 0.42;
  const queimado = comp.propriedades?.queimado === true;

  // Hastes horizontais até o corpo
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - corpoW / 2, cy);
  ctx.moveTo(cx + corpoW / 2, cy);
  ctx.lineTo(x + w, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Corpo
  ctx.beginPath();
  ctx.rect(cx - corpoW / 2, cy - corpoH / 2, corpoW, corpoH);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Linha condutora horizontal atravessando o corpo
  ctx.beginPath();
  if (queimado) {
    // Rompimento: vão grande no meio, pontas afastadas
    const vao = corpoW * 0.25;
    ctx.moveTo(cx - corpoW / 2, cy);
    ctx.lineTo(cx - vao, cy);
    ctx.moveTo(cx + vao, cy);
    ctx.lineTo(cx + corpoW / 2, cy);
  } else {
    ctx.moveTo(cx - corpoW / 2, cy);
    ctx.lineTo(cx + corpoW / 2, cy);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = queimado ? '#c0392b' : CORES.traco;
  ctx.stroke();

  // Marca de queimado: pequeno X no vão
  if (queimado) {
    const r = 3;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy + r);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#c0392b';
    ctx.stroke();
  }
}

/**
 * Potenciômetro: resistor com corpo de cantos arredondados e seta
 * de cursor bem definida (haste + ponta triangular).
 */
export function desenharPOTENCIOMETRO(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const corpoW = w * 0.55;
  const corpoH = h * 0.42;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = 4;

  // Hastes
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - corpoW / 2, cy);
  ctx.moveTo(cx + corpoW / 2, cy);
  ctx.lineTo(x + w, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Corpo com cantos arredondados
  ctx.beginPath();
  ctx.roundRect(cx - corpoW / 2, cy - corpoH / 2, corpoW, corpoH, raio);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Seta do cursor: haste vertical + ponta triangular definida
  const topoSeta = cy - corpoH / 2 - 16;
  const baseSeta = cy - corpoH / 2 - 2;
  const larguraPonta = 4.5;
  const alturaPonta = 8;

  // Haste
  ctx.beginPath();
  ctx.moveTo(cx, topoSeta);
  ctx.lineTo(cx, baseSeta - alturaPonta);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Ponta triangular preenchida
  ctx.beginPath();
  ctx.moveTo(cx, baseSeta);
  ctx.lineTo(cx - larguraPonta, baseSeta - alturaPonta);
  ctx.lineTo(cx + larguraPonta, baseSeta - alturaPonta);
  ctx.closePath();
  ctx.fillStyle = CORES.traco;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  const valorPot = comp.propriedades?.resistencia;
  if (valorPot !== undefined) {
    ctx.save();
    ctx.fillStyle = CORES.texto;
    ctx.font = '700 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatarResistencia(valorPot), cx, cy);
    ctx.restore();
  }
}

export function desenharCAPACITOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gap = 5;
  const placaH = h * 0.5;

  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - gap, cy - placaH / 2);
  ctx.lineTo(cx - gap, cy + placaH / 2);
  ctx.moveTo(cx + gap, cy - placaH / 2);
  ctx.lineTo(cx + gap, cy + placaH / 2);
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function desenharINDUTOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cy = y + h / 2;
  const inicio = x + w * 0.2;
  const fim = x + w * 0.8;
  const n = 4;
  const passo = (fim - inicio) / n;
  const raio = passo / 2;

  // Hastes: da borda do corpo até o início e o fim da espiral
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(inicio, cy);
  ctx.moveTo(fim, cy);
  ctx.lineTo(x + w, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Espiral contínua: cada arco começa onde o anterior termina
  ctx.beginPath();
  ctx.moveTo(inicio, cy);
  for (let i = 0; i < n; i++) {
    const cxArco = inicio + passo * i + raio;
    ctx.arc(cxArco, cy, raio, Math.PI, 0, false);
  }
  ctx.stroke();
}

/**
 * Transformador: dois enrolamentos com núcleo.
 * As hastes horizontais das bobinas ENCOSTAM nos pinos.
 */
export function desenharTRANSFORMADOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;

  const nucleoH = h * 0.62;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - nucleoH / 2);
  ctx.lineTo(cx - 3, cy + nucleoH / 2);
  ctx.moveTo(cx + 3, cy - nucleoH / 2);
  ctx.lineTo(cx + 3, cy + nucleoH / 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  const n = 4;
  const alturaEnrol = 48; // de cy - 24 até cy + 24 (alinhado exatamente aos pinos)
  const passo = alturaEnrol / n;
  const raio = passo / 2;
  const yTopoBobina = cy - alturaEnrol / 2;
  const yBaseBobina = cy + alturaEnrol / 2;
  const xBobinaPrimario = cx - 16;
  const xBobinaSecundario = cx + 16;

  // Primário (esquerda): começa em (xBobinaPrimario, yTopoBobina) e termina em (xBobinaPrimario, yBaseBobina)
  ctx.beginPath();
  ctx.moveTo(xBobinaPrimario, yTopoBobina);
  for (let i = 0; i < n; i++) {
    const yy = yTopoBobina + passo * i + raio;
    ctx.arc(xBobinaPrimario, yy, raio, -Math.PI / 2, Math.PI / 2, true);
  }
  ctx.stroke();

  // Secundário (direita): começa em (xBobinaSecundario, yTopoBobina) e termina em (xBobinaSecundario, yBaseBobina)
  ctx.beginPath();
  ctx.moveTo(xBobinaSecundario, yTopoBobina);
  for (let i = 0; i < n; i++) {
    const yy = yTopoBobina + passo * i + raio;
    ctx.arc(xBobinaSecundario, yy, raio, -Math.PI / 2, Math.PI / 2, false);
  }
  ctx.stroke();

  // Pinos nas extremidades superior (yTopoBobina) e inferior (yBaseBobina) das bobinas
  const pinoP1 = { x: cx - w / 2, y: yTopoBobina };
  const pinoP2 = { x: cx - w / 2, y: yBaseBobina };
  const pinoS1 = { x: cx + w / 2, y: yTopoBobina };
  const pinoS2 = { x: cx + w / 2, y: yBaseBobina };

  // Mantém instâncias já existentes sincronizadas com as coordenadas das extremidades
  if (Array.isArray(comp.pinos)) {
    for (const p of comp.pinos) {
      if (p.id === 'p1') { p.x = -w / 2; p.y = -alturaEnrol / 2; }
      else if (p.id === 'p2') { p.x = -w / 2; p.y = alturaEnrol / 2; }
      else if (p.id === 's1') { p.x = w / 2; p.y = -alturaEnrol / 2; }
      else if (p.id === 's2') { p.x = w / 2; p.y = alturaEnrol / 2; }
    }
  }

  // Hastes do primário (esquerda): do pino até o ponto exato onde a bobina começa/termina
  ctx.beginPath();
  ctx.moveTo(pinoP1.x, pinoP1.y);
  ctx.lineTo(xBobinaPrimario, pinoP1.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pinoP2.x, pinoP2.y);
  ctx.lineTo(xBobinaPrimario, pinoP2.y);
  ctx.stroke();

  // Hastes do secundário (direita): do pino até o ponto exato onde a bobina começa/termina
  ctx.beginPath();
  ctx.moveTo(pinoS1.x, pinoS1.y);
  ctx.lineTo(xBobinaSecundario, pinoS1.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pinoS2.x, pinoS2.y);
  ctx.lineTo(xBobinaSecundario, pinoS2.y);
  ctx.stroke();
}

/* ===== SENSORES ===== */

export function desenharLDR(ctx, comp, x, y, w, h) {
  desenharRESISTOR(ctx, comp, x, y, w, h);
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const corpoH = h * 0.42;

  for (let i = 0; i < 2; i++) {
    const ox = cx - 10 + i * 12;
    const inicioY = cy - corpoH / 2 - 14;
    const fimY = cy - corpoH / 2 - 3;

    ctx.beginPath();
    ctx.moveTo(ox - 4, inicioY);
    ctx.lineTo(ox, fimY);
    ctx.stroke();

    desenharSeta(ctx, ox - 1.5, fimY - 5, 1, 1.3, 5);
  }
}

export function desenharTERMISTOR(ctx, comp, x, y, w, h) {
  desenharRESISTOR(ctx, comp, x, y, w, h);
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const corpoH = h * 0.42;
  const corpoW = w * 0.55;

  ctx.beginPath();
  ctx.moveTo(cx - corpoW / 2 - 4, cy + corpoH / 2 + 4);
  ctx.lineTo(cx + corpoW / 2 + 4, cy - corpoH / 2 - 4);
  ctx.stroke();
}

export function desenharFOTODIODO(ctx, comp, x, y, w, h) {
  desenharDIODO(ctx, comp, x, y, w, h);
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tam = h * 0.38;

  for (let i = 0; i < 2; i++) {
    const ox = cx - 8 + i * 10;
    const inicioY = cy - tam - 16;
    const fimY = cy - tam - 4;

    ctx.beginPath();
    ctx.moveTo(ox - 4, inicioY);
    ctx.lineTo(ox, fimY);
    ctx.stroke();

    desenharSeta(ctx, ox - 1.5, fimY - 5, 1, 1.3, 5);
  }
}

/* ===== SEMICONDUTORES ===== */

export function desenharDIODO(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tam = h * 0.38;

  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - tam, cy);
  ctx.moveTo(cx + tam, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - tam, cy - tam);
  ctx.lineTo(cx + tam, cy);
  ctx.lineTo(cx - tam, cy + tam);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + tam, cy - tam);
  ctx.lineTo(cx + tam, cy + tam);
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * LED: diodo com duas setas paralelas saindo na diagonal superior direita.
 * Setas cinzas quando apagado; coloridas com brilho quando aceso.
 */
export function desenharLED(ctx, comp, x, y, w, h) {
  desenharDIODO(ctx, comp, x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tam = h * 0.38;
  const aceso = comp.estado?.aceso === true;
  const cor = comp.propriedades?.cor || '#ff3b30';

  if (aceso) {
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 32);
    grad.addColorStop(0, cor + '99');
    grad.addColorStop(0.6, cor + '33');
    grad.addColorStop(1, cor + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const corSeta = aceso ? cor : CORES.tracoFino;

  ctx.save();
  ctx.globalAlpha = aceso ? 1 : 0.6;
  ctx.strokeStyle = corSeta;
  ctx.fillStyle = corSeta;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';

  // Duas setas paralelas, 45°, saindo do topo do triângulo
  for (let i = 0; i < 2; i++) {
    const baseX = cx - 2 + i * 9;
    const baseY = cy - tam - 4;
    const pontaX = baseX + 9;
    const pontaY = baseY - 9;

    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(pontaX, pontaY);
    ctx.stroke();

    const dx = 1 / Math.SQRT2;
    const dy = -1 / Math.SQRT2;
    const t = 5;
    const px = -dy;
    const py = dx;
    const larg = 2.1;

    ctx.beginPath();
    ctx.moveTo(pontaX, pontaY);
    ctx.lineTo(pontaX - dx * t + px * larg, pontaY - dy * t + py * larg);
    ctx.lineTo(pontaX - dx * t - px * larg, pontaY - dy * t - py * larg);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Transistor NPN.
 * - Traços diagonais do coletor e emissor ENCOSTAM na borda do círculo
 * - Traço horizontal do pivô vertical até a borda esquerda (pino B)
 * - Seta do emissor simétrica na direção da linha
 */
export function desenharTRANSISTOR_NPN(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) * 0.40;
  const R = raio;

  // Ângulos das linhas internas onde encontram a circunferência
  const anguloBase    = Math.PI;        // 180° (esquerda)
  const anguloColetor = -Math.PI / 4;   // -45° (superior direita)
  const anguloEmissor =  Math.PI / 4;   //  45° (inferior direita)

  const pontoNaBorda = (ang) => ({
    x: cx + R * Math.cos(ang),
    y: cy + R * Math.sin(ang),
  });

  const pB = pontoNaBorda(anguloBase);
  const pC = pontoNaBorda(anguloColetor);
  const pE = pontoNaBorda(anguloEmissor);

  // Círculo do corpo
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Pivô vertical (base interna)
  const baseX = cx - R * 0.30;
  const baseTopo = cy - R * 0.52;
  const baseBase = cy + R * 0.52;

  ctx.beginPath();
  ctx.moveTo(baseX, baseTopo);
  ctx.lineTo(baseX, baseBase);
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Traço interno do pivô até o ponto exato na borda esquerda (pB)
  ctx.beginPath();
  ctx.moveTo(baseX, cy);
  ctx.lineTo(pB.x, pB.y);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Coletor interno: da base até o ponto exato na borda (pC)
  const colInicioX = baseX;
  const colInicioY = cy - R * 0.30;

  ctx.beginPath();
  ctx.moveTo(colInicioX, colInicioY);
  ctx.lineTo(pC.x, pC.y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Emissor interno: da base até o ponto exato na borda (pE)
  const emiInicioX = baseX;
  const emiInicioY = cy + R * 0.30;

  ctx.beginPath();
  ctx.moveTo(emiInicioX, emiInicioY);
  ctx.lineTo(pE.x, pE.y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Traços externos dos pinos: da borda exata (pB, pC, pE) até cada pino
  const comprimentoPinoB = 40 - R;
  const comprimentoPinoCE = 32 * Math.SQRT2 - R;

  ctx.beginPath();
  ctx.moveTo(pB.x, pB.y);
  ctx.lineTo(pB.x - comprimentoPinoB, pB.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pC.x, pC.y);
  ctx.lineTo(pC.x + comprimentoPinoCE * Math.cos(anguloColetor),
             pC.y + comprimentoPinoCE * Math.sin(anguloColetor));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pE.x, pE.y);
  ctx.lineTo(pE.x + comprimentoPinoCE * Math.cos(anguloEmissor),
             pE.y + comprimentoPinoCE * Math.sin(anguloEmissor));
  ctx.stroke();

  // Seta do emissor (NPN: aponta para fora, na direção da linha)
  const dirX = pE.x - emiInicioX;
  const dirY = pE.y - emiInicioY;
  const dist = Math.hypot(dirX, dirY);
  const ux = dirX / dist;
  const uy = dirY / dist;

  const setaX = emiInicioX + ux * dist * 0.62;
  const setaY = emiInicioY + uy * dist * 0.62;
  desenharSeta(ctx, setaX, setaY, ux, uy, 8);
}

/**
 * Transistor PNP.
 * Emissor em cima (seta apontando para dentro), coletor embaixo.
 * Mesma geometria do NPN, com as diagonais invertidas.
 */
export function desenharTRANSISTOR_PNP(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) * 0.40;
  const R = raio;

  const anguloBase    = Math.PI;        // 180° (esquerda)
  const anguloEmissor = -Math.PI / 4;   // -45° (superior direita)
  const anguloColetor =  Math.PI / 4;   //  45° (inferior direita)

  const pontoNaBorda = (ang) => ({
    x: cx + R * Math.cos(ang),
    y: cy + R * Math.sin(ang),
  });

  const pB = pontoNaBorda(anguloBase);
  const pE = pontoNaBorda(anguloEmissor);
  const pC = pontoNaBorda(anguloColetor);

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  const baseX = cx - R * 0.30;
  const baseTopo = cy - R * 0.52;
  const baseBase = cy + R * 0.52;

  ctx.beginPath();
  ctx.moveTo(baseX, baseTopo);
  ctx.lineTo(baseX, baseBase);
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Traço do pivô até o ponto exato na borda esquerda (pB)
  ctx.beginPath();
  ctx.moveTo(baseX, cy);
  ctx.lineTo(pB.x, pB.y);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Emissor: para cima-direita, até a borda (pE)
  const emiInicioX = baseX;
  const emiInicioY = cy - R * 0.30;

  ctx.beginPath();
  ctx.moveTo(emiInicioX, emiInicioY);
  ctx.lineTo(pE.x, pE.y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Coletor: para baixo-direita, até a borda (pC)
  const colInicioX = baseX;
  const colInicioY = cy + R * 0.30;

  ctx.beginPath();
  ctx.moveTo(colInicioX, colInicioY);
  ctx.lineTo(pC.x, pC.y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Traços externos dos pinos: da borda exata (pB, pC, pE) até cada pino
  const comprimentoPinoB = 40 - R;
  const comprimentoPinoCE = 32 * Math.SQRT2 - R;

  ctx.beginPath();
  ctx.moveTo(pB.x, pB.y);
  ctx.lineTo(pB.x - comprimentoPinoB, pB.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pC.x, pC.y);
  ctx.lineTo(pC.x + comprimentoPinoCE * Math.cos(anguloColetor),
             pC.y + comprimentoPinoCE * Math.sin(anguloColetor));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pE.x, pE.y);
  ctx.lineTo(pE.x + comprimentoPinoCE * Math.cos(anguloEmissor),
             pE.y + comprimentoPinoCE * Math.sin(anguloEmissor));
  ctx.stroke();

  // Seta do emissor (PNP: aponta para dentro)
  const dirX = emiInicioX - pE.x;
  const dirY = emiInicioY - pE.y;
  const dist = Math.hypot(dirX, dirY);
  const ux = dirX / dist;
  const uy = dirY / dist;

  const setaX = pE.x + ux * dist * 0.38;
  const setaY = pE.y + uy * dist * 0.38;
  desenharSeta(ctx, setaX, setaY, ux, uy, 8);
}

/* ===== FONTES E CHAVES ===== */

/**
 * Bateria: quatro riscos (longo, curto, longo, curto).
 * Riscos maiores para melhor legibilidade.
 */
export function desenharBATERIA(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const longo = h * 0.46;
  const curto = h * 0.26;
  const espacamento = 5;

  const riscos = [
    { dx: -espacamento * 1.5, altura: longo },
    { dx: -espacamento * 0.5, altura: curto },
    { dx: espacamento * 0.5, altura: longo },
    { dx: espacamento * 1.5, altura: curto },
  ];

  const primeiro = cx + riscos[0].dx;
  const ultimo = cx + riscos[3].dx;

  // Hastes: da borda do corpo até o primeiro e do último até a borda
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(primeiro, cy);
  ctx.moveTo(ultimo, cy);
  ctx.lineTo(x + w, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Riscos verticais
  for (const r of riscos) {
    ctx.beginPath();
    ctx.moveTo(cx + r.dx, cy - r.altura / 2);
    ctx.lineTo(cx + r.dx, cy + r.altura / 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = CORES.traco;
    ctx.stroke();
  }
}

/**
 * Fonte AC: círculo com senoide.
 * As hastes de A e B terminam NA BORDA do círculo, sem atravessar.
 */
export function desenharFONTE_AC(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const raio = Math.min(w, h) * 0.34;

  // Hastes: da borda do corpo até a borda do círculo
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - raio, cy);
  ctx.moveTo(cx + raio, cy);
  ctx.lineTo(x + w, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Círculo
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Senoide interna
  const amp = raio * 0.42;
  const larg = raio * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx - larg, cy);
  ctx.quadraticCurveTo(cx - larg * 0.5, cy - amp, cx, cy);
  ctx.quadraticCurveTo(cx + larg * 0.5, cy + amp, cx + larg, cy);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
}

/**
 * Chave SPST (normalmente aberta).
 *
 * Geometria (coordenadas locais, cy = centro vertical):
 *   A (cinza) ──── ○ (branco, pivô)      ○ (branco, contato)  ──── B (cinza)
 *                    \  alavanca diagonal saindo do pivô
 *
 * Aberta: vão vazio entre os dois círculos brancos.
 * Fechada: a alavanca desce e une os dois círculos brancos.
 */
export function desenharCHAVE(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cy = y + h / 2;
  const cx = x + w / 2;

  // Posições absolutas
  const pinoA = x + 6;
  const pinoB = x + w - 6;
  const contatoEsq = cx - 9;
  const contatoDir = cx + 9;

  const fechada = comp.propriedades?.fechada === true;

  // Haste A → contato esquerdo
  ctx.beginPath();
  ctx.moveTo(pinoA, cy);
  ctx.lineTo(contatoEsq, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Haste contato direito → B
  ctx.beginPath();
  ctx.moveTo(contatoDir, cy);
  ctx.lineTo(pinoB, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Contato esquerdo: círculo branco (pivô)
  ctx.beginPath();
  ctx.arc(contatoEsq, cy, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Contato direito: círculo branco
  ctx.beginPath();
  ctx.arc(contatoDir, cy, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Alavanca articulada no contato ESQUERDO
  // Aberta: sobe na diagonal até acima do contato direito
  // Fechada: desce e une os dois contatos
  ctx.beginPath();
  ctx.moveTo(contatoEsq, cy);
  if (fechada) {
    ctx.lineTo(contatoDir, cy);
  } else {
    ctx.lineTo(contatoDir, cy - 13);
  }
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = fechada ? CORES.primaria : CORES.traco;
  ctx.stroke();
}

/**
 * Botão push-button (normalmente aberto).
 *
 * Geometria (coordenadas locais, cy = centro vertical):
 *   A (cinza) ──── ○ (branco)        ○ (branco)  ──── B (cinza)
 *                        [═══ barra do T ═══]
 *                              │ haste
 *
 * Solto: a barra do T fica ACIMA dos contatos (vão vazio entre eles).
 * Pressionado: o T desce e a barra encosta nos dois contatos.
 */
export function desenharBOTAO(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const cy = y + h / 2;
  const cx = x + w / 2;

  // Posições absolutas
  const pinoA = x + 6;
  const pinoB = x + w - 6;
  const contatoEsq = cx - 9;
  const contatoDir = cx + 9;

  const pressionado = comp.propriedades?.pressionado === true;

  // Haste A → contato esquerdo
  ctx.beginPath();
  ctx.moveTo(pinoA, cy);
  ctx.lineTo(contatoEsq, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Haste contato direito → B
  ctx.beginPath();
  ctx.moveTo(contatoDir, cy);
  ctx.lineTo(pinoB, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Contato esquerdo: círculo branco
  ctx.beginPath();
  ctx.arc(contatoEsq, cy, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Contato direito: círculo branco
  ctx.beginPath();
  ctx.arc(contatoDir, cy, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();

  // Atuador em "T" invertido
  // Solto: barra a 20px acima do centro (bem longe dos contatos)
  // Pressionado: barra a 3.2px acima do centro (encosta nos contatos)
  const alturaBarra = pressionado ? cy - 3.2 : cy - 20;
  const meiaBarra = 11;

  // Barra horizontal do T
  ctx.beginPath();
  ctx.moveTo(cx - meiaBarra, alturaBarra);
  ctx.lineTo(cx + meiaBarra, alturaBarra);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = pressionado ? CORES.primaria : CORES.traco;
  ctx.stroke();

  // Haste vertical do T (para cima)
  ctx.beginPath();
  ctx.moveTo(cx, alturaBarra);
  ctx.lineTo(cx, alturaBarra - 8);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
}

/* ===== LÓGICA ===== */

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

export function desenharNOT(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 4;
  const larguraTriangulo = w - raioBolinha * 2 - 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + larguraTriangulo, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraTriangulo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
}

export function desenharNAND(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 4;
  const larguraCorpo = w - raioBolinha * 2 - 2;
  const raio = h / 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + larguraCorpo - raio, y);
  ctx.arc(x + larguraCorpo - raio, y + raio, raio, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraCorpo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
}

export function desenharNOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 4;
  const larguraCorpo = w - raioBolinha * 2 - 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5, y, x + larguraCorpo, y + h / 2);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5, y + h, x, y + h);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.2, y + h / 2, x, y);
  ctx.closePath();
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraCorpo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
}

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

export function desenharXNOR(ctx, comp, x, y, w, h) {
  preparar(ctx);
  const raioBolinha = 4;
  const larguraCorpo = w - raioBolinha * 2 - 2;
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5 + 6, y, x + larguraCorpo, y + h / 2);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.5 + 6, y + h, x + 6, y + h);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.2 + 6, y + h / 2, x + 6, y);
  ctx.closePath();
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + larguraCorpo * 0.2, y + h / 2, x, y + h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + larguraCorpo + raioBolinha, y + h / 2, raioBolinha, 0, Math.PI * 2);
  ctx.fillStyle = CORES.preenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CORES.traco;
  ctx.stroke();
}

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

export function desenharDISPLAY_7SEG(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fillStyle = CORES.displayFundo;
  ctx.fill();
  ctx.stroke();

  const cor = comp.propriedades?.cor || '#ff3b30';
  const segs = comp.estado?.segmentos || [0, 0, 0, 0, 0, 0, 0];

  const m = 10;
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

  // Posição do pino COM (x = cx + 34, y = cy + 12)
  const pinoCom = { x: x + w / 2 + 34, y: y + h / 2 + 12 };

  // Desenha o texto "COM" ABAIXO do pino e FORA do retângulo preto do corpo (à direita de x + w)
  ctx.save();
  ctx.fillStyle = '#333';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('COM', pinoCom.x - 3, pinoCom.y + 8);
  ctx.restore();
}

export function desenharAMP_OP(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = CORES.traco;
  ctx.font = '700 11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('−', x + 12, y + h * 0.28);
  ctx.fillText('+', x + 12, y + h * 0.72);
  ctx.restore();
}

export function desenharCI_GENERICO(ctx, comp, x, y, w, h) {
  preparar(ctx);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w / 2, y, 5, 0, Math.PI);
  ctx.fillStyle = CORES.preenchimentoSuave;
  ctx.fill();
  ctx.stroke();

  const funcao = comp.propriedades?.funcao || 'CI';
  desenharRotulo(ctx, funcao.toUpperCase(), x + w / 2, y + h / 2, 9);
}

/* ===== MAPA ===== */

export const DESENHADORES = {
  RESISTOR: desenharRESISTOR,
  FUSIVEL: desenharFUSIVEL,
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
 * Desenha apenas os círculos dos pinos e seus rótulos.
 * As hastes são desenhadas por cada componente, onde devem terminar.
 */
function desenharPinosDoComponente(ctx, comp, dim) {
  const centroX = dim.w / 2;
  const centroY = dim.h / 2;

  for (const pino of comp.pinos) {
    const px = centroX + pino.x;
    const py = centroY + pino.y;

    // O rótulo COM do DISPLAY_7SEG já é desenhado fora do corpo em desenharDISPLAY_7SEG
    const nome = (comp.tipo === 'DISPLAY_7SEG' && pino.id === 'com') ? '' : pino.nome;
    const posicaoRotulo = pino.y > 0 ? 'baixo' : 'cima';
    desenharPinoComRotulo(ctx, px, py, pino.valor, nome, posicaoRotulo);
  }
}

/**
 * Desenha um componente completo com transformação uniforme.
 */
export function desenharComponente(ctx, comp, telaX, telaY, escala) {
  const dim = comp.dimensoes || CATALOGO[comp.tipo]?.dimensoes || { w: 80, h: 60 };
  const cx = dim.w / 2;
  const cy = dim.h / 2;

  ctx.save();
  ctx.translate(telaX + cx * escala, telaY + cy * escala);
  ctx.rotate(((comp.rotacao || 0) * Math.PI) / 180);
  ctx.scale(escala, escala);
  ctx.translate(-cx, -cy);

  const desenhador = DESENHADORES[comp.tipo];
  if (desenhador) {
    desenhador(ctx, comp, 0, 0, dim.w, dim.h);
  } else {
    preparar(ctx);
    ctx.beginPath();
    ctx.rect(0, 0, dim.w, dim.h);
    ctx.fill();
    ctx.stroke();
    desenharRotulo(ctx, comp.tipo, cx, cy, 9);
  }

  desenharPinosDoComponente(ctx, comp, dim);

  ctx.restore();
}

/**
 * Calcula a posição absoluta de um pino em coordenadas de mundo.
 * Aceita tanto o id do pino (string) quanto o próprio objeto pino.
 */
export function posicaoPino(comp, pinoOuId) {
  const pinos = comp.pinos || CATALOGO[comp.tipo]?.pinos || [];
  const pino = (typeof pinoOuId === 'object' && pinoOuId !== null)
    ? pinoOuId
    : pinos.find((p) => p.id === pinoOuId);
  if (!pino) return null;

  const dim = comp.dimensoes || CATALOGO[comp.tipo]?.dimensoes || { w: 80, h: 60 };
  const cx = dim.w / 2;
  const cy = dim.h / 2;

  const rad = ((comp.rotacao || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotX = pino.x * cos - pino.y * sin;
  const rotY = pino.x * sin + pino.y * cos;

  return {
    x: comp.x + cx + rotX,
    y: comp.y + cy + rotY,
  };
}
