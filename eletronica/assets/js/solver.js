/**
 * solver.js — Resolução elétrica do circuito.
 *
 * Método: análise nodal modificada (MNA) com iteração de Newton-Raphson
 * para elementos não-lineares (diodo, LED, transistor).
 *
 * Modelos:
 * - Resistor, capacitor, indutor: linear (Ohm / admitância complexa simplificada)
 * - Diodo / LED: equação de Shockley
 * - Transistor NPN/PNP: modelo de Ebers-Moll simplificado (ganho β)
 * - Fontes: tensão imposta
 * - Chave: resistência muito baixa (fechada) ou muito alta (aberta)
 * - Portas lógicas: tratadas como fonte de tensão (0 ou Vcc)
 * - Compostos: tratados como sub-circuitos
 *
 * Integração no tempo: Euler implícito com passo adaptativo para
 * capacitores e indutores.
 */

import { CATALOGO } from './catalogo.js';
import { pontosDoFio } from './fios.js';

const VCC_PADRAO = 5;
const TOLERANCIA = 1e-6;
const MAX_ITERACOES = 50;
const DT_PADRAO = 1e-4; // 100 µs por passo
const TEMPO_TOTAL = 0.01; // 10 ms de simulação

/* ===== GRAFO DE NÓS ===== */

/**
 * Constrói o grafo de nós a partir dos fios.
 * Cada componente tem pinos; pinos conectados por fios formam um nó.
 */
function construirNos(circuito) {
  const pai = new Map();

  function encontrar(x) {
    if (!pai.has(x)) pai.set(x, x);
    while (pai.get(x) !== x) {
      pai.set(x, pai.get(pai.get(x)));
      x = pai.get(x);
    }
    return x;
  }

  function unir(a, b) {
    const ra = encontrar(a);
    const rb = encontrar(b);
    if (ra !== rb) pai.set(ra, rb);
  }

  // Cria um nó por pino
  for (const comp of circuito.componentes) {
    for (const pino of comp.pinos) {
      encontrar(`${comp.id}:${pino.id}`);
    }
  }

  // Une pinos conectados por fios
  for (const fio of circuito.fios) {
    unir(
      `${fio.origem.componente}:${fio.origem.pino}`,
      `${fio.destino.componente}:${fio.destino.pino}`
    );
  }

  // Mapeia raiz → índice de nó
  const raizes = new Map();
  const nos = [];
  for (const comp of circuito.componentes) {
    for (const pino of comp.pinos) {
      const raiz = encontrar(`${comp.id}:${pino.id}`);
      if (!raizes.has(raiz)) {
        raizes.set(raiz, nos.length);
        nos.push({ id: nos.length, pinos: [] });
      }
      nos[raizes.get(raiz)].pinos.push({ componente: comp.id, pino: pino.id });
    }
  }

  // Mapa pino → índice de nó
  const pinoParaNo = new Map();
  for (const comp of circuito.componentes) {
    for (const pino of comp.pinos) {
      pinoParaNo.set(`${comp.id}:${pino.id}`, raizes.get(encontrar(`${comp.id}:${pino.id}`)));
    }
  }

  return { nos, pinoParaNo };
}

/* ===== MODELOS DE COMPONENTE ===== */

/** Corrente em um resistor: I = (Va - Vb) / R */
function correnteResistor(va, vb, r) {
  return (va - vb) / Math.max(r, 1e-9);
}

/** Corrente em um diodo: I = Is * (exp(Vd / (n*Vt)) - 1) */
function correnteDiodo(va, vk, vf, is) {
  const vt = 0.026; // tensão térmica a 300K
  const vd = va - vk;
  if (vd < -5) return -is;
  const exp = Math.exp(Math.min(vd / (1.5 * vt), 40));
  return is * (exp - 1);
}

/** Corrente em um transistor NPN (modelo simplificado). */
function correntesNPN(vb, vc, ve, beta, vbe) {
  const vbeReal = vb - ve;
  if (vbeReal < vbe) {
    // Corte
    return { ib: 0, ic: 0, ie: 0 };
  }
  // Ativo direto
  const ib = Math.max(0, (vbeReal - vbe) / 1000); // resistência base aproximada
  const ic = beta * ib;
  const ie = ib + ic;
  return { ib, ic, ie };
}

