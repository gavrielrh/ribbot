import { AutocompleteInteraction, ChatInputCommandInteraction } from "discord";

interface Command {
  data: unknown;
  execute: ChatInputCommandInteraction & CallableFunction;
  autocomplete?: AutocompleteInteraction & CallableFunction;
}
