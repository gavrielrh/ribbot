import { SlashCommandBuilder } from "discord";
import { ChatInputCommandInteraction } from "discord";
import { getFavoriteTeas } from "../user_tea.ts";

const data = new SlashCommandBuilder()
  .setName("favorites")
  .setDescription("List of your favorite teas");

const execute = async (interaction: ChatInputCommandInteraction) => {
  const favorites = await getFavoriteTeas({
    user_snowflake: interaction.user.id,
  });
  await interaction.reply(`# Favorite Teas\n- ${favorites.join("\n- ")}`);
};

export { data, execute };
