import { Effect } from "effect";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
} from "discord";
import type { Recommendation } from "../tea-index.ts";
import { TeaStore, UserTeaService } from "../services/index.ts";
import { AppRuntime } from "../runtime.ts";
import { truncate } from "../utils.ts";

const RECS_PER_PAGE = 3;

const data = new SlashCommandBuilder()
  .setName("recommend")
  .setDescription("Recommends a tea")
  .addStringOption((option) =>
    option.setName("query").setDescription("Search query").setRequired(true)
  );

/**
 * Formats the match reasons into separate lines for each category.
 * Uses Discord's -# subtext markdown for a subtle appearance.
 */
function formatMatchReasons(rec: Recommendation): string[] {
  const reasons = rec.debug.reasons;
  const lines: string[] = [];

  // Extract title matches
  const titleMatches = reasons
    .filter((r) => r.startsWith("Title match:"))
    .map((r) => r.replace("Title match: ", ""));
  if (titleMatches.length > 0) {
    lines.push(`-# 📍 **Title**: ${titleMatches.join(", ")}`);
  }

  // Extract text/token matches (excluding title matches to avoid duplication)
  const textMatches = reasons
    .filter((r) => r.startsWith("Matched:") || r.startsWith("Contains:"))
    .map((r) => r.replace("Matched: ", "").replace("Contains: ", ""))
    .filter((t) => !titleMatches.includes(t));
  if (textMatches.length > 0) {
    lines.push(`-# 📝 **Text**: ${textMatches.join(", ")}`);
  }

  // Add matched tags
  if (rec.matchedTags.length > 0) {
    lines.push(`-# 🏷️ **Tags**: ${rec.matchedTags.join(", ")}`);
  }

  return lines;
}

/**
 * Formats a tea recommendation into display text.
 * Combines title, description, and match reasons into a clean format.
 */
function formatTeaContent(rec: Recommendation): string {
  const tea = rec.tea;
  const lines: string[] = [];

  // Title
  lines.push(`### ${tea.title}`);

  // Description
  lines.push(truncate(tea.description, 180));

  // Match reasons as separate subtext lines
  const matchReasons = formatMatchReasons(rec);
  lines.push(...matchReasons);

  return lines.join("\n");
}

const execute = async (interaction: ChatInputCommandInteraction) => {
  const query = interaction.options.getString("query");
  if (!query) {
    await interaction.reply("Please provide a search query.");
    return;
  }

  const user_snowflake = interaction.user.id;

  const program = Effect.gen(function* () {
    const teaStore = yield* TeaStore;
    const userTeaService = yield* UserTeaService;

    // Get user's disliked and favorite teas
    const dislikedTeas = yield* userTeaService.getDislikedTeas({
      user_snowflake,
    });
    const favoriteTeas = yield* userTeaService.getFavoriteTeas({
      user_snowflake,
    });

    // Get more recommendations than needed to account for filtering
    const allRecommendations = yield* teaStore.recommend(query, { topN: 15 });

    // Filter out disliked teas (keep up to 15 for pagination)
    const filtered = allRecommendations
      .filter((rec) => !dislikedTeas.includes(rec.tea.title));

    return { recommendations: filtered, favoriteTeas };
  });

  const result = await AppRuntime.runPromise(
    program.pipe(
      Effect.catchAll((error) =>
        Effect.logError("Failed to get tea recommendations", { error }).pipe(
          Effect.map(() => ({
            recommendations: [] as Recommendation[],
            favoriteTeas: [] as string[],
          })),
        )
      ),
    ),
  );

  const { recommendations, favoriteTeas } = result;

  if (recommendations.length === 0) {
    await interaction.reply("No recommendations found for your query.");
    return;
  }

  const container = buildRecommendContainer(
    recommendations,
    favoriteTeas,
    query,
    0,
  );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
};

