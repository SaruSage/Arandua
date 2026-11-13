/**
 * canvas.js — Renderização do circuito em Canvas 2D.
 * Grade, componentes com símbolos técnicos, seleção e rotação.
 */

import { desenharComponente, CORES } from './simbolos.js';
import { CATALOGO, obterAreaSelecaoPersonalizada } from './catalogo.js';
import { desenharFios, desenharFioFantasma, pinoEm } from './fios.js';
import { desenharGrupos, desenharSelecaoRetangular, boundsDoComponente } from './grupos.js';
import { obterProgressoEstiloRealista } from './visual.js';

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

export function nomeVisivelComponente(comp) {
  return String(comp?.nomeCustom || '')
    .replace(/^Resistor do segmento\s+/i, 'R ')
    .replace(/^LED do segmento\s+/i, 'LED ')
    .replace(/^Barramento comum\s+/i, 'COM ');
}

export function projetarCentroNomeComponente(bounds, meiaLargura, meiaAltura, alvo, margem = 8) {
  const minX = bounds.x - meiaLargura - margem;
  const maxX = bounds.x + bounds.w + meiaLargura + margem;
  const minY = bounds.y - meiaAltura - margem;
  const maxY = bounds.y + bounds.h + meiaAltura + margem;
  const x = Math.max(minX, Math.min(maxX, alvo.x));
  const y = Math.max(minY, Math.min(maxY, alvo.y));

  if (alvo.x >= minX && alvo.x <= maxX && alvo.y >= minY && alvo.y <= maxY) {
    const distancias = [
      { lado: 'esquerda', distancia: Math.abs(alvo.x - minX) },
      { lado: 'direita', distancia: Math.abs(maxX - alvo.x) },
      { lado: 'topo', distancia: Math.abs(alvo.y - minY) },
      { lado: 'base', distancia: Math.abs(maxY - alvo.y) },
    ];
    const maisProximo = distancias.reduce((menor, atual) =>
      atual.distancia < menor.distancia ? atual : menor
    );
    if (maisProximo.lado === 'esquerda') return { x: minX, y };
    if (maisProximo.lado === 'direita') return { x: maxX, y };
    if (maisProximo.lado === 'topo') return { x, y: minY };
    return { x, y: maxY };
  }

  return { x, y };
}

export function layoutNomeComponente(ctx, comp, zoom = 1) {
  if (!ctx || !comp?.nomeCustom) return null;

  const escala = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const texto = nomeVisivelComponente(comp);
  ctx.save();
  ctx.font = `600 ${Math.max(9, 11 * escala)}px system-ui, sans-serif`;
  const largura = ctx.measureText(texto).width + 6;
  ctx.restore();

  const altura = Math.max(12, 14 * escala);
  const meiaLargura = largura / (2 * escala);
  const meiaAltura = altura / (2 * escala);
  const bounds = boundsDoComponente(comp);
  const centroBounds = {
    x: bounds.x + bounds.w / 2,
    y: bounds.y + bounds.h / 2,
  };
  const posicao = comp.propriedades?.posicaoNome;
  const alvo = Number.isFinite(posicao?.dx) && Number.isFinite(posicao?.dy)
    ? { x: centroBounds.x + posicao.dx, y: centroBounds.y + posicao.dy }
    : {
      x: centroBounds.x,
      y: bounds.y - 8 - meiaAltura,
    };
  const centro = projetarCentroNomeComponente(bounds, meiaLargura, meiaAltura, alvo);

  return {
    bounds,
    centro,
    meiaLargura,
    meiaAltura,
    largura,
    altura,
    texto,
  };
}

