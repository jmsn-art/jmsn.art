# jmsn.art integration — unlisted studio

The studio is an **unlisted `/studio/` page**. Existing website pages, links, navigation, and sitemap are unchanged. Its HTML requests `noindex,nofollow,noarchive`. This is an unlisted URL, not password-protected access; anyone who knows the URL can open it after you publish.

Two builds share the same interface:

- **`studio/` — static website:** works on GitHub Pages with no API key. Develop Explore/Series/Material concepts, edit/download/copy prompts, and upload references for Refine sketches. Drafts persist in localStorage; principles and reference images persist in IndexedDB on this browser/origin. No OpenAI requests or automatic connections to localhost. Reference images are not visually analyzed in this mode. Clearing site data removes these drafts/references. Rendering and the generated-image archive require the local companion.
- **`_studio/` — source and local companion:** the original full image-generation/editing/critique application and SQLite archive. Jekyll excludes this underscore directory by default. Keys, dependencies, database, and generated local artwork are also Git-ignored. The local server blocks direct static access to this source directory, including encoded path variants.

## Work in this repository

From the `jmsn.art` root:

```sh
cd _studio
npm install
npm run build:all
npm start
# http://127.0.0.1:4317/studio/
```

API configuration can wait. For later setup, copy `_studio/.env.example` to `_studio/.env.local`, set `OPENAI_API_KEY`, and restart. No key should be entered into the published website.

To rebuild only the publishable static page: `npm run build:site` from `_studio`. To preview the exact static site without a backend: `npm run preview:site`, then open `http://127.0.0.1:4319/studio/`. For development with the companion backend: `npm run dev`.

Browser drafts and the companion’s filesystem archive are separate. Download a prompt or rules JSON to transfer it, and upload the reference again in the companion. Existing standalone artwork can be migrated by stopping both servers and copying the entire original `data/` directory into `_studio/data/`; the integration does not move or overwrite any existing archive automatically.

Nothing was deployed, committed, or pushed by this integration. Publishing requires a separate explicit action. No links to the studio have been added elsewhere on the website.

---

# JMSN Art Circle Studio

A local studio and archive for Jameson McShane’s Art Circle practice. **The subject itself becomes the Art Circle: it tries to close and fails once.**

## Launch

Requires Node.js **22.13 or newer** and npm. Node 22 may print an experimental SQLite warning; this is expected.

```sh
npm install
cp .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY=your-key
npm run dev
```

Open **http://127.0.0.1:4317/studio/**. The application binds only to loopback. On this Mac, dependencies are already installed. You can also double-click `Start Studio.command` after setting up the key.

For a production build:

```sh
npm run build
npm start
```

Stop with Control-C. Restart after changing `.env.local`. To change the port, set `PORT=4319`. If a port is in use, stop the old studio process or choose another port. Run one studio process per data directory.

Without a key, local concept sketches, editable principles, and any existing archive remain usable. Generation, reference-aware AI planning, and visual critique need a funded API account with access to the configured models. No key is bundled. Your ChatGPT subscription is separate from API billing.

## Working in the studio

1. Enter a subject, artist, material, or idea, or choose one of the seed examples under **Ways in**.
2. Select **Develop the idea**. With a key, this uses the text/vision model. Without one, it uses labeled local vocabulary sketches.
3. Open the **Prompt inspector**. Review the interpretation, mechanism, composition, and image prompt. Edit the prompt before rendering. For a series, review each numbered concept tab.
4. Select **Generate image**. The review dialog displays the image count, model, resolution, quality, expected request count, and a link to current pricing. Nothing is rendered until you confirm this step.
5. The image is saved locally, then visually critiqued. **Push Further** develops a new prompt from the core idea and critique. It does not silently spend on a new render.

**Explore** produces one interpretation. **Material** lets material behavior determine the interruption. **Series** produces 2–4 structurally distinct interpretations (default 3), each with its own editable prompt. **Refine** sends an existing image to the image edits endpoint; select Edit on an archived work or upload a PNG, JPEG, or WebP reference up to 20 MB. References are orientation-corrected and resized within 2048×2048 for predictable input size. Preservation controls are prompt constraints, not exact pixel locks. Use the creative-direction field to specify where to move the gap, the new material, or the desired scale.

