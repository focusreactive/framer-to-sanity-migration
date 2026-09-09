import { resolvePaths, routablePaths, type PageTreeNode } from "#generate/deliverable/page-tree.ts";

const TREE: PageTreeNode[] = [
  { _id: "root", slug: { current: "work" }, parentId: null, isContainer: true },
  { _id: "child", slug: { current: "atlas" }, parentId: "root", isContainer: false },
];

describe("resolvePaths", () => {
  it("nests a child path under its parent, with no leading slash", () => {
    expect(resolvePaths(TREE).get("child")).toBe("work/atlas");
  });

  it("resolves a root node's path to its own slug", () => {
    expect(resolvePaths(TREE).get("root")).toBe("work");
  });

  it("treats a missing slug as an empty segment", () => {
    const tree: PageTreeNode[] = [{ _id: "root", slug: null, parentId: null, isContainer: null }];
    expect(resolvePaths(tree).get("root")).toBe("");
  });

  it("omits a node whose parent is not present in the given nodes", () => {
    const tree: PageTreeNode[] = [
      { _id: "orphan", slug: { current: "lost" }, parentId: "missing-parent", isContainer: false },
    ];
    expect(resolvePaths(tree).has("orphan")).toBe(false);
  });
});

describe("routablePaths", () => {
  it("keys on the resolved path and omits a container that only nests its children", () => {
    const routable = routablePaths(TREE);
    expect([...routable.keys()]).toEqual(["work/atlas"]);
    expect(routable.get("work/atlas")).toBe("child");
  });

  it("keys a root-level home page at the empty path", () => {
    const tree: PageTreeNode[] = [{ _id: "home", slug: { current: "home" }, parentId: null, isContainer: false }];
    const routable = routablePaths(tree);
    expect([...routable.keys()]).toEqual([""]);
    expect(routable.get("")).toBe("home");
  });
});
