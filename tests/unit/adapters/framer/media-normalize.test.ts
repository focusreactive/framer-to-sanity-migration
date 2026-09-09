import { framerMediaNormalizer } from "#adapters/framer/media-normalize.ts";

const ORIGINAL = "https://framerusercontent.com/images/0LKC1Ii8jJl4rPH5OY56H6z4PUg.png";

describe("framerMediaNormalizer", () => {
  it("drops the intrinsic size query from an original", () => {
    expect(framerMediaNormalizer.canonicalize(`${ORIGINAL}?width=1024&height=683`).canonicalUrl).toBe(ORIGINAL);
  });

  it("folds every scale-down variant onto the same original", () => {
    for (const width of [512, 1024, 2048]) {
      const variant = `${ORIGINAL}?scale-down-to=${width}&width=1024&height=683`;
      expect(framerMediaNormalizer.canonicalize(variant).canonicalUrl).toBe(ORIGINAL);
    }
  });

  it("reports a scale-down url as a variant and a bare original as not", () => {
    expect(framerMediaNormalizer.isVariant(`${ORIGINAL}?scale-down-to=512&width=1024&height=683`)).toBe(true);
    expect(framerMediaNormalizer.isVariant(`${ORIGINAL}?width=1024&height=683`)).toBe(false);
    expect(framerMediaNormalizer.isVariant(ORIGINAL)).toBe(false);
  });

  it("takes the opaque id as the platform id and reports no original name", () => {
    const asset = framerMediaNormalizer.canonicalize(`${ORIGINAL}?width=1024&height=683`);
    expect(asset.platformId).toBe("0LKC1Ii8jJl4rPH5OY56H6z4PUg");
    expect(asset.originalName).toBeUndefined();
  });

  it("names a file from the id and its extension", () => {
    expect(framerMediaNormalizer.fileName(ORIGINAL)).toBe("0LKC1Ii8jJl4rPH5OY56H6z4PUg.png");
  });

  it("canonicalizes non-image assets and fonts under the assets path", () => {
    const mp4 = "https://framerusercontent.com/assets/j1ne28j01baprXTTpeA5CCz4.mp4";
    const woff = "https://framerusercontent.com/assets/F3kdpd2N0cToWV5huaZjjgM.woff2";
    expect(framerMediaNormalizer.canonicalize(mp4).canonicalUrl).toBe(mp4);
    expect(framerMediaNormalizer.fileName(woff)).toBe("F3kdpd2N0cToWV5huaZjjgM.woff2");
  });

  it("leaves a url from another origin untouched", () => {
    const foreign = "https://images.example.com/hero.png?width=100";
    expect(framerMediaNormalizer.canonicalize(foreign).canonicalUrl).toBe(foreign);
    expect(framerMediaNormalizer.isVariant(foreign)).toBe(false);
  });
});
