import { Effect } from "effect";
import { Events, GatewayIntentBits, MessageFlags } from "discord";
import * as Sentry from "sentry";
import { Client } from "./client.ts";
import { sentryDsn, token } from "./config.ts";
import { UserTeaService, TeaStore } from "./services/index.ts";
import { registerCommands } from "./deploy-commands.ts";
import { AppRuntime, startScheduledRefresh } from "./runtime.ts";
import { buildFavoritesContainer } from "./commands/favorites.ts";
import { buildDislikesContainer } from "./commands/dislikes.ts";

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

  const customId = interaction.customId;

  // Handle buttons from tea commands (view_tea, like_tea, dislike_tea, unfavorite_tea, unhide_tea)
  if (customId.startsWith("view_tea:") || customId.startsWith("like_tea:") || customId.startsWith("dislike_tea:") || customId.startsWith("unfavorite_tea:") || customId.startsWith("unhide_tea:")) {
    const [action, teaId] = customId.split(":");
    const user_snowflake = interaction.user.id;

    const program = Effect.gen(function* () {
      const teaStore = yield* TeaStore;
      const userTeaService = yield* UserTeaService;
      const tea = yield* teaStore.getTeaById(teaId);

      if (action === "view_tea") {
        // Build a detailed response with full description
        const lines = [
          `## ${tea.title}`,
          "",
          tea.description,
          "",
          `-# ${tea.available ? "✓ In Stock" : "✗ Out of Stock"}`,
        ];
        if (tea.tags.length > 0) {
          lines.push(`-# Tags: ${tea.tags.join(", ")}`);
        }
        return { type: "view" as const, content: lines.join("\n"), teaTitle: tea.title };
      }

      if (action === "like_tea") {
        yield* userTeaService.setFavoriteTea({ user_snowflake, tea_title: tea.title });
        return { type: "toggle" as const, content: `⭐ **${tea.title}** added to favorites!`, teaId, teaTitle: tea.title, newState: "favorited" as const };
      }

      if (action === "unfavorite_tea") {
        yield* userTeaService.clearTeaStatus({ user_snowflake, tea_title: tea.title });
        return { type: "toggle" as const, content: `💔 **${tea.title}** removed from favorites.`, teaId, teaTitle: tea.title, newState: "none" as const };
      }

      if (action === "dislike_tea") {
        yield* userTeaService.setDislikedTea({ user_snowflake, tea_title: tea.title });
        return { type: "toggle" as const, content: `👎 **${tea.title}** hidden from recommendations.`, teaId, teaTitle: tea.title, newState: "hidden" as const };
      }

      if (action === "unhide_tea") {
        yield* userTeaService.clearTeaStatus({ user_snowflake, tea_title: tea.title });
        return { type: "toggle" as const, content: `👍 **${tea.title}** is now visible in recommendations.`, teaId, teaTitle: tea.title, newState: "visible" as const };
      }

      return null;
    });

    const result = await AppRuntime.runPromise(
      program.pipe(
        Effect.catchAll((error) =>
          Effect.logError("Failed to handle tea button", { error }).pipe(
            Effect.map(() => null)
          )
        )
      )
    );

    if (!result) {
      await interaction.reply({
        content: "Could not find this tea. It may no longer be available.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // For toggle actions, update the original message to swap the button
    if (result.type === "toggle") {
      try {
        // Get current components as JSON and recursively update buttons
        const rawComponents = interaction.message.components.map((c) => c.toJSON());

        const updateButtonsRecursively = (obj: unknown): unknown => {
          if (Array.isArray(obj)) {
            return obj.map(updateButtonsRecursively);
          }
          if (obj && typeof obj === "object") {
            const record = obj as Record<string, unknown>;
            // Check if this is a button with our target custom_id
            if (record.type === 2 && typeof record.custom_id === "string") {
              // Toggle favorite buttons
              if (record.custom_id === `like_tea:${result.teaId}`) {
                return {
                  type: 2,
                  style: 2, // Secondary
                  label: "Unfavorite",
                  emoji: { name: "💔" },
                  custom_id: `unfavorite_tea:${result.teaId}`,
                };
              }
              if (record.custom_id === `unfavorite_tea:${result.teaId}`) {
                return {
                  type: 2,
                  style: 3, // Success
                  label: "Favorite",
                  emoji: { name: "⭐" },
                  custom_id: `like_tea:${result.teaId}`,
                };
              }
              // Toggle hide buttons
              if (record.custom_id === `dislike_tea:${result.teaId}`) {
                return {
                  type: 2,
                  style: 3, // Success
                  label: "Unhide",
                  emoji: { name: "👍" },
                  custom_id: `unhide_tea:${result.teaId}`,
                };
              }
              if (record.custom_id === `unhide_tea:${result.teaId}`) {
                return {
                  type: 2,
                  style: 4, // Danger
                  label: "Hide",
                  emoji: { name: "👎" },
                  custom_id: `dislike_tea:${result.teaId}`,
                };
              }
            }
            // Recursively process nested components
            const updated: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(record)) {
              updated[key] = updateButtonsRecursively(value);
            }
            return updated;
          }
          return obj;
        };

        const updatedComponents = updateButtonsRecursively(rawComponents);

        // deno-lint-ignore no-explicit-any
        await interaction.update({ components: updatedComponents as any });

        // Send ephemeral followup with confirmation
        await interaction.followUp({
          content: result.content,
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        // If update fails, just reply normally
        await interaction.reply({
          content: result.content,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    await interaction.reply({
      content: result.content,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Handle pagination buttons for favorites
  if (customId.startsWith("favorites_page:")) {
    const page = parseInt(customId.split(":")[1], 10);
    const user_snowflake = interaction.user.id;

    const program = Effect.gen(function* () {
      const userTeaService = yield* UserTeaService;
      const teaStore = yield* TeaStore;
      const favoriteTitles = yield* userTeaService.getFavoriteTeas({ user_snowflake });

      const teas = yield* teaStore.getTeas();
      const favorites = favoriteTitles
        .map((title) => teas.find((t) => t.title === title))
        .filter((t) => t !== undefined);

      return favorites;
    });

    const favorites = await AppRuntime.runPromise(program).catch(() => []);

    if (favorites.length === 0) {
      await interaction.update({
        content: "You haven't favorited any teas yet!",
        components: [],
      });
      return;
    }

    const container = buildFavoritesContainer(favorites, page);
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Handle pagination buttons for dislikes
  if (customId.startsWith("dislikes_page:")) {
    const page = parseInt(customId.split(":")[1], 10);
    const user_snowflake = interaction.user.id;

    const program = Effect.gen(function* () {
      const userTeaService = yield* UserTeaService;
      const teaStore = yield* TeaStore;
      const dislikedTitles = yield* userTeaService.getDislikedTeas({ user_snowflake });

      const teas = yield* teaStore.getTeas();
      const dislikes = dislikedTitles
        .map((title) => teas.find((t) => t.title === title))
        .filter((t) => t !== undefined);

      return dislikes;
    });

    const dislikes = await AppRuntime.runPromise(program).catch(() => []);

    if (dislikes.length === 0) {
      await interaction.update({
        content: "You haven't hidden any teas yet!",
        components: [],
      });
      return;
    }

    const container = buildDislikesContainer(dislikes, page);
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Handle like/dislike/clear buttons from tea/random commands
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

    if (customId === "dislike") {
      yield* userTeaService.setDislikedTea({ user_snowflake, tea_title });
      return "I will not recommend this tea again.";
    }

    if (customId === "like") {
      yield* userTeaService.setFavoriteTea({ user_snowflake, tea_title });
      return "Tea added to favorites!";
    }

    if (customId === "clear") {
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
