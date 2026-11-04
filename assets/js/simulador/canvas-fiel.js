/**
 * canvas-fiel.js — Canvas do simulador com símbolos reais.
 * Reaproveita o motor lógico de core/ e desenha com simbolos.js.
 */

import { desenharSimbolo, dimensoesSimbolo, CORES_SIMBOLO } from './simbolos.js';

const TAMANHO_GRADE = 20;

/**
 * Cria o renderizador do canvas fiel.
 * @param {HTMLCanvasElement} elemento
 */
export function criarCanvasFiel(elemento) {
  const ctx = elemento.getContext('2d');
  const view = { zoom: 1, panX: 0, panY: 0 };
  let circuitoAtual = { componentes: [], fios: [] };

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
    const inicioX = view.panX % passo;
    const inicioY = view.panY % passo;
    for (let x = inicioX; x < rect.width; x += passo) {
      ctx.moveTo(x, 0); ctx.lineTo(x, rect.height);
    }
    for (let y = inicioY; y < rect.height; y += passo) {
      ctx.moveTo(0, y); ctx.lineTo(rect.width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function desenharFio(origem, destino, valor) {
    const x1 = origem.x;
    const y1 = origem.y;
    const x2 = destino.x;
    const y2 = destino.y;
    const dx = Math.max(30, Math.abs(x2 - x1) * 0.4);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
    if (valor === 1) ctx.strokeStyle = CORES_SIMBOLO.primaria;
    else if (valor === 0) ctx.strokeStyle = '#8a8a8a';
    else ctx.strokeStyle = CORES_SIMBOLO.pinoIndefinido;
    ctx.lineWidth = 2 * view.zoom;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function desenharComponente(comp, selecionado) {
    const dim = dimensoesSimbolo(comp.tipo);
    const tela = mundoParaTela(comp.posicao.x, comp.posicao.y);
    const w = dim.w * view.zoom;
    const h = dim.h * view.zoom;

    desenharSimbolo(ctx, comp, tela.x, tela.y, w, h);

    if (selecionado) {
      ctx.save();
      ctx.strokeStyle = CORES_SIMBOLO.primaria;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5 * view.zoom, 4 * view.zoom]);
      ctx.strokeRect(tela.x - 14, tela.y - 8, w + 28, h + 16);
      ctx.restore();
    }
  }

  function posicaoPinoTela(comp, pinoId, direcao) {
    const dim = dimensoesSimbolo(comp.tipo);
    const lista = direcao === 'entrada' ? comp.entradas : comp.saidas;
    const idx = lista.findIndex((p) => p.id === pinoId);
    if (idx < 0) return null;

    const tela = mundoParaTela(comp.posicao.x, comp.posicao.y);
    const w = dim.w * view.zoom;
    const h = dim.h * view.zoom;
    const y = tela.y + h * ((idx + 1) / (lista.length + 1));
    const RAIO_PINO = 5 * view.zoom;
    const x = direcao === 'entrada' ? tela.x - RAIO_PINO : tela.x + w + RAIO_PINO;
    return { x, y };
  }

  function render(circuito, selecionadoId, fioSelecionadoId, fioFantasma) {
    circuitoAtual = circuito;
    desenharGrade();

    // Fios primeiro (atrás dos componentes)
    for (const fio of circuito.fios) {
      const compO = circuito.componentes.find((c) => c.id === fio.origem.componente);
      const compD = circuito.componentes.find((c) => c.id === fio.destino.componente);
      if (!compO || !compD) continue;
      const pO = posicaoPinoTela(compO, fio.origem.pino, 'saida');
      const pD = posicaoPinoTela(compD, fio.destino.pino, 'entrada');
      if (!pO || !pD) continue;
      const valor = compO.saidas.find((s) => s.id === fio.origem.pino)?.valor;
      desenharFio(pO, pD, valor);
    }

    // Fio fantasma durante o arrasto
    if (fioFantasma) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(fioFantasma.origem.x, fioFantasma.origem.y);
      ctx.lineTo(fioFantasma.cursor.x, fioFantasma.cursor.y);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = CORES_SIMBOLO.primaria;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Componentes
    for (const comp of circuito.componentes) {
      desenharComponente(comp, comp.id === selecionadoId);
    }
  }

  function componenteEm(x, y) {
    for (let i = circuitoAtual.componentes.length - 1; i >= 0; i--) {
      const c = circuitoAtual.componentes[i];
      const dim = dimensoesSimbolo(c.tipo);
      if (x >= c.posicao.x - 10 && x <= c.posicao.x + dim.w + 10
          && y >= c.posicao.y - 10 && y <= c.posicao.y + dim.h + 10) {
        return c;
      }
    }
    return null;
  }

  function pinoEm(x, y) {
    const RAIO = 12;
    for (const comp of circuitoAtual.componentes) {
      for (const pino of comp.entradas) {
        const pos = posicaoPinoTela(comp, pino.id, 'entrada');
        if (pos && Math.hypot(pos.x - x, pos.y - y) < RAIO) {
          return { componente: comp, pino, direcao: 'entrada' };
        }
      }
      for (const pino of comp.saidas) {
        const pos = posicaoPinoTela(comp, pino.id, 'saida');
        if (pos && Math.hypot(pos.x - x, pos.y - y) < RAIO) {
          return { componente: comp, pino, direcao: 'saida' };
        }
      }
    }
    return null;
  }

  return {
    view,
    redimensionar,
    render,
    telaParaMundo,
    mundoParaTela,
    posicaoPinoTela,
    componenteEm,
    pinoEm,
    get ctx() { return ctx; },
    get elemento() { return elemento; },
  };
}