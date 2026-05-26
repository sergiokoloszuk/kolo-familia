"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, Sparkles, Users } from "lucide-react";

export function Tela6Confirmacao({
  apelido,
  pending,
  onComplete,
  onPrevious,
}: {
  apelido: string;
  pending: boolean;
  onComplete: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          <div>
            <p className="font-medium">Tudo pronto, {apelido}.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Seus 30 dias grátis começam agora. Sem cartão. Cancela quando quiser.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Tour
          icon={<MessageCircle className="size-5" aria-hidden="true" />}
          title="A Ayla já vai aparecer"
          body="A primeira mensagem da Ayla está saindo agora pro seu WhatsApp."
        />
        <Tour
          icon={<Users className="size-5" aria-hidden="true" />}
          title="Kolo Vivo abre"
          body="Cada coisa que você for me contando vira contexto pra deixar o cuidado mais leve."
        />
        <Tour
          icon={<Sparkles className="size-5" aria-hidden="true" />}
          title="Especialistas escutam"
          body="Quando tiver dúvida, pergunta no app. O sistema decide qual perspectiva responde."
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onPrevious} disabled={pending}>
          Voltar
        </Button>
        <Button type="button" onClick={onComplete} disabled={pending}>
          {pending ? "Abrindo..." : "Ir para o painel"}
        </Button>
      </div>
    </div>
  );
}

function Tour({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="mb-2 text-primary">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
