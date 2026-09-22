/** Read every page or fail; never silently use incomplete financial totals. */
export async function readAllPages<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000): Promise<T[]> {
  const result: T[] = []
  for(let from=0; ;from+=size) {
    const {data,error}=await load(from,from+size-1)
    if(error) throw error
    if(!data) throw new Error('Dati non disponibili.')
    result.push(...data)
    if(data.length<size) return result
  }
}
