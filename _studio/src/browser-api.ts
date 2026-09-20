/** Static jmsn.art mode: no remote API requests, keys, or filesystem assumptions. */
import { z } from "zod";
import defaultRules from "../art-circle-rules.json";
import { examples, materials, localConcepts } from "../server/concepts";
import type { Config, Rules } from "./types";

const rulesSchema = z.object({
  principle: z.string().min(20).max(3000),
  rules: z.array(z.string().min(3).max(2000)).min(1).max(40),
});
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("jmsn-art-circle-studio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("studio");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. Enable site storage to save studio rules and references.",
        ),
      );
  }));
}
async function read<T>(key: string): Promise<T | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("studio", "readonly")
      .objectStore("studio")
      .get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(key: string, value: unknown) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("studio", "readwrite");
    tx.objectStore("studio").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function currentRules(): Promise<Rules> {
  return (await read<Rules>("rules")) ?? defaultRules;
}
export async function restoreBrowserReference(id: string) {
  const record = await read<{ id: string; name: string; image: Blob }>(
    `reference:${id}`,
  );
  return record
    ? {
        id: record.id,
        name: record.name,
        url: URL.createObjectURL(record.image),
      }
    : undefined;
}
export async function browserApi<T>(
  url: string,
  body?: any,
  method?: string,
): Promise<T> {
  if (url === "/api/config")
    return {
      hasKey: false,
      imageModel: "gpt-image-2.5-sunburst",
      textModel: "gpt-4.1-mini",
      dataDir: "This browser · IndexedDB (not the published gallery)",
      storage: "browser",
      rules: await currentRules(),
      examples,
      materials,
    } satisfies Config as T;
  if (url === "/api/rules") {
    if (method === "PUT") {
      const rules = rulesSchema.parse(body);
      await write("rules", rules);
      return rules as T;
    }
    return (await currentRules()) as T;
  }
  if (url === "/api/artworks" || url === "/api/jobs") return [] as T;
  if (url === "/api/references") {
    const file = (body as FormData).get("image");
    if (
      !(file instanceof File) ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      throw new Error("Choose a PNG, JPEG, or WebP reference.");
    if (file.size > 20 * 1024 * 1024)
      throw new Error("Reference images must be 20 MB or smaller.");
    const bitmap = await createImageBitmap(file).catch(() => {
      throw new Error(
        "This image could not be decoded. Choose a different reference.",
      );
    });
    if (bitmap.width * bitmap.height > 40_000_000) {
      bitmap.close();
      throw new Error("Reference images must be smaller than 40 megapixels.");
    }
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const image = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Unable to save this reference.")),
        "image/png",
      ),
    );
    const id = crypto.randomUUID();
    const name = file.name.slice(0, 200);
    await write(`reference:${id}`, { id, name, image });
    return { id, name, url: URL.createObjectURL(image) } as T;
  }
  if (url === "/api/plan") {
    const input = z.string().trim().min(1).max(2000).parse(body.input);
    const count = z
      .number()
      .int()
      .min(1)
      .max(4)
      .parse(body.count ?? 1);
    if (body.mode !== "Series" && count !== 1)
      throw new Error("Use Series for multiple interpretations.");
    if (
      body.mode === "Refine" &&
      (!body.referenceId || !(await read(`reference:${body.referenceId}`)))
    )
      throw new Error("Upload a reference or choose a gallery artwork first.");
    return {
      concepts: localConcepts(
        input,
        count,
        [body.direction, ...(body.constraints ?? [])]
          .filter(Boolean)
          .join("; "),
        await currentRules(),
      ),
      warning:
        body.mode === "Refine"
          ? "Local concept sketch. Your reference is saved, but no AI image analysis has run."
          : "Local concept sketch. No API requests were made.",
    } as T;
  }
  throw new Error(
    "Image generation and the generated-image archive run in the local studio. API setup can wait; you can develop and copy prompts here now.",
  );
}
