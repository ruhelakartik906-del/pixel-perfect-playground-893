/** Read every stable page rather than silently losing rows at the API limit. */
export async function readAllPages<T>(fetchPage: (offset: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await fetchPage(offset, offset + 999);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}