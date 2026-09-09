export interface PresentationCollectionEntry {
  documentType: string;
  slugField: string;
  routePattern: string;
}

function staticPrefix(routePattern: string): string {
  const segments = routePattern
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment !== "" && !segment.startsWith(":"));
  return segments.length > 0 ? `/${segments.join("/")}` : "";
}

function collectionLocation(entry: PresentationCollectionEntry): string {
  const prefix = staticPrefix(entry.routePattern);
  return `    ${JSON.stringify(entry.documentType)}: defineLocations({
      select: { title: "title", slug: "${entry.slugField}.current" },
      resolve: (doc) => ({
        locations: [{ title: doc?.title ?? "Untitled", href: \`${prefix}/\${doc?.slug ?? ""}\` }],
      }),
    }),`;
}

export function emitPresentationResolve(entries: readonly PresentationCollectionEntry[]): string {
  const collectionLocations = entries.map(collectionLocation).join("\n");
  return `import { defineLocations, type PresentationPluginOptions } from "sanity/presentation";

export const resolve: PresentationPluginOptions["resolve"] = {
  locations: {
    page: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => ({
        locations: [{ title: doc?.title ?? "Untitled", href: \`/\${doc?.slug ?? ""}\` }],
      }),
    }),
${collectionLocations}
  },
};
`;
}
