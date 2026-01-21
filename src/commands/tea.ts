import { Effect } from "effect";
import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord";
import { TeaStore } from "../services/index.ts";
import { AppRuntime } from "../runtime.ts";

const data = new SlashCommandBuilder()
  .setName("tea")
  .setDescription("Fetches info about tea")
  .addStringOption((option) =>
    option.setName("query").setDescription("Search query").setRequired(true)
      .setAutocomplete(true)
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const queryOption = interaction.options.getString("query");
  if (!queryOption) {
    await interaction.reply("Please select a tea.");
    return;
  }
  const title = queryOption;

  const program = Effect.gen(function* () {
    const teaStore = yield* TeaStore;
    return yield* teaStore.getTea(title);
  });

  const tea = await AppRuntime.runPromise(program).catch(async (error) => {
    if (error._tag === "TeaNotFoundError") {
      await interaction.reply(`Tea "${error.title}" not found.`);
      return null;
    }
    throw error;
  });

  if (!tea) return;

  const embed = new EmbedBuilder()
    .setTitle(tea.title)
    .addFields({ name: "In-stock", value: tea.available ? "yes" : "no" })
    .setDescription(tea.description);
  if (tea.thumbnail) {
    embed.setThumbnail(tea.thumbnail);
  }
  const dislikeButton = new ButtonBuilder()
    .setCustomId("dislike")
    .setLabel("Don't Recommend")
    .setEmoji("👎")
    .setStyle(ButtonStyle.Danger);
  const likeButton = new ButtonBuilder()
    .setCustomId("like")
    .setLabel("Favorite!")
    .setEmoji("👍")
    .setStyle(ButtonStyle.Success);
  const clearButton = new ButtonBuilder()
    .setCustomId("clear")
    .setLabel("Clear Status")
    .setEmoji("🧹")
    .setStyle(ButtonStyle.Secondary);
  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(likeButton, dislikeButton, clearButton);
  await interaction.reply({
    embeds: [embed],
    components: [actionRow],
  });
};

const autocomplete = async (interaction: AutocompleteInteraction) => {
  const focusedValue = interaction.options.getFocused();

  const program = Effect.gen(function* () {
    const teaStore = yield* TeaStore;
    return yield* teaStore.getTeas();
  });

  const teas = await AppRuntime.runPromise(
    program.pipe(
      Effect.catchAll((error) =>
        Effect.logError("Autocomplete error fetching teas", { error }).pipe(
          Effect.map(() => [] as const)
        )
      )
    )
  );
  const choices = teas.map((tea) => tea.title);
  const filtered = choices.filter((choice) =>
    choice.toLowerCase().includes(focusedValue.toLocaleLowerCase())
  );
  await interaction.respond(
    filtered.map((choice) => ({ name: choice, value: choice })).slice(0, 25),
  );
};

export { autocomplete, data, execute };
