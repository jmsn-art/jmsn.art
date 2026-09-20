import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import type { Artwork, Job, Rules } from "../src/types.js";

export class Store {
  db: DatabaseSync;
  constructor(public directory: string) {
    for (const name of ["", "images", "thumbnails", "references"])
      mkdirSync(path.join(directory, name), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(directory, "studio.sqlite"));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS artworks (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS references_archive (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);`);
    for (const job of this.jobs())
      if (job.status === "running" || job.status === "queued")
        this.saveJob({
          ...job,
          status: "failed",
          stage: "Interrupted",
          error:
            "The studio restarted before completion. Saved images are intact. Review them before starting another paid generation.",
        });
  }
  nextSequence() {
    return Number(
      (
        this.db
          .prepare(
            "INSERT INTO counters(name, value) VALUES('artwork', 1) ON CONFLICT(name) DO UPDATE SET value=value+1 RETURNING value",
          )
          .get() as { value: number }
      ).value,
    );
  }
  saveArtwork(artwork: Omit<Artwork, "id" | "url" | "thumbnail">) {
    const result = this.db
      .prepare("INSERT INTO artworks(data) VALUES(?)")
      .run(JSON.stringify(artwork));
    return this.getArtwork(Number(result.lastInsertRowid))!;
  }
  getArtwork(id: number): Artwork | undefined {
    const row = this.db
      .prepare("SELECT id,data FROM artworks WHERE id=?")
      .get(id) as { id: number; data: string } | undefined;
    return row
      ? {
          ...JSON.parse(row.data),
          id: row.id,
          url: `/api/artworks/${row.id}/image`,
          thumbnail: `/api/artworks/${row.id}/thumbnail`,
        }
      : undefined;
  }
  artworks() {
    return (
      this.db.prepare("SELECT id FROM artworks ORDER BY id DESC").all() as {
        id: number;
      }[]
    ).map((x) => this.getArtwork(x.id)!);
  }
  patchArtwork(id: number, patch: Partial<Artwork>) {
    const artwork = this.getArtwork(id);
    if (!artwork) return undefined;
    this.db
      .prepare("UPDATE artworks SET data=? WHERE id=?")
      .run(JSON.stringify({ ...artwork, ...patch }), id);
    return this.getArtwork(id);
  }
  saveJob(job: Job) {
    this.db
      .prepare(
        "INSERT INTO jobs(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(job.id, JSON.stringify(job));
  }
  jobs(): Job[] {
    return (
      this.db
        .prepare("SELECT data FROM jobs ORDER BY rowid DESC LIMIT 100")
        .all() as { data: string }[]
    ).map((x) => JSON.parse(x.data));
  }
  getJob(id: string): Job | undefined {
    const row = this.db.prepare("SELECT data FROM jobs WHERE id=?").get(id) as
      { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  }
  addReference(id: string, name: string) {
    this.db
      .prepare("INSERT INTO references_archive(id,name) VALUES(?,?)")
      .run(id, name);
  }
  referenceExists(id: string) {
    return !!this.db
      .prepare("SELECT id FROM references_archive WHERE id=?")
      .get(id);
  }
  close() {
    this.db.close();
  }
}
export function readRules(filename: string): Rules {
  return JSON.parse(readFileSync(filename, "utf8"));
}
export function writeRules(filename: string, rules: Rules) {
  atomicWrite(filename, JSON.stringify(rules, null, 2) + "\n");
}
export function atomicWrite(filename: string, bytes: string | Buffer) {
  const temporary = `${filename}.tmp`;
  writeFileSync(temporary, bytes, { mode: 0o600 });
  renameSync(temporary, filename);
}
export function slug(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 65) || "art-circle"
  );
}
