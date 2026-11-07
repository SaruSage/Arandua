import { boundsDoComponente } from './grupos.js';
import { posicaoPino } from './simbolos.js';

const PASSO = 20;
const MARGEM_OBSTACULO = 8;

function valorChave(valor) {
  return Math.round(valor * 1000) / 1000;
}

function inserirOrdenado(valores, valor) {
  const normalizado = valorChave(valor);
  if (!valores.includes(normalizado)) valores.push(normalizado);
}

function segmentosSobrepostos(a, b) {
  if (Math.abs(a.inicio.y - a.fim.y) < 1e-6
    && Math.abs(b.inicio.y - b.fim.y) < 1e-6
    && Math.abs(a.inicio.y - b.inicio.y) < 1e-6) {
    return Math.max(
      Math.min(a.inicio.x, a.fim.x),
      Math.min(b.inicio.x, b.fim.x)
    ) < Math.min(
      Math.max(a.inicio.x, a.fim.x),
      Math.max(b.inicio.x, b.fim.x)
    ) - 1e-6;
  }
  if (Math.abs(a.inicio.x - a.fim.x) < 1e-6
    && Math.abs(b.inicio.x - b.fim.x) < 1e-6
    && Math.abs(a.inicio.x - b.inicio.x) < 1e-6) {
    return Math.max(
      Math.min(a.inicio.y, a.fim.y),
      Math.min(b.inicio.y, b.fim.y)
    ) < Math.min(
      Math.max(a.inicio.y, a.fim.y),
      Math.max(b.inicio.y, b.fim.y)
    ) - 1e-6;
  }
  return false;
}

function segmentoAtravessaRetangulo(inicio, fim, retangulo) {
  const dentro = (ponto) =>
    ponto.x > retangulo.x + 1e-6
    && ponto.x < retangulo.x + retangulo.w - 1e-6
    && ponto.y > retangulo.y + 1e-6
    && ponto.y < retangulo.y + retangulo.h - 1e-6;

  if (dentro(inicio) || dentro(fim)) return true;
  const deltaX = fim.x - inicio.x;
  const deltaY = fim.y - inicio.y;
  let tMin = 0;
  let tMax = 1;
  for (const [posicao, delta, minimo, maximo] of [
    [inicio.x, deltaX, retangulo.x + 1e-6, retangulo.x + retangulo.w - 1e-6],
    [inicio.y, deltaY, retangulo.y + 1e-6, retangulo.y + retangulo.h - 1e-6],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (posicao <= minimo || posicao >= maximo) return false;
      continue;
    }
    const t1 = (minimo - posicao) / delta;
    const t2 = (maximo - posicao) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin >= tMax) return false;
  }
  return tMax > 0 && tMin < 1;
}

function expandirBounds(bounds, margem) {
  return {
    x: bounds.x - margem,
    y: bounds.y - margem,
    w: bounds.w + margem * 2,
    h: bounds.h + margem * 2,
  };
}

function pontosDeSaida(componente, ponto, alvo) {
  const bounds = expandirBounds(boundsDoComponente(componente), MARGEM_OBSTACULO);
  const candidatos = [
    { x: bounds.x - 12, y: ponto.y, diagonal: false },
    { x: bounds.x + bounds.w + 12, y: ponto.y, diagonal: false },
    { x: ponto.x, y: bounds.y - 12, diagonal: false },
    { x: ponto.x, y: bounds.y + bounds.h + 12, diagonal: false },
    { x: bounds.x - 12, y: bounds.y - 12, diagonal: true },
    { x: bounds.x + bounds.w + 12, y: bounds.y - 12, diagonal: true },
    { x: bounds.x - 12, y: bounds.y + bounds.h + 12, diagonal: true },
    { x: bounds.x + bounds.w + 12, y: bounds.y + bounds.h + 12, diagonal: true },
  ].map((saida) => ({
    x: valorChave(saida.x),
    y: valorChave(saida.y),
    diagonal: saida.diagonal,
    distancia: Math.hypot(saida.x - ponto.x, saida.y - ponto.y),
    alinhamento: Math.hypot(saida.x - ponto.x - (alvo.x - ponto.x), saida.y - ponto.y - (alvo.y - ponto.y)),
  }));
  candidatos.sort((a, b) =>
    Number(a.diagonal) - Number(b.diagonal)
    || a.distancia - b.distancia
    || a.alinhamento - b.alinhamento
  );
  return candidatos;
}

