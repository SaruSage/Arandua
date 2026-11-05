/**
 * solver.js — Resolução elétrica do circuito.
 *
 * Método: análise nodal modificada (MNA) com Newton-Raphson.
 *
 * Modelos:
 * - Resistor, capacitor, indutor: linear
 * - Diodo / LED / fotodiodo: equação de Shockley
 * - Transistor NPN/PNP: Ebers-Moll simplificado com região ativa,
 *   corte e saturação (funciona como chave E como amplificador)
 * - Amp-op: modelo ideal com ganho finito, trilhos e realimentação
 * - Transformador: acoplamento ideal por relação de espiras
 * - Fontes: tensão imposta
 * - Chave: condutância alta/baixa
 * - Portas lógicas: fonte de tensão com resistência de saída
 */

import { CATALOGO } from './catalogo.js';

const VCC_PADRAO = 5;
const TOLERANCIA = 1e-5;
const MAX_ITERACOES = 120;
const FATOR_RELAXACAO = 0.5;
const VT = 0.026; // tensão térmica a 300K
const G_MIN = 1e-12;

function compararPorId(a, b) {
  const idA = String(a.id);
  const idB = String(b.id);
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

function componentesPorId(circuito) {
  return [...circuito.componentes].sort(compararPorId);
}

function tensaoNominalFonte(comp) {
  const tensao = comp.propriedades?.tensao ?? comp.propriedades?.amplitude ?? 5;
  return Number.isFinite(tensao) ? tensao : 5;
}

function avaliarPorta(tipo, entradas) {
  const vals = entradas.map((v) => (v === 1 ? 1 : 0));

  switch (tipo) {
    case 'AND':    return vals.every((v) => v === 1) ? 1 : 0;
    case 'OR':     return vals.some((v) => v === 1) ? 1 : 0;
    case 'NOT':    return vals[0] === 1 ? 0 : 1;
    case 'NAND':   return vals.every((v) => v === 1) ? 0 : 1;
    case 'NOR':    return vals.some((v) => v === 1) ? 0 : 1;
    case 'XOR':    return vals.filter((v) => v === 1).length % 2 === 1 ? 1 : 0;
    case 'XNOR':   return vals.filter((v) => v === 1).length % 2 === 0 ? 1 : 0;
    case 'BUFFER': return vals[0];
    default:       return 0;
  }
}

function tensaoParaLogico(tensao, vcc) {
  if (tensao == null || !isFinite(tensao) || vcc <= 0) return 0;
  const razao = tensao / vcc;
  if (razao >= 0.6) return 1;
  if (razao <= 0.4) return 0;
  return 0;
}

function fiosPorExtremos(circuito) {
  const chavePino = (pino) => `${pino?.componente ?? ''}:${pino?.pino ?? ''}`;
  const chave = (fio) => [chavePino(fio.origem), chavePino(fio.destino)].sort().join('|');
  return [...circuito.fios].sort((a, b) => {
    const chaveA = chave(a);
    const chaveB = chave(b);
    if (chaveA !== chaveB) return chaveA < chaveB ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  });
}

/* ===== GRAFO DE NÓS ===== */

function construirNos(circuito) {
  const componentes = componentesPorId(circuito);
  const pai = new Map();

  function encontrar(x) {
    if (!pai.has(x)) pai.set(x, x);
    let raiz = x;
    while (pai.get(raiz) !== raiz) raiz = pai.get(raiz);
    // Compressão de caminho
    while (pai.get(x) !== raiz) {
      const prox = pai.get(x);
      pai.set(x, raiz);
      x = prox;
    }
    return raiz;
  }

  function unir(a, b) {
    const ra = encontrar(a);
    const rb = encontrar(b);
    if (ra !== rb) pai.set(ra, rb);
  }

  for (const comp of componentes) {
    for (const pino of comp.pinos) {
      encontrar(`${comp.id}:${pino.id}`);
    }
  }

  for (const fio of fiosPorExtremos(circuito)) {
    unir(
      `${fio.origem.componente}:${fio.origem.pino}`,
      `${fio.destino.componente}:${fio.destino.pino}`
    );
  }

  const raizes = new Map();
  const nos = [];
  for (const comp of componentes) {
    for (const pino of comp.pinos) {
      const raiz = encontrar(`${comp.id}:${pino.id}`);
      if (!raizes.has(raiz)) {
        raizes.set(raiz, nos.length);
        nos.push({ id: nos.length, pinos: [] });
      }
      nos[raizes.get(raiz)].pinos.push({ componente: comp.id, pino: pino.id });
    }
  }

  const pinoParaNo = new Map();
  for (const comp of componentes) {
    for (const pino of comp.pinos) {
      pinoParaNo.set(
        `${comp.id}:${pino.id}`,
        raizes.get(encontrar(`${comp.id}:${pino.id}`))
      );
    }
  }

  const fontes = componentes
    .filter((comp) => comp.tipo === 'BATERIA' || comp.tipo === 'FONTE_AC')
    .sort((a, b) => tensaoNominalFonte(b) - tensaoNominalFonte(a) || compararPorId(a, b));
  const fonteReferencia = fontes[0];
  const noTerra = fonteReferencia
    ? pinoParaNo.get(`${fonteReferencia.id}:p2`) ?? 0
    : 0;

  return { nos, pinoParaNo, noTerra, semFonte: !fonteReferencia };
}

/* ===== UTILITÁRIOS MATRICIAIS ===== */

function adicionarCondutancia(G, n1, n2, g) {
  if (n1 === n2 || n1 === undefined || n2 === undefined) return;
  G[n1][n1] += g;
  G[n2][n2] += g;
  G[n1][n2] -= g;
  G[n2][n1] -= g;
}

function adicionarFonteCorrente(I, n1, n2, valor) {
  if (n1 !== undefined) I[n1] += valor;
  if (n2 !== undefined) I[n2] -= valor;
}

function resolverGauss(G, I) {
  const n = G.length;
  const A = G.map((row, i) => [...row, I[i]]);

  for (let col = 0; col < n; col++) {
    let maxIdx = col;
    for (let i = col + 1; i < n; i++) {
      if (Math.abs(A[i][col]) > Math.abs(A[maxIdx][col])) maxIdx = i;
    }
    if (maxIdx !== col) [A[col], A[maxIdx]] = [A[maxIdx], A[col]];

    if (Math.abs(A[col][col]) < 1e-14) {
      A[col][col] = 1e-14;
    }

    for (let i = col + 1; i < n; i++) {
      const fator = A[i][col] / A[col][col];
      if (fator === 0) continue;
      for (let j = col; j <= n; j++) {
        A[i][j] -= fator * A[col][j];
      }
    }
  }

  const V = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let soma = A[i][n];
    for (let j = i + 1; j < n; j++) {
      soma -= A[i][j] * V[j];
    }
    V[i] = Math.abs(A[i][i]) > 1e-14 ? soma / A[i][i] : 0;
  }
  return V;
}

