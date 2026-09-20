import { z } from "zod";
const concept = z.object({
  title: z.string(),
  interpretation: z.string(),
  mechanism: z.string(),
  strategy: z.string(),
  composition: z.string(),
  prompt: z.string(),
  source: z.enum(["local", "ai"]),
});
export const draftSchema = z.object({
  input: z.string().max(2000),
  mode: z.enum(["Explore", "Refine", "Series", "Material"]),
  direction: z.string().max(4000),
  constraints: z
    .array(z.string())
    .max(20)
    .default(["Preserve composition", "Preserve subject"]),
  count: z.number().int().min(2).max(4),
  concepts: z.array(concept).max(4),
  reference: z.object({ id: z.string().uuid(), name: z.string() }).optional(),
});
export function readDraft() {
  try {
    return draftSchema.parse(
      JSON.parse(localStorage.getItem("jmsn-studio-draft") || "null"),
    );
  } catch {
    return undefined;
  }
}
export function saveDraft(draft: z.infer<typeof draftSchema>) {
  try {
    localStorage.setItem("jmsn-studio-draft", JSON.stringify(draft));
  } catch {
    /* A full/blocked browser store must not prevent prompt editing. */
  }
}
