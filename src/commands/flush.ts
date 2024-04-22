import { SlashCommandBuilder } from "discord";
import { ChatInputCommandInteraction } from "discord";
import { getTeas } from "../api_clients/happy-earth.ts";
import { saveTeasToStore } from "../store.ts";
import { clearTeaStore } from "../store.ts";

const data = new SlashCommandBuilder()
  .setName("flush")
  .setDescription("Flush availibilitea");

const execute = async (interaction: ChatInputCommandInteraction) => {
  console.log("flushing teas");
  await clearTeaStore();
  const teas = await getTeas();
  await saveTeasToStore(teas);
  console.log("done flushing");
  await interaction.reply("Teas flushed successfully!");
};

export { data, execute };
