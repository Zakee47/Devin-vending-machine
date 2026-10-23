"use client";

import { useState, type ReactNode } from "react";
import { Plus, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";

export type OptionalSetting = {
  key: string;
  // id of the setting's main control, for the panel label.
  id: string;
  title: string;
  // Button text while the setting is collapsed, e.g. "Set contact email".
  addLabel: string;
  icon: LucideIcon;
  // A setting with a value stays expanded until it is cleared.
  set: boolean;
  onClear: () => void;
  clearLabel?: string;
  // `focus` is true when the admin just expanded the setting.
  render: (focus: boolean) => ReactNode;
};

// Optional form settings stay out of the way until needed: each shows as a
// small "+ Add …" button, and expands into a panel once clicked or when it
// already has a value.
export function OptionalSettings({
  settings,
  className,
}: {
  settings: OptionalSetting[];
  className?: string;
}) {
  const [opened, setOpened] = useState<string[]>([]);
  const expanded = settings.filter(
    (s) => s.set || opened.includes(s.key)
  );
  const collapsed = settings.filter((s) => !expanded.includes(s));

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {expanded.map((s) => (
        <Field key={s.key} className="rounded-lg border p-4">
          <div className="flex min-h-6 items-center justify-between gap-3">
            <FieldLabel htmlFor={s.id}>{s.title}</FieldLabel>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => {
                s.onClear();
                setOpened((prev) => prev.filter((k) => k !== s.key));
              }}
            >
              <X data-icon="inline-start" />
              {s.clearLabel ?? "Remove"}
            </Button>
          </div>
          {s.render(opened.includes(s.key))}
        </Field>
      ))}
      {collapsed.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {collapsed.map((s) => {
            const Icon = s.icon;
            return (
              <Button
                key={s.key}
                type="button"
                variant="outline"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setOpened((prev) => [...prev, s.key])}
              >
                <Plus data-icon="inline-start" />
                <Icon data-icon="inline-start" />
                {s.addLabel}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
