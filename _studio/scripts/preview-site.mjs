// Static-only preview: deliberately no /api routes or local backend.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const app = express();
app.use((req, res, next) => {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(req.hostname))
    return res.sendStatus(403);
  if (
    decodeURIComponent(req.path).toLowerCase().startsWith("/_studio") ||
    decodeURIComponent(req.path).toLowerCase().startsWith("/.")
  )
    return res.sendStatus(404);
  next();
});
app.use(express.static(root));
app.listen(4319, "127.0.0.1", () =>
  console.log("Static jmsn.art preview: http://127.0.0.1:4319/studio/"),
);
