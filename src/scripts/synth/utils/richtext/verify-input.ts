import type { FieldType } from "#ir/field-type.ts";

import { htmlToPortableText } from "#generate/deliverable/shared/html-to-portable-text.ts";

export interface ResolveRichTextOpts {
  resolveImgSrc: (url: string) => string | undefined;
}

export function resolveRichTextRecord(
  fields: { name: string; type: FieldType }[],
  record: Record<string, unknown>,
  opts: ResolveRichTextOpts,
): Record<string, unknown> {
  const richTextNames = fields.filter((field) => field.type.type === "richText").map((field) => field.name);
  if (richTextNames.length === 0) return record;
  const out: Record<string, unknown> = { ...record };
  for (const name of richTextNames) {
    const value = record[name];
    if (typeof value === "string") out[name] = htmlToPortableText(value, { resolveImage: opts.resolveImgSrc });
  }
  return out;
}
