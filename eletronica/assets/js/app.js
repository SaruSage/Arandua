/**
 * app.js — Orquestrador da aplicação de eletrônica.
 * Monta a interface, paleta, canvas e painel.
 */

import { CATALOGO, CATEGORIAS, itensDaCategoria } from './catalogo.js';
import { criarCircuito, adicionarComponente, removerComponente } from './circuito.js';
import { criarCanvas } from './canvas.js';
import { configurarInteracao } from './selecao.js';
import { configurarFios } from './fios.js';
import { renderizarPainel as renderizarPainelNovo } from './painel.js';
import { simular, tensaoEm, correnteEm } from './solver.js';

const estado = {
  circuito: criarCircuito(),
  selecionados: [],
  resultado: null,
  adicionar(tipo, x, y) {
    const comp = adicionarComponente(estado.circuito, tipo, x, y);
    estado.selecionados = [comp.id];
    renderizarTudo();
  },
  removerSelecionados() {
    for (const id of estado.selecionados) {
      removerComponente(estado.circuito, id);
    }
    estado.selecionados = [];
    renderizarTudo();
  },
};

let canvas = null;
let elPainel = null;

function montarInterface() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="eletronica-layout">
      <header class="eletronica-toolbar">
        <h1>Laboratório de Eletrônica</h1>
        <button type="button" class="btn-simular" id="btn-simular">▶ Simular</button>
        <button type="button" class="btn-limpar" id="btn-limpar">Limpar resultados</button>
        <span class="eletronica-dica">
          Arraste componentes · Clique em pino para conectar · Tab cria dobra no fio · R gira 90° · Roda = zoom
        </span>
      </header>
      <aside class="eletronica-paleta" id="paleta"></aside>
      <div class="eletronica-canvas">
        <canvas id="canvas"></canvas>
      </div>
      <aside class="eletronica-painel" id="painel"></aside>
    </div>
  `;

  montarPaleta(document.getElementById('paleta'));
  elPainel = document.getElementById('painel');
  canvas = criarCanvas(document.getElementById('canvas'));
  canvas.redimensionar();

  const fios = configurarFios(canvas, estado, renderizarTudo);
  estado.fioSelecionadoId = null;
  estado.fioFantasma = null;
  configurarInteracao(canvas, estado, renderizarTudo);

  document.getElementById('btn-simular').addEventListener('click', () => {
    estado.resultado = simular(estado.circuito);
    renderizarTudo();
  });

  document.getElementById('btn-limpar').addEventListener('click', () => {
    estado.resultado = null;
    for (const c of estado.circuito.componentes) {
      if (c.estado) {
        c.estado.aceso = false;
        c.estado.segmentos = [0, 0, 0, 0, 0, 0, 0];
      }
    }
    renderizarTudo();
  });

  window.addEventListener('resize', () => {
    canvas.redimensionar();
    renderizarTudo();
  });

  renderizarTudo();
}

function montarPaleta(container) {
  container.innerHTML = '';

  for (const categoria of CATEGORIAS) {
    const itens = itensDaCategoria(categoria);
    if (itens.length === 0) continue;

    const secao = document.createElement('section');
    secao.className = 'paleta-grupo';

    const titulo = document.createElement('h3');
    titulo.className = 'paleta-titulo';
    titulo.textContent = categoria;
    secao.appendChild(titulo);

    const grade = document.createElement('div');
    grade.className = 'paleta-grade';

    for (const item of itens) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'paleta-item';
      botao.draggable = true;
      botao.title = item.rotulo;

      const miniatura = document.createElement('canvas');
      miniatura.className = 'paleta-miniatura';
      botao.appendChild(miniatura);

      const label = document.createElement('span');
      label.className = 'paleta-label';
      label.textContent = item.rotulo;
      botao.appendChild(label);

      requestAnimationFrame(() => desenharMiniatura(miniatura, item.tipo));

      botao.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-eletronica', item.tipo);
        e.dataTransfer.effectAllowed = 'copy';
      });

      botao.addEventListener('click', () => {
        const centro = canvas.telaParaMundo(
          canvas.elemento.getBoundingClientRect().width / 2,
          canvas.elemento.getBoundingClientRect().height / 2
        );
        const dim = CATALOGO[item.tipo].dimensoes;
        estado.adicionar(item.tipo, centro.x - dim.w / 2, centro.y - dim.h / 2);
      });

      grade.appendChild(botao);
    }

    secao.appendChild(grade);
    container.appendChild(secao);
  }
}

async function desenharMiniatura(canvasMini, tipo) {
  const { desenharComponente } = await import('./simbolos.js');
  const ctx = canvasMini.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const largura = 64;
  const altura = 52;
  canvasMini.width = largura * dpr;
  canvasMini.height = altura * dpr;
  canvasMini.style.width = `${largura}px`;
  canvasMini.style.height = `${altura}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largura, altura);

  const dim = CATALOGO[tipo].dimensoes;
  const escala = Math.min((largura - 20) / dim.w, (altura - 14) / dim.h);
  const w = dim.w * escala;
  const h = dim.h * escala;
  const x = (largura - w) / 2;
  const y = (altura - h) / 2;

  const compFake = {
    tipo,
    x: 0, y: 0,
    rotacao: 0,
    propriedades: {},
    pinos: CATALOGO[tipo].pinos.map((p) => ({ ...p })),
    dimensoes: dim,
  };

  desenharComponente(ctx, compFake, x, y, w, h);
}

function renderizarTudo() {
  if (!canvas) return;
  canvas.render(
    estado.circuito,
    estado.selecionados,
    estado.fioSelecionadoId,
    null,
    estado.fioFantasma
  );
  renderizarPainel();
}

function renderizarPainel() {
  if (!elPainel) return;
  renderizarPainelNovo(elPainel, estado, renderizarTudo, abrirMontagem);

  // Adiciona seção de resultado da simulação
  if (estado.resultado && estado.selecionados.length === 1) {
    const comp = estado.circuito.componentes.find((c) => c.id === estado.selecionados[0]);
    if (comp) {
      const secao = document.createElement('div');
      secao.className = 'painel-secao';
      const titulo = document.createElement('h4');
      titulo.textContent = 'Simulação';
      secao.appendChild(titulo);

      const tensao = tensaoEm(estado.resultado, comp.id, comp.pinos[0]?.id);
      const corrente = correnteEm(estado.resultado, comp.id);

      const linhaT = document.createElement('p');
      linhaT.className = 'painel-resultado';
      linhaT.textContent = `Tensão: ${tensao.toFixed(3)} V`;
      secao.appendChild(linhaT);

      const linhaI = document.createElement('p');
      linhaI.className = 'painel-resultado';
      const mA = corrente * 1000;
      linhaI.textContent = `Corrente: ${Math.abs(mA) < 1 ? (corrente * 1e6).toFixed(1) + ' µA' : mA.toFixed(2) + ' mA'}`;
      secao.appendChild(linhaI);

      elPainel.appendChild(secao);
    }
  }

  if (estado.resultado && !estado.resultado.convergiu) {
    const aviso = document.createElement('div');
    aviso.className = 'painel-aviso';
    aviso.textContent = estado.resultado.erro;
    elPainel.appendChild(aviso);
  }
}

function abrirMontagem(comp) {
  // Placeholder — será implementado na Fase E7
  alert(`Ver montagem: ${CATALOGO[comp.tipo].rotulo}\n\nEm breve: visualização do sub-circuito interno.`);
}

montarInterface();