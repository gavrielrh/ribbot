import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SlashCommandBuilder,
} from "discord";
import { getTeasFromKv } from "../store.ts";
import { createTeaRecommender } from "../tea-index.ts";

const data = new SlashCommandBuilder()
  .setName("recommend")
  .setDescription("Recommends a tea")
  .addStringOption((option) =>
    option.setName("query").setDescription("Search query").setRequired(true)
  );

const truncate = (input: string, maxLength: number): string =>
  input.length > maxLength ? `${input.substring(0, maxLength)}...` : input;

const execute = async (interaction: ChatInputCommandInteraction) => {
  const query = interaction.options.data[0].value as string;
  // console.log("query", query);
  const teas = await getTeasFromKv();
  const recommender = createTeaRecommender(teas);
  const recommendations = recommender.recommend(query, {
    topN: 5,
  });

  console.log(recommendations);

  const container = new ContainerBuilder()
    .setAccentColor(0x0099ff);
  recommendations.forEach((recommendation) => {
    const tea = recommendation.tea;
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        (t) => t.setContent(`**${tea.title}**`),
        (t) => t.setContent(`${truncate(tea.description, 200)}`),
        (t) => t.setContent(`**In-stock**: ${tea.available}`),
      );
    if (tea.thumbnail) {
      section.setThumbnailAccessory(
        (thumbnail) =>
          thumbnail.setDescription(`image of ${tea.title}`).setURL(
            tea.thumbnail!,
          ),
      );
    }
    container.addSectionComponents(section);
    container.addSeparatorComponents((s) => s);
  });
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
};

export { data, execute };
