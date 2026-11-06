/**
 * painel.js — Painel de propriedades do componente selecionado.
 * Gera campos a partir do catálogo, com unidades, validação e
 * botão "Ver montagem" para componentes compostos.
 */

import { CATALOGO } from './catalogo.js';
import { rotacionarComponente } from './circuito.js';
import { registrar } from './historico.js';
import { CORES_FIO, removerFio } from './fios.js';
import { CORES_GRUPO, desfazerGrupo } from './grupos.js';
import { desenharComponente } from './simbolos.js';
import { executarSubstituicaoConstruir } from './construir.js';

export const CORES_LED = [
  '#FF3B30', // vermelho
  '#FF9500', // laranja
  '#FFCC00', // amarelo
  '#34C759', // verde
  '#00C7BE', // ciano
  '#007AFF', // azul
  '#5856D6', // índigo
  '#AF52DE', // roxo
  '#FF2D55', // rosa
  '#8E8E93', // cinza
];

/** Formata um número com unidade de engenharia. */
function formatarValor(valor, unidade) {
  if (valor === undefined || valor === null) return '';
  if (typeof valor !== 'number') return String(valor);

  const abs = Math.abs(valor);
  if (unidade === 'Ω') {
    if (abs >= 1e6) return `${(valor / 1e6).toFixed(2)} MΩ`;
    if (abs >= 1e3) return `${(valor / 1e3).toFixed(2)} kΩ`;
    return `${valor.toFixed(1)} Ω`;
  }
  if (unidade === 'F') {
    if (abs < 1e-9) return `${(valor * 1e12).toFixed(1)} pF`;
    if (abs < 1e-6) return `${(valor * 1e9).toFixed(1)} nF`;
    if (abs < 1e-3) return `${(valor * 1e6).toFixed(1)} µF`;
    return `${valor.toFixed(4)} F`;
  }
  if (unidade === 'H') {
    if (abs < 1e-3) return `${(valor * 1e6).toFixed(1)} µH`;
    if (abs < 1) return `${(valor * 1e3).toFixed(1)} mH`;
    return `${valor.toFixed(3)} H`;
  }
  if (unidade === 'A') {
    if (abs < 1e-3) return `${(valor * 1e6).toFixed(1)} µA`;
    if (abs < 1) return `${(valor * 1e3).toFixed(1)} mA`;
    return `${valor.toFixed(3)} A`;
  }
  if (unidade === 'V') return `${valor.toFixed(2)} V`;
  if (unidade === 'Hz') return `${valor.toFixed(1)} Hz`;
  return `${valor}${unidade ? ' ' + unidade : ''}`;
}

/** Cria um campo de entrada para uma propriedade. */
function criarCampo(chave, spec, comp, aoMudar, circuito) {
  const campo = document.createElement('div');
  campo.className = 'painel-campo';

  const label = document.createElement('label');
  label.textContent = spec.rotulo;
  label.htmlFor = `prop-${chave}`;
  campo.appendChild(label);

  let input;

  if (spec.tipo === 'numero') {
    input = document.createElement('input');
    input.type = 'number';
    input.value = comp.propriedades[chave];
    if (spec.min !== undefined) input.min = spec.min;
    if (spec.max !== undefined) input.max = spec.max;
    if (spec.step !== undefined) input.step = spec.step;
    else input.step = 'any';

    // Mostra a unidade formatada ao lado
    if (spec.unidade) {
      const wrapper = document.createElement('div');
      wrapper.className = 'painel-campo-linha';
      wrapper.appendChild(input);

      const hint = document.createElement('span');
      hint.className = 'painel-campo-hint';
      hint.textContent = formatarValor(comp.propriedades[chave], spec.unidade);
      wrapper.appendChild(hint);

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        if (!isNaN(v)) {
          comp.propriedades[chave] = v;
          registrar(circuito, 'propriedade');
          hint.textContent = formatarValor(v, spec.unidade);
          aoMudar();
        }
      });

      campo.appendChild(wrapper);
      return campo;
    }

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (!isNaN(v)) {
        comp.propriedades[chave] = v;
        registrar(circuito, 'propriedade');
        aoMudar();
      }
    });
  } else if (spec.tipo === 'cor') {
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-cores';
    const corAtual = (comp.propriedades?.[chave] || comp.cor || CORES_LED[0]).toUpperCase();

    for (const cor of CORES_LED) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'popup-cor-bolinha' + (cor.toUpperCase() === corAtual ? ' selecionada' : '');
      btn.dataset.cor = cor;
      btn.style.background = cor;
      btn.title = cor;
      btn.addEventListener('click', () => {
        comp.cor = cor;
        if (comp.propriedades) comp.propriedades[chave] = cor;
        wrapper.querySelectorAll('.popup-cor-bolinha').forEach((b) => b.classList.remove('selecionada'));
        btn.classList.add('selecionada');
        registrar(circuito, 'propriedade', true);
        if (aoMudar) aoMudar();
      });
      wrapper.appendChild(btn);
    }

    campo.appendChild(wrapper);
    return campo;
  } else if (spec.tipo === 'booleano') {
    const wrapper = document.createElement('label');
    wrapper.className = 'painel-toggle';

    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = comp.propriedades[chave];
    wrapper.appendChild(input);

    const texto = document.createElement('span');
    texto.textContent = comp.propriedades[chave] ? 'Sim' : 'Não';
    wrapper.appendChild(texto);

    input.addEventListener('change', () => {
      comp.propriedades[chave] = input.checked;
      registrar(circuito, 'propriedade');
      texto.textContent = input.checked ? 'Sim' : 'Não';
      aoMudar();
    });

    campo.appendChild(wrapper);
    return campo;
  } else if (spec.tipo === 'select') {
    input = document.createElement('select');
    for (const opcao of spec.opcoes) {
      const opt = document.createElement('option');
      opt.value = opcao;
      opt.textContent = opcao;
      if (opcao === comp.propriedades[chave]) opt.selected = true;
      input.appendChild(opt);
    }
    input.addEventListener('change', () => {
      comp.propriedades[chave] = input.value;
      registrar(circuito, 'propriedade');
      aoMudar();
    });
  }

  input.id = `prop-${chave}`;
  campo.appendChild(input);
  return campo;
}

