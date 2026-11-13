# Configuração do Firebase

O simulador funciona sem conta para visitantes. Para ativar contas, projetos
privados e designs publicados, configure um projeto Firebase antes de colocar o
site no ar. Sem essa configuração, a autenticação e o estúdio ficam indisponíveis;
o salvamento local e a exportação em JSON existentes continuam disponíveis.

## 1. Criar e configurar o projeto

1. No [console Firebase](https://console.firebase.google.com/), crie um projeto.
2. Em **Visão geral do projeto**, adicione um aplicativo **Web**. Copie a
   configuração fornecida para `assets/js/firebase-config.js`, por exemplo:

   ```js
   export const firebaseConfig = {
     apiKey: 'VALOR_FORNECIDO_PELO_FIREBASE',
     authDomain: 'SEU_PROJETO.firebaseapp.com',
     projectId: 'SEU_PROJETO',
     appId: 'VALOR_FORNECIDO_PELO_FIREBASE',
   };
   ```

   Copie também outros campos, como `storageBucket` e `messagingSenderId`, se
   forem fornecidos. A configuração web e sua API key identificam o projeto e
   não são uma senha de administrador. **Nunca** inclua credenciais de conta
   de serviço, chaves privadas ou senhas no código.
3. Em **Authentication**, habilite o produto e, em **Sign-in method**, habilite
   **E-mail/senha** e **Google**. Configure o e-mail de suporte solicitado.
4. Em **Authentication > Settings > Authorized domains**, adicione o domínio
   onde o site será publicado. Para testes locais, adicione `localhost` se
   necessário. O login Google exige um domínio autorizado.
5. Em **Firestore Database**, crie um banco e escolha sua região com cuidado.
   Na aba **Rules**, substitua as regras pelo conteúdo de `firestore.rules` e
   clique em **Publish**. Não deixe o banco em modo de teste aberto.

## 2. Cadastrar um administrador

1. Acesse a página inicial do site e crie sua conta ou entre com Google.
2. No console, em **Authentication > Users**, copie o UID dessa conta.
3. Em **Firestore Database > Data**, crie a coleção `administradores` e um
   documento cujo **ID seja exatamente o UID**. Adicione, por exemplo, um campo
   booleano `ativo` com valor `true`.
4. Saia e entre novamente no site. O menu do simulador mostrará o estúdio e a
   importação de designs locais.

A autorização depende da existência do documento, não do campo `ativo`: para
revogá-la, exclua o documento pelo console. Usuários não podem criar ou alterar
documentos de administrador pelas regras fornecidas. Proteja também as contas
com acesso ao console e ao projeto Google Cloud.

## 3. Publicar designs e recuperar versões

No estúdio, edite um componente e clique em **Salvar visual**. O design é
publicado no Firestore e carregado por todos os visitantes, incluindo quem não
tem conta, quando utilizam o modo realista. Cada publicação cria uma versão; no botão **Histórico de versões**,
selecione uma versão e salve novamente para republicá-la. Se outro administrador
publicar enquanto você edita, o salvamento será recusado: reabra o estúdio para
começar a partir da versão atual.

Designs feitos antes desta integração continuam no armazenamento local do
navegador. No mesmo navegador e origem onde foram criados, entre como
administrador e escolha **Importar designs locais** no menu. A importação
publica os designs locais e substitui os designs publicados dos mesmos tipos,
sem apagar os dados locais. O histórico antigo armazenado apenas no navegador
não é importado; o desenho local atual passa a ser uma versão publicada. Se
o estúdio era usado em `localhost`, configure o Firebase e faça a importação
nessa mesma origem antes de trocar para o domínio público. Se ocorrer erro durante o processo, alguns designs
anteriores à falha já podem ter sido publicados.

## 4. Projetos dos usuários

No simulador, **Salvar Projeto** abre a lista de projetos da conta, com opções
para salvar, salvar como novo e abrir. Os projetos ficam em
`usuarios/{uid}/projetos/{id}`; as regras limitam o acesso ao dono. O
salvamento informa um conflito se outra sessão tiver alterado o mesmo projeto,
evitando sobrescrevê-lo silenciosamente. O
autossalvamento local anterior é independente da conta e é compartilhado por
quem usar o mesmo navegador e perfil: não o considere privado em dispositivos
compartilhados. A exportação e a abertura de JSON continuam disponíveis no
menu.

## 5. Publicação e operação

Publique todo o conteúdo desta pasta em uma hospedagem estática com HTTPS;
`index.html` é a página inicial e `simulador.html` abre o editor. Sirva os
arquivos por HTTP(S), não por `file://`. O SDK web do Firebase é carregado dos
servidores oficiais do Google; é necessária conexão à internet para login,
projetos e publicação. Configure restrições adequadas para a API key, monitore
uso e custos, e avalie Firebase App Check e proteção contra abuso antes do
lançamento público. As cotas, cobrança e retenção de dados dependem das
configurações do seu projeto. O histórico de versões cresce a cada publicação;
planeje uma política de retenção e backups para produção.

As regras deste repositório precisam ser publicadas no **mesmo banco** usado
pelo aplicativo. Alterações apenas no arquivo local não atualizam regras já
implantadas. Teste com contas separadas de administrador e usuário antes do
lançamento: um usuário comum não deve conseguir ler projetos de outro usuário
nem publicar designs.

Documentação oficial: [configurar app web](https://firebase.google.com/docs/web/setup),
[Authentication](https://firebase.google.com/docs/auth/web/start),
[login com Google](https://firebase.google.com/docs/auth/web/google-signin) e
[regras do Firestore](https://firebase.google.com/docs/firestore/security/get-started).
