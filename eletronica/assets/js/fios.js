/**
 * fios.js — Fios moldáveis com dobras.
 *
 * Comportamento:
 * - Clique em um pino inicia um fio (linha tracejada segue o mouse)
 * - Clique em outro pino materializa o fio
 * - Tab sobre um fio cria uma dobra no segmento mais próximo do cursor
 * - Arrastar uma dobra a reposiciona
 * - Clique numa dobra a seleciona; Delete remove a dobra
 * - Clique num fio o seleciona; Delete remove o fio inteiro
 */

import { posicaoPino } from './simbolos.js';
import { registrar } from './historico.js';

const RAIO_PINO = 10;
const RAIO_DOBRA = 6;
const TOLERANCIA_FIO = 8;

/* ===== GEOMETRIA ===== */

/** Retorna os pontos absolutos de um fio: origem → dobras → destino. */
export function pontosDoFio(circuito, fio) {
  const compO = circuito.componentes.find((c) => c.id === fio.origem.componente);
  const compD = circuito.componentes.find((c) => c.id === fio.destino.componente);
  if (!compO || !compD) return [];

  const pO = posicaoPino(compO, fio.origem.pino);
  const pD = posicaoPino(compD, fio.destino.pino);
  if (!pO || !pD) return [];

  return [pO, ...fio.dobras, pD];
}

/** Distância de um ponto a um segmento de reta. */
function distanciaSegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Encontra o fio mais próximo do ponto. */
export function fioEm(circuito, x, y) {
  let melhor = null;
  let menorDist = TOLERANCIA_FIO;

  for (const fio of circuito.fios) {
    const pts = pontosDoFio(circuito, fio);
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distanciaSegmento(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < menorDist) {
        menorDist = d;
        melhor = fio;
      }
    }
  }
  return melhor;
}

/** Encontra a dobra mais próxima do ponto. */
export function dobraEm(circuito, x, y) {
  for (const fio of circuito.fios) {
    for (let i = 0; i < fio.dobras.length; i++) {
      const d = fio.dobras[i];
      if (Math.hypot(d.x - x, d.y - y) < RAIO_DOBRA + 4) {
        return { fio, indice: i };
      }
    }
  }
  return null;
}

/** Encontra o pino mais próximo do ponto. */
export function pinoEm(circuito, x, y) {
  for (let i = circuito.componentes.length - 1; i >= 0; i--) {
    const comp = circuito.componentes[i];
    for (const pino of comp.pinos) {
      const pos = posicaoPino(comp, pino.id);
      if (pos && Math.hypot(pos.x - x, pos.y - y) < RAIO_PINO) {
        return { componente: comp, pino, posicao: pos };
      }
    }
  }
  return null;
}

/* ===== OPERAÇÕES ===== */

