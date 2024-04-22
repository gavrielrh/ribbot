import { Tea } from "./api_clients/happy-earth.ts";
// import { denoKvUrl } from "./config.ts";
import PocketBase from "pocketbase";
import {
  pocketbasePassword,
  pocketbaseUrl,
  pocketbaseUsername,
} from "./config.ts";

// export const remoteKv = await Deno.openKv(denoKvUrl);
export const localKv = await Deno.openKv();

export async function clearTeaStore() {
  const entries = localKv.list({ prefix: ["tea"] });
  for await (const entry of entries) {
    await localKv.delete(entry.key);
  }
}

export async function saveTeasToStore(teas: Tea[]) {
  for await (const tea of teas) {
    await localKv.set(["tea", tea.title.toLowerCase()], tea);
  }
}

export const getTeasFromKv = async (): Promise<Tea[]> => {
  const entries = localKv.list({ prefix: ["tea"] });
  const teas: Tea[] = [];
  for await (const entry of entries) {
    teas.push(entry.value as Tea);
  }
  return teas;
};

export const getTeaFromKv = async (title: string): Promise<Tea> => {
  return (await localKv.get(["tea", title.toLowerCase()])).value as Tea;
};

export const pb = new PocketBase(pocketbaseUrl);
export const authData = await pb.collection("users").authWithPassword(
  pocketbaseUsername,
  pocketbasePassword,
);
