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
const TOLERANCIA = 1e-4;
const MAX_ITERACOES = 120;
const FATOR_RELAXACAO = 0.1;
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

function ehFonteDeAlimentacao(comp) {
  return ['BATERIA', 'FONTE_AC', 'FONTE_POSITIVA'].includes(comp.tipo);
}

function componenteDependeDeAlimentacao(comp, modelo = CATALOGO[comp.tipo]?.modelo) {
  return modelo === 'logica'
    || (modelo === 'composto' && ['AMP_OP', 'CI_GENERICO'].includes(comp.tipo))
    || ['TRANSISTOR_NPN', 'TRANSISTOR_PNP'].includes(comp.tipo);
}

function componenteAlimentado(comp, pinoParaNo, nosAlimentados) {
  return (comp.pinos || []).some((pino) => (
    nosAlimentados[pinoParaNo.get(`${comp.id}:${pino.id}`)] === true
  ));
}

function chaveFechada(comp) {
  return comp.tipo === 'BOTAO'
    ? comp.propriedades?.pressionado === true
    : comp.propriedades?.fechada === true;
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
  if (tensao == null || !isFinite(tensao)) return 0;
  const vRef = vcc > 0 ? vcc : VCC_PADRAO;
  return tensao >= 0.45 * vRef ? 1 : 0;
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

  for (const comp of componentes) {
    if (!['CHAVE', 'BOTAO'].includes(comp.tipo)) continue;
    unir(`${comp.id}:p1`, `${comp.id}:p1b`);
    unir(`${comp.id}:p2`, `${comp.id}:p2b`);
  }

  for (const comp of componentes) {
    if (comp.tipo !== 'BARRAMENTO' || comp.propriedades?.conectadoInternamente !== true) continue;
    const primeiroPino = comp.pinos[0];
    if (!primeiroPino) continue;
    for (const pino of comp.pinos.slice(1)) {
      unir(`${comp.id}:${primeiroPino.id}`, `${comp.id}:${pino.id}`);
    }
  }

  const chaveTerraGlobal = '__GND_GLOBAL__';
  encontrar(chaveTerraGlobal);
  for (const comp of componentes) {
    if (comp.tipo === 'GND') unir(`${comp.id}:p`, chaveTerraGlobal);
  }

  const raizGlobalFisica = encontrar(chaveTerraGlobal);
  const raizes = new Map([[raizGlobalFisica, 0]]);
  const nos = [{ id: 0, pinos: [], referenciaGlobal: true }];
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

  const noTerraGlobal = 0;

  const ilhaPai = new Map(nos.map((no) => [no.id, no.id]));
  const encontrarIlha = (no) => {
    let raiz = no;
    while (ilhaPai.get(raiz) !== raiz) raiz = ilhaPai.get(raiz);
    while (ilhaPai.get(no) !== raiz) {
      const proximo = ilhaPai.get(no);
      ilhaPai.set(no, raiz);
      no = proximo;
    }
    return raiz;
  };
  const unirIlhas = (nosIlha) => {
    const nosValidos = nosIlha.filter((no) => no !== undefined);
    for (let indice = 1; indice < nosValidos.length; indice++) {
      const raizA = encontrarIlha(nosValidos[0]);
      const raizB = encontrarIlha(nosValidos[indice]);
      if (raizA !== raizB) ilhaPai.set(raizA, raizB);
    }
  };

  for (const comp of componentes) {
    if (comp.tipo === 'BARRAMENTO') {
      if (comp.propriedades?.conectadoInternamente === true) {
        unirIlhas(comp.pinos.map((pino) => pinoParaNo.get(`${comp.id}:${pino.id}`)));
      }
    } else if (comp.tipo === 'TRANSFORMADOR') {
      for (const pinos of [['p1', 'p2'], ['s1', 's2']]) {
        unirIlhas(pinos.map((pino) => pinoParaNo.get(`${comp.id}:${pino}`)));
      }
    } else if (
      CATALOGO[comp.tipo].modelo === 'chave'
      && ['CHAVE', 'CHAVE_SIMPLES', 'BOTAO'].includes(comp.tipo)
    ) {
      if (chaveFechada(comp)) {
        unirIlhas(comp.pinos.map((pino) => pinoParaNo.get(`${comp.id}:${pino.id}`)));
      }
    } else {
      unirIlhas(comp.pinos.map((pino) => pinoParaNo.get(`${comp.id}:${pino.id}`)));
    }
  }

  for (const comp of componentes) {
    if (comp.tipo === 'GND') {
      unirIlhas([pinoParaNo.get(`${comp.id}:p`), noTerraGlobal]);
    } else if (comp.tipo === 'FONTE_POSITIVA') {
      unirIlhas([pinoParaNo.get(`${comp.id}:p`), noTerraGlobal]);
    }
  }

  const fontesPorRaiz = new Map();
  const fontes = componentes
    .filter(ehFonteDeAlimentacao)
    .sort((a, b) => tensaoNominalFonte(b) - tensaoNominalFonte(a) || compararPorId(a, b));
  for (const fonte of fontes) {
    const noNegativo = fonte.tipo === 'FONTE_POSITIVA'
      ? noTerraGlobal
      : pinoParaNo.get(`${fonte.id}:p2`);
    const raiz = encontrarIlha(noNegativo);
    if (!fontesPorRaiz.has(raiz)) {
      fontesPorRaiz.set(raiz, noNegativo);
    }
  }

  const nosTerraPorRaiz = new Map();
  const raizGlobal = encontrarIlha(noTerraGlobal);
  for (const no of nos) {
    const raiz = encontrarIlha(no.id);
    if (!nosTerraPorRaiz.has(raiz)) {
      nosTerraPorRaiz.set(
        raiz,
        raiz === raizGlobal ? noTerraGlobal : fontesPorRaiz.get(raiz) ?? no.id
      );
    }
  }
  const noTerraPorNo = nos.map((no) => nosTerraPorRaiz.get(encontrarIlha(no.id)));
  const raizesAlimentadas = new Set(fontesPorRaiz.keys());
  const nosAlimentados = nos.map((no) => raizesAlimentadas.has(encontrarIlha(no.id)));

  return { nos, pinoParaNo, noTerraPorNo, noTerraGlobal, nosAlimentados };
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
/**
 * Transistor bipolar: modelo robusto com junção base-emissor e canal coletor-emissor controlado.
 * Opera estavelmente em corte, linear e saturação profunda (comportamento de chave ideal).
 */

function linearizarBJT(vbe, vce, beta = 100, isPNP = false) {
  // Para NPN: vbe = Vb - Ve, vce = Vc - Ve
  // Para PNP: vbe = Ve - Vb, vce = Ve - Vc
  const vbeE = isPNP ? -vbe : vbe;
  const vceE = isPNP ? -vce : vce;

  const VF = 0.65;
  const R_OFF = 1e6;
  const RSAT = 5;
  const gOff = 1 / R_OFF;
  const gSat = 1 / RSAT;

  // O transistor só conduz pelo canal coletor-emissor se Vbe >= VF e Vce > 0
  let gCE = gOff;
  let ib = 0;

  if (vbeE >= VF && vceE > 0) {
    // Base ativada
    ib = (vbeE - VF) / 1000; // pequena corrente de controle
    const icMax = beta * ib;
    const vRef = Math.max(vceE, 0.2);
    const gDrive = icMax / vRef;
    gCE = Math.min(gSat, Math.max(gOff, gDrive));
  }

  const iCE = gCE * Math.max(0, vceE);

  return {
    gce: gCE,
    ib,
    ic: iCE,
    ie: iCE,
    isPNP,
  };
}
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

function montarSistema(
  circuito,
  nos,
  pinoParaNo,
  tensoesAnteriores,
  noTerraPorNo,
  nosAlimentados,
  avisos,
  noTerraGlobal
) {
  const numNos = nos.length;
  const componentes = componentesPorId(circuito);
  const fontesTensao = componentes.filter(
    (c) => CATALOGO[c.tipo].modelo === 'fonte' || CATALOGO[c.tipo].modelo === 'fonte-positiva'
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
    if (
      componenteDependeDeAlimentacao(comp, modelo)
      && !componenteAlimentado(comp, pinoParaNo, nosAlimentados)
    ) continue;
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
      } else if (comp.tipo === 'POTENCIOMETRO') {
        const noA = pinoParaNo.get(`${comp.id}:p1`);
        const noB = pinoParaNo.get(`${comp.id}:p2`);
        const noCursor = pinoParaNo.get(`${comp.id}:p3`);
        const cursorConectado = circuito.fios.some((fio) => (
          (fio.origem.componente === comp.id && fio.origem.pino === 'p3')
          || (fio.destino.componente === comp.id && fio.destino.pino === 'p3')
        ));
        if (cursorConectado) {
          const resistenciaConfigurada = Number(comp.propriedades?.resistencia);
          const total = Number.isFinite(resistenciaConfigurada) && resistenciaConfigurada > 0
            ? resistenciaConfigurada
            : 10000;
          const posicaoConfigurada = Number(comp.propriedades?.posicao);
          const posicao = Number.isFinite(posicaoConfigurada)
            ? Math.max(0, Math.min(1, posicaoConfigurada))
            : 0.5;
          const rA = Math.max(total * (1 - posicao), 1);
          const rB = Math.max(total * posicao, 1);
          adicionarCondutancia(G, noA, noCursor, 1 / rA);
          adicionarCondutancia(G, noCursor, noB, 1 / rB);
        } else {
          const r = calcularResistencia(comp);
          adicionarCondutancia(G, noA, noB, 1 / Math.max(r, 1e-9));
        }
      } else if (['LDR', 'TERMISTOR'].includes(comp.tipo)) {
        const r = calcularResistencia(comp);
        adicionarCondutancia(G, pinoParaNo.get(`${comp.id}:p1`), pinoParaNo.get(`${comp.id}:p2`), 1 / Math.max(r, 1e-9));
      } else if (comp.tipo === 'CAPACITOR' || comp.tipo === 'CAPACITOR_NAO_POLARIZADO') {
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        if (comp.tipo === 'CAPACITOR' && comp.propriedades?.rompido === true) {
          adicionarCondutancia(G, n1, n2, 100);
          continue;
        }

        const dano = comp.tipo === 'CAPACITOR'
          ? Math.max(0, Math.min(1, Number(comp.propriedades?.danoPolaridade) || 0))
          : 0;
        const c = Number(comp.propriedades.capacitancia) * Math.max(0.15, 1 - dano * 0.7);
        const dt = 1e-4;
        const g = Math.max(c / dt, G_MIN);
        adicionarCondutancia(G, n1, n2, g);
        adicionarFonteCorrente(I, n1, n2, g * vAnt);
        if (comp.tipo === 'CAPACITOR') {
          const tensaoReversa = Math.max(0, -vAnt);
          const fuga = Math.min(0.1, dano * 0.02 + tensaoReversa * 0.001);
          if (fuga > 0) adicionarCondutancia(G, n1, n2, fuga);
        }
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
        if (chaveFechada(comp)) {
          const noA = pinoParaNo.get(`${comp.id}:p1`);
          const noB = pinoParaNo.get(`${comp.id}:p2`);
          if (noA !== undefined && noB !== undefined && noA !== noB) {
            adicionarCondutancia(G, noA, noB, 1 / 0.001);
          }
        }
      }
    }

    /* ---- CHAVE CONTROLADA POR NÍVEL LÓGICO ---- */
    else if (modelo === 'chave-controlada') {
      const noA = pinoParaNo.get(`${comp.id}:p1`);
      const noB = pinoParaNo.get(`${comp.id}:p2`);
      const noControle = pinoParaNo.get(`${comp.id}:controle`);
      const tensaoControle = tensoesAnteriores[noControle] ?? 0;
      const vcc = Math.max(
        ...circuito.componentes
          .filter(ehFonteDeAlimentacao)
          .map((c) => c.propriedades?.tensao || c.propriedades?.amplitude || 0),
        VCC_PADRAO
      );
      const fechada = tensaoParaLogico(tensaoControle, vcc) === 1;
      const terraControle = noTerraPorNo[noControle];
      if (noControle !== undefined && noControle !== terraControle) {
        adicionarCondutancia(G, noControle, terraControle, 1 / 1e6);
      }
      if (noA !== undefined && noB !== undefined && noA !== noB) {
        adicionarCondutancia(G, noA, noB, 1 / (fechada ? 0.001 : 1e9));
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
        const nb = pinoParaNo.get(`${comp.id}:b`);
        const nc = pinoParaNo.get(`${comp.id}:c`);
        const ne = pinoParaNo.get(`${comp.id}:e`);

        const isPNP = comp.tipo === 'TRANSISTOR_PNP' || comp.tipo === 'PNP';
        const vbeAnt = tensoesAnteriores[`${comp.id}:be`] ?? (isPNP ? -0.6 : 0.6);
        const vceAnt = tensoesAnteriores[`${comp.id}:ce`] ?? (isPNP ? -2.0 : 2.0);

        const r = linearizarBJT(vbeAnt, vceAnt, beta, isPNP);

        // O canal coletor-emissor conduz a corrente da alimentação
        if (!isPNP) {
          // NPN: Canal C -> E
          adicionarCondutancia(G, nc, ne, Math.max(r.gce, G_MIN));
          // Impedância Base-Emissor (1 MΩ) para nó de controle não flutuar
          adicionarCondutancia(G, nb, ne, 1 / 1e6);
        } else {
          // PNP: Canal E -> C
          adicionarCondutancia(G, ne, nc, Math.max(r.gce, G_MIN));
          // Impedância Emissor-Base (1 MΩ) para nó de controle não flutuar
          adicionarCondutancia(G, ne, nb, 1 / 1e6);
        }
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
    } else if (modelo === 'fonte-positiva') {
      const idx = indiceFonte.get(comp.id);
      const nPositivo = pinoParaNo.get(`${comp.id}:p`);
      const nGlobal = noTerraGlobal;
      const v = comp.propriedades.tensao ?? 5;

      G[idx][nPositivo] += 1;
      G[idx][nGlobal] -= 1;
      G[nPositivo][idx] += 1;
      G[nGlobal][idx] -= 1;
      I[idx] = v;
    }

    /* ---- PORTAS LÓGICAS ---- */
    else if (modelo === 'logica') {
      const RESISTENCIA_PULLDOWN = 1e6; // 1 MΩ

      for (const p of comp.pinos.filter((p) => p.id !== 'y')) {
        const no = pinoParaNo.get(`${comp.id}:${p.id}`);
        const terra = noTerraPorNo[no];
        if (no !== undefined && no !== terra) {
          adicionarCondutancia(G, no, terra, 1 / RESISTENCIA_PULLDOWN);
        }
      }

      // Descobre o Vcc do circuito (usa 5V padrão se não houver fonte explícita)
      const vccFonte = Math.max(
        ...circuito.componentes
          .filter(ehFonteDeAlimentacao)
          .map((c) => c.propriedades?.tensao || c.propriedades?.amplitude || 0),
        0
      );
      const vcc = vccFonte > 0 ? vccFonte : VCC_PADRAO;

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
        const terra = noTerraPorNo[noY];
        const vSaida = saida === 1 ? vcc : 0;
        const gSaida = 1 / 100; // 100 Ω de saída
        adicionarCondutancia(G, noY, terra, gSaida);
        adicionarFonteCorrente(I, noY, terra, gSaida * vSaida);
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
        const terraOut = noTerraPorNo[nOut];
        adicionarCondutancia(G, nOut, terraOut, gOut);
        adicionarFonteCorrente(I, nOut, terraOut, gOut * vSaida);

        // Entradas de altíssima impedância (10 MΩ)
        adicionarCondutancia(G, nInm, noTerraPorNo[nInm], 1 / 1e7);
        adicionarCondutancia(G, nInp, noTerraPorNo[nInp], 1 / 1e7);
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
          const terraOut = noTerraPorNo[nOut];
          adicionarCondutancia(G, nOut, terraOut, g);
          adicionarFonteCorrente(I, nOut, terraOut, g * vOut);
        }
      }
    }
  }

  // Uma referência por ilha elétrica evita matrizes singulares em circuitos isolados.
  const referenciasTerra = new Set(noTerraPorNo);
  for (const noTerra of referenciasTerra) {
    for (let indice = 0; indice < tamanho; indice++) {
      G[noTerra][indice] = 0;
      G[indice][noTerra] = 0;
    }
    G[noTerra][noTerra] = 1;
    I[noTerra] = 0;
  }

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
      avisos: [],
    };
  }

  const { nos, pinoParaNo, noTerraPorNo, noTerraGlobal, nosAlimentados } = construirNos(circuito);

  let tensoesAnteriores = {};
  let V = null;
  let Vant = null;
  let convergiu = false;
  const componentes = componentesPorId(circuito);

  for (let iter = 0; iter < MAX_ITERACOES; iter++) {
    const { G, I } = montarSistema(
      circuito,
      nos,
      pinoParaNo,
      tensoesAnteriores,
      noTerraPorNo,
      nosAlimentados,
      avisos,
      noTerraGlobal
    );
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
        tensoesAnteriores[`${comp.id}:ce`] = (V[nc] ?? 0) - (V[ne] ?? 0);
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

  // Considera estável se a variação residual for inferior a 5% ou a 10 mV.
  if (!convergiu && V && Vant) {
    let maxDiffRel = 0;
    let maxDiffAbs = 0;
    for (let i = 0; i < V.length; i++) {
      const ref = Math.max(Math.abs(V[i]), 0.01);
      maxDiffRel = Math.max(maxDiffRel, Math.abs(V[i] - Vant[i]) / ref);
      maxDiffAbs = Math.max(maxDiffAbs, Math.abs(V[i] - Vant[i]));
    }
    if (maxDiffRel < 0.05 || maxDiffAbs < 0.01) {
      convergiu = true;
    }
  }

  let resultado = finalizar(circuito, nos, pinoParaNo, V, convergiu, avisos, nosAlimentados);
  atualizarEstadoCapacitoresPolarizados(circuito, resultado);

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
      const { G, I } = montarSistema(
        circuito,
        nos,
        pinoParaNo,
        tensoesPos,
        noTerraPorNo,
        nosAlimentados,
        avisosPos,
        noTerraGlobal
      );
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
      let maxDiffAbs = 0;
      for (let i = 0; i < Vpos.length; i++) {
        const ref = Math.max(Math.abs(Vpos[i]), 0.01);
        maxDiffRel = Math.max(maxDiffRel, Math.abs(Vpos[i] - VposAnt[i]) / ref);
        maxDiffAbs = Math.max(maxDiffAbs, Math.abs(Vpos[i] - VposAnt[i]));
      }
      if (maxDiffRel < 0.05 || maxDiffAbs < 0.01) convPos = true;
    }
    resultado = finalizar(
      circuito,
      nos,
      pinoParaNo,
      Vpos,
      convPos,
      [...avisosPos, ...avisosQueima],
      nosAlimentados
    );
    resultado.queimouFusivel = true;
  }

  return resultado;
}

