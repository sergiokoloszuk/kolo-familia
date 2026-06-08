"use client";

import { useForm, useFieldArray, useWatch, Controller, type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Trash2, Plus } from "lucide-react";
import { capitalizarNome } from "@/lib/nome";
import { idadeAnos } from "@/lib/idade";
import type { Membro } from "../wizard";

// 6 temas de desafio — cada um com um exemplo (placeholder) próprio, que
// mostra o nível de detalhe ("quando" + "o quê") sem obrigar a escrever muito.
const TEMAS = [
  { value: "Comunicação", placeholder: "Ex.: ele aponta o que quer, mas quase não usa palavras." },
  { value: "Foco", placeholder: "Ex.: ele larga a atividade assim que ouve barulho na rua." },
  { value: "Socialização", placeholder: "Ex.: ele quer brincar com os primos, mas fica de longe olhando." },
  { value: "Autonomia", placeholder: "Ex.: ele não se veste sozinho, preciso ajudar em cada peça." },
  { value: "Gestão de emoções", placeholder: "Ex.: quando contraria, ele se joga no chão e demora pra voltar." },
  { value: "Alimentação", placeholder: "Ex.: ele só aceita comida branca e recusa qualquer coisa nova." },
] as const;

const PLACEHOLDER_PADRAO = "O que acontece? Conte o quando e o quê.";

// Interesses adaptam pela idade (calculada da data de nascimento do Passo 2):
// crianças pequenas, crianças e adolescentes/jovens veem listas diferentes.
function interessesPorIdade(idade: number | null): string[] {
  if (idade != null && idade >= 13) {
    return [
      "Games",
      "Séries e filmes",
      "Música/artistas",
      "Esportes",
      "Desenho/arte",
      "Tecnologia",
      "Criadores/redes",
      "Animais",
    ];
  }
  if (idade != null && idade >= 7) {
    return [
      "Desenhos/personagens",
      "Games",
      "Histórias e livros",
      "Música",
      "Esportes",
      "Animais",
      "Desenhar/arte",
      "Ciência/curiosidades",
    ];
  }
  return [
    "Desenhos animados",
    "Histórias/livrinhos",
    "Música",
    "Animais",
    "Dinossauros",
    "Carrinhos",
    "Água/banho",
    "Desenhar/pintar",
    "Números e letras",
  ];
}

function exemploInteresse(idade: number | null): string {
  if (idade != null && idade >= 13) return "Ex.: uma série, um jogo, um artista, um esporte...";
  if (idade != null && idade >= 7) return "Ex.: um personagem, um jogo, um livro, um esporte...";
  return "Ex.: um personagem, um desenho, uma historinha favorita...";
}

type Desafio = { tema: string; texto: string };

type FormValues = {
  porMembro: {
    membro_id: string;
    desafios: Desafio[];
    interesses: string[];
    interesse_aberto: string;
    conquista: string;
    rotina: string;
  }[];
};

