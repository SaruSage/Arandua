import test from 'node:test';
import assert from 'node:assert/strict';

import { CATALOGO } from '../assets/js/catalogo.js';
import { adicionarComponente, criarCircuito } from '../assets/js/circuito.js';
import { configurarFios, desenharFios } from '../assets/js/fios.js';
import { boundsDosFilhos, caixaNomeGrupo, configurarGrupos, noNome } from '../assets/js/grupos.js';
import { desfazer, inicializar, refazer } from '../assets/js/historico.js';
import { reconstruir, serializar } from '../assets/js/persistencia.js';
import { configurarInteracao } from '../assets/js/selecao.js';
import { posicaoPino } from '../assets/js/simbolos.js';

function alvo() {
  const listeners = new Map();
  return {
    style: {},
    addEventListener(tipo, fn, captura) {
      const lista = listeners.get(tipo) || [];
      lista.push({ fn, captura: captura === true });
      listeners.set(tipo, lista);
    },
    removeEventListener(tipo, fn) {
      listeners.set(tipo, (listeners.get(tipo) || []).filter((item) => item.fn !== fn));
    },
    emitir(tipo, dados = {}) {
      const e = {
        target: this, button: 0, clientX: 0, clientY: 0,
        preventDefault() {}, stopPropagation() { this.propagacaoParada = true; },
        stopImmediatePropagation() { this.parou = true; },
        ...dados,
      };
      const lista = [...(listeners.get(tipo) || [])].sort((a, b) => Number(b.captura) - Number(a.captura));
      for (const { fn, captura } of lista) {
        if (e.propagacaoParada && !captura) break;
        fn(e);
        if (e.parou) break;
      }
    },
    getBoundingClientRect() { return { left: 0, top: 0 }; },
  };
}

function editor(circuito) {
  const elemento = alvo();
  const janela = alvo();
  const canvas = {
    elemento, view: { zoom: 1, panX: 0, panY: 0 },
    telaParaMundo: (x, y) => ({ x, y }),
    mundoParaTela: (x, y) => ({ x, y }),
  };
  const estado = { circuito, selecionados: [], simulando: true, recalcular() {} };
  globalThis.window = janela;
  inicializar(circuito);
  configurarFios(canvas, estado, () => {});
  configurarGrupos(canvas, estado, () => {});
  configurarInteracao(canvas, estado, () => {});
  return { elemento, janela, estado };
}

function evento(ponto, button) {
  return { clientX: ponto.x, clientY: ponto.y, button };
}

test('a área inclui dobras de fios que conectam componentes membros', () => {
  const circuito = criarCircuito();
  const a = adicionarComponente(circuito, 'NO', 50, 50);
  const b = adicionarComponente(circuito, 'NO', 150, 50);
  circuito.fios.push({
    id: 'fio-distante',
    origem: { componente: a.id, pino: 'p' },
    destino: { componente: b.id, pino: 'p' },
    dobras: [{ x: 420, y: 380 }],
  });

  const bounds = boundsDosFilhos(circuito, [a.id, b.id]);
  assert.ok(bounds.x <= 420);
  assert.ok(bounds.x + bounds.w >= 420);
  assert.ok(bounds.y <= 380);
  assert.ok(bounds.y + bounds.h >= 380);
});

test('nó cria fios com a esquerda e move com a direita sem iniciar seleção retangular', () => {
  const anterior = globalThis.window;
  const documentoAnterior = globalThis.document;
  try {
    globalThis.document = { getElementById: () => null };
    const circuito = criarCircuito();
    const no = adicionarComponente(circuito, 'NO', 50, 50);
    const outro = adicionarComponente(circuito, 'NO', 150, 50);
    const { elemento, janela, estado } = editor(circuito);
    const inicio = posicaoPino(no, 'p');
    const destino = posicaoPino(outro, 'p');

    elemento.emitir('mousedown', evento(inicio, 0));
    elemento.emitir('mousemove', evento(destino, 0));
    elemento.emitir('mouseup', evento(destino, 0));
    assert.equal(circuito.fios.length, 1);
    assert.equal(no.x, 50);

    elemento.emitir('mousedown', evento(inicio, 2));
    elemento.emitir('mousemove', evento({ x: inicio.x + 30, y: inicio.y + 20 }, 2));
    janela.emitir('mouseup', evento({ x: inicio.x + 30, y: inicio.y + 20 }, 2));
    assert.equal(no.x, 80);
    assert.equal(no.y, 70);
    assert.equal(estado.selecaoRetangular, undefined);
    assert.equal(circuito.fios[0].origem.componente, no.id);

    elemento.emitir('mousedown', evento({ x: 300, y: 300 }, 2));
    elemento.emitir('mousemove', evento({ x: 350, y: 350 }, 2));
    assert.ok(estado.selecaoRetangular);
    elemento.emitir('mouseup', evento({ x: 350, y: 350 }, 2));
    assert.equal(estado.selecaoRetangular, null);
  } finally {
    if (anterior === undefined) delete globalThis.window;
    else globalThis.window = anterior;
    if (documentoAnterior === undefined) delete globalThis.document;
    else globalThis.document = documentoAnterior;
  }
});

