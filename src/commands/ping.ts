import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord";

const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.reply("Pong!");
};

export { data, execute };
