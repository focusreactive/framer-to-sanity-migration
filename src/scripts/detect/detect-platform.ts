import { extractPlatformHints } from "#detect/hints.ts";
import { buildProbeView } from "#detect/probe-view.ts";
import { CONFIDENCE_THRESHOLD, decideVerdict, scorePlatform } from "#detect/scoring.ts";
import { framerSignals } from "#detect/signals/framer.ts";
import type { DetectData } from "#ir/detect.ts";
import type { ProbeData } from "#probe/read-probe-data.ts";

export function detectPlatform(data: ProbeData): DetectData {
  const view = buildProbeView(data);
  const framer = scorePlatform(framerSignals, view);

  return {
    verdict: decideVerdict({ framer }),
    scores: { framer },
    thresholds: { confidence: CONFIDENCE_THRESHOLD },
    platformHints: extractPlatformHints(view),
  };
}
