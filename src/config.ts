import "jsr:@std/dotenv/load";

const token = Deno.env.get("DISCORD_TOKEN")!;
const clientId = Deno.env.get("DISCORD_CLIENT_ID")!;
const guildId = Deno.env.get("DISCORD_GUILD_ID")!;
const denoKvUrl = Deno.env.get("DENO_KV_URL")!;
const pocketbaseUrl = Deno.env.get("POCKETBASE_URL")!;
const pocketbaseUsername = Deno.env.get("POCKETBASE_USERNAME");
const pocketbasePassword = Deno.env.get("POCKETBASE_PASSWORD");
const sentryDsn = Deno.env.get("SENTRY_DSN");
const openAIKey = Deno.env.get("OPENAI_KEY");

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
