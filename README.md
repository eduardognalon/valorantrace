# VALORANT RACE

Aplicação web React/Vite com API Node/Express. O painel, avaliações e objetivos são lidos de um armazenamento no servidor, então todos os visitantes veem os mesmos resultados. A administração exige senha e a API valida a sessão no backend.

## Rodar localmente

1. Copie `.env.example` para `.env` e altere `ADMIN_PASSWORD` e `SESSION_SECRET`.
2. Execute:

```powershell
npm.cmd install
npm.cmd run dev
```

O comando local inicia Vite e API para desenvolvimento. A hospedagem pública usa Render e não depende do computador do organizador.

## Publicar no Render

1. Coloque a pasta do projeto em um repositório GitHub privado. O `.gitignore` exclui `.env`, dependências e dados locais.
2. No Render, crie um **Blueprint** a partir do repositório e use o arquivo `render.yaml`.
3. Informe um valor forte para `ADMIN_PASSWORD` quando o Render solicitar. O Blueprint cria um `SESSION_SECRET` e um disco persistente de 1 GB.
4. Após o deploy, abra a URL `*.onrender.com` criada pelo Render. O serviço faz build de `dist`, serve o site e executa a API no mesmo domínio.

O plano `starter` mantém o serviço ativo sem suspensão por inatividade. O custo de referência é US$ 7/mês pelo serviço mais US$ 0,25/GB/mês do disco de 1 GB (aproximadamente US$ 7,25/mês, antes de uso excedente e impostos; confirme os valores no painel do Render). O plano grátis não atende ao requisito de disponibilidade contínua: ele suspende o serviço depois de 15 minutos sem tráfego, e o sistema de arquivos é temporário.

## Persistência e limites

Os dados compartilhados do torneio são salvos em `DATA_DIR/objectives.json`; no Render, o disco persistente é montado em `/var/data`. Faça backups desse arquivo antes de mudanças importantes. O projeto usa armazenamento JSON e uma instância única, adequado para este grupo pequeno; se houver crescimento ou necessidade de alta disponibilidade, migre para PostgreSQL.

A autenticação está ativa para salvar objetivos e avaliações. O administrador usa uma senha única definida como variável de ambiente; nunca a coloque no frontend ou em repositório. A disponibilidade contínua de um serviço não equivale a uma garantia de 100% de uptime.

## Estrutura

- `src/App.jsx`: interface, ranking, perfis, avaliação e administração.
- `src/data.js`: dados iniciais.
- `src/styles.css`: visual responsivo.
- `server/index.js`: API, autenticação e persistência.
- `render.yaml`: configuração de implantação e disco persistente.