function criarHeap() {
  const itens = [];
  return {
    inserir(item) {
      itens.push(item);
      let indice = itens.length - 1;
      while (indice > 0) {
        const pai = Math.floor((indice - 1) / 2);
        if (itens[pai].prioridade <= item.prioridade) break;
        itens[indice] = itens[pai];
        indice = pai;
      }
      itens[indice] = item;
    },
    remover() {
      if (itens.length === 0) return null;
      const primeiro = itens[0];
      const ultimo = itens.pop();
      if (itens.length > 0) {
        let indice = 0;
        while (true) {
          const esquerda = indice * 2 + 1;
          const direita = esquerda + 1;
          if (esquerda >= itens.length) break;
          const menor = direita < itens.length
            && itens[direita].prioridade < itens[esquerda].prioridade
            ? direita
            : esquerda;
          if (itens[menor].prioridade >= ultimo.prioridade) break;
          itens[indice] = itens[menor];
          indice = menor;
        }
        itens[indice] = ultimo;
      }
      return primeiro;
    },
    get vazio() {
      return itens.length === 0;
    },
  };
}

function simplificarPontos(pontos) {
  const simplificados = [];
  for (const ponto of pontos) {
    const anterior = simplificados[simplificados.length - 1];
    if (anterior && Math.hypot(anterior.x - ponto.x, anterior.y - ponto.y) < 1e-6) {
      continue;
    }
    simplificados.push(ponto);
    while (simplificados.length >= 3) {
      const a = simplificados[simplificados.length - 3];
      const b = simplificados[simplificados.length - 2];
      const c = simplificados[simplificados.length - 1];
      if ((Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - c.x) < 1e-6)
        || (Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - c.y) < 1e-6)) {
        simplificados.splice(simplificados.length - 2, 1);
      } else {
        break;
      }
    }
  }
  return simplificados;
}

function buscarRota(inicio, fim, obstaculos, segmentosExistentes, limites) {
  const xs = [];
  const ys = [];
  for (let x = Math.floor(limites.minX / PASSO) * PASSO; x <= limites.maxX; x += PASSO) {
    inserirOrdenado(xs, x);
  }
  for (let y = Math.floor(limites.minY / PASSO) * PASSO; y <= limites.maxY; y += PASSO) {
    inserirOrdenado(ys, y);
  }
  for (const ponto of [inicio, fim]) {
    inserirOrdenado(xs, ponto.x);
    inserirOrdenado(ys, ponto.y);
  }
  for (const obstaculo of obstaculos) {
    inserirOrdenado(xs, obstaculo.x);
    inserirOrdenado(xs, obstaculo.x + obstaculo.w);
    inserirOrdenado(ys, obstaculo.y);
    inserirOrdenado(ys, obstaculo.y + obstaculo.h);
  }
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);

  const xIndice = new Map(xs.map((x, indice) => [x, indice]));
  const yIndice = new Map(ys.map((y, indice) => [y, indice]));
  const nx = xs.length;
  const ny = ys.length;
  const inicioNo = xIndice.get(inicio.x) * ny + yIndice.get(inicio.y);
  const fimNo = xIndice.get(fim.x) * ny + yIndice.get(fim.y);
  const chaveEstado = (no, direcao) => no * 5 + direcao;
  const prioridade = criarHeap();
  const custos = new Map();
  const anteriores = new Map();
  const estadoInicial = chaveEstado(inicioNo, 4);
  custos.set(estadoInicial, 0);
  prioridade.inserir({
    estado: estadoInicial,
    no: inicioNo,
    direcao: 4,
    custo: 0,
    prioridade: Math.abs(inicio.x - fim.x) + Math.abs(inicio.y - fim.y),
  });
  const cacheArestas = new Map();

  function arestaLivre(a, b) {
    const chave = `${a.x},${a.y}:${b.x},${b.y}`;
    if (cacheArestas.has(chave)) return cacheArestas.get(chave);
    const livre = !obstaculos.some((obstaculo) =>
      segmentoAtravessaRetangulo(a, b, obstaculo)
    ) && !segmentosExistentes.some((segmento) =>
      segmentosSobrepostos({ inicio: a, fim: b }, segmento)
    );
    cacheArestas.set(chave, livre);
    return livre;
  }

  let estadoFinal = null;
  while (!prioridade.vazio) {
    const atual = prioridade.remover();
    const melhorCusto = custos.get(atual.estado);
    if (melhorCusto === undefined || melhorCusto !== atual.custo) continue;
    if (atual.no === fimNo) {
      estadoFinal = atual.estado;
      break;
    }
    const xi = Math.floor(atual.no / ny);
    const yi = atual.no % ny;
    const vizinhos = [
      xi > 0 ? [atual.no - ny, 0] : null,
      xi + 1 < nx ? [atual.no + ny, 1] : null,
      yi > 0 ? [atual.no - 1, 2] : null,
      yi + 1 < ny ? [atual.no + 1, 3] : null,
    ];
    const pontoAtual = { x: xs[xi], y: ys[yi] };

    for (const vizinho of vizinhos) {
      if (!vizinho) continue;
      const [no, novaDirecao] = vizinho;
      const xj = Math.floor(no / ny);
      const yj = no % ny;
      const pontoVizinho = { x: xs[xj], y: ys[yj] };
      if (!arestaLivre(pontoAtual, pontoVizinho)) continue;

      const estado = chaveEstado(no, novaDirecao);
      const distancia = Math.abs(pontoAtual.x - pontoVizinho.x)
        + Math.abs(pontoAtual.y - pontoVizinho.y);
      const custo = melhorCusto + distancia
        + (atual.direcao !== 4 && atual.direcao !== novaDirecao ? 18 : 0);
      if (custo >= (custos.get(estado) ?? Infinity)) continue;
      custos.set(estado, custo);
      anteriores.set(estado, atual.estado);
      prioridade.inserir({
        estado,
        no,
        direcao: novaDirecao,
        custo,
        prioridade: custo + Math.abs(pontoVizinho.x - fim.x) + Math.abs(pontoVizinho.y - fim.y),
      });
    }
  }

  if (estadoFinal === null) return null;
  const caminho = [];
  let estado = estadoFinal;
  while (estado !== undefined) {
    const no = Math.floor(estado / 5);
    const xi = Math.floor(no / ny);
    const yi = no % ny;
    caminho.push({ x: xs[xi], y: ys[yi] });
    estado = anteriores.get(estado);
  }
  caminho.reverse();
  return simplificarPontos(caminho);
}

