# PuraPolpa

Abra dist/index.html em um navegador. A página funciona diretamente pelo arquivo.

## Publicação na Vercel

Importe o repositório Git na Vercel e mantenha o diretório raiz do projeto em `.`. O `vercel.json` usa o preset estático (Other), executa `npm run build` e publica a pasta `out`. Para reproduzir a versão otimizada localmente, execute `npm ci` e `npm run build` na raiz. O app funciona sem variáveis de ambiente. A vitrine abre em `/` e o painel de custos em `/admin.html`.

O painel mantém o login e o catálogo no navegador, vinculados ao endereço do site. Ao mudar de domínio, o cadastro e os custos anteriores continuam disponíveis no endereço original. O primeiro acesso ao novo endereço inicia um catálogo local.

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
