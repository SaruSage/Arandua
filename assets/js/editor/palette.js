export const CATALOGO = [
  {
    categoria: 'Entradas e Saídas',
    itens: [
      { tipo: 'SWITCH', rotulo: 'SWITCH', numEntradas: 0, numSaidas: 1 },
      { tipo: 'LED', rotulo: 'LED', numEntradas: 1, numSaidas: 0 },
      { tipo: 'CLOCK', rotulo: 'CLOCK', numEntradas: 0, numSaidas: 1 },
    ],
  },
  {
    categoria: 'Portas Lógicas',
    itens: [
      { tipo: 'AND', rotulo: 'AND', numEntradas: 2, numSaidas: 1 },
      { tipo: 'OR', rotulo: 'OR', numEntradas: 2, numSaidas: 1 },
      { tipo: 'NOT', rotulo: 'NOT', numEntradas: 1, numSaidas: 1 },
      { tipo: 'NAND', rotulo: 'NAND', numEntradas: 2, numSaidas: 1 },
      { tipo: 'NOR', rotulo: 'NOR', numEntradas: 2, numSaidas: 1 },
      { tipo: 'XOR', rotulo: 'XOR', numEntradas: 2, numSaidas: 1 },
      { tipo: 'XNOR', rotulo: 'XNOR', numEntradas: 2, numSaidas: 1 },
    ],
  },
  {
    categoria: 'Sequenciais',
    itens: [
      { tipo: 'DFF', rotulo: 'DFF', numEntradas: 1, numSaidas: 2 },
      { tipo: 'JKFF', rotulo: 'JKFF', numEntradas: 2, numSaidas: 2 },
      { tipo: 'TFF', rotulo: 'TFF', numEntradas: 1, numSaidas: 2 },
      { tipo: 'SRFF', rotulo: 'SRFF', numEntradas: 2, numSaidas: 2 },
      { tipo: 'COUNTER', rotulo: 'COUNTER', numEntradas: 0, numSaidas: 4 },
      { tipo: 'REGISTER', rotulo: 'REGISTER', numEntradas: 4, numSaidas: 4 },
    ],
  },
];

export function criarPaleta(container, aoClicar) {
  CATALOGO.forEach((grupo) => {
    const secao = document.createElement('section');
    secao.className = 'paleta-grupo';

    const titulo = document.createElement('h3');
    titulo.className = 'paleta-titulo';
    titulo.textContent = grupo.categoria;

    const lista = document.createElement('div');
    lista.className = 'paleta-lista';

    grupo.itens.forEach((item) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'paleta-item';
      botao.textContent = item.rotulo;
      botao.draggable = true;
      botao.setAttribute('aria-label', `Adicionar componente ${item.rotulo}`);
      botao.addEventListener('click', () => aoClicar(item));
      botao.addEventListener('dragstart', (evento) => {
        evento.dataTransfer.setData(
          'application/x-arandua-componente',
          JSON.stringify(item),
        );
        evento.dataTransfer.effectAllowed = 'copy';
      });
      lista.append(botao);
    });

    secao.append(titulo, lista);
    container.append(secao);
  });
}
