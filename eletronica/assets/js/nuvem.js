import { firebaseConfig } from './firebase-config.js';
import { validarDesignPersonalizado } from './designs-componentes.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.10.0';
const TAMANHO_MAXIMO = 800000;
let servico = null;
let inicializacao = null;

export function firebaseConfigurado() {
  return Boolean(firebaseConfig?.apiKey && firebaseConfig?.authDomain
    && firebaseConfig?.projectId && firebaseConfig?.appId);
}

export async function iniciarNuvem() {
  if (!firebaseConfigurado()) return null;
  if (!inicializacao) {
    inicializacao = (async () => {
      const [app, auth, db] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-firestore.js`),
      ]);
      const instancia = app.initializeApp(firebaseConfig);
      servico = { auth, db, autenticacao: auth.getAuth(instancia), banco: db.getFirestore(instancia) };
      return servico;
    })().catch((erro) => {
      inicializacao = null;
      throw erro;
    });
  }
  return inicializacao;
}

async function obterServico() {
  const atual = await iniciarNuvem();
  if (!atual) throw new Error('O Firebase ainda não foi configurado.');
  return atual;
}

export async function observarAutenticacao(callback) {
  const s = await obterServico();
  return s.auth.onAuthStateChanged(s.autenticacao, callback);
}

export async function entrarEmail(email, senha) {
  const s = await obterServico();
  return s.auth.signInWithEmailAndPassword(s.autenticacao, email, senha);
}

export async function criarConta(email, senha) {
  const s = await obterServico();
  return s.auth.createUserWithEmailAndPassword(s.autenticacao, email, senha);
}

export async function entrarGoogle() {
  const s = await obterServico();
  return s.auth.signInWithPopup(s.autenticacao, new s.auth.GoogleAuthProvider());
}

export async function sair() {
  const s = await obterServico();
  return s.auth.signOut(s.autenticacao);
}

export async function verificarAdministrador(usuario) {
  if (!usuario) return false;
  const s = await obterServico();
  const snap = await s.db.getDoc(s.db.doc(s.banco, 'administradores', usuario.uid));
  return snap.exists();
}

function exigirUsuario(s) {
  const usuario = s.autenticacao.currentUser;
  if (!usuario) throw new Error('Entre na sua conta para usar este recurso.');
  return usuario;
}

export async function listarProjetos(uidEsperado) {
  const s = await obterServico();
  const usuario = exigirUsuario(s);
  if (usuario.uid !== uidEsperado) throw new Error('A conta mudou. Abra novamente a lista de projetos.');
  const snap = await s.db.getDocs(s.db.collection(s.banco, 'usuarios', usuario.uid, 'projetos'));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.atualizadoEm?.seconds || 0) - (a.atualizadoEm?.seconds || 0));
}

export async function salvarProjeto(projeto, nome, dados, uidEsperado) {
  const s = await obterServico();
  const usuario = exigirUsuario(s);
  if (usuario.uid !== uidEsperado) throw new Error('A conta mudou. Abra novamente a lista de projetos.');
  const conteudo = JSON.stringify(dados);
  if (new TextEncoder().encode(conteudo).length > TAMANHO_MAXIMO) {
    throw new Error('O projeto é grande demais para ser salvo na nuvem.');
  }
  const colecao = s.db.collection(s.banco, 'usuarios', usuario.uid, 'projetos');
  const referencia = projeto ? s.db.doc(colecao, projeto.id) : s.db.doc(colecao);
  const versao = await s.db.runTransaction(s.banco, async (transacao) => {
    const snapshot = await transacao.get(referencia);
    if (projeto && (!snapshot.exists() || snapshot.data().versao !== projeto.versao)) {
      throw new Error('Este projeto foi alterado em outra sessão. Abra a versão mais recente antes de salvar.');
    }
    if (!projeto && snapshot.exists()) throw new Error('Não foi possível criar o projeto. Tente novamente.');
    const proxima = projeto ? projeto.versao + 1 : 1;
    transacao.set(referencia, {
      nome,
      dados: conteudo,
      versao: proxima,
      atualizadoEm: s.db.serverTimestamp(),
    });
    return proxima;
  });
  return { id: referencia.id, nome, versao };
}

export async function observarDesigns(aoReceber, aoFalhar) {
  const s = await obterServico();
  return s.db.onSnapshot(s.db.collection(s.banco, 'designs'), (snapshot) => {
    try {
      const designs = {};
      snapshot.forEach((item) => {
        const dados = item.data();
        if (!Number.isInteger(dados.versao) || dados.versao < 1) {
          throw new Error(`Versão inválida no design ${item.id}.`);
        }
        designs[item.id] = { design: JSON.parse(dados.design), versao: dados.versao };
      });
      aoReceber(designs);
    } catch (erro) {
      aoFalhar(erro);
    }
  }, aoFalhar);
}

export async function publicarDesign(tipo, design, versaoEsperada, designInicial = null) {
  const validacao = validarDesignPersonalizado(design);
  if (!validacao.valido) throw new Error(validacao.erro);
  if (designInicial) {
    const validacaoInicial = validarDesignPersonalizado(designInicial);
    if (!validacaoInicial.valido) throw new Error(validacaoInicial.erro);
  }
  const s = await obterServico();
  const usuario = exigirUsuario(s);
  const atual = s.db.doc(s.banco, 'designs', tipo);
  const revisao = s.db.doc(s.db.collection(atual, 'versoes'));
  const revisaoInicial = s.db.doc(s.db.collection(atual, 'versoes'));
  const conteudo = JSON.stringify(design);
  if (new TextEncoder().encode(conteudo).length > TAMANHO_MAXIMO) {
    throw new Error('O design é grande demais para ser publicado.');
  }
  return s.db.runTransaction(s.banco, async (transacao) => {
    const snapshot = await transacao.get(atual);
    const versaoAtual = snapshot.exists() ? snapshot.data().versao : 0;
    if (versaoAtual !== versaoEsperada) {
      throw new Error('Este design foi atualizado por outro administrador. Reabra o estúdio para carregar a versão mais recente.');
    }
    let versao = versaoAtual;
    if (!snapshot.exists() && designInicial && JSON.stringify(designInicial) !== conteudo) {
      const conteudoInicial = JSON.stringify(designInicial);
      if (new TextEncoder().encode(conteudoInicial).length > TAMANHO_MAXIMO) {
        throw new Error('O design inicial é grande demais para ser registrado.');
      }
      versao++;
      transacao.set(revisaoInicial, {
        design: conteudoInicial, versao, atualizadoPor: usuario.uid, atualizadoEm: s.db.serverTimestamp(),
      });
    }
    versao++;
    const dados = { design: conteudo, versao, atualizadoPor: usuario.uid, atualizadoEm: s.db.serverTimestamp() };
    transacao.set(atual, dados);
    transacao.set(revisao, dados);
    return versao;
  });
}

export async function listarVersoesDesign(tipo, cursor = null) {
  const s = await obterServico();
  const pagina = 20;
  const consulta = s.db.query(
    s.db.collection(s.banco, 'designs', tipo, 'versoes'),
    s.db.orderBy('versao', 'desc'),
    ...(cursor ? [s.db.startAfter(cursor)] : []),
    s.db.limit(pagina)
  );
  const snap = await s.db.getDocs(consulta);
  const versoes = snap.docs.map((item) => {
    const dados = item.data();
    return { id: item.id, ...dados, design: JSON.parse(dados.design) };
  });
  return { versoes, proximo: snap.docs.length === pagina ? snap.docs[snap.docs.length - 1] : null };
}
