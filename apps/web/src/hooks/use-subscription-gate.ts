"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | null;

export type SubscriptionGate = {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  canWrite: boolean;
  canReadHistory: boolean;
  showReactivateBanner: boolean;
  loading: boolean;
};

/**
 * Hook que materializa as regras de bloqueio do PRD §5.3 / §5.4.
 *
 * - trialing/active/past_due: tudo liberado.
 * - paused: leitura sim, escrita não. Banner de reativação.
 * - canceled: leitura sim, escrita não. Ayla desligada (decisão server-side).
 * - sem assinatura: tudo bloqueado (cadastro novo deveria ter criado trialing).
 */
export function useSubscriptionGate(): SubscriptionGate {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus(null);
      setTrialEndsAt(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("subscription_accesses")
        .select("status, trial_ends_at")
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setStatus(null);
        setTrialEndsAt(null);
      } else {
        setStatus(data.status as SubscriptionStatus);
        setTrialEndsAt(data.trial_ends_at);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const liberada = status === "trialing" || status === "active" || status === "past_due";
  const bloqueada = status === "paused" || status === "canceled";

  return {
    status,
    trialEndsAt,
    canWrite: liberada,
    canReadHistory: liberada || bloqueada,
    showReactivateBanner: status === "paused" || status === "past_due",
    loading,
  };
}
