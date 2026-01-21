import { Effect } from "effect";
import {
  ActionRowBuilder,
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

const CATEGORIES = [
  "Black",
  "Green",
  "White",
  "Oolong",
  "Yellow",
  "Puerh",
  "Herbal",
] as const;

const data = new SlashCommandBuilder()
  .setName("random")
  .setDescription("Fetches info about tea")
  .addStringOption((option) =>
    option.setName("category").setDescription("Category of tea").setRequired(
      false,
    )
      .setAutocomplete(false)
      .addChoices(
        ...CATEGORIES.map((category) => ({ name: category, value: category })),
        { name: "Favorites", value: "favorites" },
      )
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const user_snowflake = interaction.user.id;
  const category = interaction.options.getString("category") ?? undefined;

  const program = Effect.gen(function* () {
    const teaStore = yield* TeaStore;
    const userTeaService = yield* UserTeaService;

    const teas = yield* teaStore.getTeas();
    const disliked_teas = yield* userTeaService.getDislikedTeas({ user_snowflake });
    const favoriteTeas = yield* userTeaService.getFavoriteTeas({ user_snowflake });

    let toSelectFrom = [...teas].filter((tea) =>
      tea && tea.available && !disliked_teas.includes(tea.title)
    );

    if (category === "favorites") {
      toSelectFrom = toSelectFrom.filter((tea) =>
        favoriteTeas.includes(tea.title)
      );
    } else if (category) {
      toSelectFrom = toSelectFrom.filter((tea) =>
        tea.productType?.toLowerCase().startsWith(category.toLowerCase())
      );
    }

    if (toSelectFrom.length === 0) return null;
    const index = Math.floor(Math.random() * toSelectFrom.length);
    const tea = toSelectFrom[index] ?? null;
    return tea ? { tea, isFavorite: favoriteTeas.includes(tea.title) } : null;
  });

  const result = await AppRuntime.runPromise(program).catch(() => null);

  if (!result) {
    await interaction.reply({ content: "No tea found :(" });
    return;
  }

  const { tea, isFavorite } = result;
  const teaId = stableId(tea.title);

  // Build tea content
  const lines: string[] = [];
  lines.push(`### ${tea.title}`);
  lines.push(truncate(tea.description, 200));
  if (tea.tags.length > 0) {
    lines.push(`-# 🏷️ **Tags**: ${tea.tags.slice(0, 8).join(", ")}`);
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

export { data, execute };
