/**
 * construir.js — Motor de detecção e substituição de circuitos equivalentes.
 */

import { CATALOGO } from './catalogo.js';
import { adicionarComponente, removerComponente } from './circuito.js';
import { registrar } from './historico.js';
import { boundsDoComponente, recalcularMembros, atualizarTodosBounds } from './grupos.js';

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
];

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
  const componentes = obterComponentesSelecionados(estado);

  if (componentes.length < 2) {
    return { encontrado: false, motivo: 'poucos' };
  }

  const tipos = componentes.map((c) => c.tipo).sort();
  const chave = tipos.join('|');

  const candidatos = ASSINATURAS_CIRCUITO.filter(
    (a) => [...a.tipos].sort().join('|') === chave
  );

  if (candidatos.length === 0) {
    return { encontrado: false, motivo: 'sem-correspondencia' };
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
      const assinatura = ASSINATURAS_CIRCUITO.find((a) => a.alvo === 'AND');
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
      const assinatura = ASSINATURAS_CIRCUITO.find((a) => a.alvo === 'OR');
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

    return { encontrado: false, motivo: 'sem-correspondencia' };
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
 * Substitui os componentes selecionados pelo componente alvo em um único passo.
 */
export function executarSubstituicaoConstruir(resultado, estado, renderizarTudo) {
  if (!resultado || !resultado.encontrado || !resultado.alvo) return false;
  const { alvo, componentes } = resultado;
  const circuito = estado.circuito;
  if (!circuito) return false;

  const centro = calcularCentroComponentes(componentes);

  // Remove os componentes selecionados e seus fios associados
  for (const comp of componentes) {
    removerComponente(circuito, comp.id);
  }

  // Atualiza referências em áreas/grupos existentes
  recalcularMembros(circuito);
  atualizarTodosBounds(circuito);

  // Adiciona o componente alvo centralizado na grade
  const dimAlvo = CATALOGO[alvo]?.dimensoes || { w: 60, h: 40 };
  const posX = Math.round((centro.x - dimAlvo.w / 2) / 10) * 10;
  const posY = Math.round((centro.y - dimAlvo.h / 2) / 10) * 10;
  const novoComp = adicionarComponente(circuito, alvo, posX, posY);

  // Atualiza seleção para o novo componente
  estado.selecionados = novoComp ? [novoComp.id] : [];

  // Registra no histórico como UM único passo de undo/redo
  registrar(circuito, 'construir', true);

  if (typeof renderizarTudo === 'function') {
    renderizarTudo();
  }

  return true;
}