/** Corrente em um transistor PNP. */
function correntesPNP(vb, vc, ve, beta, vbe) {
  const vebReal = ve - vb;
  if (vebReal < Math.abs(vbe)) {
    return { ib: 0, ic: 0, ie: 0 };
  }
  const ib = Math.max(0, (vebReal - Math.abs(vbe)) / 1000);
  const ic = beta * ib;
  const ie = ib + ic;
  return { ib, ic, ie };
}

/* ===== MONTAGEM DO SISTEMA ===== */

/**
 * Monta o sistema linear G * V = I para o circuito.
 * Retorna { G, I, numNos, numFontes }.
 */
function montarSistema(circuito, nos, pinoParaNo, tensoesAnteriores) {
  const numNos = nos.length;
  const fontes = circuito.componentes.filter(
    (c) => CATALOGO[c.tipo].modelo === 'fonte'
  );
  const numFontes = fontes.length;
  const tamanho = numNos + numFontes;

  const G = Array.from({ length: tamanho }, () => new Array(tamanho).fill(0));
  const I = new Array(tamanho).fill(0);

  // Índice da fonte no sistema
  const indiceFonte = new Map();
  fontes.forEach((f, i) => indiceFonte.set(f.id, numNos + i));

  // Nó de referência (terra) = nó 0
  const noTerra = 0;

  // Adiciona condutâncias
  for (const comp of circuito.componentes) {
    const def = CATALOGO[comp.tipo];
    const modelo = def.modelo;

    if (modelo === 'linear') {
      if (comp.tipo === 'RESISTOR' || comp.tipo === 'POTENCIOMETRO' ||
          comp.tipo === 'LDR' || comp.tipo === 'TERMISTOR') {
        const r = calcularResistencia(comp);
        const g = 1 / Math.max(r, 1e-9);
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        adicionarCondutancia(G, n1, n2, g, noTerra);
      } else if (comp.tipo === 'CAPACITOR') {
        // Euler implícito: C/dt em paralelo com o capacitor
        const c = comp.propriedades.capacitancia;
        const g = c / DT_PADRAO;
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        adicionarCondutancia(G, n1, n2, g, noTerra);
        // Corrente equivalente da tensão anterior
        const vAnt = tensoesAnteriores?.[`${comp.id}`] || 0;
        I[n1] += g * vAnt;
        I[n2] -= g * vAnt;
      } else if (comp.tipo === 'INDUTOR') {
        // Modelo simplificado: resistência série baixa
        const g = 1 / 0.01;
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        adicionarCondutancia(G, n1, n2, g, noTerra);
      } else if (comp.tipo === 'TRANSFORMADOR') {
        // Modelo ideal: relação de espiras
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        const s1 = pinoParaNo.get(`${comp.id}:s1`);
        const s2 = pinoParaNo.get(`${comp.id}:s2`);
        const rel = comp.propriedades.espirasSecundario / comp.propriedades.espirasPrimario;
        // Primário com resistência baixa
        adicionarCondutancia(G, n1, n2, 1000, noTerra);
        // Secundário com resistência baixa
        adicionarCondutancia(G, s1, s2, 1000, noTerra);
      }
    } else if (modelo === 'chave') {
      const fechada = comp.propriedades.fechada === true || comp.propriedades.pressionado === true;
      const g = fechada ? 1e3 : 1e-9;
      const n1 = pinoParaNo.get(`${comp.id}:p1`);
      const n2 = pinoParaNo.get(`${comp.id}:p2`);
      adicionarCondutancia(G, n1, n2, g, noTerra);
    } else if (modelo === 'nao-linear') {
      if (comp.tipo === 'DIODO' || comp.tipo === 'LED' || comp.tipo === 'FOTODIODO') {
        // Linearização em torno da tensão anterior
        const vAnt = tensoesAnteriores?.[comp.id] || 0;
        const vf = comp.propriedades.tensaoDireta || 0.7;
        const is = comp.propriedades.correnteSaturacao || 1e-12;
        const { g, iEq } = linearizarDiodo(vAnt, vf, is);
        const n1 = pinoParaNo.get(`${comp.id}:p1`);
        const n2 = pinoParaNo.get(`${comp.id}:p2`);
        adicionarCondutancia(G, n1, n2, g, noTerra);
        I[n1] += iEq;
        I[n2] -= iEq;
      } else if (comp.tipo === 'TRANSISTOR_NPN' || comp.tipo === 'TRANSISTOR_PNP') {
        // Modelo simplificado: base como resistor, coletor como fonte de corrente
        const beta = comp.propriedades.ganho || 100;
        const gBase = 1 / 1000;
        const nb = pinoParaNo.get(`${comp.id}:b`);
        const nc = pinoParaNo.get(`${comp.id}:c`);
        const ne = pinoParaNo.get(`${comp.id}:e`);
        adicionarCondutancia(G, nb, ne, gBase, noTerra);
        // Coletor-emissor com condutância baixa (saturação)
        adicionarCondutancia(G, nc, ne, 1 / 100, noTerra);
      }
    } else if (modelo === 'fonte') {
      // Fonte de tensão: linha na matriz
      const idx = indiceFonte.get(comp.id);
      const n1 = pinoParaNo.get(`${comp.id}:p1`);
      const n2 = pinoParaNo.get(`${comp.id}:p2`);
      const v = comp.propriedades.tensao || comp.propriedades.amplitude || 5;
      G[idx][n1] += 1;
      G[idx][n2] -= 1;
      G[n1][idx] += 1;
      G[n2][idx] -= 1;
      I[idx] = v;
    } else if (modelo === 'logica') {
      // Porta lógica: saída como fonte de tensão
      const nY = pinoParaNo.get(`${comp.id}:y`);
      const valor = comp.estado?.saida ?? 0;
      const v = valor === 1 ? VCC_PADRAO : 0;
      // Modelo simplificado: condutância baixa para o valor
      adicionarCondutancia(G, nY, noTerra, valor === 1 ? 1e-3 : 1e3, noTerra);
      if (valor === 1) I[nY] += 1e-3 * VCC_PADRAO;
    }
  }

  // Fixa o nó de terra
  G[noTerra][noTerra] = 1;
  I[noTerra] = 0;

  return { G, I, numNos, numFontes };
}

