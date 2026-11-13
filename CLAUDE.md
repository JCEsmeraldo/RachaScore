# RachaScore

## Publicar (push) = nova versão com Novidades

Todo push com mudança visível ao usuário (commit `feat:` ou `fix:`) precisa sair como versão nova:

1. Subir `version` no `package.json` (e no `package-lock.json`) — semver: novidade → minor, só correção → patch.
2. Adicionar a entrada no topo de `src/lib/changelog.ts` com a mesma versão e a data, em linguagem de usuário (Novo / Melhoria / Correção). Não é o git log.
3. Commitar junto e criar a tag: `git tag -a vX.Y.Z -m vX.Y.Z`.
4. Publicar com `git push --follow-tags origin main` (só com autorização do usuário).

O hook `.githooks/pre-push` (`npm run check-release`) bloqueia o push se a versão do `package.json` não bater com o topo do changelog, se faltar a tag, ou se houver `feat:`/`fix:` depois da última tag. `chore:`/`docs:`/`refactor:` não exigem versão. Emergência: `git push --no-verify`.

O hook é ativado por `npm install` (script `prepare` → `git config core.hooksPath .githooks`).

Mudança de schema = arquivo datado em `supabase/` (ex.: `2026-11-tipo-erro.sql`) + `schema.sql` + `schema.dbml` no mesmo commit. O usuário roda o SQL no editor do Supabase **antes** do push quando o front depende dele.