/** Cria a seção de rotação (linha única: campo + botões ao lado). */
function criarSecaoRotacao(comp, aoMudar, circuito) {
  const secao = document.createElement('div');
  secao.className = 'painel-secao popup-secao';

  const titulo = document.createElement('h4');
  titulo.className = 'popup-secao-titulo';
  titulo.textContent = 'Controle de Rotação';
  secao.appendChild(titulo);

  const grupo = document.createElement('div');
  grupo.className = 'popup-linha-rotacao';

  const inputAng = document.createElement('input');
  inputAng.type = 'number';
  inputAng.value = comp.rotacao;
  inputAng.min = 0;
  inputAng.max = 359;
  inputAng.step = 1;
  inputAng.className = 'popup-rotacao-input';
  inputAng.title = 'Ângulo em graus';
  inputAng.addEventListener('input', () => {
    const v = parseInt(inputAng.value, 10) || 0;
    comp.rotacao = ((v % 360) + 360) % 360;
    registrar(circuito, 'rotacionar', true);
    aoMudar();
  });
  grupo.appendChild(inputAng);

  const sufixo = document.createElement('span');
  sufixo.className = 'popup-rotacao-grau';
  sufixo.textContent = '°';
  grupo.appendChild(sufixo);

  const btnEsq = document.createElement('button');
  btnEsq.type = 'button';
  btnEsq.className = 'popup-rotacao-btn';
  btnEsq.dataset.delta = '-90';
  btnEsq.title = '-90°';
  btnEsq.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>';
  btnEsq.addEventListener('click', () => {
    rotacionarComponente({ componentes: [comp] }, comp.id, comp.rotacao - 90);
    registrar(circuito, 'rotacionar', true);
    aoMudar();
  });
  grupo.appendChild(btnEsq);

  const btnDir = document.createElement('button');
  btnDir.type = 'button';
  btnDir.className = 'popup-rotacao-btn';
  btnDir.dataset.delta = '90';
  btnDir.title = '+90°';
  btnDir.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5V2l5 4-5 4V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z"/></svg>';
  btnDir.addEventListener('click', () => {
    rotacionarComponente({ componentes: [comp] }, comp.id, comp.rotacao + 90);
    registrar(circuito, 'rotacionar', true);
    aoMudar();
  });
  grupo.appendChild(btnDir);

  secao.appendChild(grupo);
  return secao;
}

/**
 * Monta as propriedades de um componente específico dentro do container informado (ex.: corpo de um popup).
 */
