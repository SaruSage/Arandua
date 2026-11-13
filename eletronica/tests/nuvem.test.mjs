import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseConfigurado, iniciarNuvem, publicarDesign } from '../assets/js/nuvem.js';

test('Firebase desconfigurado não tenta conectar', async () => {
  if (!firebaseConfigurado()) assert.equal(await iniciarNuvem(), null);
});

test('a publicação rejeita designs inválidos antes de tentar acessar a nuvem', async () => {
  await assert.rejects(
    publicarDesign('RESISTOR', { largura: 0 }, 0),
    /dimensões, formas, pinos e área de seleção válidos/
  );
});
