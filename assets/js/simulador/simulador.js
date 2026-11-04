/**
 * simulador.js — Orquestrador da página do simulador fiel.
 * Reaproveita o motor lógico e o editor, mas usa canvas-fiel e paleta-fiel.
 */

import { criarCanvasFiel } from './canvas-fiel.js';
import { criarPaletaFiel } from './paleta-fiel.js';
import { configurarFiosFiel } from './fios-fiel.js';
import { dimensoesSimbolo } from './simbolos.js';
import {
  criarCircuito,
  criarComponente,
  adicionarComponente,
  removerComponente,
  propagar,
  acionarSwitch,
  buscarComponente,
} from '../core/circuit.js';
import { tictac, resetar } from '../core/clock.js';
import { serializar, desserializar } from '../core/serializer.js';

/**
 * Inicializa o simulador fiel.
 */
export function inicializarSimulador({ canvas: elCanvas, paleta: elPaleta, painel: elPainel }) {
  const circuito = criarCircuito();
  const canvas = criarCanvasFiel(elCanvas);

  const estado = {
    selecionadoId: null,
    fioFantasma: null,
    arrastando: null,
    panIniciado: null,
  };

  const editor = {
    get circuito() { return circuito; },
    get selecionadoId() { return estado.selecionadoId; },

    renderizar() {
      canvas.render(circuito, estado.selecionadoId, null, estado.fioFantasma);
    },

    selecionar(id) {
      estado.selecionadoId = id;
      editor.renderizar();
      atualizarPainel();
    },

    componenteEm(x, y) {
      for (let i = circuito.componentes.length - 1; i >= 0; i--) {
        const c = circuito.componentes[i];
        const dim = dimensoesSimbolo(c.tipo);
        if (x >= c.posicao.x && x <= c.posicao.x + dim.w &&
            y >= c.posicao.y && y <= c.posicao.y + dim.h) {
          return c;
        }
      }
      return null;
    },

    adicionarComponente(item, posicao) {
      const comp = criarComponente(item.tipo, {
        numEntradas: item.numEntradas,
        numSaidas: item.numSaidas,
        rotulo: item.rotulo,
        posicao,
      });
      adicionarComponente(circuito, comp);
      propagar(circuito);
      estado.selecionadoId = comp.id;
      editor.renderizar();
      atualizarPainel();
      return comp;
    },

    moverComponente(id, x, y) {
      const comp = circuito.componentes.find((c) => c.id === id);
      if (!comp) return;
      comp.posicao.x = Math.round(x / 20) * 20;
      comp.posicao.y = Math.round(y / 20) * 20;
      editor.renderizar();
    },

    removerSelecionado() {
      if (!estado.selecionadoId) return;
      removerComponente(circuito, estado.selecionadoId);
      estado.selecionadoId = null;
      propagar(circuito);
      editor.renderizar();
      atualizarPainel();
    },

    conectar(origem, destino) {
      const compO = buscarComponente(circuito, origem.componente);
      const compD = buscarComponente(circuito, destino.componente);
      if (!compO || !compD) return null;
      const pinoO = compO.saidas.find((p) => p.id === origem.pino);
      const pinoD = compD.entradas.find((p) => p.id === destino.pino);
      if (!pinoO || !pinoD) return null;

      // Verifica duplicata
      const existe = circuito.fios.some(
        (f) => f.origem.componente === origem.componente &&
               f.origem.pino === origem.pino &&
               f.destino.componente === destino.componente &&
               f.destino.pino === destino.pino
      );
      if (existe) return null;

      const novo = {
        id: `fio_${Date.now()}_${Math.random()}`,
        origem: { ...origem },
        destino: { ...destino },
      };
      circuito.fios.push(novo);
      propagar(circuito);
      editor.renderizar();
      return novo;
    },
  };

  // ---- Painel de propriedades ----
  function atualizarPainel() {
    if (!elPainel) return;
    elPainel.innerHTML = '';

    const comp = estado.selecionadoId ? buscarComponente(circuito, estado.selecionadoId) : null;
    if (!comp) {
      const vazio = document.createElement('p');
      vazio.className = 'simulador-painel-vazio';
      vazio.textContent = 'Selecione um componente';
      elPainel.appendChild(vazio);
      return;
    }

    const titulo = document.createElement('h3');
    titulo.className = 'simulador-painel-titulo';
    titulo.textContent = comp.rotulo;
    elPainel.appendChild(titulo);

    // Switch: toggle
    if (comp.tipo === 'SWITCH') {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'simulador-toggle';
      botao.textContent = comp.estado.ativo === 1 ? '1 (ligado)' : '0 (desligado)';
      botao.dataset.ativo = comp.estado.ativo === 1 ? 'true' : 'false';
      botao.addEventListener('click', () => {
        acionarSwitch(circuito, comp.id, comp.estado.ativo === 1 ? 0 : 1);
        editor.renderizar();
        atualizarPainel();
      });
      elPainel.appendChild(botao);
    }

    // Clock: pulso e automático
    if (comp.tipo === 'CLOCK') {
      const grupo = document.createElement('div');
      grupo.className = 'simulador-botoes';

      const pulso = document.createElement('button');
      pulso.type = 'button';
      pulso.className = 'btn btn--secondary btn--sm';
      pulso.textContent = 'Pulso';
      pulso.addEventListener('click', () => {
        tictac(circuito);
        editor.renderizar();
        atualizarPainel();
      });
      grupo.appendChild(pulso);

      const auto = document.createElement('button');
      auto.type = 'button';
      auto.className = 'btn btn--primary btn--sm';
      auto.textContent = comp.estado.rodando ? 'Parar' : 'Automático';
      auto.addEventListener('click', () => {
        if (comp.estado.rodando) {
          clearInterval(comp.estado.intervalo);
          comp.estado.rodando = false;
        } else {
          comp.estado.intervalo = setInterval(() => {
            tictac(circuito);
            editor.renderizar();
          }, 500);
          comp.estado.rodando = true;
        }
        atualizarPainel();
      });
      grupo.appendChild(auto);

      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'btn btn--ghost btn--sm';
      reset.textContent = 'Reset';
      reset.addEventListener('click', () => {
        resetar(circuito);
        editor.renderizar();
        atualizarPainel();
      });
      grupo.appendChild(reset);

      elPainel.appendChild(grupo);
    }

    // LED: indicador
    if (comp.tipo === 'LED') {
      const indicador = document.createElement('div');
      indicador.className = 'simulador-indicador';
      indicador.dataset.aceso = comp.estado.aceso ? 'true' : 'false';
      indicador.textContent = comp.estado.aceso ? 'Aceso' : 'Apagado';
      elPainel.appendChild(indicador);
    }

    // Remover
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'btn btn--perigo btn--sm btn--bloco';
    remover.textContent = 'Remover componente';
    remover.style.marginTop = '16px';
    remover.addEventListener('click', () => editor.removerSelecionado());
    elPainel.appendChild(remover);
  }

  // ---- Interação ----
  const el = elCanvas;

  el.addEventListener('mousedown', (e) => {
    if (estado.fioEmConstrucao) return;

    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mundo = canvas.telaParaMundo(mx, my);

    if (e.button === 1 || e.shiftKey) {
      estado.panIniciado = { x: mx, y: my, panX: canvas.view.panX, panY: canvas.view.panY };
      el.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    const comp = editor.componenteEm(mundo.x, mundo.y);
    if (comp) {
      editor.selecionar(comp.id);
      estado.arrastando = {
        compId: comp.id,
        offsetX: mundo.x - comp.posicao.x,
        offsetY: mundo.y - comp.posicao.y,
      };
      el.style.cursor = 'grabbing';
    } else {
      editor.selecionar(null);
    }
  });

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mundo = canvas.telaParaMundo(mx, my);

    if (estado.panIniciado) {
      canvas.view.panX = estado.panIniciado.panX + (mx - estado.panIniciado.x);
      canvas.view.panY = estado.panIniciado.panY + (my - estado.panIniciado.y);
      editor.renderizar();
      return;
    }

    if (estado.arrastando) {
      editor.moverComponente(
        estado.arrastando.compId,
        mundo.x - estado.arrastando.offsetX,
        mundo.y - estado.arrastando.offsetY
      );
      return;
    }

    const comp = editor.componenteEm(mundo.x, mundo.y);
    el.style.cursor = comp ? 'grab' : 'default';
  });

  el.addEventListener('mouseup', () => {
    estado.arrastando = null;
    estado.panIniciado = null;
    el.style.cursor = 'default';
  });

  el.addEventListener('mouseleave', () => {
    estado.arrastando = null;
    estado.panIniciado = null;
  });

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const antes = canvas.telaParaMundo(mx, my);
    const fator = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const novoZoom = Math.min(3, Math.max(0.3, canvas.view.zoom * fator));
    canvas.view.zoom = novoZoom;
    const depois = canvas.telaParaMundo(mx, my);
    canvas.view.panX += (depois.x - antes.x) * novoZoom;
    canvas.view.panY += (depois.y - antes.y) * novoZoom;
    editor.renderizar();
  }, { passive: false });

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    const dados = e.dataTransfer.getData('application/x-arandua-componente');
    if (!dados) return;
    const item = JSON.parse(dados);
    const rect = el.getBoundingClientRect();
    const mundo = canvas.telaParaMundo(e.clientX - rect.left, e.clientY - rect.top);
    const dim = dimensoesSimbolo(item.tipo);
    editor.adicionarComponente(item, {
      x: mundo.x - dim.w / 2,
      y: mundo.y - dim.h / 2,
    });
  });

  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && estado.selecionadoId) {
      editor.removerSelecionado();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      editor.selecionar(null);
    }
  });

  // ---- Inicialização ----
  canvas.redimensionar();
  window.addEventListener('resize', () => {
    canvas.redimensionar();
    editor.renderizar();
  });

  criarPaletaFiel(elPaleta, (item) => {
    const centro = canvas.telaParaMundo(
      elCanvas.getBoundingClientRect().width / 2,
      elCanvas.getBoundingClientRect().height / 2
    );
    const dim = dimensoesSimbolo(item.tipo);
    editor.adicionarComponente(item, {
      x: centro.x - dim.w / 2,
      y: centro.y - dim.h / 2,
    });
  });

  configurarFiosFiel(canvas, editor, estado);

  editor.renderizar();
  atualizarPainel();

  return editor;
}