export function montarPropriedadesComponente(container, comp, estado, aoMudar, aoVerMontagem) {
  container.innerHTML = '';
  if (!comp) return;

  const def = CATALOGO[comp.tipo];
  if (!def) return;
  if (!comp.propriedades) {
    comp.propriedades = Object.fromEntries(
      Object.entries(def.propriedades || {}).map(([chave, spec]) => [chave, spec.valor])
    );
  }

  // Categoria como subtítulo pequeno (o nome já aparece na barra superior do popup)
  const categoria = document.createElement('div');
  categoria.className = 'popup-categoria';
  categoria.textContent = def.categoria;
  container.appendChild(categoria);

  const secoes = [];

  // Cor do LED com 10 opções pré-definidas
  if (comp.tipo === 'LED') {
    const secaoCor = document.createElement('div');
    secaoCor.className = 'popup-secao';

    const tituloCor = document.createElement('div');
    tituloCor.className = 'popup-secao-titulo';
    tituloCor.textContent = 'Cor';
    secaoCor.appendChild(tituloCor);

    const corAtual = (comp.propriedades?.cor || comp.cor || CORES_LED[0]).toUpperCase();
    const paleta = document.createElement('div');
    paleta.className = 'popup-cores';

    for (const cor of CORES_LED) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'popup-cor-bolinha' + (cor.toUpperCase() === corAtual ? ' selecionada' : '');
      btn.dataset.cor = cor;
      btn.style.background = cor;
      btn.title = cor;
      btn.addEventListener('click', () => {
        comp.cor = cor;
        if (comp.propriedades) comp.propriedades.cor = cor;
        paleta.querySelectorAll('.popup-cor-bolinha').forEach((b) => b.classList.remove('selecionada'));
        btn.classList.add('selecionada');
        registrar(estado.circuito, 'propriedade', true);
        if (aoMudar) aoMudar();
      });
      paleta.appendChild(btn);
    }

    secaoCor.appendChild(paleta);
    secoes.push(secaoCor);
  }

  // Propriedades
  let props = Object.entries(def.propriedades || {});
  if (comp.tipo === 'LED') {
    props = props.filter(([chave]) => chave !== 'cor');
  }
  if (props.length > 0) {
    const secaoProps = document.createElement('div');
    secaoProps.className = 'painel-secao popup-secao painel-secao--primeira';

    const tituloProps = document.createElement('h4');
    tituloProps.textContent = 'Propriedades';
    secaoProps.appendChild(tituloProps);

    for (const [chave, spec] of props) {
      secaoProps.appendChild(criarCampo(chave, spec, comp, aoMudar, estado.circuito));
    }

    if (comp.tipo === 'FUSIVEL') {
      const status = document.createElement('div');
      status.className = 'prop-status';
      status.innerHTML = comp.propriedades?.queimado
        ? '<span style="color:#c0392b; font-weight:700;">● QUEIMADO</span>'
        : '<span style="color:#53b588; font-weight:600;">● Íntegro</span>';
      secaoProps.appendChild(status);

      if (comp.propriedades?.queimado) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-toolbar';
        btn.textContent = 'Trocar fusível';
        btn.style.marginTop = '8px';
        btn.style.width = '100%';
        btn.addEventListener('click', () => {
          comp.propriedades.queimado = false;
          registrar(estado.circuito, 'trocar-fusivel', true);
          aoMudar();
          if (typeof estado.recalcular === 'function') estado.recalcular();
        });
        secaoProps.appendChild(btn);
      }
    }

    secoes.push(secaoProps);
  }

  // Rotação
  secoes.push(criarSecaoRotacao(comp, aoMudar, estado.circuito));

  // Ver montagem
  if (def.montagem) {
    const secaoMontagem = document.createElement('div');
    secaoMontagem.className = 'painel-secao popup-secao';

    const btnMontagem = document.createElement('button');
    btnMontagem.type = 'button';
    btnMontagem.className = 'btn-montagem';
    btnMontagem.innerHTML = `
      <span class="btn-montagem__icone">◈</span>
      <span>Ver montagem</span>
    `;
    btnMontagem.addEventListener('click', () => {
      if (aoVerMontagem) aoVerMontagem(comp);
    });

    secaoMontagem.appendChild(btnMontagem);

    const nota = document.createElement('p');
    nota.className = 'painel-nota';
    nota.textContent = 'Veja como este componente é construído internamente.';
    secaoMontagem.appendChild(nota);

    secoes.push(secaoMontagem);
  }

  // Insere as seções com o divisor popup-divisor (85% de largura) entre elas
  secoes.forEach((secao, i) => {
    if (i > 0) {
      const divisor = document.createElement('div');
      divisor.className = 'popup-divisor';
      container.appendChild(divisor);
    }
    container.appendChild(secao);
  });

  // Remover
  const btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'btn-remover';
  btnRemover.textContent = 'Remover componente';
  btnRemover.addEventListener('click', () => {
    if (typeof estado.removerComponentePorId === 'function') {
      estado.removerComponentePorId(comp.id);
    } else {
      estado.removerSelecionados();
    }
  });
  container.appendChild(btnRemover);
}

/**
 * Monta as propriedades de um fio dentro do container do popup.
 */
