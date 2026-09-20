import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.resolve(root, "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true } as any);
const { app, store } = createApp({
  dataDir: path.resolve(process.env.STUDIO_DATA_DIR || path.join(root, "data")),
  rulesPath: path.join(root, "art-circle-rules.json"),
  key: process.env.OPENAI_API_KEY || "",
  imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst",
  textModel: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
  websitePath: process.env.JMSN_ART_PATH || siteRoot,
});
// Only the reviewed static website is served. Source, env, SQLite, and local archives are never static routes.
app.use((req, res, next) => {
  if (
    decodeURIComponent(req.path).toLowerCase().startsWith("/_studio") ||
    decodeURIComponent(req.path).toLowerCase().startsWith("/.")
  )
    return res.sendStatus(404);
  if (req.path.startsWith("/studio"))
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
});
if (process.argv.includes("--production")) {
  app.use("/studio", express.static(path.join(root, "dist")));
  app.get("/studio/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "mpa",
  });
  app.use(vite.middlewares);
}
app.use(express.static(siteRoot));
const port = Number(process.env.PORT || 4317);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`JMSN Art Circle Studio → http://127.0.0.1:${port}/studio/`),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
function stop() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
