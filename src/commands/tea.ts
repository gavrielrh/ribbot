import { Effect } from "effect";
import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SlashCommandBuilder,
} from "discord";
import { TeaStore, UserTeaService } from "../services/index.ts";
import { stableId } from "../tea-index.ts";
import { AppRuntime } from "../runtime.ts";
import { truncate } from "../utils.ts";

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
  const user_snowflake = interaction.user.id;

  const program = Effect.gen(function* () {
    const teaStore = yield* TeaStore;
    const userTeaService = yield* UserTeaService;
    const tea = yield* teaStore.getTea(title);
    const favoriteTeas = yield* userTeaService.getFavoriteTeas({
      user_snowflake,
    });
    const isFavorite = favoriteTeas.includes(tea.title);
    return { tea, isFavorite };
  });

  const result = await AppRuntime.runPromise(program).catch(async (error) => {
    if (error._tag === "TeaNotFoundError") {
      await interaction.reply(`Tea "${error.title}" not found.`);
      return null;
    }
    throw error;
  });

  if (!result) return;

  const { tea, isFavorite } = result;
  const teaId = stableId(tea.title);

  // Build tea content
  const lines: string[] = [];
  lines.push(`### ${tea.title}`);
  lines.push(truncate(tea.description, 300));
  lines.push(`-# ${tea.available ? "✓ In Stock" : "✗ Out of Stock"}`);
  if (tea.tags.length > 0) {
    lines.push(`-# 🏷️ **Tags**: ${tea.tags.slice(0, 10).join(", ")}`);
  }
  const content = lines.join("\n");

  // Build container with tea info
  const container = new ContainerBuilder()
    .setAccentColor(0x2d7d46); // Tea green

  if (tea.thumbnail) {
    const section = new SectionBuilder()
      .addTextDisplayComponents((t) => t.setContent(content))
      .setThumbnailAccessory((thumbnail) =>
        thumbnail.setDescription(`Image of ${tea.title}`).setURL(tea.thumbnail!)
      );
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents((t) => t.setContent(content));
  }

  // Add action buttons
  const favoriteButton = isFavorite
    ? new ButtonBuilder()
      .setCustomId(`unfavorite_tea:${teaId}`)
      .setLabel("Unfavorite")
      .setEmoji("💔")
      .setStyle(ButtonStyle.Secondary)
    : new ButtonBuilder()
      .setCustomId(`like_tea:${teaId}`)
      .setLabel("Favorite")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Success);
  const dislikeButton = new ButtonBuilder()
    .setCustomId(`dislike_tea:${teaId}`)
    .setLabel("Hide")
    .setEmoji("👎")
    .setStyle(ButtonStyle.Danger);
  const viewButton = new ButtonBuilder()
    .setCustomId(`view_tea:${teaId}`)
    .setLabel("Details")
    .setStyle(ButtonStyle.Secondary);
  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(favoriteButton, dislikeButton, viewButton);
  container.addActionRowComponents(actionRow);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
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
          Effect.map(() => [] as const),
        )
      ),
    ),
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