export function montarPropriedadesFio(corpo, fio, estado, aoMudar) {
  corpo.innerHTML = '';
  if (!fio) return;

  const header = document.createElement('div');
  header.className = 'painel-header';
  const titulo = document.createElement('h3');
  titulo.className = 'painel-titulo';
  titulo.textContent = 'Fio';
  header.appendChild(titulo);
  const badge = document.createElement('span');
  badge.className = 'painel-categoria';
  badge.textContent = 'Conexão';
  header.appendChild(badge);
  corpo.appendChild(header);

  const secaoProps = document.createElement('div');
  secaoProps.className = 'painel-secao popup-secao painel-secao--primeira';

  const tituloProps = document.createElement('h4');
  tituloProps.textContent = 'Propriedades';
  secaoProps.appendChild(tituloProps);

  // Seletor de cor do fio (input type=color)
  const campoCor = document.createElement('div');
  campoCor.className = 'painel-campo';
  const labelCor = document.createElement('label');
  labelCor.textContent = 'Cor do fio';
  campoCor.appendChild(labelCor);

  const linhaCor = document.createElement('div');
  linhaCor.className = 'painel-campo-linha';
  const inputCor = document.createElement('input');
  inputCor.type = 'color';
  inputCor.value = fio.cor || CORES_FIO[0];
  linhaCor.appendChild(inputCor);

  const hintCor = document.createElement('span');
  hintCor.className = 'painel-campo-hint painel-campo-hint--mono';
  hintCor.textContent = (fio.cor || CORES_FIO[0]).toUpperCase();
  linhaCor.appendChild(hintCor);

  inputCor.addEventListener('input', () => {
    fio.cor = inputCor.value;
    hintCor.textContent = inputCor.value.toUpperCase();
    registrar(estado.circuito, 'cor-fio', true);
    if (aoMudar) aoMudar();
  });

  campoCor.appendChild(linhaCor);

  // Paleta rápida de cores do fio
  const paleta = document.createElement('div');
  paleta.className = 'paleta-cores';
  for (const cor of CORES_FIO) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'cor-fio';
    botao.dataset.cor = cor;
    botao.style.background = cor;
    botao.title = cor;
    botao.setAttribute('aria-label', `Cor ${cor}`);
    botao.setAttribute('aria-pressed', String(fio.cor === cor));
    botao.addEventListener('click', () => {
      if (fio.cor === cor) return;
      fio.cor = cor;
      inputCor.value = cor;
      hintCor.textContent = cor.toUpperCase();
      registrar(estado.circuito, 'cor-fio', true);
      if (aoMudar) aoMudar();
    });
    paleta.appendChild(botao);
  }
  campoCor.appendChild(paleta);
  secaoProps.appendChild(campoCor);

  // Espessura (input number, mínimo 1, máximo 6)
  const campoEsp = document.createElement('div');
  campoEsp.className = 'painel-campo';
  const labelEsp = document.createElement('label');
  labelEsp.textContent = 'Espessura';
  campoEsp.appendChild(labelEsp);

  const linhaEsp = document.createElement('div');
  linhaEsp.className = 'painel-campo-linha';
  const inputEsp = document.createElement('input');
  inputEsp.type = 'number';
  inputEsp.min = 1;
  inputEsp.max = 6;
  inputEsp.step = 1;
  inputEsp.value = fio.espessura || 2;
  linhaEsp.appendChild(inputEsp);

  const hintEsp = document.createElement('span');
  hintEsp.className = 'painel-campo-hint';
  hintEsp.textContent = `${fio.espessura || 2} px`;
  linhaEsp.appendChild(hintEsp);

  inputEsp.addEventListener('input', () => {
    const v = Math.max(1, Math.min(6, parseFloat(inputEsp.value) || 2));
    fio.espessura = v;
    hintEsp.textContent = `${v} px`;
    registrar(estado.circuito, 'espessura-fio', true);
    if (aoMudar) aoMudar();
  });

  campoEsp.appendChild(linhaEsp);
  secaoProps.appendChild(campoEsp);
  corpo.appendChild(secaoProps);

  // Botão "Remover fio"
  const btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'btn-remover';
  btnRemover.textContent = 'Remover fio';
  btnRemover.addEventListener('click', () => {
    if (typeof estado?.removerFioPorId === 'function') {
      estado.removerFioPorId(fio.id);
    } else if (estado?.circuito) {
      removerFio(estado.circuito, fio.id);
      if (aoMudar) aoMudar();
    }
  });
  corpo.appendChild(btnRemover);
}

/**
 * Conta as ligações (fios) reais cujas duas pontas pertencem a componentes do grupo.
 * Com zero fios no circuito ou sem fios entre membros, retorna obrigatoriamente 0.
 */
