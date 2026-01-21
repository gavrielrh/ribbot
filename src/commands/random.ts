import { Effect } from "effect";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord";
import { TeaStore, UserTeaService, Tea } from "../services/index.ts";
import { AppRuntime } from "../runtime.ts";

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

    let toSelectFrom = [...teas].filter((tea) =>
      tea && tea.available && !disliked_teas.includes(tea.title)
    );

    if (category === "favorites") {
      const favoriteTeas = yield* userTeaService.getFavoriteTeas({ user_snowflake });
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
    return toSelectFrom[index] ?? null;
  });

  const tea = await AppRuntime.runPromise(program).catch(() => null);

  if (!tea) {
    await interaction.reply({ content: "No tea found :(" });
    return;
  }
  const embed = new EmbedBuilder()
    .setTitle(tea.title)
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

export { data, execute };