/* ===== MODELOS NÃO-LINEARES ===== */

/** Diodo: linearização de Newton em torno de vd. */
/**
 * Modelo do LED: linearização por partes com joelho em Vf e transição cúbica (smoothstep).
 *
 * Abaixo de Vf - LARGURA: região de bloqueio (1 MΩ)
 * Acima de Vf + LARGURA: região de condução (0.2 Ω em série com Vf)
 * Entre os dois: transição suave com curva cúbica (smoothstep)
 *
 * Retorna { corrente, condutancia, iEq } para o MNA.
 */
function modeloLED(vd, propriedades) {
  const VF = Number(propriedades?.tensaoDireta ?? 1.8);
  const R_OFF = 1e6;
  const R_ON = 5;   // era 0.2
  const LARGURA = 0.5;   // AUMENTADO de 0.2 para 0.5

  const v = Math.max(-100, Math.min(vd, 100));
  const gOff = 1 / R_OFF;
  const gOn = 1 / R_ON;

  let condutancia;
  let corrente;

  if (v <= VF - LARGURA) {
    condutancia = gOff;
    corrente = gOff * v;
  } else if (v >= VF + LARGURA) {
    condutancia = gOn;
    corrente = gOff * v + (gOn - gOff) * (v - VF);
  } else {
    // Transição suave com curva cúbica (mais estável que linear)
    const t = (v - (VF - LARGURA)) / (2 * LARGURA);
    const s = t * t * (3 - 2 * t);   // smoothstep
    condutancia = gOff + (gOn - gOff) * s;
    // Integral exata de condutancia(v) para manter continuidade C¹ de corrente e tensão Vf
    const integralS = (2 * LARGURA) * (t * t * t * (1 - 0.5 * t));
    corrente = gOff * v + (gOn - gOff) * integralS;
  }

  const iEq = corrente - condutancia * v;
  return { corrente, condutancia, iEq };
}

function linearizarDiodo(vd, is, n = 1.5) {
  const v = Math.max(-5, Math.min(vd, 0.95));
  const exp = Math.exp(Math.min(v / (n * VT), 40));
  const i = is * (exp - 1);
  const g = Math.max((is * exp) / (n * VT), G_MIN);
  const iEq = i - g * v;
  return { g, iEq };
}

/**
 * Transistor bipolar: modelo de Ebers-Moll simplificado.
 * Funciona em corte, ativo e saturação.
 * Retorna as correntes e as condutâncias linearizadas.
 */
