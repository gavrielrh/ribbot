import { Effect } from "effect";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord";
import { UserTeaService } from "../services/index.ts";
import { AppRuntime } from "../runtime.ts";

const data = new SlashCommandBuilder()
  .setName("favorites")
  .setDescription("List of your favorite teas");

const execute = async (interaction: ChatInputCommandInteraction) => {
  const program = Effect.gen(function* () {
    const userTeaService = yield* UserTeaService;
    return yield* userTeaService.getFavoriteTeas({
      user_snowflake: interaction.user.id,
    });
  });

  const favorites = await AppRuntime.runPromise(program).catch(() => []);

  if (favorites.length === 0) {
    await interaction.reply("You haven't favorited any teas yet!");
    return;
  }

  await interaction.reply(`# Favorite Teas\n- ${favorites.join("\n- ")}`);
};

export { data, execute };
