/**
 * selecao.js — Seleção, arrasto, rotação e pan no canvas.
 */

import { componenteEm, moverComponente, rotacionarComponente } from './circuito.js';
import { CATALOGO } from './catalogo.js';
import { registrar } from './historico.js';
import { recalcularMembros, pontoDentroDoGrupo } from './grupos.js';
import { snap } from './canvas.js';
import { posicaoPino } from './simbolos.js';

const TOLERANCIA = 8; // px

export function configurarInteracao(canvas, estado, aoMudar) {
  const el = canvas.elemento;
  const renderizarTudo = aoMudar;
  const recalcular = () => estado.recalcular?.();
  let arrastando = null;
  let panIniciado = null;

  /**
   * Alinha os pinos do componente arrastado com pinos de outros
   * componentes que estejam próximos.
   */
  function alinharPinos(comp) {
    const listaPinos = comp.pinos || CATALOGO[comp.tipo]?.pinos || [];
    const pinos = listaPinos.map((p) => ({
      pino: p,
      mundo: posicaoPino(comp, p),
    })).filter((item) => item.mundo);

    let alinhouY = false;
    let alinhouX = false;

    for (const outro of estado.circuito.componentes) {
      if (outro.id === comp.id) continue;

      const pinosOutro = outro.pinos || CATALOGO[outro.tipo]?.pinos || [];
      for (const pOutro of pinosOutro) {
        const mOutro = posicaoPino(outro, pOutro);
        if (!mOutro) continue;

        for (const { mundo } of pinos) {
          // Alinhamento horizontal (mesma altura)
          if (!alinhouY
              && Math.abs(mundo.y - mOutro.y) < TOLERANCIA
              && Math.abs(mundo.y - mOutro.y) > 0) {
            const ajuste = mOutro.y - mundo.y;
            comp.y += ajuste;
            alinhouY = true;
          }

          // Alinhamento vertical (mesma coluna)
          if (!alinhouX
              && Math.abs(mundo.x - mOutro.x) < TOLERANCIA
              && Math.abs(mundo.x - mOutro.x) > 0) {
            const ajuste = mOutro.x - mundo.x;
            comp.x += ajuste;
            alinhouX = true;
          }

          if (alinhouY && alinhouX) return;
        }
      }
    }
  }

  function finalizarArrasto() {
    const moveu = arrastando?.movido;
    const idsMovidos = arrastando?.ids ? new Set(arrastando.ids) : null;
    arrastando = null;
    estado.guiaAtiva = null;
    if (moveu) {
      // Snap na posição absoluta e alinhamento de pinos dos componentes movidos
      if (idsMovidos) {
        for (const comp of estado.circuito.componentes) {
          if (!idsMovidos.has(comp.id)) continue;
          comp.x = snap(comp.x);
          comp.y = snap(comp.y);
          alinharPinos(comp);
        }
      }

      // Se um componente foi removido manualmente de sua área original (arrastado para fora dela),
      // libera-o da área original
      if (idsMovidos) {
        for (const comp of estado.circuito.componentes) {
          if (!idsMovidos.has(comp.id)) continue;
          for (const g of estado.circuito.grupos) {
            if (idsMovidos.has(g.id)) continue;
            if (g.membros.includes(comp.id) && !pontoDentroDoGrupo(comp, g)) {
              g.membros = g.membros.filter((m) => m !== comp.id);
            }
          }
        }
      }

      // Verifica se o componente solto entrou em alguma área
      const comp = estado.circuito.componentes.find(
        (c) => c.id === estado.arrastandoId
      );

      if (comp) {
        // Só adquire se o componente não tem dono
        const jaTemDono = estado.circuito.grupos.some((g) =>
          g.membros.includes(comp.id)
        );

        if (!jaTemDono) {
          // Procura a área mais interna que contém o componente
          const areas = estado.circuito.grupos
            .filter((g) => pontoDentroDoGrupo(comp, g))
            .sort((a, b) => (a.w * a.h) - (b.w * b.h)); // menor primeiro

          if (areas.length > 0) {
            areas[0].membros.push(comp.id);
          }
        }
      }

      registrar(estado.circuito, 'mover', true);
      aoMudar();
      recalcular();
    } else {
      aoMudar();
    }
    estado.arrastandoId = null;
  }

  el.addEventListener('mousedown', (e) => {
    if (estado.fioFantasma || estado.fioSelecionadoId) {
      // Fios têm prioridade; o handler de fios já tratou o evento
      if (e.target === el && estado.fioFantasma) return;
    }

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
      estado.grupoSelecionadoId = null;
      if (e.ctrlKey || e.metaKey) {
        // Alterna seleção
        const idx = estado.selecionados.indexOf(comp.id);
        if (idx >= 0) estado.selecionados.splice(idx, 1);
        else estado.selecionados.push(comp.id);
      } else if (!estado.selecionados.includes(comp.id)) {
        for (const id of estado.selecionados) {
          const g = estado.circuito.grupos.find((x) => x.id === id);
          if (g) recalcularMembros(g);
        }
        estado.selecionados = [comp.id];
      }

      estado._ultimoDx = 0;
      estado._ultimoDy = 0;
      estado.arrastandoId = comp.id;
      const posicoesIniciais = new Map();
      for (const c of estado.circuito.componentes) {
        if (estado.selecionados.includes(c.id)) {
          posicoesIniciais.set(c.id, { x: c.x, y: c.y });
        }
      }
      arrastando = {
        ids: [...estado.selecionados],
        inicio: { x: mundo.x, y: mundo.y },
        posicoesIniciais,
        movido: false,
      };
      el.style.cursor = 'grabbing';
      estado.abrirPopupEntidade?.('comp', comp.id);
    } else {
      // Recalcula membros das áreas que estavam selecionadas
      for (const id of estado.selecionados) {
        const g = estado.circuito.grupos.find((x) => x.id === id);
        if (g) recalcularMembros(g);
      }

      // Depois limpa a seleção normalmente
      estado.selecionados = [];
      estado.grupoSelecionadoId = null;

      if (estado.popupAtivo) {
        const cfg = estado.popups?.[estado.popupAtivo];
        if (!cfg || !cfg.fixado) {
          delete estado.popups[estado.popupAtivo];
        }
        estado.popupAtivo = null;
        estado.renderizarPopups?.(true);
      }
    }

    aoMudar();
  });

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    const rect = el.getBoundingClientRect();
    const mundo = canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);

    // Procura um componente alternável sob o cursor
    const comp = estado.circuito.componentes.find((c) => {
      if (!['CHAVE', 'CHAVE_SIMPLES', 'BOTAO'].includes(c.tipo)) return false;
      const dim = c.dimensoes || { w: 64, h: 30 };
      return (
        mundo.x >= c.x &&
        mundo.x <= c.x + dim.w &&
        mundo.y >= c.y &&
        mundo.y <= c.y + dim.h
      );
    });

    if (!comp) return; // fora de componente alternável: não faz nada

    // Alterna o estado
    if (comp.tipo === 'BOTAO') {
      comp.propriedades.pressionado = !comp.propriedades.pressionado;
    } else {
      comp.propriedades.fechada = !comp.propriedades.fechada;
    }

    // Registra no histórico e recalcula ao vivo
    registrar(estado.circuito, 'alternar', true);
    renderizarTudo();
    if (typeof recalcular === 'function') recalcular();
  });

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mundo = canvas.telaParaMundo(mx, my);
    if (typeof estado !== 'undefined' && estado) {
      estado.ultimoMouse = mundo;
    }

    if (panIniciado) {
      canvas.view.panX = panIniciado.panX + (mx - panIniciado.x);
      canvas.view.panY = panIniciado.panY + (my - panIniciado.y);
      aoMudar();
      return;
    }

    if (arrastando) {
      const dxBruto = mundo.x - arrastando.inicio.x;
      const dyBruto = mundo.y - arrastando.inicio.y;
      const dxTotal = snap(dxBruto);
      const dyTotal = snap(dyBruto);
      const dx = dxTotal - (estado._ultimoDx || 0);
      const dy = dyTotal - (estado._ultimoDy || 0);
      estado._ultimoDx = dxTotal;
      estado._ultimoDy = dyTotal;

      if (dx === 0 && dy === 0) return;

      const idsSelecionados = new Set(estado.selecionados);

      // Move os componentes aplicando snap na posição absoluta
      for (const comp of estado.circuito.componentes) {
        if (idsSelecionados.has(comp.id)) {
          const ini = arrastando.posicoesIniciais?.get(comp.id);
          if (ini) {
            comp.x = snap(ini.x + dxBruto);
            comp.y = snap(ini.y + dyBruto);
          } else {
            comp.x = snap(comp.x + dx);
            comp.y = snap(comp.y + dy);
          }
          alinharPinos(comp);
        }
      }

      let guiaX = null;
      let guiaY = null;

      const comp = estado.circuito.componentes.find(
        (c) => c.id === estado.arrastandoId
      );

      if (comp) {
        const pinosComp = comp.pinos || CATALOGO[comp.tipo]?.pinos || [];
        for (const p of pinosComp) {
          const m = posicaoPino(comp, p);
          if (!m) continue;

          for (const outro of estado.circuito.componentes) {
            if (outro.id === comp.id) continue;

            const pinosOutro = outro.pinos || CATALOGO[outro.tipo]?.pinos || [];
            for (const pOutro of pinosOutro) {
              const mOutro = posicaoPino(outro, pOutro);
              if (!mOutro) continue;

              if (Math.abs(m.y - mOutro.y) < 2) guiaY = m.y;
              if (Math.abs(m.x - mOutro.x) < 2) guiaX = m.x;
            }
          }
        }
      }

      estado.guiaAtiva = (guiaX !== null || guiaY !== null)
        ? { guiaX, guiaY }
        : null;

      // Move os grupos selecionados
      for (const g of estado.circuito.grupos) {
        if (idsSelecionados.has(g.id)) {
          g.x += dx;
          g.y += dy;
          if (g.bounds) {
            g.bounds.x += dx;
            g.bounds.y += dy;
          }
          if (g.vertices) {
            g.vertices = g.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy }));
          }
        }
      }

      // Move as dobras dos fios cujos DOIS extremos estão selecionados
      for (const fio of estado.circuito.fios) {
        const origemSel = idsSelecionados.has(fio.origem.componente);
        const destinoSel = idsSelecionados.has(fio.destino.componente);

        if (origemSel && destinoSel && fio.dobras?.length) {
          fio.dobras = fio.dobras.map((d) => ({ x: d.x + dx, y: d.y + dy }));
        }
      }

      arrastando.movido = true;
      aoMudar();
      return;
    }

    const comp = componenteEm(estado.circuito, mundo.x, mundo.y);
    el.style.cursor = comp ? 'grab' : 'default';
  });

  el.addEventListener('mouseup', () => {
    finalizarArrasto();
    panIniciado = null;
    el.style.cursor = 'default';
  });

  el.addEventListener('mouseleave', () => {
    finalizarArrasto();
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
    if (estado.fioSelecionadoId) {
      // Deixa o handler de fios tratar Delete
      return;
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (estado.selecionados.length > 0) {
        estado.removerSelecionados();
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      // Recalcula membros das áreas que estavam selecionadas
      for (const id of estado.selecionados) {
        const g = estado.circuito.grupos.find((x) => x.id === id);
        if (g) recalcularMembros(g);
      }

      // Depois limpa a seleção normalmente
      estado.selecionados = [];
      estado.grupoSelecionadoId = null;
      estado.guiaAtiva = null;

      if (estado.popupAtivo) {
        const cfg = estado.popups?.[estado.popupAtivo];
        if (!cfg || !cfg.fixado) {
          delete estado.popups[estado.popupAtivo];
        }
        estado.popupAtivo = null;
        estado.renderizarPopups?.(true);
      }
      aoMudar();
    } else if (e.key === 'r' || e.key === 'R') {
      if (estado.selecionados.length > 0) {
        const comp = estado.circuito.componentes.find((c) => c.id === estado.selecionados[0]);
        if (comp) {
          rotacionarComponente(estado.circuito, comp.id, comp.rotacao + 90);
          registrar(estado.circuito, 'rotacionar', true);
          aoMudar();
          recalcular();
        }
      }
    }
  });
}