Use the archive to search subjects, titles, and tags; favorite works; view series; and inspect lineage and critique. Tags save when the tag field loses focus. Rejection is reversible and moves a work to the Rejected filter. There is deliberately no destructive image deletion action in v1.

Select the comparison icon on **2–4 works**, then **View together**. Each comparison includes favorite, reject/restore, regenerate, edit, copy prompt, export, and promote-to-series actions.

## Architecture and source map

React + TypeScript, built with Vite, and a small Express server. Vite runs as development middleware, so there is only one browser origin and one command to launch. Production serves the compiled React client from the same server. This is simpler for a single-user local studio than a full server-rendered framework.

- `src/App.tsx` — studio modes, inspector, gallery, comparison, setup, rules, and export dialogs.
- `src/styles.css` — responsive gallery styling, dark/light themes, keyboard focus, reduced motion.
- `src/types.ts` — shared image, concept, critique, rules, and job types.
- `server/index.ts` — environment loading, loopback server, dev/production hosting.
- `server/app.ts` — validated API routes, uploads, generation jobs, critique, exports, and read-only website inspection.
- `server/concepts.ts` — permanent creative pipeline instructions, local vocabulary fallback, seed artists/materials, and composition variation.
- `server/openai.ts` — native `fetch` calls to OpenAI Responses and Images APIs. No extra SDK or cloud infrastructure.
- `server/store.ts` — Node’s built-in SQLite, local storage, readable filenames, and restart recovery.
- `art-circle-rules.json` — editable permanent principles.
- `.env.example` — server-only API key and model configuration.
- `tests/studio.test.ts` — integration tests using an isolated local mock API.
- `tests/preview-fixture.ts` — optional isolated browser QA server; fixture images are explicitly labeled and never enter the real archive.

The database uses SQLite WAL mode. Sharp validates reference files and converts exports; fflate assembles portable ZIP packages. Zod validates requests. There is no authentication service, cloud database, Docker, analytics, or remote asset dependency.

## Archive and backups

By default, the archive lives alongside the source:

```text
data/
  studio.sqlite          # Image metadata, lineage, tags, flags, jobs, references
  studio.sqlite-wal      # SQLite working state while the server is running
  studio.sqlite-shm
  images/                # Original generated PNGs, with readable dated filenames
  thumbnails/            # WebP previews
  references/            # Validated local copies of uploaded reference images
```

Set `STUDIO_DATA_DIR=/absolute/path` to move the archive location before starting. Existing files are not automatically migrated. To move or back up an archive, stop the server and copy the **whole data directory**, along with `art-circle-rules.json`. Keep `.env.local` private and back it up separately if desired. Do not copy only `studio.sqlite` while the server is running; pending transactions can be in its WAL.

Each generated image keeps its date/time, original input, final submitted prompt, conceptual interpretation, mechanism, composition, image model, settings, parent/reference ID, critique, tags, favorite/rejected status, series ID, actual image API usage, and a snapshot of the rules. Names look like `2026-09-20_georgia-okeeffe-vegetation_001.png`; sequence numbers persist across restarts. Dates in filenames use UTC; displayed dates use your browser’s locale.

The archive begins empty. Test fixtures and successful mocked calls are **not** real artwork.

## How the prompts work

The planner interprets the subject’s visual vocabulary, material, environment, scale, emotional register, and medium; identifies a latent closure with exactly one meaningful interruption; chooses a strategy; and specifies composition, placement, crop, and gap position. In series mode, it is instructed to produce different underlying mechanisms, not alternate ring placements.

Artist references are translated into descriptive formal/material vocabulary before the render prompt. The planner is instructed to omit artist names, famous-work quotations, and stock motifs. Local sketches include specific vocabulary for the seed artists and materials and deliberately varied compositions; these are more limited than AI planning and are labeled accordingly.

OpenAI planning uses structured JSON output. The image endpoint gets your reviewed prompt **plus the current permanent rules**. Refine adds preservation constraints and sends actual reference pixels as multipart input. Critique sends the rendered image to a vision-capable text model and asks for evidence of one-gap compliance, pasted-ring failures, solid disks, unwanted text, clichés, and repetitive composition. Verdicts can be pass, revise, or uncertain.

