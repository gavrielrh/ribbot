import { Events, GatewayIntentBits } from "discord";
import { Client } from "./client.ts";
import { token } from "./config.ts";
import { getTeas, saveTeasToStore } from "./api_clients/happy_earth.ts";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

for await (const file of Deno.readDir(`./src/commands`)) {
  const command = await import(`./commands/${file.name}`);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${file.name} is missing a required "data" or "execute" property.`,
    );
  }
}

const teas = await getTeas();
await saveTeasToStore(teas);

client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as Client).commands.get(
    interaction.commandName,
  );

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  const command = (interaction.client as Client).commands.get(
    interaction.commandName,
  );

  if (!command || !command.autocomplete) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    console.error(error);
  }
});

client.login(token);
