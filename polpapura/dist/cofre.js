// Um único registro mantém catálogo, revisão e parâmetros da chave na mesma transação.
const bancoLocal = new Promise((resolve, reject) => {
  const abertura = indexedDB.open("purapolpa-custos", 1);
  abertura.onupgradeneeded = () => abertura.result.createObjectStore("admin");
  abertura.onsuccess = () => resolve(abertura.result);
  abertura.onerror = () => reject(abertura.error);
});

async function lerCofre() {
  const banco = await bancoLocal;
  return new Promise((resolve, reject) => {
    const leitura = banco.transaction("admin").objectStore("admin").get("catalogo");
    leitura.onsuccess = () => resolve(leitura.result);
    leitura.onerror = () => reject(leitura.error);
  });
}

async function chaveLocal(senha, sal) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2", salt:sal, iterations:600000, hash:"SHA-256"},
    material, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
}

async function abrirCatalogo(registro, chave) {
  const dados = await crypto.subtle.decrypt({name:"AES-GCM", iv:registro.iv}, chave, registro.dados);
  return JSON.parse(new TextDecoder().decode(dados));
}

async function importarChave(bytes) {
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt","decrypt"]);
}

async function chaveDoCatalogo(registro, chaveSenha) {
  if (!registro.recuperacao) return chaveSenha;
  const {iv, protegida} = registro.recuperacao;
  const bytes = await crypto.subtle.decrypt({name:"AES-GCM", iv}, chaveSenha, protegida);
  return importarChave(bytes);
}

async function protegerChave(bytes, chaveSenha, cofre, email) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const protegida = await crypto.subtle.encrypt({name:"AES-GCM", iv}, chaveSenha, bytes);
  return {iv, protegida, cofre, email};
}

async function gravarCatalogo(anterior, chave, itens) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({name:"AES-GCM", iv}, chave, new TextEncoder().encode(JSON.stringify(itens)));
  const registro = {...anterior, iv, dados, revisao:anterior.revisao + 1};
  const banco = await bancoLocal;
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction("admin", "readwrite");
    const tabela = transacao.objectStore("admin");
    const leitura = tabela.get("catalogo");
    let conflito = false;
    leitura.onsuccess = () => {
      if ((leitura.result?.revisao ?? 0) !== anterior.revisao) {
        conflito = true;
        transacao.abort();
      } else {
        tabela.put(registro, "catalogo");
      }
    };
    transacao.oncomplete = () => resolve(registro);
    transacao.onabort = () => reject(new Error(conflito ? "O catálogo mudou em outra aba. Entre novamente para carregar a versão atual." : "Falha ao salvar neste navegador. Verifique o espaço disponível."));
  });
}
