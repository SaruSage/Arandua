import { mostrarConta } from './conta.js';
import { firebaseConfigurado, observarAutenticacao } from './nuvem.js';

const conta = document.getElementById('conta');
if (!firebaseConfigurado()) {
  mostrarConta(conta, null);
} else {
  observarAutenticacao((usuario) => mostrarConta(conta, usuario)).catch((erro) => {
    console.error('Não foi possível iniciar a autenticação:', erro);
    conta.textContent = `Não foi possível carregar o login: ${erro.message}`;
  });
}
