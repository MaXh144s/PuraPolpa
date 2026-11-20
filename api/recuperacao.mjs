import { createHmac, randomInt, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

const remetente = "purapolpaacaioficial@gmail.com";
const invalido = "Credenciais inválidas.";
const indisponivel = "Recuperação por e-mail temporariamente indisponível.";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const validade = 600;

async function redis(...comando) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method:"POST", headers:{Authorization:"Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN, "Content-Type":"application/json"},
    body:JSON.stringify(comando), signal:AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error("Armazenamento indisponível");
  const {result,error} = await r.json();
  if (error) throw new Error("Falha no armazenamento");
  return result;
}

function assinatura(segredo, ...campos) {
  return createHmac("sha256", segredo).update(JSON.stringify(campos)).digest("base64");
}

async function enviarCodigo(email, codigo, ativacao) {
  const titulo = ativacao ? "Ative a recuperação da sua conta" : "Redefina sua senha";
  const instrucao = "Digite o código abaixo no painel administrativo da PuraPolpa.";
  const rodape = "O código vale por 10 minutos. Se você não fez esta solicitação, ignore este e-mail.";
  const gmail = nodemailer.createTransport({
    host:"smtp.gmail.com", port:465, secure:true,
    auth:{user:remetente, pass:process.env.GMAIL_APP_PASSWORD.replace(/\s/g,"")},
    connectionTimeout:8000, greetingTimeout:8000, socketTimeout:12000
  });
  await gmail.sendMail({
    from:{name:"PuraPolpa",address:remetente}, to:email, subject:"PuraPolpa · " + titulo,
    text:`PuraPolpa\n\n${titulo}\n${instrucao}\n\n${codigo}\n\n${rodape}`,
    html:`<div lang="pt-BR" style="background:#f5f0f4;padding:24px 12px;font:16px/1.5 Arial,sans-serif;color:#432340">
      <div style="max-width:480px;margin:auto;background:#fffdf9;border-radius:16px;padding:32px">
      <div style="font:bold italic 30px Georgia,serif;color:#490052">PuraPolpa</div><div style="width:40px;border-top:3px solid #e1b93a;margin:12px 0 24px"></div>
      <h1 style="font:28px Georgia,serif;color:#490052">${titulo}</h1><p>${instrucao}</p>
      <p style="background:#f3edf3;border-radius:8px;padding:16px;text-align:center;font:bold 30px monospace;letter-spacing:4px;color:#490052">${codigo}</p>
      <p style="font-size:14px;color:#655762">${rodape}</p><p style="font:italic 18px Georgia,serif">Sabor que marca!</p></div></div>`
  });
}

// Restringe o envio por destinatário, inclusive em instâncias concorrentes.
const reservarEnvio = `
if redis.call('EXISTS',KEYS[1]) == 1 or tonumber(redis.call('GET',KEYS[2]) or '0') >= 5 then return 0 end
redis.call('SET',KEYS[1],1,'EX',60)
if redis.call('INCR',KEYS[2]) == 1 then redis.call('EXPIRE',KEYS[2],3600) end
return 1`;
// Cada tentativa e o consumo do código válido acontecem na mesma transação.
const consumir = `
local esperado = redis.call('HGET',KEYS[1],'digest')
if not esperado then return 0 end
if esperado == ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end
if redis.call('HINCRBY',KEYS[1],'falhas',1) >= 5 then redis.call('DEL',KEYS[1]) end
return 0`;

export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).end(); }
  if (!req.headers["content-type"]?.startsWith("application/json")) return res.status(415).end();
  const segredo = process.env.RECOVERY_SECRET;
  if (!segredo || Buffer.from(segredo,"base64").length < 32 || !process.env.GMAIL_APP_PASSWORD ||
      !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({erro:indisponivel});
  }
  const {acao, finalidade, email, cofre, desafio, codigo} = req.body ?? {};
  const destinatario = (process.env.ADMIN_RECOVERY_EMAIL || remetente).trim().toLowerCase();
  if (typeof email !== "string" || email.trim().toLowerCase() !== destinatario ||
      !["ativacao","senha"].includes(finalidade)) return res.status(400).json({erro:invalido});
  const secret = Buffer.from(segredo,"base64");
  const prefixo = "purapolpa:verificacao:" + assinatura(secret,"email",destinatario) + ":";
  try {
    if (acao === "enviar") {
      const id = finalidade === "ativacao" ? randomUUID() : cofre;
      if (typeof id !== "string" || !uuid.test(id)) return res.status(400).json({erro:invalido});
      if (!await redis("EVAL",reservarEnvio,2,prefixo+"pausa",prefixo+"hora")) {
        return res.status(429).json({erro:"Limite de envios atingido. Tente novamente mais tarde."});
      }
      const nonce = randomUUID();
      const valor = randomInt(100000000).toString().padStart(8,"0");
      const digest = assinatura(secret,"codigo",nonce,finalidade,id,destinatario,valor);
      const chave = prefixo + nonce;
      await redis("EVAL","redis.call('HSET',KEYS[1],'digest',ARGV[1]); return redis.call('EXPIRE',KEYS[1],ARGV[2])",1,chave,digest,validade);
      try { await enviarCodigo(destinatario,valor,finalidade === "ativacao"); }
      catch (erro) { await redis("DEL",chave); throw erro; }
      return res.status(200).json({desafio:nonce, cofre:id});
    }
    if (acao !== "validar" || typeof codigo !== "string" || !/^\d{8}$/.test(codigo) ||
        !uuid.test(desafio) || !uuid.test(cofre)) return res.status(400).json({erro:invalido});
    const digest = assinatura(secret,"codigo",desafio,finalidade,cofre,destinatario,codigo);
    if (!await redis("EVAL",consumir,1,prefixo+desafio,digest)) return res.status(400).json({erro:invalido});
    return res.status(200).json({chave:assinatura(secret,"chave-do-cofre",cofre,destinatario)});
  } catch { return res.status(503).json({erro:indisponivel}); }
}
