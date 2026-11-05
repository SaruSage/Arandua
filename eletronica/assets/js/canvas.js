/**
 * canvas.js — Renderização do circuito em Canvas 2D.
 * Grade, componentes com símbolos técnicos, seleção e rotação.
 */

import { desenharComponente, CORES } from './simbolos.js';
import { CATALOGO } from './catalogo.js';
import { desenharFios, desenharFioFantasma } from './fios.js';
import { desenharGrupos, desenharSelecaoRetangular } from './grupos.js';

const TAMANHO_GRADE = 20;

export function criarCanvas(elemento) {
  const ctx = elemento.getContext('2d');
  const view = { zoom: 1, panX: 0, panY: 0 };

  function redimensionar() {
    const dpr = window.devicePixelRatio || 1;
    const rect = elemento.getBoundingClientRect();
    elemento.width = rect.width * dpr;
    elemento.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function telaParaMundo(x, y) {
    return { x: (x - view.panX) / view.zoom, y: (y - view.panY) / view.zoom };
  }

  function mundoParaTela(x, y) {
    return { x: x * view.zoom + view.panX, y: y * view.zoom + view.panY };
  }

  function desenharGrade() {
    const rect = elemento.getBoundingClientRect();
    ctx.save();
    ctx.fillStyle = '#f5f6f7';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const passo = TAMANHO_GRADE * view.zoom;
    if (passo < 6) { ctx.restore(); return; }

    ctx.strokeStyle = '#e4e6e8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ix = view.panX % passo;
    const iy = view.panY % passo;
    for (let x = ix; x < rect.width; x += passo) {
      ctx.moveTo(x, 0); ctx.lineTo(x, rect.height);
    }
    for (let y = iy; y < rect.height; y += passo) {
      ctx.moveTo(0, y); ctx.lineTo(rect.width, y);
    }
    ctx.stroke();

    const passoForte = passo * 5;
    if (passoForte > 20) {
      ctx.strokeStyle = '#d8dcdf';
      ctx.beginPath();
      const ixf = view.panX % passoForte;
      const iyf = view.panY % passoForte;
      for (let x = ixf; x < rect.width; x += passoForte) {
        ctx.moveTo(x, 0); ctx.lineTo(x, rect.height);
      }
      for (let y = iyf; y < rect.height; y += passoForte) {
        ctx.moveTo(0, y); ctx.lineTo(rect.width, y);
      }
      ctx.stroke();
    }
    ctx.restore();
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
  };
}