function pontosFioExistente(fio, componentes) {
  const origem = componentes.get(fio.origem.componente);
  const destino = componentes.get(fio.destino.componente);
  if (!origem || !destino) return [];
  const inicio = posicaoPino(origem, fio.origem.pino);
  const fim = posicaoPino(destino, fio.destino.pino);
  if (!inicio || !fim) return [];
  if (fio.dobras?.length) return [inicio, ...fio.dobras, fim];

  const dx = Math.abs(fim.x - inicio.x);
  const dy = Math.abs(fim.y - inicio.y);
  if (dx < 1 || dy < 1) return [inicio, fim];
  return dx > dy
    ? [inicio, { x: fim.x, y: inicio.y }, fim]
    : [inicio, { x: inicio.x, y: fim.y }, fim];
}

export function rotearFios(circuito, fiosParaRoteamento = circuito.fios) {
  const componentes = new Map(circuito.componentes.map((comp) => [comp.id, comp]));
  const fiosAlvo = new Set(fiosParaRoteamento);
  const bounds = circuito.componentes.map((comp) => boundsDoComponente(comp));
  const todosPontos = circuito.fios.flatMap((fio) => {
    const origem = componentes.get(fio.origem.componente);
    const destino = componentes.get(fio.destino.componente);
    return origem && destino
      ? [posicaoPino(origem, fio.origem.pino), posicaoPino(destino, fio.destino.pino)]
      : [];
  }).filter(Boolean);
  if (bounds.length === 0 || circuito.fios.length === 0) return;

  const margem = 100;
  const limites = {
    minX: Math.min(...bounds.map((b) => b.x), ...todosPontos.map((p) => p.x)) - margem,
    maxX: Math.max(...bounds.map((b) => b.x + b.w), ...todosPontos.map((p) => p.x)) + margem,
    minY: Math.min(...bounds.map((b) => b.y), ...todosPontos.map((p) => p.y)) - margem,
    maxY: Math.max(...bounds.map((b) => b.y + b.h), ...todosPontos.map((p) => p.y)) + margem,
  };
  const obstaculos = circuito.componentes.map((comp) =>
    expandirBounds(boundsDoComponente(comp), MARGEM_OBSTACULO)
  );
  const segmentosRoteados = [];
  for (const fio of circuito.fios) {
    if (fiosAlvo.has(fio)) continue;
    const pontos = pontosFioExistente(fio, componentes);
    for (let indice = 0; indice < pontos.length - 1; indice++) {
      segmentosRoteados.push({ inicio: pontos[indice], fim: pontos[indice + 1] });
    }
  }

  const fiosOrdenados = [...fiosAlvo].sort((a, b) => {
    const origemA = componentes.get(a.origem.componente);
    const destinoA = componentes.get(a.destino.componente);
    const origemB = componentes.get(b.origem.componente);
    const destinoB = componentes.get(b.destino.componente);
    const distancia = (origem, destino, fio) => {
      if (!origem || !destino) return Infinity;
      const pinoOrigem = posicaoPino(origem, fio.origem.pino);
      const pinoDestino = posicaoPino(destino, fio.destino.pino);
      return Math.hypot(pinoOrigem.x - pinoDestino.x, pinoOrigem.y - pinoDestino.y);
    };
    return distancia(origemA, destinoA, a) - distancia(origemB, destinoB, b)
      || String(a.id).localeCompare(String(b.id));
  });

  for (const fio of fiosOrdenados) {
    const origem = componentes.get(fio.origem.componente);
    const destino = componentes.get(fio.destino.componente);
    if (!origem || !destino) {
      throw new Error(`Não foi possível rotear o fio ${fio.id}: terminal inexistente.`);
    }
    const pinoOrigem = posicaoPino(origem, fio.origem.pino);
    const pinoDestino = posicaoPino(destino, fio.destino.pino);
    if (!pinoOrigem || !pinoDestino) {
      throw new Error(`Não foi possível rotear o fio ${fio.id}: pino inexistente.`);
    }
    const saidasOrigem = pontosDeSaida(origem, pinoOrigem, pinoDestino);
    const saidasDestino = pontosDeSaida(destino, pinoDestino, pinoOrigem);
    let pontos = null;
    for (const inicio of saidasOrigem) {
      const segmentoInicio = { inicio: pinoOrigem, fim: inicio };
      if (circuito.componentes.some((comp) =>
        comp.id !== origem.id
        && segmentoAtravessaRetangulo(pinoOrigem, inicio, expandirBounds(boundsDoComponente(comp), MARGEM_OBSTACULO))
      ) || segmentosRoteados.some((segmento) =>
        segmentosSobrepostos(segmentoInicio, segmento)
      )) continue;
      for (const fim of saidasDestino) {
        const segmentoFim = { inicio: fim, fim: pinoDestino };
        if (circuito.componentes.some((comp) =>
          comp.id !== destino.id
          && segmentoAtravessaRetangulo(fim, pinoDestino, expandirBounds(boundsDoComponente(comp), MARGEM_OBSTACULO))
        ) || segmentosRoteados.some((segmento) =>
          segmentosSobrepostos(segmentoFim, segmento)
        )) continue;
        const limitesLocais = {
          minX: Math.min(inicio.x, fim.x) - 100,
          maxX: Math.max(inicio.x, fim.x) + 100,
          minY: Math.min(inicio.y, fim.y) - 100,
          maxY: Math.max(inicio.y, fim.y) + 100,
        };
        const obstaculosLocais = obstaculos.filter((obstaculo) =>
          obstaculo.x <= limitesLocais.maxX
          && obstaculo.x + obstaculo.w >= limitesLocais.minX
          && obstaculo.y <= limitesLocais.maxY
          && obstaculo.y + obstaculo.h >= limitesLocais.minY
        );
        const segmentosLocais = segmentosRoteados.filter((segmento) =>
          Math.max(segmento.inicio.x, segmento.fim.x) >= limitesLocais.minX
          && Math.min(segmento.inicio.x, segmento.fim.x) <= limitesLocais.maxX
          && Math.max(segmento.inicio.y, segmento.fim.y) >= limitesLocais.minY
          && Math.min(segmento.inicio.y, segmento.fim.y) <= limitesLocais.maxY
        );
        let caminho = buscarRota(inicio, fim, obstaculosLocais, [
          ...segmentosLocais,
          segmentoInicio,
        ], limitesLocais);
        if (!caminho) {
          caminho = buscarRota(inicio, fim, obstaculos, [
            ...segmentosRoteados,
            segmentoInicio,
          ], limites);
        }
        if (!caminho) continue;
        const candidato = simplificarPontos([pinoOrigem, ...caminho, pinoDestino]);
        const segmentos = candidato.slice(1).map((ponto, indice) => ({
          inicio: candidato[indice],
          fim: ponto,
        }));
        if (segmentos.some((segmento) =>
          segmentosRoteados.some((existente) => segmentosSobrepostos(segmento, existente))
        )) {
          continue;
        }
        pontos = candidato;
        break;
      }
      if (pontos) break;
    }

    if (!pontos) {
      throw new Error(
        `Não foi encontrada rota sem colisões para o fio ${fio.id} `
        + `(${origem.tipo}.${fio.origem.pino} ${JSON.stringify(pinoOrigem)} → `
        + `${destino.tipo}.${fio.destino.pino} ${JSON.stringify(pinoDestino)}).`
      );
    }
    fio.dobras = pontos.slice(1, -1).map((ponto) => ({ ...ponto }));
    for (let indice = 0; indice < pontos.length - 1; indice++) {
      segmentosRoteados.push({ inicio: pontos[indice], fim: pontos[indice + 1] });
    }
  }
}
