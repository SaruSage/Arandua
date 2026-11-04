/**
 * selecao.js — Seleção, arrasto, rotação e pan no canvas.
 */

import { componenteEm, moverComponente, rotacionarComponente } from './circuito.js';
import { CATALOGO } from './catalogo.js';

export function configurarInteracao(canvas, estado, aoMudar) {
  const el = canvas.elemento;
  let arrastando = null;
  let panIniciado = null;

  el.addEventListener('mousedown', (e) => {
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mundo = canvas.telaParaMundo(mx, my);

    // Pan com botão do meio ou Shift
    if (e.button === 1 || e.shiftKey) {
      panIniciado = { x: mx, y: my, panX: canvas.view.panX, panY: canvas.view.panY };
      el.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    const comp = componenteEm(estado.circuito, mundo.x, mundo.y);

    if (comp) {
      if (e.ctrlKey || e.metaKey) {
        // Alterna seleção
        const idx = estado.selecionados.indexOf(comp.id);
        if (idx >= 0) estado.selecionados.splice(idx, 1);
        else estado.selecionados.push(comp.id);
      } else if (!estado.selecionados.includes(comp.id)) {
        estado.selecionados = [comp.id];
      }

      arrastando = {
        ids: [...estado.selecionados],
        inicio: { x: mundo.x, y: mundo.y },
        posicoes: estado.selecionados.map((id) => {
          const c = estado.circuito.componentes.find((x) => x.id === id);
          return { id, x: c.x, y: c.y };
        }),
      };
      el.style.cursor = 'grabbing';
    } else {
      estado.selecionados = [];
    }

    aoMudar();
  });

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mundo = canvas.telaParaMundo(mx, my);

    if (panIniciado) {
      canvas.view.panX = panIniciado.panX + (mx - panIniciado.x);
      canvas.view.panY = panIniciado.panY + (my - panIniciado.y);
      aoMudar();
      return;
    }

    if (arrastando) {
      const dx = mundo.x - arrastando.inicio.x;
      const dy = mundo.y - arrastando.inicio.y;
      for (const pos of arrastando.posicoes) {
        moverComponente(estado.circuito, pos.id, pos.x + dx, pos.y + dy);
      }
      aoMudar();
      return;
    }

    const comp = componenteEm(estado.circuito, mundo.x, mundo.y);
    el.style.cursor = comp ? 'grab' : 'default';
  });

  el.addEventListener('mouseup', () => {
    arrastando = null;
    panIniciado = null;
    el.style.cursor = 'default';
  });

  el.addEventListener('mouseleave', () => {
    arrastando = null;
    panIniciado = null;
  });

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const antes = canvas.telaParaMundo(mx, my);
    const fator = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    canvas.view.zoom = Math.min(3, Math.max(0.3, canvas.view.zoom * fator));
    const depois = canvas.telaParaMundo(mx, my);
    canvas.view.panX += (depois.x - antes.x) * canvas.view.zoom;
    canvas.view.panY += (depois.y - antes.y) * canvas.view.zoom;
    aoMudar();
  }, { passive: false });

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    const tipo = e.dataTransfer.getData('application/x-eletronica');
    if (!tipo) return;
    const rect = el.getBoundingClientRect();
    const mundo = canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
    const dim = CATALOGO[tipo].dimensoes;
    estado.adicionar(tipo, mundo.x - dim.w / 2, mundo.y - dim.h / 2);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (estado.selecionados.length > 0) {
        estado.removerSelecionados();
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      estado.selecionados = [];
      aoMudar();
    } else if (e.key === 'r' || e.key === 'R') {
      if (estado.selecionados.length > 0) {
        const comp = estado.circuito.componentes.find((c) => c.id === estado.selecionados[0]);
        if (comp) {
          rotacionarComponente(estado.circuito, comp.id, comp.rotacao + 90);
          aoMudar();
        }
      }
    }
  });
}