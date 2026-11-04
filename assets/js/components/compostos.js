function inverter(valor) {
  if (valor === null) return null;
  return valor === 1 ? 0 : 1;
}

function conjuncao(a, b) {
  if (a === 0 || b === 0) return 0;
  if (a === 1 && b === 1) return 1;
  return null;
}

function disjuncao(a, b) {
  if (a === 1 || b === 1) return 1;
  if (a === 0 && b === 0) return 0;
  return null;
}

function exclusivo(a, b) {
  if (a === null || b === null) return null;
  return a === b ? 0 : 1;
}

function somarCompleto(a, b, cin) {
  const parcial = exclusivo(a, b);
  return [
    exclusivo(parcial, cin),
    disjuncao(conjuncao(a, b), conjuncao(cin, parcial)),
  ];
}

function enumerarEntradas(entradas, calcular) {
  const indicesIndefinidos = [];
  entradas.forEach((valor, indice) => {
    if (valor === null) indicesIndefinidos.push(indice);
  });

  const resultados = [];
  const totalCombinacoes = 2 ** indicesIndefinidos.length;
  for (let combinacao = 0; combinacao < totalCombinacoes; combinacao++) {
    const valores = [...entradas];
    indicesIndefinidos.forEach((indice, bit) => {
      valores[indice] = (combinacao >> bit) & 1;
    });
    resultados.push(calcular(valores));
  }

  return resultados[0].map((_, indice) => {
    const primeiro = resultados[0][indice];
    return resultados.every((resultado) => resultado[indice] === primeiro)
      ? primeiro
      : null;
  });
}

function somarQuatroBits(entradas) {
  const saidas = [];
  let carry = entradas[8];

  for (let indice = 0; indice < 4; indice++) {
    const [soma, proximoCarry] = somarCompleto(
      entradas[indice],
      entradas[indice + 4],
      carry,
    );
    saidas.push(soma);
    carry = proximoCarry;
  }

  saidas.push(carry);
  return saidas;
}

const PADROES_DISPLAY = [
  [1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1],
  [1, 1, 1, 1, 0, 0, 1],
  [0, 1, 1, 0, 0, 1, 1],
  [1, 0, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 1, 1],
];

function valorBcd(entradas) {
  return entradas.reduce((valor, bit, indice) => valor + bit * (2 ** (3 - indice)), 0);
}

function correspondeBit(valor, esperado) {
  if (valor === null) return null;
  return valor === esperado ? 1 : 0;
}

function selecionarMultiplexador(entradas, indices) {
  const valoresPossiveis = indices.map((indice) => entradas[indice]);
  const primeiro = valoresPossiveis[0];
  return valoresPossiveis.every((valor) => valor === primeiro) ? primeiro : null;
}

function criarMetadados(rotulo, numEntradas, numSaidas, categoria, nomesEntradas, nomesSaidas) {
  return { rotulo, numEntradas, numSaidas, categoria, nomesEntradas, nomesSaidas };
}

