"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createVeto } from "./actions";

const CATEGORIAS_SUGERIDAS = [
  "performar empatia",
  "clichê de maternidade",
  "clichê corporativo",
  "palavrão",
  "nome de método",
  "autor de neurodivergência",
  "termo clínico",
  "tom alarmista",
];

export function VetoForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [categoria, setCategoria] = useState("");
  const [padrao, setPadrao] = useState("");
  const [flags, setFlags] = useState("i");
  const [descricao, setDescricao] = useState("");
  const [sugestao, setSugestao] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    startTransition(async () => {
      const res = await createVeto({
        categoria,
        padrao,
        flags,
        descricao: descricao || undefined,
        sugestao: sugestao || undefined,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setOk(true);
      setPadrao("");
      setDescricao("");
      setSugestao("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
        <div>
          <Label htmlFor="categoria">Categoria</Label>
          <input
            id="categoria"
            type="text"
            required
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            list="cat-sugestoes"
            placeholder="ex: clichê de maternidade"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={pending}
          />
          <datalist id="cat-sugestoes">
            {CATEGORIAS_SUGERIDAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="flags">Flags</Label>
          <input
            id="flags"
            type="text"
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            placeholder="i"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            disabled={pending}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            <code>i</code> = case-insensitive (padrão)
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="padrao">Padrão regex</Label>
        <input
          id="padrao"
          type="text"
          required
          value={padrao}
          onChange={(e) => setPadrao(e.target.value)}
          placeholder={'\\bguerreira\\b'}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
          disabled={pending}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use sintaxe JavaScript regex. <code>\b</code> = boundary de palavra. Caracteres
          opcionais com <code>[ãa]</code>, <code>[íi]</code>.
        </p>
      </div>

      <div>
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <input
          id="descricao"
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Pra que existe esse veto"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        />
      </div>

      <div>
        <Label htmlFor="sugestao">Sugestão pra quando bater (opcional)</Label>
        <input
          id="sugestao"
          type="text"
          value={sugestao}
          onChange={(e) => setSugestao(e.target.value)}
          placeholder="Deixe em branco pra usar a sugestão padrão"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        />
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {ok && <p className="text-sm text-emerald-600">Veto adicionado. Cache atualiza em &lt;1min.</p>}

      <div>
        <Button type="submit" disabled={pending || !categoria || !padrao}>
          {pending ? "Adicionando..." : "Adicionar veto"}
        </Button>
      </div>
    </form>
  );
}
