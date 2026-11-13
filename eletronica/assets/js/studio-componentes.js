import { CATALOGO, obterPinosComponente } from './catalogo.js';
import { ARTES_REALISTAS, carregarArtesRealistas, obterArteRealista } from './visual.js';
import {
  copiarDesignPersonalizado,
  criarDesignInicial,
  obterHistoricoDesignPersonalizado,
  salvarDesignPersonalizado,
  validarDesignPersonalizado,
} from './designs-componentes.js';
import {
  desenharComponente,
  definirProgressoEstiloRealista,
  obterProgressoEstiloRealista,
} from './simbolos.js';

const FORMAS = [
  ['retangulo', 'Retângulo'],
  ['elipse', 'Elipse'],
  ['circulo', 'Círculo'],
  ['linha', 'Linha'],
  ['triangulo', 'Triângulo'],
];

function pontoDoEstudio(evento, canvas, design, vista) {
  const caixa = canvas.getBoundingClientRect();
  return {
    x: (evento.clientX - caixa.left - vista.x) / vista.escala,
    y: (evento.clientY - caixa.top - vista.y) / vista.escala,
  };
}

function iniciarCanvasEstudio(canvas) {
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Não foi possível iniciar o canvas do estúdio de componentes.');

  const estado = {
    design: null,
    tipo: null,
    ferramenta: 'selecionar',
    selecionadas: [],
    pinoSelecionado: null,
    tabPressionado: false,
    medicaoPendente: null,
    vista: { x: 0, y: 0, escala: 1 },
    arrasto: null,
    snapshotArrasto: null,
    callback: null,
    callbackEdicao: null,
  };

  const posicaoForma = (forma, ponto) => ({
    x: ponto.x - forma.x,
    y: ponto.y - forma.y,
  });

  function renderizar() {
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    contexto.setTransform(dpr, 0, 0, dpr, 0, 0);
    contexto.clearRect(0, 0, largura, altura);
    contexto.fillStyle = '#f8faf9';
    contexto.fillRect(0, 0, largura, altura);

    const escala = Math.min(4, Math.max(0.65, Math.min(
      (largura - 64) / estado.design.largura,
      (altura - 64) / estado.design.altura
    )));
    estado.vista = {
      escala,
      x: (largura - estado.design.largura * escala) / 2,
      y: (altura - estado.design.altura * escala) / 2,
    };

    contexto.save();
    contexto.translate(estado.vista.x, estado.vista.y);
    contexto.scale(escala, escala);
    const minXVisivel = -estado.vista.x / escala;
    const maxXVisivel = (largura - estado.vista.x) / escala;
    const minYVisivel = -estado.vista.y / escala;
    const maxYVisivel = (altura - estado.vista.y) / escala;
    const passoGrade = escala < 1 ? 5 : escala < 2 ? 2 : 1;
    const passoMaior = passoGrade * 5;
    contexto.strokeStyle = '#edf0ef';
    contexto.lineWidth = 0.5 / escala;
    for (let x = Math.floor(minXVisivel / passoGrade) * passoGrade; x <= maxXVisivel; x += passoGrade) {
      contexto.beginPath();
      contexto.moveTo(x, minYVisivel);
      contexto.lineTo(x, maxYVisivel);
      contexto.stroke();
    }
    for (let y = Math.floor(minYVisivel / passoGrade) * passoGrade; y <= maxYVisivel; y += passoGrade) {
      contexto.beginPath();
      contexto.moveTo(minXVisivel, y);
      contexto.lineTo(maxXVisivel, y);
      contexto.stroke();
    }
    contexto.strokeStyle = '#d7dfdc';
    contexto.lineWidth = 0.65 / escala;
    for (let x = Math.floor(minXVisivel / passoMaior) * passoMaior; x <= maxXVisivel; x += passoMaior) {
      contexto.beginPath();
      contexto.moveTo(x, minYVisivel);
      contexto.lineTo(x, maxYVisivel);
      contexto.stroke();
    }
    for (let y = Math.floor(minYVisivel / passoMaior) * passoMaior; y <= maxYVisivel; y += passoMaior) {
      contexto.beginPath();
      contexto.moveTo(minXVisivel, y);
      contexto.lineTo(maxXVisivel, y);
      contexto.stroke();
    }
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, estado.design.largura, estado.design.altura);
    contexto.strokeStyle = '#edf0ef';
    contexto.lineWidth = 0.5 / escala;
    for (let x = 0; x <= estado.design.largura; x += passoGrade) {
      contexto.beginPath();
      contexto.moveTo(x, 0);
      contexto.lineTo(x, estado.design.altura);
      contexto.stroke();
    }
    for (let y = 0; y <= estado.design.altura; y += passoGrade) {
      contexto.beginPath();
      contexto.moveTo(0, y);
      contexto.lineTo(estado.design.largura, y);
      contexto.stroke();
    }
    contexto.strokeStyle = '#d7dfdc';
    contexto.lineWidth = 0.65 / escala;
    for (let x = 0; x <= estado.design.largura; x += passoMaior) {
      contexto.beginPath();
      contexto.moveTo(x, 0);
      contexto.lineTo(x, estado.design.altura);
      contexto.stroke();
    }
    for (let y = 0; y <= estado.design.altura; y += passoMaior) {
      contexto.beginPath();
      contexto.moveTo(0, y);
      contexto.lineTo(estado.design.largura, y);
      contexto.stroke();
    }

    for (const forma of estado.design.formas) {
      contexto.save();
      contexto.globalAlpha *= forma.opacidade;
      if (forma.tipo === 'imagem') {
        const imagem = ARTES_REALISTAS[estado.tipo] && obterArteRealista(estado.tipo);
        if (imagem) {
          contexto.translate(forma.x + forma.largura / 2, forma.y + forma.altura / 2);
          contexto.rotate((forma.rotacao || 0) * Math.PI / 180);
          contexto.drawImage(imagem, -forma.largura / 2, -forma.altura / 2, forma.largura, forma.altura);
        }
      } else {
        contexto.translate(forma.x + forma.largura / 2, forma.y + forma.altura / 2);
        contexto.rotate((forma.rotacao || 0) * Math.PI / 180);
        contexto.beginPath();
        if (forma.tipo === 'retangulo') {
          contexto.rect(-forma.largura / 2, -forma.altura / 2, forma.largura, forma.altura);
        } else if (forma.tipo === 'elipse' || forma.tipo === 'circulo') {
          const raioX = Math.abs(forma.largura) / 2;
          const raioY = forma.tipo === 'circulo' ? raioX : Math.abs(forma.altura) / 2;
          contexto.ellipse(0, 0, raioX, raioY, 0, 0, Math.PI * 2);
        } else if (forma.tipo === 'linha') {
          contexto.moveTo(-forma.largura / 2, -forma.altura / 2);
          contexto.lineTo(forma.largura / 2, forma.altura / 2);
        } else if (forma.tipo === 'triangulo') {
          contexto.moveTo(0, -forma.altura / 2);
          contexto.lineTo(forma.largura / 2, forma.altura / 2);
          contexto.lineTo(-forma.largura / 2, forma.altura / 2);
          contexto.closePath();
        }
        if (forma.tipo !== 'linha' && forma.preenchimento !== false && forma.cor) {
          contexto.fillStyle = forma.cor;
          contexto.fill();
        }
        if (forma.contorno && forma.contorno !== 'nenhum') {
          contexto.strokeStyle = forma.contorno;
          contexto.lineWidth = Math.max(0.1, forma.grossura || 1);
          contexto.stroke();
        } else if (forma.tipo === 'linha') {
          contexto.strokeStyle = forma.cor || '#263238';
          contexto.lineWidth = Math.max(0.1, forma.grossura || 1);
          contexto.stroke();
        }
      }
      contexto.restore();
    }

    contexto.save();
    contexto.setLineDash([4 / escala, 3 / escala]);
    contexto.lineWidth = 1 / escala;
    contexto.strokeStyle = '#0889d1';
    contexto.strokeRect(
      estado.design.areaSelecao.x,
      estado.design.areaSelecao.y,
      estado.design.areaSelecao.largura,
      estado.design.areaSelecao.altura
    );
    contexto.restore();

    for (const pino of estado.design.pinos) {
      const px = estado.design.largura / 2 + pino.x;
      const py = estado.design.altura / 2 + pino.y;
      contexto.beginPath();
      contexto.arc(px, py, 3 / escala, 0, Math.PI * 2);
      contexto.fillStyle = estado.pinoSelecionado === pino.id ? '#f59e0b' : 'rgba(0, 156, 59, .25)';
      contexto.fill();
      contexto.strokeStyle = '#009c3b';
      contexto.lineWidth = 1 / escala;
      contexto.stroke();
      contexto.font = `${Math.max(7, 8 / escala)}px system-ui, sans-serif`;
      contexto.fillStyle = '#186746';
      contexto.fillText(pino.nome || pino.id, px + 5 / escala, py - 4 / escala);
    }

    for (const id of estado.selecionadas) {
      const forma = estado.design.formas.find((item) => item.id === id);
      if (!forma || forma.tipo === 'imagem') continue;
      contexto.strokeStyle = '#f59e0b';
      contexto.lineWidth = 1 / escala;
      contexto.strokeRect(forma.x, forma.y, forma.largura, forma.altura);
      contexto.fillStyle = '#ffffff';
      contexto.fillRect(forma.x + forma.largura - 3 / escala, forma.y + forma.altura - 3 / escala, 6 / escala, 6 / escala);
      contexto.strokeRect(forma.x + forma.largura - 3 / escala, forma.y + forma.altura - 3 / escala, 6 / escala, 6 / escala);
    }
    contexto.restore();

    contexto.fillStyle = '#43534c';
    contexto.font = '12px system-ui, sans-serif';
    for (let x = 0; x <= estado.design.largura; x += 10) {
      contexto.fillText(String(x), estado.vista.x + x * escala, Math.max(12, estado.vista.y - 6));
    }
    for (let y = 0; y <= estado.design.altura; y += 10) {
      contexto.fillText(String(y), Math.max(2, estado.vista.x - 26), estado.vista.y + y * escala + 4);
    }

    if (estado.medicaoPendente) {
      contexto.beginPath();
      contexto.arc(
        estado.vista.x + estado.medicaoPendente.x * escala,
        estado.vista.y + estado.medicaoPendente.y * escala,
        4,
        0,
        Math.PI * 2
      );
      contexto.fillStyle = '#e11d48';
      contexto.fill();
    }
  }

  function obterFormaNaPosicao(ponto) {
    return [...estado.design.formas].reverse().find((forma) =>
      ponto.x >= forma.x && ponto.x <= forma.x + forma.largura
      && ponto.y >= forma.y && ponto.y <= forma.y + forma.altura
    );
  }

  function obterPinoNaPosicao(ponto) {
    return estado.design.pinos.find((pino) => Math.hypot(
      ponto.x - estado.design.largura / 2 - pino.x,
      ponto.y - estado.design.altura / 2 - pino.y
    ) <= 8 / estado.vista.escala);
  }

  canvas.addEventListener('pointerdown', (evento) => {
    if (!estado.design) return;
    canvas.setPointerCapture(evento.pointerId);
    const ponto = pontoDoEstudio(evento, canvas, estado.design, estado.vista);
    if (estado.tabPressionado) {
      if (!estado.medicaoPendente) {
        estado.medicaoPendente = ponto;
        estado.callback?.(null, `Ponto inicial: (${ponto.x.toFixed(1)}, ${ponto.y.toFixed(1)}) px`);
      } else {
        const distancia = Math.hypot(
          ponto.x - estado.medicaoPendente.x,
          ponto.y - estado.medicaoPendente.y
        );
        estado.callback?.(null, `Distância: ${distancia.toFixed(2)} px`);
        estado.medicaoPendente = null;
      }
      renderizar();
      return;
    }

    if (estado.ferramenta !== 'selecionar') {
      estado.snapshotArrasto = JSON.stringify(estado.design);
      const forma = {
        id: `forma-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipo: estado.ferramenta,
        x: ponto.x,
        y: ponto.y,
        largura: 0,
        altura: 0,
        cor: '#53b588',
        contorno: '#256b50',
        preenchimento: true,
        grossura: 1,
        opacidade: 1,
        grupo: null,
      };
      estado.design.formas.push(forma);
      estado.selecionadas = [forma.id];
      estado.arrasto = { tipo: 'desenhar', formaId: forma.id, inicio: ponto };
      renderizar();
      estado.callback?.(forma, '');
      return;
    }

    const pino = obterPinoNaPosicao(ponto);
    if (pino) {
      estado.snapshotArrasto = JSON.stringify(estado.design);
      estado.pinoSelecionado = pino.id;
      estado.selecionadas = [];
      estado.arrasto = { tipo: 'pino', pinoId: pino.id };
      estado.callback?.(null, '');
      renderizar();
      return;
    }

    const area = estado.design.areaSelecao;
    const escala = estado.vista.escala;
    const cantoArea = {
      x: area.x + area.largura,
      y: area.y + area.altura,
    };
    if (Math.hypot(ponto.x - cantoArea.x, ponto.y - cantoArea.y) <= 7 / escala) {
      estado.snapshotArrasto = JSON.stringify(estado.design);
      estado.selecionadas = [];
      estado.pinoSelecionado = null;
      estado.arrasto = {
        tipo: 'redimensionar-area',
        inicio: ponto,
        largura: area.largura,
        altura: area.altura,
      };
      renderizar();
      return;
    }
    if (
      Math.abs(ponto.x - area.x) <= 4 / escala
      || Math.abs(ponto.x - area.x - area.largura) <= 4 / escala
      || Math.abs(ponto.y - area.y) <= 4 / escala
      || Math.abs(ponto.y - area.y - area.altura) <= 4 / escala
    ) {
      estado.snapshotArrasto = JSON.stringify(estado.design);
      estado.selecionadas = [];
      estado.pinoSelecionado = null;
      estado.arrasto = { tipo: 'mover-area', inicio: ponto, x: area.x, y: area.y };
      renderizar();
      return;
    }

    const formaSelecionada = obterFormaNaPosicao(ponto);
    if (formaSelecionada) {
      estado.selecionadas = formaSelecionada.grupo
        ? estado.design.formas
          .filter((forma) => forma.grupo === formaSelecionada.grupo)
          .map((forma) => forma.id)
        : evento.shiftKey
        ? [...new Set([...estado.selecionadas, formaSelecionada.id])]
        : estado.selecionadas.includes(formaSelecionada.id)
          ? estado.selecionadas
          : [formaSelecionada.id];
      estado.pinoSelecionado = null;
      const selecionada = estado.design.formas.find((forma) => forma.id === formaSelecionada.id);
      if (selecionada && selecionada.tipo !== 'imagem'
        && Math.hypot(
          ponto.x - selecionada.x - selecionada.largura,
          ponto.y - selecionada.y - selecionada.altura
        ) <= 7 / escala) {
        estado.snapshotArrasto = JSON.stringify(estado.design);
        estado.arrasto = {
          tipo: 'redimensionar-forma',
          formaId: selecionada.id,
          inicio: ponto,
          largura: selecionada.largura,
          altura: selecionada.altura,
        };
        estado.callback?.(formaSelecionada, '');
        renderizar();
        return;
      }
      estado.snapshotArrasto = JSON.stringify(estado.design);
      estado.arrasto = {
        tipo: 'mover-forma',
        inicio: ponto,
        anteriores: estado.design.formas
          .filter((forma) => estado.selecionadas.includes(forma.id))
          .map((forma) => ({ id: forma.id, x: forma.x, y: forma.y })),
      };
      estado.callback?.(formaSelecionada, '');
      renderizar();
      return;
    }

    if (ponto.x >= area.x && ponto.x <= area.x + area.largura
      && ponto.y >= area.y && ponto.y <= area.y + area.altura) {
      estado.snapshotArrasto = JSON.stringify(estado.design);
      estado.selecionadas = [];
      estado.pinoSelecionado = null;
      estado.arrasto = { tipo: 'mover-area', inicio: ponto, x: area.x, y: area.y };
      estado.callback?.(null, '');
      renderizar();
      return;
    }
    estado.selecionadas = [];
    estado.pinoSelecionado = null;
    estado.callback?.(null, '');
    renderizar();
  });

  canvas.addEventListener('pointermove', (evento) => {
    const arrasto = estado.arrasto;
    if (!arrasto) return;
    const ponto = pontoDoEstudio(evento, canvas, estado.design, estado.vista);
    if (arrasto.tipo === 'desenhar') {
      const forma = estado.design.formas.find((item) => item.id === arrasto.formaId);
      forma.x = Math.min(arrasto.inicio.x, ponto.x);
      forma.y = Math.min(arrasto.inicio.y, ponto.y);
      forma.largura = Math.max(1, Math.abs(ponto.x - arrasto.inicio.x));
      forma.altura = Math.max(1, Math.abs(ponto.y - arrasto.inicio.y));
      if (forma.tipo === 'circulo') forma.altura = forma.largura;
      estado.callback?.(forma, '');
    } else if (arrasto.tipo === 'pino') {
      const pino = estado.design.pinos.find((item) => item.id === arrasto.pinoId);
      pino.x = ponto.x - estado.design.largura / 2;
      pino.y = ponto.y - estado.design.altura / 2;
    } else if (arrasto.tipo === 'mover-forma') {
      const dx = ponto.x - arrasto.inicio.x;
      const dy = ponto.y - arrasto.inicio.y;
      for (const anterior of arrasto.anteriores) {
        const forma = estado.design.formas.find((item) => item.id === anterior.id);
        forma.x = anterior.x + dx;
        forma.y = anterior.y + dy;
      }
    } else if (arrasto.tipo === 'mover-area') {
      estado.design.areaSelecao.x = arrasto.x + ponto.x - arrasto.inicio.x;
      estado.design.areaSelecao.y = arrasto.y + ponto.y - arrasto.inicio.y;
    } else if (arrasto.tipo === 'redimensionar-area') {
      estado.design.areaSelecao.largura = Math.max(1, arrasto.largura + ponto.x - arrasto.inicio.x);
      estado.design.areaSelecao.altura = Math.max(1, arrasto.altura + ponto.y - arrasto.inicio.y);
    } else if (arrasto.tipo === 'redimensionar-forma') {
      const forma = estado.design.formas.find((item) => item.id === arrasto.formaId);
      forma.largura = Math.max(1, arrasto.largura + ponto.x - arrasto.inicio.x);
      forma.altura = forma.tipo === 'circulo'
        ? forma.largura
        : Math.max(1, arrasto.altura + ponto.y - arrasto.inicio.y);
    }
    renderizar();
    estado.callbackEdicao?.();
  });

  const finalizarArrasto = () => {
    const snapshot = estado.snapshotArrasto;
    const alterado = snapshot !== null && snapshot !== JSON.stringify(estado.design);
    estado.arrasto = null;
    estado.snapshotArrasto = null;
    if (alterado) estado.callbackEdicao?.(snapshot);
  };
  canvas.addEventListener('pointerup', finalizarArrasto);
  canvas.addEventListener('pointercancel', finalizarArrasto);

  return {
    renderizar,
    carregar(tipo, design) {
      estado.tipo = tipo;
      estado.design = design;
      estado.selecionadas = [];
      estado.pinoSelecionado = null;
      estado.medicaoPendente = null;
      estado.snapshotArrasto = null;
      renderizar();
    },
    alterarFerramenta(ferramenta) {
      estado.ferramenta = ferramenta;
    },
    obterEstado: () => estado,
    definirCallback(callback) {
      estado.callback = callback;
    },
    definirCallbackEdicao(callback) {
      estado.callbackEdicao = callback;
    },
  };
}

function criarEditorDoCampo(label, tipo, valor, onInput, atributos = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = 'studio-campo';
  const texto = document.createElement('span');
  texto.textContent = label;
  const input = document.createElement('input');
  input.type = tipo;
  input.value = valor;
  Object.entries(atributos).forEach(([chave, atributo]) => input.setAttribute(chave, atributo));
  input.addEventListener('input', () => onInput(input.value));
  wrapper.append(texto, input);
  return wrapper;
}

function desenharItemCatalogo(canvas, tipo) {
  const ctx = canvas.getContext('2d');
  const anterior = obterProgressoEstiloRealista();
  definirProgressoEstiloRealista(0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dim = CATALOGO[tipo].dimensoes;
  const escala = Math.min((canvas.width - 18) / dim.w, (canvas.height - 12) / dim.h);
  desenharComponente(
    ctx,
    { tipo, x: 0, y: 0, rotacao: 0, propriedades: {}, dimensoes: dim, pinos: CATALOGO[tipo].pinos },
    (canvas.width - dim.w * escala) / 2,
    (canvas.height - dim.h * escala) / 2,
    escala
  );
  definirProgressoEstiloRealista(anterior);
}

export async function abrirEstudioComponentes(onSalvar, nuvem = null) {
  await carregarArtesRealistas();
  const overlay = document.createElement('div');
  overlay.className = 'studio-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Estúdio de componentes');
  overlay.innerHTML = `
    <div class="studio-painel">
      <header class="studio-cabecalho">
        <div><h1>Estúdio de componentes</h1><p>Desenhe a arte; os pinos continuam sendo os terminais elétricos.</p></div>
        <div class="studio-acoes"><span class="studio-medida" aria-live="polite">Segure Tab e clique em dois pontos para medir.</span>
          <button type="button" class="studio-historico studio-desfazer" aria-label="Desfazer" title="Desfazer">↶</button>
          <button type="button" class="studio-historico studio-refazer" aria-label="Refazer" title="Refazer">↷</button>
          <button type="button" class="studio-versoes">Histórico de versões</button>
          <button type="button" class="studio-salvar" disabled>Salvar visual</button>
          <button type="button" class="studio-fechar" aria-label="Fechar estúdio">×</button></div>
      </header>
      <div class="studio-conteudo">
        <aside class="studio-catalogo"><h2>Componentes</h2><div class="studio-lista"></div></aside>
        <main class="studio-editor">
          <div class="studio-ferramentas">
            <button type="button" data-tool="selecionar" class="ativa">Selecionar</button>
            ${FORMAS.map(([forma, titulo]) => `<button type="button" data-tool="${forma}">${titulo}</button>`).join('')}
            <button type="button" data-action="agrupar">Juntar formas</button>
            <button type="button" data-action="desagrupar">Separar</button>
            <button type="button" data-action="cima">Trazer para cima</button>
            <button type="button" data-action="baixo">Trazer para baixo</button>
            <button type="button" data-action="apagar">Apagar forma</button>
            <button type="button" data-action="medir">Medir (Tab)</button>
          </div>
          <div class="studio-palco"><canvas class="studio-canvas" tabindex="0" aria-label="Área de desenho com grade em pixels"></canvas></div>
          <footer class="studio-status"><span class="studio-componente-atual">Selecione um componente no catálogo.</span><span class="studio-aviso">O resistor mantém suas faixas de valor automáticas.</span></footer>
        </main>
        <aside class="studio-inspetor"><h2>Propriedades</h2><div class="studio-propriedades"><p>Selecione uma forma ou um pino para editar.</p></div></aside>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('.studio-canvas');
  const lista = overlay.querySelector('.studio-lista');
  const inspetor = overlay.querySelector('.studio-propriedades');
  const nomeAtual = overlay.querySelector('.studio-componente-atual');
  const mensagem = overlay.querySelector('.studio-medida');
  const botaoSalvar = overlay.querySelector('.studio-salvar');
  const botaoDesfazer = overlay.querySelector('.studio-desfazer');
  const botaoRefazer = overlay.querySelector('.studio-refazer');
  const botaoVersoes = overlay.querySelector('.studio-versoes');
  const editor = iniciarCanvasEstudio(canvas);
  const tipos = Object.keys(CATALOGO);
  let tipoAtual = null;
  let designAtual = null;
  const historicos = new Map();
  const rascunhos = new Map();
  const versoesSalvas = new Map();
  const salvosNaSessao = new Set();
  const versoesNuvem = new Map();
  let salvando = false;
  const copiar = (valor) => JSON.parse(JSON.stringify(valor));

  function historicoAtual() {
    return historicos.get(tipoAtual);
  }

  function atualizarBotoes() {
    const historico = tipoAtual ? historicoAtual() : null;
    botaoDesfazer.disabled = !historico?.desfazer.length;
    botaoRefazer.disabled = !historico?.refazer.length;
    const alterado = Boolean(tipoAtual && designAtual
      && JSON.stringify(designAtual) !== versoesSalvas.get(tipoAtual));
    botaoSalvar.disabled = !alterado || salvando;
    botaoSalvar.textContent = alterado
      ? 'Salvar visual'
      : salvosNaSessao.has(tipoAtual) ? 'Salvo!' : 'Salvar visual';
  }

  function registrarAlteracao(snapshotAnterior) {
    if (!designAtual || !tipoAtual) return;
    if (JSON.stringify(designAtual) === snapshotAnterior) return;
    const historico = historicoAtual();
    historico.desfazer.push(snapshotAnterior);
    if (historico.desfazer.length > 100) historico.desfazer.shift();
    historico.refazer = [];
    rascunhos.set(tipoAtual, copiar(designAtual));
    atualizarBotoes();
  }

  function alterarDesign(alteracao) {
    if (!designAtual) return;
    const anterior = JSON.stringify(designAtual);
    alteracao();
    editor.renderizar();
    registrarAlteracao(anterior);
  }

  function aplicarVersaoHistorico(design) {
    const estadoAnterior = editor.obterEstado();
    const selecionadas = estadoAnterior.selecionadas.slice();
    const pinoSelecionado = estadoAnterior.pinoSelecionado;
    designAtual = copiar(design);
    rascunhos.set(tipoAtual, copiar(designAtual));
    editor.carregar(tipoAtual, designAtual);
    const estado = editor.obterEstado();
    estado.selecionadas = selecionadas.filter((id) => designAtual.formas.some((forma) => forma.id === id));
    estado.pinoSelecionado = designAtual.pinos.some((pino) => pino.id === pinoSelecionado) ? pinoSelecionado : null;
    editor.renderizar();
    nomeAtual.textContent = `${CATALOGO[tipoAtual].rotulo} — ${designAtual.largura} × ${designAtual.altura} px`;
    const formaSelecionada = designAtual.formas.find((forma) => estado.selecionadas.includes(forma.id));
    atualizarInspetor(formaSelecionada || null);
    atualizarBotoes();
  }

  function desfazer() {
    const historico = historicoAtual();
    if (!historico?.desfazer.length) return;
    historico.refazer.push(JSON.stringify(designAtual));
    aplicarVersaoHistorico(JSON.parse(historico.desfazer.pop()));
  }

  function refazer() {
    const historico = historicoAtual();
    if (!historico?.refazer.length) return;
    historico.desfazer.push(JSON.stringify(designAtual));
    aplicarVersaoHistorico(JSON.parse(historico.refazer.pop()));
  }

  function atualizarInspetor(forma, aviso = '') {
    mensagem.textContent = aviso || 'Segure Tab e clique em dois pontos para medir.';
    inspetor.replaceChildren();
    const estado = editor.obterEstado();
    if (forma) {
      const cor = document.createElement('input');
      cor.type = 'color';
      cor.value = forma.cor || '#53b588';
      cor.addEventListener('input', () => alterarDesign(() => { forma.cor = cor.value; }));
      const corLinha = document.createElement('input');
      corLinha.type = 'color';
      corLinha.value = forma.contorno && forma.contorno !== 'nenhum' ? forma.contorno : '#256b50';
      corLinha.addEventListener('input', () => alterarDesign(() => { forma.contorno = corLinha.value; }));
      const transparencia = criarEditorDoCampo('Opacidade (%)', 'range', Math.round(forma.opacidade * 100), (valor) => {
        alterarDesign(() => { forma.opacidade = Math.max(0, Math.min(1, Number(valor) / 100)); });
      }, { min: '0', max: '100' });
      const largura = criarEditorDoCampo('Largura (px)', 'number', forma.largura, (valor) => {
        alterarDesign(() => {
          forma.largura = Math.max(1, Number(valor) || 1);
          if (forma.tipo === 'circulo') forma.altura = forma.largura;
        });
      }, { min: '1', max: '2048' });
      const altura = criarEditorDoCampo('Altura (px)', 'number', forma.altura, (valor) => {
        alterarDesign(() => {
          forma.altura = Math.max(1, Number(valor) || 1);
          if (forma.tipo === 'circulo') forma.altura = forma.largura;
        });
      }, { min: '1', max: '2048' });
      const grossura = criarEditorDoCampo('Grossura do contorno (px)', 'number', forma.grossura || 1, (valor) => {
        alterarDesign(() => { forma.grossura = Math.max(0.1, Number(valor) || 1); });
      }, { min: '0.1', max: '100', step: '0.1' });
      const preenchimento = document.createElement('label');
      preenchimento.className = 'studio-opcao';
      const preencherInput = document.createElement('input');
      preencherInput.type = 'checkbox';
      preencherInput.checked = forma.preenchimento !== false;
      preencherInput.addEventListener('change', () => {
        alterarDesign(() => { forma.preenchimento = preencherInput.checked; });
      });
      preenchimento.append(preencherInput, document.createTextNode('Preencher forma'));
      const contornar = document.createElement('label');
      contornar.className = 'studio-opcao';
      const contornarInput = document.createElement('input');
      contornarInput.type = 'checkbox';
      contornarInput.checked = forma.contorno !== 'nenhum';
      contornarInput.addEventListener('change', () => {
        alterarDesign(() => { forma.contorno = contornarInput.checked ? corLinha.value : 'nenhum'; });
        corLinha.disabled = !contornarInput.checked;
      });
      contornar.append(contornarInput, document.createTextNode('Contornar forma'));
      const corLabel = document.createElement('span');
      corLabel.textContent = 'Preenchimento';
      const contornoLabel = document.createElement('span');
      contornoLabel.textContent = 'Contorno';
      const rotacao = criarEditorDoCampo('Rotação (graus)', 'number', forma.rotacao || 0, (valor) => {
        alterarDesign(() => { forma.rotacao = Number(valor) || 0; });
      }, { min: '-360', max: '360' });
      const posicaoX = criarEditorDoCampo('Posição X (px)', 'number', forma.x, (valor) => {
        alterarDesign(() => { forma.x = Number(valor) || 0; });
      });
      const posicaoY = criarEditorDoCampo('Posição Y (px)', 'number', forma.y, (valor) => {
        alterarDesign(() => { forma.y = Number(valor) || 0; });
      });
      inspetor.append(corLabel, cor, contornoLabel, corLinha, contornar, preenchimento, transparencia, largura, altura, posicaoX, posicaoY, grossura, rotacao);
      return;
    }
    const pino = estado.design?.pinos.find((item) => item.id === estado.pinoSelecionado);
    if (pino) {
      inspetor.append(
        criarEditorDoCampo('Pino', 'text', `${pino.nome} (${pino.id})`, () => {}, { disabled: 'disabled' }),
        criarEditorDoCampo('Posição X (px)', 'number', (estado.design.largura / 2 + pino.x).toFixed(1), (valor) => {
          alterarDesign(() => { pino.x = Number(valor) - estado.design.largura / 2; });
        }),
        criarEditorDoCampo('Posição Y (px)', 'number', (estado.design.altura / 2 + pino.y).toFixed(1), (valor) => {
          alterarDesign(() => { pino.y = Number(valor) - estado.design.altura / 2; });
        })
      );
      return;
    }
    if (tipoAtual) {
      const area = designAtual.areaSelecao;
      for (const [rotulo, chave] of [['X da área', 'x'], ['Y da área', 'y'], ['Largura da área', 'largura'], ['Altura da área', 'altura']]) {
        inspetor.append(criarEditorDoCampo(rotulo, 'number', area[chave], (valor) => {
          alterarDesign(() => {
            area[chave] = Math.max(chave.includes('largura') || chave.includes('altura') ? 1 : -2048, Number(valor) || 0);
          });
        }, { min: chave.includes('largura') || chave.includes('altura') ? '1' : '-2048' }));
      }
      for (const [rotulo, chave] of [['Largura do desenho', 'largura'], ['Altura do desenho', 'altura']]) {
        inspetor.append(criarEditorDoCampo(rotulo, 'number', designAtual[chave], (valor) => {
          alterarDesign(() => {
            const anterior = designAtual[chave];
            const novo = Math.max(1, Math.min(2048, Number(valor) || anterior));
            const fator = novo / anterior;
            for (const formaAtual of designAtual.formas) {
              if (chave === 'largura') {
                formaAtual.x *= fator;
                formaAtual.largura *= fator;
              } else {
                formaAtual.y *= fator;
                formaAtual.altura *= fator;
              }
            }
            designAtual.pinos.forEach((p) => {
              if (chave === 'largura') p.x = p.x * fator + (novo - anterior) / 2;
              else p.y = p.y * fator + (novo - anterior) / 2;
            });
            designAtual.areaSelecao[chave] *= fator;
            designAtual[chave] = novo;
          });
        }, { min: '1', max: '2048' }));
      }
    }
  }

  editor.definirCallback(atualizarInspetor);
  editor.definirCallbackEdicao((snapshotAnterior) => {
    if (snapshotAnterior) registrarAlteracao(snapshotAnterior);
    else if (tipoAtual && designAtual) {
      rascunhos.set(tipoAtual, copiar(designAtual));
      atualizarBotoes();
    }
  });

  function selecionarComponente(tipo, item) {
    if (tipoAtual && designAtual) rascunhos.set(tipoAtual, copiar(designAtual));
    tipoAtual = tipo;
    const definicao = CATALOGO[tipo];
    const designSalvo = copiarDesignPersonalizado(tipo);
    const pinos = obterPinosComponente(tipo);
    designAtual = rascunhos.get(tipo)
      || designSalvo
      || criarDesignInicial(tipo, definicao, pinos);
    if (designSalvo) {
      if (!rascunhos.has(tipo)) {
        designAtual.pinos = pinos.map((pino) => {
          const salvo = designSalvo.pinos.find((candidato) => candidato.id === pino.id);
          return salvo ? { ...salvo } : {
            id: pino.id, nome: pino.nome || pino.id, x: pino.x, y: pino.y,
          };
        });
      }
      salvosNaSessao.add(tipo);
    }
    if (!versoesSalvas.has(tipo)) {
      versoesSalvas.set(tipo, JSON.stringify(designSalvo || designAtual));
    }
    if (!historicos.has(tipo)) {
      historicos.set(tipo, {
        desfazer: nuvem ? [] : obterHistoricoDesignPersonalizado(tipo).map((versao) => JSON.stringify(versao)),
        refazer: [],
      });
    }
    if (nuvem && !versoesNuvem.has(tipo)) versoesNuvem.set(tipo, nuvem.obterVersao(tipo));
    designAtual = copiar(designAtual);
    rascunhos.set(tipo, copiar(designAtual));
    editor.carregar(tipo, designAtual);
    nomeAtual.textContent = `${definicao.rotulo} — ${designAtual.largura} × ${designAtual.altura} px`;
    lista.querySelectorAll('.studio-item').forEach((botao) => {
      botao.classList.toggle('selecionado', botao === item);
      botao.classList.toggle('expandido', botao === item);
    });
    item.scrollIntoView({ block: 'nearest' });
    atualizarInspetor(null);
    atualizarBotoes();
  }

  for (const tipo of tipos) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'studio-item';
    const miniatura = document.createElement('canvas');
    miniatura.width = 120;
    miniatura.height = 54;
    const titulo = document.createElement('span');
    titulo.textContent = CATALOGO[tipo].rotulo;
    const ampliada = document.createElement('canvas');
    ampliada.width = 170;
    ampliada.height = 112;
    ampliada.className = 'studio-item-ampliado';
    item.append(miniatura, titulo, ampliada);
    desenharItemCatalogo(miniatura, tipo);
    desenharItemCatalogo(ampliada, tipo);
    item.addEventListener('click', () => selecionarComponente(tipo, item));
    lista.appendChild(item);
  }

  overlay.querySelectorAll('[data-tool]').forEach((botao) => {
    botao.addEventListener('click', () => {
      editor.alterarFerramenta(botao.dataset.tool);
      overlay.querySelectorAll('[data-tool]').forEach((outro) => outro.classList.toggle('ativa', outro === botao));
      canvas.style.cursor = botao.dataset.tool === 'selecionar' ? 'default' : 'crosshair';
    });
  });

  overlay.querySelectorAll('[data-action]').forEach((botao) => {
    botao.addEventListener('click', () => {
      if (!designAtual) return;
      const estado = editor.obterEstado();
      const formasSelecionadas = designAtual.formas.filter((forma) => estado.selecionadas.includes(forma.id));
      const snapshotAnterior = JSON.stringify(designAtual);
      if (botao.dataset.action === 'agrupar' && formasSelecionadas.length > 1) {
        const grupo = `grupo-${Date.now()}`;
        formasSelecionadas.forEach((forma) => { forma.grupo = grupo; });
      } else if (botao.dataset.action === 'desagrupar') {
        formasSelecionadas.forEach((forma) => { forma.grupo = null; });
      } else if (botao.dataset.action === 'cima' && formasSelecionadas.length) {
        formasSelecionadas.forEach((forma) => {
          designAtual.formas.splice(designAtual.formas.indexOf(forma), 1);
          designAtual.formas.push(forma);
        });
      } else if (botao.dataset.action === 'baixo' && formasSelecionadas.length) {
        formasSelecionadas.slice().reverse().forEach((forma) => {
          designAtual.formas.splice(designAtual.formas.indexOf(forma), 1);
          designAtual.formas.unshift(forma);
        });
      } else if (botao.dataset.action === 'apagar' && formasSelecionadas.length) {
        designAtual.formas = designAtual.formas.filter((forma) => !estado.selecionadas.includes(forma.id));
        estado.selecionadas = [];
      } else if (botao.dataset.action === 'medir') {
        estado.tabPressionado = true;
        setTimeout(() => { estado.tabPressionado = false; }, 2500);
        mensagem.textContent = 'Clique em dois pontos no desenho para medir.';
        return;
      }
      editor.renderizar();
      registrarAlteracao(snapshotAnterior);
    });
  });

  function teclaDown(evento) {
    if (overlay.querySelector('dialog[open]')) return;
    const alvoEditavel = evento.target instanceof HTMLElement
      && (evento.target.matches('input, textarea, select, [contenteditable="true"]'));
    if (evento.key === 'Tab' && overlay.isConnected
      && (evento.target === canvas || evento.target === overlay)) {
      evento.preventDefault();
      editor.obterEstado().tabPressionado = true;
    }
    if (!alvoEditavel && (evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'z') {
      evento.preventDefault();
      if (evento.shiftKey) refazer();
      else desfazer();
      return;
    }
    if (!alvoEditavel && (evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'y') {
      evento.preventDefault();
      refazer();
      return;
    }
    if (evento.key === 'Escape') fechar();
    if (!alvoEditavel && (evento.key === 'Delete' || evento.key === 'Backspace') && designAtual) {
      const selecionadas = editor.obterEstado().selecionadas;
      if (selecionadas.length) {
        alterarDesign(() => {
          designAtual.formas = designAtual.formas.filter((forma) => !selecionadas.includes(forma.id));
          editor.obterEstado().selecionadas = [];
        });
        atualizarInspetor(null);
      }
    }
    if (!alvoEditavel && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(evento.key) && designAtual) {
      const estado = editor.obterEstado();
      const delta = {
        x: evento.key === 'ArrowLeft' ? -1 : evento.key === 'ArrowRight' ? 1 : 0,
        y: evento.key === 'ArrowUp' ? -1 : evento.key === 'ArrowDown' ? 1 : 0,
      };
      const formasSelecionadas = designAtual.formas.filter((forma) => estado.selecionadas.includes(forma.id));
      const pinoSelecionado = designAtual.pinos.find((pino) => pino.id === estado.pinoSelecionado);
      if (formasSelecionadas.length || pinoSelecionado) {
        evento.preventDefault();
        alterarDesign(() => {
          formasSelecionadas.forEach((forma) => {
            forma.x += delta.x;
            forma.y += delta.y;
          });
          if (pinoSelecionado) {
            pinoSelecionado.x += delta.x;
            pinoSelecionado.y += delta.y;
          }
        });
        atualizarInspetor(formasSelecionadas[0] || null);
      }
    }
  }
  function teclaUp(evento) {
    if (evento.key === 'Tab') editor.obterEstado().tabPressionado = false;
  }
  function fechar() {
    window.removeEventListener('keydown', teclaDown);
    window.removeEventListener('keyup', teclaUp);
    window.removeEventListener('resize', editor.renderizar);
    overlay.remove();
  }
  window.addEventListener('keydown', teclaDown);
  window.addEventListener('keyup', teclaUp);
  overlay.querySelector('.studio-fechar').addEventListener('click', fechar);
  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) fechar();
  });

  botaoDesfazer.addEventListener('click', desfazer);
  botaoRefazer.addEventListener('click', refazer);
  botaoVersoes.addEventListener('click', async () => {
    if (!tipoAtual) return;
    const tipo = tipoAtual;
    botaoVersoes.disabled = true;
    try {
      const resultado = nuvem
        ? await nuvem.listarVersoes(tipo)
        : {
          versoes: obterHistoricoDesignPersonalizado(tipo).map((design, indice) => ({ design, versao: indice + 1 })),
          proximo: null,
        };
      if (tipoAtual !== tipo) return;
      const dialogo = document.createElement('dialog');
      dialogo.className = 'nuvem-dialogo';
      const titulo = document.createElement('h2');
      titulo.textContent = `Versões: ${CATALOGO[tipo].rotulo}`;
      const listaVersoes = document.createElement('div');
      listaVersoes.className = 'projetos-lista';
      if (!resultado.versoes.length) listaVersoes.textContent = 'Ainda não há versões anteriores.';
      function adicionarVersoes(versoes) {
        for (const versao of versoes) {
          const botao = document.createElement('button');
          botao.type = 'button';
          const data = versao.atualizadoEm?.toDate?.();
          botao.textContent = `Versão ${versao.versao}${data ? ` — ${data.toLocaleString('pt-BR')}` : ''}`;
          botao.addEventListener('click', () => {
            const validacao = validarDesignPersonalizado(versao.design);
            if (!validacao.valido) {
              mensagem.textContent = `A versão selecionada é inválida: ${validacao.erro}`;
              dialogo.close();
              return;
            }
            const snapshot = JSON.stringify(designAtual);
            aplicarVersaoHistorico(versao.design);
            registrarAlteracao(snapshot);
            dialogo.close();
          });
          listaVersoes.append(botao);
        }
      }
      adicionarVersoes(resultado.versoes);
      let proximo = resultado.proximo;
      const mais = document.createElement('button');
      mais.type = 'button';
      mais.textContent = 'Carregar mais versões';
      mais.hidden = !proximo;
      mais.addEventListener('click', async () => {
        mais.disabled = true;
        try {
          const pagina = await nuvem.listarVersoes(tipo, proximo);
          adicionarVersoes(pagina.versoes);
          proximo = pagina.proximo;
          mais.hidden = !proximo;
        } catch (erro) {
          console.error('Não foi possível carregar mais versões:', erro);
          avisoVersoes.textContent = `Não foi possível carregar mais versões: ${erro.message}`;
        } finally {
          mais.disabled = false;
        }
      });
      const avisoVersoes = document.createElement('p');
      avisoVersoes.className = 'nuvem-mensagem';
      avisoVersoes.setAttribute('role', 'status');
      const fecharHistorico = document.createElement('button');
      fecharHistorico.type = 'button';
      fecharHistorico.textContent = 'Fechar';
      fecharHistorico.addEventListener('click', () => dialogo.close());
      dialogo.addEventListener('close', () => dialogo.remove());
      dialogo.append(titulo, listaVersoes, mais, avisoVersoes, fecharHistorico);
      overlay.append(dialogo);
      dialogo.showModal();
    } catch (erro) {
      console.error('Não foi possível carregar as versões:', erro);
      mensagem.textContent = `Não foi possível carregar as versões: ${erro.message}`;
    } finally {
      botaoVersoes.disabled = false;
    }
  });
  botaoSalvar.addEventListener('click', async () => {
    if (!tipoAtual || !designAtual) {
      mensagem.textContent = 'Selecione um componente antes de salvar.';
      return;
    }
    const tipo = tipoAtual;
    const copia = copiar(designAtual);
    salvando = true;
    atualizarBotoes();
    try {
      const versoesAnteriores = historicoAtual().desfazer.map((versao) => JSON.parse(versao));
      const design = nuvem
        ? copia
        : salvarDesignPersonalizado(tipo, copia, versoesAnteriores);
      if (nuvem) {
        const versao = await nuvem.publicar(
          tipo, design, versoesNuvem.get(tipo), JSON.parse(versoesSalvas.get(tipo))
        );
        versoesNuvem.set(tipo, versao);
      }
      versoesSalvas.set(tipo, JSON.stringify(design));
      salvosNaSessao.add(tipo);
      onSalvar?.(tipo, design);
      mensagem.textContent = `${CATALOGO[tipo].rotulo} salvo na biblioteca de designs realistas.`;
    } catch (erro) {
      console.error(erro);
      mensagem.textContent = erro.message;
    } finally {
      salvando = false;
      atualizarBotoes();
    }
  });

  window.addEventListener('resize', editor.renderizar);
  const primeiro = lista.querySelector('.studio-item');
  if (primeiro) primeiro.click();
}
