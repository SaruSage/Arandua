import { ARTES_REALISTAS, obterArteRealista } from './visual.js';

const CHAVE_DESIGNS = 'eletronica:designs-componentes';
const CHAVE_HISTORICO = '__historico';
const LIMITE_VERSOES = 20;
let designsEmMemoria = null;
let designsPublicados = null;

function obterDesigns() {
  if (designsEmMemoria) return designsEmMemoria;
  designsEmMemoria = {};
  if (typeof localStorage === 'undefined') return designsEmMemoria;

  try {
    const salvo = localStorage.getItem(CHAVE_DESIGNS);
    if (!salvo) return designsEmMemoria;
    const dados = JSON.parse(salvo);
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      throw new Error('O armazenamento de designs não contém um objeto.');
    }
    for (const [tipo, design] of Object.entries(dados)) {
      if (tipo === CHAVE_HISTORICO) continue;
      const validacao = validarDesignPersonalizado(design);
      if (!validacao.valido) {
        throw new Error(`O design personalizado de ${tipo} é inválido: ${validacao.erro}`);
      }
    }
    if (dados[CHAVE_HISTORICO] !== undefined) {
      const historico = dados[CHAVE_HISTORICO];
      if (!historico || typeof historico !== 'object' || Array.isArray(historico)
        || Object.entries(historico).some(([, versoes]) =>
          !Array.isArray(versoes) || versoes.length > LIMITE_VERSOES
          || versoes.some((design) => !validarDesignPersonalizado(design).valido)
        )) {
        throw new Error('O registro de versões dos designs personalizados é inválido.');
      }
    }
    designsEmMemoria = dados;
  } catch (erro) {
    designsEmMemoria = null;
    console.error('Não foi possível ler os designs personalizados:', erro);
    throw new Error('Os designs personalizados estão inválidos. Remova a entrada eletronica:designs-componentes do armazenamento local para continuar.');
  }
  return designsEmMemoria;
}

export function obterDesignPersonalizado(tipo) {
  return (designsPublicados || obterDesigns())[tipo] || null;
}

export function definirDesignsPublicados(designs) {
  const validados = {};
  for (const [tipo, design] of Object.entries(designs)) {
    const resultado = validarDesignPersonalizado(design);
    if (!resultado.valido) throw new Error(`Design publicado de ${tipo} inválido: ${resultado.erro}`);
    validados[tipo] = JSON.parse(JSON.stringify(design));
  }
  designsPublicados = validados;
}

export function usarDesignsLocais() {
  designsPublicados = null;
}

export function copiarDesignsLocais() {
  const dados = obterDesigns();
  return Object.fromEntries(Object.entries(dados)
    .filter(([tipo]) => tipo !== CHAVE_HISTORICO)
    .map(([tipo, design]) => [tipo, JSON.parse(JSON.stringify(design))]));
}

export function copiarDesignPersonalizado(tipo) {
  const design = obterDesignPersonalizado(tipo);
  return design ? JSON.parse(JSON.stringify(design)) : null;
}

export function obterHistoricoDesignPersonalizado(tipo) {
  const historico = obterDesigns()[CHAVE_HISTORICO]?.[tipo] || [];
  return JSON.parse(JSON.stringify(historico));
}

export function recarregarDesignsPersonalizados() {
  designsEmMemoria = null;
  return obterDesigns();
}

export function validarDesignPersonalizado(design) {
  if (!design || !Number.isFinite(design.largura) || !Number.isFinite(design.altura)
    || design.largura < 1 || design.altura < 1
    || design.largura > 2048 || design.altura > 2048
    || !Array.isArray(design.formas) || design.formas.length > 500
    || !Array.isArray(design.pinos)
    || !design.areaSelecao
    || !['x', 'y', 'largura', 'altura'].every((chave) =>
      Number.isFinite(design.areaSelecao[chave])
    )
    || design.areaSelecao.largura < 1 || design.areaSelecao.altura < 1
  ) {
    return { valido: false, erro: 'O design precisa ter dimensões, formas, pinos e área de seleção válidos.' };
  }
  const idsPinos = new Set();
  if (design.pinos.some((pino) => {
    if (!pino.id || idsPinos.has(pino.id)
      || !Number.isFinite(pino.x) || !Number.isFinite(pino.y)) return true;
    idsPinos.add(pino.id);
    return false;
  })) {
    return { valido: false, erro: 'Cada pino precisa de um identificador e uma posição válida.' };
  }
  const idsFormas = new Set();
  if (design.formas.some((forma) => {
    if (!forma.id || idsFormas.has(forma.id)
      || !['retangulo', 'elipse', 'circulo', 'linha', 'triangulo', 'imagem'].includes(forma.tipo)
      || !Number.isFinite(forma.x) || !Number.isFinite(forma.y)
      || !Number.isFinite(forma.largura) || !Number.isFinite(forma.altura)
      || forma.largura <= 0 || forma.altura <= 0
      || !Number.isFinite(forma.opacidade)
      || forma.opacidade < 0 || forma.opacidade > 1
      || (forma.rotacao !== undefined && !Number.isFinite(forma.rotacao))
      || (forma.tipo === 'imagem' && forma.origem !== 'arte-original')) return true;
    idsFormas.add(forma.id);
    return false;
  })) {
    return { valido: false, erro: 'Uma ou mais formas do design são inválidas.' };
  }
  return { valido: true, erro: null };
}

