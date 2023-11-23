import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord";
import { getTeasFromKv } from "../store.ts";
import { Tea } from "../api_clients/happy-earth.ts";

const CATEGORIES = [
  "Black",
  "Green",
  "White",
  "Oolong",
  "Yellow",
  "Puerh",
  "Herbal",
] as const;

const getRandomTea = async (category?: string): Promise<Tea> => {
  const teas = await getTeasFromKv();
  let toSelectFrom = teas;
  if (category) {
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
      )
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  let tea: Tea;
  if (interaction.options.data.length === 0) {
    tea = await getRandomTea();
  } else {
    const category = interaction.options.data[0].value as string;
    tea = await getRandomTea(category);
  }
  const embed = new EmbedBuilder()
    .setTitle(tea.title)
    // .addFields({ name: "Available", value: tea.available.toString() })
    .setDescription(tea.description);
  if (tea.thumbnail) {
    embed.setThumbnail(tea.thumbnail);
  }
  await interaction.reply({
    embeds: [embed],
  });
};

export { data, execute };
