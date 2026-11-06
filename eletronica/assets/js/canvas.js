/**
 * canvas.js — Renderização do circuito em Canvas 2D.
 * Grade, componentes com símbolos técnicos, seleção e rotação.
 */

import { desenharComponente, CORES } from './simbolos.js';
import { CATALOGO } from './catalogo.js';
import { desenharFios, desenharFioFantasma } from './fios.js';
import { desenharGrupos, desenharSelecaoRetangular } from './grupos.js';

export const GRADE_BASE = 40;        // espaçamento base em unidades de mundo
export const SUBDIVISOES = 4;        // cada célula tem 4x4 subdivisões
export const ESPACO_MINIMO_PX = 8;   // abaixo disso, o nível é desligado

export const TAMANHO_GRADE = 10;

/**
 * Calcula os níveis de grade visíveis para o zoom atual.
 */
export function calcularNiveisGrade(zoom) {
  let base = GRADE_BASE;

  // Enquanto a grade mais grossa for pequena demais, dobra o passo
  while (base * zoom < ESPACO_MINIMO_PX) {
    base *= 2;
  }

  const niveis = [];
  let espacoMundo = base;

  for (let n = 0; n <= 3; n++) {
    const espacoPx = espacoMundo * zoom;
    if (espacoPx >= ESPACO_MINIMO_PX) {
      niveis.push({ espacoMundo, espacoPx, nivel: n });
    }
    espacoMundo = espacoMundo / SUBDIVISOES;
  }

  return niveis;
}

/**
 * Arredonda um valor para o ponto mais próximo da grade.
 */
export function snap(valor, tamanho = TAMANHO_GRADE) {
  return Math.round(valor / tamanho) * tamanho;
}

