import { tabelaVerdade } from '../core/gate.js';

const ORDEM_GRAY = [0, 1, 3, 2];
const NOMES_VARIAVEIS = ['A', 'B', 'C', 'D'];

function configurarExercicios(container) {
  const principal = container.closest('main');
  principal?.querySelectorAll('.widget-exercicio').forEach((formulario) => {
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const resposta = formulario.querySelector('input[type="radio"]:checked');
      const retorno = formulario.querySelector('[aria-live="polite"]');
      if (!resposta) {
        retorno.textContent = 'Escolha uma alternativa antes de conferir.';
        retorno.classList.remove('correto');
        return;
      }

      const correto = resposta.value === formulario.dataset.resposta;
      retorno.textContent = correto ? 'Correto! Muito bem.' : 'Ainda não. Reveja a teoria e tente novamente.';
      retorno.classList.toggle('correto', correto);
    });
  });
}

function gerarCandidatos(celulas) {
  const candidatosPorMascara = new Map();

  for (const altura of [1, 2, 4]) {
    for (const largura of [1, 2, 4]) {
      for (let inicioLinha = 0; inicioLinha < 4; inicioLinha++) {
        for (let inicioColuna = 0; inicioColuna < 4; inicioColuna++) {
          const mintermos = [];
          for (let linha = 0; linha < altura; linha++) {
            for (let coluna = 0; coluna < largura; coluna++) {
              const linhaGray = ORDEM_GRAY[(inicioLinha + linha) % 4];
              const colunaGray = ORDEM_GRAY[(inicioColuna + coluna) % 4];
              mintermos.push((linhaGray << 2) | colunaGray);
            }
          }

          if (!mintermos.every((indice) => celulas[indice] === 1)) continue;
          const mascara = mintermos.reduce((resultado, indice) => resultado | (1 << indice), 0);
          const valores = mintermos.map((indice) => [
            (indice >> 3) & 1,
            (indice >> 2) & 1,
            (indice >> 1) & 1,
            indice & 1,
          ]);
          const variaveisFixas = NOMES_VARIAVEIS.map((nome, indice) => {
            const valor = valores[0][indice];
            return valores.every((entrada) => entrada[indice] === valor)
              ? { nome, valor }
              : null;
          }).filter(Boolean);
          const termo = variaveisFixas.map(({ nome, valor }) => (
            valor === 1 ? nome : `${nome}'`
          )).join('') || '1';
          const candidato = {
            mascara,
            termo,
            literais: variaveisFixas.length,
          };
          const existente = candidatosPorMascara.get(mascara);
          if (!existente || candidato.literais < existente.literais) {
            candidatosPorMascara.set(mascara, candidato);
          }
        }
      }
    }
  }

  return [...candidatosPorMascara.values()];
}

function simplificarMapa(celulas) {
  const mascaraCompleta = celulas.reduce(
    (mascara, valor, indice) => valor === 1 ? mascara | (1 << indice) : mascara,
    0,
  );
  if (mascaraCompleta === 0) return 'F = 0';
  if (mascaraCompleta === 0xffff) return 'F = 1';

  const candidatos = gerarCandidatos(celulas);
  const memo = new Map();

  function cobrir(mascaraCoberta) {
    if (mascaraCoberta === mascaraCompleta) return { custo: 0, termos: [] };
    if (memo.has(mascaraCoberta)) return memo.get(mascaraCoberta);

    let opcoesEscolhidas = null;
    for (let indice = 0; indice < 16; indice++) {
      if (!(mascaraCompleta & (1 << indice)) || (mascaraCoberta & (1 << indice))) continue;
      const opcoes = candidatos.filter((candidato) => (
        candidato.mascara & (1 << indice)
      ));
      if (opcoesEscolhidas === null || opcoes.length < opcoesEscolhidas.length) {
        opcoesEscolhidas = opcoes;
      }
    }

    let melhor = null;
    (opcoesEscolhidas || []).forEach((candidato) => {
      const restante = cobrir(mascaraCoberta | candidato.mascara);
      const solucao = {
        custo: restante.custo + 100 + candidato.literais,
        termos: [...restante.termos, candidato.termo],
      };
      if (!melhor || solucao.custo < melhor.custo) melhor = solucao;
    });

    const resultado = melhor || { custo: Infinity, termos: [] };
    memo.set(mascaraCoberta, resultado);
    return resultado;
  }

  const resultado = cobrir(0);
  return `F = ${resultado.termos.join(' + ') || '0'}`;
}