/** Cria um fio entre dois pinos. */
export function criarFio(circuito, origem, destino) {
  // Impede duplicata
  const existe = circuito.fios.some(
    (f) =>
      f.origem.componente === origem.componente &&
      f.origem.pino === origem.pino &&
      f.destino.componente === destino.componente &&
      f.destino.pino === destino.pino
  );
  if (existe) return null;

  const fio = {
    id: `f${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    origem: { ...origem },
    destino: { ...destino },
    dobras: [],
  };
  circuito.fios.push(fio);
  registrar(circuito, 'fio', true);
  return fio;
}

/** Remove um fio. */
export function removerFio(circuito, fioId) {
  const quantidade = circuito.fios.length;
  circuito.fios = circuito.fios.filter((f) => f.id !== fioId);
  if (circuito.fios.length !== quantidade) registrar(circuito, 'remover-fio', true);
}

/**
 * Insere uma dobra no segmento mais próximo do ponto.
 * Retorna o índice da nova dobra, ou -1 se não encontrou segmento.
 */
export function inserirDobra(circuito, fio, x, y) {
  const pts = pontosDoFio(circuito, fio);
  if (pts.length < 2) return -1;

  let melhorSeg = 0;
  let menorDist = Infinity;

  for (let i = 0; i < pts.length - 1; i++) {
    const d = distanciaSegmento(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (d < menorDist) {
      menorDist = d;
      melhorSeg = i;
    }
  }

  // Projeta o ponto sobre o segmento
  const p1 = pts[melhorSeg];
  const p2 = pts[melhorSeg + 1];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((x - p1.x) * dx + (y - p1.y) * dy) / len2;
  t = Math.max(0.1, Math.min(0.9, t));

  const novoPonto = { x: p1.x + t * dx, y: p1.y + t * dy };

  // O índice na lista de dobras corresponde ao segmento
  // (segmento 0 = antes da primeira dobra, segmento i = depois da dobra i-1)
  fio.dobras.splice(melhorSeg, 0, novoPonto);
  registrar(circuito, 'dobra', true);
  return melhorSeg;
}

/** Remove uma dobra pelo índice. */
export function removerDobra(circuito, fio, indice) {
  fio.dobras.splice(indice, 1);
  registrar(circuito, 'dobra', true);
}

/* ===== DESENHO ===== */

/** Desenha todos os fios do circuito. */
export function desenharFios(ctx, circuito, view, fioSelecionadoId, dobraSelecionada) {
  for (const fio of circuito.fios) {
    const pts = pontosDoFio(circuito, fio);
    if (pts.length < 2) continue;

    const selecionado = fio.id === fioSelecionadoId;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x * view.zoom + view.panX, pts[0].y * view.zoom + view.panY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * view.zoom + view.panX, pts[i].y * view.zoom + view.panY);
    }
    ctx.strokeStyle = selecionado ? '#e05a5a' : '#2b2b2b';
    ctx.lineWidth = (selecionado ? 3 : 2) * view.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // Desenha as dobras
    for (let i = 0; i < fio.dobras.length; i++) {
      const d = fio.dobras[i];
      const tx = d.x * view.zoom + view.panX;
      const ty = d.y * view.zoom + view.panY;
      const ativa = dobraSelecionada && dobraSelecionada.fio.id === fio.id && dobraSelecionada.indice === i;

      ctx.save();
      ctx.beginPath();
      ctx.arc(tx, ty, RAIO_DOBRA * view.zoom, 0, Math.PI * 2);
      ctx.fillStyle = ativa ? '#53b588' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = ativa ? '#3e9670' : '#2b2b2b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Desenha o fio fantasma durante o arrasto. */
export function desenharFioFantasma(ctx, view, origem, cursor) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(origem.x * view.zoom + view.panX, origem.y * view.zoom + view.panY);
  ctx.lineTo(cursor.x, cursor.y);
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = '#53b588';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Círculo no cursor
  ctx.save();
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#53b588';
  ctx.fill();
  ctx.restore();
}

/* ===== INTERAÇÃO ===== */

/**
 * Configura a interação de fios no canvas.
 * Deve ser chamado ANTES de configurarInteracao (selecao.js) para
 * ter prioridade nos eventos.
 */
export function configurarFios(canvas, estado, aoMudar) {
  const el = canvas.elemento;

  let fioEmConstrucao = null;   // { origem, posicaoOrigem }
  let dobraArrastando = null;   // { fio, indice }
  let fioSelecionadoId = null;
  let dobraSelecionada = null;  // { fio, indice }

  function telaParaMundo(e) {
    const rect = el.getBoundingClientRect();
    return canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
  }

  // ---- mousedown ----
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.shiftKey) return;

    const mundo = telaParaMundo(e);

    // 1. Dobra sob o cursor → inicia arrasto
    const dobra = dobraEm(estado.circuito, mundo.x, mundo.y);
    if (dobra) {
      dobraArrastando = dobra;
      dobraSelecionada = dobra;
      fioSelecionadoId = dobra.fio.id;
      e.stopPropagation();
      e.preventDefault();
      aoMudar();
      return;
    }

    // 2. Pino sob o cursor → inicia fio
    const pino = pinoEm(estado.circuito, mundo.x, mundo.y);
    if (pino) {
      fioEmConstrucao = {
        origem: { componente: pino.componente.id, pino: pino.pino.id },
        posicaoOrigem: pino.posicao,
      };
      estado.fioFantasma = { origem: pino.posicao, cursor: { x: e.clientX - el.getBoundingClientRect().left, y: e.clientY - el.getBoundingClientRect().top } };
      el.style.cursor = 'crosshair';
      e.stopPropagation();
      e.preventDefault();
      aoMudar();
      return;
    }

    // 3. Fio sob o cursor → seleciona
    const fio = fioEm(estado.circuito, mundo.x, mundo.y);
    if (fio) {
      fioSelecionadoId = fio.id;
      dobraSelecionada = null;
      estado.fioSelecionadoId = fio.id;
      e.stopPropagation();
      e.preventDefault();
      aoMudar();
      return;
    }

    // 4. Clique em área vazia → limpa seleção de fio
    fioSelecionadoId = null;
    dobraSelecionada = null;
    estado.fioSelecionadoId = null;
  }, true); // captura antes do handler de seleção de componentes

  // ---- mousemove ----
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mundo = canvas.telaParaMundo(mx, my);

    if (fioEmConstrucao) {
      estado.fioFantasma = {
        origem: fioEmConstrucao.posicaoOrigem,
        cursor: { x: mx, y: my },
      };
      aoMudar();
      return;
    }

    if (dobraArrastando) {
      dobraArrastando.fio.dobras[dobraArrastando.indice] = {
        x: Math.round(mundo.x / 10) * 10,
        y: Math.round(mundo.y / 10) * 10,
      };
      aoMudar();
      return;
    }

    // Cursor de crosshair quando sobre pino
    const pino = pinoEm(estado.circuito, mundo.x, mundo.y);
    if (pino && !estado.arrastandoComponente) {
      el.style.cursor = 'crosshair';
    }
  });

  // ---- mouseup ----
  el.addEventListener('mouseup', (e) => {
    if (fioEmConstrucao) {
      const mundo = telaParaMundo(e);
      const pino = pinoEm(estado.circuito, mundo.x, mundo.y);

      if (pino) {
        criarFio(
          estado.circuito,
          fioEmConstrucao.origem,
          { componente: pino.componente.id, pino: pino.pino.id }
        );
      }

      fioEmConstrucao = null;
      estado.fioFantasma = null;
      el.style.cursor = 'default';
      aoMudar();
      return;
    }

    if (dobraArrastando) {
      registrar(estado.circuito, 'dobra', true);
      dobraArrastando = null;
      aoMudar();
    }
  });

  // ---- keydown ----
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    // Tab: cria dobra no fio sob o cursor
    if (e.key === 'Tab') {
      const rect = el.getBoundingClientRect();
      const mouseX = estado.ultimoMouse?.x ?? 0;
      const mouseY = estado.ultimoMouse?.y ?? 0;
      const mundo = canvas.telaParaMundo(mouseX, mouseY);

      const fio = fioEm(estado.circuito, mundo.x, mundo.y);
      if (fio) {
        e.preventDefault();
        const idx = inserirDobra(estado.circuito, fio, mundo.x, mundo.y);
        if (idx >= 0) {
          fioSelecionadoId = fio.id;
          dobraSelecionada = { fio, indice: idx };
          estado.fioSelecionadoId = fio.id;
          aoMudar();
        }
      }
      return;
    }

    // Delete: remove dobra selecionada ou fio selecionado
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (dobraSelecionada) {
        removerDobra(estado.circuito, dobraSelecionada.fio, dobraSelecionada.indice);
        dobraSelecionada = null;
        aoMudar();
        e.preventDefault();
        return;
      }
      if (fioSelecionadoId) {
        removerFio(estado.circuito, fioSelecionadoId);
        fioSelecionadoId = null;
        estado.fioSelecionadoId = null;
        aoMudar();
        e.preventDefault();
        return;
      }
    }

    // Escape: cancela fio em construção
    if (e.key === 'Escape' && fioEmConstrucao) {
      fioEmConstrucao = null;
      estado.fioFantasma = null;
      el.style.cursor = 'default';
      aoMudar();
    }
  });

  // Rastreia a posição do mouse para o Tab
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    estado.ultimoMouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  });

  return {
    get fioSelecionadoId() { return fioSelecionadoId; },
    get dobraSelecionada() { return dobraSelecionada; },
  };
}