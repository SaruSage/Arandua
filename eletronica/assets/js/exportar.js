/**
 * exportar.js — Exportação do circuito como imagem PNG.
 *
 * Renderiza o circuito em um canvas offscreen com margem e fundo
 * branco, e baixa como .png.
 */

import { CATALOGO } from './catalogo.js';
import { desenharComponente } from './simbolos.js';
import { desenharGrupos } from './grupos.js';

const MARGEM = 40;
const ESCALA_EXPORT = 2; // 2× para nitidez em telas retina

/**
 * Calcula o retângulo delimitador de todo o circuito.
 */
function calcularBounds(circuito) {
  if (circuito.componentes.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const comp of circuito.componentes) {
    const dim = CATALOGO[comp.tipo].dimensoes;
    minX = Math.min(minX, comp.x);
    minY = Math.min(minY, comp.y);
    maxX = Math.max(maxX, comp.x + dim.w);
    maxY = Math.max(maxY, comp.y + dim.h);
  }

  // Inclui grupos (podem se estender além dos componentes)
  for (const g of circuito.grupos) {
    minX = Math.min(minX, g.bounds.x);
    minY = Math.min(minY, g.bounds.y - 24);
    maxX = Math.max(maxX, g.bounds.x + g.bounds.w);
    maxY = Math.max(maxY, g.bounds.y + g.bounds.h);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Desenha o circuito em um canvas offscreen e retorna o canvas.
 */
export function renderizarParaCanvas(circuito) {
  const bounds = calcularBounds(circuito);
  if (!bounds) return null;

  const largura = (bounds.maxX - bounds.minX) + MARGEM * 2;
  const altura = (bounds.maxY - bounds.minY) + MARGEM * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(largura * ESCALA_EXPORT);
  canvas.height = Math.ceil(altura * ESCALA_EXPORT);

  const ctx = canvas.getContext('2d');

  // Fundo branco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Transformação: desloca para a margem e aplica a escala
  ctx.save();
  ctx.scale(ESCALA_EXPORT, ESCALA_EXPORT);
  ctx.translate(MARGEM - bounds.minX, MARGEM - bounds.minY);

  // View fictícia para desenhar grupos em coordenadas de mundo
  const view = { zoom: 1, panX: 0, panY: 0 };

  // Grupos primeiro (atrás)
  desenharGrupos(ctx, circuito, view, null);

  // Fios
  ctx.save();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const fio of circuito.fios) {
    const compO = circuito.componentes.find((c) => c.id === fio.origem.componente);
    const compD = circuito.componentes.find((c) => c.id === fio.destino.componente);
    if (!compO || !compD) continue;

    const pO = posicaoPinoExport(compO, fio.origem.pino);
    const pD = posicaoPinoExport(compD, fio.destino.pino);
    if (!pO || !pD) continue;

    ctx.beginPath();
    ctx.moveTo(pO.x, pO.y);

    // Desenha as dobras
    for (const d of fio.dobras || []) {
      ctx.lineTo(d.x, d.y);
    }

    ctx.lineTo(pD.x, pD.y);
    ctx.stroke();
  }
  ctx.restore();

  // Componentes
  for (const comp of circuito.componentes) {
    desenharComponente(ctx, comp, comp.x, comp.y, 1);
  }

  ctx.restore();

  return canvas;
}

/**
 * Calcula a posição de um pino em coordenadas de mundo.
 * Duplicado localmente para evitar dependência circular.
 */
function posicaoPinoExport(comp, pinoId) {
  const pino = comp.pinos.find((p) => p.id === pinoId);
  if (!pino) return null;

  const dim = comp.dimensoes || { w: 80, h: 60 };
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

/**
 * Exporta o circuito como PNG e baixa o arquivo.
 */
export function exportarPNG(circuito, nomeArquivo = 'circuito.png') {
  const canvas = renderizarParaCanvas(circuito);
  if (!canvas) {
    alert('O circuito está vazio. Adicione componentes antes de exportar.');
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      alert('Não foi possível gerar a imagem.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}