export const AVALIADORES_COMPOSTOS = {
  MEIO_SOMADOR(entradas) {
    return [exclusivo(entradas[0], entradas[1]), conjuncao(entradas[0], entradas[1])];
  },
  SOMADOR_COMPLETO(entradas) {
    return somarCompleto(entradas[0], entradas[1], entradas[2]);
  },
  SOMADOR_4BITS(entradas) {
    return somarQuatroBits(entradas);
  },
  SUBTRATOR_4BITS(entradas) {
    return enumerarEntradas(entradas, (valores) => {
      const a = valores.slice(0, 4).reduce((valor, bit, indice) => valor | (bit << indice), 0);
      const b = valores.slice(4, 8).reduce((valor, bit, indice) => valor | (bit << indice), 0);
      const diferenca = a - b - valores[8];
      const modulo = ((diferenca % 16) + 16) % 16;
      return [
        modulo & 1,
        (modulo >> 1) & 1,
        (modulo >> 2) & 1,
        (modulo >> 3) & 1,
        diferenca < 0 ? 1 : 0,
      ];
    });
  },
  MUX_2_1(entradas) {
    const [a, b, selecao] = entradas;
    if (selecao === 0) return [a];
    if (selecao === 1) return [b];
    return [a === b ? a : null];
  },
  MUX_4_1(entradas) {
    const [a, b, c, d, s0, s1] = entradas;
    const indices = [0, 1, 2, 3].filter((indice) => (
      (s0 === null || (indice & 1) === s0)
      && (s1 === null || ((indice >> 1) & 1) === s1)
    ));
    return [selecionarMultiplexador([a, b, c, d], indices)];
  },
  DEMUX_1_2(entradas) {
    const [valor, selecao] = entradas;
    return [
      conjuncao(valor, inverter(selecao)),
      conjuncao(valor, selecao),
    ];
  },
  DECODIFICADOR_2_4(entradas) {
    return [0, 1, 2, 3].map((indice) => (
      conjuncao(
        correspondeBit(entradas[0], (indice >> 1) & 1),
        correspondeBit(entradas[1], indice & 1),
      )
    ));
  },
  CODIFICADOR_4_2(entradas) {
    return enumerarEntradas(entradas, (valores) => {
      let indiceAtivo = -1;
      for (let indice = 0; indice < valores.length; indice++) {
        if (valores[indice] === 1) indiceAtivo = indice;
      }
      if (indiceAtivo < 0) return [0, 0];
      return [(indiceAtivo >> 1) & 1, indiceAtivo & 1];
    });
  },
  COMPARADOR_4BITS(entradas) {
    return enumerarEntradas(entradas, (valores) => {
      const a = valores.slice(0, 4).reduce((valor, bit, indice) => valor | (bit << indice), 0);
      const b = valores.slice(4, 8).reduce((valor, bit, indice) => valor | (bit << indice), 0);
      return [a > b ? 1 : 0, a === b ? 1 : 0, a < b ? 1 : 0];
    });
  },
  DISPLAY_7SEG(entradas) {
    return enumerarEntradas(entradas, (valores) => {
      const numero = valorBcd(valores);
      return PADROES_DISPLAY[numero] || [0, 0, 0, 0, 0, 0, 0];
    });
  },
  PORTA_AND_4(entradas) {
    return [entradas.reduce(conjuncao, 1)];
  },
  PORTA_OR_4(entradas) {
    return [entradas.reduce(disjuncao, 0)];
  },
  PORTA_XOR_4(entradas) {
    return [entradas.reduce(exclusivo, 0)];
  },
};

export const METADADOS_COMPOSTOS = {
  MEIO_SOMADOR: criarMetadados('Meio somador', 2, 2, 'Aritmética', ['A', 'B'], ['S', 'Cout']),
  SOMADOR_COMPLETO: criarMetadados('Somador completo', 3, 2, 'Aritmética', ['A', 'B', 'Cin'], ['S', 'Cout']),
  SOMADOR_4BITS: criarMetadados('Somador de 4 bits', 9, 5, 'Aritmética', ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'Cin'], ['S0', 'S1', 'S2', 'S3', 'Cout']),
  SUBTRATOR_4BITS: criarMetadados('Subtrator de 4 bits', 9, 5, 'Aritmética', ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'Bin'], ['D0', 'D1', 'D2', 'D3', 'Bout']),
  COMPARADOR_4BITS: criarMetadados('Comparador de 4 bits', 8, 3, 'Aritmética', ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3'], ['A>B', 'A=B', 'A<B']),
  MUX_2_1: criarMetadados('MUX 2:1', 3, 1, 'Seleção e Codificação', ['A', 'B', 'Sel'], ['Y']),
  MUX_4_1: criarMetadados('MUX 4:1', 6, 1, 'Seleção e Codificação', ['A', 'B', 'C', 'D', 'S0', 'S1'], ['Y']),
  DEMUX_1_2: criarMetadados('DEMUX 1:2', 2, 2, 'Seleção e Codificação', ['In', 'Sel'], ['Y0', 'Y1']),
  DECODIFICADOR_2_4: criarMetadados('Decodificador 2:4', 2, 4, 'Seleção e Codificação', ['A', 'B'], ['Y0', 'Y1', 'Y2', 'Y3']),
  CODIFICADOR_4_2: criarMetadados('Codificador 4:2', 4, 2, 'Seleção e Codificação', ['I0', 'I1', 'I2', 'I3'], ['A', 'B']),
  DISPLAY_7SEG: criarMetadados('Display de 7 segmentos', 4, 7, 'Exibição', ['A', 'B', 'C', 'D'], ['a', 'b', 'c', 'd', 'e', 'f', 'g']),
  PORTA_AND_4: criarMetadados('AND de 4 entradas', 4, 1, 'Portas Lógicas', ['A', 'B', 'C', 'D'], ['Y']),
  PORTA_OR_4: criarMetadados('OR de 4 entradas', 4, 1, 'Portas Lógicas', ['A', 'B', 'C', 'D'], ['Y']),
  PORTA_XOR_4: criarMetadados('XOR de 4 entradas', 4, 1, 'Portas Lógicas', ['A', 'B', 'C', 'D'], ['Y']),
};
