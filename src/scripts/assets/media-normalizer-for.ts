import { framerMediaNormalizer } from "#adapters/framer/media-normalize.ts";

import type { MediaNormalizer } from "./types.ts";

export function mediaNormalizerFor(): MediaNormalizer {
  return framerMediaNormalizer;
}