export function contarLigacoesDoGrupo(grupo, circuito) {
  const membros = grupo?.membros || [];
  const grupos = (circuito && Array.isArray(circuito.grupos)) ? circuito.grupos : [];
  const fios = (circuito && Array.isArray(circuito.fios)) ? circuito.fios : [];

  const idsMembros = new Set(
    membros
      .filter((m) => {
        if (!m) return false;
        if (typeof m === 'object') return m.tipo !== 'fio' && m.tipo !== 'grupo';
        const ehGrupo = grupos.some((g) => g.id === m);
        const ehFio = fios.some((f) => f.id === m);
        return !ehGrupo && !ehFio;
      })
      .map((m) => (typeof m === 'string' ? m : m.id))
  );

  if (idsMembros.size === 0) return 0;
  if (fios.length === 0) return 0;

  let total = 0;
  for (const fio of fios) {
    if (!fio) continue;
    const pontaA = fio.origem || fio.a || fio.inicio;
    const pontaB = fio.destino || fio.b || fio.fim;
    if (!pontaA || !pontaB) continue;
    const idA = pontaA.componente ?? pontaA.componenteId ?? pontaA.compId ?? pontaA.idComponente;
    const idB = pontaB.componente ?? pontaB.componenteId ?? pontaB.compId ?? pontaB.idComponente;
    if (idA == null || idB == null) continue;
    if (idsMembros.has(idA) && idsMembros.has(idB)) total++;
  }
  return total;
}

/**
 * Monta as propriedades de uma área (grupo) dentro do container do popup.
 */
export function montarPropriedadesArea(corpo, area, estado, aoMudar) {
  corpo.innerHTML = '';
  if (!area) return;

  // Garante a classe de escopo no popup pai
  if (corpo.parentElement) {
    corpo.parentElement.classList.add('popup-grupo');
  }

  // Contagem de itens em barra verde
  const membros = area.membros || [];
  const grupos = estado?.circuito?.grupos || [];
  const fios = estado?.circuito?.fios || [];

  const qtdComponentes = membros.filter((m) => {
    if (!m) return false;
    if (typeof m === 'object') return m.tipo !== 'fio' && m.tipo !== 'grupo';
    const ehGrupo = grupos.some((g) => g.id === m);
    const ehFio = fios.some((f) => f.id === m);
    return !ehGrupo && !ehFio;
  }).length;

  const qtdLigacoes = contarLigacoesDoGrupo(area, estado?.circuito);

  const badgeContagem = document.createElement('div');
  badgeContagem.className = 'popup-contagem-grupo';
  badgeContagem.textContent = `${qtdComponentes} Componentes; ${qtdLigacoes} Ligações`;
  corpo.appendChild(badgeContagem);

  const secaoProps = document.createElement('div');
  secaoProps.className = 'painel-secao popup-secao painel-secao--primeira';

  // Seletor de cor da área (input type=color)
  const campoCor = document.createElement('div');
  campoCor.className = 'painel-campo popup-campo';
  const labelCor = document.createElement('label');
  labelCor.textContent = 'Cor da área';
  campoCor.appendChild(labelCor);

  const linhaCor = document.createElement('div');
  linhaCor.className = 'painel-campo-linha';
  const inputCor = document.createElement('input');
  inputCor.type = 'color';
  inputCor.value = area.cor || CORES_GRUPO[0];
  linhaCor.appendChild(inputCor);

  const hintCor = document.createElement('span');
  hintCor.className = 'painel-campo-hint painel-campo-hint--mono';
  hintCor.textContent = (area.cor || CORES_GRUPO[0]).toUpperCase();
  linhaCor.appendChild(hintCor);

  campoCor.appendChild(linhaCor);

  // Paleta de bolinhas de cor (2 linhas de 5)
  const paletaGrupo = document.createElement('div');
  paletaGrupo.className = 'popup-cores';
  for (const cor of CORES_GRUPO) {
    const botaoCor = document.createElement('button');
    botaoCor.type = 'button';
    botaoCor.className = 'popup-cor-bolinha' + (area.cor === cor ? ' selecionada' : '');
    botaoCor.style.background = cor;
    botaoCor.title = cor;
    botaoCor.setAttribute('aria-label', `Cor ${cor}`);
    botaoCor.setAttribute('aria-pressed', String(area.cor === cor));
    botaoCor.addEventListener('click', () => {
      if (area.cor === cor) return;
      area.cor = cor;
      inputCor.value = cor;
      hintCor.textContent = cor.toUpperCase();
      paletaGrupo.querySelectorAll('.popup-cor-bolinha').forEach((b) => b.classList.remove('selecionada'));
      botaoCor.classList.add('selecionada');
      registrar(estado.circuito, 'cor-grupo', true);
      if (aoMudar) aoMudar();
    });
    paletaGrupo.appendChild(botaoCor);
  }

  inputCor.addEventListener('input', () => {
    area.cor = inputCor.value;
    hintCor.textContent = inputCor.value.toUpperCase();
    paletaGrupo.querySelectorAll('.popup-cor-bolinha').forEach((b) => {
      b.classList.toggle('selecionada', b.title.toLowerCase() === inputCor.value.toLowerCase());
    });
    registrar(estado.circuito, 'cor-grupo', true);
    if (aoMudar) aoMudar();
  });

  campoCor.appendChild(paletaGrupo);
  secaoProps.appendChild(campoCor);

  corpo.appendChild(secaoProps);

  // Botão "Remover área"
  const btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'btn-remover';
  btnRemover.textContent = 'Remover área';
  btnRemover.addEventListener('click', () => {
    if (typeof estado?.removerAreaPorId === 'function') {
      estado.removerAreaPorId(area.id);
    } else if (estado?.circuito) {
      desfazerGrupo(estado.circuito, area.id);
      if (aoMudar) aoMudar();
    }
  });
  corpo.appendChild(btnRemover);
}

