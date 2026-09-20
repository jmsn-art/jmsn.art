import type { Concept, Critique, Rules, Settings } from "../src/types.js";
import { plannerInstructions, rulesText } from "./concepts.js";

export interface AIOptions {
  key: string;
  imageModel: string;
  textModel: string;
  baseUrl?: string;
}
export class OpenAIClient {
  constructor(private options: AIOptions) {}
  private async request(
    endpoint: string,
    body: object | FormData,
    timeout = 240_000,
  ) {
    const multipart = body instanceof FormData;
    const response = await fetch(
      `${this.options.baseUrl ?? "https://api.openai.com/v1"}/${endpoint}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.key}`,
          ...(!multipart ? { "Content-Type": "application/json" } : {}),
        },
        body: multipart ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      },
    );
    const data = (await response.json()) as any;
    if (!response.ok) {
      // No automatic retry of paid calls: an uncertain response may already be billed.
      throw new Error(
        `OpenAI ${response.status}: ${String(
          data.error?.message ?? "Request failed",
        )
          .replaceAll(this.options.key, "[redacted]")
          .slice(0, 600)}`,
      );
    }
    return data;
  }
  private async structured(
    name: string,
    schema: object,
    instructions: string,
    content: any[],
  ) {
    const data = await this.request(
      "responses",
      {
        model: this.options.textModel,
        store: false,
        instructions,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name, strict: true, schema } },
      },
      90_000,
    );
    const output = data.output
      ?.flatMap((x: any) => x.content ?? [])
      .find((x: any) => x.type === "output_text")?.text;
    if (!output)
      throw new Error(
        "The concept model returned no usable text. Try another subject or check model access.",
      );
    return JSON.parse(output);
  }
  async plan(
    input: object,
    count: number,
    rules: Rules,
    reference?: Buffer,
  ): Promise<Concept[]> {
    const properties = Object.fromEntries(
      [
        "title",
        "interpretation",
        "mechanism",
        "strategy",
        "composition",
        "prompt",
      ].map((k) => [k, { type: "string" }]),
    );
    const content: any[] = [
      {
        type: "input_text",
        text: JSON.stringify({ ...input, requestedConcepts: count }),
      },
    ];
    if (reference)
      content.push({
        type: "input_image",
        image_url: `data:image/png;base64,${reference.toString("base64")}`,
        detail: "low",
      });
    const result = await this.structured(
      "art_circle_concepts",
      {
        type: "object",
        properties: {
          concepts: {
            type: "array",
            items: {
              type: "object",
              properties,
              required: Object.keys(properties),
              additionalProperties: false,
            },
          },
        },
        required: ["concepts"],
        additionalProperties: false,
      },
      `${plannerInstructions}\n${rulesText(rules)}`,
      content,
    );
    if (!Array.isArray(result.concepts) || result.concepts.length !== count)
      throw new Error(
        "The planner returned an incomplete series. Develop the ideas again.",
      );
    return result.concepts.map((x: any) => {
      for (const key of Object.keys(properties))
        if (
          typeof x[key] !== "string" ||
          !x[key].trim() ||
          x[key].length > 16000
        )
          throw new Error("Invalid concept returned by the planner.");
      return { ...x, source: "ai" };
    });
  }
  async generate(prompt: string, settings: Settings, reference?: Buffer) {
    let body: object | FormData;
    const values = {
      model: this.options.imageModel,
      prompt,
      size: settings.size,
      quality: settings.quality,
      n: "1",
      output_format: "png",
    };
    if (reference) {
      const form = new FormData();
      for (const [key, value] of Object.entries(values))
        form.append(key, value);
      form.append(
        "image[]",
        new Blob([new Uint8Array(reference)], { type: "image/png" }),
        "reference.png",
      );
      body = form;
    } else body = { ...values, n: 1 };
    const result = await this.request(
      reference ? "images/edits" : "images/generations",
      body,
    );
    if (!result.data?.[0]?.b64_json)
      throw new Error(
        "OpenAI returned no image. No archive entry was created.",
      );
    return {
      bytes: Buffer.from(result.data[0].b64_json, "base64"),
      usage: result.usage ?? null,
    };
  }
  async critique(
    image: Buffer,
    concept: Concept,
    rules: Rules,
  ): Promise<Critique> {
    const result = await this.structured(
      "art_circle_critique",
      {
        type: "object",
        properties: {
          verdict: { type: "string", enum: ["pass", "revise", "uncertain"] },
          summary: { type: "string" },
          failures: { type: "array", items: { type: "string" } },
          nextStep: { type: "string" },
        },
        required: ["verdict", "summary", "failures", "nextStep"],
        additionalProperties: false,
      },
      `Inspect the ACTUAL image, not just the intended prompt. Apply these rules: ${rulesText(rules)}. Check: imposed generic ring, multiple gaps, closed circle, solid disk, repetitive centered C, cliché artist quotations, unnecessary text, and style overwhelming concept. Describe visual evidence. Count interruptions if discernible. Admit uncertainty. Give one actionable correction preserving the core idea.`,
      [
        { type: "input_text", text: JSON.stringify(concept) },
        {
          type: "input_image",
          image_url: `data:image/png;base64,${image.toString("base64")}`,
          detail: "high",
        },
      ],
    );
    return { status: "reviewed", ...result };
  }
}
