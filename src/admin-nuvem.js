import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth:{detectSessionInUrl:false}
});
let revisao;
let token = new URLSearchParams(location.hash.slice(1)).get("recuperar");
let linkValidado = false;
if (token) history.replaceState(null, "", location.pathname + location.search);

function falha(erro) {
  if (erro.code === "23505") return "Já existe um item com esse nome no catálogo.";
  if (erro.code === "23503") return "Revise os produtos usados na composição da receita.";
  if (erro.code === "42501") return "Esta conta não tem acesso ao catálogo. Verifique a autorização do administrador.";
  if (erro.code === "P0001") return erro.message;
  return "Não foi possível acessar o catálogo. Confira a conexão e a configuração da Supabase.";
}

async function consultar(funcao, parametros) {
  const {data,error} = await supabase.rpc(funcao, parametros);
  if (error) throw new Error(falha(error));
  revisao = data.revisao;
  return data.itens;
}
window.catalogoOnline = {
  alterar(acao, dados) {
    return consultar("pp_alterar", {versao:revisao, acao, dados});
  }
};

function telaLogin() {
  itens = [];
  revisao = undefined;
  el("lista").replaceChildren();
  editar();
  el("migracao").hidden = true;
  el("painel").hidden = el("sair").hidden = el("senha-online").hidden = true;
  el("acesso").hidden = false;
  el("senha").value = "";
}
async function abrirPainel() {
  itens = await consultar("pp_catalogo");
  el("acesso").hidden = true;
  el("sair").hidden = el("painel").hidden = false;
  editar();
  listar();
  try { el("migracao").hidden = !await lerCofre(); }
  catch { el("migracao").hidden = true; }
  el("busca").focus();
}

el("login").onsubmit = async evento => {
  evento.preventDefault();
  el("entrar").disabled = true;
  aviso("");
  try {
    const {error} = await supabase.auth.signInWithPassword({email:el("usuario").value.trim(), password:el("senha").value});
    if (error) throw new Error("Não foi possível entrar. Confira o e-mail, a senha e a conexão.");
    el("senha").value = "";
    await abrirPainel();
  } catch (erro) { aviso(erro.message); }
  finally { el("entrar").disabled = false; }
};
el("sair").onclick = async () => {
  const {error} = await supabase.auth.signOut({scope:"local"});
  if (error) return aviso("Falha ao sair. Tente novamente.");
  telaLogin();
};
el("esqueci").onclick = async () => {
  if (!el("usuario").reportValidity()) return;
  el("esqueci").disabled = true;
  try {
    const {error} = await supabase.auth.resetPasswordForEmail(el("usuario").value.trim(), {
      redirectTo:location.origin + location.pathname
    });
    aviso(error ? "Não foi possível solicitar o e-mail. Tente novamente mais tarde." : "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
  } finally { el("esqueci").disabled = false; }
};
el("form-senha-online").onsubmit = async evento => {
  evento.preventDefault();
  const botao = evento.currentTarget.querySelector("button");
  botao.disabled = true;
  try {
    if (!linkValidado) {
      const {error} = await supabase.auth.verifyOtp({token_hash:token, type:"recovery"});
      if (error) {
        token = null;
        telaLogin();
        throw new Error("O link expirou ou já foi usado. Solicite outro e-mail.");
      }
      token = null;
      linkValidado = true;
    }
    const {error} = await supabase.auth.updateUser({password:el("senha-online-nova").value});
    if (error) throw new Error("Não foi possível salvar a senha. Confira os requisitos de senha do projeto e tente novamente.");
    el("form-senha-online").reset();
    await supabase.auth.signOut({scope:"local"});
    linkValidado = false;
    telaLogin();
    aviso("Senha alterada. Entre com a nova senha.");
  } catch (erro) { aviso(erro.message); }
  finally { botao.disabled = false; }
};

el("form-migracao").onsubmit = async evento => {
  evento.preventDefault();
  const botao = evento.currentTarget.querySelector("button");
  botao.disabled = true;
  try {
    if (itens.length) throw new Error("O catálogo online já contém itens. A importação inicial exige um catálogo online vazio.");
    const local = await lerCofre();
    if (!local) throw new Error("Catálogo local não encontrado neste navegador.");
    let antigos;
    try {
      const chave = await chaveLocal(el("senha-migracao").value,local.sal);
      antigos = adaptarCatalogo(await abrirCatalogo(local,await chaveDoCatalogo(local,chave)));
    } catch { throw new Error("Não foi possível abrir o catálogo com a senha local informada."); }
    if (!antigos.length) throw new Error("O catálogo local está vazio.");
    itens = await window.catalogoOnline.alterar("importar",antigos);
    el("form-migracao").reset();
    el("migracao").open = false;
    editar();
    listar();
    aviso(itens.length + " itens importados. Confira os pesos, as composições e os custos.");
  } catch (erro) { aviso(erro.message); }
  finally { botao.disabled = false; }
};

async function iniciarNuvem() {
  el("titulo-acesso").textContent = "Entrar no painel";
  el("instrucao").textContent = "Entre com sua conta administrativa da PuraPolpa.";
  el("rotulo-usuario").textContent = "E-mail";
  el("usuario").type = "email";
  el("nota-acesso").hidden = el("ativar-recuperacao").hidden = true;
  el("esqueci").hidden = el("entrar").disabled = false;
  supabase.auth.onAuthStateChange(evento => {
    if (evento === "SIGNED_OUT") telaLogin();
  });
  if (token) {
    el("acesso").hidden = true;
    el("senha-online").hidden = false;
    el("senha-online-nova").focus();
    return;
  }
  const {data,error} = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) await abrirPainel();
}
iniciarNuvem().catch(erro => aviso(erro.message));