/**
 * Renderiza o painel de propriedades.
 * @param {HTMLElement} container
 * @param {object} estado - estado da aplicação
 * @param {function} aoMudar - callback para re-renderizar
 * @param {function} aoVerMontagem - callback para abrir "Ver montagem"
 */
export function renderizarPainel(container, estado, aoMudar, aoVerMontagem) {
  if (!container) return;
  container.innerHTML = '';

  if (estado.fioSelecionadoId) {
    const fio = estado.circuito.fios.find((item) => item.id === estado.fioSelecionadoId);
    if (fio) {
      const header = document.createElement('div');
      header.className = 'painel-header';
      const titulo = document.createElement('h3');
      titulo.className = 'painel-titulo';
      titulo.textContent = 'Fio';
      header.appendChild(titulo);
      container.appendChild(header);

      const secao = document.createElement('div');
      secao.className = 'painel-secao painel-secao--primeira';
      const tituloCores = document.createElement('h4');
      tituloCores.textContent = 'Cor';
      secao.appendChild(tituloCores);

      const paleta = document.createElement('div');
      paleta.className = 'paleta-cores';
      for (const cor of CORES_FIO) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'cor-fio';
        botao.dataset.cor = cor;
        botao.style.background = cor;
        botao.title = cor;
        botao.setAttribute('aria-label', `Cor ${cor}`);
        botao.setAttribute('aria-pressed', String(fio.cor === cor));
        botao.addEventListener('click', () => {
          if (fio.cor === cor) return;
          fio.cor = cor;
          registrar(estado.circuito, 'cor-fio', true);
          aoMudar();
        });
        paleta.appendChild(botao);
      }
      secao.appendChild(paleta);
      container.appendChild(secao);
      return;
    }
  }

  if (estado.selecionados.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'painel-vazio';
    vazio.innerHTML = `
      <p>Nenhum componente selecionado</p>
      <p class="painel-vazio-dica">Clique em um componente para editar suas propriedades</p>
    `;
    container.appendChild(vazio);
    return;
  }

  if (estado.selecionados.length > 1) {
    const titulo = document.createElement('h3');
    titulo.className = 'painel-titulo';
    titulo.textContent = `${estado.selecionados.length} componentes`;
    container.appendChild(titulo);

    const nota = document.createElement('p');
    nota.className = 'painel-nota';
    nota.textContent = 'Selecione apenas um componente para editar propriedades individuais.';
    container.appendChild(nota);

    const secaoRot = document.createElement('div');
    secaoRot.className = 'painel-secao';

    const tituloRot = document.createElement('h4');
    tituloRot.textContent = 'Rotação em grupo';
    secaoRot.appendChild(tituloRot);

    const grupo = document.createElement('div');
    grupo.className = 'painel-rotacao';

    const btnEsq = document.createElement('button');
    btnEsq.type = 'button';
    btnEsq.className = 'btn-rot';
    btnEsq.textContent = '↺ 90°';
    btnEsq.addEventListener('click', () => {
      for (const id of estado.selecionados) {
        const c = estado.circuito.componentes.find((x) => x.id === id);
        if (c) c.rotacao = ((c.rotacao - 90) % 360 + 360) % 360;
      }
      registrar(estado.circuito, 'rotacionar', true);
      aoMudar();
    });
    grupo.appendChild(btnEsq);

    const btnDir = document.createElement('button');
    btnDir.type = 'button';
    btnDir.className = 'btn-rot';
    btnDir.textContent = '↻ 90°';
    btnDir.addEventListener('click', () => {
      for (const id of estado.selecionados) {
        const c = estado.circuito.componentes.find((x) => x.id === id);
        if (c) c.rotacao = ((c.rotacao + 90) % 360 + 360) % 360;
      }
      registrar(estado.circuito, 'rotacionar', true);
      aoMudar();
    });
    grupo.appendChild(btnDir);

    secaoRot.appendChild(grupo);
    container.appendChild(secaoRot);

    const btnRemover = document.createElement('button');
    btnRemover.type = 'button';
    btnRemover.className = 'btn-remover';
    btnRemover.textContent = `Remover ${estado.selecionados.length} componentes`;
    btnRemover.addEventListener('click', () => estado.removerSelecionados());
    container.appendChild(btnRemover);
    return;
  }

  const comp = estado.circuito.componentes.find((c) => c.id === estado.selecionados[0]);
  if (!comp) return;

  const def = CATALOGO[comp.tipo];
  if (!def) return;
  if (!comp.propriedades) {
    comp.propriedades = Object.fromEntries(
      Object.entries(def.propriedades || {}).map(([chave, spec]) => [chave, spec.valor])
    );
  }

  // Cabeçalho
  const header = document.createElement('div');
  header.className = 'painel-header';

  const titulo = document.createElement('h3');
  titulo.className = 'painel-titulo';
  titulo.textContent = def.rotulo;
  header.appendChild(titulo);

  const categoria = document.createElement('span');
  categoria.className = 'painel-categoria';
  categoria.textContent = def.categoria;
  header.appendChild(categoria);

  container.appendChild(header);

  const secoes = [];

  // Cor do LED com 10 opções pré-definidas
  if (comp.tipo === 'LED') {
    const secaoCor = document.createElement('div');
    secaoCor.className = 'popup-secao';

    const tituloCor = document.createElement('div');
    tituloCor.className = 'popup-secao-titulo';
    tituloCor.textContent = 'Cor';
    secaoCor.appendChild(tituloCor);

    const corAtual = (comp.propriedades?.cor || comp.cor || CORES_LED[0]).toUpperCase();
    const paleta = document.createElement('div');
    paleta.className = 'popup-cores';

    for (const cor of CORES_LED) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'popup-cor-bolinha' + (cor.toUpperCase() === corAtual ? ' selecionada' : '');
      btn.dataset.cor = cor;
      btn.style.background = cor;
      btn.title = cor;
      btn.addEventListener('click', () => {
        comp.cor = cor;
        if (comp.propriedades) comp.propriedades.cor = cor;
        paleta.querySelectorAll('.popup-cor-bolinha').forEach((b) => b.classList.remove('selecionada'));
        btn.classList.add('selecionada');
        registrar(estado.circuito, 'propriedade', true);
        if (aoMudar) aoMudar();
      });
      paleta.appendChild(btn);
    }

    secaoCor.appendChild(paleta);
    secoes.push(secaoCor);
  }

  // Propriedades
  let props = Object.entries(def.propriedades || {});
  if (comp.tipo === 'LED') {
    props = props.filter(([chave]) => chave !== 'cor');
  }
  if (props.length > 0) {
    const secaoProps = document.createElement('div');
    secaoProps.className = 'painel-secao popup-secao painel-secao--primeira';

    const tituloProps = document.createElement('h4');
    tituloProps.textContent = 'Propriedades';
    secaoProps.appendChild(tituloProps);

    for (const [chave, spec] of props) {
      secaoProps.appendChild(criarCampo(chave, spec, comp, aoMudar, estado.circuito));
    }

    if (comp.tipo === 'FUSIVEL') {
      const status = document.createElement('div');
      status.className = 'prop-status';
      status.innerHTML = comp.propriedades?.queimado
        ? '<span style="color:#c0392b; font-weight:700;">● QUEIMADO</span>'
        : '<span style="color:#53b588; font-weight:600;">● Íntegro</span>';
      secaoProps.appendChild(status);

      if (comp.propriedades?.queimado) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-toolbar';
        btn.textContent = 'Trocar fusível';
        btn.style.marginTop = '8px';
        btn.style.width = '100%';
        btn.addEventListener('click', () => {
          comp.propriedades.queimado = false;
          registrar(estado.circuito, 'trocar-fusivel', true);
          aoMudar();
          if (typeof estado.recalcular === 'function') estado.recalcular();
        });
        secaoProps.appendChild(btn);
      }
    }

    secoes.push(secaoProps);
  }

  // Rotação
  secoes.push(criarSecaoRotacao(comp, aoMudar, estado.circuito));

  // Ver montagem
  if (def.montagem) {
    const secaoMontagem = document.createElement('div');
    secaoMontagem.className = 'painel-secao popup-secao';

    const btnMontagem = document.createElement('button');
    btnMontagem.type = 'button';
    btnMontagem.className = 'btn-montagem';
    btnMontagem.innerHTML = `
      <span class="btn-montagem__icone">◈</span>
      <span>Ver montagem</span>
    `;
    btnMontagem.addEventListener('click', () => {
      if (aoVerMontagem) aoVerMontagem(comp);
    });

    secaoMontagem.appendChild(btnMontagem);

    const nota = document.createElement('p');
    nota.className = 'painel-nota';
    nota.textContent = 'Veja como este componente é construído internamente.';
    secaoMontagem.appendChild(nota);

    secoes.push(secaoMontagem);
  }

  // Insere as seções com o divisor popup-divisor (85% de largura) entre elas
  secoes.forEach((secao, i) => {
    if (i > 0) {
      const divisor = document.createElement('div');
      divisor.className = 'popup-divisor';
      container.appendChild(divisor);
    }
    container.appendChild(secao);
  });

  // Remover
  const btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'btn-remover';
  btnRemover.textContent = 'Remover componente';
  btnRemover.addEventListener('click', () => estado.removerSelecionados());
  container.appendChild(btnRemover);
}

