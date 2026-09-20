import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { zipSync, strToU8 } from "fflate";
import { z } from "zod";
import { Store, readRules, writeRules, atomicWrite, slug } from "./store.js";
import { OpenAIClient } from "./openai.js";
import {
  examples,
  materials,
  localConcepts,
  normalizeConceptFields,
  rulesText,
} from "./concepts.js";
import type { Artwork, Concept, Job } from "../src/types.js";

const rulesSchema = z
  .object({
    principle: z.string().min(20).max(3000),
    rules: z.array(z.string().min(3).max(2000)).min(1).max(40),
  })
  .strict();
const conceptSchema = z.object({
  title: z.string().min(1).max(200),
  interpretation: z.string().min(1).max(8000),
  mechanism: z.string().min(1).max(8000),
  strategy: z.string().min(1).max(200),
  composition: z.string().min(1).max(2000),
  prompt: z.string().min(10).max(16000),
  source: z.enum(["local", "ai"]),
});
const renderConceptSchema = z.preprocess(
  (value) =>
    value && typeof value === "object"
      ? normalizeConceptFields(value as Record<string, unknown>)
      : value,
  conceptSchema,
);
const settingsSchema = z.object({
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]),
  quality: z.enum(["low", "medium", "high"]),
});
const contextSchema = z.object({
  input: z.string().trim().min(1).max(2000),
  mode: z.enum(["Explore", "Refine", "Series", "Material"]),
  direction: z.string().max(4000).default(""),
  constraints: z.array(z.string().max(300)).max(20).default([]),
  parentId: z.number().int().positive().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
});
export interface AppOptions {
  dataDir: string;
  rulesPath: string;
  key: string;
  imageModel: string;
  textModel: string;
  apiBaseUrl?: string;
  websitePath?: string;
}
export function createApp(options: AppOptions) {
  const app = express();
  const store = new Store(options.dataDir);
  const ai = new OpenAIClient({
    key: options.key,
    imageModel: options.imageModel,
    textModel: options.textModel,
    baseUrl: options.apiBaseUrl,
  });
  let activeJob: string | undefined;
  app.disable("x-powered-by");
  // Loopback binding plus Host/Origin checks prevent browser-origin requests and DNS rebinding.
  app.use((req, res, next) => {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(req.hostname))
      return res
        .status(403)
        .json({ error: "This studio only accepts localhost requests." });
    const origin = req.get("origin");
    if (origin && origin !== `${req.protocol}://${req.get("host")}`)
      return res
        .status(403)
        .json({ error: "Cross-origin access is disabled." });
    if (req.get("sec-fetch-site") === "cross-site")
      return res.status(403).json({ error: "Cross-site access is disabled." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "250kb" }));
  const getRules = () => rulesSchema.parse(readRules(options.rulesPath));
  const artwork = (raw: string) => {
    const id = z.coerce.number().int().positive().parse(raw);
    const result = store.getArtwork(id);
    if (!result)
      throw Object.assign(new Error("Artwork not found."), { status: 404 });
    return result;
  };
  const imageBytes = (art: Artwork) =>
    readFileSync(path.join(options.dataDir, "images", art.filename));
  const referenceBytes = (context: {
    referenceId?: string | null;
    parentId?: number | null;
  }) => {
    if (context.referenceId) {
      if (!store.referenceExists(context.referenceId))
        throw Object.assign(
          new Error("Reference not found. Upload it again."),
          { status: 404 },
        );
      return readFileSync(
        path.join(options.dataDir, "references", `${context.referenceId}.png`),
      );
    }
    return context.parentId
      ? imageBytes(artwork(String(context.parentId)))
      : undefined;
  };
  app.get("/api/config", (_req, res) =>
    res.json({
      hasKey: !!options.key,
      imageModel: options.imageModel,
      textModel: options.textModel,
      dataDir: options.dataDir,
      rules: getRules(),
      examples,
      materials,
    }),
  );
  app.get("/api/rules", (_req, res) => res.json(getRules()));
  app.put("/api/rules", (req, res) => {
    const rules = rulesSchema.parse(req.body);
    writeRules(options.rulesPath, rules);
    res.json(rules);
  });
  app.get("/api/artworks", (_req, res) => res.json(store.artworks()));
  app.get("/api/artworks/:id", (req, res) => res.json(artwork(req.params.id)));
  app.patch("/api/artworks/:id", (req, res) => {
    const art = artwork(req.params.id);
    const patch = z
      .object({
        favorite: z.boolean().optional(),
        rejected: z.boolean().optional(),
        tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
      })
      .strict()
      .parse(req.body);
    res.json(store.patchArtwork(art.id, patch));
  });
  app.get("/api/artworks/:id/image", (req, res) =>
    res.type("png").send(imageBytes(artwork(req.params.id))),
  );
  app.get("/api/artworks/:id/thumbnail", (req, res) =>
    res
      .type("webp")
      .sendFile(
        path.join(
          options.dataDir,
          "thumbnails",
          artwork(req.params.id).filename.replace(/\.png$/, ".webp"),
        ),
      ),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  });
  app.post("/api/references", upload.single("image"), async (req, res) => {
    if (!req.file)
      return res
        .status(400)
        .json({ error: "Choose a PNG, JPEG, or WebP image." });
    const decoder = sharp(req.file.buffer, { limitInputPixels: 40_000_000 });
    const metadata = await decoder.metadata().catch(() => {
      throw Object.assign(
        new Error("This file is not a readable PNG, JPEG, or WebP image."),
        { status: 400 },
      );
    });
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? ""))
      return res
        .status(400)
        .json({ error: "Only PNG, JPEG, and WebP images are supported." });
    const bytes = await decoder
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    const id = randomUUID();
    atomicWrite(path.join(options.dataDir, "references", `${id}.png`), bytes);
    store.addReference(id, req.file.originalname.slice(0, 200));
    res.json({
      id,
      name: req.file.originalname.slice(0, 200),
      url: `/api/references/${id}`,
    });
  });
  app.get("/api/references/:id", (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    if (!store.referenceExists(id))
      return res.status(404).json({ error: "Reference not found." });
    res
      .type("png")
      .sendFile(path.join(options.dataDir, "references", `${id}.png`));
  });
  app.post("/api/plan", async (req, res) => {
    const body = contextSchema
      .extend({
        count: z.number().int().min(1).max(4).default(1),
        useAI: z.boolean().default(true),
      })
      .parse(req.body);
    if (body.mode !== "Series" && body.count !== 1)
      return res
        .status(400)
        .json({ error: "Use Series for multiple interpretations." });
    const reference = body.mode === "Refine" ? referenceBytes(body) : undefined;
    if (body.mode === "Refine" && !reference)
      return res
        .status(400)
        .json({
          error: "Choose an archived image or upload a reference to refine.",
        });
    const rules = getRules();
    const parent = body.parentId ? artwork(String(body.parentId)) : undefined;
    const context = {
      ...body,
      previousConcept: parent?.concept,
      previousCritique: parent?.critique,
    };
    const concepts =
      options.key && body.useAI
        ? await ai.plan(context, body.count, rules, reference)
        : localConcepts(
            body.input,
            body.count,
            [body.direction, ...body.constraints].filter(Boolean).join("; "),
            rules,
          );
    res.json({
      concepts,
      warning:
        concepts[0].source === "local"
          ? "Local concept sketch. No AI analysis or image inspection was performed."
          : null,
    });
  });
  app.get("/api/jobs", (_req, res) => res.json(store.jobs()));
  app.get("/api/jobs/:id", (req, res) => {
    const job = store.getJob(req.params.id);
    res.status(job ? 200 : 404).json(job ?? { error: "Job not found." });
  });
  app.post("/api/generate", (req, res) => {
    const body = contextSchema
      .extend({
        concepts: z.array(renderConceptSchema).min(1).max(4),
        settings: settingsSchema,
      })
      .parse(req.body);
    if (!options.key)
      return res
        .status(503)
        .json({
          error:
            "Add OPENAI_API_KEY to .env.local and restart the studio. Your local archive and prompt tools work without a key.",
        });
    if (activeJob)
      return res
        .status(409)
        .json({
          error:
            "A generation is already running. Wait for it to finish before starting another.",
        });
    if (body.mode !== "Series" && body.concepts.length !== 1)
      return res.status(400).json({ error: "Use Series for a batch." });
    const reference = body.mode === "Refine" ? referenceBytes(body) : undefined;
    if (body.mode === "Refine" && !reference)
      return res
        .status(400)
        .json({ error: "An image is required for Refine." });
    if (body.parentId) artwork(String(body.parentId));
    const rules = getRules(); // Immutable snapshot for this batch and its metadata.
    const job: Job = {
      id: randomUUID(),
      status: "queued",
      total: body.concepts.length,
      completed: 0,
      stage: "Queued",
      imageIds: [],
      createdAt: new Date().toISOString(),
    };
    activeJob = job.id;
    store.saveJob(job);
    res.status(202).json(job);
    void (async () => {
      try {
        for (const [index, concept] of body.concepts.entries()) {
          Object.assign(job, {
            status: "running",
            stage: `Rendering ${index + 1} of ${job.total}`,
          });
          store.saveJob(job);
          const prompt = `${concept.prompt}\n\nPermanent Art Circle rules:\n${rulesText(rules)}${body.mode === "Refine" ? `\nEdit the supplied image. ${body.constraints.join(". ")}. ${body.direction}` : ""}`;
          const result = await ai.generate(prompt, body.settings, reference);
          const bytes = await sharp(result.bytes, {
            limitInputPixels: 40_000_000,
          })
            .png()
            .toBuffer();
          const filename = `${new Date().toISOString().slice(0, 10)}_${slug(concept.title)}_${String(store.nextSequence()).padStart(3, "0")}.png`;
          atomicWrite(path.join(options.dataDir, "images", filename), bytes);
          atomicWrite(
            path.join(
              options.dataDir,
              "thumbnails",
              filename.replace(/\.png$/, ".webp"),
            ),
            await sharp(bytes)
              .resize({ width: 640, height: 640, fit: "inside" })
              .webp({ quality: 80 })
              .toBuffer(),
          );
          const art = store.saveArtwork({
            filename,
            createdAt: new Date().toISOString(),
            input: body.input,
            concept,
            prompt,
            model: options.imageModel,
            settings: body.settings,
            parentId: body.parentId ?? null,
            referenceId:
              body.mode === "Refine" ? (body.referenceId ?? null) : null,
            critique: {
              status: "pending",
              verdict: "uncertain",
              summary: "Image saved. Visual critique is in progress.",
              failures: [],
              nextStep: "",
            },
            tags: [concept.strategy],
            favorite: false,
            rejected: false,
            seriesId: body.mode === "Series" ? job.id : null,
            usage: result.usage,
            rules,
          });
          job.imageIds.push(art.id);
          job.completed++;
          job.stage = `Critiquing ${index + 1} of ${job.total}`;
          store.saveJob(job);
          try {
            const critique = await ai.critique(
              await sharp(bytes)
                .resize({ width: 1200, height: 1200, fit: "inside" })
                .png()
                .toBuffer(),
              concept,
              rules,
            );
            store.patchArtwork(art.id, { critique });
          } catch (error) {
            store.patchArtwork(art.id, {
              critique: {
                status: "unavailable",
                verdict: "uncertain",
                summary: `Image saved, but critique failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                failures: [],
                nextStep:
                  "Review the image yourself or retry critique from its inspector.",
              },
            });
          }
        }
        job.status = "complete";
        job.stage = "Saved to archive";
      } catch (error) {
        job.status = "failed";
        job.stage = "Stopped";
        job.error = `${error instanceof Error ? error.message : "Generation failed."} ${job.completed ? `${job.completed} completed image(s) are saved in your archive.` : ""}`;
      } finally {
        store.saveJob(job);
        activeJob = undefined;
      }
    })();
  });
  app.post("/api/artworks/:id/critique", async (req, res) => {
    if (!options.key)
      return res
        .status(503)
        .json({ error: "Configure OPENAI_API_KEY to run visual critique." });
    const art = artwork(req.params.id);
    const critique = await ai.critique(
      await sharp(imageBytes(art))
        .resize({ width: 1200, height: 1200, fit: "inside" })
        .png()
        .toBuffer(),
      art.concept,
      getRules(),
    );
    res.json(store.patchArtwork(art.id, { critique }));
  });
  const inspectWebsite = async () => {
    const candidates = options.websitePath
      ? [path.resolve(options.websitePath)]
      : [
          path.join(os.homedir(), "Documents/jmsn.art"),
          path.join(os.homedir(), "Documents/GitHub/jmsn.art"),
          path.join(os.homedir(), "Projects/jmsn.art"),
        ];
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      try {
        const run = promisify(execFile);
        const { stdout: root } = await run(
          "git",
          ["-C", candidate, "rev-parse", "--show-toplevel"],
          { timeout: 5000 },
        );
        const { stdout: status } = await run(
          "git",
          ["-C", candidate, "status", "--short", "--branch"],
          { timeout: 5000 },
        );
        return {
          path: root.trim(),
          status: status.trim(),
          found: true,
          message:
            "Read-only inspection. Export downloads a package; it never writes into or publishes this repository.",
        };
      } catch {
        return {
          path: candidate,
          found: false,
          status: "",
          message:
            "Directory found, but Git status could not be verified. Website export is disabled.",
        };
      }
    }
    return {
      found: false,
      path: null,
      status: "",
      message:
        "Set JMSN_ART_PATH in .env.local to enable a downloadable website handoff.",
    };
  };
  app.get("/api/website", async (_req, res) =>
    res.json(await inspectWebsite()),
  );
  app.get("/api/artworks/:id/export", async (req, res) => {
    const art = artwork(req.params.id);
    const format = z
      .enum(["png", "jpeg", "webp", "txt", "json", "zip", "website"])
      .parse(req.query.format ?? "png");
    const stem = art.filename.replace(/\.png$/, "");
    const metadata = JSON.stringify(art, null, 2);
    const bytes = imageBytes(art);
    if (format === "json")
      return res.attachment(`${stem}.json`).type("json").send(metadata);
    if (format === "txt")
      return res.attachment(`${stem}.txt`).type("text/plain").send(art.prompt);
    if (format === "zip" || format === "website") {
      const files: Record<string, Uint8Array> = {
        [art.filename]: bytes,
        [`${stem}.json`]: strToU8(metadata),
        [`${stem}.txt`]: strToU8(art.prompt),
      };
      if (format === "website") {
        const inspection = await inspectWebsite();
        if (!inspection.found)
          return res.status(409).json({ error: inspection.message });
        files["WEBSITE-HANDOFF.md"] = strToU8(
          `# jmsn.art handoff\n\nRepository: ${inspection.path}\n\nGit status at export:\n\n${inspection.status}\n\nManually review and copy these files into your gallery workflow. No repository files were changed, committed, or published by Art Circle Studio.\n`,
        );
      }
      return res
        .attachment(`${stem}${format === "website" ? "-jmsn-art" : ""}.zip`)
        .type("application/zip")
        .send(Buffer.from(zipSync(files, { level: 0 })));
    }
    const output =
      format === "png"
        ? bytes
        : await sharp(bytes)
            .flatten({ background: "#ffffff" })
            .toFormat(format, { quality: 95 })
            .toBuffer();
    return res
      .attachment(`${stem}.${format === "jpeg" ? "jpg" : format}`)
      .type(`image/${format}`)
      .send(output);
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const status =
      error instanceof z.ZodError || error instanceof multer.MulterError
        ? 400
        : (error.status ?? 500);
    const message =
      error instanceof z.ZodError
        ? error.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join("; ")
        : String(error.message ?? "Unexpected error");
    res.status(status).json({ error: message });
  };
  app.use(errorHandler);
  return { app, store };
}
