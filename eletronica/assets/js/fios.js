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

import { CORES, posicaoPino } from './simbolos.js';
import { registrar } from './historico.js';
import { CATALOGO } from './catalogo.js';
import { recalcularMembros } from './grupos.js';
import { snap, TAMANHO_GRADE } from './canvas.js';

export const CORES_FIO = [
  '#2b2b2b', '#e05a5a', '#e88a3a', '#e8c33a', '#8fbf3a',
  '#53b588', '#3ab8b8', '#3a8fe8', '#4a5ae8', '#8a4ae8',
  '#c44ae8', '#e84a9e', '#8a5a3a', '#5a5a5a', '#a0a0a0',
  '#ffffff', '#1a1d27', '#ff6b6b', '#4ecdc4', '#ffe66d',
];

const RAIO_PINO = 10;
const RAIO_DOBRA = 6;
const TOLERANCIA_FIO = 8;
const TOLERANCIA_EIXO = 6; // px
const TOLERANCIA_SEGMENTO = 6; // px
const RAIO_CURVA = 8; // px — ajustável

let _circuitoAtual = null;

/* ===== GEOMETRIA ===== */

/** Retorna os pontos absolutos de um fio: origem → dobras → destino. */
export function pontosDoFio(circuitoOuFio, fioOpcional) {
  const circuito = fioOpcional ? circuitoOuFio : _circuitoAtual;
  const fio = fioOpcional ? fioOpcional : circuitoOuFio;
  if (!circuito || !fio) return [];
  _circuitoAtual = circuito;

  const compO = circuito.componentes.find((c) => c.id === fio.origem.componente);
  const compD = circuito.componentes.find((c) => c.id === fio.destino.componente);
  if (!compO || !compD) return [];

  const pO = posicaoPino(compO, fio.origem.pino);
  const pD = posicaoPino(compD, fio.destino.pino);
  if (!pO || !pD) return [];

  if (!fio.dobras || fio.dobras.length === 0) {
    // Sem dobras: se já estiver alinhado em X ou Y, reta direta
    const dx = Math.abs(pD.x - pO.x);
    const dy = Math.abs(pD.y - pO.y);
    if (dx < 1 || dy < 1) {
      return [pO, pD];
    }

    // Caso contrário, cria um L automático escolhendo o eixo dominante
    if (dx > dy) {
      // Horizontal primeiro, depois vertical
      return [pO, { x: pD.x, y: pO.y }, pD];
    } else {
      // Vertical primeiro, depois horizontal
      return [pO, { x: pO.x, y: pD.y }, pD];
    }
  }

  return [pO, ...fio.dobras, pD];
}

/**
 * Distância de um ponto a um segmento de reta.
 */
function distanciaPontoSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

/**
 * Retorna { indice, orientacao } do segmento sob o ponto,
 * ou null. indice é o índice do ponto inicial do segmento.
 */
function segmentoSobPonto(fio, ponto) {
  const pts = pontosDoFio(fio);

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];

    if (distanciaPontoSegmento(ponto, a, b) < TOLERANCIA_SEGMENTO) {
      const horizontal = Math.abs(a.y - b.y) < 1;
      const vertical = Math.abs(a.x - b.x) < 1;
      return {
        indice: i,
        orientacao: horizontal ? 'h' : vertical ? 'v' : 'd',
      };
    }
  }
  return null;
}

function pontoSobreDobra(fio, ponto) {
  for (const d of fio.dobras || []) {
    if (Math.hypot(d.x - ponto.x, d.y - ponto.y) < RAIO_DOBRA + 4) {
      return true;
    }
  }
  return false;
}

/**
 * Move um segmento criando/movendo dobras nas suas extremidades.
 * indice = índice do ponto inicial do segmento em pontosDoFio.
 */
