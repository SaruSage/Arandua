/**
 * fios-fiel.js — Interação de conexão de fios no simulador fiel.
 * Usa posicaoPinoTela do canvas fiel para localizar pinos de
 * componentes com tamanhos variados.
 */

import { dimensoesSimbolo } from './simbolos.js';

/** Raio de tolerância para detectar um pino sob o cursor (em pixels de tela). */
const RAIO_TOLERANCIA = 12;

/**
 * Encontra o pino mais próximo do ponto (coordenadas de tela).
 * @returns {{ componente, pino, direcao, posicao } | null}
 */
export function pinoSobCursor(canvas, circuito, telaX, telaY) {
  let melhor = null;
  let menorDist = RAIO_TOLERANCIA;

  for (const comp of circuito.componentes) {
    const dim = dimensoesSimbolo(comp.tipo);

    // Entradas
    for (const pino of comp.entradas) {
      const pos = canvas.posicaoPinoTela(comp, pino.id, 'entrada');
      if (!pos) continue;
      const d = Math.hypot(pos.x - telaX, pos.y - telaY);
      if (d < menorDist) {
        menorDist = d;
        melhor = { componente: comp, pino, direcao: 'entrada', posicao: pos };
      }
    }

    // Saídas
    for (const pino of comp.saidas) {
      const pos = canvas.posicaoPinoTela(comp, pino.id, 'saida');
      if (!pos) continue;
      const d = Math.hypot(pos.x - telaX, pos.y - telaY);
      if (d < menorDist) {
        menorDist = d;
        melhor = { componente: comp, pino, direcao: 'saida', posicao: pos };
      }
    }
  }

  return melhor;
}

/**
 * Configura a interação de fios no canvas do simulador fiel.
 * @param {object} canvas - renderizador de canvas-fiel.js
 * @param {object} editor - API do simulador
 * @param {object} estado - estado compartilhado do simulador
 */
export function configurarFiosFiel(canvas, editor, estado) {
  const el = canvas.elemento;

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.shiftKey) return;

    const rect = el.getBoundingClientRect();
    const telaX = e.clientX - rect.left;
    const telaY = e.clientY - rect.top;

    const pino = pinoSobCursor(canvas, editor.circuito, telaX, telaY);
    if (!pino) return;

    // Só inicia fio a partir de uma SAÍDA
    if (pino.direcao !== 'saida') return;

    e.stopPropagation();
    e.preventDefault();

    estado.fioEmConstrucao = {
      origem: {
        componente: pino.componente.id,
        pino: pino.pino.id,
      },
      posicaoOrigem: pino.posicao,
    };

    el.style.cursor = 'crosshair';
  }, true); // captura antes do handler de arrasto

  el.addEventListener('mousemove', (e) => {
    if (!estado.fioEmConstrucao) return;

    const rect = el.getBoundingClientRect();
    const telaX = e.clientX - rect.left;
    const telaY = e.clientY - rect.top;

    estado.fioFantasma = {
      origem: estado.fioEmConstrucao.posicaoOrigem,
      cursor: { x: telaX, y: telaY },
    };

    editor.renderizar();
  });

  el.addEventListener('mouseup', (e) => {
    if (!estado.fioEmConstrucao) return;

    const rect = el.getBoundingClientRect();
    const telaX = e.clientX - rect.left;
    const telaY = e.clientY - rect.top;

    const pino = pinoSobCursor(canvas, editor.circuito, telaX, telaY);

    if (pino && pino.direcao === 'entrada') {
      editor.conectar(
        estado.fioEmConstrucao.origem,
        { componente: pino.componente.id, pino: pino.pino.id }
      );
    }

    estado.fioEmConstrucao = null;
    estado.fioFantasma = null;
    el.style.cursor = 'default';
    editor.renderizar();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && estado.fioEmConstrucao) {
      estado.fioEmConstrucao = null;
      estado.fioFantasma = null;
      el.style.cursor = 'default';
      editor.renderizar();
    }
  });
}