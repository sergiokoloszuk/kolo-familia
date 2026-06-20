import { requireAdmin } from "@/lib/auth/require-admin";
import { listCoAcessos } from "./actions";
import { CoAcessoForm } from "./co-acesso-form";

export default async function AdminCoAcessosPage() {
  await requireAdmin();
  const acessos = await listCoAcessos();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Co-acesso à minha conta</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Autorize pessoas (ex.: agência) a entrar na <strong>sua</strong> conta com login
          próprio — elas veem o seu conteúdo, sem você passar sua senha. Você informa só o
          e-mail; a pessoa se cadastra e <strong>define a própria senha no 1º acesso</strong>.
          Removeu o e-mail, acabou o acesso. (Privado — não aparece pros usuários.)
        </p>
      </header>

      <CoAcessoForm acessos={acessos} />
    </div>
  );
}
