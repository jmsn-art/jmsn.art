import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  Artwork,
  Concept,
  Config,
  Job,
  Mode,
  Rules,
  Settings,
} from "./types";

import { readDraft, saveDraft } from "./draft";
const browserOnly = import.meta.env.MODE === "site";

function downloadText(text: string, filename: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type IconName =
  | "arrow"
  | "star"
  | "close"
  | "plus"
  | "sun"
  | "moon"
  | "download"
  | "grid"
  | "compare"
  | "spark"
  | "check"
  | "upload"
  | "chevron";
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: (
      <>
        <path d="M4 12h15M13 5l7 7-7 7" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    plus: <path d="M12 4v16M4 12h16" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    compare: (
      <>
        <rect x="3" y="4" width="7" height="16" />
        <rect x="14" y="4" width="7" height="16" />
      </>
    ),
    spark: (
      <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />
    ),
    check: <path d="m4 12 5 5L20 6" />,
    upload: <path d="M12 17V3m-5 5 5-5 5 5M4 17v4h16v-4" />,
    chevron: <path d="m6 9 6 6 6-6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
async function api<T>(
  url: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  if (browserOnly)
    return (await import("./browser-api")).browserApi<T>(url, body, method);
  const response = await fetch(url, {
    method: method ?? (body ? "POST" : "GET"),
    headers:
      body instanceof FormData
        ? undefined
        : body
          ? { "Content-Type": "application/json" }
          : undefined,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? `Request failed (${response.status})`);
  return result;
}
function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
          ) ?? [],
        ).filter((x) => x.getClientRects().length);
        if (!nodes.length) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === nodes[0] ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          nodes.at(-1)?.focus();
        }
        if (
          !event.shiftKey &&
          (document.activeElement === nodes.at(-1) ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          nodes[0].focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
const directions = [
  "More Abstract",
  "More Literal",
  "More Sculptural",
  "More Environmental",
  "More Minimal",
  "Stranger",
  "Less Like a Ring",
];
const refineOptions = [
  "Preserve composition",
  "Preserve subject",
  "Preserve palette",
  "Change only Art Circle",
  "Move gap",
  "Alter scale",
  "Alter material",
  "Simplify",
  "Intensify",
  "Remove text",
  "Remove obvious symbolism",
  "Make the subject itself become the circle",
];
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export function App() {
  const [savedDraft] = useState(() => (browserOnly ? readDraft() : undefined));
  const [draftReady, setDraftReady] = useState(false);
  const [config, setConfig] = useState<Config>();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [view, setView] = useState<"studio" | "archive" | "compare">("studio");
  const [mode, setMode] = useState<Mode>(savedDraft?.mode ?? "Explore");
  const [input, setInput] = useState(savedDraft?.input ?? "");
  const [direction, setDirection] = useState(savedDraft?.direction ?? "");
  const [constraints, setConstraints] = useState<string[]>(
    savedDraft?.constraints ?? ["Preserve composition", "Preserve subject"],
  );
  const [count, setCount] = useState(savedDraft?.count ?? 3);
  const [settings, setSettings] = useState<Settings>({
    size: "1024x1024",
    quality: "medium",
  });
  const [concepts, setConcepts] = useState<Concept[]>(
    savedDraft?.concepts ?? [],
  );
  const [conceptIndex, setConceptIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [reference, setReference] = useState<{
    id: string;
    name: string;
    url: string;
  }>();
  const [compared, setCompared] = useState<number[]>([]);
  const [job, setJob] = useState<Job>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(
    !!savedDraft?.concepts.length,
  );
  const [dialog, setDialog] = useState<
    "setup" | "rules" | "render" | "export" | "artwork" | null
  >(null);
  const [exportId, setExportId] = useState<number>();
  const [rulesDraft, setRulesDraft] = useState<Rules>();
  const [website, setWebsite] = useState<{
    found: boolean;
    path: string | null;
    status: string;
    message: string;
  }>();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("jmsn-theme") ?? "light",
  );
  const uploadRef = useRef<HTMLInputElement>(null);
  const selected = artworks.find((x) => x.id === selectedId);
  const parent = artworks.find((x) => x.id === parentId);
  const concept = concepts[conceptIndex];
  const running = job?.status === "running" || job?.status === "queued";
  const locked = !!busy || running;
  useEffect(() => {
    if (!browserOnly) return;
    if (savedDraft?.reference) {
      import("./browser-api")
        .then((m) => m.restoreBrowserReference(savedDraft.reference!.id))
        .then(setReference)
        .catch((e) => setError(e.message))
        .finally(() => setDraftReady(true));
    } else setDraftReady(true);
  }, [savedDraft]);
  useEffect(() => {
    if (browserOnly && draftReady)
      saveDraft({
        input,
        mode,
        direction,
        count,
        concepts,
        constraints,
        reference: reference
          ? { id: reference.id, name: reference.name }
          : undefined,
      });
  }, [
    draftReady,
    input,
    mode,
    direction,
    count,
    concepts,
    constraints,
    reference,
  ]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("jmsn-theme", theme);
  }, [theme]);
  useEffect(() => {
    Promise.all([
      api<Config>("/api/config"),
      api<Artwork[]>("/api/artworks"),
      api<Job[]>("/api/jobs"),
    ])
      .then(([c, a, j]) => {
        setConfig(c);
        setArtworks(a);
        const active = j.find(
          (x) => x.status === "running" || x.status === "queued",
        );
        if (active) setJob(active);
        else if (j[0]?.status === "failed") setJob(j[0]);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!job || !running) return;
    const timer = setInterval(() => {
      Promise.all([
        api<Job>(`/api/jobs/${job.id}`),
        api<Artwork[]>("/api/artworks"),
      ])
        .then(([j, a]) => {
          setJob(j);
          setArtworks(a);
          if (j.imageIds.length) setSelectedId(j.imageIds.at(-1)!);
          if (j.status === "failed") setError(j.error ?? "Generation failed.");
          if (j.status === "complete") {
            setParentId(j.imageIds.at(-1) ?? null);
            setReference(undefined);
            setNotice(
              `${j.completed} ${j.completed === 1 ? "work" : "works"} saved to your archive.`,
            );
            setConcepts([]);
          }
        })
        .catch((e) => setError(e.message));
    }, 1800);
    return () => clearInterval(timer);
  }, [job?.id, running]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  function invalidate() {
    setConcepts([]);
    setError("");
  }
  function startNewProject() {
    const hasCurrentWork =
      !!input.trim() ||
      !!direction.trim() ||
      !!reference ||
      !!parentId ||
      !!selectedId ||
      concepts.length > 0;
    if (
      hasCurrentWork &&
      !window.confirm(
        "Clear the current project and start fresh? Your archive, rules, and API setup will stay.",
      )
    )
      return;
    setView("studio");
    setMode("Explore");
    setInput("");
    setDirection("");
    setConstraints(["Preserve composition", "Preserve subject"]);
    setCount(3);
    setSettings({ size: "1024x1024", quality: "medium" });
    setConcepts([]);
    setConceptIndex(0);
    setSelectedId(null);
    setParentId(null);
    setReference(undefined);
    setJob(undefined);
    setInspectorOpen(false);
    setDialog(null);
    setExportId(undefined);
    setError("");
    setNotice("New project ready. Your archive and setup are unchanged.");
  }
  function chooseMode(next: Mode) {
    setMode(next);
    invalidate();
    if (next !== "Refine") setReference(undefined);
  }
  async function perform<T>(
    label: string,
    task: () => Promise<T>,
  ): Promise<T | undefined> {
    setBusy(label);
    setError("");
    try {
      return await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return undefined;
    } finally {
      setBusy("");
    }
  }
  async function plan(extraDirection?: string) {
    if (!input.trim()) {
      setError("Start with a subject, artist, material, or idea.");
      return;
    }
    const nextDirection = extraDirection ?? direction;
    setDirection(nextDirection);
    const result = await perform("Developing the idea", () =>
      api<{ concepts: Concept[]; warning: string | null }>("/api/plan", {
        input,
        mode,
        count: mode === "Series" ? count : 1,
        direction: nextDirection,
        constraints: mode === "Refine" ? constraints : [],
        parentId: mode === "Refine" ? parentId : (selectedId ?? parentId),
        referenceId: reference?.id ?? null,
      }),
    );
    if (result) {
      setConcepts(result.concepts);
      setConceptIndex(0);
      setInspectorOpen(true);
      if (result.warning) setNotice(result.warning);
    }
  }
  async function render() {
    const result = await perform("Starting generation", () =>
      api<Job>("/api/generate", {
        input,
        mode,
        concepts,
        settings,
        direction,
        constraints: mode === "Refine" ? constraints : [],
        parentId,
        referenceId: reference?.id ?? null,
      }),
    );
    if (result) {
      setJob(result);
      setDialog(null);
      setNotice(
        "Rendering started. Each completed image is saved automatically.",
      );
    }
  }
  async function patch(art: Artwork, updates: Partial<Artwork>) {
    const result = await perform("Saving archive", () =>
      api<Artwork>(`/api/artworks/${art.id}`, updates, "PATCH"),
    );
    if (result)
      setArtworks((items) => items.map((x) => (x.id === art.id ? result : x)));
  }
  function useArtwork(art: Artwork, nextMode: Mode) {
    setInput(art.input);
    setSelectedId(art.id);
    setParentId(art.id);
    setReference(undefined);
    setMode(nextMode);
    setDirection("");
    setConcepts([]);
    setView("studio");
    setDialog(null);
    setNotice(
      nextMode === "Refine"
        ? "The selected image will be sent as the edit reference."
        : "Source idea loaded. Develop a new interpretation before rendering.",
    );
  }
  function compare(id: number) {
    setCompared((items) => {
      if (items.includes(id)) return items.filter((x) => x !== id);
      if (items.length === 4) {
        setNotice("Comparison holds up to four works. Remove one first.");
        return items;
      }
      return [...items, id];
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Prompt copied.");
    } catch {
      setError(
        "Clipboard unavailable. Select the text in the inspector and copy it manually.",
      );
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("Reference images must be 20 MB or smaller.");
      return;
    }
    const form = new FormData();
    form.append("image", file);
    const result = await perform("Saving reference", () =>
      api<{ id: string; name: string; url: string }>("/api/references", form),
    );
    if (result) {
      setMode("Refine");
      setReference(result);
      setParentId(null);
      setSelectedId(null);
      invalidate();
      if (!input.trim()) setInput("Reinterpret this reference image");
      setNotice("Reference ready. Describe what should change.");
    }
  }
  async function openExport(id: number) {
    setExportId(id);
    setDialog("export");
    setWebsite(undefined);
    try {
      setWebsite(await api("/api/website"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const exportArt = artworks.find((x) => x.id === exportId);
  const visible = artworks.filter(
    (x) =>
      (filter === "all"
        ? !x.rejected
        : filter === "favorites"
          ? x.favorite && !x.rejected
          : filter === "rejected"
            ? x.rejected
            : !!x.seriesId && !x.rejected) &&
      `${x.input} ${x.concept.title} ${x.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const compareArt = compared
    .map((id) => artworks.find((x) => x.id === id))
    .filter((x): x is Artwork => !!x);
  function artActions(art: Artwork, detailed = false) {
    return (
      <div className={`art-actions ${detailed ? "detailed" : ""}`}>
        <button
          title={art.favorite ? "Unfavorite" : "Favorite"}
          aria-label={`${art.favorite ? "Unfavorite" : "Favorite"} ${art.concept.title}`}
          className={art.favorite ? "is-favorite" : ""}
          disabled={locked}
          onClick={() => patch(art, { favorite: !art.favorite })}
        >
          <Icon name="star" />
          {detailed && "Favorite"}
        </button>
        <button
          title="Compare"
          aria-label={`Compare ${art.concept.title}`}
          className={compared.includes(art.id) ? "active" : ""}
          onClick={() => compare(art.id)}
        >
          <Icon name="compare" />
          {detailed && "Compare"}
        </button>
        <button disabled={locked} onClick={() => useArtwork(art, "Refine")}>
          Edit
        </button>
        <button
          disabled={locked}
          onClick={() => openExport(art.id)}
          aria-label={`Export ${art.concept.title}`}
        >
          <Icon name="download" />
          {detailed && "Export"}
        </button>
        {detailed && (
          <>
            <button
              disabled={locked}
              onClick={() => useArtwork(art, "Explore")}
            >
              Regenerate from this
            </button>
            <button disabled={locked} onClick={() => useArtwork(art, "Series")}>
              Promote to series
            </button>
            <button onClick={() => copy(art.prompt)}>Copy prompt</button>
            <button
              disabled={locked}
              onClick={() => patch(art, { rejected: !art.rejected })}
            >
              {art.rejected ? "Restore" : "Reject"}
            </button>
          </>
        )}
      </div>
    );
  }
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("studio");
          }}
        >
          <span className="wordmark">
            JMSN<span className="brand-dot">.</span>
          </span>
          <span className="brand-name">
            ART CIRCLE
            <br />
            STUDIO
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === "studio" ? "nav-active" : ""}
            onClick={() => setView("studio")}
          >
            Studio
          </button>
          <button
            className={view === "archive" ? "nav-active" : ""}
            onClick={() => setView("archive")}
          >
            Archive{" "}
            <span className="nav-count">
              {artworks.length.toString().padStart(2, "0")}
            </span>
          </button>
          <button
            className={view === "compare" ? "nav-active" : ""}
            onClick={() => setView("compare")}
          >
            Compare
            {compared.length > 0 && (
              <span className="nav-count">{compared.length}</span>
            )}
          </button>
        </nav>
        <div className="header-right">
          <button
            className="new-project-button"
            disabled={locked}
            aria-label="New project"
            title="Clear the current project and start fresh"
            onClick={startNewProject}
          >
            <Icon name="plus" size={14} />
            <span>New project</span>
          </button>
          <button className="connection" onClick={() => setDialog("setup")}>
            <span
              className={`status-dot ${config?.hasKey ? "connected" : ""}`}
            />
            {browserOnly
              ? "BROWSER STUDIO"
              : config?.hasKey
                ? "LOCAL STUDIO"
                : "SET UP API"}
          </button>
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Icon name={theme === "light" ? "moon" : "sun"} />
          </button>
        </div>
      </header>
      {error && (
        <div className="message error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <Icon name="close" />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {!config ? (
        <main className="loading">
          <span className="eyebrow">JMSN ART CIRCLE STUDIO</span>
          <h1>Opening the studio…</h1>
          {error && (
            <button onClick={() => window.location.reload()}>Try again</button>
          )}
        </main>
      ) : (
        <>
          {view === "studio" && (
            <main className="studio-layout">
              <aside className="workbench">
                <div className="section-kicker">
                  <span>01 / THE STARTING POINT</span>
                  <span className="small-mark">↗</span>
                </div>
                <h1>
                  Find the circle
                  <br />
                  <em>within.</em>
                </h1>
                <p className="intro">
                  A subject. A material. A possibility.
                  <br />
                  Let the idea find its own opening.
                </p>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div
                  className="mode-tabs"
                  role="tablist"
                  aria-label="Creative mode"
                >
                  {(["Explore", "Refine", "Series", "Material"] as Mode[]).map(
                    (m) => (
                      <button
                        role="tab"
                        aria-selected={mode === m}
                        key={m}
                        disabled={locked}
                        onClick={() => chooseMode(m)}
                      >
                        {m}
                      </button>
                    ),
                  )}
                </div>
                {mode !== "Refine" && (
                  <button
                    type="button"
                    className="upload-shortcut"
                    disabled={locked}
                    onClick={() => uploadRef.current?.click()}
                  >
                    <Icon name="upload" />
                    <span>
                      Upload an image
                      <small>Start a refinement · PNG, JPEG, or WebP</small>
                    </span>
                  </button>
                )}
                <label className="field-label" htmlFor="subject">
                  {mode === "Material"
                    ? "BEGIN WITH A MATERIAL"
                    : mode === "Refine"
                      ? "WHAT SHOULD CHANGE?"
                      : "SUBJECT / ARTIST / IDEA"}
                </label>
                <textarea
                  id="subject"
                  className="subject-input"
                  placeholder={
                    mode === "Material"
                      ? "Bronze, beeswax, folded paper…"
                      : "Georgia O’Keeffe, abandoned motel…"
                  }
                  value={input}
                  disabled={locked}
                  onChange={(e) => {
                    setInput(e.target.value);
                    invalidate();
                  }}
                  rows={3}
                />
                {mode === "Material" && (
                  <div className="material-pills">
                    {config.materials.map((m) => (
                      <button
                        key={m}
                        disabled={locked}
                        className={input === m ? "active" : ""}
                        onClick={() => {
                          setInput(m);
                          invalidate();
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
                {mode === "Refine" && (
                  <div className="reference-control">
                    {reference || parent ? (
                      <div className="reference-preview">
                        <img
                          src={reference?.url ?? parent?.thumbnail}
                          alt="Reference for editing"
                        />
                        <div>
                          <span>EDITING FROM</span>
                          <p>{reference?.name ?? parent?.concept.title}</p>
                          <button
                            disabled={locked}
                            onClick={() => uploadRef.current?.click()}
                          >
                            Replace reference
                          </button>
                        </div>
                        <button
                          className="icon-button"
                          disabled={locked}
                          onClick={() => {
                            setReference(undefined);
                            setParentId(null);
                            invalidate();
                          }}
                          aria-label="Remove reference"
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="upload-zone"
                        disabled={locked}
                        onClick={() => uploadRef.current?.click()}
                      >
                        <Icon name="upload" />
                        <span>
                          Upload a reference image
                          <small>PNG, JPEG, WebP · up to 20 MB</small>
                        </span>
                      </button>
                    )}
                    <p className="hint">
                      {browserOnly
                        ? "Your reference stays in this browser. Describe it in the subject field; local sketches cannot analyze its pixels."
                        : "Or choose a work in your archive and select Edit."}
                    </p>
                    <div className="constraint-list">
                      {refineOptions.map((option) => (
                        <label key={option}>
                          <input
                            type="checkbox"
                            checked={constraints.includes(option)}
                            disabled={locked}
                            onChange={() => {
                              setConstraints((items) =>
                                items.includes(option)
                                  ? items.filter((x) => x !== option)
                                  : [...items, option],
                              );
                              invalidate();
                            }}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {mode === "Series" && (
                  <div className="series-count">
                    <div>
                      <label htmlFor="series-count">Interpretations</label>
                      <small>Different mechanisms. One source idea.</small>
                    </div>
                    <select
                      id="series-count"
                      value={count}
                      disabled={locked}
                      onChange={(e) => {
                        setCount(Number(e.target.value));
                        invalidate();
                      }}
                    >
                      <option value={2}>2 works</option>
                      <option value={3}>3 works</option>
                      <option value={4}>4 works</option>
                    </select>
                  </div>
                )}
                <details className="direction-details">
                  <summary>
                    Creative direction <Icon name="plus" size={14} />
                  </summary>
                  <textarea
                    aria-label="Creative direction"
                    placeholder="Move the gap toward the horizon. Make it quieter…"
                    value={direction}
                    disabled={locked}
                    onChange={(e) => {
                      setDirection(e.target.value);
                      invalidate();
                    }}
                  />
                </details>
                <button
                  className="primary develop"
                  disabled={
                    locked ||
                    !input.trim() ||
                    (mode === "Refine" && !reference && !parent)
                  }
                  onClick={() => plan()}
                >
                  <span>
                    {busy === "Developing the idea"
                      ? "Developing…"
                      : concepts.length
                        ? "Rethink the idea"
                        : "Develop the idea"}
                  </span>
                  <Icon name="arrow" />
                </button>
                <div className="develop-foot">
                  <span>
                    {config.hasKey
                      ? "AI concept · text API usage"
                      : "Local concept sketch · no API usage"}
                  </span>
                  <button
                    disabled={locked}
                    onClick={() => {
                      setInput(
                        config.examples[
                          Math.floor(Math.random() * config.examples.length)
                        ].subject,
                      );
                      setDirection("");
                      invalidate();
                    }}
                  >
                    <Icon name="spark" size={13} /> Surprise me
                  </button>
                </div>
                <div className="rule-note">
                  <span className="rule-number">ONE RULE, ALWAYS</span>
                  <p>
                    The subject becomes the circle.
                    <br />
                    It tries to close. It fails once.
                  </p>
                  <button
                    onClick={() => {
                      setRulesDraft(config.rules);
                      setDialog("rules");
                    }}
                  >
                    Read & edit the principles <span>↗</span>
                  </button>
                </div>
                <details className="seed-list">
                  <summary>
                    Ways in{" "}
                    <span>
                      {config.examples.length.toString().padStart(2, "0")}{" "}
                      starting points
                    </span>
                  </summary>
                  {config.examples.map((example, i) => (
                    <button
                      key={i}
                      disabled={locked}
                      onClick={() => {
                        setInput(example.subject);
                        setDirection("");
                        invalidate();
                      }}
                    >
                      <strong>{example.subject}</strong>
                      <span>{example.hint}</span>
                    </button>
                  ))}
                </details>
              </aside>
              <section className="workspace">
                <div className="workspace-heading">
                  <div className="section-kicker">
                    <span>
                      02 /{" "}
                      {concepts.length
                        ? "THE INTERPRETATION"
                        : selected
                          ? "THE WORK"
                          : "THE OPEN STUDIO"}
                    </span>
                  </div>
                  <div className="workspace-tools">
                    <span>{mode.toUpperCase()}</span>
                    {selected && (
                      <button
                        className="icon-button"
                        disabled={locked}
                        aria-label="Clear displayed artwork"
                        onClick={() => {
                          setSelectedId(null);
                          setParentId(null);
                        }}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className={`art-stage ${selected || (reference && mode === "Refine") ? "has-art" : ""}`}
                >
                  {selected ? (
                    <button
                      className="artwork-open"
                      onClick={() => setDialog("artwork")}
                      aria-label="Open artwork details"
                    >
                      <img
                        className="stage-image"
                        src={selected.url}
                        alt={selected.concept.title}
                      />
                    </button>
                  ) : reference && mode === "Refine" ? (
                    <img
                      className="stage-image"
                      src={reference.url}
                      alt="Uploaded reference"
                    />
                  ) : (
                    <div className="empty-art">
                      <span className="plate-number">
                        STUDY NO. {String(artworks.length + 1).padStart(3, "0")}
                      </span>
                      <div className="empty-composition">
                        <span className="empty-line" />
                        <h2>
                          {concept ? (
                            concept.title
                          ) : (
                            <>
                              The opening
                              <br />
                              is the idea.
                            </>
                          )}
                        </h2>
                        <p>
                          {concept
                            ? concept.mechanism
                            : "Not a symbol placed on the world.\nA possibility already inside it."}
                        </p>
                      </div>
                      <span className="plate-footer">
                        {concept
                          ? "CONCEPT STUDY / NOT YET RENDERED"
                          : "JAMESON McSHANE / AN ONGOING PRACTICE"}
                      </span>
                    </div>
                  )}
                  {running && (
                    <div className="generation-overlay" role="status">
                      <span className="pulse-line" />
                      <h3>{job.stage}</h3>
                      <p>
                        {job.completed} of {job.total} saved · You can browse
                        the archive while this runs.
                      </p>
                    </div>
                  )}
                </div>
                <div className="art-caption">
                  <div>
                    <span className="caption-number">
                      {selected
                        ? `NO. ${String(selected.id).padStart(3, "0")}`
                        : "AN ATTEMPT AT CLOSURE"}
                    </span>
                    <h3>
                      {selected
                        ? selected.concept.title
                        : concept
                          ? concept.title
                          : "The subject. The absence. The almost."}
                    </h3>
                    {selected && (
                      <small>
                        {date(selected.createdAt)} · {selected.settings.size} ·{" "}
                        {selected.model}
                      </small>
                    )}
                  </div>
                  {selected && artActions(selected)}
                </div>
                {(selected || concepts.length > 0) && (
                  <div className="push-tools">
                    <span>TAKE IT SOMEWHERE</span>
                    <div>
                      <button
                        disabled={locked || !input.trim()}
                        onClick={() =>
                          plan(
                            `Push further while preserving the core idea: ${selected?.concept.mechanism ?? concept?.mechanism}. Address critique: ${selected?.critique.summary ?? "Avoid the most obvious interpretation."} ${selected?.critique.nextStep ?? ""}`,
                          )
                        }
                      >
                        Push Further <Icon name="arrow" size={13} />
                      </button>
                      {directions.map((d) => (
                        <button
                          key={d}
                          disabled={locked || !input.trim()}
                          onClick={() => plan(d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <section className="inspector">
                  <button
                    className="inspector-toggle"
                    aria-expanded={inspectorOpen}
                    onClick={() => setInspectorOpen(!inspectorOpen)}
                  >
                    <span>
                      <span className="inspector-dot" />
                      Prompt inspector
                    </span>
                    <span>
                      {concepts.length > 0
                        ? `${concepts.length} ${concepts.length === 1 ? "idea" : "ideas"} ready`
                        : selected
                          ? "Generation record"
                          : "The thinking behind the image"}
                      <Icon name="chevron" />
                    </span>
                  </button>
                  {inspectorOpen && (
                    <div className="inspector-body">
                      {concepts.length > 0 ? (
                        <>
                          {concepts.length > 1 && (
                            <div className="concept-tabs">
                              {concepts.map((c, i) => (
                                <button
                                  className={conceptIndex === i ? "active" : ""}
                                  key={i}
                                  onClick={() => setConceptIndex(i)}
                                >
                                  {String(i + 1).padStart(2, "0")} /{" "}
                                  {c.strategy}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="inspector-grid">
                            <div>
                              <span className="field-label">USER INPUT</span>
                              <p>{input}</p>
                              <span className="field-label">
                                CONCEPT INTERPRETATION
                              </span>
                              <p>{concept.interpretation}</p>
                            </div>
                            <div>
                              <span className="field-label">
                                CHOSEN ART CIRCLE MECHANISM
                              </span>
                              <p>{concept.mechanism}</p>
                              <span className="field-label">COMPOSITION</span>
                              <p>{concept.composition}</p>
                            </div>
                          </div>
                          <label className="field-label" htmlFor="final-prompt">
                            FINAL IMAGE PROMPT · EDIT BEFORE RENDERING
                          </label>
                          <textarea
                            id="final-prompt"
                            className="prompt-editor"
                            value={concept.prompt}
                            disabled={locked}
                            onChange={(e) =>
                              setConcepts((items) =>
                                items.map((x, i) =>
                                  i === conceptIndex
                                    ? { ...x, prompt: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                          <p className="hint">
                            {browserOnly
                              ? "Your browser’s saved principles are included in this sketch."
                              : "The permanent rules are appended on the server at rendering."}{" "}
                            {concept.source === "local"
                              ? "This is a local sketch; no AI analysis has run."
                              : "Artist references have been translated into visual vocabulary."}
                          </p>
                          <div className="inspector-footer">
                            <button
                              className="text-button"
                              onClick={() => copy(concept.prompt)}
                            >
                              Copy Prompt ↗
                            </button>
                            <button
                              className="text-button"
                              onClick={() =>
                                downloadText(
                                  concept.prompt,
                                  "art-circle-prompt.txt",
                                )
                              }
                            >
                              Download prompt ↗
                            </button>
                            <span className="hint">
                              Critique follows rendering.
                            </span>
                          </div>
                        </>
                      ) : selected ? (
                        <>
                          <div className="inspector-grid">
                            <div>
                              <span className="field-label">USER INPUT</span>
                              <p>{selected.input}</p>
                              <span className="field-label">
                                CONCEPT INTERPRETATION
                              </span>
                              <p>{selected.concept.interpretation}</p>
                            </div>
                            <div>
                              <span className="field-label">
                                CHOSEN ART CIRCLE MECHANISM
                              </span>
                              <p>{selected.concept.mechanism}</p>
                              <span className="field-label">
                                CRITIQUE ·{" "}
                                {selected.critique.verdict.toUpperCase()}
                              </span>
                              <p>{selected.critique.summary}</p>
                              {selected.critique.failures.length > 0 && (
                                <ul>
                                  {selected.critique.failures.map((x) => (
                                    <li key={x}>{x}</li>
                                  ))}
                                </ul>
                              )}
                              <p>{selected.critique.nextStep}</p>
                            </div>
                          </div>
                          <span className="field-label">
                            FINAL IMAGE PROMPT
                          </span>
                          <pre className="saved-prompt">{selected.prompt}</pre>
                          <button
                            className="text-button"
                            onClick={() => copy(selected.prompt)}
                          >
                            Copy Prompt ↗
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              downloadText(
                                selected.prompt,
                                "art-circle-prompt.txt",
                              )
                            }
                          >
                            Download prompt ↗
                          </button>
                        </>
                      ) : (
                        <p className="muted">
                          Develop an idea to see its interpretation, mechanism,
                          and editable image prompt here.
                        </p>
                      )}
                    </div>
                  )}
                </section>
                {concepts.length > 0 && (
                  <div className="render-bar">
                    <div>
                      <strong>
                        {concepts.length === 1
                          ? "Ready to make it visible?"
                          : `${concepts.length} distinct interpretations`}
                      </strong>
                      <span>
                        Review the prompt{concepts.length > 1 ? "s" : ""}, then
                        generate.
                      </span>
                    </div>
                    <button
                      className="primary"
                      disabled={
                        locked ||
                        concepts.some((x) => x.prompt.trim().length < 10)
                      }
                      onClick={() =>
                        setDialog(config.hasKey ? "render" : "setup")
                      }
                    >
                      Generate{" "}
                      {concepts.length > 1
                        ? `${concepts.length} images`
                        : "image"}{" "}
                      <Icon name="arrow" />
                    </button>
                  </div>
                )}
                {job?.status === "failed" && (
                  <div className="job-failure">
                    <strong>Last generation stopped</strong>
                    <p>{job.error}</p>
                    <button onClick={() => setJob(undefined)}>Dismiss</button>
                  </div>
                )}
              </section>
            </main>
          )}
          {view === "archive" && (
            <main className="archive-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">THE LOCAL COLLECTION</span>
                  <h1>
                    An archive of <em>almost.</em>
                  </h1>
                  <p>Every attempt has a place here.</p>
                </div>
                <button className="primary" onClick={() => setView("studio")}>
                  New study <Icon name="plus" />
                </button>
              </div>
              <div className="archive-toolbar">
                <div className="filter-tabs">
                  {[
                    ["all", "All works"],
                    ["favorites", "Favorites"],
                    ["series", "Series"],
                    ["rejected", "Rejected"],
                  ].map(([key, label]) => (
                    <button
                      className={filter === key ? "active" : ""}
                      key={key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  className="search"
                  type="search"
                  placeholder="Search subjects, titles, tags"
                  aria-label="Search archive"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="muted">
                  {visible.length} {visible.length === 1 ? "work" : "works"}
                </span>
              </div>
              {visible.length ? (
                <div className="gallery">
                  {visible.map((art) => (
                    <article className="gallery-item" key={art.id}>
                      <button
                        className={`gallery-image ${compared.includes(art.id) ? "chosen" : ""}`}
                        onClick={() => {
                          setSelectedId(art.id);
                          setDialog("artwork");
                        }}
                      >
                        <img
                          src={art.thumbnail}
                          alt={art.concept.title}
                          loading="lazy"
                        />
                        <span className="gallery-number">
                          {String(art.id).padStart(3, "0")}
                        </span>
                        {art.favorite && (
                          <span className="favorite-badge">
                            <Icon name="star" size={15} />
                          </span>
                        )}
                      </button>
                      <div className="gallery-caption">
                        <h3>{art.concept.title}</h3>
                        <span>
                          {date(art.createdAt)}
                          {art.seriesId ? " · SERIES" : ""}
                        </span>
                      </div>
                      {artActions(art)}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="archive-empty">
                  <span className="eyebrow">
                    {artworks.length
                      ? "NO MATCHES"
                      : "A COLLECTION BEGINS WITH ONE ATTEMPT"}
                  </span>
                  <h2>
                    {artworks.length
                      ? "Room for a different search."
                      : "Nothing here, yet."}
                  </h2>
                  <p>
                    {artworks.length
                      ? "Try another filter or subject."
                      : browserOnly
                        ? "Generated images stay in the local companion’s SQLite archive. Open the local studio when you are ready to render; this page keeps your prompt drafts and references in this browser."
                        : "Generated works and their complete histories will live here, on your Mac."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (artworks.length) {
                        setSearch("");
                        setFilter("all");
                      } else setView("studio");
                    }}
                  >
                    {artworks.length ? "Reset filters" : "Begin a study"} ↗
                  </button>
                </div>
              )}
            </main>
          )}
          {view === "compare" && (
            <main className="compare-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">THE VIEWING ROOM</span>
                  <h1>
                    See what <em>holds.</em>
                  </h1>
                  <p>Choose two to four works from the archive.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setView("archive")}
                >
                  Choose works ↗
                </button>
              </div>
              {compareArt.length >= 2 ? (
                <div
                  className="comparison-grid"
                  style={{
                    gridTemplateColumns: `repeat(${compareArt.length}, minmax(0, 1fr))`,
                  }}
                >
                  {compareArt.map((art) => (
                    <article key={art.id}>
                      <div className="compare-image">
                        <img src={art.url} alt={art.concept.title} />
                        <button
                          className="icon-button"
                          onClick={() => compare(art.id)}
                          aria-label={`Remove ${art.concept.title} from comparison`}
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                      <span className="eyebrow">
                        NO. {String(art.id).padStart(3, "0")}
                      </span>
                      <h3>{art.concept.title}</h3>
                      <p>{art.concept.mechanism}</p>
                      <div className="critique-note">
                        <span className="field-label">
                          {art.critique.status === "reviewed"
                            ? `CRITIQUE / ${art.critique.verdict}`
                            : "CRITIQUE / NOT REVIEWED"}
                        </span>
                        <p>{art.critique.summary}</p>
                      </div>
                      {artActions(art, true)}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="archive-empty">
                  <Icon name="compare" size={32} />
                  <h2>
                    {compareArt.length
                      ? "One more perspective."
                      : "Put the possibilities together."}
                  </h2>
                  <p>
                    {compareArt.length
                      ? "Choose at least one more work in the archive."
                      : "Use the compare icon on any archived work to bring it here."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setView("archive")}
                  >
                    Open archive ↗
                  </button>
                </div>
              )}
            </main>
          )}
          <footer className="site-footer">
            <span>JMSN ART CIRCLE STUDIO</span>
            <span>A perfect circle exists only as an idea.</span>
            <button onClick={() => setDialog("setup")}>
              Local-first /{" "}
              {browserOnly
                ? "Browser sketches"
                : config.hasKey
                  ? "API configured"
                  : "API setup needed"}
            </button>
          </footer>
          {compared.length > 0 && view !== "compare" && (
            <div className="compare-tray">
              <span>{compared.length} / 4 works selected</span>
              <button
                disabled={compared.length < 2}
                onClick={() => setView("compare")}
              >
                View together <Icon name="arrow" size={16} />
              </button>
              <button
                aria-label="Clear comparison"
                onClick={() => setCompared([])}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {dialog === "setup" && (
        <Modal
          title={
            browserOnly ? "Rendering can wait." : "Your studio, on your Mac."
          }
          close={() => setDialog(null)}
        >
          {browserOnly ? (
            <>
              <p className="modal-intro">
                Develop ideas, explore materials, edit prompts, and upload
                references here now. Your drafts, principles, and references
                stay in this browser.
              </p>
              <p className="modal-intro">
                Image generation and the generated-image archive run in the
                local companion. API-key setup can wait. This page never asks
                for a key or contacts a local server automatically.
              </p>
              <ol className="setup-steps">
                <li>
                  In the jmsn.art repository, open <code>_studio</code>.
                </li>
                <li>
                  Run <code>npm install</code>, then <code>npm run build</code>{" "}
                  and <code>npm start</code>.
                </li>
                <li>
                  When ready, copy <code>.env.example</code> to{" "}
                  <code>.env.local</code>, add <code>OPENAI_API_KEY</code>, and
                  restart.
                </li>
              </ol>
              <p className="hint">
                The website draft and the companion archive are separate.
                Download or copy your prompt and upload your reference in the
                companion. Clearing this site’s browser storage removes browser
                drafts and references.
              </p>
              <a
                className="text-button"
                href="http://127.0.0.1:4317/studio/"
                target="_blank"
                rel="noreferrer"
              >
                Open local companion ↗
              </a>
            </>
          ) : (
            <>
              <p className="modal-intro">
                Your archive, rules, and images live locally. OpenAI receives
                prompts and reference images only when you use AI planning,
                generation, editing, or critique.
              </p>
              <div className="setup-status">
                <span
                  className={`status-dot ${config?.hasKey ? "connected" : ""}`}
                />
                {config?.hasKey
                  ? "API key configured on the server"
                  : "An API key is needed to render images"}
              </div>
              <ol className="setup-steps">
                <li>
                  In the application folder, copy <code>.env.example</code> to{" "}
                  <code>.env.local</code>.
                </li>
                <li>
                  Set <code>OPENAI_API_KEY</code> to your OpenAI API key.
                </li>
                <li>
                  Restart the studio with <code>npm run dev</code>.
                </li>
              </ol>
              <p className="hint">
                Keep the key in that file. It is never sent to the browser or
                included in image metadata. A ChatGPT subscription does not
                configure API access.
              </p>
              <dl className="setup-details">
                <dt>Image model</dt>
                <dd>{config?.imageModel}</dd>
                <dt>Concept & critique model</dt>
                <dd>{config?.textModel}</dd>
                <dt>Local archive</dt>
                <dd>{config?.dataDir}</dd>
              </dl>
              <a
                className="text-button"
                target="_blank"
                rel="noreferrer"
                href="https://platform.openai.com/api-keys"
              >
                OpenAI API keys ↗
              </a>
            </>
          )}
        </Modal>
      )}
      {dialog === "rules" && rulesDraft && (
        <Modal title="The permanent principles" close={() => setDialog(null)}>
          <p className="modal-intro">
            {browserOnly ? (
              "These principles are saved in this browser and included in every local concept sketch. Download a copy to move them to your local companion."
            ) : (
              <>
                These are included in every concept and render. Changes are
                saved to <code>art-circle-rules.json</code>; each artwork keeps
                the rules it was made with.
              </>
            )}
          </p>
          <button
            className="text-button"
            onClick={() =>
              downloadText(
                JSON.stringify(rulesDraft, null, 2),
                "art-circle-rules.json",
                "application/json",
              )
            }
          >
            Download principles ↗
          </button>
          <label className="field-label" htmlFor="principle">
            CENTRAL PRINCIPLE
          </label>
          <textarea
            id="principle"
            rows={4}
            value={rulesDraft.principle}
            onChange={(e) =>
              setRulesDraft({ ...rulesDraft, principle: e.target.value })
            }
          />
          <label className="field-label" htmlFor="rules">
            RULES · ONE PER LINE
          </label>
          <textarea
            id="rules"
            className="rules-editor"
            value={rulesDraft.rules.join("\n")}
            onChange={(e) =>
              setRulesDraft({
                ...rulesDraft,
                rules: e.target.value.split("\n"),
              })
            }
          />
          <button
            className="primary"
            disabled={!!busy}
            onClick={async () => {
              const result = await perform("Saving rules", () =>
                api<Rules>(
                  "/api/rules",
                  {
                    ...rulesDraft,
                    rules: rulesDraft.rules.filter((x) => x.trim()),
                  },
                  "PUT",
                ),
              );
              if (result && config) {
                setConfig({ ...config, rules: result });
                setConcepts([]);
                setDialog(null);
                setNotice(
                  "Permanent rules saved. Develop the next idea with these principles.",
                );
              }
            }}
          >
            Save principles <Icon name="check" />
          </button>
        </Modal>
      )}
      {dialog === "render" && (
        <Modal
          title={concepts.length > 1 ? "Make the series." : "Make the image."}
          close={() => !busy && setDialog(null)}
        >
          <p className="modal-intro">
            {concepts.length} {concepts.length === 1 ? "image" : "images"} ·{" "}
            {config?.imageModel}
            <br />
            {mode === "Refine"
              ? "Your selected reference will be uploaded for editing."
              : "Each concept will be rendered once."}
          </p>
          <div className="settings-grid">
            <label>
              Format
              <select
                value={settings.size}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    size: e.target.value as Settings["size"],
                  })
                }
              >
                <option value="1024x1024">Square · 1024 × 1024</option>
                <option value="1536x1024">Landscape · 1536 × 1024</option>
                <option value="1024x1536">Portrait · 1024 × 1536</option>
              </select>
            </label>
            <label>
              Quality
              <select
                value={settings.quality}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    quality: e.target.value as Settings["quality"],
                  })
                }
              >
                <option value="low">Low · quick studies</option>
                <option value="medium">Medium · balanced</option>
                <option value="high">High · finished works</option>
              </select>
            </label>
          </div>
          <div className="cost-note">
            <strong>Usage before you begin</strong>
            <p>
              {concepts.length} image{" "}
              {mode === "Refine" ? "editing" : "generation"} request
              {concepts.length > 1 ? "s" : ""} + {concepts.length} visual
              critique request{concepts.length > 1 ? "s" : ""}. Final charges
              depend on input and output tokens; a reliable total is not
              available before rendering. Reference edits add image input usage.
            </p>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://developers.openai.com/api/docs/guides/image-generation#pricing"
            >
              View OpenAI’s image pricing calculator ↗
            </a>
            <p className="hint">
              No automatic retries or regenerations. Actual image usage is saved
              with each work.
            </p>
          </div>
          <button className="primary full" disabled={locked} onClick={render}>
            {busy
              ? "Starting…"
              : `Generate ${concepts.length === 1 ? "1 image" : `${concepts.length} images`}`}
            <Icon name="arrow" />
          </button>
        </Modal>
      )}
      {dialog === "export" && exportArt && (
        <Modal title="Take the work with you." close={() => setDialog(null)}>
          <p className="modal-intro">{exportArt.concept.title}</p>
          <div className="export-options">
            {[
              ["png", "PNG", "Original artwork"],
              ["jpeg", "JPEG", "High quality · white background"],
              ["webp", "WebP", "Compact image"],
              ["txt", "Prompt .txt", "Exact submitted prompt"],
              ["json", "Metadata .json", "Settings, lineage, rules & critique"],
              ["zip", "Complete package", "PNG + prompt + metadata"],
            ].map(([format, title, subtitle]) => (
              <a
                key={format}
                href={`/api/artworks/${exportArt.id}/export?format=${format}`}
                download
              >
                <div>
                  <strong>{title}</strong>
                  <span>{subtitle}</span>
                </div>
                <Icon name="download" />
              </a>
            ))}
          </div>
          <div className="website-export">
            <span className="field-label">OPTIONAL / JMSN.ART HANDOFF</span>
            <p>
              {website?.message ??
                "Checking repository location and Git status…"}
            </p>
            {website?.found && (
              <>
                <code>{website.path}</code>
                <pre>{website.status}</pre>
                <a
                  className="text-button"
                  href={`/api/artworks/${exportArt.id}/export?format=website`}
                  download
                >
                  Download website package ↗
                </a>
              </>
            )}
          </div>
        </Modal>
      )}
      {dialog === "artwork" && selected && (
        <Modal
          title={selected.concept.title}
          close={() => setDialog(null)}
          wide
        >
          <div className="detail-grid">
            <img
              className="detail-art"
              src={selected.url}
              alt={selected.concept.title}
            />
            <div>
              <span className="eyebrow">
                NO. {String(selected.id).padStart(3, "0")} /{" "}
                {date(selected.createdAt)}
              </span>
              <h3>{selected.concept.strategy}</h3>
              <p>{selected.concept.interpretation}</p>
              <span className="field-label">THE MECHANISM</span>
              <p>{selected.concept.mechanism}</p>
              <span className="field-label">
                VISUAL CRITIQUE / {selected.critique.status}
              </span>
              <p>{selected.critique.summary}</p>
              {selected.critique.failures.length > 0 && (
                <ul>
                  {selected.critique.failures.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              <p>{selected.critique.nextStep}</p>
              <button
                className="text-button"
                disabled={locked || !config?.hasKey}
                onClick={async () => {
                  const result = await perform("Reviewing image", () =>
                    api<Artwork>(`/api/artworks/${selected.id}/critique`, {}),
                  );
                  if (result)
                    setArtworks((items) =>
                      items.map((x) => (x.id === result.id ? result : x)),
                    );
                }}
              >
                Retry critique · uses API ↗
              </button>
              <label className="field-label" htmlFor="tags">
                TAGS · COMMA SEPARATED
              </label>
              <input
                id="tags"
                key={selected.id + selected.tags.join(",")}
                defaultValue={selected.tags.join(", ")}
                disabled={locked}
                onBlur={(e) => {
                  const tags = [
                    ...new Set(
                      e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    ),
                  ];
                  if (JSON.stringify(tags) !== JSON.stringify(selected.tags))
                    patch(selected, { tags });
                }}
              />
              <dl className="art-metadata">
                <dt>Model</dt>
                <dd>{selected.model}</dd>
                <dt>Settings</dt>
                <dd>
                  {selected.settings.size} · {selected.settings.quality}
                </dd>
                <dt>Filename</dt>
                <dd>{selected.filename}</dd>
                {selected.parentId && (
                  <>
                    <dt>Parent</dt>
                    <dd>
                      <button onClick={() => setSelectedId(selected.parentId)}>
                        Study {selected.parentId} ↗
                      </button>
                    </dd>
                  </>
                )}
                {selected.seriesId && (
                  <>
                    <dt>Series</dt>
                    <dd>
                      {artworks
                        .filter((x) => x.seriesId === selected.seriesId)
                        .map((x) => (
                          <button
                            key={x.id}
                            onClick={() => setSelectedId(x.id)}
                          >
                            Study {x.id} ↗{" "}
                          </button>
                        ))}
                    </dd>
                  </>
                )}
              </dl>
              {artActions(selected, true)}
            </div>
          </div>
          <details className="detail-prompt">
            <summary>View the complete prompt & usage</summary>
            <pre className="saved-prompt">{selected.prompt}</pre>
            <pre>{JSON.stringify(selected.usage, null, 2)}</pre>
          </details>
        </Modal>
      )}
    </>
  );
}
