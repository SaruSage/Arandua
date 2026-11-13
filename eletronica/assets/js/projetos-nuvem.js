import { listarProjetos, salvarProjeto } from './nuvem.js';
import { validar } from './persistencia.js';

export async function abrirProjetosNuvem(obterDados, abrirDados, projetoAtual, aoSalvar, uid) {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'nuvem-dialogo projetos-dialogo';
  dialogo.innerHTML = `
    <h2>Meus projetos</h2>
    <form class="projeto-salvar">
      <label>Nome do projeto<input name="nome" maxlength="120" required></label>
      <div class="conta-acoes">
        <button type="submit">Salvar projeto</button>
        <button type="button" class="projeto-novo">Salvar como novo</button>
      </div>
    </form>
    <p class="nuvem-mensagem" role="status"></p>
    <h3>Projetos salvos</h3>
    <div class="projetos-lista"></div>
    <button type="button" class="nuvem-fechar">Fechar</button>`;
  document.body.append(dialogo);
  dialogo.addEventListener('close', () => dialogo.remove());
  dialogo.querySelector('.nuvem-fechar').addEventListener('click', () => dialogo.close());
  const form = dialogo.querySelector('form');
  const nome = form.elements.nome;
  const mensagem = dialogo.querySelector('.nuvem-mensagem');
  const lista = dialogo.querySelector('.projetos-lista');
  let atual = projetoAtual;
  nome.value = atual?.nome || '';
  dialogo.showModal();

  async function atualizarLista() {
    mensagem.textContent = 'Carregando projetos...';
    const projetos = await listarProjetos(uid);
    lista.replaceChildren();
    if (!projetos.length) lista.textContent = 'Nenhum projeto salvo.';
    for (const projeto of projetos) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.textContent = projeto.nome;
      botao.addEventListener('click', () => {
        try {
          const dados = JSON.parse(projeto.dados);
          const resultado = validar(dados);
          if (!resultado.valido) throw new Error(resultado.erro);
          if (!confirm('Abrir este projeto substituirá o circuito atual. Continuar?')) return;
          abrirDados(dados);
          atual = { id: projeto.id, nome: projeto.nome, versao: projeto.versao };
          aoSalvar(atual);
          dialogo.close();
        } catch (erro) {
          console.error('Não foi possível abrir o projeto:', erro);
          mensagem.textContent = `Não foi possível abrir o projeto: ${erro.message}`;
        }
      });
      lista.append(botao);
    }
    mensagem.textContent = '';
  }

  async function salvar(novo) {
    if (!form.reportValidity()) return;
    const nomeProjeto = nome.value.trim();
    if (!nomeProjeto) {
      mensagem.textContent = 'Informe um nome para o projeto.';
      return;
    }
    for (const botao of form.querySelectorAll('button')) botao.disabled = true;
    mensagem.textContent = 'Salvando projeto...';
    try {
      atual = await salvarProjeto(novo ? null : atual, nomeProjeto, obterDados(), uid);
      aoSalvar(atual);
      try {
        await atualizarLista();
        mensagem.textContent = 'Projeto salvo na nuvem.';
      } catch (erro) {
        console.error('Projeto salvo, mas a lista não pôde ser atualizada:', erro);
        mensagem.textContent = `Projeto salvo, mas a lista não pôde ser atualizada: ${erro.message}`;
      }
    } catch (erro) {
      console.error('Não foi possível salvar o projeto:', erro);
      mensagem.textContent = `Não foi possível salvar o projeto: ${erro.message}`;
    } finally {
      for (const botao of form.querySelectorAll('button')) botao.disabled = false;
    }
  }
  form.addEventListener('submit', (evento) => { evento.preventDefault(); salvar(false); });
  dialogo.querySelector('.projeto-novo').addEventListener('click', () => salvar(true));
  try {
    await atualizarLista();
  } catch (erro) {
    console.error('Não foi possível listar os projetos:', erro);
    mensagem.textContent = `Não foi possível carregar os projetos: ${erro.message}`;
  }
}
