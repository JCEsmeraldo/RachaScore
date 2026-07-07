# RachaScore

App pra organizar rachas(peladas) de futebol e vôlei de um grupo fixo de amigos: presença com lista de espera, sorteio/montagem de times, placar ao vivo, estatísticas e avaliação de jogadores.

## Stack

- React 19 + Vite + TypeScript
- React Router v7
- Tailwind CSS v4
- Supabase (Postgres + Auth + Realtime)
- Deploy: GitHub Pages via GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))

## Funcionalidades

- Grupos com membros fixos e avulsos, convite por link
- Racha em modo **torneio** (times fixos, classificação) ou **rápido** (times montados partida a partida, com time personalizado na hora)
- Presença com limite de jogadores e lista de espera automática
- Placar granular por evento de ponto/gol — motivo do ponto no vôlei, assistência e cartões no futebol
- Cronômetro do futebol persistido no banco, sincronizado ao vivo entre dispositivos
- Sorteio de times preservando histórico de partidas já jogadas
- Estatísticas por racha, por grupo e por jogador
- Avaliação de jogadores (nota 1-5 por racha, média por modalidade)
- Compartilhamento da lista de presença pro WhatsApp

Regras de negócio detalhadas em [docs/regras-negocio.md](docs/regras-negocio.md).

## Rodando localmente

Requer Node 24 (ver [.nvmrc](.nvmrc)).

```bash
npm install
cp .env.example .env   # preenche VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Banco: rode [supabase/schema.sql](supabase/schema.sql) e depois [supabase/policies.sql](supabase/policies.sql) no SQL Editor do projeto Supabase. Modelo do schema em [supabase/schema.dbml](supabase/schema.dbml) (visualizável em [dbdiagram.io](https://dbdiagram.io)).

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — type-check (`tsc -b`) + build de produção
- `npm run lint` — ESLint
- `npm run preview` — preview do build de produção
