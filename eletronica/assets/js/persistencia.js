/**
 * persistencia.js — Salvar e carregar circuitos.
 *
 * Formatos:
 * - Arquivo .json (download/upload)
 * - localStorage (autossalvamento)
 *
 * Estrutura do arquivo:
 * {
 *   versao: 1,
 *   criadoEm: ISO string,
 *   circuito: { componentes, fios, grupos },
 *   view: { zoom, panX, panY },
 * }
 */

import { CATALOGO } from './catalogo.js';

const CHAVE_LOCALSTORAGE = 'eletronica:circuito-autosave';
const VERSAO_ATUAL = 1;
const DEBOUNCE_MS = 800;

let timerAutosave = null;

/* ===== SERIALIZAÇÃO ===== */

/**
 * Serializa o estado atual em um objeto pronto para JSON.
 * Remove campos transitórios (estado de simulação, seleção).
 */
export function serializar(estado) {
  const componentes = estado.circuito.componentes.map((c) => ({
    id: c.id,
    tipo: c.tipo,
    x: c.x,
    y: c.y,
    rotacao: c.rotacao || 0,
    propriedades: { ...c.propriedades },
  }));

  const fios = estado.circuito.fios.map((f) => ({
    id: f.id,
    origem: { ...f.origem },
    destino: { ...f.destino },
    dobras: (f.dobras || []).map((d) => ({ x: d.x, y: d.y })),
  }));

  const grupos = estado.circuito.grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    membros: [...g.membros],
    cor: g.cor,
  }));

  return {
    versao: VERSAO_ATUAL,
    criadoEm: new Date().toISOString(),
    circuito: { componentes, fios, grupos },
    view: {
      zoom: estado.view?.zoom ?? 1,
      panX: estado.view?.panX ?? 0,
      panY: estado.view?.panY ?? 0,
    },
  };
}

/* ===== VALIDAÇÃO ===== */

/**
 * Valida a estrutura de um objeto carregado.
 * Retorna { valido, erro }.
 */
export function validar(dados) {
  if (!dados || typeof dados !== 'object') {
    return { valido: false, erro: 'O arquivo não contém um objeto válido.' };
  }

  if (dados.versao !== VERSAO_ATUAL) {
    return {
      valido: false,
      erro: `Versão incompatível (${dados.versao}). Este app espera a versão ${VERSAO_ATUAL}.`,
    };
  }

  const c = dados.circuito;
  if (!c || typeof c !== 'object') {
    return { valido: false, erro: 'O arquivo não contém um circuito.' };
  }

  if (!Array.isArray(c.componentes)) {
    return { valido: false, erro: 'A lista de componentes está ausente ou inválida.' };
  }

  if (!Array.isArray(c.fios)) {
    return { valido: false, erro: 'A lista de fios está ausente ou inválida.' };
  }

  // Valida cada componente
  for (const comp of c.componentes) {
    if (!comp.id || !comp.tipo) {
      return { valido: false, erro: 'Há um componente sem id ou tipo.' };
    }
    if (!CATALOGO[comp.tipo]) {
      return {
        valido: false,
        erro: `Tipo de componente desconhecido: "${comp.tipo}".`,
      };
    }
    if (typeof comp.x !== 'number' || typeof comp.y !== 'number') {
      return { valido: false, erro: `Posição inválida no componente ${comp.id}.` };
    }
  }

  // Valida cada fio
  const idsComponentes = new Set(c.componentes.map((x) => x.id));
  for (const fio of c.fios) {
    if (!fio.origem || !fio.destino) {
      return { valido: false, erro: 'Há um fio sem origem ou destino.' };
    }
    if (!idsComponentes.has(fio.origem.componente)) {
      return {
        valido: false,
        erro: `Fio aponta para componente inexistente: ${fio.origem.componente}.`,
      };
    }
    if (!idsComponentes.has(fio.destino.componente)) {
      return {
        valido: false,
        erro: `Fio aponta para componente inexistente: ${fio.destino.componente}.`,
      };
    }
  }

  // Grupos são opcionais
  if (c.grupos && !Array.isArray(c.grupos)) {
    return { valido: false, erro: 'A lista de grupos está inválida.' };
  }

  return { valido: true, erro: null };
}

