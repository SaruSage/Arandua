/**
 * catalogo.js — Definição de todos os componentes eletrônicos.
 * Cada componente declara seus pinos, propriedades editáveis e
 * como o solver deve tratá-lo.
 */

/**
 * Tipos de modelo de simulação:
 * - 'linear'      → resolve com lei de Ohm
 * - 'nao-linear'  → usa modelo exponencial (diodo, transistor)
 * - 'fonte'       → impõe tensão ou corrente
 * - 'chave'       → abre ou fecha o circuito
 * - 'logica'      → porta lógica (simulada em tensão)
 * - 'composto'    → sub-circuito interno (amp-op, display, CI)
 */
export const CATALOGO = {
  /* ===== PASSIVOS LINEARES ===== */

  RESISTOR: {
    rotulo: 'Resistor',
    categoria: 'Passivos',
    modelo: 'linear',
    pinos: [
      { id: 'p1', x: -22, y: 0, nome: 'A' },
      { id: 'p2', x: 22, y: 0, nome: 'B' },
    ],
    propriedades: {
      resistencia: { tipo: 'numero', valor: 1000, min: 1, max: 1e7, unidade: 'Ω', rotulo: 'Resistência' },
    },
    dimensoes: { w: 44, h: 20 },
  },

  POTENCIOMETRO: {
    rotulo: 'Potenciômetro',
    categoria: 'Passivos',
    modelo: 'linear',
    pinos: [
      { id: 'p1', x: -22, y: 0, nome: 'A' },
      { id: 'p2', x: 22, y: 0, nome: 'B' },
      { id: 'p3', x: 0, y: -22, nome: 'W' },
    ],
    propriedades: {
      resistencia: { tipo: 'numero', valor: 10000, min: 1, max: 1e6, unidade: 'Ω', rotulo: 'Resistência total' },
      posicao: { tipo: 'numero', valor: 0.5, min: 0, max: 1, step: 0.01, rotulo: 'Posição do cursor' },
    },
    dimensoes: { w: 44, h: 44 },
  },

  CAPACITOR: {
    rotulo: 'Capacitor',
    categoria: 'Passivos',
    modelo: 'linear',
    pinos: [
      { id: 'p1', x: -18, y: 0, nome: '+' },
      { id: 'p2', x: 18, y: 0, nome: '−' },
    ],
    propriedades: {
      capacitancia: { tipo: 'numero', valor: 1e-6, min: 1e-12, max: 1, unidade: 'F', rotulo: 'Capacitância' },
      tensaoInicial: { tipo: 'numero', valor: 0, min: -100, max: 100, unidade: 'V', rotulo: 'Tensão inicial' },
    },
    dimensoes: { w: 36, h: 30 },
  },

  INDUTOR: {
    rotulo: 'Indutor',
    categoria: 'Passivos',
    modelo: 'linear',
    pinos: [
      { id: 'p1', x: -22, y: 0, nome: 'A' },
      { id: 'p2', x: 22, y: 0, nome: 'B' },
    ],
    propriedades: {
      indutancia: { tipo: 'numero', valor: 1e-3, min: 1e-9, max: 10, unidade: 'H', rotulo: 'Indutância' },
    },
    dimensoes: { w: 44, h: 20 },
  },

  TRANSFORMADOR: {
    rotulo: 'Transformador',
    categoria: 'Passivos',
    modelo: 'linear',
    pinos: [
      { id: 'p1', x: -26, y: -10, nome: 'P1' },
      { id: 'p2', x: -26, y: 10, nome: 'P2' },
      { id: 's1', x: 26, y: -10, nome: 'S1' },
      { id: 's2', x: 26, y: 10, nome: 'S2' },
    ],
    propriedades: {
      espirasPrimario: { tipo: 'numero', valor: 100, min: 1, max: 10000, rotulo: 'Espiras primário' },
      espirasSecundario: { tipo: 'numero', valor: 100, min: 1, max: 10000, rotulo: 'Espiras secundário' },
    },
    dimensoes: { w: 52, h: 40 },
  },

  /* ===== PASSIVOS SENSÍVEIS ===== */

  LDR: {
    rotulo: 'LDR',
    categoria: 'Sensores',
    modelo: 'linear',
    pinos: [
      { id: 'p1', x: -22, y: 0, nome: 'A' },
      { id: 'p2', x: 22, y: 0, nome: 'B' },
    ],
    propriedades: {
      resistenciaClaro: { tipo: 'numero', valor: 1000, min: 1, max: 1e6, unidade: 'Ω', rotulo: 'R com luz' },
      resistenciaEscuro: { tipo: 'numero', valor: 1000000, min: 1, max: 1e8, unidade: 'Ω', rotulo: 'R no escuro' },
    },
    dimensoes: { w: 44, h: 30 },
  },

  TERMISTOR: {
    rotulo: 'Termistor NTC',
    categoria: 'Sensores',
    modelo: 'linear',
    pinos: [
      { id: 'p1', x: -22, y: 0, nome: 'A' },
      { id: 'p2', x: 22, y: 0, nome: 'B' },
    ],
    propriedades: {
      resistenciaNominal: { tipo: 'numero', valor: 10000, min: 1, max: 1e6, unidade: 'Ω', rotulo: 'R a 25°C' },
      coeficiente: { tipo: 'numero', valor: 3950, min: 100, max: 10000, rotulo: 'Coeficiente B' },
    },
    dimensoes: { w: 44, h: 30 },
  },

  FOTODIODO: {
    rotulo: 'Fotodiodo',
    categoria: 'Sensores',
    modelo: 'nao-linear',
    pinos: [
      { id: 'p1', x: -20, y: 0, nome: 'A' },
      { id: 'p2', x: 20, y: 0, nome: 'K' },
    ],
    propriedades: {
      sensibilidade: { tipo: 'numero', valor: 0.5, min: 0.01, max: 1, step: 0.01, rotulo: 'Sensibilidade' },
    },
    dimensoes: { w: 40, h: 26 },
  },

  /* ===== SEMICONDUTORES ===== */

  DIODO: {
    rotulo: 'Diodo',
    categoria: 'Semicondutores',
    modelo: 'nao-linear',
    pinos: [
      { id: 'p1', x: -20, y: 0, nome: 'A' },
      { id: 'p2', x: 20, y: 0, nome: 'K' },
    ],
    propriedades: {
      tensaoDireta: { tipo: 'numero', valor: 0.7, min: 0.1, max: 2, step: 0.01, unidade: 'V', rotulo: 'Vf' },
      correnteSaturacao: { tipo: 'numero', valor: 1e-12, min: 1e-15, max: 1e-6, unidade: 'A', rotulo: 'Is' },
    },
    dimensoes: { w: 40, h: 26 },
  },

  LED: {
    rotulo: 'LED',
    categoria: 'Semicondutores',
    modelo: 'nao-linear',
    pinos: [
      { id: 'p1', x: -20, y: 0, nome: 'A' },
      { id: 'p2', x: 20, y: 0, nome: 'K' },
    ],
    propriedades: {
      cor: { tipo: 'cor', valor: '#ff3b30', rotulo: 'Cor' },
      tensaoDireta: { tipo: 'numero', valor: 2.0, min: 1.2, max: 3.6, step: 0.1, unidade: 'V', rotulo: 'Vf' },
      correnteNominal: { tipo: 'numero', valor: 0.02, min: 0.001, max: 0.1, step: 0.001, unidade: 'A', rotulo: 'Corrente nominal' },
    },
    dimensoes: { w: 40, h: 26 },
  },

  TRANSISTOR_NPN: {
    rotulo: 'Transistor NPN',
    categoria: 'Semicondutores',
    modelo: 'nao-linear',
    pinos: [
      { id: 'b', x: -22, y: 0, nome: 'B' },
      { id: 'c', x: 14, y: -18, nome: 'C' },
      { id: 'e', x: 14, y: 18, nome: 'E' },
    ],
    propriedades: {
      ganho: { tipo: 'numero', valor: 100, min: 10, max: 1000, rotulo: 'β (hFE)' },
      tensaoBaseEmissor: { tipo: 'numero', valor: 0.7, min: 0.5, max: 0.9, step: 0.01, unidade: 'V', rotulo: 'Vbe' },
    },
    dimensoes: { w: 48, h: 48 },
  },

  TRANSISTOR_PNP: {
    rotulo: 'Transistor PNP',
    categoria: 'Semicondutores',
    modelo: 'nao-linear',
    pinos: [
      { id: 'b', x: -22, y: 0, nome: 'B' },
      { id: 'c', x: 14, y: 18, nome: 'C' },
      { id: 'e', x: 14, y: -18, nome: 'E' },
    ],
    propriedades: {
      ganho: { tipo: 'numero', valor: 100, min: 10, max: 1000, rotulo: 'β (hFE)' },
      tensaoBaseEmissor: { tipo: 'numero', valor: -0.7, min: -0.9, max: -0.5, step: 0.01, unidade: 'V', rotulo: 'Vbe' },
    },
    dimensoes: { w: 48, h: 48 },
  },

  /* ===== FONTES E CHAVES ===== */

  BATERIA: {
    rotulo: 'Bateria',
    categoria: 'Fontes',
    modelo: 'fonte',
    pinos: [
      { id: 'p1', x: -20, y: 0, nome: '+' },
      { id: 'p2', x: 20, y: 0, nome: '−' },
    ],
    propriedades: {
      tensao: { tipo: 'numero', valor: 9, min: 0.1, max: 100, step: 0.1, unidade: 'V', rotulo: 'Tensão' },
    },
    dimensoes: { w: 40, h: 30 },
  },

  FONTE_AC: {
    rotulo: 'Fonte AC',
    categoria: 'Fontes',
    modelo: 'fonte',
    pinos: [
      { id: 'p1', x: -20, y: 0, nome: 'A' },
      { id: 'p2', x: 20, y: 0, nome: 'B' },
    ],
    propriedades: {
      amplitude: { tipo: 'numero', valor: 12, min: 0.1, max: 220, step: 0.1, unidade: 'V', rotulo: 'Amplitude' },
      frequencia: { tipo: 'numero', valor: 60, min: 0.1, max: 10000, unidade: 'Hz', rotulo: 'Frequência' },
    },
    dimensoes: { w: 40, h: 30 },
  },

  CHAVE: {
    rotulo: 'Chave',
    categoria: 'Fontes',
    modelo: 'chave',
    pinos: [
      { id: 'p1', x: -20, y: 0, nome: 'A' },
      { id: 'p2', x: 20, y: 0, nome: 'B' },
    ],
    propriedades: {
      fechada: { tipo: 'booleano', valor: false, rotulo: 'Fechada' },
    },
    dimensoes: { w: 40, h: 26 },
  },

  BOTAO: {
    rotulo: 'Botão',
    categoria: 'Fontes',
    modelo: 'chave',
    pinos: [
      { id: 'p1', x: -20, y: 0, nome: 'A' },
      { id: 'p2', x: 20, y: 0, nome: 'B' },
    ],
    propriedades: {
      pressionado: { tipo: 'booleano', valor: false, rotulo: 'Pressionado' },
    },
    dimensoes: { w: 40, h: 26 },
  },

  /* ===== LÓGICA ===== */

  AND: {
    rotulo: 'AND',
    categoria: 'Lógica',
    modelo: 'logica',
    pinos: [
      { id: 'a', x: -24, y: -8, nome: 'A' },
      { id: 'b', x: -24, y: 8, nome: 'B' },
      { id: 'y', x: 24, y: 0, nome: 'Y' },
    ],
    propriedades: {
      familia: { tipo: 'select', valor: 'CMOS', opcoes: ['CMOS', 'TTL'], rotulo: 'Família' },
    },
    dimensoes: { w: 48, h: 36 },
    montagem: 'AND',
  },

  OR: {
    rotulo: 'OR',
    categoria: 'Lógica',
    modelo: 'logica',
    pinos: [
      { id: 'a', x: -24, y: -8, nome: 'A' },
      { id: 'b', x: -24, y: 8, nome: 'B' },
      { id: 'y', x: 24, y: 0, nome: 'Y' },
    ],
    propriedades: {
      familia: { tipo: 'select', valor: 'CMOS', opcoes: ['CMOS', 'TTL'], rotulo: 'Família' },
    },
    dimensoes: { w: 48, h: 36 },
    montagem: 'OR',
  },

  NOT: {
    rotulo: 'NOT',
    categoria: 'Lógica',
    modelo: 'logica',
    pinos: [
      { id: 'a', x: -24, y: 0, nome: 'A' },
      { id: 'y', x: 24, y: 0, nome: 'Y' },
    ],
    propriedades: {
      familia: { tipo: 'select', valor: 'CMOS', opcoes: ['CMOS', 'TTL'], rotulo: 'Família' },
    },
    dimensoes: { w: 48, h: 32 },
    montagem: 'NOT',
  },

  NAND: {
    rotulo: 'NAND',
    categoria: 'Lógica',
    modelo: 'logica',
    pinos: [
      { id: 'a', x: -24, y: -8, nome: 'A' },
      { id: 'b', x: -24, y: 8, nome: 'B' },
      { id: 'y', x: 24, y: 0, nome: 'Y' },
    ],
    propriedades: {
      familia: { tipo: 'select', valor: 'CMOS', opcoes: ['CMOS', 'TTL'], rotulo: 'Família' },
    },
    dimensoes: { w: 48, h: 36 },
    montagem: 'NAND',
  },

  NOR: {
    rotulo: 'NOR',
    categoria: 'Lógica',
    modelo: 'logica',
    pinos: [
      { id: 'a', x: -24, y: -8, nome: 'A' },
      { id: 'b', x: -24, y: 8, nome: 'B' },
      { id: 'y', x: 24, y: 0, nome: 'Y' },
    ],
    propriedades: {
      familia: { tipo: 'select', valor: 'CMOS', opcoes: ['CMOS', 'TTL'], rotulo: 'Família' },
    },
    dimensoes: { w: 48, h: 36 },
    montagem: 'NOR',
  },

  XOR: {
    rotulo: 'XOR',
    categoria: 'Lógica',
    modelo: 'logica',
    pinos: [
      { id: 'a', x: -24, y: -8, nome: 'A' },
      { id: 'b', x: -24, y: 8, nome: 'B' },
      { id: 'y', x: 24, y: 0, nome: 'Y' },
    ],
    propriedades: {
      familia: { tipo: 'select', valor: 'CMOS', opcoes: ['CMOS', 'TTL'], rotulo: 'Família' },
    },
    dimensoes: { w: 48, h: 36 },
    montagem: 'XOR',
  },

  XNOR: {
    rotulo: 'XNOR',
    categoria: 'Lógica',
    modelo: 'logica',
    pinos: [
      { id: 'a', x: -24, y: -8, nome: 'A' },
      { id: 'b', x: -24, y: 8, nome: 'B' },
      { id: 'y', x: 24, y: 0, nome: 'Y' },
    ],
    propriedades: {
      familia: { tipo: 'select', valor: 'CMOS', opcoes: ['CMOS', 'TTL'], rotulo: 'Família' },
    },
    dimensoes: { w: 48, h: 36 },
    montagem: 'XNOR',
  },

  BUFFER: {
    rotulo: 'Buffer',
    categoria: 'Lógica',
    modelo: 'logica',
    pinos: [
      { id: 'a', x: -24, y: 0, nome: 'A' },
      { id: 'y', x: 24, y: 0, nome: 'Y' },
    ],
    propriedades: {
      familia: { tipo: 'select', valor: 'CMOS', opcoes: ['CMOS', 'TTL'], rotulo: 'Família' },
    },
    dimensoes: { w: 48, h: 32 },
    montagem: 'BUFFER',
  },

  /* ===== COMPOSTOS ===== */

  DISPLAY_7SEG: {
    rotulo: 'Display 7 seg',
    categoria: 'Compostos',
    modelo: 'composto',
    pinos: [
      { id: 'a', x: -28, y: -30, nome: 'a' },
      { id: 'b', x: -28, y: -18, nome: 'b' },
      { id: 'c', x: -28, y: -6, nome: 'c' },
      { id: 'd', x: -28, y: 6, nome: 'd' },
      { id: 'e', x: -28, y: 18, nome: 'e' },
      { id: 'f', x: -28, y: 30, nome: 'f' },
      { id: 'g', x: 28, y: 0, nome: 'g' },
      { id: 'com', x: 28, y: 18, nome: 'COM' },
    ],
    propriedades: {
      cor: { tipo: 'cor', valor: '#ff3b30', rotulo: 'Cor' },
      tipo: { tipo: 'select', valor: 'cátodo comum', opcoes: ['cátodo comum', 'ânodo comum'], rotulo: 'Tipo' },
    },
    dimensoes: { w: 56, h: 76 },
    montagem: 'DISPLAY_7SEG',
  },

  AMP_OP: {
    rotulo: 'Amp. Operacional',
    categoria: 'Compostos',
    modelo: 'composto',
    pinos: [
      { id: 'inm', x: -30, y: -10, nome: '−' },
      { id: 'inp', x: -30, y: 10, nome: '+' },
      { id: 'out', x: 30, y: 0, nome: 'OUT' },
      { id: 'vmais', x: 0, y: -26, nome: 'V+' },
      { id: 'vmenos', x: 0, y: 26, nome: 'V−' },
    ],
    propriedades: {
      ganho: { tipo: 'numero', valor: 100000, min: 1000, max: 1e7, rotulo: 'Ganho A' },
      tensaoTrilhoPositivo: { tipo: 'numero', valor: 12, min: 0, max: 100, unidade: 'V', rotulo: 'V+ trilho' },
      tensaoTrilhoNegativo: { tipo: 'numero', valor: -12, min: -100, max: 0, unidade: 'V', rotulo: 'V− trilho' },
    },
    dimensoes: { w: 60, h: 52 },
    montagem: 'AMP_OP',
  },

  CI_GENERICO: {
    rotulo: 'CI',
    categoria: 'Compostos',
    modelo: 'composto',
    pinos: [
      { id: 'p1', x: -30, y: -20, nome: '1' },
      { id: 'p2', x: -30, y: -8, nome: '2' },
      { id: 'p3', x: -30, y: 4, nome: '3' },
      { id: 'p4', x: -30, y: 16, nome: '4' },
      { id: 'p5', x: 30, y: -20, nome: '5' },
      { id: 'p6', x: 30, y: -8, nome: '6' },
      { id: 'p7', x: 30, y: 4, nome: '7' },
      { id: 'p8', x: 30, y: 16, nome: '8' },
    ],
    propriedades: {
      funcao: {
        tipo: 'select',
        valor: 'buffer',
        opcoes: ['buffer', 'inversor', 'AND', 'OR', 'NAND', 'NOR'],
        rotulo: 'Função interna',
      },
    },
    dimensoes: { w: 60, h: 56 },
    montagem: 'CI_GENERICO',
  },
};

/** Lista de categorias na ordem de exibição. */
export const CATEGORIAS = [
  'Fontes',
  'Passivos',
  'Sensores',
  'Semicondutores',
  'Lógica',
  'Compostos',
];

/** Retorna os itens de uma categoria. */
export function itensDaCategoria(categoria) {
  return Object.entries(CATALOGO)
    .filter(([, def]) => def.categoria === categoria)
    .map(([tipo, def]) => ({ tipo, ...def }));
}

/** Cria uma instância de componente a partir do tipo. */
export function criarInstancia(tipo, x = 0, y = 0) {
  const def = CATALOGO[tipo];
  if (!def) throw new Error(`Componente desconhecido: ${tipo}`);

  const propriedades = {};
  for (const [chave, spec] of Object.entries(def.propriedades || {})) {
    propriedades[chave] = spec.valor;
  }

  return {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    x,
    y,
    rotacao: 0,
    propriedades,
    pinos: def.pinos.map((p) => ({ ...p })),
  };
}