export function montarListaComandos(corpo) {
  corpo.innerHTML = '';
  const COMANDOS = [
    { teclas: ['Ctrl', 'Z'], acao: 'Desfazer' },
    { teclas: ['Ctrl', 'Y'], acao: 'Refazer' },
    { teclas: ['Ctrl', 'S'], acao: 'Salvar' },
    { teclas: ['Ctrl', 'O'], acao: 'Abrir' },
    { teclas: ['Ctrl', 'C'], acao: 'Copiar' },
    { teclas: ['Ctrl', 'V'], acao: 'Colar' },
    { teclas: ['Ctrl', 'D'], acao: 'Duplicar' },
    { teclas: ['Tab'], acao: 'Criar dobra no fio' },
    { teclas: ['Del'], acao: 'Remover seleção' },
    { teclas: ['R'], acao: 'Girar 90°' },
    { teclas: ['Esc'], acao: 'Cancelar / desselecionar' },
  ];

  const lista = document.createElement('div');
  lista.className = 'lista-comandos';
  for (const item of COMANDOS) {
    const linha = document.createElement('div');
    linha.className = 'linha-comando';

    const kbdWrap = document.createElement('div');
    kbdWrap.className = 'comando-teclas';
    item.teclas.forEach((t, i) => {
      if (i > 0) {
        const plus = document.createElement('span');
        plus.className = 'comando-plus';
        plus.textContent = '+';
        kbdWrap.appendChild(plus);
      }
      const kbd = document.createElement('kbd');
      kbd.textContent = t;
      kbdWrap.appendChild(kbd);
    });

    const desc = document.createElement('span');
    desc.className = 'comando-acao';
    desc.textContent = item.acao;

    linha.appendChild(kbdWrap);
    linha.appendChild(desc);
    lista.appendChild(linha);
  }
  corpo.appendChild(lista);
}

