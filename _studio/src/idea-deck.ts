// Curated Art Circle starting points. Each describes a physical reason for one opening,
// not a broken-ring graphic imposed on an unrelated subject.
export type Idea = {
  subject: string;
  category: "architecture" | "living form" | "material" | "light & space";
  gap: string;
  direction: string;
};

export const ideaDeck: readonly Idea[] = [
  { subject: "desert motel around an empty courtyard", category: "architecture", gap: "One room was never built; the missing bay opens the court to the desert.", direction: "Distant aerial oblique view; let the absent room, not a drawn outline, define the opening." },
  { subject: "spiral staircase inside an abandoned tower", category: "architecture", gap: "A collapsed landing interrupts the return of the stair around its central void.", direction: "View from below with the broken landing high and off-center; emphasize structural weight." },
  { subject: "flooded greenhouse", category: "architecture", gap: "One fallen glass wall lets the reflected enclosure spill into the exterior.", direction: "Low waterline perspective; make the glass and its reflection jointly imply the form." },
  { subject: "an unfinished stone amphitheater", category: "architecture", gap: "One unfinished seating section leaves a passage toward the landscape.", direction: "Wide horizontal crop; small structure, immense terrain; avoid a perfect semicircle." },
  { subject: "bonsai root growing around a buried stone", category: "living form", gap: "A root lifts clear where the stone resists its growth, leaving one pocket of daylight.", direction: "Macro view of age and tension; no decorative halo around the plant." },
  { subject: "kelp forest in a tidal current", category: "living form", gap: "The current pulls one frond out of a returning tangle, opening a single channel.", direction: "Underwater side view; make the opening useful to a passing fish." },
  { subject: "foxhound curled beside a doorway", category: "living form", gap: "The curled body almost encloses a patch of floor; its lifted head leaves one opening toward the door.", direction: "Quiet domestic light; show anatomy and negative space, not a ring behind the dog." },
  { subject: "tree grown around a vanished fence post", category: "living form", gap: "The trunk has nearly grown around the post's absence, but one split exposes the void.", direction: "Close crop on bark and weather; the missing object should be legible through its imprint." },
  { subject: "folded sheet of handmade paper", category: "material", gap: "The last flap refuses to tuck into the first fold, leaving the interior exposed.", direction: "Sculptural side light, small irregular form in broad negative space." },
  { subject: "cast glass vessel cooling in a kiln", category: "material", gap: "A cooling fracture stops the vessel from sealing its own hollow.", direction: "Asymmetric thick glass; let refraction expose one real fracture, not many cracks." },
  { subject: "rusted steel wall under torsion", category: "material", gap: "The steel springs away from its starting plane, leaving a human-scale entrance.", direction: "Oblique ground-level view; the entrance should look physically necessary." },
  { subject: "stitched quilt draped across two chairs", category: "material", gap: "A single unfinished seam allows the fabric's enclosed pocket to open.", direction: "Tactile thread and sagging weight; keep the gap visibly in the construction." },
  { subject: "sunlight crossing a stairwell", category: "light & space", gap: "A stair's shadow nearly bounds a bright void until one open doorway cuts the projection.", direction: "Restrained architecture; let light and shadow, rather than an object, perform closure." },
  { subject: "mist trapped in a quarry", category: "light & space", gap: "A single windward cut in the quarry wall releases the mist's near-enclosure.", direction: "High distant view; one legible escape route and no graphic contour." },
  { subject: "reflection under a railway bridge", category: "light & space", gap: "A passing train interrupts the bridge-and-water reflection at one point.", direction: "Off-axis composition; the reflected architecture should almost join itself." },
  { subject: "moonlight through a ruined observatory", category: "light & space", gap: "A missing roof panel breaks the chamber's light boundary and opens it to the sky.", direction: "Keep the architecture imperfect and the missing panel unmistakable." },
];

// Fisher-Yates on a copy: callers can request new cards without mutating the catalog.
export function drawIdeas(count: number, random: () => number = Math.random, category?: Idea["category"]): Idea[] {
  const copy = ideaDeck.filter((idea) => !category || idea.category === category);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(0, Math.min(copy.length, Math.floor(count))));
}
