# Arandua

Laboratório interativo para aprender Sistemas Digitais construindo circuitos.

## Sobre o projeto

O Arandua apresenta conceitos de Sistemas Digitais de forma gradual e prática,
para estudantes que estão começando. A trilha culmina na construção de um
miniprocessador que executa um caça-níqueis.

## Estrutura de pastas

```text
arandua/
├── index.html                    # Página inicial e trilha de aprendizagem
├── assets/
│   ├── css/
│   │   ├── base.css              # Design system e estilos fundamentais
│   │   ├── components.css        # Componentes reutilizáveis
│   │   └── editor.css            # Esqueleto de estilos do editor
│   ├── img/                      # Imagens do projeto
│   └── js/
│       ├── app.js                # Inicialização da interface
│       ├── components/           # Componentes da interface
│       ├── core/                 # Núcleo e regras compartilhadas
│       ├── editor/               # Lógica do editor de circuitos
│       └── modules/              # Conteúdos interativos dos módulos
├── modulos/                      # Páginas dos módulos da trilha
├── projeto/                      # Projeto integrador
├── sandbox/                      # Editor livre
└── README.md                     # Documentação do projeto
```

## Como rodar localmente

1. Abra a pasta do projeto no Visual Studio Code.
2. Instale a extensão Live Server, caso ainda não esteja instalada.
3. Clique com o botão direito em `index.html` e escolha **Open with Live Server**.

O projeto não requer compilação, instalação de pacotes nem conexão com serviços
externos.

## Roadmap

1. **Fase 0 — Fundação:** estrutura, estilos-base e páginas iniciais.
2. **Fase 1 — Introdução:** apresentação dos conceitos e da trilha.
3. **Fase 2 — Editor de circuitos:** montagem e simulação de circuitos.
4. **Fase 3 — Sistemas numéricos e lógica binária.**
5. **Fase 4 — Portas lógicas e circuitos combinacionais.**
6. **Fase 5 — Circuitos sequenciais e memória.**
7. **Fase 6 — Arquitetura e implementação do miniprocessador.**
8. **Fase 7 — Programação e jogo caça-níqueis.**

## Tecnologias

- HTML5
- CSS3
- JavaScript puro com módulos ES6
