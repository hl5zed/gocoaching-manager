type PerformanceLogInput = {
  deltaMs?: number;
  durationMs?: number;
  resultCount?: number;
  route: string;
  stage: string;
};

function roundDuration(durationMs: number) {
  return Math.round(durationMs);
}

export function logApiPerformance({
  deltaMs,
  durationMs,
  resultCount,
  route,
  stage,
}: PerformanceLogInput) {
  const safePayload: Record<string, number | string> = {
    route,
    stage,
  };

  if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
    safePayload.durationMs = roundDuration(durationMs);
  }

  if (typeof deltaMs === "number" && Number.isFinite(deltaMs)) {
    safePayload.deltaMs = roundDuration(deltaMs);
  }

  if (typeof resultCount === "number" && Number.isFinite(resultCount)) {
    safePayload.resultCount = resultCount;
  }

  console.info(`[API_PERFORMANCE] ${JSON.stringify(safePayload)}`);
}

export function createApiPerformanceLogger(route: string) {
  const startedAt = performance.now();
  let lastMarkedAt = startedAt;

  return {
    mark(stage: string, resultCount?: number) {
      const markedAt = performance.now();

      logApiPerformance({
        deltaMs: markedAt - lastMarkedAt,
        durationMs: markedAt - startedAt,
        resultCount,
        route,
        stage,
      });

      lastMarkedAt = markedAt;
    },
  };
}
