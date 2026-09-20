import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, get as httpGet, type Server } from "node:http";
import sharp from "sharp";
import { unzipSync } from "fflate";
import { createApp } from "../server/app.js";
import { localConcepts } from "../server/concepts.js";
import { Store } from "../server/store.js";
import type { Artwork, Job } from "../src/types.js";

const rules = JSON.parse(
  readFileSync(new URL("../art-circle-rules.json", import.meta.url), "utf8"),
);
const fixture = await sharp({
  create: { width: 96, height: 96, channels: 3, background: "#827a62" },
})
  .png()
  .toBuffer();
async function listen(server: Server) {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as any).port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
async function harness(
  key = "test-key",
  failAt = 0,
  failCritique = false,
  overlongStrategy = false,
) {
  const root = mkdtempSync(path.join(os.tmpdir(), "jmsn-test-"));
  copyFileSync(
    new URL("../art-circle-rules.json", import.meta.url),
    path.join(root, "rules.json"),
  );
  let imageCalls = 0;
  const captured: { url: string; type: string; body: string }[] = [];
  const mock = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    captured.push({
      url: req.url!,
      type: String(req.headers["content-type"]),
      body,
    });
    res.setHeader("content-type", "application/json");
    if (req.url?.includes("/images/")) {
      imageCalls++;
      if (imageCalls === failAt) {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: { message: "Rate limit fixture" } }));
        return;
      }
      res.end(
        JSON.stringify({
          data: [{ b64_json: fixture.toString("base64") }],
          usage: { input_tokens: 30, output_tokens: 196, total_tokens: 226 },
        }),
      );
    } else {
      const parsed = JSON.parse(body);
      if (parsed.text.format.name === "art_circle_critique") {
        if (failCritique) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({ error: { message: "Critique fixture failure" } }),
          );
          return;
        }
        res.end(
          JSON.stringify({
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      verdict: "revise",
                      summary: "Fixture image has no attempt at closure.",
                      failures: ["No enclosure"],
                      nextStep: "Establish the material’s returning structure.",
                    }),
                  },
                ],
              },
            ],
          }),
        );
      } else {
        const concepts = localConcepts("flowers", 1, "", rules);
        if (overlongStrategy) concepts[0].strategy = "structure ".repeat(30);
        res.end(
          JSON.stringify({
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      concepts,
                    }),
                  },
                ],
              },
            ],
          }),
        );
      }
    }
  });
  const mockUrl = await listen(mock);
  const { app, store } = createApp({
    dataDir: path.join(root, "data"),
    rulesPath: path.join(root, "rules.json"),
    key,
    imageModel: "gpt-image-2.5-sunburst",
    textModel: "gpt-4.1-mini",
    apiBaseUrl: `${mockUrl}/v1`,
  });
  const server = createServer(app);
  const url = await listen(server);
  const request = async (route: string, body?: any, method = "POST") =>
    fetch(url + route, {
      method: body === undefined ? "GET" : method,
      headers:
        body instanceof FormData ? {} : { "Content-Type": "application/json" },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  const wait = async (id: string): Promise<Job> => {
    for (let i = 0; i < 100; i++) {
      const job = (await (await request(`/api/jobs/${id}`)).json()) as Job;
      if (job.status === "complete" || job.status === "failed") return job;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("Job timeout");
  };
  return {
    root,
    url,
    store,
    captured,
    request,
    wait,
    cleanup: async () => {
      await close(server);
      await close(mock);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
const settings = { size: "1024x1024", quality: "low" };
const requestBody = (count = 1) => ({
  input: "Georgia O’Keeffe",
  mode: count > 1 ? "Series" : "Explore",
  concepts: localConcepts("Georgia O’Keeffe", count, "", rules),
  settings,
});

test("local concepts retain the subject, translate artists and diversify series mechanisms and placements", () => {
  const concepts = localConcepts("Georgia O’Keeffe", 4, "More Minimal", rules);
  assert.equal(new Set(concepts.map((x) => x.mechanism)).size, 4);
  assert.equal(new Set(concepts.map((x) => x.composition)).size, 4);
  assert.ok(concepts.every((x) => !/okeeffe|o.keeffe/i.test(x.prompt)));
  assert.ok(concepts.every((x) => x.prompt.includes(rules.principle)));
  assert.match(
    localConcepts("beeswax", 1, "", rules)[0].mechanism,
    /melt opening/,
  );
});

test("AI concepts are normalized to the render schema before they reach the client", async () => {
  const h = await harness("test-key", 0, false, true);
  try {
    const response = await h.request("/api/plan", {
      input: "flowers",
      mode: "Explore",
    });
    assert.equal(response.status, 200);
    const plan = await response.json();
    assert.equal(plan.concepts[0].strategy.length, 200);
    assert.match(plan.concepts[0].strategy, /…$/);
    const generated = await h.request("/api/generate", {
      ...requestBody(),
      concepts: plan.concepts,
    });
    assert.equal(generated.status, 202);
    assert.equal((await h.wait((await generated.json()).id)).status, "complete");
  } finally {
    await h.cleanup();
  }
});

test("no-key mode supports planning and rules, blocks paid rendering, validates uploads and protects localhost", async () => {
  const h = await harness("");
  try {
    const config = await (await h.request("/api/config")).json();
    assert.equal(config.hasKey, false);
    assert.equal(config.key, undefined);
    const plan = await (
      await h.request("/api/plan", {
        input: "abandoned motel",
        mode: "Explore",
      })
    ).json();
    assert.equal(plan.concepts[0].source, "local");
    assert.match(plan.concepts[0].mechanism, /missing bay/);
    assert.equal((await h.request("/api/generate", requestBody())).status, 503);
    assert.equal(
      (await h.request("/api/plan", { input: "", mode: "Explore" })).status,
      400,
    );
    assert.equal(
      (
        await h.request("/api/plan", {
          input: "motel",
          mode: "Explore",
          count: 5,
        })
      ).status,
      400,
    );
    assert.equal(
      (await h.request("/api/plan", { input: "motel", mode: "Refine" })).status,
      400,
    );
    const changed = {
      ...rules,
      principle: rules.principle + " Test persistence.",
    };
    assert.equal((await h.request("/api/rules", changed, "PUT")).status, 200);
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(h.root, "rules.json"), "utf8")),
      changed,
    );
    assert.equal(
      (
        await fetch(h.url + "/api/config", {
          headers: { Origin: "https://example.com" },
        })
      ).status,
      403,
    );
    const hostStatus = await new Promise<number | undefined>((resolve) => {
      httpGet(
        h.url + "/api/config",
        { headers: { Host: "evil.example.com" } },
        (result) => {
          result.resume();
          resolve(result.statusCode);
        },
      );
    });
    assert.equal(hostStatus, 403);
    const form = new FormData();
    form.append(
      "image",
      new Blob(["<svg/>"], { type: "image/svg+xml" }),
      "bad.svg",
    );
    assert.equal((await h.request("/api/references", form)).status, 400);
    assert.equal((await h.request("/api/artworks/999")).status, 404);
    assert.equal((await h.request("/api/artworks/not-an-id")).status, 400);
    assert.equal(h.captured.length, 0);
  } finally {
    await h.cleanup();
  }
});

test("generation, actual image critique, archive flags, all export formats, and persistence after reopening", async () => {
  const h = await harness();
  try {
    const response = await h.request("/api/generate", requestBody());
    assert.equal(response.status, 202);
    const job = await h.wait((await response.json()).id);
    assert.equal(job.status, "complete");
    assert.equal(job.completed, 1);
    const list = (await (await h.request("/api/artworks")).json()) as Artwork[];
    assert.equal(list.length, 1);
    const art = list[0];
    assert.match(
      art.filename,
      /^\d{4}-\d{2}-\d{2}_georgia-okeeffe-vegetation_001\.png$/,
    );
    assert.equal(art.critique.verdict, "revise");
    assert.deepEqual(art.rules, rules);
    const imageCall = h.captured.find((x) =>
      x.url.includes("/images/generations"),
    )!;
    assert.match(
      JSON.parse(imageCall.body).prompt,
      /Permanent Art Circle rules/,
    );
    const critiqueCall = h.captured.find((x) => x.url.includes("/responses"))!;
    assert.match(critiqueCall.body, /input_image/);
    const updated = await (
      await h.request(
        `/api/artworks/${art.id}`,
        { favorite: true, tags: ["botanical", "study"], rejected: true },
        "PATCH",
      )
    ).json();
    assert.equal(updated.favorite, true);
    assert.equal(updated.rejected, true);
    for (const format of ["png", "jpeg", "webp"]) {
      const result = await h.request(
        `/api/artworks/${art.id}/export?format=${format}`,
      );
      assert.equal(result.status, 200);
      const meta = await sharp(
        Buffer.from(await result.arrayBuffer()),
      ).metadata();
      assert.equal(meta.format, format);
    }
    const metadata = await (
      await h.request(`/api/artworks/${art.id}/export?format=json`)
    ).json();
    assert.equal(metadata.favorite, true);
    assert.ok(!JSON.stringify(metadata).includes("test-key"));
    const prompt = await (
      await h.request(`/api/artworks/${art.id}/export?format=txt`)
    ).text();
    assert.equal(prompt, art.prompt);
    const archive = unzipSync(
      new Uint8Array(
        await (
          await h.request(`/api/artworks/${art.id}/export?format=zip`)
        ).arrayBuffer(),
      ),
    );
    assert.equal(Object.keys(archive).length, 3);
    assert.ok(archive[art.filename]);
    assert.equal(
      (await h.request(`/api/artworks/${art.id}/export?format=exe`)).status,
      400,
    );
    const reopened = new Store(path.join(h.root, "data"));
    assert.equal(reopened.artworks()[0].favorite, true);
    assert.deepEqual(reopened.artworks()[0].tags, ["botanical", "study"]);
    reopened.close();
  } finally {
    await h.cleanup();
  }
});

test("reference upload uses image edits multipart, preserves parent and records selected constraints", async () => {
  const h = await harness();
  try {
    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(fixture)], { type: "image/png" }),
      "reference.png",
    );
    const refResponse = await h.request("/api/references", form);
    assert.equal(refResponse.status, 200);
    const reference = await refResponse.json();
    const plan = await (
      await h.request("/api/plan", {
        input: "flower",
        mode: "Refine",
        referenceId: reference.id,
      })
    ).json();
    assert.equal(plan.concepts[0].source, "ai");
    const first = await (
      await h.request("/api/generate", {
        ...requestBody(),
        mode: "Refine",
        referenceId: reference.id,
        constraints: ["Preserve palette", "Move gap"],
      })
    ).json();
    const done = await h.wait(first.id);
    const id = done.imageIds[0];
    const editCall = h.captured.find((x) => x.url.includes("/images/edits"))!;
    assert.match(editCall.type, /multipart\/form-data/);
    assert.match(editCall.body, /name="image\[\]"/);
    assert.match(editCall.body, /Preserve palette/);
    const child = await (
      await h.request("/api/generate", {
        ...requestBody(),
        mode: "Refine",
        parentId: id,
      })
    ).json();
    const childJob = await h.wait(child.id);
    const childArt = await (
      await h.request(`/api/artworks/${childJob.imageIds[0]}`)
    ).json();
    assert.equal(childArt.parentId, id);
  } finally {
    await h.cleanup();
  }
});

