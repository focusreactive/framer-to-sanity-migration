export function parseSearchIndexPaths(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return [];
  }

  return Object.keys(parsed).filter((key) => key.startsWith("/"));
}
