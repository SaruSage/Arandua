/**
 * painel.js — Painel de propriedades do componente selecionado.
 * Gera campos a partir do catálogo, com unidades, validação e
 * botão "Ver montagem" para componentes compostos.
 */

import { CATALOGO } from './catalogo.js';
import { rotacionarComponente } from './circuito.js';
import { registrar } from './historico.js';
import { CORES_FIO } from './fios.js';

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
    wrapper.className = 'painel-campo-linha';

    input = document.createElement('input');
    input.type = 'color';
    input.value = comp.propriedades[chave];
    wrapper.appendChild(input);

    const hint = document.createElement('span');
    hint.className = 'painel-campo-hint painel-campo-hint--mono';
    hint.textContent = comp.propriedades[chave].toUpperCase();
    wrapper.appendChild(hint);

    input.addEventListener('input', () => {
      comp.propriedades[chave] = input.value;
      registrar(circuito, 'propriedade');
      hint.textContent = input.value.toUpperCase();
      aoMudar();
    });

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

/** Cria a seção de rotação. */
function criarSecaoRotacao(comp, aoMudar, circuito) {
  const secao = document.createElement('div');
  secao.className = 'painel-secao';

  const titulo = document.createElement('h4');
  titulo.textContent = 'Rotação';
  secao.appendChild(titulo);

  const grupo = document.createElement('div');
  grupo.className = 'painel-rotacao';

  const btnEsq = document.createElement('button');
  btnEsq.type = 'button';
  btnEsq.className = 'btn-rot';
  btnEsq.textContent = '↺';
  btnEsq.title = 'Girar 90° à esquerda';
  btnEsq.addEventListener('click', () => {
    rotacionarComponente({ componentes: [comp] }, comp.id, comp.rotacao - 90);
    registrar(circuito, 'rotacionar', true);
    aoMudar();
  });
  grupo.appendChild(btnEsq);

  const inputAng = document.createElement('input');
  inputAng.type = 'number';
  inputAng.value = comp.rotacao;
  inputAng.min = 0;
  inputAng.max = 359;
  inputAng.step = 1;
  inputAng.className = 'input-angulo';
  inputAng.title = 'Ângulo em graus';
  inputAng.addEventListener('input', () => {
    const v = parseInt(inputAng.value, 10) || 0;
    comp.rotacao = ((v % 360) + 360) % 360;
    registrar(circuito, 'rotacionar', true);
    aoMudar();
  });
  grupo.appendChild(inputAng);

  const sufixo = document.createElement('span');
  sufixo.className = 'painel-campo-hint';
  sufixo.textContent = '°';
  grupo.appendChild(sufixo);

  const btnDir = document.createElement('button');
  btnDir.type = 'button';
  btnDir.className = 'btn-rot';
  btnDir.textContent = '↻';
  btnDir.title = 'Girar 90° à direita';
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

  // Cabeçalho interno com rótulo e categoria
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

  // Propriedades
  const props = Object.entries(def.propriedades || {});
  if (props.length > 0) {
    const secaoProps = document.createElement('div');
    secaoProps.className = 'painel-secao painel-secao--primeira';

    const tituloProps = document.createElement('h4');
    tituloProps.textContent = 'Propriedades';
    secaoProps.appendChild(tituloProps);

    for (const [chave, spec] of props) {
      secaoProps.appendChild(criarCampo(chave, spec, comp, aoMudar, estado.circuito));
    }

    container.appendChild(secaoProps);
  }

  if (comp.tipo === 'FUSIVEL') {
    const status = document.createElement('div');
    status.className = 'prop-status';
    status.innerHTML = comp.propriedades?.queimado
      ? '<span style="color:#c0392b; font-weight:700;">● QUEIMADO</span>'
      : '<span style="color:#53b588; font-weight:600;">● Íntegro</span>';
    container.appendChild(status);

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
      container.appendChild(btn);
    }
  }

  // Rotação
  container.appendChild(criarSecaoRotacao(comp, aoMudar, estado.circuito));

  // Ver montagem
  if (def.montagem) {
    const secaoMontagem = document.createElement('div');
    secaoMontagem.className = 'painel-secao';

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

    container.appendChild(secaoMontagem);
  }

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

  // Propriedades
  const props = Object.entries(def.propriedades || {});
  if (props.length > 0) {
    const secaoProps = document.createElement('div');
    secaoProps.className = 'painel-secao painel-secao--primeira';

    const tituloProps = document.createElement('h4');
    tituloProps.textContent = 'Propriedades';
    secaoProps.appendChild(tituloProps);

    for (const [chave, spec] of props) {
      secaoProps.appendChild(criarCampo(chave, spec, comp, aoMudar, estado.circuito));
    }

    container.appendChild(secaoProps);
  }

  if (comp.tipo === 'FUSIVEL') {
    const status = document.createElement('div');
    status.className = 'prop-status';
    status.innerHTML = comp.propriedades?.queimado
      ? '<span style="color:#c0392b; font-weight:700;">● QUEIMADO</span>'
      : '<span style="color:#53b588; font-weight:600;">● Íntegro</span>';
    container.appendChild(status);

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
      container.appendChild(btn);
    }
  }

  // Rotação
  container.appendChild(criarSecaoRotacao(comp, aoMudar, estado.circuito));

  // Ver montagem
  if (def.montagem) {
    const secaoMontagem = document.createElement('div');
    secaoMontagem.className = 'painel-secao';

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

    container.appendChild(secaoMontagem);
  }

  // Remover
  const btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'btn-remover';
  btnRemover.textContent = 'Remover componente';
  btnRemover.addEventListener('click', () => estado.removerSelecionados());
  container.appendChild(btnRemover);
}
