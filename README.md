# Minha Faculdade

App web (instalável no celular) para controlar faltas, notas, grade horária, conflitos com o trabalho e o progresso até a formatura (obrigatórias, optativas, estágio e horas complementares). Os dados ficam sincronizados via Supabase.

## 1. Configurar o Supabase (uma vez)

1. Crie uma conta grátis em <https://supabase.com> e um projeto novo.
2. Vá em **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**. (Se o seu banco já existia de versões anteriores, rode em ordem os arquivos `supabase/migracao-2.sql`, `migracao-3.sql` e `migracao-4.sql`; todos podem ser repetidos sem problema.)
3. Em **Authentication → URL Configuration**, coloque em *Site URL* `http://localhost:5173` (depois troque/adicione a URL da Vercel em *Redirect URLs*).
4. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.
5. Copie `.env.example` para `.env` e cole os dois valores.

## 2. Rodar no computador

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes dos cálculos
```

## 3. Publicar na Vercel e usar no celular

1. Suba a pasta para um repositório **privado** no GitHub.
2. Em <https://vercel.com> → **Add New → Project** → importe o repositório (o Vite é detectado sozinho).
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (os mesmos valores do seu `.env`) e clique em **Deploy**.
4. No Supabase → **Authentication → URL Configuration**: coloque a URL da Vercel em *Site URL* e adicione `https://SEU-SITE.vercel.app/**` em *Redirect URLs*.
5. No celular, abra a URL e use **Adicionar à tela inicial** (Chrome/Safari).

O link de assinatura da agenda (Google/Outlook) usa a função `api/calendario.ts`, que a Vercel publica junto com o site.

## Uso

1. **Configurações** — regras do curso: frequência mínima, média, horas exigidas.
2. **Importar grade** — planilha/CSV (veja `public/modelo-grade.csv`). Se só tiver o PDF, peça ao Claude para convertê-lo nesse formato.
3. **Matérias** — cadastre as matérias do semestre com o total de aulas; lance avaliações e notas.
4. **Semana** — horários de aula **e de trabalho**; conflitos ficam com borda vermelha e os intervalos curtos aparecem destacados.
5. **Hoje** — marque “Fui / Faltei” em cada aula do dia.
6. **Grade curricular → Posso cursar** — disciplinas com pré-requisitos cumpridos.

Ao fim do semestre, use **Encerrar matéria**: ela marca a disciplina da grade como aprovada/reprovada conforme média e faltas.
