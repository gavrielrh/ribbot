import "@std/dotenv/load";
import { Schema } from "effect";

const EnvSchema = Schema.Struct({
  DISCORD_TOKEN: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "DISCORD_TOKEN is required" }),
  ),
  DISCORD_CLIENT_ID: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "DISCORD_CLIENT_ID is required" }),
  ),
  DISCORD_GUILD_ID: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "DISCORD_GUILD_ID is required" }),
  ),
  POCKETBASE_URL: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "POCKETBASE_URL is required" }),
  ),
  POCKETBASE_USERNAME: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "POCKETBASE_USERNAME is required" }),
  ),
  POCKETBASE_PASSWORD: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "POCKETBASE_PASSWORD is required" }),
  ),
  SENTRY_DSN: Schema.optional(Schema.String),
});

type Env = Schema.Schema.Type<typeof EnvSchema>;

function loadConfig(): Env {
  const env = {
    DISCORD_TOKEN: Deno.env.get("DISCORD_TOKEN") ?? "",
    DISCORD_CLIENT_ID: Deno.env.get("DISCORD_CLIENT_ID") ?? "",
    DISCORD_GUILD_ID: Deno.env.get("DISCORD_GUILD_ID") ?? "",
    POCKETBASE_URL: Deno.env.get("POCKETBASE_URL") ?? "",
    POCKETBASE_USERNAME: Deno.env.get("POCKETBASE_USERNAME") ?? "",
    POCKETBASE_PASSWORD: Deno.env.get("POCKETBASE_PASSWORD") ?? "",
    SENTRY_DSN: Deno.env.get("SENTRY_DSN"),
  };

  const result = Schema.decodeUnknownSync(EnvSchema)(env);
  return result;
}

const config = loadConfig();

export const token = config.DISCORD_TOKEN;
export const clientId = config.DISCORD_CLIENT_ID;
export const guildId = config.DISCORD_GUILD_ID;
export const pocketbaseUrl = config.POCKETBASE_URL;
export const pocketbaseUsername = config.POCKETBASE_USERNAME;
export const pocketbasePassword = config.POCKETBASE_PASSWORD;
export const sentryDsn = config.SENTRY_DSN;
