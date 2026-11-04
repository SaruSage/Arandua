/**
 * paleta-fiel.js — Paleta do simulador com miniaturas dos símbolos reais.
 */

import { desenharSimbolo, dimensoesSimbolo } from './simbolos.js';

/** Catálogo de componentes do simulador fiel. */
export const CATALOGO_FIEL = [
  {
    categoria: 'Entradas e Saídas',
    itens: [
      { tipo: 'SWITCH', rotulo: 'Switch', numEntradas: 0, numSaidas: 1 },
      { tipo: 'LED', rotulo: 'LED', numEntradas: 1, numSaidas: 0 },
      { tipo: 'CLOCK', rotulo: 'Clock', numEntradas: 0, numSaidas: 1 },
      { tipo: 'DISPLAY_7SEG', rotulo: 'Display 7seg', numEntradas: 4, numSaidas: 7 },
    ],
  },
  {
    categoria: 'Portas Lógicas',
    itens: [
      { tipo: 'AND', rotulo: 'AND', numEntradas: 2, numSaidas: 1 },
      { tipo: 'OR', rotulo: 'OR', numEntradas: 2, numSaidas: 1 },
      { tipo: 'NOT', rotulo: 'NOT', numEntradas: 1, numSaidas: 1 },
      { tipo: 'NAND', rotulo: 'NAND', numEntradas: 2, numSaidas: 1 },
      { tipo: 'NOR', rotulo: 'NOR', numEntradas: 2, numSaidas: 1 },
      { tipo: 'XOR', rotulo: 'XOR', numEntradas: 2, numSaidas: 1 },
      { tipo: 'XNOR', rotulo: 'XNOR', numEntradas: 2, numSaidas: 1 },
    ],
  },
  {
    categoria: 'Sequenciais',
    itens: [
      { tipo: 'DFF', rotulo: 'FF-D', numEntradas: 1, numSaidas: 2 },
      { tipo: 'JKFF', rotulo: 'FF-JK', numEntradas: 2, numSaidas: 2 },
      { tipo: 'TFF', rotulo: 'FF-T', numEntradas: 1, numSaidas: 2 },
      { tipo: 'SRFF', rotulo: 'FF-SR', numEntradas: 2, numSaidas: 2 },
      { tipo: 'COUNTER', rotulo: 'Contador', numEntradas: 0, numSaidas: 4 },
      { tipo: 'REGISTER', rotulo: 'Registrador', numEntradas: 4, numSaidas: 4 },
    ],
  },
  {
    categoria: 'Aritmética',
    itens: [
      { tipo: 'MEIO_SOMADOR', rotulo: 'Meio-somador', numEntradas: 2, numSaidas: 2 },
      { tipo: 'SOMADOR_COMPLETO', rotulo: 'Somador completo', numEntradas: 3, numSaidas: 2 },
      { tipo: 'SOMADOR_4BITS', rotulo: 'Somador 4 bits', numEntradas: 9, numSaidas: 5 },
      { tipo: 'SUBTRATOR_4BITS', rotulo: 'Subtrator 4 bits', numEntradas: 9, numSaidas: 5 },
      { tipo: 'COMPARADOR_4BITS', rotulo: 'Comparador 4 bits', numEntradas: 8, numSaidas: 3 },
    ],
  },
  {
    categoria: 'Seleção e Codificação',
    itens: [
      { tipo: 'MUX_2_1', rotulo: 'MUX 2:1', numEntradas: 3, numSaidas: 1 },
      { tipo: 'MUX_4_1', rotulo: 'MUX 4:1', numEntradas: 6, numSaidas: 1 },
      { tipo: 'DEMUX_1_2', rotulo: 'DEMUX 1:2', numEntradas: 2, numSaidas: 2 },
      { tipo: 'DECODIFICADOR_2_4', rotulo: 'Decodificador 2:4', numEntradas: 2, numSaidas: 4 },
      { tipo: 'CODIFICADOR_4_2', rotulo: 'Codificador 4:2', numEntradas: 4, numSaidas: 2 },
    ],
  },
];

/**
 * Desenha uma miniatura do símbolo em um canvas pequeno.
 */
function desenharMiniatura(canvas, tipo) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const largura = 72;
  const altura = 56;
  canvas.width = largura * dpr;
  canvas.height = altura * dpr;
  canvas.style.width = `${largura}px`;
  canvas.style.height = `${altura}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largura, altura);

  const dim = dimensoesSimbolo(tipo);
  const escala = Math.min((largura - 24) / dim.w, (altura - 16) / dim.h);
  const w = dim.w * escala;
  const h = dim.h * escala;
  const x = (largura - w) / 2;
  const y = (altura - h) / 2;

  // Componente fake para desenhar
  const compFake = {
    tipo,
    rotulo: tipo,
    entradas: [],
    saidas: [],
    estado: { ativo: 0, aceso: false, valor: 0 },
  };

  // Ajusta pinos para o desenho
  const item = CATALOGO_FIEL.flatMap((c) => c.itens).find((i) => i.tipo === tipo);
  if (item) {
    for (let i = 0; i < item.numEntradas; i++) {
      compFake.entradas.push({ id: `in${i}`, valor: null, nome: '' });
    }
    for (let i = 0; i < item.numSaidas; i++) {
      compFake.saidas.push({ id: `out${i}`, valor: null, nome: '' });
    }
  }

  ctx.save();
  ctx.scale(1, 1);
  desenharSimbolo(ctx, compFake, x, y, w, h);
  ctx.restore();
}

/**
 * Cria a paleta com miniaturas.
 */
export function criarPaletaFiel(container, aoClicar) {
  container.innerHTML = '';

  for (const grupo of CATALOGO_FIEL) {
    const secao = document.createElement('section');
    secao.className = 'paleta-fiel-grupo';

    const titulo = document.createElement('h3');
    titulo.className = 'paleta-fiel-titulo';
    titulo.textContent = grupo.categoria;
    secao.appendChild(titulo);

    const grade = document.createElement('div');
    grade.className = 'paleta-fiel-grade';

    for (const item of grupo.itens) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'paleta-fiel-item';
      botao.dataset.tipo = item.tipo;
      botao.title = item.rotulo;
      botao.draggable = true;

      const canvasMini = document.createElement('canvas');
      canvasMini.className = 'paleta-fiel-miniatura';
      botao.appendChild(canvasMini);

      const label = document.createElement('span');
      label.className = 'paleta-fiel-label';
      label.textContent = item.rotulo;
      botao.appendChild(label);

      // Desenha a miniatura após inserir no DOM
      requestAnimationFrame(() => desenharMiniatura(canvasMini, item.tipo));

      botao.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-arandua-componente', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
      });

      botao.addEventListener('click', () => aoClicar(item));

      grade.appendChild(botao);
    }

    secao.appendChild(grade);
    container.appendChild(secao);
  }
}