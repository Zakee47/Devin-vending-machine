"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ContactEmailField({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>Contact email</FieldLabel>
      <Input
        id={id}
        type="email"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="organizers@example.com"
      />
      <FieldDescription>
        Optional. When set, attendees see a &ldquo;Get in touch&rdquo; button
        on the claim page that opens their email app or copies this address.
      </FieldDescription>
    </Field>
  );
}
