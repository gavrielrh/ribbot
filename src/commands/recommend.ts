import { Effect } from "effect";
import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SlashCommandBuilder,
} from "discord";
import type { Recommendation } from "../tea-index.ts";
import { TeaStore } from "../services/index.ts";
import { AppRuntime } from "../runtime.ts";
import { truncate } from "../utils.ts";

const data = new SlashCommandBuilder()
  .setName("recommend")
  .setDescription("Recommends a tea")
  .addStringOption((option) =>
    option.setName("query").setDescription("Search query").setRequired(true)
  );

/**
 * Formats the match reasons into a user-friendly string.
 * Shows what matched from the query: title matches, text matches, and tags.
 */
function formatMatchReason(rec: Recommendation): string | null {
  const reasons = rec.debug.reasons;
  if (reasons.length === 0 && rec.matchedTags.length === 0) return null;

  const parts: string[] = [];

  // Extract title matches
  const titleMatches = reasons
    .filter((r) => r.startsWith("Title match:"))
    .map((r) => r.replace("Title match: ", ""));
  if (titleMatches.length > 0) {
    parts.push(`title: ${titleMatches.join(", ")}`);
  }

  // Extract text/token matches (excluding title matches to avoid duplication)
  const textMatches = reasons
    .filter((r) => r.startsWith("Matched:") || r.startsWith("Contains:"))
    .map((r) => r.replace("Matched: ", "").replace("Contains: ", ""))
    .filter((t) => !titleMatches.includes(t));
  if (textMatches.length > 0) {
    parts.push(`text: ${textMatches.join(", ")}`);
  }

  // Add matched tags
  if (rec.matchedTags.length > 0) {
    parts.push(`tags: ${rec.matchedTags.join(", ")}`);
  }

  if (parts.length === 0) return null;
  return `**Why**: ${parts.join(" | ")}`;
}

const execute = async (interaction: ChatInputCommandInteraction) => {
  const query = interaction.options.getString("query");
  if (!query) {
    await interaction.reply("Please provide a search query.");
    return;
  }

  const program = Effect.gen(function* () {
    const teaStore = yield* TeaStore;
    return yield* teaStore.recommend(query, { topN: 5 });
  });

  const recommendations = await AppRuntime.runPromise(
    program.pipe(
      Effect.catchAll((error) =>
        Effect.logError("Failed to get tea recommendations", { error }).pipe(
          Effect.map(() => [])
        )
      )
    )
  );

  if (recommendations.length === 0) {
    await interaction.reply("No recommendations found for your query.");
    return;
  }

  const container = new ContainerBuilder()
    .setAccentColor(0x0099ff);
  recommendations.forEach((recommendation) => {
    const tea = recommendation.tea;
    const thumbnailUrl = tea.thumbnail;
    const matchReasonText = formatMatchReason(recommendation);
    if (thumbnailUrl) {
      const section = new SectionBuilder()
        .addTextDisplayComponents(
          (t) => t.setContent(`**${tea.title}**`),
          (t) => t.setContent(`${truncate(tea.description, 200)}`),
        );
      if (matchReasonText) {
        section.addTextDisplayComponents((t) => t.setContent(matchReasonText));
      }
      section.setThumbnailAccessory(
        (thumbnail) =>
          thumbnail.setDescription(`image of ${tea.title}`).setURL(thumbnailUrl),
      );
      container.addSectionComponents(section);
    } else {
      container.addTextDisplayComponents(
        (t) => t.setContent(`**${tea.title}**`),
        (t) => t.setContent(`${truncate(tea.description, 200)}`),
      );
      if (matchReasonText) {
        container.addTextDisplayComponents((t) => t.setContent(matchReasonText));
      }
    }
    container.addSeparatorComponents((s) => s);
  });
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
};

export { data, execute };