function linearizarBJT(vbe, vbc, beta, is, tipo) {
  const sinal = tipo === 'PNP' ? -1 : 1;
  const vbeE = sinal * vbe;
  const vbcE = sinal * vbc;

  // Correntes de junção (Shockley)
  const iF = is * (Math.exp(Math.min(vbeE / VT, 40)) - 1);
  const iR = is * (Math.exp(Math.min(vbcE / VT, 40)) - 1);

  const alphaF = beta / (beta + 1);
  const alphaR = 0.5;

  // Correntes nos terminais (normalizadas para NPN)
  const ic = alphaF * iF - iR;
  const ib = (1 - alphaF) * iF + (1 - alphaR) * iR;
  const ie = ic + ib;

  // Derivadas parciais (condutâncias)
  const gF = Math.max((is / VT) * Math.exp(Math.min(vbeE / VT, 40)), G_MIN);
  const gR = Math.max((is / VT) * Math.exp(Math.min(vbcE / VT, 40)), G_MIN);

  const dIc_dVbe = alphaF * gF;
  const dIc_dVbc = -gR;
  const dIb_dVbe = (1 - alphaF) * gF;
  const dIb_dVbc = (1 - alphaR) * gR;

  return {
    ic: sinal * ic,
    ib: sinal * ib,
    ie: sinal * ie,
    gbe: dIb_dVbe + dIc_dVbe,
    gbc: dIb_dVbc + dIc_dVbc,
    gm: dIc_dVbe,
    // Correntes equivalentes para o lado direito
    iEqC: sinal * (ic - dIc_dVbe * vbeE - dIc_dVbc * vbcE),
    iEqB: sinal * (ib - dIb_dVbe * vbeE - dIb_dVbc * vbcE),
  };
}

/**
 * Amplificador operacional: modelo de ganho finito com trilhos.
 * A saída é limitada entre V- e V+.
 */
function resolverAmpOp(comp, vInm, vInp, vOutAnterior) {
  const A = comp.propriedades.ganho || 100000;
  const vMais = comp.propriedades.tensaoTrilhoPositivo ?? 12;
  const vMenos = comp.propriedades.tensaoTrilhoNegativo ?? -12;

  const vDiff = vInp - vInm;
  let vIdeal = A * vDiff;

  // Saturação nos trilhos
  if (vIdeal > vMais) vIdeal = vMais;
  if (vIdeal < vMenos) vIdeal = vMenos;

  // Resistência de saída baixa (ideal ~ 0)
  const gOut = 1 / 10; // 10 Ω de saída
  return { vSaida: vIdeal, gOut };
}

/* ===== MONTAGEM DO SISTEMA ===== */

