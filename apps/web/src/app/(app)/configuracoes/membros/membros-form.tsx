"use client";

import { useState, useTransition } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  idadeAnos,
  dataBrParaIso,
  mascararDataBr,
  dataIsoParaBr,
} from "@/lib/idade";
import { atualizarMembro } from "./actions";

const PERFIS = [
  { value: "TEA", label: "TEA" },
  { value: "TDAH", label: "TDAH" },
  { value: "Dislexia", label: "Dislexia" },
  { value: "AHSD", label: "AH/SD" },
  { value: "Outro", label: "Outro" },
  { value: "EmInvestigacao", label: "Em investigação" },
] as const;

type Membro = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  perfil: string;
};

export function MembrosForm({ membros }: { membros: Membro[] }) {
  return (
    <div className="flex flex-col gap-4">
      {membros.map((m) => (
        <MembroCard key={m.id} membro={m} />
      ))}
    </div>
  );
}

function MembroCard({ membro }: { membro: Membro }) {
  const [nome, setNome] = useState(membro.nome);
  const [dataBr, setDataBr] = useState(dataIsoParaBr(membro.data_nascimento));
  const [perfil, setPerfil] = useState(membro.perfil);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);
  const [pending, start] = useTransition();

  const iso = dataBrParaIso(dataBr);
  const idade = iso ? idadeAnos(iso) : null;
  const idadeSuspeita = idade != null && idade >= 30;

  function salvar() {
    setErro(null);
    setOkMsg(false);
    start(async () => {
      const r = await atualizarMembro({
        id: membro.id,
        nome,
        data_nascimento: dataBr,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        perfil: perfil as any,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOkMsg(true);
    });
  }

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label htmlFor={`nome-${membro.id}`}>Nome</Label>
          <Input
            id={`nome-${membro.id}`}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setOkMsg(false);
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`data-${membro.id}`}>Data de nascimento</Label>
          <Input
            id={`data-${membro.id}`}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={dataBr}
            onChange={(e) => {
              setDataBr(mascararDataBr(e.target.value));
              setOkMsg(false);
            }}
          />
          <span className="text-xs text-muted-foreground">
            {idade != null ? `${idade} anos` : "—"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-3">
          <Label htmlFor={`perfil-${membro.id}`}>Perfil</Label>
          <select
            id={`perfil-${membro.id}`}
            value={perfil}
            onChange={(e) => {
              setPerfil(e.target.value);
              setOkMsg(false);
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            {PERFIS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {idadeSuspeita && (
        <p className="mt-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {idade} anos — confira se a data de nascimento está certa (às vezes entra,
          por engano, a do responsável).
        </p>
      )}
      {erro && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Button type="button" onClick={salvar} disabled={pending}>
          {pending ? (
            <>
              <RefreshCw className="size-4 animate-spin" aria-hidden /> Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
        {okMsg && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <Check className="size-4" aria-hidden /> Salvo
          </span>
        )}
      </div>
    </div>
  );
}