export function inicializarM3(container) {
  container.innerHTML = `
    <section class="widget-bloco" aria-labelledby="m3-titulo-verdade">
      <h3 id="m3-titulo-verdade">Tabela-verdade dinâmica</h3>
      <div class="widget-controles">
        <label class="propriedades-campo" for="m3-operacao">Operação
          <select id="m3-operacao">
            <option>AND</option><option>OR</option><option>NOT</option>
            <option>NAND</option><option>NOR</option><option>XOR</option><option>XNOR</option>
          </select>
        </label>
        <label class="propriedades-campo" for="m3-entradas">Número de entradas
          <select id="m3-entradas">
            <option value="2">2</option><option value="3" selected>3</option><option value="4">4</option>
          </select>
        </label>
      </div>
      <div class="widget-tabela-scroll" id="m3-tabela"></div>
    </section>
    <section class="widget-bloco" aria-labelledby="m3-titulo-karnaugh">
      <h3 id="m3-titulo-karnaugh">Mapa de Karnaugh (4 variáveis)</h3>
      <p>Clique nas células para alternar entre 0 e 1. As bordas do mapa também são adjacentes.</p>
      <div class="widget-karnaugh-legenda" aria-hidden="true">
        <span></span><span>CD 00</span><span>CD 01</span><span>CD 11</span><span>CD 10</span>
      </div>
      <div class="widget-karnaugh" id="m3-mapa" role="group" aria-label="Mapa de Karnaugh: linhas AB e colunas CD"></div>
      <p class="widget-expressao" id="m3-expressao" aria-live="polite">F = 0</p>
      <div class="widget-acoes">
        <button class="btn btn--ghost" id="m3-limpar" type="button">Limpar</button>
        <button class="btn btn--primary" id="m3-exemplo" type="button">Exemplo</button>
      </div>
    </section>
  `;

  const operacao = container.querySelector('#m3-operacao');
  const quantidadeEntradas = container.querySelector('#m3-entradas');
  const tabela = container.querySelector('#m3-tabela');

  function atualizarTabela() {
    const tipo = operacao.value;
    const entradas = Number(quantidadeEntradas.value);
    const linhas = tabelaVerdade(tipo, entradas);
    const tabelaHtml = document.createElement('table');
    tabelaHtml.className = 'widget-tabela-verdade';
    const cabecalho = document.createElement('thead');
    const linhaCabecalho = document.createElement('tr');
    for (let indice = 0; indice < entradas; indice++) {
      const celula = document.createElement('th');
      celula.scope = 'col';
      celula.textContent = `Entrada ${indice + 1}`;
      linhaCabecalho.append(celula);
    }
    const cabecalhoSaida = document.createElement('th');
    cabecalhoSaida.scope = 'col';
    cabecalhoSaida.textContent = 'Saída';
    linhaCabecalho.append(cabecalhoSaida);
    cabecalho.append(linhaCabecalho);

    const corpo = document.createElement('tbody');
    linhas.forEach(({ entradas: valores, saida }) => {
      const linha = document.createElement('tr');
      valores.forEach((valor) => {
        const celula = document.createElement('td');
        celula.textContent = String(valor);
        linha.append(celula);
      });
      const celulaSaida = document.createElement('td');
      celulaSaida.className = `saida-logica${saida === 1 ? ' valor-um' : ''}`;
      celulaSaida.textContent = String(saida);
      linha.append(celulaSaida);
      corpo.append(linha);
    });

    tabelaHtml.append(cabecalho, corpo);
    tabela.replaceChildren(tabelaHtml);
  }

  operacao.addEventListener('change', atualizarTabela);
  quantidadeEntradas.addEventListener('change', atualizarTabela);
  atualizarTabela();

  const mapa = container.querySelector('#m3-mapa');
  const expressao = container.querySelector('#m3-expressao');
  const celulas = Array(16).fill(0);
  const botoes = [];

  function atualizarMapa() {
    celulas.forEach((valor, indice) => {
      const botao = botoes[indice];
      botao.textContent = String(valor);
      botao.classList.toggle('ativo', valor === 1);
      botao.setAttribute('aria-pressed', String(valor === 1));
    });
    expressao.textContent = simplificarMapa(celulas);
  }

  mapa.append(document.createElement('span'));
  ORDEM_GRAY.forEach((valor) => {
    const rotulo = document.createElement('span');
    rotulo.className = 'widget-karnaugh-coluna';
    rotulo.textContent = valor.toString(2).padStart(2, '0');
    mapa.append(rotulo);
  });

  ORDEM_GRAY.forEach((linhaGray) => {
    const rotuloLinha = document.createElement('span');
    rotuloLinha.className = 'widget-karnaugh-linha';
    rotuloLinha.textContent = linhaGray.toString(2).padStart(2, '0');
    mapa.append(rotuloLinha);
    ORDEM_GRAY.forEach((colunaGray) => {
      const mintermo = (linhaGray << 2) | colunaGray;
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'widget-karnaugh-celula';
      botao.setAttribute(
        'aria-label',
        `AB ${linhaGray.toString(2).padStart(2, '0')}, CD ${colunaGray.toString(2).padStart(2, '0')}, saída 0`,
      );
      botao.addEventListener('click', () => {
        celulas[mintermo] = celulas[mintermo] ? 0 : 1;
        botao.setAttribute(
          'aria-label',
          `AB ${linhaGray.toString(2).padStart(2, '0')}, CD ${colunaGray.toString(2).padStart(2, '0')}, saída ${celulas[mintermo]}`,
        );
        atualizarMapa();
      });
      botoes[mintermo] = botao;
      mapa.append(botao);
    });
  });

  container.querySelector('#m3-limpar').addEventListener('click', () => {
    celulas.fill(0);
    atualizarMapa();
  });
  container.querySelector('#m3-exemplo').addEventListener('click', () => {
    celulas.fill(0);
    [0, 1, 2, 3].forEach((indice) => {
      celulas[indice] = 1;
    });
    atualizarMapa();
  });
  atualizarMapa();
  configurarExercicios(container);
}