function montarSistema(circuito, nos, pinoParaNo, tensoesAnteriores, noTerra, avisos) {
  const numNos = nos.length;
  const componentes = componentesPorId(circuito);
  const fontesTensao = componentes.filter(
    (c) => CATALOGO[c.tipo].modelo === 'fonte'
  );
  const numFontes = fontesTensao.length;
  const tamanho = numNos + numFontes;

  const G = Array.from({ length: tamanho }, () => new Array(tamanho).fill(0));
  const I = new Array(tamanho).fill(0);

  const indiceFonte = new Map();
  fontesTensao.forEach((f, i) => indiceFonte.set(f.id, numNos + i));

  for (const comp of componentes) {
    const def = CATALOGO[comp.tipo];
    const modelo = def.modelo;
    const vAnt = tensoesAnteriores[comp.id] || 0;

    /* ---- LINEARES ---- */
    if (modelo === 'linear') {
      if (comp.tipo === 'RESISTOR' || comp.tipo === 'FUSIVEL') {
        const queimado = comp.tipo === 'FUSIVEL'
                      && comp.propriedades?.queimado === true;

        // Lê a resistência da propriedade correta
        let resistencia;
        if (comp.tipo === 'FUSIVEL') {
          resistencia = comp.propriedades?.resistencia ?? 0.01;
        } else {
          resistencia = comp.propriedades?.resistencia
                     ?? comp.propriedades?.valor
                     ?? 1000;
        }

        // Converte para número, com proteção
        resistencia = Number(resistencia);
        if (!isFinite(resistencia) || resistencia <= 0) {
          resistencia = 1000;
        }

        // Fusível queimado = circuito aberto
        if (queimado) resistencia = 1e9;

        const condutancia = 1 / resistencia;

        const noA = pinoParaNo.get(`${comp.id}:p1`);
        const noB = pinoParaNo.get(`${comp.id}:p2`);

        if (noA !== undefined && noB !== undefined && noA !== noB) {
          adicionarCondutancia(G, noA, noB, condutancia);
        }
      } else if (['POTENCIOMETRO', 'LDR', 'TERMISTOR'].includes(comp.tipo)) {
        const r = calcularResistencia(comp);
        adicionarCondutancia(G, pinoParaNo.get(`${comp.id}:p1`), pinoParaNo.get(`${comp.id}:p2`), 1 / Math.max(r, 1e-9));
      } else if (comp.tipo === 'CAPACITOR') {
        const c = comp.propriedades.capacitancia;
        const dt = 1e-4;
        const g = Math.max(c / dt, G_MIN);
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        adicionarCondutancia(G, n1, n2, g);
        adicionarFonteCorrente(I, n1, n2, g * vAnt);
      } else if (comp.tipo === 'INDUTOR') {
        const l = comp.propriedades.indutancia;
        const dt = 1e-4;
        const g = Math.max(dt / Math.max(l, 1e-9), G_MIN);
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        adicionarCondutancia(G, n1, n2, g);
        adicionarFonteCorrente(I, n1, n2, g * vAnt);
      } else if (comp.tipo === 'TRANSFORMADOR') {
        // Acoplamento ideal: V1/N1 = V2/N2, I1*N1 = -I2*N2
        const n1 = comp.propriedades.espirasPrimario;
        const n2 = comp.propriedades.espirasSecundario;
        const rel = n2 / Math.max(n1, 1);
        const p1 = pinoParaNo.get(`${comp.id}:p1`);
        const p2 = pinoParaNo.get(`${comp.id}:p2`);
        const s1 = pinoParaNo.get(`${comp.id}:s1`);
        const s2 = pinoParaNo.get(`${comp.id}:s2`);
        // Modelo simplificado: primário com resistência baixa,
        // secundário como fonte dependente do primário
        adicionarCondutancia(G, p1, p2, 1 / 0.5);
        adicionarCondutancia(G, s1, s2, 1 / 0.5);
        // Acoplamento: corrente no secundário proporcional ao primário
        const vPrim = vAnt;
        adicionarFonteCorrente(I, s1, s2, rel * vPrim * 0.5);
      }
    }

    /* ---- CHAVES ---- */
    else if (modelo === 'chave') {
      if (comp.tipo === 'CHAVE' || comp.tipo === 'CHAVE_SIMPLES' || comp.tipo === 'BOTAO') {
        const fechada = comp.propriedades?.fechada === true
                     || comp.propriedades?.pressionado === true;

        // Resistência alta quando aberta, baixa quando fechada
        const resistencia = fechada ? 0.001 : 1e9;
        const condutancia = 1 / resistencia;

        const noA = pinoParaNo.get(`${comp.id}:p1`);
        const noB = pinoParaNo.get(`${comp.id}:p2`);

        if (noA !== undefined && noB !== undefined && noA !== noB) {
          adicionarCondutancia(G, noA, noB, condutancia);
        }
      }
    }

    /* ---- NÃO-LINEARES ---- */
    else if (modelo === 'nao-linear') {
      if (comp.tipo === 'LED') {
        const noAnodo = pinoParaNo.get(`${comp.id}:p1`);
        const noCatodo = pinoParaNo.get(`${comp.id}:p2`);

        if (noAnodo !== undefined && noCatodo !== undefined && noAnodo !== noCatodo) {
          const vd = (tensoesAnteriores[noAnodo] ?? 0) - (tensoesAnteriores[noCatodo] ?? 0);
          const { condutancia, iEq } = modeloLED(vd, comp.propriedades);

          adicionarCondutancia(G, noAnodo, noCatodo, condutancia);
          adicionarFonteCorrente(I, noAnodo, noCatodo, -iEq);
        }
      } else if (['DIODO', 'FOTODIODO'].includes(comp.tipo)) {
        const vd = vAnt;
        const { g, iEq } = linearizarDiodo(vd, comp.propriedades.correnteSaturacao || 1e-12);
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        adicionarCondutancia(G, n1, n2, g);
        adicionarFonteCorrente(I, n1, n2, -iEq);
      } else if (comp.tipo === 'TRANSISTOR_NPN' || comp.tipo === 'TRANSISTOR_PNP') {
        const beta = comp.propriedades.ganho || 100;
        const is = 1e-14;
        const nb = pinoParaNo.get(`${comp.id}:b`);
        const nc = pinoParaNo.get(`${comp.id}:c`);
        const ne = pinoParaNo.get(`${comp.id}:e`);

        // Tensões anteriores
        const vbeAnt = tensoesAnteriores[`${comp.id}:be`] || 0.6;
        const vbcAnt = tensoesAnteriores[`${comp.id}:bc`] || -5;

        const r = linearizarBJT(vbeAnt, vbcAnt, beta, is, comp.tipo === 'PNP' ? 'PNP' : 'NPN');

        // Condutâncias base-emissor e base-coletor
        adicionarCondutancia(G, nb, ne, Math.max(r.gbe, G_MIN));
        adicionarCondutancia(G, nb, nc, Math.max(r.gbc, G_MIN));
        // Transcondutância: corrente no coletor controlada por vbe
        adicionarCondutancia(G, nc, ne, Math.max(r.gm, G_MIN));

        // Correntes equivalentes
        adicionarFonteCorrente(I, nc, ne, r.iEqC);
        adicionarFonteCorrente(I, nb, ne, r.iEqB);
      }
    }

    /* ---- FONTES DE TENSÃO ---- */
    else if (modelo === 'fonte') {
      const idx = indiceFonte.get(comp.id);
      const n1 = pinoParaNo.get(`${comp.id}:p1`);
      const n2 = pinoParaNo.get(`${comp.id}:p2`);
      const v = comp.propriedades.tensao ?? comp.propriedades.amplitude ?? 5;

      G[idx][n1] += 1;
      G[idx][n2] -= 1;
      G[n1][idx] += 1;
      G[n2][idx] -= 1;
      I[idx] = v;
    }

    /* ---- PORTAS LÓGICAS ---- */
    else if (modelo === 'logica') {
      const RESISTENCIA_PULLDOWN = 1e6; // 1 MΩ

      for (const p of comp.pinos.filter((p) => p.id !== 'y')) {
        const no = pinoParaNo.get(`${comp.id}:${p.id}`);
        if (no !== undefined && no !== noTerra) {
          adicionarCondutancia(G, no, noTerra, 1 / RESISTENCIA_PULLDOWN);
        }
      }

      // Descobre o Vcc do circuito
      const vcc = Math.max(
        ...circuito.componentes
          .filter((c) => c.tipo === 'BATERIA' || c.tipo === 'FONTE_AC')
          .map((c) => c.propriedades?.tensao || c.propriedades?.amplitude || 0),
        0
      );

      // Lê a tensão de cada pino de entrada e converte para lógica
      const entradas = comp.pinos
        .filter((p) => p.id !== 'y')
        .map((p) => {
          const no = pinoParaNo.get(`${comp.id}:${p.id}`);
          const tensao = tensoesAnteriores[no] ?? 0;
          return tensaoParaLogico(tensao, vcc);
        });

      // Avalia a porta
      const saida = avaliarPorta(comp.tipo, entradas);

      // Grava o estado
      comp.estado = comp.estado || {};
      comp.estado.saida = saida;

      // Aplica a tensão de saída no nó do pino y
      const noY = pinoParaNo.get(`${comp.id}:y`);
      if (noY !== undefined) {
        const vSaida = saida === 1 ? vcc : 0;
        const gSaida = 1 / 100; // 100 Ω de saída
        adicionarCondutancia(G, noY, noTerra, gSaida);
        adicionarFonteCorrente(I, noY, noTerra, gSaida * vSaida);
      }
    }

    /* ---- COMPOSTOS ---- */
    else if (modelo === 'composto') {
      if (comp.tipo === 'AMP_OP') {
        const nInm = pinoParaNo.get(`${comp.id}:inm`);
        const nInp = pinoParaNo.get(`${comp.id}:inp`);
        const nOut = pinoParaNo.get(`${comp.id}:out`);

        // Tensões anteriores dos pinos de entrada
        const vInm = tensoesAnteriores[`${comp.id}:inm`] || 0;
        const vInp = tensoesAnteriores[`${comp.id}:inp`] || 0;

        const { vSaida, gOut } = resolverAmpOp(comp, vInm, vInp, vAnt);

        // Saída como fonte de tensão com resistência
        adicionarCondutancia(G, nOut, noTerra, gOut);
        adicionarFonteCorrente(I, nOut, noTerra, gOut * vSaida);

        // Entradas de altíssima impedância (10 MΩ)
        adicionarCondutancia(G, nInm, noTerra, 1 / 1e7);
        adicionarCondutancia(G, nInp, noTerra, 1 / 1e7);
      } else if (comp.tipo === 'DISPLAY_7SEG') {
        // Cada segmento é um LED — modelado como diodo
        for (let i = 0; i < 7; i++) {
          const pinoId = ['a', 'b', 'c', 'd', 'e', 'f', 'g'][i];
          const nSeg = pinoParaNo.get(`${comp.id}:${pinoId}`);
          const nCom = pinoParaNo.get(`${comp.id}:com`);
          if (nSeg === undefined || nCom === undefined) continue;
          const vd = (tensoesAnteriores[`${comp.id}:${pinoId}`] || 0);
          const { g, iEq } = linearizarDiodo(vd, 1e-14);
          adicionarCondutancia(G, nSeg, nCom, g);
          adicionarFonteCorrente(I, nSeg, nCom, -iEq);
        }
      } else if (comp.tipo === 'CI_GENERICO') {
        // Função interna definida pelo usuário
        const funcao = comp.propriedades.funcao || 'buffer';
        const nIn = pinoParaNo.get(`${comp.id}:p1`);
        const nOut = pinoParaNo.get(`${comp.id}:p5`);
        if (nIn !== undefined && nOut !== undefined) {
          const vIn = tensoesAnteriores[`${comp.id}:p1`] || 0;
          const logico = vIn > VCC_PADRAO / 2 ? 1 : 0;
          let vOut = 0;
          if (funcao === 'buffer') vOut = logico ? VCC_PADRAO : 0;
          else if (funcao === 'inversor') vOut = logico ? 0 : VCC_PADRAO;
          else vOut = logico ? VCC_PADRAO : 0;
          const g = 1 / 100;
          adicionarCondutancia(G, nOut, noTerra, g);
          adicionarFonteCorrente(I, nOut, noTerra, g * vOut);
        }
      }
    }
  }

  // Terra
  for (let indice = 0; indice < tamanho; indice++) {
    G[noTerra][indice] = 0;
    G[indice][noTerra] = 0;
  }
  G[noTerra][noTerra] = 1;
  I[noTerra] = 0;

  return { G, I, numNos, numFontes };
}

