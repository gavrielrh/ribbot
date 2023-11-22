import { Tea } from "./api_clients/happy_earth.ts";

export async function saveTeasToStore(teas: Tea[]) {
  const kv = await Deno.openKv();
  for await (const tea of teas) {
    await kv.set(["tea", tea.title.toLowerCase()], tea);
  }
}

export const getTeasFromKv = async (): Promise<Tea[]> => {
  const kv = await Deno.openKv();
  const entries = kv.list({ prefix: ["tea"] });
  const teas: Tea[] = [];
  for await (const entry of entries) {
    teas.push(entry.value as Tea);
  }
  return teas;
};

export const getTeaFromKv = async (title: string): Promise<Tea> => {
  const kv = await Deno.openKv();
  return (await kv.get(["tea", title.toLowerCase()])).value as Tea;
};
