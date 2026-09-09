import { assertNoIdCollisions, documentId } from "#generate/deliverable/seed/doc-id.ts";

describe("documentId", () => {
  it("is stable for the same type and slug", () => {
    expect(documentId("post", "hello-world")).toBe(documentId("post", "hello-world"));
  });

  it("differs across types for the same slug", () => {
    expect(documentId("post", "about")).not.toBe(documentId("page", "about"));
  });
});

describe("assertNoIdCollisions", () => {
  it("throws naming both documents when two share an id", () => {
    const id = documentId("post", "dup");
    expect(() =>
      assertNoIdCollisions([
        { id, type: "post", slug: "dup" },
        { id, type: "post", slug: "dup" },
      ]),
    ).toThrow(/dup/);
  });

  it("accepts a set with no duplicates", () => {
    expect(() =>
      assertNoIdCollisions([
        { id: documentId("post", "a"), type: "post", slug: "a" },
        { id: documentId("post", "b"), type: "post", slug: "b" },
      ]),
    ).not.toThrow();
  });
});
