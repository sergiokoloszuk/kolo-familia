"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

export type AfiliadoResult = { ok: true; id: string } | { ok: false; error: string };

const campos = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("E-mail inválido"),
  codigo_unico: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,40}$/, "Use 3-40 letras/números/-/_")
    .optional()
    .or(z.literal("")),
  ativo: z.boolean(),
  comissao_tipo: z.enum([
    "pct_primeira_mensalidade",
    "pct_recorrente",
    "valor_fixo",
    "nenhuma",
  ]),
  comissao_valor: z.coerce.number().min(0).max(1_000_000),
  comissao_meses: z.coerce.number().int().min(1).max(60),
  desconto_tipo: z.enum(["nenhum", "pct", "valor"]),
  desconto_valor: z.coerce.number().min(0).max(1_000_000),
  desconto_duracao: z.enum(["primeira", "sempre"]),
  janela_atribuicao_dias: z.coerce.number().int().min(1).max(365),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type Campos = z.infer<typeof campos>;

function gerarCodigo(nome: string): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 6)
      .toUpperCase() || "KOLO";
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${rnd}`;
}

function toRow(data: Campos) {
  return {
    nome: data.nome,
    email: data.email,
    ativo: data.ativo,
    comissao_tipo: data.comissao_tipo,
    comissao_valor: data.comissao_valor,
    comissao_meses: data.comissao_meses,
    desconto_tipo: data.desconto_tipo,
    desconto_valor: data.desconto_valor,
    desconto_duracao: data.desconto_duracao,
    janela_atribuicao_dias: data.janela_atribuicao_dias,
    observacoes: data.observacoes?.trim() ? data.observacoes.trim() : null,
  };
}

export async function criarAfiliado(input: Campos): Promise<AfiliadoResult> {
  try {
    const data = campos.parse(input);
    const { supabase } = await requireAdmin();
    const manual = (data.codigo_unico ?? "").trim();
    let codigo = manual || gerarCodigo(data.nome);

    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const { data: row, error } = await supabase
        .from("afiliados")
        .insert({ ...toRow(data), codigo_unico: codigo })
        .select("id")
        .single();
      if (!error && row) {
        revalidatePath("/admin/afiliados");
        return { ok: true, id: row.id as string };
      }
      // Colisão de código e não foi manual → regenera e tenta de novo.
      if (error && /duplicate|unique/i.test(error.message) && !manual) {
        codigo = gerarCodigo(data.nome);
        continue;
      }
      return {
        ok: false,
        error:
          error && /duplicate|unique/i.test(error.message)
            ? "Esse código já existe. Escolha outro."
            : (error?.message ?? "Falha ao criar afiliado."),
      };
    }
    return { ok: false, error: "Não consegui gerar um código único. Defina um manual." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function atualizarAfiliado(
  input: Campos & { id: string },
): Promise<AfiliadoResult> {
  try {
    const id = z.string().uuid().parse(input.id);
    const data = campos.parse(input);
    const { supabase } = await requireAdmin();

    const update: Record<string, unknown> = toRow(data);
    if ((data.codigo_unico ?? "").trim()) {
      update.codigo_unico = data.codigo_unico!.trim();
    }

    const { error } = await supabase.from("afiliados").update(update).eq("id", id);
    if (error) {
      return {
        ok: false,
        error: /duplicate|unique/i.test(error.message)
          ? "Esse código já existe. Escolha outro."
          : error.message,
      };
    }
    revalidatePath("/admin/afiliados");
    revalidatePath(`/admin/afiliados/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
