"use client";

import { Field, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ContactEmailField({
  id,
  value,
  onChange,
  autoFocus,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <Field className={className}>
      <Input
        id={id}
        type="email"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="organizers@example.com"
      />
      <FieldDescription>
        Attendees see a &ldquo;Get in touch&rdquo; button on the claim page
        that opens their email app or copies this address.
      </FieldDescription>
    </Field>
  );
}
