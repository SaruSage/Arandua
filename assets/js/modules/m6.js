const EXPLICACOES_FLUXO = [
  'O projeto descreve o comportamento do circuito em uma linguagem de descrição de hardware, como VHDL. A descrição define sinais, componentes e como eles se conectam.',
  'A simulação testa o comportamento lógico antes de programar o chip. Vetores de teste ajudam a encontrar erros sem precisar montar o hardware.',
  'A síntese converte a descrição em uma rede de elementos lógicos que existe na FPGA. O resultado precisa caber nos recursos disponíveis no dispositivo.',
  'O place & route escolhe onde os elementos ficarão no chip e como os sinais percorrerão as conexões físicas. A ferramenta também verifica atrasos e restrições de tempo.',
  'O bitstream é o arquivo usado para configurar a FPGA. Ao carregá-lo, o chip passa a implementar o circuito descrito no projeto.',
];

const ETAPAS_FLUXO = [
  'Descrição (VHDL)',
  'Simulação',
  'Síntese',
  'Place & Route',
  'Bitstream',
];

function configurarExercicios(container) {
  container.closest('main')?.querySelectorAll('.widget-exercicio').forEach((formulario) => {
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const resposta = formulario.querySelector('input[type="radio"]:checked');
      const retorno = formulario.querySelector('[aria-live="polite"]');
      const correto = resposta?.value === formulario.dataset.resposta;
      retorno.textContent = resposta
        ? correto ? 'Correto! Muito bem.' : 'Ainda não. Reveja a teoria e tente novamente.'
        : 'Escolha uma alternativa antes de conferir.';
      retorno.classList.toggle('correto', Boolean(correto));
    });
  });
}

function configurarExemplos(container) {
  container.querySelectorAll('[data-exemplo]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const codigo = container.querySelector(`#${botao.getAttribute('aria-controls')}`);
      const abrir = codigo.hidden;
      codigo.hidden = !abrir;
      botao.setAttribute('aria-expanded', String(abrir));
      botao.textContent = abrir ? 'Ocultar exemplo' : 'Ver exemplo';
    });
  });
}

function configurarFluxo(container) {
  const botoes = [...container.querySelectorAll('.widget-etapa')];
  const explicacao = container.querySelector('#m6-fluxo-explicacao');

  function selecionar(indice) {
    botoes.forEach((botao, indiceBotao) => {
      const ativo = indiceBotao === indice;
      botao.classList.toggle('ativo', ativo);
      botao.setAttribute('aria-pressed', String(ativo));
    });
    explicacao.textContent = EXPLICACOES_FLUXO[indice];
  }

  botoes.forEach((botao, indice) => {
    botao.addEventListener('click', () => selecionar(indice));
  });
  selecionar(0);
}

export function inicializarM6(container) {
  container.innerHTML = `
    <section class="widget-bloco" aria-labelledby="m6-paradigmas-titulo">
      <h3 id="m6-paradigmas-titulo">Comparador de paradigmas</h3>
      <div class="widget-paradigmas">
        <article class="widget-paradigma">
          <h4>Software (C/Arduino)</h4>
          <ul>
            <li>Execução sequencial: uma instrução após a outra.</li>
            <li>Instruções são executadas por uma CPU.</li>
            <li>O compilador traduz o programa para instruções de máquina.</li>
            <li>O microcontrolador contém uma CPU pronta para uso.</li>
          </ul>
          <button class="btn btn--ghost" type="button" data-exemplo aria-controls="m6-codigo-c" aria-expanded="false">Ver exemplo</button>
          <pre class="widget-codigo" id="m6-codigo-c" hidden><code><span class="kw">void</span> <span class="kw">setup</span>() {
  pinMode(<span class="num">13</span>, OUTPUT);
}

<span class="kw">void</span> <span class="kw">loop</span>() {
  digitalWrite(<span class="num">13</span>, HIGH);
  delay(<span class="num">500</span>);
  digitalWrite(<span class="num">13</span>, LOW);
  delay(<span class="num">500</span>);
}</code></pre>
        </article>
        <article class="widget-paradigma">
          <h4>Hardware (VHDL/Verilog)</h4>
          <ul>
            <li>Operações podem acontecer em paralelo.</li>
            <li>A descrição define portas e conexões entre sinais.</li>
            <li>A síntese transforma a descrição em uma rede de hardware.</li>
            <li>A FPGA é configurada para implementar o circuito.</li>
          </ul>
          <button class="btn btn--ghost" type="button" data-exemplo aria-controls="m6-codigo-vhdl" aria-expanded="false">Ver exemplo</button>
          <pre class="widget-codigo" id="m6-codigo-vhdl" hidden><code><span class="kw">entity</span> pisca_led <span class="kw">is</span>
  <span class="kw">port</span> (clk : <span class="kw">in</span> std_logic;
        led : <span class="kw">out</span> std_logic);
<span class="kw">end</span> pisca_led;

<span class="kw">architecture</span> rtl <span class="kw">of</span> pisca_led <span class="kw">is</span>
  <span class="kw">signal</span> estado : std_logic := <span class="str">'0'</span>;
<span class="kw">begin</span>
  <span class="kw">process</span>(clk)
  <span class="kw">begin</span>
    <span class="kw">if</span> rising_edge(clk) <span class="kw">then</span>
      estado &lt;= <span class="kw">not</span> estado;
    <span class="kw">end if</span>;
  <span class="kw">end process</span>;
  led &lt;= estado;
<span class="kw">end</span> rtl;</code></pre>
        </article>
      </div>
    </section>
    <section class="widget-bloco" aria-labelledby="m6-fluxo-titulo">
      <h3 id="m6-fluxo-titulo">Fluxo de projeto em FPGA</h3>
      <div class="widget-fluxo" role="group" aria-label="Etapas do projeto em FPGA">
        ${ETAPAS_FLUXO.map((etapa, indice) => `
          ${indice ? '<span class="widget-fluxo-seta" aria-hidden="true">→</span>' : ''}
          <button class="widget-etapa" type="button" aria-pressed="false">${etapa}</button>
        `).join('')}
      </div>
      <p class="widget-fluxo-explicacao" id="m6-fluxo-explicacao" role="status" aria-live="polite"></p>
    </section>
    <section class="widget-bloco" aria-labelledby="m6-arduino-titulo">
      <h3 id="m6-arduino-titulo">Por que Arduino neste curso</h3>
      <div class="widget-razoes">
        <article><h4>Curva de aprendizado</h4><p>É possível começar com ferramentas simples e obter resultados rapidamente.</p></article>
        <article><h4>Custo</h4><p>Placas Arduino e compatíveis são acessíveis para atividades práticas.</p></article>
        <article><h4>Ecossistema</h4><p>Há materiais, exemplos e componentes educativos amplamente disponíveis.</p></article>
        <article><h4>Foco em lógica</h4><p>O curso concentra a atenção em entradas, estados, operações e saídas digitais.</p></article>
      </div>
      <aside class="widget-nota-tecnica">
        <p>Arduino usa um microcontrolador ATmega328P com CPU de 8 bits já pronta. FPGA é um chip reconfigurável sem CPU fixa. São paradigmas diferentes: aqui usamos Arduino porque o objetivo é entender a lógica digital, não projetar hardware reconfigurável.</p>
      </aside>
    </section>
  `;

  configurarExemplos(container);
  configurarFluxo(container);
  configurarExercicios(container);
}