export function salvarDesignPersonalizado(tipo, design, versoesAnteriores = []) {
  const validacao = validarDesignPersonalizado(design);
  if (!validacao.valido) throw new Error(validacao.erro);
  if (!Array.isArray(versoesAnteriores)
    || versoesAnteriores.some((versao) => !validarDesignPersonalizado(versao).valido)) {
    throw new Error('O registro de versões anteriores contém um design inválido.');
  }
  if (typeof localStorage === 'undefined') {
    throw new Error('O armazenamento local não está disponível neste navegador.');
  }

  const atuais = obterDesigns();
  const historico = { ...(atuais[CHAVE_HISTORICO] || {}) };
  const versoes = [...(historico[tipo] || [])];
  const adicionarVersao = (versao) => {
    const copia = JSON.parse(JSON.stringify(versao));
    if (JSON.stringify(versoes[versoes.length - 1]) !== JSON.stringify(copia)) versoes.push(copia);
  };
  versoesAnteriores.forEach(adicionarVersao);
  if (atuais[tipo]) adicionarVersao(atuais[tipo]);
  historico[tipo] = versoes.slice(-LIMITE_VERSOES);
  const designs = {
    ...atuais,
    [tipo]: JSON.parse(JSON.stringify(design)),
    [CHAVE_HISTORICO]: historico,
  };
  try {
    localStorage.setItem(CHAVE_DESIGNS, JSON.stringify(designs));
  } catch (erro) {
    console.error('Não foi possível salvar o design personalizado:', erro);
    throw new Error('Não foi possível salvar o design. Verifique o espaço disponível no navegador.');
  }
  designsEmMemoria = designs;
  return designs[tipo];
}

export function criarDesignInicial(tipo, definicao, pinos) {
  const arte = ARTES_REALISTAS[tipo];
  const largura = arte?.largura || definicao.dimensoes.w;
  const altura = arte?.altura || definicao.dimensoes.h;
  const pinosArte = arte?.pinos || {};
  const pinosIniciais = pinos.map((pino) => {
    const posicaoArte = pinosArte[pino.id];
    return {
      id: pino.id,
      nome: posicaoArte?.nome || pino.nome || pino.id,
      x: posicaoArte?.x ?? pino.x,
      y: posicaoArte?.y ?? pino.y,
    };
  });
  return {
    largura,
    altura,
    formas: arte
      ? [{
        id: 'arte-original',
        tipo: 'imagem',
        origem: 'arte-original',
        x: 0,
        y: 0,
        largura,
        altura,
        opacidade: 1,
        bloqueada: true,
        grupo: null,
      }]
      : [],
    pinos: pinosIniciais,
    areaSelecao: { x: 0, y: 0, largura, altura },
  };
}

export function desenharDesignPersonalizado(ctx, tipo, design) {
  for (const forma of design.formas) {
    ctx.save();
    ctx.globalAlpha *= forma.opacidade;
    if (forma.tipo === 'imagem') {
      const imagem = obterArteRealista(tipo);
      if (imagem) {
        ctx.translate(forma.x + forma.largura / 2, forma.y + forma.altura / 2);
        ctx.rotate((forma.rotacao || 0) * Math.PI / 180);
        ctx.drawImage(imagem, -forma.largura / 2, -forma.altura / 2, forma.largura, forma.altura);
      }
      ctx.restore();
      continue;
    }

    ctx.translate(forma.x + forma.largura / 2, forma.y + forma.altura / 2);
    ctx.rotate((forma.rotacao || 0) * Math.PI / 180);
    ctx.beginPath();
    if (forma.tipo === 'retangulo') {
      ctx.rect(-forma.largura / 2, -forma.altura / 2, forma.largura, forma.altura);
    } else if (forma.tipo === 'elipse' || forma.tipo === 'circulo') {
      ctx.ellipse(
        0,
        0,
        Math.abs(forma.largura) / 2,
        forma.tipo === 'circulo' ? Math.abs(forma.largura) / 2 : Math.abs(forma.altura) / 2,
        0,
        0,
        Math.PI * 2
      );
    } else if (forma.tipo === 'linha') {
      ctx.moveTo(-forma.largura / 2, -forma.altura / 2);
      ctx.lineTo(forma.largura / 2, forma.altura / 2);
    } else if (forma.tipo === 'triangulo') {
      ctx.moveTo(0, -forma.altura / 2);
      ctx.lineTo(forma.largura / 2, forma.altura / 2);
      ctx.lineTo(-forma.largura / 2, forma.altura / 2);
      ctx.closePath();
    }
    if (forma.tipo !== 'linha' && forma.preenchimento !== false && forma.cor) {
      ctx.fillStyle = forma.cor;
      ctx.fill();
    }
    if (forma.contorno && forma.contorno !== 'nenhum') {
      ctx.strokeStyle = forma.contorno;
      ctx.lineWidth = Math.max(0.1, forma.grossura || 1);
      ctx.stroke();
    } else if (forma.tipo === 'linha') {
      ctx.strokeStyle = forma.cor || '#222222';
      ctx.lineWidth = Math.max(0.1, forma.grossura || 1);
      ctx.stroke();
    }
    ctx.restore();
  }
}
