import { Tea } from "./api_clients/happy_earth.ts";

export const getTeasFromKv = async (): Promise<Tea[]> => {
  const kv = await Deno.openKv();
  const entries = kv.list({ prefix: ["tea"] });
  const teas: Tea[] = [];
  for await (const entry of entries) {
    teas.push(entry.value as Tea);
  }
  return teas;
};
