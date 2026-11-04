/**
 * serializer.js — Converte circuito para JSON e vice-versa.
 * Formato versionado para permitir migração futura.
 */

const VERSAO_ATUAL = 1;

/**
 * Serializa um circuito para objeto JSON puro.
 * Remove referências circulares e normaliza a estrutura.
 */
export function serializar(circuito) {
  return {
    versao: VERSAO_ATUAL,
    componentes: circuito.componentes.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      rotulo: c.rotulo,
      posicao: { ...c.posicao },
      numEntradas: c.entradas.length,
      numSaidas: c.saidas.length,
      estado: { ...c.estado },
    })),
    fios: circuito.fios.map((f) => ({
      id: f.id,
      origem: { ...f.origem },
      destino: { ...f.destino },
    })),
  };
}

/**
 * Desserializa um objeto JSON em circuito funcional.
 * Recalcula os valores dos pinos após montar a estrutura.
 */
export function desserializar(dados) {
  if (!dados || dados.versao !== VERSAO_ATUAL) {
    throw new Error(`Versão de circuito incompatível: ${dados?.versao}`);
  }

  const circuito = {
    componentes: dados.componentes.map((c) => {
      const entradas = [];
      for (let i = 0; i < c.numEntradas; i++) {
        entradas.push({ id: `in${i}`, valor: null });
      }
      const saidas = [];
      for (let i = 0; i < c.numSaidas; i++) {
        saidas.push({ id: `out${i}`, valor: null });
      }
      return {
        id: c.id,
        tipo: c.tipo,
        rotulo: c.rotulo,
        posicao: { ...c.posicao },
        entradas,
        saidas,
        estado: { ...c.estado },
      };
    }),
    fios: dados.fios.map((f) => ({
      id: f.id,
      origem: { ...f.origem },
      destino: { ...f.destino },
    })),
    iteracoesUltimaPropagacao: 0,
    estavel: true,
  };

  return circuito;
}

/** Serializa para string JSON formatada (para download ou localStorage). */
export function paraString(circuito) {
  return JSON.stringify(serializar(circuito), null, 2);
}

/** Lê de string JSON. */
export function deString(texto) {
  return desserializar(JSON.parse(texto));
}