/**
 * selecao.js — Seleção, arrasto, rotação e pan no canvas.
 */

import { componenteEm, moverComponente, rotacionarComponente } from './circuito.js';
import { CATALOGO, obterDimensoesComponente } from './catalogo.js';
import { registrar } from './historico.js';
import { recalcularMembros, pontoDentroDoGrupo, sincronizarVerticesVinculados } from './grupos.js';
import {
  componenteNomeEm,
  layoutNomeComponente,
  projetarCentroNomeComponente,
  snap,
  TAMANHO_GRADE,
} from './canvas.js';
import { posicaoPino } from './simbolos.js';

const TOLERANCIA = 8; // px

export function configurarInteracao(canvas, estado, aoMudar) {
  const el = canvas.elemento;
  const renderizarTudo = aoMudar;
  const recalcular = () => {
    if (estado.simulando) estado.recalcular?.();
  };
  let arrastando = null;
  let arrastandoNomeComponente = null;
  let panIniciado = null;
  const contextoNome = el.getContext?.('2d') || null;
  estado.componenteNomeEm = (x, y) =>
    Boolean(componenteNomeEm(estado.circuito, x, y, contextoNome, canvas.view.zoom));

  function atualizarNomeComponente(e) {
    if (!arrastandoNomeComponente) return;
    const rect = el.getBoundingClientRect();
    const mundo = canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
    const { comp, deslocamentoCursor, centroInicial } = arrastandoNomeComponente;
    const layout = layoutNomeComponente(contextoNome, comp, canvas.view.zoom);
    if (!layout) return;

    const centro = projetarCentroNomeComponente(
      layout.bounds,
      layout.meiaLargura,
      layout.meiaAltura,
      {
        x: mundo.x - deslocamentoCursor.x,
        y: mundo.y - deslocamentoCursor.y,
      }
    );
    const centroBoundsX = layout.bounds.x + layout.bounds.w / 2;
    const centroBoundsY = layout.bounds.y + layout.bounds.h / 2;
    comp.propriedades.posicaoNome = {
      dx: centro.x - centroBoundsX,
      dy: centro.y - centroBoundsY,
    };
    if (!arrastandoNomeComponente.moveu && Math.hypot(
      centro.x - centroInicial.x,
      centro.y - centroInicial.y
    ) > 2) {
      arrastandoNomeComponente.moveu = true;
    }
    aoMudar();
  }

  function finalizarNomeComponente() {
    if (!arrastandoNomeComponente) return;
    const { comp, posicaoInicial, moveu } = arrastandoNomeComponente;
    arrastandoNomeComponente = null;
    if (moveu) {
      registrar(estado.circuito, 'mover nome', true);
    } else if (posicaoInicial) {
      comp.propriedades.posicaoNome = posicaoInicial;
    } else {
      delete comp.propriedades.posicaoNome;
    }
    el.style.cursor = 'default';
    aoMudar();
  }

  function atualizarPan(e) {
    if (!panIniciado) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    canvas.view.panX = panIniciado.panX + (mx - panIniciado.x);
    canvas.view.panY = panIniciado.panY + (my - panIniciado.y);
    aoMudar();
  }

  function finalizarPan() {
    if (!panIniciado) return;
    panIniciado = null;
    el.style.cursor = 'default';
  }

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
    estado.arrastoInicial = null;
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
      if (idsMovidos && idsMovidos.size === 1) {
        const idClicado = idsMovidos.values().next().value;
        const compClicado = estado.circuito.componentes.find((c) => c.id === idClicado);
        if (compClicado && ['CHAVE', 'CHAVE_SIMPLES', 'BOTAO'].includes(compClicado.tipo)) {
          if (compClicado.tipo === 'BOTAO') {
            compClicado.propriedades.pressionado = !compClicado.propriedades.pressionado;
          } else {
            compClicado.propriedades.fechada = !compClicado.propriedades.fechada;
          }
          registrar(estado.circuito, 'alternar', true);
          recalcular();
        }
      }
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

    if (e.button === 2) {
      const nome = componenteNomeEm(
        estado.circuito,
        mundo.x,
        mundo.y,
        contextoNome,
        canvas.view.zoom
      );
      if (nome) {
        const posicaoInicial = nome.comp.propriedades?.posicaoNome;
        arrastandoNomeComponente = {
          comp: nome.comp,
          posicaoInicial: posicaoInicial ? { ...posicaoInicial } : null,
          centroInicial: { ...nome.layout.centro },
          deslocamentoCursor: {
            x: mundo.x - nome.layout.centro.x,
            y: mundo.y - nome.layout.centro.y,
          },
          moveu: false,
        };
        el.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }

    // Pan com botão do meio ou Shift
    if (e.button === 1 || e.shiftKey) {
      panIniciado = { x: mx, y: my, panX: canvas.view.panX, panY: canvas.view.panY };
      el.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    const comp = componenteEm(estado.circuito, mundo.x, mundo.y);
    if (e.button !== 0 && !(e.button === 2 && comp)) return;

    if (comp) {
      if (e.button === 2) estado.limparSelecaoFio?.();
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
        botao: e.button,
        movido: false,
      };

      if (estado.selecionados.length > 1) {
        const vinculos = new Set(
          estado.circuito.grupos
            .filter((grupo) => estado.selecionados.includes(grupo.id))
            .flatMap((grupo) => (grupo.vertices || []).map((vertice) => vertice.vinculoId))
            .filter(Boolean)
        );
        estado.arrastoInicial = {
          tipo: 'selecao',
          itens: estado.selecionados.map((id) => {
            const c = estado.circuito.componentes.find((x) => x.id === id);
            return c ? { id: c.id, x: c.x, y: c.y, rotacao: c.rotacao } : null;
          }).filter(Boolean),
          grupos: estado.circuito.grupos
            .filter((g) => estado.selecionados.includes(g.id) ||
              (g.vertices || []).some((vertice) => vinculos.has(vertice.vinculoId)))
            .map((g) => ({
              id: g.id,
              x: g.x,
              y: g.y,
              bounds: g.bounds ? { ...g.bounds } : null,
              vertices: g.vertices ? g.vertices.map((v) => ({ ...v })) : null,
            })),
          moveu: false,
        };
      } else {
        estado.arrastoInicial = {
          tipo: 'componente',
          id: comp.id,
          x: comp.x,
          y: comp.y,
          rotacao: comp.rotacao,
          moveu: false,
        };
      }

      el.style.cursor = 'grabbing';
      estado.abrirPopupEntidade?.('comp', comp.id);
      if (e.button === 2) e.preventDefault();
    } else {
      // Recalcula membros das áreas que estavam selecionadas
      for (const id of estado.selecionados) {
        const g = estado.circuito.grupos.find((x) => x.id === id);
        if (g) recalcularMembros(g);
      }

      // Depois limpa a seleção normalmente
      estado.selecionados = [];
      estado.grupoSelecionadoId = null;

      if (estado.fecharPopupsNaoFixados) {
        estado.fecharPopupsNaoFixados();
      } else if (estado.popupAtivo) {
        const cfg = estado.popups?.[estado.popupAtivo];
        if (!cfg || !cfg.fixado) {
          delete estado.popups[estado.popupAtivo];
        }
        estado.popupAtivo = null;
        estado.renderizarPopups?.(true);
      }

      panIniciado = { x: mx, y: my, panX: canvas.view.panX, panY: canvas.view.panY };
      el.style.cursor = 'grabbing';
      e.preventDefault();
    }

    aoMudar();
  });

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- Renomear componente (clique direito) ----
  const inputRenomear = document.getElementById('input-renomear');

  function fecharInputRenomear() {
    if (!inputRenomear) return;
    // Remove o id ANTES de ocultar: o blur causado pelo ocultamento não salva de novo
    delete inputRenomear.dataset.compId;
    inputRenomear.classList.add('oculto');
    inputRenomear.value = '';
  }

  function salvarNome() {
    if (!inputRenomear) return;
    const id = inputRenomear.dataset.compId;
    if (!id) return; // já salvo/cancelado (evita salvar duas vezes: Enter + blur)

    const valor = inputRenomear.value.trim().slice(0, 15);
    fecharInputRenomear();

    const comp = estado.circuito.componentes.find((c) => c.id === id);
    if (!comp) return;
    if ((comp.nomeCustom || '') === valor) return;

    if (valor) {
      comp.nomeCustom = valor;
    } else {
      delete comp.nomeCustom;
    }
    registrar(estado.circuito, 'propriedade', true);
    renderizarTudo();
    estado.renderizarPopups?.(true);
  }

  function abrirInputRenomear(comp, x, y) {
    if (!inputRenomear) return;
    inputRenomear.dataset.compId = comp.id;
    inputRenomear.value = comp.nomeCustom || '';
    inputRenomear.classList.remove('oculto');

    // Posiciona acima do componente
    const altura = 28;
    const larguraMax = Math.max(4, el.clientWidth - 144);
    inputRenomear.style.left = `${Math.min(larguraMax, Math.max(4, x - 70))}px`;
    inputRenomear.style.top = `${Math.max(4, y - altura - 12)}px`;

    inputRenomear.focus();
    inputRenomear.select();
  }

  if (inputRenomear) {
    inputRenomear.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        salvarNome();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        fecharInputRenomear();
      }
      e.stopPropagation(); // não dispara atalhos globais
    });
    inputRenomear.addEventListener('blur', () => salvarNome());
    inputRenomear.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    const rect = el.getBoundingClientRect();
    const mundo = canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);

    // Clique direito em componente: renomear.
    // Chaves/botões continuam alternando com o clique direito; use Alt+clique direito para renomeá-los.
    const alvo = componenteEm(estado.circuito, mundo.x, mundo.y);
    const alternavel = alvo && ['CHAVE', 'CHAVE_SIMPLES', 'BOTAO'].includes(alvo.tipo);
    if (alvo && (!alternavel || e.altKey)) {
      abrirInputRenomear(alvo, e.clientX - rect.left, e.clientY - rect.top);
      return;
    }
    if (!alvo) fecharInputRenomear();

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

  function moverInteracao(e) {
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mundo = canvas.telaParaMundo(mx, my);
    if (typeof estado !== 'undefined' && estado) {
      estado.ultimoMouse = mundo;
    }

    if (arrastandoNomeComponente) {
      atualizarNomeComponente(e);
      return;
    }

    if (panIniciado) {
      atualizarPan(e);
      return;
    }

    if (arrastando) {
      const dxBruto = mundo.x - arrastando.inicio.x;
      const dyBruto = mundo.y - arrastando.inicio.y;
      const LIMIAR = TAMANHO_GRADE / 2;
      if (Math.abs(dxBruto) > LIMIAR || Math.abs(dyBruto) > LIMIAR) {
        arrastando.movido = true;
        if (estado.arrastoInicial) {
          estado.arrastoInicial.moveu = true;
        }
      }
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
            g.vertices = g.vertices.map((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
          }
        }
      }
      sincronizarVerticesVinculados(estado.circuito, idsSelecionados);

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
  }

  el.addEventListener('mousemove', moverInteracao);

  window.addEventListener('mousemove', (e) => {
    if (panIniciado && e.target !== el) atualizarPan(e);
    else if ((arrastandoNomeComponente || arrastando?.botao === 2) && e.target !== el) {
      moverInteracao(e);
    }
  });

  el.addEventListener('mouseup', (e) => {
    if (arrastandoNomeComponente && e.button === 2) finalizarNomeComponente();
    if (arrastando && e.button === arrastando.botao) finalizarArrasto();
    finalizarPan();
    el.style.cursor = 'default';
  });

  el.addEventListener('mouseleave', () => {
    if (panIniciado || arrastando?.botao === 2) return;
    if (arrastando) finalizarArrasto();
  });

  window.addEventListener('mouseup', (e) => {
    if (arrastandoNomeComponente && e.button === 2) finalizarNomeComponente();
    if (arrastando && e.button === arrastando.botao) finalizarArrasto();
    if (e.button === 0) finalizarPan();
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
    const dim = obterDimensoesComponente(tipo);
    estado.adicionar(tipo, mundo.x - dim.w / 2, mundo.y - dim.h / 2);
  });

  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && estado.fioSelecionadoId) {
      // Deixa o handler de fios tratar Delete
      return;
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (arrastandoNomeComponente) {
      const { comp, posicaoInicial } = arrastandoNomeComponente;
      arrastandoNomeComponente = null;
      if (posicaoInicial) comp.propriedades.posicaoNome = posicaoInicial;
      else delete comp.propriedades.posicaoNome;
      el.style.cursor = 'default';
      e.preventDefault();
      renderizarTudo();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (estado.selecionados.length > 0) {
        estado.removerSelecionados();
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      // 1. Se há arrasto em andamento (componente ou seleção múltipla)
      if (estado.arrastoInicial) {
        const a = estado.arrastoInicial;
        if (a.tipo === 'componente') {
          if (a.moveu) {
            const comp = estado.circuito.componentes.find((c) => c.id === a.id);
            if (comp) {
              comp.x = a.x;
              comp.y = a.y;
              if (a.rotacao !== undefined) comp.rotacao = a.rotacao;
            }
            arrastando = null;
            estado.arrastoInicial = null;
            estado.arrastandoId = null;
            estado.guiaAtiva = null;
            el.style.cursor = 'default';
            renderizarTudo();
            return;
          }
          // Não moveu: apenas desseleciona
          arrastando = null;
          estado.arrastoInicial = null;
          estado.arrastandoId = null;
          estado.guiaAtiva = null;
          estado.selecionados = [];
          el.style.cursor = 'default';
          estado.fecharPopupsNaoFixados?.();
          renderizarTudo();
          return;
        }

        if (a.tipo === 'selecao') {
          if (a.moveu) {
            for (const item of a.itens || []) {
              const c = estado.circuito.componentes.find((x) => x.id === item.id);
              if (c) {
                c.x = item.x;
                c.y = item.y;
                if (item.rotacao !== undefined) c.rotacao = item.rotacao;
              }
            }
            for (const gInfo of a.grupos || []) {
              const g = estado.circuito.grupos.find((x) => x.id === gInfo.id);
              if (g) {
                g.x = gInfo.x;
                g.y = gInfo.y;
                if (gInfo.bounds) g.bounds = { ...gInfo.bounds };
                if (gInfo.vertices) g.vertices = gInfo.vertices.map((v) => ({ ...v }));
              }
            }
            arrastando = null;
            estado.arrastoInicial = null;
            estado.arrastandoId = null;
            estado.guiaAtiva = null;
            el.style.cursor = 'default';
            renderizarTudo();
            return;
          }
          // Não moveu: apenas desseleciona
          arrastando = null;
          estado.arrastoInicial = null;
          estado.arrastandoId = null;
          estado.guiaAtiva = null;
          estado.selecionados = [];
          el.style.cursor = 'default';
          estado.fecharPopupsNaoFixados?.();
          renderizarTudo();
          return;
        }

        // Se for outro tipo de arrasto (fio ou área), já tratado no seu respectivo módulo
        return;
      }

      // 2. Se há edição de texto inline (nome de área)
      if (estado.cancelarEdicaoTexto?.()) {
        renderizarTudo();
        return;
      }

      // 3. Se há popup aberto → fecha popups não fixados e retorna
      if (estado.fecharPopupsNaoFixados?.()) {
        renderizarTudo();
        return;
      }

      // 4. Se há seleção → desseleciona
      if (estado.selecionados.length > 0 || estado.grupoSelecionadoId || estado.fioSelecionadoId) {
        for (const id of estado.selecionados) {
          const g = estado.circuito.grupos.find((x) => x.id === id);
          if (g) recalcularMembros(g);
        }
        estado.selecionados = [];
        estado.grupoSelecionadoId = null;
        estado.fioSelecionadoId = null;
        estado.guiaAtiva = null;
        renderizarTudo();
        return;
      }
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