function calcularResistencia(comp) {
  if (comp.tipo === 'RESISTOR') {
    let resistencia = comp.propriedades?.resistencia ?? comp.propriedades?.valor ?? 1000;
    resistencia = Number(resistencia);
    if (!isFinite(resistencia) || resistencia <= 0) resistencia = 1000;
    return resistencia;
  }
  if (comp.tipo === 'FUSIVEL') {
    return comp.propriedades?.queimado === true
      ? 1e9
      : Math.max(comp.propriedades?.resistencia ?? 0.01, 0.001);
  }
  if (comp.tipo === 'POTENCIOMETRO') {
    const total = comp.propriedades.resistencia;
    const pos = comp.propriedades.posicao ?? 0.5;
    return Math.max(total * (1 - pos), 1);
  }
  if (comp.tipo === 'LDR') {
    const luz = comp.propriedades.luzAmbiente ?? 0.5;
    const rClaro = comp.propriedades.resistenciaClaro;
    const rEscuro = comp.propriedades.resistenciaEscuro;
    return rEscuro + (rClaro - rEscuro) * luz;
  }
  if (comp.tipo === 'TERMISTOR') {
    const temp = comp.propriedades.temperatura ?? 25;
    const rNom = comp.propriedades.resistenciaNominal;
    const b = comp.propriedades.coeficiente;
    const t0 = 298.15;
    const t = temp + 273.15;
    return rNom * Math.exp(b * (1 / t - 1 / t0));
  }
  return 1000;
}

