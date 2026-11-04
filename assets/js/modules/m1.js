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

export function inicializarM1(container) {
  container.innerHTML = `
    <div class="widget-controles">
      <label class="propriedades-campo" for="m1-sinal">
        Sinal analógico
        <input class="widget-slider" id="m1-sinal" type="range" min="0" max="100" step="0.1" value="47.3">
      </label>
      <label class="propriedades-campo" for="m1-resolucao">
        Resolução
        <select id="m1-resolucao">
          <option value="2">2 bits</option>
          <option value="3">3 bits</option>
          <option value="4" selected>4 bits</option>
        </select>
      </label>
    </div>
    <p class="widget-resultado" id="m1-resultado" aria-live="polite"></p>
    <div class="widget-leds" id="m1-leds" aria-label="Bits do valor digitalizado"></div>
    <p class="widget-explicacao">Com 4 bits você tem 16 níveis. Com 2 bits, apenas 4. Mais bits = mais fidelidade.</p>
  `;

  const slider = container.querySelector('#m1-sinal');
  const resolucao = container.querySelector('#m1-resolucao');
  const resultado = container.querySelector('#m1-resultado');
  const leds = container.querySelector('#m1-leds');

  function atualizar() {
    const bits = Number(resolucao.value);
    const valorAnalogico = Number(slider.value);
    const quantidadeNiveis = 2 ** bits;
    const valorDigital = Math.round((valorAnalogico / 100) * (quantidadeNiveis - 1));
    const binario = valorDigital.toString(2).padStart(bits, '0');

    resultado.textContent = `Analógico: ${valorAnalogico.toFixed(1)} → Digital (${bits} bits): ${binario}`;
    leds.replaceChildren();

    [...binario].forEach((bit, indice) => {
      const led = document.createElement('span');
      led.className = `widget-led${bit === '1' ? ' aceso' : ''}`;
      led.setAttribute('role', 'img');
      led.setAttribute('aria-label', `Bit ${bits - indice - 1}: ${bit}`);
      const rotulo = document.createElement('span');
      rotulo.textContent = bit;
      led.append(rotulo);
      leds.append(led);
    });
  }

  slider.addEventListener('input', atualizar);
  resolucao.addEventListener('change', atualizar);
  atualizar();
  configurarExercicios(container);
}
