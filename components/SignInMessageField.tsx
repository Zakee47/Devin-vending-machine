"use client";

import type { AttendeeIdentity } from "@/lib/attendee-identity";
import { SignInHint } from "@/components/SignInHint";
import { Field, FieldDescription } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function SignInMessageField({
  id,
  value,
  onChange,
  identity,
  autoFocus,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  identity: AttendeeIdentity;
  autoFocus?: boolean;
  className?: string;
}) {
  const custom = value.trim();
  return (
    <Field className={className}>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="resize-y"
        autoFocus={autoFocus}
        placeholder={
          identity === "x"
            ? "Sign in with the X account you RSVP’d with."
            : "Sign in with the email you RSVP’d with."
        }
      />
      <FieldDescription>
        Replaces the default message above the claim page&apos;s sign-in
        button. Markdown works.
      </FieldDescription>
      {custom ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Preview</p>
          <div className="pointer-events-none select-none">
            <SignInHint identity={identity} message={custom} />
          </div>
        </div>
      ) : null}
    </Field>
  );
}
