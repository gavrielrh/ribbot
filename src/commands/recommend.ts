import { Effect } from "effect";
import {
  ActionRowBuilder,
  ButtonBuilder,
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
    const dislikedTeas = yield* userTeaService.getDislikedTeas({ user_snowflake });
    const favoriteTeas = yield* userTeaService.getFavoriteTeas({ user_snowflake });

    // Get more recommendations than needed to account for filtering
    const allRecommendations = yield* teaStore.recommend(query, { topN: 15 });

    // Filter out disliked teas and take top 5
    const filtered = allRecommendations
      .filter((rec) => !dislikedTeas.includes(rec.tea.title))
      .slice(0, 5);

    return { recommendations: filtered, favoriteTeas };
  });

  const result = await AppRuntime.runPromise(
    program.pipe(
      Effect.catchAll((error) =>
        Effect.logError("Failed to get tea recommendations", { error }).pipe(
          Effect.map(() => ({ recommendations: [] as Recommendation[], favoriteTeas: [] as string[] }))
        )
      )
    )
  );

  const { recommendations, favoriteTeas } = result;

  if (recommendations.length === 0) {
    await interaction.reply("No recommendations found for your query.");
    return;
  }

  const container = new ContainerBuilder()
    .setAccentColor(0x2d7d46); // Tea green color

  // Header showing the query
  container.addTextDisplayComponents((t) =>
    t.setContent(`## Recommendations for "${query}"`)
  );
  container.addSeparatorComponents((s) =>
    s.setSpacing(SeparatorSpacingSize.Small).setDivider(false)
  );

  // Add each recommendation
  recommendations.forEach((recommendation, index) => {
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
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(favoriteButton, dislikeButton, viewButton);
    container.addActionRowComponents(actionRow);

    // Add separator between items (but not after the last one)
    if (index < recommendations.length - 1) {
      container.addSeparatorComponents((s) =>
        s.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
    }
  });

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
};

export { data, execute };
