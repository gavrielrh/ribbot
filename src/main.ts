import { Effect } from "effect";
import { Events, GatewayIntentBits, MessageFlags } from "discord";
import * as Sentry from "sentry";
import { Client } from "./client.ts";
import { sentryDsn, token } from "./config.ts";
import { UserTeaService, TeaStore } from "./services/index.ts";
import { registerCommands } from "./deploy-commands.ts";
import { AppRuntime, startScheduledRefresh } from "./runtime.ts";

Sentry.init({
  dsn: sentryDsn,
  tracesSampleRate: 1.0,
  enableLogs: true,
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

await registerCommands(true);

for await (const file of Deno.readDir(`./src/commands`)) {
  const command = await import(`./commands/${file.name}`);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    await AppRuntime.runPromise(
      Effect.logWarning(`The command at ${file.name} is missing a required "data" or "execute" property.`)
    );
  }
}

client.once(Events.ClientReady, (c) => {
  AppRuntime.runPromise(Effect.logInfo(`Ready! Logged in as ${c.user.tag}`));
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as Client).commands.get(
    interaction.commandName,
  );

  if (!command) {
    await AppRuntime.runPromise(
      Effect.logError(`No command matching ${interaction.commandName} was found.`)
    );
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    await AppRuntime.runPromise(
      Effect.logError(`Error executing command "${interaction.commandName}"`, { error })
    );
    const errorMessage = `An error occurred while executing /${interaction.commandName}. Please try again later.`;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
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
    await AppRuntime.runPromise(
      Effect.logError(`No autocomplete handler for command ${interaction.commandName}`)
    );
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    await AppRuntime.runPromise(Effect.logError("Autocomplete error", { error }));
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const user_snowflake = interaction.user.id;
  const embed = interaction.message.embeds[0];
  const tea_title = embed?.data?.title;

  if (!tea_title) {
    await interaction.reply({
      content: "Could not identify the tea from this message.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const program = Effect.gen(function* () {
    const userTeaService = yield* UserTeaService;

    if (interaction.customId === "dislike") {
      yield* userTeaService.setDislikedTea({ user_snowflake, tea_title });
      return "I will not recommend this tea again.";
    }

    if (interaction.customId === "like") {
      yield* userTeaService.setFavoriteTea({ user_snowflake, tea_title });
      return "Tea added to favorites!";
    }

    if (interaction.customId === "clear") {
      yield* userTeaService.clearTeaStatus({ user_snowflake, tea_title });
      return "Claritea";
    }

    return null;
  });

  const message = await AppRuntime.runPromise(
    program.pipe(
      Effect.catchAll((error) =>
        Effect.logError("Button handler error", { error }).pipe(
          Effect.map(() => "An error occurred.")
        )
      )
    )
  );

  if (message) {
    await interaction.reply({
      content: message,
      flags: MessageFlags.Ephemeral,
    });
  }
});

const initProgram = Effect.gen(function* () {
  yield* Effect.logInfo("Initializing Ribbot...");

  const teaStore = yield* TeaStore;
  const teas = yield* teaStore.getTeas().pipe(
    Effect.catchAll((error) => {
      return Effect.logError(`Failed to load initial teas: ${error}`).pipe(
        Effect.flatMap(() => Effect.succeed([] as const))
      );
    })
  );

  yield* Effect.logInfo(`Loaded ${teas.length} teas into cache`);

  yield* startScheduledRefresh;

  yield* Effect.logInfo("Ribbot initialization complete");
});

await AppRuntime.runPromise(initProgram);

const shutdown = async (signal: string) => {
  await AppRuntime.runPromise(Effect.logInfo(`Received ${signal}, shutting down gracefully...`));

  try {
    client.destroy();
    await AppRuntime.runPromise(Effect.logInfo("Discord client disconnected"));

    await AppRuntime.dispose();
    await AppRuntime.runPromise(Effect.logInfo("Runtime disposed")).catch(() => {});

    Deno.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    Deno.exit(1);
  }
};

Deno.addSignalListener("SIGINT", () => shutdown("SIGINT"));
Deno.addSignalListener("SIGTERM", () => shutdown("SIGTERM"));

client.login(token);