export function criarCanvas(elemento, estado) {
  const ctx = elemento.getContext('2d');
  if (estado && typeof estado.offsetOrigemX === 'undefined') {
    estado.offsetOrigemX = 260;
  }
  const view = {
    zoom: 1,
    panX: 0,
    panY: 0,
    get offsetOrigemX() {
      return estado?.offsetOrigemX || 0;
    },
  };

  elemento.addEventListener('contextmenu', (e) => e.preventDefault());

  let ultimoMouse = { x: 0, y: 0 };
  elemento.addEventListener('mousemove', (e) => {
    const rect = elemento.getBoundingClientRect();
    ultimoMouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const mundo = telaParaMundo(ultimoMouse.x, ultimoMouse.y);
    if (typeof estado !== 'undefined' && estado) {
      estado.ultimoMouse = mundo;
    }
  });

  function redimensionar() {
    const dpr = window.devicePixelRatio || 1;
    const rect = elemento.getBoundingClientRect();
    elemento.width = rect.width * dpr;
    elemento.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function telaParaMundo(x, y) {
    const offX = estado?.offsetOrigemX || 0;
    return { x: (x - offX - view.panX) / view.zoom, y: (y - view.panY) / view.zoom };
  }

  function mundoParaTela(x, y) {
    const offX = estado?.offsetOrigemX || 0;
    return { x: x * view.zoom + view.panX + offX, y: y * view.zoom + view.panY };
  }

  function tela(pt) {
    return mundoParaTela(pt.x, pt.y);
  }

  function desenharGuias(ctx) {
    const g = estado.guiaAtiva;
    if (!g) return;

    const largura = ctx.canvas.width / (window.devicePixelRatio || 1);
    const altura  = ctx.canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Guia VERTICAL (alinhamento em X) — cobre toda a altura
    if (g.guiaX !== null && g.guiaX !== undefined) {
      const px = tela({ x: g.guiaX, y: 0 }).x;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, altura);
      ctx.stroke();
    }

    // Guia HORIZONTAL (alinhamento em Y) — cobre toda a largura
    if (g.guiaY !== null && g.guiaY !== undefined) {
      const py = tela({ x: 0, y: g.guiaY }).y;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(largura, py);
      ctx.stroke();
    }

    ctx.restore();
  }

  function desenharGrade(c = ctx, v = view) {
    const rect = elemento.getBoundingClientRect();
    const larguraCanvas = rect.width;
    const alturaCanvas = rect.height;

    c.save();
    c.fillStyle = '#f5f6f7';
    c.fillRect(0, 0, larguraCanvas, alturaCanvas);

    const zoom = v.zoom;
    const offX = v.offsetOrigemX || 0;
    const panX = v.panX;
    const panY = v.panY;

    const niveis = calcularNiveisGrade(zoom);

    // Desenha do mais fino para o mais grosso para que a grade principal fique por cima
    const niveisOrdenados = [...niveis].reverse();

    for (const nivel of niveisOrdenados) {
      // Quanto mais fino o nível, mais claro o traço
      const alpha = nivel.nivel === 0 ? 0.12 : 0.06;
      const espessura = nivel.nivel === 0 ? 1 : 0.5;

      c.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      c.lineWidth = espessura;
      c.beginPath();

      // Linhas verticais
      const passoMundo = nivel.espacoMundo;
      const x0Mundo = Math.floor(
        (0 - offX - panX) / zoom / passoMundo
      ) * passoMundo;
      const x1Mundo = (larguraCanvas - offX - panX) / zoom;

      for (let x = x0Mundo; x <= x1Mundo + passoMundo * 0.01; x += passoMundo) {
        const px = Math.round(x * zoom + panX + offX) + 0.5;
        c.moveTo(px, 0);
        c.lineTo(px, alturaCanvas);
      }

      // Linhas horizontais (mesma lógica com panY)
      const y0Mundo = Math.floor(
        (0 - panY) / zoom / passoMundo
      ) * passoMundo;
      const y1Mundo = (alturaCanvas - panY) / zoom;

      for (let y = y0Mundo; y <= y1Mundo + passoMundo * 0.01; y += passoMundo) {
        const py = Math.round(y * zoom + panY) + 0.5;
        c.moveTo(0, py);
        c.lineTo(larguraCanvas, py);
      }

      c.stroke();
    }

    c.restore();
  }

  function desenharSelecao(comp) {
    const dim = CATALOGO[comp.tipo].dimensoes;
    const tela = mundoParaTela(comp.x, comp.y);
    const w = dim.w * view.zoom;
    const h = dim.h * view.zoom;

    ctx.save();
    ctx.strokeStyle = CORES.primaria;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(tela.x - 8, tela.y - 8, w + 16, h + 16);
    ctx.restore();
  }

  function render(circuito, selecionados = [], fioSelecionadoId = null, dobraSelecionada = null, fioFantasma = null, selecaoRetangular = null, grupoSelecionadoId = null) {
    desenharGrade();

    // Grupos primeiro (atrás de tudo)
    desenharGrupos(ctx, circuito, view, grupoSelecionadoId);

    // Fios
    desenharFios(ctx, circuito, view, fioSelecionadoId, dobraSelecionada);

    // Guias visuais de alinhamento
    desenharGuias(ctx);

    // Componentes
    for (const comp of circuito.componentes) {
      const tela = mundoParaTela(comp.x, comp.y);
      desenharComponente(ctx, comp, tela.x, tela.y, view.zoom);
    }

    // Seleção de componentes
    for (const id of selecionados) {
      const comp = circuito.componentes.find((c) => c.id === id);
      if (comp) desenharSelecao(comp);
    }

    // Fio fantasma
    if (fioFantasma) {
      desenharFioFantasma(ctx, view, fioFantasma.origem, fioFantasma.cursor, fioFantasma.cor);
    }

    // Seleção retangular em andamento
    if (selecaoRetangular) {
      desenharSelecaoRetangular(
        ctx,
        selecaoRetangular.x1, selecaoRetangular.y1,
        selecaoRetangular.x2, selecaoRetangular.y2
      );
    }
  }

  return {
    view,
    redimensionar,
    render,
    telaParaMundo,
    mundoParaTela,
    get ctx() { return ctx; },
    get elemento() { return elemento; },
    get ultimoMouse() { return ultimoMouse; },
    set ultimoMouse(valor) { if (valor) ultimoMouse = valor; },
  };
}
