"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Pencil } from "lucide-react";

/**
 * Editor de uma seção do Kolo Vivo.
 *
 * Modo: leitura → "Editar" abre textarea → "Salvar" persiste via server action.
 */
export function SectionEditor({
  title,
  description,
  initialValue,
  placeholder,
  onSave,
}: {
  title: string;
  description?: string;
  initialValue: string;
  placeholder?: string;
  onSave: (texto: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await onSave(value);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  function handleCancel() {
    setValue(initialValue);
    setEditing(false);
    setError(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {!editing && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" /> Editar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              rows={5}
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
                <Check aria-hidden="true" /> {pending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        ) : value.trim().length > 0 ? (
          <p className="whitespace-pre-wrap text-sm">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {placeholder ?? "Ainda não preenchido."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
