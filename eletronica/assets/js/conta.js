import { criarConta, entrarEmail, entrarGoogle, firebaseConfigurado, sair } from './nuvem.js';

export function mostrarConta(container, usuario, aoAtualizar) {
  container.replaceChildren();
  const mensagem = document.createElement('p');
  mensagem.className = 'conta-mensagem';
  mensagem.setAttribute('role', 'status');
  if (!firebaseConfigurado()) {
    mensagem.textContent = 'Login indisponível: configure o Firebase para ativar as contas.';
    container.append(mensagem);
    return;
  }
  if (usuario) {
    const identidade = document.createElement('p');
    identidade.textContent = `Conectado: ${usuario.email || 'conta Google'}`;
    const botaoSair = document.createElement('button');
    botaoSair.type = 'button';
    botaoSair.textContent = 'Sair da conta';
    botaoSair.addEventListener('click', () => executar(() => sair()));
    container.append(identidade, botaoSair, mensagem);
    return;
  }
  const form = document.createElement('form');
  form.className = 'conta-form';
  form.innerHTML = `
    <label>E-mail<input type="email" name="email" autocomplete="email" required></label>
    <label>Senha<input type="password" name="senha" autocomplete="current-password" required minlength="6"></label>
    <div class="conta-acoes">
      <button type="submit">Entrar</button>
      <button type="button" class="conta-criar">Criar conta</button>
      <button type="button" class="conta-google">Entrar com Google</button>
    </div>`;
  const email = form.elements.email;
  const senha = form.elements.senha;
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    executar(() => entrarEmail(email.value.trim(), senha.value));
  });
  form.querySelector('.conta-criar').addEventListener('click', () => {
    if (form.reportValidity()) executar(() => criarConta(email.value.trim(), senha.value));
  });
  form.querySelector('.conta-google').addEventListener('click', () => executar(() => entrarGoogle()));
  container.append(form, mensagem);

  async function executar(acao) {
    mensagem.textContent = 'Aguarde...';
    try {
      await acao();
      mensagem.textContent = '';
      aoAtualizar?.();
    } catch (erro) {
      console.error('Erro de autenticação:', erro);
      mensagem.textContent = `Não foi possível concluir a operação: ${erro.message}`;
    }
  }
}

export function abrirConta(usuario, aoAtualizar) {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'nuvem-dialogo';
  const titulo = document.createElement('h2');
  titulo.textContent = 'Sua conta';
  const conteudo = document.createElement('div');
  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.textContent = 'Fechar';
  fechar.addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('close', () => dialogo.remove());
  dialogo.append(titulo, conteudo, fechar);
  document.body.append(dialogo);
  mostrarConta(conteudo, usuario, () => {
    dialogo.close();
    aoAtualizar?.();
  });
  dialogo.showModal();
}
