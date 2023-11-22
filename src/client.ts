import { Client as BaseClient, Collection } from "discord";
import { Command } from "./command.d.ts";

class Client extends BaseClient {
  commands: Collection<string, Command> = new Collection();
}

export { Client };