/* ===== RECONSTRUÇÃO ===== */

/**
 * Reconstrói o circuito a partir dos dados carregados.
 * Reanexa as definições do catálogo (pinos, dimensões).
 */
export function reconstruir(dados) {
  const c = dados.circuito;

  const componentes = c.componentes.map((comp) => {
    const def = CATALOGO[comp.tipo];
    return {
      id: comp.id,
      tipo: comp.tipo,
      x: comp.x,
      y: comp.y,
      rotacao: comp.rotacao || 0,
      propriedades: { ...def.padrao, ...comp.propriedades },
      pinos: def.pinos.map((p) => ({ ...p })),
      dimensoes: { ...def.dimensoes },
      estado: {},
    };
  });

  const fios = c.fios.map((f) => ({
    id: f.id,
    origem: { ...f.origem },
    destino: { ...f.destino },
    dobras: (f.dobras || []).map((d) => ({ x: d.x, y: d.y })),
  }));

  const grupos = (c.grupos || []).map((g) => ({
    id: g.id,
    nome: g.nome || 'Grupo',
    membros: [...(g.membros || [])],
    cor: g.cor || '#53b588',
    bounds: { x: 0, y: 0, w: 0, h: 0 },
    nomeEditando: false,
  }));

  return {
    circuito: { componentes, fios, grupos },
    view: dados.view || { zoom: 1, panX: 0, panY: 0 },
  };
}

/* ===== ARQUIVO ===== */

/** Baixa o circuito como arquivo .json. */
export function baixarArquivo(estado, nomeArquivo = 'circuito.json') {
  const dados = serializar(estado);
  const json = JSON.stringify(dados, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Abre um seletor de arquivo e carrega o circuito.
 * Retorna uma Promise com { ok, dados, erro }.
 */
export function abrirArquivo() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', () => {
      const arquivo = input.files?.[0];
      if (!arquivo) {
        resolve({ ok: false, erro: 'Nenhum arquivo selecionado.' });
        return;
      }

      const leitor = new FileReader();

      leitor.addEventListener('load', () => {
        try {
          const dados = JSON.parse(leitor.result);
          const { valido, erro } = validar(dados);
          if (!valido) {
            resolve({ ok: false, erro });
            return;
          }
          resolve({ ok: true, dados, erro: null });
        } catch (e) {
          resolve({ ok: false, erro: 'O arquivo não é um JSON válido.' });
        }
      });

      leitor.addEventListener('error', () => {
        resolve({ ok: false, erro: 'Não foi possível ler o arquivo.' });
      });

      leitor.readAsText(arquivo);
    });

    input.click();
  });
}

/* ===== LOCALSTORAGE ===== */

/** Salva no localStorage (autosave). */
export function salvarLocal(estado) {
  try {
    const dados = serializar(estado);
    localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify(dados));
    return { ok: true, erro: null };
  } catch (e) {
    return { ok: false, erro: 'Não foi possível salvar no navegador.' };
  }
}

/** Carrega do localStorage. Retorna null se não houver nada. */
export function carregarLocal() {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCALSTORAGE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    const { valido } = validar(dados);
    if (!valido) return null;
    return dados;
  } catch (e) {
    return null;
  }
}

/** Remove o autosave. */
export function limparLocal() {
  try {
    localStorage.removeItem(CHAVE_LOCALSTORAGE);
  } catch (e) {
    // silencioso
  }
}

/** Verifica se existe um autosave. */
export function temAutosave() {
  try {
    return localStorage.getItem(CHAVE_LOCALSTORAGE) !== null;
  } catch (e) {
    return false;
  }
}

/* ===== AUTOSAVE COM DEBOUNCE ===== */

/**
 * Agenda um autosave com debounce.
 * Chamado a cada alteração no circuito.
 */
export function agendarAutosave(estado) {
  if (timerAutosave) clearTimeout(timerAutosave);
  timerAutosave = setTimeout(() => {
    salvarLocal(estado);
    timerAutosave = null;
  }, DEBOUNCE_MS);
}

/** Cancela um autosave pendente. */
export function cancelarAutosave() {
  if (timerAutosave) {
    clearTimeout(timerAutosave);
    timerAutosave = null;
  }
}