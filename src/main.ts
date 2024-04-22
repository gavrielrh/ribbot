import { Events, GatewayIntentBits } from "discord";
import { Client } from "./client.ts";
import { sentryDsn, token } from "./config.ts";
import { getTeas } from "./api_clients/happy-earth.ts";
import { getTeasFromKv, saveTeasToStore } from "./store.ts";
import { setDislikedTea, setFavoriteTea } from "./user_tea.ts";
import { clearTeaStatus } from "./user_tea.ts";

// import from the Deno registry
import * as Sentry from "https://deno.land/x/sentry@7.109.0/index.mjs";

Sentry.init({
  dsn: sentryDsn,
});

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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const user_snowflake = interaction.user.id;
  const tea_title = interaction.message.embeds[0].data.title!;

  if (interaction.customId === "dislike") {
    await setDislikedTea({ user_snowflake, tea_title });

    await interaction.reply({
      content: "I will not recommend this tea again.",
      ephemeral: true,
    });
  }

  if (interaction.customId === "like") {
    await setFavoriteTea({ user_snowflake, tea_title });

    await interaction.reply({
      content: "Tea added to favorites!",
      ephemeral: true,
    });
  }

  if (interaction.customId === "clear") {
    await clearTeaStatus({ user_snowflake, tea_title });

    await interaction.reply({
      content: "Claritea",
      ephemeral: true,
    });
  }
});

const teas = await getTeas();
await saveTeasToStore(teas);

client.login(token);
