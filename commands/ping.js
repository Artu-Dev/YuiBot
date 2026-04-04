
import { SlashCommandBuilder } from "discord.js";

export const name = "ping";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Verifica a latência do bot.");

function parseArgs(data) {
  // No args for ping
  return {};
}

export async function execute(client, data) {
  const apiLatency = Math.round(client.ws.ping);

  let sent;
  if (data.fromInteraction) {
    const replyOpts = {
      content: "Calculando ping...",
      fetchReply: true,
    };
    if (data.isEphemeral) replyOpts.ephemeral = true;
    sent = await data.reply(replyOpts);
  } else {
    sent = await data.reply("Calculando ping...");
  }

  const messageLatency = Date.now() - sent.createdTimestamp;

  const content =
    `Latência da API: **${apiLatency}ms**\n` +
    `Latência de resposta: **${messageLatency}ms**`;

  await sent.edit(content);
}

