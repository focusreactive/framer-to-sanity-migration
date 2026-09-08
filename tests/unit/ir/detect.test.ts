import { detectArtifact, detectDataSchema, platformHintsSchema, type DetectData } from "#ir/detect.ts";

const validData: DetectData = {
  verdict: "framer",
  scores: {
    framer: {
      score: 12,
      hasTier1Strong: true,
      signals: [
        {
          id: "framer-data-attr",
          tier: "strong",
          evidence: 'data-framer-site="abc123"',
        },
      ],
    },
  },
  thresholds: { confidence: 8 },
  platformHints: {
    framerSiteId: "5f9b3c1e2a1b2c3d4e5f6789",
    searchIndexUrl: "https://example.com/search-index.json",
  },
};

describe("detectDataSchema", () => {
  it("parses a valid DetectData object", () => {
    expect(detectDataSchema.parse(validData)).toEqual(validData);
  });

  it("round-trips through JSON", () => {
    const roundTripped = detectDataSchema.parse(JSON.parse(JSON.stringify(validData)));

    expect(roundTripped).toEqual(validData);
  });

  it("rejects an unknown key at the top level", () => {
    expect(() => detectDataSchema.parse({ ...validData, extra: "nope" })).toThrow();
  });

  it("rejects an unknown key on a nested strictObject (platformHints)", () => {
    expect(() =>
      detectDataSchema.parse({
        ...validData,
        platformHints: { ...validData.platformHints, bogus: "nope" },
      }),
    ).toThrow();
  });

  it("allows platformHints with no optional fields set", () => {
    expect(() => detectDataSchema.parse({ ...validData, platformHints: {} })).not.toThrow();
  });

  it("rejects a hint key that belongs to another platform", () => {
    expect(() => platformHintsSchema.parse({ webflowSiteId: "abc" })).toThrow();
  });
});

describe("detectArtifact", () => {
  it("matches the ArtifactDef contract for the detect kind", () => {
    expect(detectArtifact.kind).toBe("detect");
    expect(detectArtifact.relativePath).toBe("detect.json");
    expect(detectArtifact.schemaVersion).toBe(1);
    expect(detectArtifact.dataSchema).toBe(detectDataSchema);
  });
});
