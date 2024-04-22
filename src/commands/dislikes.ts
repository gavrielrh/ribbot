import { SlashCommandBuilder } from "discord";
import { ChatInputCommandInteraction } from "discord";
import { getDislikedTeas } from "../user_tea.ts";

const data = new SlashCommandBuilder()
  .setName("dislikes")
  .setDescription("List of teas you don't want recommended");

const execute = async (interaction: ChatInputCommandInteraction) => {
  const favorites = await getDislikedTeas({
    user_snowflake: interaction.user.id,
  });
  await interaction.reply(
    `# Disliked Teas\n- ${favorites.join("\n- ")}`,
  );
};

export { data, execute };
