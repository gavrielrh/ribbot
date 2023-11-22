import { load } from "https://deno.land/std@0.192.0/dotenv/mod.ts";

const env = await load();

const token = env["DISCORD_TOKEN"];
const clientId = env["DISCORD_CLIENT_ID"];
const guildId = env["DISCORD_GUILD_ID"];

export { clientId, guildId, token };
