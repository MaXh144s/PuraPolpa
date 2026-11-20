let finalidade, desafioAtual;

function etapaCodigo(desafio) {
  desafioAtual = desafio;
  const enviado = Boolean(desafio);
  el("etapa-codigo").hidden = !enviado;
  el("codigo").disabled = !enviado;
  el("codigo").value = "";
  el("email-recuperacao").readOnly = enviado;
  el("campo-nova-senha").hidden = finalidade !== "senha";
  el("nova-senha").disabled = !enviado || finalidade !== "senha";
  el("reenviar").hidden = !enviado;
  el("verificar").textContent = enviado
    ? (finalidade === "senha" ? "Alterar senha" : "Confirmar ativação") : "Enviar código";
}

function iniciarVerificacao(tipo) {
  if (tipo === "senha" && !registro.recuperacao) {
    aviso("A recuperação ainda não foi ativada neste navegador. Para ativá-la, entre no painel com a senha atual.");
    return;
  }
  finalidade = tipo;
  el("verificacao").reset();
  el("titulo-recuperacao").textContent = tipo === "senha" ? "Recuperar senha" : "Ativar recuperação";
  etapaCodigo(null);
  el("acesso").hidden = el("painel").hidden = true;
  el("recuperacao").hidden = false;
  aviso("");
  el("email-recuperacao").focus();
}

function voltar() {
  el("verificacao").reset();
  etapaCodigo(null);
  el("recuperacao").hidden = true;
  el("acesso").hidden = finalidade === "ativacao";
  el("painel").hidden = finalidade !== "ativacao";
  aviso("");
}
el("esqueci").onclick = () => iniciarVerificacao("senha");
el("ativar-recuperacao").onclick = () => iniciarVerificacao("ativacao");
el("cancelar-verificacao").onclick = voltar;

async function apiVerificacao(acao, campos) {
  const resposta = await fetch("/api/recuperacao", {method:"POST", cache:"no-store",
    headers:{"Content-Type":"application/json"}, body:JSON.stringify({acao, finalidade, ...campos})});
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Recuperação por e-mail temporariamente indisponível.");
  return dados;
}

async function verificar(reenvio) {
  if (el("verificar").disabled) return;
  const email = el("email-recuperacao").value.trim().toLowerCase();
  const reset = finalidade === "senha";
  const botoes = ["verificar","reenviar","cancelar-verificacao"];
  botoes.forEach(id => { el(id).disabled = true; });
  aviso("");
  try {
    if (reset && email !== registro.recuperacao.email) throw new Error("Credenciais inválidas.");
    if (!desafioAtual || reenvio) {
      const dados = await apiVerificacao("enviar", {email, cofre:registro.recuperacao?.cofre});
      etapaCodigo(dados);
      aviso("Código enviado. Confira sua caixa de entrada e a pasta de spam. Ele vale por 10 minutos.");
      el("codigo").focus();
      return;
    }
    const novaSenha = el("nova-senha").value;
    const {cofre, desafio} = desafioAtual;
    const dados = await apiVerificacao("validar", {cofre, desafio, email, codigo:el("codigo").value.trim()});
    const bytes = Uint8Array.from(atob(dados.chave), c => c.charCodeAt(0));
    const chaveDados = await importarChave(bytes);
    const catalogo = await abrirCatalogo(registro, reset ? chaveDados : chave);
    const sal = reset ? crypto.getRandomValues(new Uint8Array(16)) : registro.sal;
    const senhaLocal = reset ? await chaveLocal(novaSenha, sal) : chaveSenha;
    const recuperacao = await protegerChave(bytes, senhaLocal, cofre, email);
    registro = await gravarCatalogo({...registro, sal, recuperacao}, chaveDados, catalogo);
    if (!reset) {
      chave = chaveDados;
      el("ativar-recuperacao").hidden = true;
    }
    voltar();
    aviso(reset ? "Senha alterada. Entre com a nova senha." : "Recuperação por e-mail ativada.");
    el(reset ? "usuario" : "busca").focus();
  } catch (erro) {
    aviso(erro instanceof TypeError ? "Falha na conexão. Tente novamente." : erro.message);
  } finally { botoes.forEach(id => { el(id).disabled = false; }); }
}
el("verificacao").onsubmit = evento => { evento.preventDefault(); verificar(false); };
el("reenviar").onclick = () => verificar(true);
