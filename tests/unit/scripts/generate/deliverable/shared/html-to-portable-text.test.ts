import { describe, expect, it } from "vitest";

import { htmlToPortableText } from "#generate/deliverable/shared/html-to-portable-text.ts";
import { richTextTagsUsed } from "#synth/utils/richtext/tags-used.ts";

const noImages = { resolveImage: () => undefined };

describe("htmlToPortableText", () => {
  it("converts a heading and a paragraph into blocks with their styles", () => {
    const blocks = htmlToPortableText("<h2>Title</h2><p>Body copy</p>", noImages);
    expect(blocks.map((b) => b.style)).toEqual(["h2", "normal"]);
  });

  it("keeps a link as a mark definition rather than dropping it", () => {
    const blocks = htmlToPortableText('<p>see <a href="https://example.com/">this</a></p>', noImages);
    expect(JSON.stringify(blocks)).toContain("https://example.com/");
  });

  it("assigns deterministic keys so two runs of the same html are byte-identical", () => {
    const html = "<p>stable</p>";
    expect(htmlToPortableText(html, noImages)).toEqual(htmlToPortableText(html, noImages));
  });

  it("resolves an inline image to the ref the resolver returns", () => {
    const blocks = htmlToPortableText('<p><img src="https://cdn.example.com/a.png"></p>', {
      resolveImage: () => "image-abc-0x0-png",
    });
    expect(JSON.stringify(blocks)).toContain("image-abc-0x0-png");
  });

  it("drops an inline image whose asset never resolved rather than emitting a dangling ref", () => {
    const blocks = htmlToPortableText('<p><img src="https://cdn.example.com/a.png"></p>', noImages);
    expect(blocks.some((block) => block._type === "image")).toBe(false);
  });
});

describe("richTextTagsUsed", () => {
  it("reads tags out of a portable text array", () => {
    const blocks = htmlToPortableText("<h2>Title</h2><p>Body <strong>copy</strong></p>", noImages);
    expect(richTextTagsUsed(blocks)).toContain("h2");
    expect(richTextTagsUsed(blocks)).toContain("strong");
  });

  it("returns an empty list for a value that is not portable text", () => {
    expect(richTextTagsUsed({ root: {} })).toEqual([]);
  });

  it("reads a list block as its container tag and its item tag", () => {
    expect(richTextTagsUsed(htmlToPortableText("<ul><li>One</li></ul>", noImages))).toEqual(["li", "ul"]);
  });

  it("reads a link annotation as an anchor tag", () => {
    const blocks = htmlToPortableText('<p>see <a href="https://example.com/">this</a></p>', noImages);
    expect(richTextTagsUsed(blocks)).toContain("a");
  });
});
