import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord";

const data = new SlashCommandBuilder()
  .setName("user")
  .setDescription("Provides information about the user.");

const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.reply(
    `This command was run by ${interaction.user.username}, who joined on ${
      (interaction.member as GuildMember).joinedAt
    }.`,
  );
};

export { data, execute };