function inserirOuMoverDobraNoSegmento(fio, indice, orientacao, x, y) {
  const pts = pontosDoFio(fio);
  const pA = pts[indice];
  const pB = pts[indice + 1];
  if (!pA || !pB) return;

  // Quantas dobras existem antes deste segmento?
  // pontosDoFio = [pinoO, ...dobras, pinoD]
  // índice 0 = pinoO → dobra[0] (ou pinoD)
  // índice k = dobra[k-1] → dobra[k] (ou pinoD)
  const ehPontaOrigem = indice === 0;
  const ehPontaDestino = indice === pts.length - 2;

  const dobras = fio.dobras || (fio.dobras = []);

  if (orientacao === 'h') {
    // Segmento horizontal: precisa de dobras acima/abaixo
    // nas duas pontas, com o mesmo y
    const yNovo = y;

    if (ehPontaDestino) {
      dobras.push({ x: pB.x, y: yNovo });
    } else {
      dobras[indice].y = yNovo;
    }

    if (ehPontaOrigem) {
      // Cria dobra logo após o pino de origem
      dobras.unshift({ x: pA.x, y: yNovo });
    } else {
      dobras[indice - 1].y = yNovo;
    }
  } else if (orientacao === 'v') {
    const xNovo = x;

    if (ehPontaDestino) {
      dobras.push({ x: xNovo, y: pB.y });
    } else {
      dobras[indice].x = xNovo;
    }

    if (ehPontaOrigem) {
      dobras.unshift({ x: xNovo, y: pA.y });
    } else {
      dobras[indice - 1].x = xNovo;
    }
  } else {
    // Diagonal: move as duas pontas livremente preservando o deslocamento do segmento
    const dxSeg = x - pA.x;
    const dySeg = y - pA.y;

    if (ehPontaDestino) {
      dobras.push({ x: pB.x + dxSeg, y: pB.y + dySeg });
    } else {
      dobras[indice].x = pB.x + dxSeg;
      dobras[indice].y = pB.y + dySeg;
    }

    if (ehPontaOrigem) {
      dobras.unshift({ x: pA.x + dxSeg, y: pA.y + dySeg });
    } else {
      dobras[indice - 1].x = pA.x + dxSeg;
      dobras[indice - 1].y = pA.y + dySeg;
    }
  }
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
    const pinos = comp.pinos || CATALOGO[comp.tipo]?.pinos || [];
    const compComPinos = comp.pinos ? comp : { ...comp, pinos };
    for (const pino of pinos) {
      const pos = posicaoPino(compComPinos, pino.id);
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
    id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origem: { ...origem },
    destino: { ...destino },
    dobras: [],
    cor: CORES_FIO[0],
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

/**
 * Desenha um caminho passando pelos pontos com cantos
 * arredondados.
 */
function desenharCaminhoArredondado(ctx, pontos, raio) {
  if (pontos.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(pontos[0].x, pontos[0].y);

  for (let i = 1; i < pontos.length - 1; i++) {
    const ant = pontos[i - 1];
    const atual = pontos[i];
    const prox = pontos[i + 1];

    // Distâncias até os vizinhos
    const dAnt = Math.hypot(atual.x - ant.x, atual.y - ant.y);
    const dProx = Math.hypot(prox.x - atual.x, prox.y - atual.y);

    // Raio efetivo não pode passar da metade do menor trecho
    const r = Math.min(raio, dAnt / 2, dProx / 2);

    if (r < 0.5) {
      ctx.lineTo(atual.x, atual.y);
      continue;
    }

    // Ponto de entrada da curva (antes do vértice)
    const tAnt = r / dAnt;
    const entrada = {
      x: atual.x + (ant.x - atual.x) * tAnt,
      y: atual.y + (ant.y - atual.y) * tAnt,
    };

    // Ponto de saída da curva (depois do vértice)
    const tProx = r / dProx;
    const saida = {
      x: atual.x + (prox.x - atual.x) * tProx,
      y: atual.y + (prox.y - atual.y) * tProx,
    };

    ctx.lineTo(entrada.x, entrada.y);
    ctx.quadraticCurveTo(atual.x, atual.y, saida.x, saida.y);
  }

  const ultimo = pontos[pontos.length - 1];
  ctx.lineTo(ultimo.x, ultimo.y);
  ctx.stroke();
}

/** Desenha todos os fios do circuito. */
export function desenharFios(ctx, circuito, view, fioSelecionadoId, dobraSelecionada) {
  _circuitoAtual = circuito;
  const tela = (p) => ({
    x: p.x * view.zoom + view.panX,
    y: p.y * view.zoom + view.panY,
  });

  for (const fio of circuito.fios) {
    const ptsMundo = pontosDoFio(circuito, fio);
    if (ptsMundo.length < 2) continue;

    const selecionado = fio.id === fioSelecionadoId;

    ctx.save();
    ctx.strokeStyle = fio.cor || CORES.traco;
    ctx.lineWidth = (selecionado ? 3 : 2) * view.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = ptsMundo.map((p) => tela(p));
    desenharCaminhoArredondado(ctx, pts, RAIO_CURVA * view.zoom);
    ctx.restore();

    if (selecionado && fio.dobras?.length) {
      for (let i = 0; i < fio.dobras.length; i++) {
        const dobra = fio.dobras[i];
        const tx = dobra.x * view.zoom + view.panX;
        const ty = dobra.y * view.zoom + view.panY;
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
}

/** Desenha o fio fantasma durante o arrasto. */
export function desenharFioFantasma(ctx, view, origem, cursor, cor) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(origem.x * view.zoom + view.panX, origem.y * view.zoom + view.panY);
  ctx.lineTo(cursor.x, cursor.y);
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = cor || CORES.primaria;
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
  const renderizarTudo = aoMudar;
  _circuitoAtual = estado.circuito;

  let fioEmConstrucao = null;   // { origem, posicaoOrigem }
  let dobraArrastando = null;   // { fio, indice }
  let fioSelecionadoId = null;
  let dobraSelecionada = null;  // { fio, indice }
  canvas.ultimoMouse = canvas.ultimoMouse || { x: 0, y: 0 };

  function telaParaMundo(e) {
    const rect = el.getBoundingClientRect();
    return canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function posicaoPinoPorId(ref) {
    if (!ref) return null;
    const comp = estado.circuito.componentes.find((c) => c.id === ref.componente);
    return comp ? posicaoPino(comp, ref.pino) : null;
  }

  /**
   * Ajusta a dobra para alinhar com eixos de pinos e outras dobras.
   * Retorna { x, y, guiaX, guiaY } onde guiaX/guiaY indicam se há
   * alinhamento naquele eixo.
   */
  function alinharDobra(fio, dobra, indice, posBruta = dobra) {
    const pO = posicaoPinoPorId(fio.origem);
    const pD = posicaoPinoPorId(fio.destino);

    // Pontos de referência: pinos + outras dobras
    const refs = [pO, pD].filter(Boolean);
    (fio.dobras || []).forEach((d, i) => {
      if (i !== indice && d) refs.push(d);
    });

    let guiaX = null;
    let guiaY = null;

    // Alinhamento vertical (mesma coluna) → guia vertical
    for (const r of refs) {
      if (Math.abs(posBruta.x - r.x) < TOLERANCIA_EIXO || Math.abs(dobra.x - r.x) < TOLERANCIA_EIXO) {
        dobra.x = r.x;
        guiaX = r.x;
        break;
      }
    }

    // Alinhamento horizontal (mesma altura) → guia horizontal
    for (const r of refs) {
      if (Math.abs(posBruta.y - r.y) < TOLERANCIA_EIXO || Math.abs(dobra.y - r.y) < TOLERANCIA_EIXO) {
        dobra.y = r.y;
        guiaY = r.y;
        break;
      }
    }

    return { x: dobra.x, y: dobra.y, guiaX, guiaY };
  }

  // ---- mousedown ----
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.shiftKey) return;
    _circuitoAtual = estado.circuito;

    const mundo = telaParaMundo(e);

    // 1. Dobra sob o cursor → inicia arrasto
    const dobra = dobraEm(estado.circuito, mundo.x, mundo.y);
    if (dobra) {
      for (const id of estado.selecionados) {
        const g = estado.circuito.grupos.find((x) => x.id === id);
        if (g) recalcularMembros(g);
      }
      estado.selecionados = [];
      estado.grupoSelecionadoId = null;
      dobraArrastando = dobra;
      dobraSelecionada = dobra;
      fioSelecionadoId = dobra.fio.id;
      estado.fioSelecionadoId = dobra.fio.id;
      e.stopPropagation();
      e.preventDefault();
      aoMudar();
      return;
    }

    // 2. Pino sob o cursor → inicia fio
    const pino = pinoEm(estado.circuito, mundo.x, mundo.y);
    if (pino) {
      for (const id of estado.selecionados) {
        const g = estado.circuito.grupos.find((x) => x.id === id);
        if (g) recalcularMembros(g);
      }
      estado.selecionados = [];
      estado.grupoSelecionadoId = null;
      estado.fioSelecionadoId = null;
      fioSelecionadoId = null;
      dobraSelecionada = null;
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

    // 3. Segmento de fio sob o cursor → seleciona fio e inicia arrasto de segmento
    for (const fio of estado.circuito.fios) {
      const seg = segmentoSobPonto(fio, mundo);
      if (seg && !pontoSobreDobra(fio, mundo)) {
        for (const id of estado.selecionados) {
          const g = estado.circuito.grupos.find((x) => x.id === id);
          if (g) recalcularMembros(g);
        }
        fioSelecionadoId = fio.id;
        dobraSelecionada = null;
        estado.fioSelecionadoId = fio.id;
        estado.selecionados = [];
        estado.grupoSelecionadoId = null;

        const ptsAtuais = pontosDoFio(estado.circuito, fio);
        const dobrasBase = (fio.dobras && fio.dobras.length > 0)
          ? fio.dobras.map((d) => ({ ...d }))
          : ptsAtuais.slice(1, -1).map((d) => ({ ...d }));

        estado.arrastandoSegmento = {
          fioId: fio.id,
          indice: seg.indice,
          orientacao: seg.orientacao,
          pontoInicial: { x: mundo.x, y: mundo.y },
          dobrasOriginais: dobrasBase,
          moveu: false,
        };
        e.stopPropagation();
        e.preventDefault();
        aoMudar();
        return;
      }
    }

    // 4. Fio sob o cursor → seleciona
    const fio = fioEm(estado.circuito, mundo.x, mundo.y);
    if (fio) {
      for (const id of estado.selecionados) {
        const g = estado.circuito.grupos.find((x) => x.id === id);
        if (g) recalcularMembros(g);
      }
      fioSelecionadoId = fio.id;
      dobraSelecionada = null;
      estado.fioSelecionadoId = fio.id;
      estado.selecionados = [];
      estado.grupoSelecionadoId = null;
      e.stopPropagation();
      e.preventDefault();
      aoMudar();
      return;
    }

    // 5. Clique em área vazia → limpa seleção de fio
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
      const dobra = dobraArrastando.fio.dobras[dobraArrastando.indice];
      if (dobra) {
        dobra.x = snap(mundo.x);
        dobra.y = snap(mundo.y);
        const { guiaX, guiaY } = alinharDobra(
          dobraArrastando.fio,
          dobra,
          dobraArrastando.indice,
          mundo
        );
        estado.guiaAtiva = (guiaX !== null || guiaY !== null)
          ? { guiaX, guiaY }
          : null;
      }
      aoMudar();
      return;
    }

    if (estado.arrastandoSegmento) {
      _circuitoAtual = estado.circuito;
      const s = estado.arrastandoSegmento;
      const fio = estado.circuito.fios.find((f) => f.id === s.fioId);
      if (!fio) return;

      const dx = mundo.x - s.pontoInicial.x;
      const dy = mundo.y - s.pontoInicial.y;

      const LIMIAR_ARRASTO = TAMANHO_GRADE / 2; // 5 px

      if (Math.abs(dx) > LIMIAR_ARRASTO || Math.abs(dy) > LIMIAR_ARRASTO) {
        estado.arrastandoSegmento.moveu = true;
      }

      if (!estado.arrastandoSegmento.moveu) return;

      // Restaura as dobras originais antes de recalcular
      fio.dobras = s.dobrasOriginais.map((d) => ({ ...d }));

      // Constrói a lista de pontos atual
      const pts = pontosDoFio(fio);

      // Pontos das extremidades do segmento
      const pA = pts[s.indice];
      const pB = pts[s.indice + 1];
      if (!pA || !pB) return;

      // Calcula o deslocamento permitido pela orientação
      let deslocX = 0;
      let deslocY = 0;

      if (s.orientacao === 'h') {
        deslocY = dy; // horizontal move na vertical
      } else if (s.orientacao === 'v') {
        deslocX = dx; // vertical move na horizontal
      } else {
        deslocX = dx;
        deslocY = dy;
      }

      // Aplica snap
      let novoY = snap(pA.y + deslocY);
      let novoX = snap(pA.x + deslocX);

      // Alinha com os pinos de origem/destino e ativa guia correspondente
      const pO = posicaoPinoPorId(fio.origem);
      const pD = posicaoPinoPorId(fio.destino);
      const refsSeg = [pO, pD].filter(Boolean);
      let guiaX = null;
      let guiaY = null;

      if (s.orientacao === 'v' || s.orientacao === 'd') {
        const xBruto = pA.x + deslocX;
        for (const r of refsSeg) {
          if (Math.abs(xBruto - r.x) < TOLERANCIA_EIXO || Math.abs(novoX - r.x) < TOLERANCIA_EIXO) {
            novoX = r.x;
            guiaX = r.x;
            break;
          }
        }
      }
      if (s.orientacao === 'h' || s.orientacao === 'd') {
        const yBruto = pA.y + deslocY;
        for (const r of refsSeg) {
          if (Math.abs(yBruto - r.y) < TOLERANCIA_EIXO || Math.abs(novoY - r.y) < TOLERANCIA_EIXO) {
            novoY = r.y;
            guiaY = r.y;
            break;
          }
        }
      }
      estado.guiaAtiva = (guiaX !== null || guiaY !== null)
        ? { guiaX, guiaY }
        : null;

      // Cria ou move as dobras nas extremidades do segmento
      inserirOuMoverDobraNoSegmento(
        fio, s.indice, s.orientacao, novoX, novoY
      );

      renderizarTudo();
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
      estado.guiaAtiva = null;
      aoMudar();
      return;
    }

    if (estado.arrastandoSegmento) {
      if (estado.arrastandoSegmento.moveu) {
        registrar(estado.circuito, 'mover-segmento', true);
      }
      estado.arrastandoSegmento = null;
      estado.guiaAtiva = null;
      aoMudar();
      return;
    }
  });

  // ---- keydown ----
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    // Tab: cria dobra no fio sob o cursor
    if (e.key === 'Tab') {
      e.preventDefault();
      const mundo = canvas.telaParaMundo(canvas.ultimoMouse.x, canvas.ultimoMouse.y);

      const fio = fioEm(estado.circuito, mundo.x, mundo.y);
      if (fio) {
        const idx = inserirDobra(estado.circuito, fio, mundo.x, mundo.y);
        if (idx >= 0) {
          fioSelecionadoId = fio.id;
          dobraSelecionada = { fio, indice: idx };
        }
        estado.fioSelecionadoId = fio.id;
        aoMudar();
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

    // Escape: cancela fio em construção e limpa guias
    if (e.key === 'Escape') {
      if (estado.guiaAtiva) {
        estado.guiaAtiva = null;
        aoMudar();
      }
      if (fioEmConstrucao) {
        fioEmConstrucao = null;
        estado.fioFantasma = null;
        el.style.cursor = 'default';
        aoMudar();
      }
    }
  });

  // Rastreia a posição do mouse também fora do canvas para o Tab.
  window.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    canvas.ultimoMouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  });

  return {
    get fioSelecionadoId() { return fioSelecionadoId; },
    get dobraSelecionada() { return dobraSelecionada; },
  };
}