test('nome da área percorre topo e base, respeita limites e é salvo no histórico e arquivo', () => {
  const anterior = globalThis.window;
  const documentoAnterior = globalThis.document;
  try {
    globalThis.document = { getElementById: () => null };
    const circuito = criarCircuito();
    const grupo = { id: 'g', nome: 'Área', cor: '#53b588', membros: [], x: 20, y: 40, w: 200, h: 100 };
    circuito.grupos.push(grupo);
    const { elemento, janela } = editor(circuito);
    elemento.emitir('mousedown', evento({ x: 30, y: 30 }, 2));
    janela.emitir('mousemove', evento({ x: 500, y: 150 }, 2));
    janela.emitir('mouseup', evento({ x: 500, y: 150 }, 2));
    const caixa = caixaNomeGrupo(grupo);
    assert.equal(caixa.lado, 'base');
    assert.equal(caixa.x + caixa.largura, 220);
    assert.equal(caixa.y, 140);
    assert.ok(noNome(grupo, caixa.x + 1, caixa.y + 1));
    assert.deepEqual(desfazer(CATALOGO).grupos[0].posicaoNome, undefined);
    assert.deepEqual(refazer(CATALOGO).grupos[0].posicaoNome, grupo.posicaoNome);
    assert.deepEqual(reconstruir(serializar({ circuito })).circuito.grupos[0].posicaoNome, grupo.posicaoNome);

    elemento.emitir('mousedown', evento({ x: caixa.x + 5, y: caixa.y + 5 }, 2));
    janela.emitir('mousemove', evento({ x: -100, y: 40 }, 2));
    janela.emitir('mouseup', evento({ x: -100, y: 40 }, 2));
    assert.equal(caixaNomeGrupo(grupo).x, 20);
    assert.equal(caixaNomeGrupo(grupo).lado, 'topo');
  } finally {
    if (anterior === undefined) delete globalThis.window;
    else globalThis.window = anterior;
    if (documentoAnterior === undefined) delete globalThis.document;
    else globalThis.document = documentoAnterior;
  }
});

test('nome permanece em contato com contorno poligonal e dentro das laterais', () => {
  const grupo = {
    nome: 'Área', x: 0, y: 0, w: 200, h: 100,
    vertices: [{ x: 0, y: 30 }, { x: 200, y: 0 }, { x: 160, y: 100 }, { x: 30, y: 100 }],
    posicaoNome: { lado: 'topo', fracao: 1 },
  };
  const caixa = caixaNomeGrupo(grupo);
  assert.equal(caixa.x + caixa.largura, 200);
  assert.equal(caixa.y + caixa.altura, caixa.contato);
  assert.equal(caixa.contato, 5.25);
  grupo.posicaoNome.lado = 'base';
  const base = caixaNomeGrupo(grupo);
  assert.equal(base.y, base.contato);
  assert.ok(base.contato < 100);
});

test('somente o fio selecionado usa traços animados', async () => {
  const circuito = criarCircuito();
  const a = adicionarComponente(circuito, 'NO', 0, 0);
  const b = adicionarComponente(circuito, 'NO', 100, 0);
  circuito.fios.push({ id: 'f', origem: { componente: a.id, pino: 'p' }, destino: { componente: b.id, pino: 'p' }, dobras: [] });
  const tracos = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    setLineDash(dash) { tracos.push(dash); },
    stroke() {},
  };
  const view = { zoom: 1, panX: 0, panY: 0 };
  desenharFios(ctx, circuito, view, null, null);
  assert.deepEqual(tracos, []);
  desenharFios(ctx, circuito, view, 'f', null);
  const primeiraFase = ctx.lineDashOffset;
  await new Promise((resolve) => setTimeout(resolve, 10));
  desenharFios(ctx, circuito, view, 'f', null);
  assert.deepEqual(tracos, [[8, 6], [8, 6]]);
  assert.notEqual(ctx.lineDashOffset, primeiraFase);
});
