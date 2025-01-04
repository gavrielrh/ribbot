import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord";
import { getPlantFamilies } from "../api_clients/plant-family.ts";

const data = new SlashCommandBuilder()
  .setName("legume")
  .setDescription("Says if plant is legume based on family from wikipedia")
  .addStringOption((option) =>
    option.setName("plant").setDescription("Plant Name").setRequired(true)
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const plantName = interaction.options.getString("plant");
  if (!plantName) {
    await interaction.reply("Please specify a plant");
    return;
  }
  const result = await getPlantFamilies(plantName);
  if (!result) {
    await interaction.reply("Family not found");
    return;
  }
  const embeds = result.map((plant) => (
    new EmbedBuilder()
      .setTitle(
        plantName !== plant.label ? `${plantName} - ${plant.label}` : plantName,
      )
      .setDescription(plant.description)
      .addFields({ name: "Family", value: plant.family, inline: true })
      .addFields({
        name: "Is Legume?",
        value: (plant.family.toLowerCase() === "fabaceae" ||
            plant.family.toLowerCase() === "leguminosae")
          ? "👍"
          : "👎",
        inline: true,
      })
  ));
  await interaction.reply({
    embeds: [embeds[0]],
  });
};

export { data, execute };