/* ===== API PÚBLICA ===== */

export function simular(circuito) {
  const avisos = [];
  if (circuito.componentes.length === 0) {
    return {
      tensoes: {},
      correntes: {},
      convergiu: true,
      erro: null,
      avisos: ['Circuito sem fonte: referência de terra arbitrária'],
    };
  }

  const { nos, pinoParaNo, noTerra, semFonte } = construirNos(circuito);
  if (semFonte) avisos.push('Circuito sem fonte: referência de terra arbitrária');

  let tensoesAnteriores = {};
  let V = null;
  let Vant = null;
  let convergiu = false;
  const componentes = componentesPorId(circuito);

  for (let iter = 0; iter < MAX_ITERACOES; iter++) {
    const { G, I } = montarSistema(circuito, nos, pinoParaNo, tensoesAnteriores, noTerra, avisos);
    const Vbruto = resolverGauss(G, I);

    let maxDelta = 0;
    let Vnovo = Vbruto;
    if (V) {
      Vant = [...V];
      Vnovo = Vbruto.map(
        (v, i) => V[i] * (1 - FATOR_RELAXACAO) + v * FATOR_RELAXACAO
      );
      for (let i = 0; i < V.length; i++) {
        maxDelta = Math.max(maxDelta, Math.abs(Vbruto[i] - V[i]));
      }
    }
    V = Vnovo;

    // Atualiza tensões anteriores
    tensoesAnteriores = {};
    for (let i = 0; i < V.length; i++) {
      tensoesAnteriores[i] = V[i];
    }
    for (const comp of componentes) {
      const pinoIds = comp.pinos.map((p) => p.id);
      if (pinoIds.length >= 2) {
        const n1 = pinoParaNo.get(`${comp.id}:${pinoIds[0]}`);
        const n2 = pinoParaNo.get(`${comp.id}:${pinoIds[1]}`);
        tensoesAnteriores[comp.id] = (V[n1] ?? 0) - (V[n2] ?? 0);
      }
      // Tensões específicas para transistores
      if (comp.tipo === 'TRANSISTOR_NPN' || comp.tipo === 'TRANSISTOR_PNP') {
        const nb = pinoParaNo.get(`${comp.id}:b`);
        const nc = pinoParaNo.get(`${comp.id}:c`);
        const ne = pinoParaNo.get(`${comp.id}:e`);
        tensoesAnteriores[`${comp.id}:be`] = (V[nb] ?? 0) - (V[ne] ?? 0);
        tensoesAnteriores[`${comp.id}:bc`] = (V[nb] ?? 0) - (V[nc] ?? 0);
      }
      // Tensões de entrada do amp-op
      if (comp.tipo === 'AMP_OP') {
        const nInm = pinoParaNo.get(`${comp.id}:inm`);
        const nInp = pinoParaNo.get(`${comp.id}:inp`);
        tensoesAnteriores[`${comp.id}:inm`] = V[nInm] ?? 0;
        tensoesAnteriores[`${comp.id}:inp`] = V[nInp] ?? 0;
      }
      // Tensões dos segmentos do display
      if (comp.tipo === 'DISPLAY_7SEG') {
        for (const pinoId of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
          const n = pinoParaNo.get(`${comp.id}:${pinoId}`);
          const nc = pinoParaNo.get(`${comp.id}:com`);
          tensoesAnteriores[`${comp.id}:${pinoId}`] = (V[n] ?? 0) - (V[nc] ?? 0);
        }
      }
    }

    if (iter > 0 && maxDelta < TOLERANCIA) {
      convergiu = true;
      break;
    }
  }

  // Se não atingiu TOLERANCIA estrita mas a variação entre as duas últimas
  // iterações for menor que 5%, considera o resultado estável e utilizável
  if (!convergiu && V && Vant) {
    let maxDiffRel = 0;
    for (let i = 0; i < V.length; i++) {
      const ref = Math.max(Math.abs(V[i]), 0.01);
      maxDiffRel = Math.max(maxDiffRel, Math.abs(V[i] - Vant[i]) / ref);
    }
    if (maxDiffRel < 0.05) {
      convergiu = true;
    }
  }

  let resultado = finalizar(circuito, nos, pinoParaNo, V, convergiu, avisos);

  // Verifica queima de fusíveis (APENAS com excesso real, margem de 1%)
  let queimouAlgum = false;
  const avisosQueima = [];
  for (const comp of circuito.componentes) {
    if (comp.tipo !== 'FUSIVEL') continue;
    if (comp.propriedades?.queimado === true) continue;

    const corrente = Math.abs(resultado.correntes?.[comp.id] ?? 0);
    const nominal = comp.propriedades?.correnteNominal ?? 0.5;

    // Queima APENAS com excesso real, com 1% de tolerância
    if (corrente > nominal * 1.01) {
      comp.propriedades.queimado = true;
      queimouAlgum = true;
      avisosQueima.push(
        `Fusível queimou: ${(corrente * 1000).toFixed(1)} mA excede ${(nominal * 1000).toFixed(0)} mA.`
      );
    }
  }

  // Se algum fusível queimou agora, recalcula imediatamente o circuito com ele aberto
  if (queimouAlgum) {
    let tensoesPos = {};
    let Vpos = null;
    let VposAnt = null;
    let convPos = false;
    const avisosPos = [];
    for (let iter = 0; iter < MAX_ITERACOES; iter++) {
      const { G, I } = montarSistema(circuito, nos, pinoParaNo, tensoesPos, noTerra, avisosPos);
      const Vbruto = resolverGauss(G, I);
      let maxDelta = 0;
      let Vnovo = Vbruto;
      if (Vpos) {
        VposAnt = [...Vpos];
        Vnovo = Vbruto.map(
          (v, i) => Vpos[i] * (1 - FATOR_RELAXACAO) + v * FATOR_RELAXACAO
        );
        for (let i = 0; i < Vpos.length; i++) {
          maxDelta = Math.max(maxDelta, Math.abs(Vbruto[i] - Vpos[i]));
        }
      }
      Vpos = Vnovo;
      tensoesPos = {};
      for (let i = 0; i < Vpos.length; i++) tensoesPos[i] = Vpos[i];
      for (const comp of componentes) {
        const pinoIds = comp.pinos.map((p) => p.id);
        if (pinoIds.length >= 2) {
          const n1 = pinoParaNo.get(`${comp.id}:${pinoIds[0]}`);
          const n2 = pinoParaNo.get(`${comp.id}:${pinoIds[1]}`);
          tensoesPos[comp.id] = (Vpos[n1] ?? 0) - (Vpos[n2] ?? 0);
        }
      }
      if (iter > 0 && maxDelta < TOLERANCIA) {
        convPos = true;
        break;
      }
    }
    if (!convPos && Vpos && VposAnt) {
      let maxDiffRel = 0;
      for (let i = 0; i < Vpos.length; i++) {
        const ref = Math.max(Math.abs(Vpos[i]), 0.01);
        maxDiffRel = Math.max(maxDiffRel, Math.abs(Vpos[i] - VposAnt[i]) / ref);
      }
      if (maxDiffRel < 0.05) convPos = true;
    }
    resultado = finalizar(circuito, nos, pinoParaNo, Vpos, convPos, [...avisosPos, ...avisosQueima]);
    resultado.queimouFusivel = true;
  }

  return resultado;
}