/** Adiciona uma condutância entre dois nós. */
function adicionarCondutancia(G, n1, n2, g, noTerra) {
  if (n1 === n2) return;
  G[n1][n1] += g;
  G[n2][n2] += g;
  G[n1][n2] -= g;
  G[n2][n1] -= g;
}

/** Calcula a resistência efetiva de um componente. */
function calcularResistencia(comp) {
  if (comp.tipo === 'RESISTOR') return comp.propriedades.resistencia;
  if (comp.tipo === 'POTENCIOMETRO') {
    const total = comp.propriedades.resistencia;
    const pos = comp.propriedades.posicao;
    return total * (1 - pos);
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

/** Lineariza o diodo em torno de uma tensão. */
function linearizarDiodo(v, vf, is) {
  const vt = 0.026;
  const vd = Math.max(v, -5);
  const exp = Math.exp(Math.min(vd / (1.5 * vt), 40));
  const i = is * (exp - 1);
  const g = is * exp / (1.5 * vt);
  const iEq = i - g * vd;
  return { g: Math.max(g, 1e-12), iEq };
}

/* ===== RESOLUÇÃO DO SISTEMA ===== */

/** Resolve G * V = I por eliminação de Gauss. */
function resolverGauss(G, I) {
  const n = G.length;
  const A = G.map((row, i) => [...row, I[i]]);

  for (let col = 0; col < n; col++) {
    // Pivô
    let maxIdx = col;
    for (let i = col + 1; i < n; i++) {
      if (Math.abs(A[i][col]) > Math.abs(A[maxIdx][col])) maxIdx = i;
    }
    if (maxIdx !== col) [A[col], A[maxIdx]] = [A[maxIdx], A[col]];

    if (Math.abs(A[col][col]) < 1e-12) continue;

    for (let i = col + 1; i < n; i++) {
      const fator = A[i][col] / A[col][col];
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
    V[i] = Math.abs(A[i][i]) > 1e-12 ? soma / A[i][i] : 0;
  }
  return V;
}

/* ===== API PÚBLICA ===== */

/**
 * Simula o circuito.
 * Retorna { tensoes, correntes, convergiu, erro }.
 */
export function simular(circuito) {
  if (circuito.componentes.length === 0) {
    return { tensoes: {}, correntes: {}, convergiu: true, erro: null };
  }

  const { nos, pinoParaNo } = construirNos(circuito);

  let tensoesAnteriores = {};
  let V = null;

  // Iteração de Newton-Raphson
  for (let iter = 0; iter < MAX_ITERACOES; iter++) {
    const { G, I, numNos } = montarSistema(circuito, nos, pinoParaNo, tensoesAnteriores);
    const Vnovo = resolverGauss(G, I);

    // Verifica convergência
    let maxDelta = 0;
    if (V) {
      for (let i = 0; i < V.length; i++) {
        maxDelta = Math.max(maxDelta, Math.abs(Vnovo[i] - V[i]));
      }
    }
    V = Vnovo;

    // Atualiza tensões anteriores para próxima iteração
    tensoesAnteriores = {};
    for (const comp of circuito.componentes) {
      const n1 = pinoParaNo.get(`${comp.id}:p1`) ?? pinoParaNo.get(`${comp.id}:a`) ?? pinoParaNo.get(`${comp.id}:b`);
      const n2 = pinoParaNo.get(`${comp.id}:p2`) ?? pinoParaNo.get(`${comp.id}:k`) ?? pinoParaNo.get(`${comp.id}:e`);
      if (n1 !== undefined && n2 !== undefined) {
        tensoesAnteriores[comp.id] = V[n1] - V[n2];
      }
    }

    if (iter > 0 && maxDelta < TOLERANCIA) {
      return finalizar(circuito, nos, pinoParaNo, V);
    }
  }

  return {
    ...finalizar(circuito, nos, pinoParaNo, V),
    convergiu: false,
    erro: 'O circuito não convergiu. Verifique as conexões.',
  };
}

/** Empacota o resultado da simulação. */
function finalizar(circuito, nos, pinoParaNo, V) {
  const tensoes = {};
  for (const comp of circuito.componentes) {
    for (const pino of comp.pinos) {
      const n = pinoParaNo.get(`${comp.id}:${pino.id}`);
      tensoes[`${comp.id}:${pino.id}`] = V[n] ?? 0;
    }
  }

  const correntes = {};
  for (const comp of circuito.componentes) {
    const def = CATALOGO[comp.tipo];
    if (def.modelo === 'linear' && comp.pinos.length >= 2) {
      const n1 = pinoParaNo.get(`${comp.id}:${comp.pinos[0].id}`);
      const n2 = pinoParaNo.get(`${comp.id}:${comp.pinos[1].id}`);
      const v = (V[n1] ?? 0) - (V[n2] ?? 0);
      const r = calcularResistencia(comp);
      correntes[comp.id] = v / Math.max(r, 1e-9);
    } else if (comp.tipo === 'DIODO' || comp.tipo === 'LED') {
      const n1 = pinoParaNo.get(`${comp.id}:p1`);
      const n2 = pinoParaNo.get(`${comp.id}:p2`);
      const vd = (V[n1] ?? 0) - (V[n2] ?? 0);
      correntes[comp.id] = correnteDiodo(vd, 0, comp.propriedades.tensaoDireta, comp.propriedades.correnteSaturacao || 1e-12);
    } else {
      correntes[comp.id] = 0;
    }
  }

  // Atualiza estados visuais (LED aceso, display, etc.)
  for (const comp of circuito.componentes) {
    if (comp.tipo === 'LED') {
      const i = correntes[comp.id] || 0;
      comp.estado = comp.estado || {};
      comp.estado.aceso = i > 0.001;
    }
    if (comp.tipo === 'DISPLAY_7SEG') {
      comp.estado = comp.estado || {};
      comp.estado.segmentos = comp.pinos.slice(0, 7).map((p) => {
        const v = tensoes[`${comp.id}:${p.id}`] ?? 0;
        return v > 1.5 ? 1 : 0;
      });
    }
  }

  return { tensoes, correntes, convergiu: true, erro: null };
}

/** Retorna a tensão em um pino. */
export function tensaoEm(resultado, compId, pinoId) {
  return resultado.tensoes[`${compId}:${pinoId}`] ?? 0;
}

/** Retorna a corrente em um componente. */
export function correnteEm(resultado, compId) {
  return resultado.correntes[compId] ?? 0;
}