import { Effect } from "effect";
import { ButtonInteraction, MessageFlags } from "discord";
import { TeaStore, UserTeaService } from "./services/index.ts";
import { AppRuntime } from "./runtime.ts";

/**
 * Recursively updates button components in a message to toggle their state.
 * Used for favorite/unfavorite and hide/unhide button toggling.
 */
function updateButtonsRecursively(obj: unknown, teaId: string): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => updateButtonsRecursively(item, teaId));
  }
  if (obj && typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    // Check if this is a button with our target custom_id
    if (record.type === 2 && typeof record.custom_id === "string") {
      // Toggle favorite buttons
      if (record.custom_id === `like_tea:${teaId}`) {
        return {
          type: 2,
          style: 2, // Secondary
          label: "Unfavorite",
          emoji: { name: "💔" },
          custom_id: `unfavorite_tea:${teaId}`,
        };
      }
      if (record.custom_id === `unfavorite_tea:${teaId}`) {
        return {
          type: 2,
          style: 3, // Success
          label: "Favorite",
          emoji: { name: "⭐" },
          custom_id: `like_tea:${teaId}`,
        };
      }
      // Toggle hide buttons
      if (record.custom_id === `dislike_tea:${teaId}`) {
        return {
          type: 2,
          style: 3, // Success
          label: "Unhide",
          emoji: { name: "👍" },
          custom_id: `unhide_tea:${teaId}`,
        };
      }
      if (record.custom_id === `unhide_tea:${teaId}`) {
        return {
          type: 2,
          style: 4, // Danger
          label: "Hide",
          emoji: { name: "👎" },
          custom_id: `dislike_tea:${teaId}`,
        };
      }
    }
    // Recursively process nested components
    const updated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      updated[key] = updateButtonsRecursively(value, teaId);
    }
    return updated;
  }
  return obj;
}

type TeaButtonResult =
  | { type: "view"; content: string; teaTitle: string }
  | {
    type: "toggle";
    content: string;
    teaId: string;
    teaTitle: string;
    newState: string;
  }
  | null;

/**
 * Handles tea-related button interactions (view_tea, like_tea, dislike_tea, unfavorite_tea, unhide_tea).
 * Returns true if the interaction was handled, false otherwise.
 */
export async function handleTeaButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const customId = interaction.customId;

  // Check if this is a tea button we handle
  const teaButtonPrefixes = [
    "view_tea:",
    "like_tea:",
    "dislike_tea:",
    "unfavorite_tea:",
    "unhide_tea:",
  ];
  if (!teaButtonPrefixes.some((prefix) => customId.startsWith(prefix))) {
    return false;
  }

  // Only allow the original command user to interact with buttons
  const originalUserId = interaction.message.interactionMetadata?.user?.id;
  if (originalUserId && interaction.user.id !== originalUserId) {
    await interaction.reply({
      content: "Only the person who ran this command can use these buttons.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const [action, teaId] = customId.split(":");
  const user_snowflake = interaction.user.id;

  const program = Effect.gen(function* () {
    const teaStore = yield* TeaStore;
    const userTeaService = yield* UserTeaService;
    const tea = yield* teaStore.getTeaById(teaId);

    if (action === "view_tea") {
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
      return {
        type: "view" as const,
        content: lines.join("\n"),
        teaTitle: tea.title,
      };
    }

    if (action === "like_tea") {
      yield* userTeaService.setFavoriteTea({
        user_snowflake,
        tea_title: tea.title,
      });
      return {
        type: "toggle" as const,
        content: `⭐ **${tea.title}** added to favorites!`,
        teaId,
        teaTitle: tea.title,
        newState: "favorited",
      };
    }

    if (action === "unfavorite_tea") {
      yield* userTeaService.clearTeaStatus({
        user_snowflake,
        tea_title: tea.title,
      });
      return {
        type: "toggle" as const,
        content: `💔 **${tea.title}** removed from favorites.`,
        teaId,
        teaTitle: tea.title,
        newState: "none",
      };
    }

    if (action === "dislike_tea") {
      yield* userTeaService.setDislikedTea({
        user_snowflake,
        tea_title: tea.title,
      });
      return {
        type: "toggle" as const,
        content: `👎 **${tea.title}** hidden from recommendations.`,
        teaId,
        teaTitle: tea.title,
        newState: "hidden",
      };
    }

    if (action === "unhide_tea") {
      yield* userTeaService.clearTeaStatus({
        user_snowflake,
        tea_title: tea.title,
      });
      return {
        type: "toggle" as const,
        content: `👍 **${tea.title}** is now visible in recommendations.`,
        teaId,
        teaTitle: tea.title,
        newState: "visible",
      };
    }

    return null;
  });

  const result: TeaButtonResult = await AppRuntime.runPromise(
    program.pipe(
      Effect.catchAll((error) =>
        Effect.logError("Failed to handle tea button", { error }).pipe(
          Effect.map(() => null),
        )
      ),
    ),
  );

  if (!result) {
    await interaction.reply({
      content: "Could not find this tea. It may no longer be available.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // For toggle actions, update the original message to swap the button
  if (result.type === "toggle") {
    const rawComponents = interaction.message.components.map((c) => c.toJSON());
    const updatedComponents = updateButtonsRecursively(
      rawComponents,
      result.teaId,
    );

    try {
      // deno-lint-ignore no-explicit-any
      await interaction.update({
        components: updatedComponents as any,
        flags: MessageFlags.IsComponentsV2,
      });
    } catch {
      // If update fails, just reply normally
      await interaction.reply({
        content: result.content,
        flags: MessageFlags.Ephemeral,
      });
    }

    return true;
  }

  await interaction.reply({
    content: result.content,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

/**
 * Handles legacy button interactions from older tea/random commands using embeds.
 * Returns true if the interaction was handled, false otherwise.
 */
export async function handleLegacyTeaButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const customId = interaction.customId;

  // Only handle legacy button IDs
  if (!["like", "dislike", "clear"].includes(customId)) {
    return false;
  }

  const user_snowflake = interaction.user.id;
  const embed = interaction.message.embeds[0];
  const tea_title = embed?.data?.title;

  if (!tea_title) {
    await interaction.reply({
      content: "Could not identify the tea from this message.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
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
          Effect.map(() => "An error occurred."),
        )
      ),
    ),
  );

  if (message) {
    await interaction.reply({
      content: message,
      flags: MessageFlags.Ephemeral,
    });
  }

  return true;
}
