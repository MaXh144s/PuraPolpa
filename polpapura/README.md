# PuraPolpa

Abra dist/index.html em um navegador. A página funciona diretamente pelo arquivo.

## Publicação na Vercel

Importe o repositório Git na Vercel e mantenha o diretório raiz do projeto em `.`. O `vercel.json` usa o preset estático (Other), executa `npm run build` e publica a pasta `out`. Para reproduzir a versão otimizada localmente, execute `npm ci` e `npm run build` na raiz. A vitrine abre em `/` e o painel de custos em `/admin.html`. A recuperação por e-mail usa a função `/api/recuperacao`.

O painel mantém o login e o catálogo no navegador, vinculados ao endereço do site. Ao mudar de domínio, o cadastro e os custos anteriores continuam disponíveis no endereço original. O primeiro acesso ao novo endereço inicia um catálogo local.

### Ativar o envio de códigos

No projeto da Vercel, abra **Settings → Environment Variables** e configure os valores no ambiente **Production**. Guarde os segredos em um gerenciador de senhas.

| Variável | Valor |
| --- | --- |
| `GMAIL_APP_PASSWORD` | Senha de app gerada na conta `purapolpaacaioficial@gmail.com`, com verificação em duas etapas ativa. [Configuração no Google](https://support.google.com/accounts/answer/185833?hl=pt-BR) |
| `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` | URL REST e token de leitura e escrita de uma base Upstash Redis. A base guarda verificações e limites de envio com expiração. |
| `RECOVERY_SECRET` | Chave aleatória de 32 bytes em base64. Gere uma vez no seu terminal com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Preserve o valor entre deploys para recuperar cofres já ativados. |
| `ADMIN_RECOVERY_EMAIL` | Opcional. Destinatário autorizado. O padrão é `purapolpaacaioficial@gmail.com`. |

Depois de salvar as variáveis, faça um novo deploy. Entre no painel no navegador que contém o catálogo, selecione **Ativar recuperação por e-mail** e confirme o código recebido. Daí em diante, **Esqueci minha senha** permite reabrir o mesmo catálogo com uma nova senha. Contas anteriores à ativação precisam da senha atual para preparar a recuperação. O código expira em dez minutos e admite até cinco tentativas. O envio está limitado a um por minuto e cinco por hora.

## Textos e identidade

Edite os títulos, parágrafos, navegação e assinatura em dist/index.html. A apresentação visual está em dist/estilo.css. A grafia segue os rótulos fornecidos. Para usar a logo oficial, substitua o texto nos elementos de classe brand pela imagem original com alt="PuraPolpa".

## Fotografias

Substitua o PNG correspondente em [dist/garrafas](dist/garrafas/), mantendo o nome. A página local usa o original. A cada publicação, o build gera versões WebP com transparência e compressão sem perdas em várias resoluções. O navegador escolhe o tamanho conforme a tela. O conteúdo da imagem determina a URL usada no cache.

| Apresentação | Arquivo |
| --- | --- |
| 250 ml | garrafa-250.png |
| 300 ml | garrafa-300.png |
| 500 ml | garrafa-500.png |
| 900 ml | garrafa-900.png |
| 900 ml sem rótulo | garrafa-900-sem-rotulo.png |
| Sem rótulo, primeira foto genérica | sem-rotulo-a.png |
| Sem rótulo, segunda foto genérica | sem-rotulo-b.png |

Use PNGs com fundo transparente. Os dois arquivos genéricos se alternam nos volumes menores.

A apresentação faz uma pausa de três segundos entre transições. Os controles funcionam com Tab, Enter e Espaço. Com redução de movimento, a seleção é manual e imediata.
