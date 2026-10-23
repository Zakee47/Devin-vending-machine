"use client";

import { useState, type ReactNode } from "react";
import { Check, Pencil, Plus, X, type LucideIcon } from "lucide-react";
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
  set: boolean;
  onClear: () => void;
  clearLabel?: string;
  // When given, a saved value is folded into a one-line summary row with an
  // edit button instead of staying expanded.
  summary?: ReactNode;
  // `focus` is true when the admin just expanded the setting.
  render: (focus: boolean) => ReactNode;
};

// Optional form settings stay out of the way until needed: each shows as a
// small "+ Add …" button, and expands into a panel once clicked or when it
// already has a value. Settings with a `summary` collapse again once saved.
export function OptionalSettings({
  settings,
  className,
}: {
  settings: OptionalSetting[];
  className?: string;
}) {
  const [opened, setOpened] = useState<string[]>(() =>
    settings
      .filter((s) => s.set && s.summary === undefined)
      .map((s) => s.key)
  );
  const [focused, setFocused] = useState<string[]>([]);
  // A setting that gains a value elsewhere joins the open set, and stays open
  // while the admin edits it down to empty; only its Remove button closes it.
  const newlySet = settings.filter(
    (s) => s.set && s.summary === undefined && !opened.includes(s.key)
  );
  if (newlySet.length > 0) {
    setOpened([...opened, ...newlySet.map((s) => s.key)]);
  }
  const expanded = settings.filter(
    (s) => opened.includes(s.key) || (s.set && s.summary === undefined)
  );
  const summarized = settings.filter(
    (s) => s.set && !expanded.includes(s)
  );
  const collapsed = settings.filter(
    (s) => !expanded.includes(s) && !summarized.includes(s)
  );

  function close(key: string) {
    setOpened((prev) => prev.filter((k) => k !== key));
    setFocused((prev) => prev.filter((k) => k !== key));
  }
  function open(key: string) {
    setOpened((prev) => [...prev, key]);
    setFocused((prev) => [...prev, key]);
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {expanded.map((s) => (
        <Field key={s.key} className="rounded-lg border p-4">
          <div className="flex min-h-6 items-center justify-between gap-3">
            <FieldLabel htmlFor={s.id}>{s.title}</FieldLabel>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => {
                  s.onClear();
                  close(s.key);
                }}
              >
                <X data-icon="inline-start" />
                {s.clearLabel ?? "Remove"}
              </Button>
              {s.summary !== undefined ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => close(s.key)}
                >
                  <Check data-icon="inline-start" />
                  Done
                </Button>
              ) : null}
            </div>
          </div>
          {s.render(focused.includes(s.key))}
        </Field>
      ))}
      {summarized.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.key}
            className="flex min-h-10 items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{s.title}</span>
              <span className="truncate text-muted-foreground">
                {s.summary}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="shrink-0"
              onClick={() => open(s.key)}
            >
              <Pencil data-icon="inline-start" />
              View / edit
            </Button>
          </div>
        );
      })}
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
                onClick={() => open(s.key)}
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
