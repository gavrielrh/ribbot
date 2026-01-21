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
  .setName("dislikes")
  .setDescription("List of teas you don't want recommended");

/** Builds the dislikes container for a specific page */
export function buildDislikesContainer(
  dislikes: Tea[],
  page: number,
): ContainerBuilder {
  const totalPages = Math.ceil(dislikes.length / TEAS_PER_PAGE);
  const startIdx = page * TEAS_PER_PAGE;
  const pageItems = dislikes.slice(startIdx, startIdx + TEAS_PER_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(0x8b0000); // Dark red for dislikes

  const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : "";
  container.addTextDisplayComponents((t) =>
    t.setContent(`## 👎 Hidden Teas (${dislikes.length})${pageInfo}`)
  );

  for (const tea of pageItems) {
    container.addSeparatorComponents((s) => s.setDivider(true));
    const teaId = stableId(tea.title);

    // Tea info line
    const tagPreview = tea.tags.slice(0, 4).join(", ");
    const content = `**${tea.title}**\n-# ${tagPreview}`;
    container.addTextDisplayComponents((t) => t.setContent(content));

    // Unhide button
    const unhideButton = new ButtonBuilder()
      .setCustomId(`unhide_tea:${teaId}`)
      .setLabel("Unhide")
      .setEmoji("👍")
      .setStyle(ButtonStyle.Success);
    const viewButton = new ButtonBuilder()
      .setCustomId(`view_tea:${teaId}`)
      .setLabel("Details")
      .setStyle(ButtonStyle.Secondary);
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(unhideButton, viewButton);
    container.addActionRowComponents(actionRow);
  }

  // Add pagination buttons if needed
  if (totalPages > 1) {
    container.addSeparatorComponents((s) => s.setDivider(true));
    const prevButton = new ButtonBuilder()
      .setCustomId(`dislikes_page:${page - 1}`)
      .setLabel("Previous")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0);
    const nextButton = new ButtonBuilder()
      .setCustomId(`dislikes_page:${page + 1}`)
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
    const dislikedTitles = yield* userTeaService.getDislikedTeas({
      user_snowflake,
    });

    // Get tea details for each disliked tea
    const teas = yield* teaStore.getTeas();
    const dislikes = dislikedTitles
      .map((title) => teas.find((t) => t.title === title))
      .filter((t) => t !== undefined);

    return dislikes;
  });

  const dislikes = await AppRuntime.runPromise(program).catch(() => []);

  if (dislikes.length === 0) {
    await interaction.reply("You haven't hidden any teas yet!");
    return;
  }

  const container = buildDislikesContainer(dislikes, 0);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
};

/**
 * Handles button interactions for dislikes pagination.
 * Returns true if the interaction was handled, false otherwise.
 */
const handleButton = async (
  interaction: ButtonInteraction,
): Promise<boolean> => {
  const customId = interaction.customId;

  if (!customId.startsWith("dislikes_page:")) {
    return false;
  }

  // Only allow the original command user to interact with pagination
  const originalUserId = interaction.message.interactionMetadata?.user?.id;
  if (originalUserId && interaction.user.id !== originalUserId) {
    await interaction.reply({
      content: "Only the person who ran this command can use these buttons.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const page = parseInt(customId.split(":")[1], 10);
  const user_snowflake = interaction.user.id;

  const program = Effect.gen(function* () {
    const userTeaService = yield* UserTeaService;
    const teaStore = yield* TeaStore;
    const dislikedTitles = yield* userTeaService.getDislikedTeas({
      user_snowflake,
    });

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
    return true;
  }

  const container = buildDislikesContainer(dislikes, page);
  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
  return true;
};

export { data, execute, handleButton };
