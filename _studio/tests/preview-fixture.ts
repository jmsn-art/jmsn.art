/** Manual browser QA only. Never calls OpenAI; keeps fixtures in an isolated temp directory. */
import { createServer } from "node:http";
import { mkdtempSync, copyFileSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { localConcepts } from "../server/concepts.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(path.join(os.tmpdir(), "jmsn-browser-fixture-"));
copyFileSync(
  path.join(root, "art-circle-rules.json"),
  path.join(temp, "rules.json"),
);
const rules = JSON.parse(readFileSync(path.join(temp, "rules.json"), "utf8"));
let n = 0;
const mock = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  res.setHeader("Content-Type", "application/json");
  if (req.url?.includes("images")) {
    n++;
    const bytes = await sharp(
      Buffer.from(
        `<svg width="768" height="768" xmlns="http://www.w3.org/2000/svg"><rect width="768" height="768" fill="${n % 2 ? "#b3a795" : "#83907d"}"/><text x="60" y="350" fill="#292e26" font-family="Arial" font-size="34">API TEST FIXTURE ${n}</text><text x="60" y="400" fill="#292e26" font-family="Arial" font-size="18">No artwork was generated.</text></svg>`,
      ),
    )
      .png()
      .toBuffer();
    res.end(
      JSON.stringify({
        data: [{ b64_json: bytes.toString("base64") }],
        usage: { test_fixture: true },
      }),
    );
  } else {
    const body = JSON.parse(raw);
    const input = JSON.parse(body.input[0].content[0].text);
    const result =
      body.text.format.name === "art_circle_concepts"
        ? {
            concepts: localConcepts(
              input.input,
              input.requestedConcepts,
              input.direction,
              rules,
            ).map((c) => ({ ...c, title: `TEST FIXTURE — ${c.strategy}` })),
          }
        : {
            verdict: "revise",
            summary:
              "QA fixture only. This is not generated artwork or a real AI critique.",
            failures: ["Fixture image"],
            nextStep: "Configure a real API key for artwork.",
          };
    res.end(
      JSON.stringify({
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(result) }] },
        ],
      }),
    );
  }
});
await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
const port = (mock.address() as any).port;
const { app, store } = createApp({
  dataDir: path.join(temp, "data"),
  rulesPath: path.join(temp, "rules.json"),
  key: "test-fixture-only",
  imageModel: "TEST-FIXTURE-NO-BILLING",
  textModel: "TEST-FIXTURE-NO-BILLING",
  apiBaseUrl: `http://127.0.0.1:${port}/v1`,
});
app.use("/studio", express.static(path.join(root, "dist")));
app.get("/studio/{*path}", (_req, res) =>
  res.sendFile(path.join(root, "dist/index.html")),
);
const server = app.listen(4318, "127.0.0.1", () =>
  console.log(
    "Isolated mock preview: http://127.0.0.1:4318/studio/ — no real API calls.",
  ),
);
const stop = () => {
  server.closeAllConnections();
  mock.closeAllConnections();
  server.close();
  mock.close();
  store.close();
  rmSync(temp, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
