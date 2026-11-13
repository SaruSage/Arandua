import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATALOGO,
  obterAreaSelecaoPersonalizada,
  obterDimensoesComponente,
  obterPinosComponente,
} from '../assets/js/catalogo.js';
import { componenteEm, criarCircuito } from '../assets/js/circuito.js';
import {
  criarDesignInicial,
  copiarDesignsLocais,
  definirDesignsPublicados,
  obterHistoricoDesignPersonalizado,
  obterDesignPersonalizado,
  recarregarDesignsPersonalizados,
  salvarDesignPersonalizado,
  usarDesignsLocais,
  validarDesignPersonalizado,
} from '../assets/js/designs-componentes.js';
import { ARTES_REALISTAS } from '../assets/js/visual.js';

test('o design inicial conserva a arte realista e os pinos existentes para edição', () => {
  const design = criarDesignInicial(
    'RESISTOR',
    CATALOGO.RESISTOR,
    CATALOGO.RESISTOR.pinos
  );
  assert.equal(design.formas[0].tipo, 'imagem');
  assert.equal(design.formas[0].origem, 'arte-original');
  assert.equal(design.formas[0].largura, ARTES_REALISTAS.RESISTOR.largura);
  assert.deepEqual(design.pinos.map((pino) => pino.id), ['p1', 'p2']);
  assert.deepEqual(design.areaSelecao, {
    x: 0,
    y: 0,
    largura: design.largura,
    altura: design.altura,
  });
});