export function componenteNomeEm(circuito, x, y, ctx, zoom = 1) {
  for (let indice = circuito.componentes.length - 1; indice >= 0; indice--) {
    const comp = circuito.componentes[indice];
    const layout = layoutNomeComponente(ctx, comp, zoom);
    if (!layout) continue;
    if (
      x >= layout.centro.x - layout.meiaLargura
      && x <= layout.centro.x + layout.meiaLargura
      && y >= layout.centro.y - layout.meiaAltura
      && y <= layout.centro.y + layout.meiaAltura
    ) {
      return { comp, layout };
    }
  }
  return null;
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

    if (obterProgressoEstiloRealista() > 0 && ultimoRenderArgs) {
      const encontrado = pinoEm(ultimoRenderArgs[0], mundo.x, mundo.y);
      const proximo = encontrado
        ? { componenteId: encontrado.componente.id, pinoId: encontrado.pino.id }
        : null;
      if (proximo?.componenteId !== pinoEmHover?.componenteId
        || proximo?.pinoId !== pinoEmHover?.pinoId) {
        pinoEmHover = proximo;
        render(...ultimoRenderArgs);
      }
    } else if (pinoEmHover) {
      pinoEmHover = null;
      if (ultimoRenderArgs) render(...ultimoRenderArgs);
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
      const alpha = nivel.nivel === 0 ? 0.09 : 0.045;
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
    const dim = comp.dimensoes || CATALOGO[comp.tipo].dimensoes;
    const centro = mundoParaTela(comp.x + dim.w / 2, comp.y + dim.h / 2);

    ctx.save();
    ctx.strokeStyle = CORES.primaria;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    if (comp.tipo === 'NO') {
      ctx.beginPath();
      ctx.arc(centro.x, centro.y, 8 * view.zoom, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const pinos = comp.pinos || CATALOGO[comp.tipo]?.pinos || [];
      const area = obterAreaSelecaoPersonalizada(comp.tipo);
      const minX = Math.min(area ? area.x - dim.w / 2 : -dim.w / 2, ...pinos.map((pino) => pino.x));
      const minY = Math.min(area ? area.y - dim.h / 2 : -dim.h / 2, ...pinos.map((pino) => pino.y));
      const maxX = Math.max(area ? area.x + area.largura - dim.w / 2 : dim.w / 2, ...pinos.map((pino) => pino.x));
      const maxY = Math.max(area ? area.y + area.altura - dim.h / 2 : dim.h / 2, ...pinos.map((pino) => pino.y));
      const margem = 8;
      ctx.translate(centro.x, centro.y);
      ctx.rotate(((comp.rotacao || 0) * Math.PI) / 180);
      ctx.strokeRect(
        minX * view.zoom - margem,
        minY * view.zoom - margem,
        (maxX - minX) * view.zoom + margem * 2,
        (maxY - minY) * view.zoom + margem * 2
      );
    }
    ctx.restore();
  }

  function desenharNomeComponente(ctx, comp, view) {
    if (!comp.nomeCustom) return;
    const layout = layoutNomeComponente(ctx, comp, view.zoom);
    if (!layout) return;
    const centro = mundoParaTela(layout.centro.x, layout.centro.y);

    ctx.save();
    ctx.font = `600 ${Math.max(9, 11 * view.zoom)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Fundo suave para legibilidade sobre a grade
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(
      centro.x - layout.largura / 2,
      centro.y - layout.altura / 2,
      layout.largura,
      layout.altura
    );

    ctx.fillStyle = '#374151';
    ctx.fillText(layout.texto, centro.x, centro.y + layout.altura / 2 - 2);
    ctx.restore();
  }

  let construirAnimacao = null;
  let animacaoRafId = null;
  let ultimoRenderArgs = null;
  let pinoEmHover = null;

  function calcularBoundingBoxComponentes(componentes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const comp of componentes) {
      const b = boundsDoComponente(comp);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    if (!Number.isFinite(minX)) {
      return { x: 0, y: 0, w: 0, h: 0 };
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function desenharContornoConstruir(ctx, view) {
    if (!construirAnimacao) return;
    const { componentes, inicio, duracao } = construirAnimacao;
    if (!componentes || componentes.length === 0) return;

    const caixa = calcularBoundingBoxComponentes(componentes);
    const margem = 10;
    const tela = mundoParaTela(caixa.x, caixa.y);
    const w = caixa.w * view.zoom;
    const h = caixa.h * view.zoom;
    const x = tela.x - margem;
    const y = tela.y - margem;
    const sw = w + margem * 2;
    const sh = h + margem * 2;

    const t = Math.min(1, (performance.now() - inicio) / duracao);
    const fase = ((performance.now() - inicio) / 900) % 1;

    ctx.save();
    ctx.strokeStyle = '#009C3B';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -fase * 14;
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * Math.PI);
    ctx.strokeRect(x, y, sw, sh);
    ctx.restore();
  }

  function loopAnimacaoConstruir() {
    if (!construirAnimacao) {
      animacaoRafId = null;
      return;
    }
    if (ultimoRenderArgs) {
      render(...ultimoRenderArgs);
    }
    animacaoRafId = requestAnimationFrame(loopAnimacaoConstruir);
  }

  function iniciarContornoConstruir(componentes) {
    construirAnimacao = {
      componentes,
      inicio: performance.now(),
      duracao: 1200,
    };
    if (animacaoRafId) {
      cancelAnimationFrame(animacaoRafId);
      animacaoRafId = null;
    }
    animacaoRafId = requestAnimationFrame(loopAnimacaoConstruir);
    if (ultimoRenderArgs) {
      render(...ultimoRenderArgs);
    }
  }

  function pararContornoConstruir() {
    construirAnimacao = null;
    if (animacaoRafId) {
      cancelAnimationFrame(animacaoRafId);
      animacaoRafId = null;
    }
    if (ultimoRenderArgs) {
      render(...ultimoRenderArgs);
    }
  }

  /** Um nó está conectado quando pelo menos um fio termina nele. */
  function noEstaConectado(circuito, comp) {
    return circuito.fios.some(
      (f) => f.origem?.componente === comp.id || f.destino?.componente === comp.id
    );
  }

  function nosDesconectados(circuito) {
    if (!estado?.simulando) return [];
    return circuito.componentes.filter(
      (c) => c.tipo === 'NO' && !noEstaConectado(circuito, c)
    );
  }

  /** Círculo vermelho tracejado que gira no sentido horário ao redor de nós soltos. */
  function desenharAlertaNosDesconectados(ctx, circuito, view) {
    const soltos = nosDesconectados(circuito);
    if (soltos.length === 0) return;

    const fase = (performance.now() / 1000) * 24; // px de dash por segundo
    for (const comp of soltos) {
      const dim = CATALOGO[comp.tipo].dimensoes;
      const centro = mundoParaTela(comp.x + dim.w / 2, comp.y + dim.h / 2);
      ctx.save();
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      // O arco é percorrido no sentido horário; deslocar o offset para valores
      // negativos faz os traços avançarem nesse mesmo sentido.
      ctx.lineDashOffset = -fase;
      ctx.beginPath();
      ctx.arc(centro.x, centro.y, 8 * view.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  let indicadoresAnimacaoRafId = null;
  function atualizarAnimacaoIndicadores(circuito, fioSelecionadoId, fioFantasma) {
    const animar = fioFantasma || circuito.fios.some((fio) => fio.id === fioSelecionadoId)
      || nosDesconectados(circuito).length > 0;
    if (animar && !indicadoresAnimacaoRafId) {
      indicadoresAnimacaoRafId = requestAnimationFrame(() => {
        indicadoresAnimacaoRafId = null;
        if (ultimoRenderArgs) render(...ultimoRenderArgs);
      });
    } else if (!animar && indicadoresAnimacaoRafId) {
      cancelAnimationFrame(indicadoresAnimacaoRafId);
      indicadoresAnimacaoRafId = null;
    }
  }

  function render(circuito, selecionados = [], fioSelecionadoId = null, dobraSelecionada = null, fioFantasma = null, selecaoRetangular = null, grupoSelecionadoId = null) {
    ultimoRenderArgs = [circuito, selecionados, fioSelecionadoId, dobraSelecionada, fioFantasma, selecaoRetangular, grupoSelecionadoId];
    desenharGrade();

    // Grupos primeiro (atrás de tudo)
    desenharGrupos(ctx, circuito, view, grupoSelecionadoId);

    const coresPorComponente = new Map();
    for (const fio of circuito.fios) {
      for (const ponta of [fio.origem, fio.destino]) {
        if (!coresPorComponente.has(ponta.componente)) {
          coresPorComponente.set(ponta.componente, {});
        }
        const coresPorPino = coresPorComponente.get(ponta.componente);
        const cores = coresPorPino[ponta.pino] || (coresPorPino[ponta.pino] = []);
        const cor = fio.cor || CORES.traco;
        if (!cores.includes(cor)) cores.push(cor);
      }
    }

    // O barramento fica atrás dos fios para que eles não desapareçam sob o corpo.
    for (const comp of circuito.componentes) {
      if (comp.tipo !== 'BARRAMENTO') continue;
      const tela = mundoParaTela(comp.x, comp.y);
      desenharComponente(ctx, comp, tela.x, tela.y, view.zoom, {
        coresConexao: coresPorComponente.get(comp.id),
        pinoEmHover,
      });
    }

    // Fios
    desenharFios(ctx, circuito, view, fioSelecionadoId, dobraSelecionada);

    // Guias visuais de alinhamento
    desenharGuias(ctx);

    // Componentes
    for (const comp of circuito.componentes) {
      if (comp.tipo === 'BARRAMENTO') {
        desenharNomeComponente(ctx, comp, view);
        continue;
      }
      const tela = mundoParaTela(comp.x, comp.y);
      desenharComponente(ctx, comp, tela.x, tela.y, view.zoom, {
        coresConexao: coresPorComponente.get(comp.id),
        pinoEmHover,
      });
      desenharNomeComponente(ctx, comp, view);
    }

    // Alerta de nós sem conexão durante a simulação
    desenharAlertaNosDesconectados(ctx, circuito, view);
    atualizarAnimacaoIndicadores(circuito, fioSelecionadoId, fioFantasma);

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

    // Contorno animado da função Construir
    desenharContornoConstruir(ctx, view);
  }

  return {
    view,
    redimensionar,
    render,
    iniciarContornoConstruir,
    pararContornoConstruir,
    telaParaMundo,
    mundoParaTela,
    get ctx() { return ctx; },
    get elemento() { return elemento; },
    get ultimoMouse() { return ultimoMouse; },
    set ultimoMouse(valor) { if (valor) ultimoMouse = valor; },
  };
}