/** Builds the recommendation container for a specific page */
function buildRecommendContainer(
  recommendations: Recommendation[],
  favoriteTeas: string[],
  query: string,
  page: number,
): ContainerBuilder {
  const totalPages = Math.ceil(recommendations.length / RECS_PER_PAGE);
  const startIdx = page * RECS_PER_PAGE;
  const pageItems = recommendations.slice(startIdx, startIdx + RECS_PER_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(0x2d7d46); // Tea green color

  // Header showing the query and page info
  const pageInfo = totalPages > 1 ? ` (${page + 1}/${totalPages})` : "";
  container.addTextDisplayComponents((t) =>
    t.setContent(`## Recommendations for "${query}"${pageInfo}`)
  );
  container.addSeparatorComponents((s) =>
    s.setSpacing(SeparatorSpacingSize.Small).setDivider(false)
  );

  // Add the recommendation for this page
  for (const recommendation of pageItems) {
    const tea = recommendation.tea;
    const thumbnailUrl = tea.thumbnail;
    const content = formatTeaContent(recommendation);

    if (thumbnailUrl) {
      const section = new SectionBuilder()
        .addTextDisplayComponents((t) => t.setContent(content))
        .setThumbnailAccessory((thumbnail) =>
          thumbnail.setDescription(`Image of ${tea.title}`).setURL(thumbnailUrl)
        );
      container.addSectionComponents(section);
    } else {
      container.addTextDisplayComponents((t) => t.setContent(content));
    }

    // Add action buttons for this tea
    const isFavorite = favoriteTeas.includes(tea.title);
    const favoriteButton = isFavorite
      ? new ButtonBuilder()
        .setCustomId(`unfavorite_tea:${tea.id}`)
        .setLabel("Unfavorite")
        .setEmoji("💔")
        .setStyle(ButtonStyle.Secondary)
      : new ButtonBuilder()
        .setCustomId(`like_tea:${tea.id}`)
        .setLabel("Favorite")
        .setEmoji("⭐")
        .setStyle(ButtonStyle.Success);
    const dislikeButton = new ButtonBuilder()
      .setCustomId(`dislike_tea:${tea.id}`)
      .setLabel("Hide")
      .setEmoji("👎")
      .setStyle(ButtonStyle.Danger);
    const viewButton = new ButtonBuilder()
      .setCustomId(`view_tea:${tea.id}`)
      .setLabel("Details")
      .setStyle(ButtonStyle.Secondary);
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      favoriteButton,
      dislikeButton,
      viewButton,
    );
    container.addActionRowComponents(actionRow);
  }

  // Add pagination buttons if needed
  if (totalPages > 1) {
    // Encode query in customId (truncate if needed to fit within Discord's 100 char limit)
    const encodedQuery = encodeURIComponent(query).slice(0, 70);
    const prevButton = new ButtonBuilder()
      .setCustomId(`rec_page:${page - 1}:${encodedQuery}`)
      .setLabel("Previous")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0);
    const nextButton = new ButtonBuilder()
      .setCustomId(`rec_page:${page + 1}:${encodedQuery}`)
      .setLabel("Next")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1);
    const paginationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      prevButton,
      nextButton,
    );
    container.addActionRowComponents(paginationRow);
  }

  return container;
}

/**
 * Handles button interactions for recommend pagination.
 * Returns true if the interaction was handled, false otherwise.
 */
const handleButton = async (
  interaction: ButtonInteraction,
): Promise<boolean> => {
  const customId = interaction.customId;

  if (!customId.startsWith("rec_page:")) {
    return false;
  }

  const parts = customId.split(":");
  const page = parseInt(parts[1], 10);
  const encodedQuery = parts.slice(2).join(":"); // Handle colons in query
  const query = decodeURIComponent(encodedQuery);
  const user_snowflake = interaction.user.id;

  const program = Effect.gen(function* () {
    const teaStore = yield* TeaStore;
    const userTeaService = yield* UserTeaService;

    const dislikedTeas = yield* userTeaService.getDislikedTeas({
      user_snowflake,
    });
    const favoriteTeas = yield* userTeaService.getFavoriteTeas({
      user_snowflake,
    });

    const allRecommendations = yield* teaStore.recommend(query, { topN: 15 });
    const filtered = allRecommendations.filter(
      (rec) => !dislikedTeas.includes(rec.tea.title),
    );

    return { recommendations: filtered, favoriteTeas };
  });

  const result = await AppRuntime.runPromise(program).catch(() => ({
    recommendations: [] as Recommendation[],
    favoriteTeas: [] as string[],
  }));

  const { recommendations, favoriteTeas } = result;

  if (recommendations.length === 0) {
    await interaction.update({
      content: "No recommendations found.",
      components: [],
    });
    return true;
  }

  const container = buildRecommendContainer(
    recommendations,
    favoriteTeas,
    query,
    page,
  );
  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
  return true;
};

export { data, execute, handleButton };