test("partial batches keep completed works and never retry a paid failure", async () => {
  const h = await harness("test-key", 2);
  try {
    const start = await (
      await h.request("/api/generate", requestBody(3))
    ).json();
    const duplicate = await h.request("/api/generate", requestBody());
    assert.equal(duplicate.status, 409);
    const job = await h.wait(start.id);
    assert.equal(job.status, "failed");
    assert.equal(job.completed, 1);
    assert.match(job.error!, /Rate limit fixture/);
    assert.equal(h.store.artworks().length, 1);
    assert.equal(
      h.captured.filter((x) => x.url.includes("/images/")).length,
      2,
    );
  } finally {
    await h.cleanup();
  }
});

test("critique failure preserves the image; interrupted jobs are marked for manual review on restart", async () => {
  const h = await harness("test-key", 0, true);
  try {
    const start = await (
      await h.request("/api/generate", requestBody())
    ).json();
    assert.equal((await h.wait(start.id)).status, "complete");
    assert.equal(h.store.artworks()[0].critique.status, "unavailable");
    h.store.saveJob({
      id: "interrupted",
      status: "running",
      total: 2,
      completed: 1,
      stage: "Rendering",
      imageIds: [1],
      createdAt: new Date().toISOString(),
    });
    const reopened = new Store(path.join(h.root, "data"));
    assert.equal(reopened.getJob("interrupted")?.status, "failed");
    assert.match(reopened.getJob("interrupted")?.error ?? "", /restarted/);
    reopened.close();
  } finally {
    await h.cleanup();
  }
});