/**
 * Monta o corpo do popup de equivalência "Construir".
 */
export function montarCorpoConstruir(corpo, resultado, estado, aoSubstituir, aoManter) {
  corpo.innerHTML = '';
  if (!resultado) return;

  const aviso = document.createElement('div');
  aviso.className = 'popup-construir-aviso';
  aviso.textContent = 'Esta configuração é equivalente a:';
  corpo.appendChild(aviso);

  const alvo = document.createElement('div');
  alvo.className = 'popup-construir-alvo';
  alvo.textContent = resultado.nome || resultado.alvo;
  corpo.appendChild(alvo);

  const desc = document.createElement('div');
  desc.className = 'popup-construir-descricao';
  desc.textContent = resultado.descricao || '';
  corpo.appendChild(desc);

  // Prévia visual do componente alvo
  const previewContainer = document.createElement('div');
  previewContainer.className = 'popup-construir-preview';
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = 120;
  previewCanvas.height = 70;
  previewCanvas.style.width = '120px';
  previewCanvas.style.height = '70px';
  const pctx = previewCanvas.getContext('2d');
  if (pctx) {
    const dimAlvo = CATALOGO[resultado.alvo]?.dimensoes || { w: 60, h: 40 };
    const compFake = {
      tipo: resultado.alvo,
      x: 0,
      y: 0,
      rotacao: 0,
      propriedades: {},
      dimensoes: dimAlvo,
    };
    const telaX = Math.round((previewCanvas.width - dimAlvo.w) / 2);
    const telaY = Math.round((previewCanvas.height - dimAlvo.h) / 2);
    desenharComponente(pctx, compFake, telaX, telaY, 1);
  }
  previewContainer.appendChild(previewCanvas);
  corpo.appendChild(previewContainer);

  // Ações: Substituir e Manter atual
  const acoes = document.createElement('div');
  acoes.className = 'popup-construir-acoes';

  const btnSubstituir = document.createElement('button');
  btnSubstituir.type = 'button';
  btnSubstituir.className = 'popup-construir-btn-substituir';
  btnSubstituir.textContent = 'Substituir';
  btnSubstituir.addEventListener('click', () => {
    executarSubstituicaoConstruir(resultado, estado);
    if (aoSubstituir) aoSubstituir();
  });

  const btnManter = document.createElement('button');
  btnManter.type = 'button';
  btnManter.className = 'popup-construir-btn-manter';
  btnManter.textContent = 'Manter atual';
  btnManter.addEventListener('click', () => {
    if (aoManter) aoManter();
  });

  acoes.appendChild(btnSubstituir);
  acoes.appendChild(btnManter);
  corpo.appendChild(acoes);
}
