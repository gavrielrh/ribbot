import { Effect, Logger, LogLevel } from "effect";
import { APIApplicationCommand, REST, Routes } from "discord";
import { clientId, guildId, token } from "./config.ts";
import { parseArgs } from "@std/cli/parse-args";

const log = (effect: Effect.Effect<void>) =>
  Effect.runSync(effect.pipe(Effect.provide(Logger.minimumLogLevel(LogLevel.Info))));

export async function registerCommands(registerGlobally: boolean) {
  const commands = [];

  for await (const file of Deno.readDir(`./src/commands`)) {
    const command = await import(`./commands/${file.name}`);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      log(Effect.logWarning(`The command at ${file.name} is missing a required "data" or "execute" property.`));
    }
  }

  const rest = new REST().setToken(token);

  try {
    log(Effect.logInfo(`Started refreshing ${commands.length} application (/) commands.`));

    const data = (await rest.put(
      registerGlobally
        ? Routes.applicationCommands(clientId)
        : Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    )) as Array<APIApplicationCommand>;

    log(Effect.logInfo(`Successfully reloaded ${data.length} application (/) commands.`));
  } catch (error) {
    log(Effect.logError("Failed to register commands", { error }));
  }
}

if (import.meta.main) {
  const parsedArgs = parseArgs(Deno.args);
  // "--global"
  const registerGlobally: boolean = parsedArgs.global;
  registerCommands(registerGlobally);
}
