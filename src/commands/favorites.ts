import { Effect } from "effect";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord";
import { Tea, TeaStore, UserTeaService } from "../services/index.ts";
import { stableId } from "../tea-index.ts";
import { AppRuntime } from "../runtime.ts";

const TEAS_PER_PAGE = 5;

const data = new SlashCommandBuilder()
  .setName("favorites")
  .setDescription("List of your favorite teas");

/** Builds the favorites container for a specific page */
export function buildFavoritesContainer(
  favorites: Tea[],
  page: number,
): ContainerBuilder {
  const totalPages = Math.ceil(favorites.length / TEAS_PER_PAGE);
  const startIdx = page * TEAS_PER_PAGE;
  const pageItems = favorites.slice(startIdx, startIdx + TEAS_PER_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(0x2d7d46);

  const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : "";
  container.addTextDisplayComponents((t) =>
    t.setContent(`## ⭐ Your Favorite Teas (${favorites.length})${pageInfo}`)
  );

  for (const tea of pageItems) {
    const teaId = stableId(tea.title);

    // Tea info line
    const tagPreview = tea.tags.slice(0, 4).join(", ");
    const content = `**${tea.title}**\n-# ${tagPreview}`;
    container.addTextDisplayComponents((t) => t.setContent(content));

    // Remove button
    const removeButton = new ButtonBuilder()
      .setCustomId(`unfavorite_tea:${teaId}`)
      .setLabel("Remove")
      .setEmoji("💔")
      .setStyle(ButtonStyle.Secondary);
    const viewButton = new ButtonBuilder()
      .setCustomId(`view_tea:${teaId}`)
      .setLabel("Details")
      .setStyle(ButtonStyle.Secondary);
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(removeButton, viewButton);
    container.addActionRowComponents(actionRow);

    container.addSeparatorComponents((s) => s.setDivider(true));
  }

  // Add pagination buttons if needed
  if (totalPages > 1) {
    const prevButton = new ButtonBuilder()
      .setCustomId(`favorites_page:${page - 1}`)
      .setLabel("Previous")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0);
    const nextButton = new ButtonBuilder()
      .setCustomId(`favorites_page:${page + 1}`)
      .setLabel("Next")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1);
    const paginationRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(prevButton, nextButton);
    container.addActionRowComponents(paginationRow);
  }

  return container;
}

const execute = async (interaction: ChatInputCommandInteraction) => {
  const user_snowflake = interaction.user.id;

  const program = Effect.gen(function* () {
    const userTeaService = yield* UserTeaService;
    const teaStore = yield* TeaStore;
    const favoriteTitles = yield* userTeaService.getFavoriteTeas({
      user_snowflake,
    });

    // Get tea details for each favorite
    const teas = yield* teaStore.getTeas();
    const favorites = favoriteTitles
      .map((title) => teas.find((t) => t.title === title))
      .filter((t) => t !== undefined);

    return favorites;
  });

  const favorites = await AppRuntime.runPromise(program).catch(() => []);

  if (favorites.length === 0) {
    await interaction.reply("You haven't favorited any teas yet!");
    return;
  }

  const container = buildFavoritesContainer(favorites, 0);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
};

/**
 * Handles button interactions for favorites pagination.
 * Returns true if the interaction was handled, false otherwise.
 */
const handleButton = async (
  interaction: ButtonInteraction,
): Promise<boolean> => {
  const customId = interaction.customId;

  if (!customId.startsWith("favorites_page:")) {
    return false;
  }

  const page = parseInt(customId.split(":")[1], 10);
  const user_snowflake = interaction.user.id;

  const program = Effect.gen(function* () {
    const userTeaService = yield* UserTeaService;
    const teaStore = yield* TeaStore;
    const favoriteTitles = yield* userTeaService.getFavoriteTeas({
      user_snowflake,
    });

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
    return true;
  }

  const container = buildFavoritesContainer(favorites, page);
  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
  return true;
};

export { data, execute, handleButton };
