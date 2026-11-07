/**
 * construir.js — Motor de detecção e substituição de circuitos equivalentes.
 */

import { CATALOGO } from './catalogo.js';
import { adicionarComponente, removerComponente } from './circuito.js';
import { registrar } from './historico.js';
import { boundsDoComponente, recalcularMembros, atualizarTodosBounds } from './grupos.js';
import { EXEMPLOS_CIRCUITOS } from './exemplos.js';
import { RECEITAS_MONTAGEM } from './montagem.js';
import { MONTAGENS } from './montagens.js';

/**
 * Assinaturas de circuitos equivalentes reconhecíveis.
 * Apenas circuitos cujos alvos existem no catálogo do projeto estão ativos.
 * (Alvos RETIFICADOR, FILTRO_RC e DIVISOR_TENSAO foram desativados por não existirem no catálogo).
 */
export const ASSINATURAS_CIRCUITO = [
  {
    alvo: 'AND',
    nome: 'Porta AND',
    tipos: ['CHAVE', 'CHAVE'],
    descricao: 'Duas chaves em série equivalentes a uma porta AND de duas entradas.',
  },
  {
    alvo: 'OR',
    nome: 'Porta OR',
    tipos: ['CHAVE', 'CHAVE'],
    descricao: 'Duas chaves em paralelo equivalentes a uma porta OR de duas entradas.',
  },
  {
    alvo: 'AND',
    nome: 'Porta AND',
    tipos: ['TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Dois transistores NPN em série equivalentes a uma porta AND industrial.',
  },
  {
    alvo: 'OR',
    nome: 'Porta OR',
    tipos: ['TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Dois transistores NPN em paralelo equivalentes a uma porta OR industrial.',
  },
  {
    alvo: 'AND',
    nome: 'Porta AND',
    tipos: ['RESISTOR', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL em série equivalente a uma porta AND.',
  },
  {
    alvo: 'OR',
    nome: 'Porta OR',
    tipos: ['RESISTOR', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL em paralelo equivalente a uma porta OR.',
  },
  {
    alvo: 'AND',
    nome: 'Porta AND',
    tipos: ['BATERIA', 'RESISTOR', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL completo em série equivalente a uma porta AND.',
  },
  {
    alvo: 'OR',
    nome: 'Porta OR',
    tipos: ['BATERIA', 'RESISTOR', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL completo em paralelo equivalente a uma porta OR.',
  },
  {
    alvo: 'AND',
    nome: 'Porta AND',
    tipos: ['NO', 'NO', 'NO', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL com nós de E/S equivalente a uma porta AND.',
  },
  {
    alvo: 'OR',
    nome: 'Porta OR',
    tipos: ['NO', 'NO', 'NO', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL com nós de E/S equivalente a uma porta OR.',
  },
  {
    alvo: 'AND',
    nome: 'Porta AND',
    tipos: ['NO', 'NO', 'NO', 'RESISTOR', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL com nós de E/S equivalente a uma porta AND.',
  },
  {
    alvo: 'OR',
    nome: 'Porta OR',
    tipos: ['NO', 'NO', 'NO', 'RESISTOR', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL com nós de E/S equivalente a uma porta OR.',
  },
  {
    alvo: 'AND',
    nome: 'Porta AND',
    tipos: ['BATERIA', 'NO', 'NO', 'NO', 'RESISTOR', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL completo com nós de E/S equivalente a uma porta AND.',
  },
  {
    alvo: 'OR',
    nome: 'Porta OR',
    tipos: ['BATERIA', 'NO', 'NO', 'NO', 'RESISTOR', 'TRANSISTOR_NPN', 'TRANSISTOR_NPN'],
    descricao: 'Esquema industrial RTL completo com nós de E/S equivalente a uma porta OR.',
  },
];

const ALVOS_EXEMPLOS = new Map([
  ['and', 'AND'],
  ['or', 'OR'],
  ['not', 'NOT'],
  ['nand', 'NAND'],
  ['nor', 'NOR'],
]);

function contarTipos(componentes) {
  return componentes.reduce((contagens, componente) => {
    contagens[componente.tipo] = (contagens[componente.tipo] || 0) + 1;
    return contagens;
  }, {});
}

function mesmasContagens(a, b) {
  const tipos = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...tipos].every((tipo) => (a[tipo] || 0) === (b[tipo] || 0));
}

function contemContagens(contagensDisponiveis, contagensNecessarias) {
  return Object.entries(contagensNecessarias)
    .every(([tipo, quantidade]) => (contagensDisponiveis[tipo] || 0) >= quantidade);
}

function mapaComponentesExemplo(exemplo, componentes) {
  const porTipo = new Map();
  for (const componente of componentes) {
    if (!porTipo.has(componente.tipo)) porTipo.set(componente.tipo, []);
    porTipo.get(componente.tipo).push(componente);
  }

  const mapa = new Map();
  const definicoesPorTipo = new Map();
  for (const definicao of exemplo.componentes) {
    if (!definicoesPorTipo.has(definicao.tipo)) definicoesPorTipo.set(definicao.tipo, []);
    definicoesPorTipo.get(definicao.tipo).push(definicao);
  }
  for (const [tipo, definicoes] of definicoesPorTipo) {
    const instancias = porTipo.get(tipo) || [];
    definicoes.forEach((definicao, indice) => mapa.set(definicao.ref, instancias[indice]));
  }
  return mapa;
}

function mapearTerminaisLogicos(mapeamento, mapa) {
  const terminais = {};
  for (const [logica, terminal] of Object.entries(mapeamento || {})) {
    const componente = mapa.get(terminal.ref);
    if (componente) terminais[`${componente.id}:${terminal.pino}`] = logica;
  }
  return terminais;
}

function mapaComponentesReceita(pecas, componentes) {
  const mapa = new Map();
  const porTipo = new Map();
  for (const componente of componentes) {
    if (!porTipo.has(componente.tipo)) porTipo.set(componente.tipo, []);
    porTipo.get(componente.tipo).push(componente);
  }

  const definicoesPorTipo = new Map();
  for (const peca of pecas) {
    if (!definicoesPorTipo.has(peca.tipo)) definicoesPorTipo.set(peca.tipo, []);
    definicoesPorTipo.get(peca.tipo).push(peca);
  }
  for (const [tipo, definicoes] of definicoesPorTipo) {
    const instancias = porTipo.get(tipo) || [];
    const restantes = [...instancias];
    for (const definicao of definicoes) {
      const instanciaNomeada = restantes.find((componente) =>
        componente.nomeCustom?.endsWith(` - ${definicao.ref}`)
        || (definicao.ref === 'InA' && componente.nomeCustom === 'In A')
        || (definicao.ref === 'InB' && componente.nomeCustom === 'In B')
        || (definicao.ref === 'OutY' && componente.nomeCustom === 'Out Y')
      );
      if (instanciaNomeada) {
        mapa.set(definicao.ref, instanciaNomeada);
        restantes.splice(restantes.indexOf(instanciaNomeada), 1);
      }
    }

    const definicoesSemNome = definicoes.filter((definicao) => !mapa.has(definicao.ref));
    definicoesSemNome.forEach((definicao, indice) => mapa.set(definicao.ref, restantes[indice]));
  }
  return mapa;
}

function chaveConexao(componenteA, pinoA, componenteB, pinoB) {
  return [`${componenteA}:${pinoA}`, `${componenteB}:${pinoB}`].sort().join('|');
}

function obterConexoesSelecionadas(circuito, idsSelecionados) {
  return new Set((circuito?.fios || [])
    .filter((fio) => idsSelecionados.has(fio.origem?.componente)
      && idsSelecionados.has(fio.destino?.componente))
    .map((fio) => chaveConexao(
      fio.origem.componente,
      fio.origem.pino,
      fio.destino.componente,
      fio.destino.pino
    )));
}

function descreverConexao(exemplo, mapa, [pontaA, pontaB]) {
  const [refA, pinoA] = pontaA.split('.');
  const [refB, pinoB] = pontaB.split('.');
  const compA = mapa.get(refA);
  const compB = mapa.get(refB);
  const nome = (comp) => comp?.nomeCustom || CATALOGO[comp?.tipo]?.rotulo || 'Componente';
  const rotuloPino = (comp, id) =>
    comp?.pinos?.find((pino) => pino.id === id)?.nome || id;
  return `${nome(compA)} (${rotuloPino(compA, pinoA)}) ↔ ${nome(compB)} (${rotuloPino(compB, pinoB)})`;
}

function obterCandidatosDosExemplos(componentes, circuito) {
  const contagensSelecionadas = contarTipos(componentes);
  return EXEMPLOS_CIRCUITOS.flatMap((exemplo) => {
    const prefixo = exemplo.id.split('-')[0];
    const alvo = ALVOS_EXEMPLOS.get(prefixo);
    if (!alvo || !CATALOGO[alvo]) return [];
    const contagensExemplo = contarTipos(exemplo.componentes);
    if (!contemContagens(contagensSelecionadas, contagensExemplo)) return [];

    const mapa = mapaComponentesExemplo(exemplo, componentes);
    const componentesMapeados = [...new Set([...mapa.values()].filter(Boolean))];
    if (componentesMapeados.length !== exemplo.componentes.length) return [];
    const idsDoMapa = new Set(componentesMapeados.map((comp) => comp.id));
    const conexoesAtuais = obterConexoesSelecionadas(circuito, idsDoMapa);
    const conexoesEsperadas = new Set(exemplo.ligacoes.map(([a, b]) => {
      const [refA, pinoA] = a.split('.');
      const [refB, pinoB] = b.split('.');
      return chaveConexao(mapa.get(refA)?.id, pinoA, mapa.get(refB)?.id, pinoB);
    }));
    const faltantes = exemplo.ligacoes
      .filter(([a, b]) => {
        const [refA, pinoA] = a.split('.');
        const [refB, pinoB] = b.split('.');
        return !conexoesAtuais.has(chaveConexao(
          mapa.get(refA)?.id,
          pinoA,
          mapa.get(refB)?.id,
          pinoB
        ));
      })
      .map(([a, b]) => descreverConexao(exemplo, mapa, [a, b]));
    const correspondencias = conexoesEsperadas.size - faltantes.length;
    return [{
      alvo,
      nome: `${exemplo.titulo} → ${CATALOGO[alvo].rotulo}`,
      descricao: exemplo.descricao,
      faltantes,
      correspondencias,
      totalConexoes: conexoesEsperadas.size,
      componentes: componentesMapeados,
      mapeamentoPinos: mapearTerminaisLogicos({
        a: { ref: 'InA', pino: 'p' },
        b: { ref: 'InB', pino: 'p' },
        y: { ref: 'OutY', pino: 'p' },
      }, mapa),
      exemploId: exemplo.id,
    }];
  });
}

function obterCandidatosDasReceitas(componentes, circuito) {
  const contagensSelecionadas = contarTipos(componentes);
  return Object.entries(RECEITAS_MONTAGEM).flatMap(([alvo, receita]) => {
    if (!CATALOGO[alvo]) return [];
    return ['industrial', 'didatica'].flatMap((modo) => {
      const opcao = receita[modo];
      if (!opcao?.pecas || !opcao.ligacoes) return [];
      if (!contemContagens(contagensSelecionadas, contarTipos(opcao.pecas))) return [];

      const mapa = mapaComponentesReceita(opcao.pecas, componentes);
      const componentesMapeados = [...new Set([...mapa.values()].filter(Boolean))];
      if (componentesMapeados.length !== opcao.pecas.length) return [];
      const idsDoMapa = new Set(componentesMapeados.map((comp) => comp.id));
      const conexoesAtuais = obterConexoesSelecionadas(circuito, idsDoMapa);
      const faltantes = opcao.ligacoes
        .filter(([a, b]) => {
          const [refA, pinoA] = a.split('.');
          const [refB, pinoB] = b.split('.');
          return !conexoesAtuais.has(chaveConexao(
            mapa.get(refA)?.id,
            pinoA,
            mapa.get(refB)?.id,
            pinoB
          ));
        })
        .map(([a, b]) => descreverConexao(opcao, mapa, [a, b]));
      const totalConexoes = new Set(opcao.ligacoes.map(([a, b]) => {
        const [refA, pinoA] = a.split('.');
        const [refB, pinoB] = b.split('.');
        return chaveConexao(mapa.get(refA)?.id, pinoA, mapa.get(refB)?.id, pinoB);
      })).size;
      return [{
        alvo,
        nome: `${receita.titulo} — ${opcao.titulo}`,
        descricao: opcao.descricao,
        faltantes,
        correspondencias: totalConexoes - faltantes.length,
        totalConexoes,
        componentes: componentesMapeados,
        mapeamentoPinos: mapearTerminaisLogicos(opcao.mapeamentoPinos, mapa),
        exemploId: `${alvo}-${modo}`,
      }];
    });
  });
}

function obterCandidatosDasMontagensInternas(componentes, circuito) {
  const contagensSelecionadas = contarTipos(componentes);
  return Object.entries(MONTAGENS).flatMap(([alvo, montagem]) => {
    if (!CATALOGO[alvo] || !montagem.componentes?.length || !montagem.fios?.length) return [];
    const definicoes = montagem.componentes.map((definicao, indice) => ({
      ...definicao,
      ref: String(indice),
    }));
    if (!contemContagens(contagensSelecionadas, contarTipos(definicoes))) return [];

    const mapa = mapaComponentesExemplo({ componentes: definicoes }, componentes);
    const componentesMapeados = [...new Set([...mapa.values()].filter(Boolean))];
    if (componentesMapeados.length !== definicoes.length) return [];
    const idsDoMapa = new Set(componentesMapeados.map((comp) => comp.id));
    const conexoesAtuais = obterConexoesSelecionadas(circuito, idsDoMapa);
    const ligacoes = montagem.fios.map(({ de, para }) => [
      `${de.comp}.${de.pino}`,
      `${para.comp}.${para.pino}`,
    ]);
    const faltantes = ligacoes
      .filter(([a, b]) => {
        const [refA, pinoA] = a.split('.');
        const [refB, pinoB] = b.split('.');
        return !conexoesAtuais.has(chaveConexao(
          mapa.get(refA)?.id,
          pinoA,
          mapa.get(refB)?.id,
          pinoB
        ));
      })
      .map(([a, b]) => descreverConexao(montagem, mapa, [a, b]));
    const totalConexoes = new Set(ligacoes.map(([a, b]) => {
      const [refA, pinoA] = a.split('.');
      const [refB, pinoB] = b.split('.');
      return chaveConexao(mapa.get(refA)?.id, pinoA, mapa.get(refB)?.id, pinoB);
    })).size;
    const mapeamentoPinos = {};
    if (alvo === 'DISPLAY_7SEG') {
      for (const [indice, segmento] of ['a', 'b', 'c', 'd', 'e', 'f', 'g'].entries()) {
        const led = mapa.get(String(indice));
        if (led) {
          mapeamentoPinos[`${led.id}:p1`] = segmento;
          mapeamentoPinos[`${led.id}:p2`] = 'com';
        }
      }
      const comum = mapa.get('7');
      if (comum) mapeamentoPinos[`${comum.id}:p1`] = 'com';
    }

    return [{
      alvo,
      nome: `${montagem.titulo} → ${CATALOGO[alvo].rotulo}`,
      descricao: montagem.descricao,
      faltantes,
      correspondencias: totalConexoes - faltantes.length,
      totalConexoes,
      componentes: componentesMapeados,
      mapeamentoPinos,
      exemploId: `montagem-${alvo}`,
    }];
  });
}

function resultadoDeAssinatura(assinatura, componentes) {
  return {
    encontrado: true,
    assinatura,
    componentes,
    ...(assinatura.mapeamentoPinos ? { mapeamentoPinos: assinatura.mapeamentoPinos } : {}),
    alvo: assinatura.alvo,
    nome: assinatura.nome,
    descricao: assinatura.descricao,
  };
}

/**
 * Retorna os objetos de componentes selecionados (excluindo fios e grupos).
 */
export function obterComponentesSelecionados(estado) {
  if (!estado || !Array.isArray(estado.selecionados)) return [];
  const comps = estado.circuito?.componentes || [];
  return estado.selecionados
    .map((id) => comps.find((c) => c.id === id))
    .filter((c) => c && c.tipo !== 'fio' && c.tipo !== 'grupo');
}

/**
 * Analisa a seleção atual para verificar se corresponde a um circuito equivalente.
 */
export function analisarSelecaoParaConstruir(estado) {
  const circuito = estado.circuito;
  const ordemCircuito = new Map((circuito?.componentes || [])
    .map((componente, indice) => [componente.id, indice]));
  const componentes = obterComponentesSelecionados(estado)
    .sort((a, b) => ordemCircuito.get(a.id) - ordemCircuito.get(b.id));

  if (componentes.length < 2) {
    return { encontrado: false, motivo: 'poucos' };
  }

  const candidatosExemplo = [
    ...obterCandidatosDosExemplos(componentes, circuito),
    ...obterCandidatosDasReceitas(componentes, circuito),
    ...obterCandidatosDasMontagensInternas(componentes, circuito),
  ]
    .map((candidato) => ({
      ...candidato,
      correspondeSelecaoInteira: candidato.componentes.length === componentes.length,
    }))
    .sort((a, b) => Number(b.correspondeSelecaoInteira) - Number(a.correspondeSelecaoInteira)
      || b.correspondencias - a.correspondencias);

  const candidatoCompletoDaSelecao = candidatosExemplo.find(
    (candidato) => candidato.correspondeSelecaoInteira && candidato.faltantes.length === 0
  );
  if (candidatoCompletoDaSelecao) {
    return resultadoDeAssinatura({
      alvo: candidatoCompletoDaSelecao.alvo,
      nome: candidatoCompletoDaSelecao.nome,
      descricao: candidatoCompletoDaSelecao.descricao,
      mapeamentoPinos: candidatoCompletoDaSelecao.mapeamentoPinos,
    }, candidatoCompletoDaSelecao.componentes);
  }

  const correspondenciaIncompletaDaSelecao = candidatosExemplo.filter(
    (candidato) => candidato.correspondeSelecaoInteira
      && candidato.faltantes.length > 0
      && candidato.totalConexoes > 0
      && candidato.correspondencias / candidato.totalConexoes >= 0.5
  );
  if (correspondenciaIncompletaDaSelecao.length) {
    return {
      encontrado: false,
      motivo: 'ligacoes-incompletas',
      sugestoes: correspondenciaIncompletaDaSelecao.slice(0, 3),
    };
  }

  for (const candidato of candidatosExemplo) {
    if (candidato.faltantes.length === 0) {
      return resultadoDeAssinatura({
        alvo: candidato.alvo,
        nome: candidato.nome,
        descricao: candidato.descricao,
        mapeamentoPinos: candidato.mapeamentoPinos,
      }, candidato.componentes);
    }
  }

  const tipos = componentes.map((c) => c.tipo).sort();
  const chave = tipos.join('|');

  const candidatos = ASSINATURAS_CIRCUITO.filter(
    (a) => [...a.tipos].sort().join('|') === chave
  );

  if (candidatos.length === 0) {
    return candidatosExemplo.length
      ? { encontrado: false, motivo: 'ligacoes-incompletas', sugestoes: candidatosExemplo.slice(0, 3) }
      : { encontrado: false, motivo: 'sem-correspondencia' };
  }

  // Desempate topológico para CHAVE|CHAVE (AND em série vs OR em paralelo)
  if (chave === 'CHAVE|CHAVE') {
    const c1 = componentes[0];
    const c2 = componentes[1];
    const fios = estado.circuito?.fios || [];

    const fiosEntre = fios.filter((f) => {
      const pontaA = f.origem || f.a || f.inicio;
      const pontaB = f.destino || f.b || f.fim;
      const a = pontaA?.componente ?? pontaA?.componenteId ?? pontaA?.compId;
      const b = pontaB?.componente ?? pontaB?.componenteId ?? pontaB?.compId;
      return (a === c1.id && b === c2.id) || (a === c2.id && b === c1.id);
    });

    if (fiosEntre.length === 1) {
      const assinatura = ASSINATURAS_CIRCUITO.find((a) => a.alvo === 'AND' && a.tipos[0] === 'CHAVE');
      if (assinatura && CATALOGO[assinatura.alvo]) {
        return {
          encontrado: true,
          assinatura,
          componentes,
          alvo: assinatura.alvo,
          nome: assinatura.nome,
          descricao: assinatura.descricao,
        };
      }
    } else if (fiosEntre.length === 2) {
      const assinatura = ASSINATURAS_CIRCUITO.find((a) => a.alvo === 'OR' && a.tipos[0] === 'CHAVE');
      if (assinatura && CATALOGO[assinatura.alvo]) {
        return {
          encontrado: true,
          assinatura,
          componentes,
          alvo: assinatura.alvo,
          nome: assinatura.nome,
          descricao: assinatura.descricao,
        };
      }
    }

    return candidatosExemplo.length
      ? { encontrado: false, motivo: 'ligacoes-incompletas', sugestoes: candidatosExemplo.slice(0, 3) }
      : { encontrado: false, motivo: 'sem-correspondencia' };
  }

  // Desempate topológico para esquemas com dois TRANSISTOR_NPN (AND RTL em série vs OR RTL em paralelo)
  const transistoresSel = componentes.filter((c) => c.tipo === 'TRANSISTOR_NPN');
  if (transistoresSel.length === 2 && candidatos.length > 1) {
    const [c1, c2] = transistoresSel;
    const fios = estado.circuito?.fios || [];

    const fiosEntre = fios.filter((f) => {
      const pontaA = f.origem || f.a || f.inicio;
      const pontaB = f.destino || f.b || f.fim;
      const a = pontaA?.componente ?? pontaA?.componenteId ?? pontaA?.compId;
      const b = pontaB?.componente ?? pontaB?.componenteId ?? pontaB?.compId;
      return (a === c1.id && b === c2.id) || (a === c2.id && b === c1.id);
    });

    const ehSerie = fiosEntre.some((f) => {
      const p1 = f.origem.pino;
      const p2 = f.destino.pino;
      return (p1 === 'e' && p2 === 'c') || (p1 === 'c' && p2 === 'e');
    });

    const alvoEscolhido = ehSerie ? 'AND' : 'OR';
    const assinatura = candidatos.find((a) => a.alvo === alvoEscolhido);
    if (assinatura && CATALOGO[assinatura.alvo]) {
      return {
        encontrado: true,
        assinatura,
        componentes,
        alvo: assinatura.alvo,
        nome: assinatura.nome,
        descricao: assinatura.descricao,
      };
    }
  }

  // Candidato único sem conflito
  if (candidatos.length === 1) {
    const assinatura = candidatos[0];
    if (CATALOGO[assinatura.alvo]) {
      return {
        encontrado: true,
        assinatura,
        componentes,
        alvo: assinatura.alvo,
        nome: assinatura.nome,
        descricao: assinatura.descricao,
      };
    }
  }

  return { encontrado: false, motivo: 'sem-correspondencia' };
}

/**
 * Calcula a bounding box e o centro de um conjunto de componentes.
 */
export function calcularCentroComponentes(componentes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const comp of componentes) {
    const b = boundsDoComponente(comp);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

/**
 * Substitui os componentes selecionados pelo componente alvo em um único passo,
 * preservando e reconectando inteligentemente as ligações externas.
 */
export function executarSubstituicaoConstruir(resultado, estado, renderizarTudo) {
  if (!resultado || !resultado.encontrado || !resultado.alvo) return false;
  const { alvo, componentes } = resultado;
  const circuito = estado.circuito;
  if (!circuito) return false;

  const centro = calcularCentroComponentes(componentes);
  const idsRemover = new Set(componentes.map((c) => c.id));

  // Ordena componentes por posição vertical (topo para base)
  const compsOrdenados = [...componentes].sort((a, b) => a.y - b.y);
  const transistoresOrdenados = compsOrdenados.filter((c) => c.tipo === 'TRANSISTOR_NPN');
  const temTransistores = transistoresOrdenados.length >= 2;
  const compTop = temTransistores ? transistoresOrdenados[0] : compsOrdenados[0];
  const compBottom = temTransistores
    ? transistoresOrdenados[transistoresOrdenados.length - 1]
    : compsOrdenados[compsOrdenados.length - 1];
  const mapaTipos = new Map(componentes.map((c) => [c.id, c.tipo]));

  // 1. Guarda conexões externas dos componentes que serão removidos
  const conexoesExternas = [];
  for (const fio of (circuito.fios || [])) {
    const origNoConjunto = idsRemover.has(fio.origem.componente);
    const destNoConjunto = idsRemover.has(fio.destino.componente);
    if (origNoConjunto && !destNoConjunto) {
      conexoesExternas.push({
        meuCompId: fio.origem.componente,
        meuPino: fio.origem.pino,
        outraPonta: { ...fio.destino },
        souOrigem: true,
        cor: fio.cor,
        espessura: fio.espessura,
      });
    } else if (destNoConjunto && !origNoConjunto) {
      conexoesExternas.push({
        meuCompId: fio.destino.componente,
        meuPino: fio.destino.pino,
        outraPonta: { ...fio.origem },
        souOrigem: false,
        cor: fio.cor,
        espessura: fio.espessura,
      });
    }
  }

  // 2. Remove os componentes selecionados e seus fios associados
  for (const comp of componentes) {
    removerComponente(circuito, comp.id);
  }

  // Atualiza referências em áreas/grupos existentes
  recalcularMembros(circuito);
  atualizarTodosBounds(circuito);

  // 3. Adiciona o componente alvo centralizado na grade
  const dimAlvo = CATALOGO[alvo]?.dimensoes || { w: 60, h: 40 };
  const posX = Math.round((centro.x - dimAlvo.w / 2) / 10) * 10;
  const posY = Math.round((centro.y - dimAlvo.h / 2) / 10) * 10;
  const novoComp = adicionarComponente(circuito, alvo, posX, posY);

  // 4. Reconecta as ligações externas ao novo componente
  if (novoComp) {
    const pinosDestinoConectados = new Set();
    for (const conex of conexoesExternas) {
      const tipoMeuComp = mapaTipos.get(conex.meuCompId);
      let pinoAlvo = resultado.mapeamentoPinos?.[`${conex.meuCompId}:${conex.meuPino}`] || null;
      if (pinoAlvo) {
        // The recognized template explicitly defines how this terminal maps to the target.
      } else if (tipoMeuComp === 'NO') {
        const nosOrdenados = compsOrdenados.filter((c) => c.tipo === 'NO');
        const noOut = nosOrdenados.find((n) => (n.propriedades?.cor || '').toLowerCase() === '#8a4ae8') || nosOrdenados[nosOrdenados.length - 1];
        const nosIn = nosOrdenados.filter((n) => n.id !== noOut?.id).sort((a, b) => a.y - b.y);
        if (nosIn[0] && conex.meuCompId === nosIn[0].id) {
          pinoAlvo = 'a';
        } else if (nosIn[1] && conex.meuCompId === nosIn[1].id) {
          pinoAlvo = 'b';
        } else if (noOut && conex.meuCompId === noOut.id) {
          pinoAlvo = 'y';
        }
      } else if (temTransistores) {
        if (conex.meuCompId === compTop.id && conex.meuPino === 'b') {
          pinoAlvo = 'a';
        } else if (conex.meuCompId === compBottom.id && conex.meuPino === 'b') {
          pinoAlvo = 'b';
        } else if (
          (tipoMeuComp === 'TRANSISTOR_NPN' && conex.meuPino === 'e') ||
          (tipoMeuComp === 'RESISTOR' && conex.meuPino === 'p1')
        ) {
          pinoAlvo = 'y';
        }
      } else {
        if (conex.meuCompId === compTop.id && (conex.meuPino === 'p1' || conex.meuPino === 'a' || conex.meuPino === 'b')) {
          pinoAlvo = 'a';
        } else if (conex.meuCompId === compBottom.id && (conex.meuPino === 'p1' || conex.meuPino === 'a' || conex.meuPino === 'b')) {
          pinoAlvo = 'b';
        } else if (conex.meuPino === 'p2' || conex.meuPino === 'out' || conex.meuPino === 'y' || conex.meuPino === 'e') {
          pinoAlvo = 'y';
        }
      }

      // Evita duplicar fios que vão para o mesmo pino de saída Y
      const chavePonta = `${pinoAlvo}-${conex.outraPonta.componente}-${conex.outraPonta.pino}`;
      if (pinoAlvo && !pinosDestinoConectados.has(chavePonta)) {
        pinosDestinoConectados.add(chavePonta);
        circuito.fios.push({
          id: `fio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          origem: conex.souOrigem ? { componente: novoComp.id, pino: pinoAlvo } : conex.outraPonta,
          destino: conex.souOrigem ? conex.outraPonta : { componente: novoComp.id, pino: pinoAlvo },
          dobras: [],
          cor: conex.cor || '#34C759',
          espessura: conex.espessura || 2,
        });
      }
    }
  }

  // Atualiza seleção para o novo componente
  estado.selecionados = novoComp ? [novoComp.id] : [];

  // Registra no histórico como UM único passo de undo/redo
  registrar(circuito, 'construir', true);

  if (typeof renderizarTudo === 'function') {
    renderizarTudo();
  }

  return true;
}