export function Tela4QuickKoloVivo({
  membros,
  pending,
  onSubmit,
  onPrevious,
}: {
  membros: Membro[];
  pending: boolean;
  onSubmit: (
    data: {
      membro_id: string;
      desafios: string[];
      interesses: string[];
      conquista?: string;
      rotina?: string;
    }[],
  ) => void;
  onPrevious: () => void;
}) {
  const { register, control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      porMembro: membros.map((m) => ({
        membro_id: m.id,
        desafios: [{ tema: "", texto: "" }],
        interesses: [],
        interesse_aberto: "",
        conquista: "",
        rotina: "",
      })),
    },
  });

  const { fields } = useFieldArray({ control, name: "porMembro" });

  function submit(values: FormValues) {
    const out = values.porMembro.map((p) => {
      const desafios = p.desafios
        .filter((d) => d.tema && d.texto.trim().length > 0)
        .map((d) => `${d.tema}: ${d.texto.trim()}`);
      const interesses = [
        ...p.interesses,
        ...(p.interesse_aberto.trim() ? [p.interesse_aberto.trim()] : []),
      ];
      return {
        membro_id: p.membro_id,
        desafios,
        interesses,
        conquista: p.conquista.trim() || undefined,
        rotina: p.rotina.trim() || undefined,
      };
    });
    onSubmit(out);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-6" noValidate>
        {fields.map((field, mi) => (
          <MembroBloco
            key={field.id}
            control={control}
            register={register}
            mi={mi}
            membro={membros[mi]}
            pending={pending}
          />
        ))}

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onPrevious} disabled={pending}>
            Voltar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Continuar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MembroBloco({
  control,
  register,
  mi,
  membro,
  pending,
}: {
  control: Control<FormValues>;
  register: ReturnType<typeof useForm<FormValues>>["register"];
  mi: number;
  membro: Membro;
  pending: boolean;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `porMembro.${mi}.desafios`,
  });
  const desafios = useWatch({ control, name: `porMembro.${mi}.desafios` });
  const nome = capitalizarNome(membro.nome);
  const idade = idadeAnos(membro.data_nascimento ?? null);
  const opcoesInteresse = interessesPorIdade(idade);

  return (
    <fieldset className="rounded-md border p-4">
      <legend className="px-2 text-sm font-medium">{nome}</legend>

      <div className="flex flex-col gap-5">
        {/* Desafios */}
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium">O que está difícil agora? (até 3)</Label>
          <p className="-mt-1 text-xs text-muted-foreground">
            Em cada desafio, selecione o tema mais desafiador e depois explique o que
            está acontecendo.
          </p>

          {fields.map((f, di) => {
            const temaAtual = desafios?.[di]?.tema ?? "";
            const ph = TEMAS.find((t) => t.value === temaAtual)?.placeholder ?? PLACEHOLDER_PADRAO;
            return (
              <div key={f.id} className="flex flex-col gap-2 rounded-md border border-input bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Desafio {di + 1}</span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(di)}
                      disabled={pending}
                    >
                      <Trash2 aria-hidden="true" /> Remover
                    </Button>
                  )}
                </div>

                <Controller
                  name={`porMembro.${mi}.desafios.${di}.tema`}
                  control={control}
                  render={({ field }) => (
                    <ChipGroup label="Tema do desafio">
                      {TEMAS.map((t) => (
                        <Chip
                          key={t.value}
                          selected={field.value === t.value}
                          onClick={() => field.onChange(t.value)}
                          disabled={pending}
                        >
                          {t.value}
                        </Chip>
                      ))}
                    </ChipGroup>
                  )}
                />

                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-semibold text-brand-purple">
                    Conte o que acontece
                  </Label>
                  <textarea
                    rows={2}
                    placeholder={ph}
                    {...register(`porMembro.${mi}.desafios.${di}.texto`)}
                    className="w-full resize-none rounded-md border-2 border-brand-purple/30 bg-white px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                  />
                </div>
              </div>
            );
          })}

          {fields.length < 3 && (
            <button
              type="button"
              onClick={() => append({ tema: "", texto: "" })}
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-yellow-dark/50 bg-brand-yellow/10 px-4 py-3 text-sm font-semibold text-brand-purple-dark transition-colors hover:border-brand-yellow-dark/70 hover:bg-brand-yellow/20 disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden="true" /> Adicionar outro desafio
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            Comece pelo que mais pesa — um desafio bem contado já me norteia.
          </p>
        </div>

        {/* Interesses */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">E o que {nome} ama?</Label>
          <p className="-mt-1 text-xs text-muted-foreground">
            Pode escolher mais de um — e detalhar no campo logo abaixo.
          </p>
          <Controller
            name={`porMembro.${mi}.interesses`}
            control={control}
            render={({ field }) => {
              const sel = field.value ?? [];
              return (
                <ChipGroup label="Interesses" multiSelect>
                  {opcoesInteresse.map((it) => (
                    <Chip
                      key={it}
                      multiSelect
                      selected={sel.includes(it)}
                      onClick={() =>
                        field.onChange(
                          sel.includes(it) ? sel.filter((x) => x !== it) : [...sel, it],
                        )
                      }
                      disabled={pending}
                    >
                      {it}
                    </Chip>
                  ))}
                </ChipGroup>
              );
            }}
          />
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-brand-purple">
              Conta mais sobre o que {nome} ama
            </Label>
            <textarea
              rows={2}
              placeholder={exemploInteresse(idade)}
              {...register(`porMembro.${mi}.interesse_aberto`)}
              className="w-full resize-none rounded-md border-2 border-brand-purple/30 bg-white px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Toque no que combina e, principalmente, detalhe no campo acima — um
            personagem, série, brincadeira ou jogo favorito vale ouro pras minhas
            ideias.
          </p>
        </div>

        {/* Conquista */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`conquista-${mi}`} className="text-sm font-medium">
            Teve alguma conquista recente, por menor que pareça?
          </Label>
          <Input
            id={`conquista-${mi}`}
            placeholder="Algo que você quer celebrar"
            {...register(`porMembro.${mi}.conquista`)}
          />
        </div>

        {/* Rotina */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rotina-${mi}`} className="text-sm font-medium">
            E como costuma ser o dia de {nome}?
          </Label>
          <textarea
            id={`rotina-${mi}`}
            rows={2}
            placeholder="Ex.: escola de manhã, terapia ter/qui, custa pegar no sono, come devagar."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...register(`porMembro.${mi}.rotina`)}
          />
        </div>
      </div>
    </fieldset>
  );
}
