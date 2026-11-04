const TIPO_DADO_COMPONENTE = 'application/x-arandua-componente';

function posicaoNoCanvas(evento, elemento) {
  const retangulo = elemento.getBoundingClientRect();
  return {
    x: evento.clientX - retangulo.left,
    y: evento.clientY - retangulo.top,
  };
}

function campoDeTextoAtivo(evento) {
  return evento.target instanceof Element
    && evento.target.closest('input, textarea, select, [contenteditable="true"]');
}

export function configurarInteracao(canvas, editor, fios) {
  const elemento = canvas.elemento;
  let gesto = null;

  elemento.addEventListener('mousedown', (evento) => {
    if (evento.button === 1 || evento.shiftKey) {
      evento.preventDefault();
      gesto = {
        tipo: 'pan',
        x: evento.clientX,
        y: evento.clientY,
      };
      elemento.style.cursor = 'grabbing';
      return;
    }

    if (evento.button !== 0) return;

    const tela = posicaoNoCanvas(evento, elemento);
    const mundo = canvas.telaParaMundo(tela.x, tela.y);
    const pino = canvas.pinoEm(mundo.x, mundo.y);

    if (pino) {
      fios.iniciar(pino);
      return;
    }

    if (fios.selecionarFioEm(mundo.x, mundo.y)) return;

    const componente = editor.componenteEm(mundo.x, mundo.y);
    if (!componente) {
      editor.selecionar(null);
      gesto = null;
      return;
    }

    editor.selecionar(componente.id);
    gesto = {
      tipo: 'componente',
      id: componente.id,
      x: mundo.x,
      y: mundo.y,
      posicaoX: componente.posicao.x,
      posicaoY: componente.posicao.y,
    };
    elemento.style.cursor = 'grabbing';
  });

  function atualizarPonteiro(evento) {
    const tela = posicaoNoCanvas(evento, elemento);
    const mundo = canvas.telaParaMundo(tela.x, tela.y);
    const pino = canvas.pinoEm(mundo.x, mundo.y);
    fios.atualizar(mundo, pino);

    if (!gesto) {
      elemento.style.cursor = pino
        ? 'crosshair'
        : editor.componenteEm(mundo.x, mundo.y)
          ? 'grab'
          : 'default';
    }
  }

  elemento.addEventListener('mousemove', (evento) => {
    if (gesto?.tipo === 'pan') {
      canvas.view.panX += evento.clientX - gesto.x;
      canvas.view.panY += evento.clientY - gesto.y;
      gesto.x = evento.clientX;
      gesto.y = evento.clientY;
      editor.renderizar();
      return;
    }

    if (gesto?.tipo === 'componente') {
      const tela = posicaoNoCanvas(evento, elemento);
      const mundo = canvas.telaParaMundo(tela.x, tela.y);
      editor.moverComponente(
        gesto.id,
        gesto.posicaoX + mundo.x - gesto.x,
        gesto.posicaoY + mundo.y - gesto.y,
      );
      return;
    }

    atualizarPonteiro(evento);
  });

  window.addEventListener('mousemove', (evento) => {
    if (evento.target === elemento) return;
    if (fios.desenhando) {
      atualizarPonteiro(evento);
      return;
    }

    if (gesto?.tipo === 'pan') {
      canvas.view.panX += evento.clientX - gesto.x;
      canvas.view.panY += evento.clientY - gesto.y;
      gesto.x = evento.clientX;
      gesto.y = evento.clientY;
      editor.renderizar();
    } else if (gesto?.tipo === 'componente') {
      const tela = posicaoNoCanvas(evento, elemento);
      const mundo = canvas.telaParaMundo(tela.x, tela.y);
      editor.moverComponente(
        gesto.id,
        gesto.posicaoX + mundo.x - gesto.x,
        gesto.posicaoY + mundo.y - gesto.y,
      );
    }
  });

  function encerrarGesto(evento) {
    if (fios.desenhando) {
      const tela = posicaoNoCanvas(evento, elemento);
      const mundo = canvas.telaParaMundo(tela.x, tela.y);
      fios.finalizar(canvas.pinoEm(mundo.x, mundo.y));
    }

    if (gesto?.tipo === 'componente') {
      const componente = editor.circuito.componentes.find((item) => item.id === gesto.id);
      if (
        componente
        && (componente.posicao.x !== gesto.posicaoX || componente.posicao.y !== gesto.posicaoY)
      ) {
        editor.registrarHistorico();
      }
    }

    gesto = null;
    elemento.style.cursor = 'default';
  }

  window.addEventListener('mouseup', encerrarGesto);

  elemento.addEventListener('wheel', (evento) => {
    evento.preventDefault();
    const tela = posicaoNoCanvas(evento, elemento);
    const mundo = canvas.telaParaMundo(tela.x, tela.y);
    const zoomNovo = Math.min(3, Math.max(0.3, canvas.view.zoom * Math.exp(-evento.deltaY * 0.001)));
    canvas.view.zoom = zoomNovo;
    canvas.view.panX = tela.x - mundo.x * zoomNovo;
    canvas.view.panY = tela.y - mundo.y * zoomNovo;
    editor.renderizar();
  }, { passive: false });

  elemento.addEventListener('dragover', (evento) => {
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
  });

  elemento.addEventListener('drop', (evento) => {
    evento.preventDefault();
    const dados = evento.dataTransfer.getData(TIPO_DADO_COMPONENTE);
    if (!dados) return;

    let item;
    try {
      item = JSON.parse(dados);
    } catch (erro) {
      console.error('Não foi possível ler o componente arrastado para o canvas.', erro);
      return;
    }

    const tela = posicaoNoCanvas(evento, elemento);
    const mundo = canvas.telaParaMundo(tela.x, tela.y);
    editor.adicionarComponente(item, { x: mundo.x - 40, y: mundo.y - 30 });
  });

  window.addEventListener('keydown', (evento) => {
    const modificador = evento.ctrlKey || evento.metaKey;
    const campoAtivo = campoDeTextoAtivo(evento);

    if (modificador && evento.key.toLowerCase() === 'z') {
      if (campoAtivo) return;
      evento.preventDefault();
      if (evento.shiftKey) editor.refazer();
      else editor.desfazer();
      return;
    }

    if (evento.key === 'Escape') {
      if (fios.cancelar()) return;
      editor.selecionar(null);
      return;
    }

    if ((evento.key === 'Delete' || evento.key === 'Backspace') && !campoAtivo) {
      if (editor.fioSelecionadoId !== null) {
        evento.preventDefault();
        editor.desconectarFio(editor.fioSelecionadoId);
      } else if (editor.selecionadoId !== null) {
        evento.preventDefault();
        editor.removerSelecionado();
      }
    }
  });
}
