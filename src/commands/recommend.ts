import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord";
import OpenAI from "npm:openai";
import { getTeaFromKv, getTeasFromKv } from "../store.ts";
import { openAIKey } from "../config.ts";

const data = new SlashCommandBuilder()
  .setName("recommend")
  .setDescription("Recommends a tea")
  .addStringOption((option) =>
    option.setName("query").setDescription("Search query").setRequired(true)
  );

const openai = new OpenAI({
  apiKey: openAIKey,
});

const execute = async (interaction: ChatInputCommandInteraction) => {
  const query = interaction.options.data[0].value as string;
  console.log("query", query);
  const teas = await getTeasFromKv();
  const teaDescriptions = teas.map((tea) => tea.description);
  const recommendations = await recommendationsFromStrings([
    query,
    ...teaDescriptions,
  ], 0);
  const recommendation = teas[recommendations[0]];
  const embed = new EmbedBuilder()
    .setTitle(recommendation.title)
    .addFields({
      name: "In-stock",
      value: recommendation.available ? "yes" : "no",
    })
    .setDescription(recommendation.description);
  if (recommendation.thumbnail) {
    embed.setThumbnail(recommendation.thumbnail);
  }
  await interaction.reply({
    embeds: [embed],
  });
};

export { data, execute };