function finalizar(circuito, nos, pinoParaNo, V, convergiu, avisos, nosAlimentados) {
  const tensoes = {};
  const componentes = componentesPorId(circuito);
  for (const comp of componentes) {
    for (const pino of comp.pinos) {
      const n = pinoParaNo.get(`${comp.id}:${pino.id}`);
      tensoes[`${comp.id}:${pino.id}`] = nosAlimentados[n] ? V[n] ?? 0 : null;
    }
  }

  const correntes = {};
  for (const comp of componentes) {
    if (!componenteAlimentado(comp, pinoParaNo, nosAlimentados)) {
      correntes[comp.id] = 0;
      continue;
    }

    const def = CATALOGO[comp.tipo];
    if (comp.tipo === 'CAPACITOR' || comp.tipo === 'CAPACITOR_NAO_POLARIZADO') {
      const n1 = pinoParaNo.get(`${comp.id}:p1`);
      const n2 = pinoParaNo.get(`${comp.id}:p2`);
      const tensao = (V[n1] ?? 0) - (V[n2] ?? 0);
      if (comp.tipo === 'CAPACITOR' && comp.propriedades?.rompido === true) {
        correntes[comp.id] = tensao * 100;
      } else if (comp.tipo === 'CAPACITOR') {
        const dano = Math.max(0, Math.min(1, Number(comp.propriedades?.danoPolaridade) || 0));
        const reversa = Math.max(0, -tensao);
        const fuga = Math.min(0.1, dano * 0.02 + reversa * 0.001);
        correntes[comp.id] = tensao * fuga;
      } else {
        correntes[comp.id] = 0;
      }
    } else if (def.modelo === 'linear' && comp.pinos.length >= 2) {
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
      const vce = (V[nc] ?? 0) - (V[ne] ?? 0);
      const beta = comp.propriedades.ganho || 100;
      const isPNP = comp.tipo === 'TRANSISTOR_PNP' || comp.tipo === 'PNP';
      const r = linearizarBJT(vbe, vce, beta, isPNP);
      correntes[comp.id] = r.ic;
    } else {
      correntes[comp.id] = 0;
    }
  }

  // Determina o Vcc para níveis lógicos
  const vccFonte = Math.max(
    ...componentes
      .filter(ehFonteDeAlimentacao)
      .map((c) => c.propriedades?.tensao || c.propriedades?.amplitude || 0),
    0
  );
  const vcc = vccFonte > 0 ? vccFonte : VCC_PADRAO;

  // Estados visuais e níveis lógicos dos pinos
  for (const comp of componentes) {
    const def = CATALOGO[comp.tipo];
    if (!componenteAlimentado(comp, pinoParaNo, nosAlimentados)) {
      for (const pino of comp.pinos || []) pino.valor = null;
      if (def?.modelo === 'logica') {
        comp.estado = { ...comp.estado, saida: null };
      }
      if (comp.tipo === 'LED') {
        comp.estado = {
          ...comp.estado,
          corrente: 0,
          intensidade: 0,
          aceso: false,
          sobrecorrente: false,
        };
      }
      if (def?.modelo === 'chave-controlada') {
        comp.estado = { ...comp.estado, condutora: false };
      }
      if (comp.tipo === 'DISPLAY_7SEG') {
        comp.estado = { ...comp.estado, segmentos: Array(7).fill(0) };
      }
      continue;
    }

    if (def?.modelo === 'logica') {
      const entradas = comp.pinos
        .filter((p) => p.id !== 'y')
        .map((p) => {
          const tensao = tensoes[`${comp.id}:${p.id}`] ?? 0;
          const val = tensaoParaLogico(tensao, vcc);
          p.valor = val;
          return val;
        });
      const saida = avaliarPorta(comp.tipo, entradas);
      comp.estado = comp.estado || {};
      comp.estado.saida = saida;
      const pY = comp.pinos.find((p) => p.id === 'y');
      if (pY) pY.valor = saida;
    } else {
      for (const p of comp.pinos || []) {
        const tensao = tensoes[`${comp.id}:${p.id}`];
        if (tensao !== undefined && isFinite(tensao)) {
          p.valor = tensaoParaLogico(tensao, vcc);
        } else {
          p.valor = null;
        }
      }
    }

    if (comp.tipo === 'LED') {
      const vd = (tensoes[`${comp.id}:p1`] ?? 0) - (tensoes[`${comp.id}:p2`] ?? 0);
      const { corrente } = modeloLED(vd, comp.propriedades);
      const nominalConfigurada = Number(comp.propriedades?.correnteNominal);
      const correnteNominal = Number.isFinite(nominalConfigurada) && nominalConfigurada > 0
        ? nominalConfigurada
        : 0.02;
      const correnteMinima = Math.min(0.0001, correnteNominal * 0.01);
      const correnteDireta = vd > 0 ? Math.max(0, corrente) : 0;
      const t = Math.max(
        0,
        Math.min(1, (correnteDireta - correnteMinima) / (correnteNominal - correnteMinima))
      );
      const curva = Math.pow(t, 0.65);
      const intensidade = correnteDireta < correnteMinima ? 0 : curva;

      comp.estado = comp.estado || {};
      comp.estado.corrente = correnteDireta;
      comp.estado.intensidade = intensidade;
      comp.estado.aceso = intensidade > 0;
      comp.estado.sobrecorrente = correnteDireta > correnteNominal;

      if (comp.estado.sobrecorrente) {
        const nome = comp.nomeCustom || CATALOGO[comp.tipo]?.rotulo || 'LED';
        avisos.push(
          `Sobrecorrente no ${nome}: ${(correnteDireta * 1000).toFixed(1)} mA excede a corrente nominal de ${(correnteNominal * 1000).toFixed(1)} mA.`
        );
      }
    }
    if (def?.modelo === 'chave-controlada') {
      const noControle = pinoParaNo.get(`${comp.id}:controle`);
      comp.estado = comp.estado || {};
      comp.estado.condutora = tensaoParaLogico(V[noControle] ?? 0, vcc) === 1;
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

function atualizarEstadoCapacitoresPolarizados(circuito, resultado) {
  const agora = Date.now();
  for (const comp of circuito.componentes) {
    if (comp.tipo !== 'CAPACITOR') continue;
    const tensaoPositiva = resultado.tensoes[`${comp.id}:p1`];
    const tensaoNegativa = resultado.tensoes[`${comp.id}:p2`];
    if (tensaoPositiva == null || tensaoNegativa == null) continue;

    const reversa = Math.max(0, tensaoNegativa - tensaoPositiva);
    const estadoAnterior = comp.estado || {};
    const instanteAnterior = Number(estadoAnterior.instantePolaridade) || agora;
    const intervalo = Math.max(0, Math.min(1, (agora - instanteAnterior) / 1000));
    let dano = Math.max(0, Math.min(1, Number(comp.propriedades.danoPolaridade) || 0));
    const fuga = comp.propriedades.rompido
      ? reversa * 100
      : reversa * Math.min(0.1, dano * 0.02 + reversa * 0.001);

    if (reversa > 0.05 && intervalo > 0) {
      if (reversa < 1) {
        dano = Math.min(0.35, dano + intervalo * reversa * 0.003);
      } else {
        dano = Math.min(1, dano + intervalo * ((reversa - 0.8) ** 2) / 1200);
      }
    }

    comp.propriedades.danoPolaridade = dano;
    if (dano >= 1) comp.propriedades.rompido = true;
    comp.estado = {
      ...estadoAnterior,
      instantePolaridade: agora,
      tensaoReversa: reversa,
      danoPolaridade: dano,
      aquecendo: reversa > 0.05,
      correnteFuga: fuga,
      temperaturaInternaC: 25 + reversa * 8 + dano * 120,
      pressaoInternaRelativa: Math.min(100, reversa * 2 + dano * 100),
      vazando: dano >= 0.45,
      rompido: comp.propriedades.rompido === true,
      statusDano: comp.propriedades.rompido
        ? 'rompido'
        : dano >= 0.45
          ? 'vazando'
          : dano >= 0.15
            ? 'danificado'
            : reversa > 0.05
              ? 'invertido'
              : 'integro',
    };

    if (reversa > 0.05) {
      resultado.avisos.push(
        `Polaridade invertida no capacitor: ${reversa.toFixed(2)} V reversos.`
      );
    }
    if (comp.estado.rompido) {
      resultado.avisos.push('Capacitor polarizado rompido por inversão de polaridade; o componente está em curto.');
    } else if (dano >= 0.15) {
      resultado.avisos.push('O capacitor polarizado sofreu dano: capacitância reduzida e fuga elevada.');
    }
  }
}

export function tensaoEm(resultado, compId, pinoId) {
  return resultado.tensoes[`${compId}:${pinoId}`] ?? 0;
}

export function correnteEm(resultado, compId) {
  return resultado.correntes[compId] ?? 0;
}
