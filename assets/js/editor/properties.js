import { acionarSwitch, criarComponente, propagar } from '../core/circuit.js';
import { tictac } from '../core/clock.js';

function criarCampo(container, rotulo, tipo, valor) {
  const grupo = document.createElement('label');
  grupo.className = 'propriedades-campo';

  const texto = document.createElement('span');
  texto.textContent = rotulo;

  const entrada = document.createElement('input');
  entrada.type = tipo;
  entrada.value = valor;
  grupo.append(texto, entrada);
  container.append(grupo);
  return entrada;
}

function atualizarIndicador(indicador, componente) {
  if (!indicador || !componente) return;
  const aceso = Boolean(componente.estado.aceso);
  indicador.classList.toggle('aceso', aceso);
  indicador.textContent = aceso ? 'Aceso' : 'Apagado';
  indicador.setAttribute('aria-label', `LED ${aceso ? 'aceso' : 'apagado'}`);
}

export function criarPainelPropriedades(container, editor) {
  let intervaloClock = null;
  let idClockAtivo = null;
  let indicadorLed = null;

  function pararClock() {
    if (intervaloClock !== null) {
      clearInterval(intervaloClock);
      intervaloClock = null;
    }

    const clock = editor.circuito.componentes.find((item) => item.id === idClockAtivo);
    if (clock) clock.estado.rodando = false;
    idClockAtivo = null;
  }

  function iniciarClock(componente) {
    componente.estado.rodando = true;
    idClockAtivo = componente.id;
    intervaloClock = setInterval(() => {
      if (!editor.circuito.componentes.includes(componente)) {
        pararClock();
        return;
      }

      const circuitoDoClock = {
        ...editor.circuito,
        componentes: [
          componente,
          ...editor.circuito.componentes.filter((item) => item.tipo !== 'CLOCK'),
        ],
      };
      tictac(circuitoDoClock);
      editor.renderizar();
      if (editor.selecionadoId !== componente.id) pararClock();
    }, 500 / (componente.estado.frequenciaHz ?? 1));
  }

  function renderizar(componente) {
    container.replaceChildren();
    indicadorLed = null;

    if (!componente) {
      const vazio = document.createElement('p');
      vazio.className = 'propriedades-vazio';
      vazio.textContent = 'Selecione um componente';
      container.append(vazio);
      return;
    }

    const titulo = document.createElement('h2');
    titulo.className = 'propriedades-titulo';
    titulo.textContent = `${componente.tipo} — ${componente.rotulo}`;
    container.append(titulo);

    const campoRotulo = criarCampo(container, 'Rótulo', 'text', componente.rotulo);
    campoRotulo.maxLength = 40;
    campoRotulo.addEventListener('change', () => {
      componente.rotulo = campoRotulo.value.trim() || componente.tipo;
      editor.registrarHistorico();
      editor.renderizar();
      renderizar(componente);
    });

    if (componente.tipo === 'SWITCH') {
      const alternar = document.createElement('button');
      alternar.type = 'button';
      alternar.className = 'propriedades-toggle';
      alternar.addEventListener('click', () => {
        const valor = componente.estado.ativo === 1 ? 0 : 1;
        acionarSwitch(editor.circuito, componente.id, valor);
        editor.registrarHistorico();
        editor.renderizar();
        renderizar(componente);
      });
      container.append(alternar);
      alternar.textContent = `Estado: ${componente.estado.ativo === 1 ? '1 (ligado)' : '0 (desligado)'}`;
      alternar.classList.toggle('ativo', componente.estado.ativo === 1);
    }

    if (componente.tipo === 'CLOCK') {
      const frequencia = criarCampo(
        container,
        'Frequência (Hz)',
        'number',
        componente.estado.frequenciaHz ?? 1,
      );
      frequencia.min = '0.1';
      frequencia.max = '10';
      frequencia.step = '0.1';
      frequencia.addEventListener('change', () => {
        const valor = Number(frequencia.value);
        if (!Number.isFinite(valor)) {
          frequencia.value = String(componente.estado.frequenciaHz ?? 1);
          return;
        }
        const clockAtivo = idClockAtivo === componente.id && intervaloClock !== null;
        componente.estado.frequenciaHz = Math.min(10, Math.max(0.1, valor));
        frequencia.value = String(componente.estado.frequenciaHz);
        if (clockAtivo) {
          clearInterval(intervaloClock);
          intervaloClock = null;
          iniciarClock(componente);
        }
        editor.registrarHistorico();
        editor.renderizar();
      });

      const controlar = document.createElement('button');
      controlar.type = 'button';
      controlar.className = 'btn btn--primary';
      controlar.textContent = componente.estado.rodando ? 'Parar' : 'Iniciar';
      controlar.addEventListener('click', () => {
        if (intervaloClock !== null) {
          pararClock();
        } else {
          iniciarClock(componente);
        }

        editor.registrarHistorico();
        editor.renderizar();
        renderizar(componente);
      });
      container.append(controlar);
    }

    if (componente.tipo === 'COUNTER') {
      const bits = criarCampo(
        container,
        'Quantidade de bits',
        'number',
        componente.estado.bits ?? componente.saidas.length,
      );
      bits.min = '2';
      bits.max = '8';
      bits.step = '1';
      bits.addEventListener('change', () => {
        const valor = Number(bits.value);
        if (!Number.isInteger(valor) || valor < 2 || valor > 8) {
          bits.value = String(componente.estado.bits ?? componente.saidas.length);
          return;
        }

        const indice = editor.circuito.componentes.findIndex((item) => item.id === componente.id);
        const substituto = criarComponente('COUNTER', {
          numEntradas: 0,
          numSaidas: valor,
          rotulo: componente.rotulo,
          posicao: componente.posicao,
        });
        substituto.id = componente.id;
        substituto.estado.valor = (componente.estado.valor ?? 0) % (2 ** valor);
        editor.circuito.componentes[indice] = substituto;
        editor.circuito.fios = editor.circuito.fios.filter((fio) => {
          if (fio.origem.componente === substituto.id) {
            return substituto.saidas.some((pino) => pino.id === fio.origem.pino);
          }
          if (fio.destino.componente === substituto.id) {
            return substituto.entradas.some((pino) => pino.id === fio.destino.pino);
          }
          return true;
        });
        propagar(editor.circuito);
        editor.registrarHistorico();
        editor.renderizar();
        renderizar(substituto);
      });
    }

    if (componente.tipo === 'LED') {
      const indicador = document.createElement('p');
      indicador.className = 'propriedades-led';
      indicadorLed = indicador;
      atualizarIndicador(indicadorLed, componente);
      container.append(indicador);
    }

    if (componente.tipo === 'CLOCK') {
      const indicador = document.createElement('p');
      indicador.className = 'propriedades-led';
      indicadorLed = indicador;
      indicador.textContent = `Nível: ${componente.estado.nivel ?? 0}`;
      container.append(indicador);
    }

    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'propriedades-remover';
    remover.textContent = 'Remover componente';
    remover.addEventListener('click', () => editor.removerSelecionado());
    container.append(remover);
  }

  editor.aoSelecionar = (componente) => {
    pararClock();
    renderizar(componente);
  };

  return {
    renderizar,
    atualizar() {
      const componente = editor.circuito.componentes.find(
        (item) => item.id === editor.selecionadoId,
      );
      if (componente?.tipo === 'LED') atualizarIndicador(indicadorLed, componente);
      if (componente?.tipo === 'CLOCK' && indicadorLed) {
        indicadorLed.textContent = `Nível: ${componente.estado.nivel ?? 0}`;
      }
    },
  };
}
