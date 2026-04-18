import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  dbBot,
  getOrCreateUser,
  reduceChars,
  getSpendableChars,
  extendGuildAiSilenceMs,
  getServerConfig,
} from "../database.js";
import { customEmojis } from "../functions/utils.js";

export const name = "calar";
export const aliases = ["silenciar", "shut"];
export const requiresCharLimit = true;

const CALAR_CUSTO = 500;
const SILENCIO_MS = 3 * 60 * 60 * 1000;
const CHANCE_SUCESSO = 1 / 3;
const LOADING_TIME = 2200;

export const data = new SlashCommandBuilder()
  .setName("calar")
  .setDescription(
    `Silencia respostas aleatórias da IA por 3h (acumula), mas tem chance de 1 em 3 de sucesso Silencia`
  );

export async function execute(client, data) {
  const { userId, displayName, guildId } = data;

  if (!guildId) {
    return data.reply("Isso só funciona em servidor.");
  }

  if (!getServerConfig(guildId, 'charLimitEnabled')) {
    return await data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  }

  const user = getOrCreateUser(userId, displayName, guildId);
  const spendableChars = await getSpendableChars(userId, guildId);
  
  if (spendableChars < CALAR_CUSTO) {
    return data.reply(
      `Você precisa de **${CALAR_CUSTO}** chars. Saldo: **${user.charLeft ?? 0}**.`
    );
  }

  await reduceChars(userId, guildId, CALAR_CUSTO, true);

  const loadingEmbed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle(`${customEmojis.loading} Tentando calar a Yui...`)
    .setDescription("Aguarde enquanto seu pedido de silêncio é preparado...")
    .setFooter({ text: "Calculando a chance de sucesso..." });

  const loadingMsg = await data.reply({ embeds: [loadingEmbed], fetchReply: true });
  await new Promise((resolve) => setTimeout(resolve, LOADING_TIME));

  if (Math.random() < CHANCE_SUCESSO) {
    await extendGuildAiSilenceMs(guildId, SILENCIO_MS);
    const untilMs = Number(getServerConfig(guildId, 'guildSilenceUntil')) || Date.now();
    const hora = new Date(untilMs).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });
    return loadingMsg.edit({
      content: `🔇 **Deu certo.** IA e mensagens aleatórias mais quietas neste servidor até **${hora}** (horário de Brasília). O tempo **acumula** se outra pessoa acertar também.`,
      embeds: [],
    });
  }

  return loadingMsg.edit({
    content: `😶 **Não rolou.** Foram **${CALAR_CUSTO}** chars pro ralo. A Yui continua tagarela.`,
    embeds: [],
  });
}
