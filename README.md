# Ribbot

This is a Discord bot for a personal server.

It is written in Typescript, using the [Deno runtime](https://deno.land) and the
[discord.js library](https://discord.js.org/).

## Requirements

A version of Deno new enough for `Node.js` compatibility and the `KV` unstable
feature. This application is confirmed to work with `Deno@1.38.3`.

## Getting Started

Create a new `.env` file using [.env.template](.env.template) as an example.
Fill in the corresponding configuration values for your Discord application.

Run `deno task deploy:comands` to register the bot's slash commands.

Run `deno task dev` to start the bot in `watch` mode. Any file changes will be
picked up and cause the bot to reload.
