function formatarBinario(valor) {
  return valor.toString(2);
}

function formatarBCD(valor) {
  return String(valor)
    .split('')
    .map((digito) => Number(digito).toString(2).padStart(4, '0'))
    .join(' ');
}

function formatarGray(valor) {
  return (valor ^ (valor >> 1)).toString(2).padStart(4, '0');
}

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

export function inicializarM2(container) {
  container.innerHTML = `
    <section class="widget-bloco" aria-labelledby="m2-titulo-bases">
      <h3 id="m2-titulo-bases">Conversor de bases</h3>
      <div class="widget-controles">
        <label class="propriedades-campo" for="m2-valor">Valor
          <input id="m2-valor" type="text" inputmode="text" value="255" autocomplete="off">
        </label>
        <label class="propriedades-campo" for="m2-base">Base de entrada
          <select id="m2-base">
            <option value="2">Binário</option>
            <option value="10" selected>Decimal</option>
            <option value="8">Octal</option>
            <option value="16">Hexadecimal</option>
          </select>
        </label>
      </div>
      <p class="widget-erro" id="m2-erro" role="status" aria-live="polite"></p>
      <div class="widget-bases" id="m2-bases" aria-live="polite"></div>
    </section>
    <section class="widget-bloco" aria-labelledby="m2-titulo-codigos">
      <h3 id="m2-titulo-codigos">Códigos BCD, Gray e ASCII</h3>
      <div class="widget-controles">
        <label class="propriedades-campo" for="m2-digito">Dígito (0 a 9)
          <input id="m2-digito" type="number" min="0" max="9" step="1" value="5">
        </label>
        <label class="propriedades-campo" for="m2-caractere">Caractere ASCII
          <input id="m2-caractere" type="text" maxlength="2" value="A" autocomplete="off">
        </label>
      </div>
      <p id="m2-codigo-numero" class="widget-resultado" aria-live="polite"></p>
      <p id="m2-codigo-ascii" class="widget-resultado" aria-live="polite"></p>
    </section>
    <section class="widget-bloco" aria-labelledby="m2-titulo-tabela">
      <h3 id="m2-titulo-tabela">Tabela de 0 a 15</h3>
      <button class="btn btn--ghost" id="m2-gerar-tabela" type="button">Gerar tabela completa</button>
      <div class="widget-tabela-scroll" id="m2-tabela-container"></div>
    </section>
  `;

  const campoValor = container.querySelector('#m2-valor');
  const campoBase = container.querySelector('#m2-base');
  const erro = container.querySelector('#m2-erro');
  const bases = container.querySelector('#m2-bases');
  const nomesBases = [
    { nome: 'Binário', base: 2 },
    { nome: 'Decimal', base: 10 },
    { nome: 'Octal', base: 8 },
    { nome: 'Hexadecimal', base: 16 },
  ];

  function atualizarBases() {
    const texto = campoValor.value.trim();
    const base = Number(campoBase.value);
    const padroes = {
      2: /^[01]+$/,
      8: /^[0-7]+$/,
      10: /^\d+$/,
      16: /^[\da-f]+$/i,
    };

    if (!texto || !padroes[base].test(texto)) {
      erro.textContent = `Valor inválido para a base ${base}.`;
      bases.replaceChildren();
      return;
    }

    const numero = Number.parseInt(texto, base);
    if (!Number.isSafeInteger(numero)) {
      erro.textContent = 'O valor é grande demais para converter com segurança.';
      bases.replaceChildren();
      return;
    }

    erro.textContent = '';
    bases.replaceChildren();
    nomesBases.forEach(({ nome, base: baseSaida }) => {
      const cartao = document.createElement('article');
      cartao.className = 'widget-base-card';
      const titulo = document.createElement('h4');
      titulo.textContent = nome;
      const valor = document.createElement('code');
      valor.textContent = numero.toString(baseSaida).toUpperCase();
      cartao.append(titulo, valor);
      bases.append(cartao);
    });
  }

  const campoDigito = container.querySelector('#m2-digito');
  const campoCaractere = container.querySelector('#m2-caractere');
  const codigoNumero = container.querySelector('#m2-codigo-numero');
  const codigoAscii = container.querySelector('#m2-codigo-ascii');

  function atualizarCodigos() {
    const digito = Number(campoDigito.value);
    if (Number.isInteger(digito) && digito >= 0 && digito <= 9) {
      codigoNumero.textContent = `BCD: ${digito.toString(2).padStart(4, '0')} · Gray: ${formatarGray(digito)}`;
    } else {
      codigoNumero.textContent = 'Digite um número inteiro de 0 a 9.';
    }

    const caractere = campoCaractere.value;
    if (caractere.length === 1 && caractere.charCodeAt(0) <= 127) {
      const codigo = caractere.charCodeAt(0);
      codigoAscii.textContent = `ASCII de “${caractere}”: ${codigo.toString(2).padStart(7, '0')} (binário) · ${codigo.toString(16).padStart(2, '0').toUpperCase()} (hexadecimal)`;
    } else {
      codigoAscii.textContent = 'Digite um único caractere ASCII (código de 0 a 127).';
    }
  }

  campoValor.addEventListener('input', atualizarBases);
  campoBase.addEventListener('change', atualizarBases);
  campoDigito.addEventListener('input', atualizarCodigos);
  campoCaractere.addEventListener('input', atualizarCodigos);
  container.querySelector('#m2-gerar-tabela').addEventListener('click', () => {
    const tabelaContainer = container.querySelector('#m2-tabela-container');
    const tabela = document.createElement('table');
    tabela.className = 'widget-tabela-dados';
    const cabecalho = document.createElement('thead');
    cabecalho.innerHTML = '<tr><th scope="col">Decimal</th><th scope="col">Binário</th><th scope="col">Octal</th><th scope="col">Hex</th><th scope="col">BCD</th><th scope="col">Gray</th></tr>';
    const corpo = document.createElement('tbody');

    for (let valor = 0; valor < 16; valor++) {
      const linha = document.createElement('tr');
      const colunas = [
        String(valor),
        formatarBinario(valor).padStart(4, '0'),
        valor.toString(8),
        valor.toString(16).toUpperCase(),
        formatarBCD(valor),
        formatarGray(valor),
      ];
      colunas.forEach((texto) => {
        const celula = document.createElement('td');
        celula.textContent = texto;
        linha.append(celula);
      });
      corpo.append(linha);
    }

    tabela.append(cabecalho, corpo);
    tabelaContainer.replaceChildren(tabela);
  });

  atualizarBases();
  atualizarCodigos();
  configurarExercicios(container);
}
