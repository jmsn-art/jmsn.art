import type { Concept, Rules } from "../src/types.js";

export const conceptFieldLimits = {
  title: 200,
  interpretation: 8000,
  mechanism: 8000,
  strategy: 200,
  composition: 2000,
  prompt: 16000,
} as const;

export function normalizeConceptFields<T extends Record<string, unknown>>(
  input: T,
): T {
  const concept: Record<string, unknown> = { ...input };
  for (const [key, limit] of Object.entries(conceptFieldLimits)) {
    const raw = concept[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    concept[key] = value.length <= limit
      ? value
      : `${value.slice(0, limit - 1).trimEnd()}…`;
  }
  return concept as T;
}

export const examples = [
  {
    subject: "Georgia O’Keeffe",
    hint: "The flower itself becomes the Art Circle",
  },
  { subject: "Francis Bacon", hint: "A body curls toward closure" },
  { subject: "Olafur Eliasson", hint: "Mist, light, and reflection" },
  { subject: "Joseph Cornell", hint: "A broken orbit of found objects" },
  { subject: "David Hockney", hint: "Pool, water, swimmer, reflection" },
  {
    subject: "Christo and Jeanne-Claude",
    hint: "Wrapped landscape with one opening",
  },
  { subject: "Rachel Whiteread", hint: "Cast the negative space" },
  { subject: "Alexander Calder", hint: "Mobile elements imply an orbit" },
  { subject: "Yayoi Kusama", hint: "Repetition with one conspicuous absence" },
  { subject: "James Turrell", hint: "A perceived aperture of light" },
  { subject: "Richard Serra", hint: "Steel architecture leaves a passage" },
  { subject: "Anish Kapoor", hint: "Void, reflection, concavity" },
  {
    subject: "Georgia O’Keeffe — botanical anatomy",
    hint: "A botanical form whose anatomy becomes the circle",
  },
  { subject: "abandoned motel", hint: "Architecture holds a single absence" },
  { subject: "Mona Lisa", hint: "Figure, landscape, garment, and light" },
];
export const materials = [
  "marble",
  "rusted steel",
  "fluorescent light",
  "beeswax",
  "dead leaves",
  "water",
  "smoke",
  "neon",
  "glass",
  "concrete",
  "stitched fabric",
  "flowers",
  "stone",
  "mirrors",
  "paper",
  "earth",
  "bronze",
];
const vocabularies: [RegExp, string, string, string][] = [
  [
    /okeeffe|o.keeffe|flower|botan/i,
    "enlarged botanical anatomy, luminous petal planes, subtle tonal transitions and intimate organic space",
    "vegetation",
    "A single continuous petal folds inward around its own hollow; one unfurled lip prevents the living anatomy from joining.",
  ],
  [
    /bacon|body|figure/i,
    "compressed bodily gesture, smeared flesh tones, tense spatial enclosure and visceral painted surface",
    "body",
    "A curled body almost touches its own shoulder; one interval of air between skin surfaces is the only interruption.",
  ],
  [
    /eliasson|mist|smoke/i,
    "volumetric atmosphere, refracted light, perceptual ambiguity and environmental scale",
    "atmosphere",
    "A continuous eddy of illuminated vapor almost reconnects; a single dry cross-current makes one dark interval.",
  ],
  [
    /cornell|found object/i,
    "intimate compartmented space, weathered found objects, tender estrangement and archival patina",
    "objects",
    "Interlocking found fragments follow an eccentric orbit inside a shallow box, with exactly one absent connecting fragment.",
  ],
  [
    /hockney|pool|swimmer/i,
    "flattened spatial planes, saturated cool water, crisp sunlit edges and fractured reflections",
    "water",
    "The pool’s reflected edge and a swimmer’s wake form one continuous near-enclosure, interrupted once where the swimmer surfaces.",
  ],
  [
    /christo|fabric|stitched/i,
    "tensioned cloth, topographic volume, seams and monumental temporary intervention",
    "fabric",
    "One stretched seam travels around a wrapped landform, stopping short at a single unstitched passage.",
  ],
  [
    /whiteread|negative space/i,
    "pale cast surfaces, absent domestic interiors, quiet weight and architectural memory",
    "negative space",
    "A cast of the void around a former staircase nearly encloses an absent room; one doorway remains uncast.",
  ],
  [
    /calder|mobile/i,
    "suspended asymmetry, counterweight, delicate balance and changing projected relationships",
    "movement",
    "Touching shadow projections from suspended counterweights collectively trace one irregular orbit, with one interval unbridged.",
  ],
  [
    /kusama|dots|repetition/i,
    "immersive repetition, accumulative fields, figure-ground instability and rhythmic scale",
    "absence",
    "A dense continuous chain of repeated organic units bends back toward itself; one missing unit interrupts the enclosing rhythm.",
  ],
  [
    /turrell|neon|fluorescent|light/i,
    "perceived color depth, luminous spatial thresholds, soft optical edges and silent immersive scale",
    "light",
    "Light washes the perimeter of an irregular architectural recess; one occluding edge interrupts its perceived closure.",
  ],
  [
    /serra|steel/i,
    "weathered heavy metal, bodily passage, torque, industrial weight and compressed perspective",
    "architecture",
    "A folded steel wall returns toward its starting plane, leaving one narrow entrance shaped by the metal’s springback.",
  ],
  [
    /kapoor|mirror/i,
    "concave volume, polished reflections, unstable depth, pigment and spatial void",
    "reflection",
    "A concavity turns its surroundings into a returning reflection; one unpolished fracture interrupts the optical enclosure.",
  ],
  [
    /basquiat/i,
    "layered abrasion, rhythmic marks, raw chromatic collisions and compressed spatial energy; no crowns, skulls or handwriting",
    "gesture",
    "One insistent painted gesture returns toward its beginning through scraped color strata; one exposed ground interval prevents closure.",
  ],
  [
    /dal[ií]/i,
    "precise illusionistic space, dislocated scale, uncanny material transformation and long shadows; no melting clocks",
    "shadow",
    "An impossible folded terrain casts a shadow almost enclosing its source, interrupted once at the horizon.",
  ],
  [
    /mona lisa/i,
    "restrained half-length portraiture, smoky tonal modeling, folded hands and distant winding topography",
    "figure",
    "The silhouette of a turning figure and its folded sleeve nearly encloses a pocket of background; one interval at the hands opens it.",
  ],
  [
    /motel|architecture|building/i,
    "weathered architectural repetition, deserted thresholds and the memory of human occupancy",
    "architecture",
    "A continuous run of rooms folds around a deserted courtyard; exactly one missing bay opens the enclosure to the landscape.",
  ],
  [
    /bronze|marble|stone|sculpture|concrete/i,
    "material mass, worked surface, gravitational tension, irregular section and sculptural negative space",
    "sculpture",
    "A load-bearing folded mass nearly returns to its own base, but one structurally meaningful fracture leaves an open seam.",
  ],
  [
    /wax|beeswax/i,
    "translucent amber strata, softness, pooled edges and residual warmth",
    "material",
    "One ribbon of cooled wax folds around a hollow; its final warm edge slumps away from the join, leaving one melt opening.",
  ],
  [
    /water/i,
    "fluid continuity, surface tension, reflected sky and transient movement",
    "water",
    "A single returning current encloses still water except where one spillway draws the flow away.",
  ],
  [
    /leaves|earth|vegetation/i,
    "seasonal accumulation, damp soil, organic decay and uneven terrain",
    "erosion",
    "An unbroken bank of accumulated matter follows a hollow’s edge; one eroded channel releases its enclosure.",
  ],
  [
    /paper/i,
    "creased fiber, matte translucency, folds and delicate self-supporting planes",
    "fold",
    "A single folded sheet returns toward its beginning; one untucked flap keeps the paper’s interior open.",
  ],
  [
    /glass/i,
    "cast translucency, refractive thickness, tension and mineral color",
    "material",
    "A folded glass membrane nearly joins itself; one cooling split exposes the air held within.",
  ],
];
const compositions = [
  "Tiny and low in a wide field of unoccupied space; gap on the upper-left return",
  "Monumental and cropped at the left edge; visible gap in the lower-right quadrant",
  "Elongated horizontally, off-axis in the upper third; gap on the far left",
  "Vertical and narrow, viewed obliquely from below; gap high on the right",
  "Asymmetric close-up with a shallow diagonal depth; gap at the bottom",
  "Environmental scale, far from the viewer, right of center; gap facing the horizon",
];
export const strategies = [
  "anatomy / structure",
  "negative space",
  "light and shadow",
  "material behavior",
];
export function rulesText(rules: Rules) {
  return [rules.principle, ...rules.rules.map((x) => `• ${x}`)].join("\n");
}
export function localConcepts(
  input: string,
  count: number,
  direction: string,
  rules: Rules,
): Concept[] {
  const match = vocabularies.find(([rx]) => rx.test(input));
  const vocabulary =
    match?.[1] ??
    `the characteristic surfaces, physical structure, setting, scale and emotional register of ${input}`;
  const mechanism =
    match?.[3] ??
    `The defining structure of ${input} returns toward its own origin, with one material-specific interruption that leaves the enclosure incomplete.`;
  const offset = Math.floor(Math.random() * compositions.length);
  return Array.from({ length: count }, (_, i) => {
    const subject = match ? vocabulary : input;
    const mechanismVariants = [
      mechanism,
      `The negative space held by ${subject} almost encloses itself; one passage through its boundary lets the surrounding space enter.`,
      `The connected shadows and reflections native to ${subject} imply a returning enclosure, interrupted once where light escapes.`,
      `The material of ${subject} bends, grows or accumulates toward its own beginning; one stress point prevents the final joining.`,
    ];
    const strategy = count === 1 ? (match?.[2] ?? "structure") : strategies[i];
    const interpretation = `Explore ${vocabulary}. Find an incomplete enclosure already possible in this subject’s world. ${direction ? `Direction: ${direction}.` : ""}`;
    const composition = compositions[(offset + i) % compositions.length];
    const selected = mechanismVariants[i];
    return {
      title: `${input.split("—")[0].trim()} · ${strategy}`,
      interpretation,
      mechanism: selected,
      strategy,
      composition,
      source: "local",
      prompt: `Create an original artwork using ${vocabulary}. ${selected} ${composition}. ${direction ? `Creative direction: ${direction}.` : ""} Exactly one meaningful interruption; the subject itself performs the closure. No added ring, no solid disk, no text or familiar artist symbols. ${rulesText(rules)}`,
    };
  });
}
export const plannerInstructions = `You are the conceptual collaborator in Jameson McShane’s Art Circle practice. Your central question is: What would an Art Circle be in this subject’s world? Interpret visual vocabulary, material, environment, scale, emotion and medium. Find how the subject itself tries to close and fails exactly once. The gap must be a meaningful event. Never paste a broken ring onto an unrelated scene. Avoid solid disks, generic C shapes and repeated centered compositions. Choose a mechanism and a composition with explicit scale, crop, orientation, placement and gap position. Artists are research vocabulary, not style-copy requests: translate them into descriptive material, formal and conceptual language BEFORE image generation. Do not include artist names or famous-work titles in the final prompt. Avoid cliché symbols or unnecessary text. If the source is an artwork title, reimagine its figure, space or material rather than duplicating it. In a series make structurally DISTINCT ideas, not variations of one ring: negative space, figure, topology, architecture, fabric, light. Respond with concise concrete visual instructions. When editing, respect preservation constraints and refer to the attached image. Critique feedback is evidence to improve the idea, not a request for additional gaps. Rules below always apply.`;
