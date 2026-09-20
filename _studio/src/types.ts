export type Mode = "Explore" | "Refine" | "Series" | "Material";
export interface Concept {
  title: string;
  interpretation: string;
  mechanism: string;
  strategy: string;
  composition: string;
  prompt: string;
  source: "local" | "ai";
}
export interface Settings {
  size: "1024x1024" | "1536x1024" | "1024x1536";
  quality: "low" | "medium" | "high";
}
export interface Critique {
  status: "reviewed" | "unavailable" | "pending";
  verdict: "pass" | "revise" | "uncertain";
  summary: string;
  failures: string[];
  nextStep: string;
}
export interface Artwork {
  id: number;
  filename: string;
  createdAt: string;
  input: string;
  concept: Concept;
  prompt: string;
  model: string;
  settings: Settings;
  parentId: number | null;
  referenceId: string | null;
  critique: Critique;
  tags: string[];
  favorite: boolean;
  rejected: boolean;
  seriesId: string | null;
  usage: unknown;
  rules: Rules;
  url: string;
  thumbnail: string;
}
export interface Rules {
  principle: string;
  rules: string[];
}
export interface Job {
  id: string;
  status: "queued" | "running" | "complete" | "failed";
  total: number;
  completed: number;
  stage: string;
  imageIds: number[];
  error?: string;
  createdAt: string;
}
export interface Config {
  storage?: "browser" | "filesystem";
  hasKey: boolean;
  imageModel: string;
  textModel: string;
  dataDir: string;
  rules: Rules;
  examples: { subject: string; hint: string }[];
  materials: string[];
}
