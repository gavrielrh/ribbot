import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord";
import { getTeasFromKv } from "../store.ts";
import { Tea } from "../api_clients/happy-earth.ts";
import { getDislikedTeas, getFavoriteTeas } from "../user_tea.ts";

const CATEGORIES = [
  "Black",
  "Green",
  "White",
  "Oolong",
  "Yellow",
  "Puerh",
  "Herbal",
] as const;

const getRandomTea = async ({
  category,
  user_snowflake,
  disliked_teas = [],
}: {
  category?: string;
  user_snowflake: string;
  disliked_teas?: string[];
}): Promise<Tea> => {
  const teas = await getTeasFromKv();
  let toSelectFrom = teas.filter((tea) =>
    tea && tea.available && !disliked_teas?.includes(tea.title)
  );
  if (category === "favorites") {
    const favoriteTeas = await getFavoriteTeas({ user_snowflake });
    toSelectFrom = toSelectFrom.filter((tea) =>
      favoriteTeas.includes(tea.title)
    );
  } else if (category) {
    toSelectFrom = toSelectFrom.filter((tea) =>
      tea.productType?.toLowerCase().startsWith(category.toLowerCase())
    );
  }
  const index = Math.floor(Math.random() * (toSelectFrom.length - 1));
  return toSelectFrom.at(index)!;
};

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
  let tea: Tea;
  const user_snowflake = interaction.user.id;
  const disliked_teas = await getDislikedTeas({ user_snowflake });
  if (interaction.options.data.length === 0) {
    tea = await getRandomTea({ disliked_teas, user_snowflake });
  } else {
    const category = interaction.options.data[0].value as string;
    tea = await getRandomTea({ category, disliked_teas, user_snowflake });
  }
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
