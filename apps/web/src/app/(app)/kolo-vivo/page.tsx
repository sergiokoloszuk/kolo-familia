import { Users } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { ComoUsar } from "@/components/brand/como-usar";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { idadeAnos } from "@/lib/idade";
import { DOMINIOS, type DominioKey } from "./dominios";
import type { DominioSugestao } from "./dominio-card";
import {
  KoloVivoWrapper,
  type FamiliaSecoes,
  type MembroData,
  type Secao,
  type SugestaoRow,
} from "./wrapper";

export default async function KoloVivoPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: familia }, { data: perfisMembros }, { data: sugestoes }] =
    await Promise.all([
      supabase
        .from("membros_atipicos")
        .select("id, nome, data_nascimento, perfil, created_at")
        .eq("family_account_id", familyId)
        .eq("ativo", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("perfil_vivo_familia")
        .select("composicao, rotina, recursos, dinamica, completude_pct")
        .eq("family_account_id", familyId)
        .maybeSingle(),
      supabase
        .from("perfil_vivo_membro")
        .select(
          "membro_atipico_id, essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
        )
        .eq("family_account_id", familyId),
      supabase
        .from("sugestao_perfil_vivos")
        .select("id, membro_atipico_id, camada, campo, texto_sugerido, origem, created_at")
        .eq("family_account_id", familyId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false }),
    ]);

  const familiaSecoes: FamiliaSecoes = {
    composicao: extractSecao(familia?.composicao),
    rotina: extractSecao(familia?.rotina),
    recursos: extractSecao(familia?.recursos),
    dinamica: extractSecao(familia?.dinamica),
  };

  const todasSugestoes = (sugestoes as SugestaoRow[] | null) ?? [];
  const consumidas = new Set<string>();

  const membrosData: MembroData[] = (membros ?? []).map((m) => {
    const p = perfisMembros?.find((x) => x.membro_atipico_id === m.id);
    const extras = (p?.categorias_extras as Record<string, unknown> | null) ?? {};

    // Resolve cada domínio: chave principal e, se vazia, o campo legado.
    const dominios = {} as Record<DominioKey, Secao>;
    const sugestoesPorDominio: Partial<Record<DominioKey, DominioSugestao>> = {};
    let preenchidos = 0;

    for (const d of DOMINIOS) {
      const principal =
        d.storage === "toplevel"
          ? extractSecao((p as Record<string, unknown> | undefined)?.[d.key])
          : extractSecao(extras[d.key]);
      const secao =
        principal.texto.trim().length > 0 || !d.legacyFallback
          ? principal
          : extractSecao((p as Record<string, unknown> | undefined)?.[d.legacyFallback]);
      dominios[d.key] = secao;
      if (secao.texto.trim().length > 10) preenchidos++;

      // Sugestão pendente desse domínio (casa pela chave nova ou legada).
      const sug = todasSugestoes.find(
        (s) =>
          s.camada === "camada1" &&
          s.membro_atipico_id === m.id &&
          !consumidas.has(s.id) &&
          (s.campo === d.key || s.campo === d.legacyFallback),
      );
      if (sug) {
        consumidas.add(sug.id);
        sugestoesPorDominio[d.key] = { id: sug.id, texto_sugerido: sug.texto_sugerido };
      }
    }

    return {
      id: m.id as string,
      nome: m.nome as string,
      idade: idadeAnos(m.data_nascimento as string | null),
      perfil: m.perfil as string,
      diasAcompanhada: diasDesde(m.created_at as string | null),
      hiperfocos: lerHiperfocos(extras),
      completude: Math.round((preenchidos / DOMINIOS.length) * 100),
      dominios,
      sugestoes: sugestoesPorDominio,
    };
  });

  // No topo, só o que não aparece dentro de um card (família + campos sem card).
  const sugestoesRestantes = todasSugestoes.filter((s) => !consumidas.has(s.id));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <Users aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Retrato vivo</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Quem é essa família,{" "}
            <em className="not-italic text-brand-purple">hoje</em>.
          </h1>
        </div>
      </header>

      <ComoUsar
        oQueFazer="Toque em cada área pra contar o que se sabe sobre a criança. Os filtros mostram o que já está vivo, o que vale entender e o que ainda falta começar."
        porQue="É a memória viva que a Ayla usa pra personalizar tudo — quanto mais completa, melhores as histórias, brincadeiras e respostas."
      />

      <KoloVivoWrapper
        familyId={familyId}
        familia={familiaSecoes}
        membros={membrosData}
        sugestoes={sugestoesRestantes}
      />
    </div>
  );
}

/**
 * Os campos jsonb são gravados como { texto: string, atualizado_em?: ISO }.
 * Onboarding antigo pode ter gravado apenas { texto } — `atualizado_em`
 * fica null nesses casos e o microtexto temporal não aparece.
 */
function extractSecao(json: unknown): Secao {
  if (!json || typeof json !== "object") return { texto: "", atualizadoEm: null };
  const obj = json as Record<string, unknown>;
  const texto = typeof obj.texto === "string" ? obj.texto : "";
  const atualizadoEm =
    typeof obj.atualizado_em === "string" ? obj.atualizado_em : null;
  return { texto, atualizadoEm };
}

/** Hiperfocos pro hero: temas favoritos (Gostos & Preferências), até 3. */
function lerHiperfocos(extras: Record<string, unknown>): string[] {
  const pref = (extras.preferencias as { temas?: unknown } | undefined) ?? {};
  const temas = Array.isArray(pref.temas)
    ? pref.temas.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  return temas.slice(0, 3);
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
