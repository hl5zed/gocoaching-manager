// PostgrestError는 message를 가지므로 호출부의 `error.message ?? 대체문구` 로깅을 그대로 쓸 수 있다.
export type ChunkQueryError = { message?: string } | null;
type QueryResult = PromiseLike<{ data: unknown; error: ChunkQueryError }>;

export const DEFAULT_PAGE_SIZE = 1000;
export const DEFAULT_ID_CHUNK_SIZE = 150;
const DEFAULT_CHUNK_CONCURRENCY = 3;

/**
 * range(from, to)로 1000행씩 끝까지 가져온다.
 * fetchPage 안의 쿼리는 반드시 고유 컬럼(id 등)으로 order 해야 페이지 경계에서 중복·누락이 없다.
 */
export async function fetchAllPages<TRow>(
  fetchPage: (from: number, to: number) => QueryResult,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<{ data: TRow[]; error: ChunkQueryError }> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: [], error };

    const page = (data ?? []) as TRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return { data: rows, error: null };
}

export function chunkIds(ids: string[], size: number = DEFAULT_ID_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  limit: number,
  worker: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = new Array<TOutput>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * ids를 묶음(기본 150개)으로 나누고, 묶음마다 fetchAllPages로 끝까지 가져와 이어 붙인다.
 * URL 길이 한도와 1000행 상한을 동시에 피한다. 동시 실행은 최대 3묶음.
 * ids가 비어 있으면 요청 없이 빈 배열을 돌려준다.
 */
export async function fetchAllByIdChunks<TRow>(
  ids: string[],
  fetchPage: (chunk: string[], from: number, to: number) => QueryResult,
): Promise<{ data: TRow[]; error: ChunkQueryError }> {
  if (ids.length === 0) return { data: [], error: null };

  const results = await mapWithConcurrency(
    chunkIds(ids),
    DEFAULT_CHUNK_CONCURRENCY,
    (chunk) => fetchAllPages<TRow>((from, to) => fetchPage(chunk, from, to)),
  );

  const failed = results.find((result) => result.error);
  if (failed) return { data: [], error: failed.error };

  return { data: results.flatMap((result) => result.data), error: null };
}