test('salvar um design persiste tamanho, posições de pinos e área de seleção', () => {
  const anterior = globalThis.localStorage;
  const itens = new Map();
  globalThis.localStorage = {
    getItem: (chave) => itens.get(chave) ?? null,
    setItem: (chave, valor) => itens.set(chave, valor),
    removeItem: (chave) => itens.delete(chave),
  };
  recarregarDesignsPersonalizados();
  try {
    const design = {
      largura: 80,
      altura: 42,
      formas: [{
        id: 'forma-1',
        tipo: 'retangulo',
        x: 10,
        y: 5,
        largura: 60,
        altura: 32,
        cor: '#118844',
        contorno: '#123456',
        grossura: 2,
        opacidade: 0.8,
      }],
      pinos: [
        { id: 'p1', nome: 'A', x: -40, y: 0 },
        { id: 'p2', nome: 'B', x: 40, y: 0 },
      ],
      areaSelecao: { x: 8, y: 4, largura: 64, altura: 34 },
    };
    assert.deepEqual(validarDesignPersonalizado(design), { valido: true, erro: null });
    salvarDesignPersonalizado('RESISTOR', design);
    recarregarDesignsPersonalizados();
    assert.deepEqual(obterDimensoesComponente('RESISTOR'), { w: 80, h: 42 });
    assert.deepEqual(
      obterPinosComponente('RESISTOR').map(({ id, x, y }) => ({ id, x, y })),
      [{ id: 'p1', x: -40, y: 0 }, { id: 'p2', x: 40, y: 0 }]
    );
    assert.deepEqual(obterAreaSelecaoPersonalizada('RESISTOR'), design.areaSelecao);
    assert.ok(itens.has('eletronica:designs-componentes'));
  } finally {
    globalThis.localStorage.removeItem('eletronica:designs-componentes');
    recarregarDesignsPersonalizados();
    if (anterior === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = anterior;
  }
});

test('versões anteriores permanecem disponíveis após recarregar os designs', () => {
  const anterior = globalThis.localStorage;
  const itens = new Map();
  globalThis.localStorage = {
    getItem: (chave) => itens.get(chave) ?? null,
    setItem: (chave, valor) => itens.set(chave, valor),
    removeItem: (chave) => itens.delete(chave),
  };
  recarregarDesignsPersonalizados();
  try {
    const versaoAntiga = {
      largura: 80,
      altura: 42,
      formas: [],
      pinos: [{ id: 'p1', nome: 'A', x: -40, y: 0 }],
      areaSelecao: { x: 0, y: 0, largura: 80, altura: 42 },
    };
    const versaoNova = {
      ...versaoAntiga,
      areaSelecao: { x: 4, y: 3, largura: 72, altura: 36 },
    };
    salvarDesignPersonalizado('RESISTOR', versaoAntiga);
    salvarDesignPersonalizado('RESISTOR', versaoNova, [versaoAntiga]);
    recarregarDesignsPersonalizados();
    assert.deepEqual(obterHistoricoDesignPersonalizado('RESISTOR'), [versaoAntiga]);
  } finally {
    globalThis.localStorage.removeItem('eletronica:designs-componentes');
    recarregarDesignsPersonalizados();
    if (anterior === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = anterior;
  }
});

test('designs publicados prevalecem sobre os locais, que permanecem disponíveis para importação', () => {
  const anterior = globalThis.localStorage;
  const itens = new Map();
  globalThis.localStorage = {
    getItem: (chave) => itens.get(chave) ?? null,
    setItem: (chave, valor) => itens.set(chave, valor),
    removeItem: (chave) => itens.delete(chave),
  };
  recarregarDesignsPersonalizados();
  const local = {
    largura: 80, altura: 42, formas: [], pinos: [],
    areaSelecao: { x: 0, y: 0, largura: 80, altura: 42 },
  };
  const publicado = { ...local, largura: 60 };
  try {
    salvarDesignPersonalizado('RESISTOR', local);
    definirDesignsPublicados({});
    assert.equal(obterDesignPersonalizado('RESISTOR'), null);
    assert.deepEqual(copiarDesignsLocais().RESISTOR, local);
    definirDesignsPublicados({ RESISTOR: publicado });
    assert.deepEqual(obterDesignPersonalizado('RESISTOR'), publicado);
    assert.throws(() => definirDesignsPublicados({ RESISTOR: { ...local, largura: 0 } }));
    assert.deepEqual(obterDesignPersonalizado('RESISTOR'), publicado);
  } finally {
    usarDesignsLocais();
    globalThis.localStorage.removeItem('eletronica:designs-componentes');
    recarregarDesignsPersonalizados();
    if (anterior === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = anterior;
  }
});

test('a área de seleção personalizada restringe o corpo sem bloquear a conexão pelos pinos', () => {
  const anterior = globalThis.localStorage;
  const itens = new Map();
  globalThis.localStorage = {
    getItem: (chave) => itens.get(chave) ?? null,
    setItem: (chave, valor) => itens.set(chave, valor),
    removeItem: (chave) => itens.delete(chave),
  };
  recarregarDesignsPersonalizados();
  try {
    salvarDesignPersonalizado('RESISTOR', {
      largura: 80,
      altura: 42,
      formas: [],
      pinos: [
        { id: 'p1', nome: 'A', x: -40, y: 0 },
        { id: 'p2', nome: 'B', x: 40, y: 0 },
      ],
      areaSelecao: { x: 25, y: 12, largura: 30, altura: 18 },
    });
    const circuito = criarCircuito();
    const componente = {
      id: 'custom-resistor',
      tipo: 'RESISTOR',
      x: 0,
      y: 0,
      rotacao: 0,
      propriedades: {},
      pinos: obterPinosComponente('RESISTOR'),
      dimensoes: obterDimensoesComponente('RESISTOR'),
    };
    circuito.componentes.push(componente);
    assert.equal(componenteEm(circuito, 40, 20), componente);
    assert.equal(componenteEm(circuito, 10, 5), null);
    assert.equal(componenteEm(circuito, 0, 21), componente);
  } finally {
    globalThis.localStorage.removeItem('eletronica:designs-componentes');
    recarregarDesignsPersonalizados();
    if (anterior === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = anterior;
  }
});

test('designs rejeitam formas com opacidade fora do intervalo permitido', () => {
  const design = {
    largura: 32,
    altura: 32,
    formas: [{
      id: 'inválida',
      tipo: 'circulo',
      x: 0,
      y: 0,
      largura: 10,
      altura: 10,
      opacidade: 1.2,
    }],
    pinos: [],
    areaSelecao: { x: 0, y: 0, largura: 32, altura: 32 },
  };
  assert.deepEqual(validarDesignPersonalizado(design), {
    valido: false,
    erro: 'Uma ou mais formas do design são inválidas.',
  });
});
