import { load } from "https://deno.land/std@0.192.0/dotenv/mod.ts";

const env = await load({ export: true });

const token = env["DISCORD_TOKEN"];
const clientId = env["DISCORD_CLIENT_ID"];
const guildId = env["DISCORD_GUILD_ID"];
const denoKvUrl = env["DENO_KV_URL"];
const pocketbaseUrl = env["POCKETBASE_URL"];
const pocketbaseUsername = env["POCKETBASE_USERNAME"];
const pocketbasePassword = env["POCKETBASE_PASSWORD"];
const sentryDsn = env["SENTRY_DSN"];
const openAIKey = env["OPENAI_KEY"];
// const token = Deno.env.get("DISCORD_TOKEN")!;
// const clientId = Deno.env.get("DISCORD_CLIENT_ID")!;
// const guildId = Deno.env.get("DISCORD_GUILD_ID")!;
// const denoKvUrl = Deno.env.get("DENO_KV_URL")!;
// const pocketbaseUrl = Deno.env.get("POCKETBASE_URL")!;
// const pocketbaseUsername = Deno.env.get("POCKETBASE_USERNAME");
// const pocketbasePassword = Deno.env.get("POCKETBASE_PASSWORD");
// const sentryDsn = Deno.env.get("SENTRY_DSN");
// const openAIKey = Deno.env.get("OPENAI_KEY");

export {
  clientId,
  denoKvUrl,
  guildId,
  openAIKey,
  pocketbasePassword,
  pocketbaseUrl,
  pocketbaseUsername,
  sentryDsn,
  token,
};
