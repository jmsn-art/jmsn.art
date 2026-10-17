import test from "node:test";
import assert from "node:assert/strict";
import { drawIdeas, ideaDeck } from "../src/idea-deck.js";

test("idea deck deals distinct cards and preserves its catalog", () => {
  const original = [...ideaDeck];
  const dealt = drawIdeas(4, () => 0);
  assert.equal(dealt.length, 4);
  assert.equal(new Set(dealt.map((x) => x.subject)).size, 4);
  assert.deepEqual(ideaDeck, original);
});

test("category filtering, count boundaries and one meaningful gap", () => {
  assert.equal(drawIdeas(0).length, 0);
  assert.equal(drawIdeas(100).length, ideaDeck.length);
  for (const category of ["architecture", "living form", "material", "light & space"] as const) {
    const cards = drawIdeas(4, () => 0.5, category);
    assert.equal(cards.length, 4);
    assert.ok(cards.every((x) => x.category === category && x.gap && x.direction));
  }
});