Edit permanent principles in the studio’s **Read & edit the principles** dialog, or edit `art-circle-rules.json` directly. No restart is needed for rules. Changing rules in the UI invalidates the current concept draft; previously archived works retain their historical rule snapshot. These are creative instructions, not a mathematical guarantee that the generator will obey them.

## API configuration and costs

The default image model is `gpt-image-2.5-sunburst`; the default planning/critique model is `gpt-4.1-mini`. Both are configurable in `.env.local`. Image requests use `POST /v1/images/generations` or `POST /v1/images/edits`, one image at a time. Planning and critique use `POST /v1/responses` with `store: false`.

The image defaults follow the [official image-generation guide](https://developers.openai.com/api/docs/guides/image-generation) and [GPT Image 2.5 Sunburst model page](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst), checked September 19, 2026. Model access depends on your account; organization verification may be required. Do not assume aliases will be available forever—change the configuration if OpenAI retires one.

One concept development uses one text request (plus reference image input in Refine). Rendering N works uses N image requests and N visual critiques. Retry critique makes another text/vision call. No render runs automatically after a critique. Pricing varies with token consumption, size, quality, and reference input, so v1 shows request counts and links the official calculator rather than inventing a dollar total. Image token usage is stored in metadata; planner/critique token totals and billing reconciliation are not tracked in v1.

Paid requests are **never automatically retried**. If the service times out after accepting a request, the charge may be uncertain; inspect your API usage before retrying. If a batch fails midway, completed works remain. If critique fails, the image remains and the critique is marked unavailable. On restart, unfinished jobs are marked interrupted, not silently resumed. Retry critique from an image’s detail inspector.

## Export and jmsn.art

Export PNG originals, JPEG, WebP, exact prompt `.txt`, metadata `.json`, or a ZIP containing PNG + prompt + metadata. JPEG/WebP use high-quality encoding and a white background where needed. Metadata includes local creative history but never the API key.

For the optional website handoff, configure `JMSN_ART_PATH` or let the studio check common local `jmsn.art` locations. It verifies the directory using `git rev-parse` and reads `git status --short --branch` before offering or creating the handoff. **It only downloads a ZIP with a handoff note. It never writes into, commits, or publishes jmsn.art.** Website integration and publishing remain separate explicit work.

During this build, `/Users/jmsn/Documents/jmsn.art` was found and its working tree was clean on `agent/fix-dream-room`. That observation is not a promise about its later status; the app checks again at export time.

## Verification

```sh
npm test
npm run build
```

Tests cover artist-vocabulary translation and series diversity; missing-key behavior; rule persistence; request validation; Origin/Host protections; invalid reference rejection; generated-image storage; actual-image critique request payloads; all export formats; favorites/tags/rejection; SQLite reopening; reference and parent-image edits; partial batch failures without retries; critique failures; and interrupted-job recovery.

For manual UI testing without charges, after building:

```sh
npx tsx tests/preview-fixture.ts
# Open http://127.0.0.1:4318/studio/
```

This separate test server uses temporary storage and an in-process mock service. It labels all images as test fixtures and cleans its temporary directory on Control-C. Never treat it as an image-generation demo.

## V1 limits

- Live OpenAI generation was not exercised during the initial build because no API key was configured. API integration and end-to-end UI behavior were verified with a local mock; real image quality, account access, billing, and model behavior still need a first live run.
- Visual critique is fallible; the artist makes the final judgment. Preservation controls do not guarantee exact pixels. No region masks or brush editor yet.
- Local-only **storage**, not offline AI: generation, AI planning, and critique require the network. The server stores files unencrypted under your OS account permissions.
- One active generation job per server; one server per archive directory. No account system, multi-user support, cloud sync, background OS service, or publishing.
- Prompt drafts and comparison selection are session state; generated artwork and metadata persist. Large archives currently load metadata as one list; gallery images use thumbnails and lazy loading.
- v1 exports the artwork and metadata together, but not uploaded reference binaries in the ZIP. Back up the complete data directory to preserve those.