function finalizar(circuito, nos, pinoParaNo, V, convergiu, avisos) {
  const tensoes = {};
  const componentes = componentesPorId(circuito);
  for (const comp of componentes) {
    for (const pino of comp.pinos) {
      const n = pinoParaNo.get(`${comp.id}:${pino.id}`);
      tensoes[`${comp.id}:${pino.id}`] = V[n] ?? 0;
    }
  }

  const correntes = {};
  for (const comp of componentes) {
    const def = CATALOGO[comp.tipo];
    if (def.modelo === 'linear' && comp.pinos.length >= 2) {
      const n1 = pinoParaNo.get(`${comp.id}:${comp.pinos[0].id}`);
      const n2 = pinoParaNo.get(`${comp.id}:${comp.pinos[1].id}`);
      const v = (V[n1] ?? 0) - (V[n2] ?? 0);
      const r = calcularResistencia(comp);
      correntes[comp.id] = v / Math.max(r, 1e-9);
    } else if (['DIODO', 'LED', 'FOTODIODO'].includes(comp.tipo)) {
      const n1 = pinoParaNo.get(`${comp.id}:p1`);
      const n2 = pinoParaNo.get(`${comp.id}:p2`);
      const vd = (V[n1] ?? 0) - (V[n2] ?? 0);
      if (comp.tipo === 'LED') {
        const { corrente } = modeloLED(vd, comp.propriedades);
        correntes[comp.id] = corrente;
      } else {
        const is = comp.propriedades.correnteSaturacao || 1e-12;
        const exp = Math.exp(Math.min(Math.max(vd, -5) / (1.5 * VT), 40));
        correntes[comp.id] = is * (exp - 1);
      }
    } else if (comp.tipo === 'TRANSISTOR_NPN' || comp.tipo === 'TRANSISTOR_PNP') {
      const nb = pinoParaNo.get(`${comp.id}:b`);
      const nc = pinoParaNo.get(`${comp.id}:c`);
      const ne = pinoParaNo.get(`${comp.id}:e`);
      const vbe = (V[nb] ?? 0) - (V[ne] ?? 0);
      const vbc = (V[nb] ?? 0) - (V[nc] ?? 0);
      const beta = comp.propriedades.ganho || 100;
      const r = linearizarBJT(vbe, vbc, beta, 1e-14, comp.tipo === 'PNP' ? 'PNP' : 'NPN');
      correntes[comp.id] = r.ic;
    } else {
      correntes[comp.id] = 0;
    }
  }

  // Estados visuais
  for (const comp of componentes) {
    if (comp.tipo === 'LED') {
      const vd = (tensoes[`${comp.id}:p1`] ?? 0) - (tensoes[`${comp.id}:p2`] ?? 0);
      const { corrente } = modeloLED(vd, comp.propriedades);
      comp.estado = comp.estado || {};
      comp.estado.aceso = Math.abs(corrente) > 0.001;
    }
    if (comp.tipo === 'DISPLAY_7SEG') {
      comp.estado = comp.estado || {};
      const tipo = comp.propriedades.tipo || 'cátodo comum';
      comp.estado.segmentos = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((pinoId) => {
        const n = pinoParaNo.get(`${comp.id}:${pinoId}`);
        const nc = pinoParaNo.get(`${comp.id}:com`);
        const v = (V[n] ?? 0) - (V[nc] ?? 0);
        if (tipo === 'cátodo comum') return v > 1.5 ? 1 : 0;
        return v < -1.5 ? 1 : 0;
      });
    }
  }

  return {
    tensoes,
    correntes,
    convergiu,
    erro: convergiu ? null : 'O circuito não convergiu. Verifique as conexões e os valores.',
    avisos,
  };
}

export function tensaoEm(resultado, compId, pinoId) {
  return resultado.tensoes[`${compId}:${pinoId}`] ?? 0;
}

export function correnteEm(resultado, compId) {
  return resultado.correntes[compId] ?? 0;
}
