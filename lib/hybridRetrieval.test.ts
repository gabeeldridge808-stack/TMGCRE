import { describe, expect, it } from "vitest";
import { extractNumericTokens, fuseRankings, fuseRetrievedChunks } from "@/lib/hybridRetrieval";

describe("extractNumericTokens", () => {
  it("pulls percentages, dollar amounts, multiples, and plain numbers", () => {
    expect(extractNumericTokens("what's the going-in cap rate")).toEqual([]);
    expect(extractNumericTokens("is the cap rate 5.25%?")).toEqual(["5.25%"]);
    expect(extractNumericTokens("confirm purchase price is $1,200,000")).toEqual(["$1,200,000"]);
    expect(extractNumericTokens("is DSCR above 1.35x")).toEqual(["1.35x"]);
    expect(extractNumericTokens("are there 212 units")).toEqual(["212"]);
  });

  it("dedupes repeated tokens", () => {
    expect(extractNumericTokens("5.25% now, 5.25% later")).toEqual(["5.25%"]);
  });
});

describe("fuseRankings", () => {
  it("boosts an item that ranks well on both lists over one that ranks well on only one", () => {
    const fused = fuseRankings(["a", "b", "c"], ["b", "a", "d"], (x) => x);
    // "a" and "b" both appear near the top of both lists; "c" and "d" each
    // appear in only one list, so a/b should outrank them.
    expect(fused.slice(0, 2).sort()).toEqual(["a", "b"]);
  });
});

describe("fuseRetrievedChunks — disambiguating two similar-but-different figures", () => {
  // The exact scenario item 4 asks to guard against: a document with two
  // nearby, similar cap rates. Pure cosine similarity has no way to prefer
  // the chunk containing the specific figure asked about; this does.
  const goingInChunk = { content: "Going-in cap rate: 5.25%. This reflects in-place NOI at acquisition." };
  const exitChunk = { content: "Exit cap rate: 5.75%, assumed at a 50bps expansion over the hold period." };
  const unrelatedChunk = { content: "The property was built in 1998 and renovated in 2015." };

  it("puts the chunk containing the exact figure first, even if vector search ranked it lower", () => {
    // Vector search (semantically similar cap-rate language) ranks the wrong
    // chunk first -- both chunks discuss cap rates, so embeddings alone
    // can't tell 5.25% from 5.75% apart.
    const vectorRanked = [exitChunk, goingInChunk, unrelatedChunk];
    const keywordRanked = [unrelatedChunk];
    // The question names the specific figure, so it's an exact match.
    const exactMatches = [goingInChunk];

    const result = fuseRetrievedChunks(exactMatches, vectorRanked, keywordRanked, 2);

    expect(result[0]).toBe(goingInChunk);
  });

  it("falls back to vector+keyword fusion when no figure is named", () => {
    const result = fuseRetrievedChunks([], [goingInChunk, exitChunk], [exitChunk], 2);
    // exitChunk appears in both lists, goingInChunk only in one.
    expect(result[0]).toBe(exitChunk);
  });

  it("dedupes a chunk that appears in more than one input list", () => {
    const result = fuseRetrievedChunks([goingInChunk], [goingInChunk, exitChunk], [goingInChunk], 5);
    expect(result.filter((c) => c === goingInChunk)).toHaveLength(1);
  });

  it("never exceeds the requested limit", () => {
    const result = fuseRetrievedChunks([goingInChunk], [exitChunk], [unrelatedChunk], 2);
    expect(result).toHaveLength(2);
  });
});
