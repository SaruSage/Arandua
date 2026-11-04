function copiarSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

export function criarHistorico(limite = 50) {
  const pilhaDesfazer = [];
  const pilhaRefazer = [];

  return {
    registrar(snapshot) {
      pilhaDesfazer.push(copiarSnapshot(snapshot));
      if (pilhaDesfazer.length > limite) pilhaDesfazer.shift();
      pilhaRefazer.length = 0;
    },
    desfazer() {
      if (pilhaDesfazer.length <= 1) return null;
      pilhaRefazer.push(pilhaDesfazer.pop());
      return copiarSnapshot(pilhaDesfazer[pilhaDesfazer.length - 1]);
    },
    refazer() {
      if (pilhaRefazer.length === 0) return null;
      const snapshot = pilhaRefazer.pop();
      pilhaDesfazer.push(snapshot);
      return copiarSnapshot(snapshot);
    },
    podeDesfazer() {
      return pilhaDesfazer.length > 1;
    },
    podeRefazer() {
      return pilhaRefazer.length > 0;
    },
    limpar() {
      pilhaDesfazer.length = 0;
      pilhaRefazer.length = 0;
    },
  };
}
