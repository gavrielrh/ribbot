import { Effect } from "effect";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord";
import { UserTeaService } from "../services/index.ts";
import { AppRuntime } from "../runtime.ts";

const data = new SlashCommandBuilder()
  .setName("dislikes")
  .setDescription("List of teas you don't want recommended");

const execute = async (interaction: ChatInputCommandInteraction) => {
  const program = Effect.gen(function* () {
    const userTeaService = yield* UserTeaService;
    return yield* userTeaService.getDislikedTeas({
      user_snowflake: interaction.user.id,
    });
  });

  const dislikes = await AppRuntime.runPromise(program).catch(() => []);

  if (dislikes.length === 0) {
    await interaction.reply("You haven't disliked any teas yet!");
    return;
  }

  await interaction.reply(`# Disliked Teas\n- ${dislikes.join("\n- ")}`);
};

export { data, execute };
