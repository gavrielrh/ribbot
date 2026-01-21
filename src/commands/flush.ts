import { Effect } from "effect";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord";
import { TeaStore } from "../services/index.ts";
import { AppRuntime } from "../runtime.ts";

const data = new SlashCommandBuilder()
  .setName("flush")
  .setDescription("Flush availibilitea");

const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.deferReply();

  const program = Effect.gen(function* () {
    yield* Effect.logInfo("Manual flush requested");
    const teaStore = yield* TeaStore;
    const teas = yield* teaStore.refreshTeas();
    yield* Effect.logInfo(`Manual flush complete: ${teas.length} teas`);
    return teas.length;
  });

  const count = await AppRuntime.runPromise(program).catch(async (error) => {
    await interaction.editReply(
      `Failed to flush teas: ${error.message || error}`,
    );
    return null;
  });

  if (count !== null) {
    await interaction.editReply(
      `Teas flushed successfully! (${count} teas loaded)`,
    );
  }
};

export { data, execute };
