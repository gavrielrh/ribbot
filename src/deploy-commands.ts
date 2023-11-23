import { APIApplicationCommand, REST, Routes } from "discord";
import { clientId, guildId, token } from "./config.ts";
import { parseArgs } from "https://deno.land/std@0.207.0/cli/parse_args.ts";

const parsedArgs = parseArgs(Deno.args);
// "--global"
const registerGlobally: boolean = parsedArgs.global;

const commands = [];

for await (const file of Deno.readDir(`./src/commands`)) {
  const command = await import(`./commands/${file.name}`);
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The command at ${file.name} is missing a required "data" or "execute" property.`,
    );
  }
}

const rest = new REST().setToken(token);

try {
  console.log(
    `Started refreshing ${commands.length} application (/) commands.`,
  );

  const data = await rest.put(
    registerGlobally
      ? Routes.applicationCommands(clientId)
      : Routes.applicationGuildCommands(clientId, guildId),
    { body: commands },
  ) as Array<APIApplicationCommand>;

  console.log(`Successfully reloaded ${data.length} application (/) commands.`);
} catch (error) {
  console.error(error);
}
