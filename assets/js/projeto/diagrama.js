const BLOCOS = [
  { nome: 'Botões', x: 30, y: 170, largura: 120, altura: 84 },
  { nome: 'Máquina de Estados', x: 215, y: 40, largura: 180, altura: 84 },
  { nome: 'Contador 1', x: 215, y: 160, largura: 130, altura: 72 },
  { nome: 'Contador 2', x: 215, y: 260, largura: 130, altura: 72 },
  { nome: 'Contador 3', x: 215, y: 360, largura: 130, altura: 72 },
  { nome: 'Comparador', x: 425, y: 235, largura: 140, altura: 84 },
  { nome: 'Créditos', x: 635, y: 235, largura: 130, altura: 84 },
  { nome: 'Display 1', x: 830, y: 115, largura: 130, altura: 72 },
  { nome: 'Display 2', x: 830, y: 235, largura: 130, altura: 72 },
  { nome: 'Display 3', x: 830, y: 355, largura: 130, altura: 72 },
];

const SETAS = [
  { x1: 150, y1: 192, x2: 215, y2: 82, rotulo: 'alavanca / reset' },
  { x1: 305, y1: 124, x2: 280, y2: 160, rotulo: 'clock' },
  { x1: 305, y1: 124, x2: 280, y2: 260, rotulo: 'clock' },
  { x1: 305, y1: 124, x2: 280, y2: 360, rotulo: 'clock' },
  { x1: 345, y1: 196, x2: 425, y2: 255, rotulo: 'valores' },
  { x1: 345, y1: 296, x2: 425, y2: 277, rotulo: 'valores' },
  { x1: 345, y1: 396, x2: 425, y2: 298, rotulo: 'valores' },
  { x1: 565, y1: 277, x2: 635, y2: 277, rotulo: 'resultado' },
  { x1: 345, y1: 196, x2: 830, y2: 151, rotulo: 'BCD' },
  { x1: 345, y1: 296, x2: 830, y2: 271, rotulo: 'BCD' },
  { x1: 345, y1: 396, x2: 830, y2: 391, rotulo: 'BCD' },
];

function criarSvg(tag, atributos = {}) {
  const elemento = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(atributos).forEach(([nome, valor]) => {
    elemento.setAttribute(nome, String(valor));
  });
  return elemento;
}

export function desenharDiagramaBlocos(svgElement) {
  svgElement.replaceChildren();
  svgElement.setAttribute('viewBox', '0 0 990 460');
  svgElement.setAttribute('role', 'group');
  svgElement.setAttribute('aria-label', 'Diagrama de blocos do caça-níqueis Arandua');

  const definicoes = criarSvg('defs');
  const marcador = criarSvg('marker', {
    id: 'cacaniqueis-seta',
    viewBox: '0 0 10 10',
    refX: 8,
    refY: 5,
    markerWidth: 7,
    markerHeight: 7,
    orient: 'auto',
  });
  marcador.append(criarSvg('path', { d: 'M 0 0 L 10 5 L 0 10 z' }));
  definicoes.append(marcador);
  svgElement.append(definicoes);

  SETAS.forEach(({ x1, y1, x2, y2, rotulo }) => {
    const linha = criarSvg('line', {
      x1,
      y1,
      x2,
      y2,
      class: 'cacaniqueis-seta',
      'marker-end': 'url(#cacaniqueis-seta)',
    });
    const texto = criarSvg('text', {
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2 - 5,
      class: 'cacaniqueis-sinal',
      'text-anchor': 'middle',
    });
    texto.textContent = rotulo;
    svgElement.append(linha, texto);
  });

  BLOCOS.forEach(({ nome, x, y, largura, altura }) => {
    const grupo = criarSvg('g', {
      class: 'cacaniqueis-bloco',
      'data-bloco': nome,
      tabindex: 0,
      role: 'button',
      'aria-label': nome,
    });
    grupo.append(criarSvg('rect', {
      x,
      y,
      width: largura,
      height: altura,
      rx: 10,
    }));
    const texto = criarSvg('text', {
      x: x + largura / 2,
      y: y + altura / 2,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    texto.textContent = nome;
    grupo.append(texto);
    grupo.addEventListener('click', () => {
      svgElement.dispatchEvent(new CustomEvent('bloco-selecionado', {
        bubbles: true,
        detail: { nome },
      }));
    });
    grupo.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        grupo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    svgElement.append(grupo);
  });
}
