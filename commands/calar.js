import { SlashCommandBuilder } from "discord.js";
import {
  dbBot,
  getOrCreateUser,
  reduceChars,
  extendGuildAiSilenceMs,
  getServerConfig,
} from "../database.js";

export const name = "calar";

const CALAR_CUSTO = 500;
const SILENCIO_MS = 3 * 60 * 60 * 1000;
const CHANCE_SUCESSO = 1 / 3;

export const data = new SlashCommandBuilder()
  .setName("calar")
  .setDescription(
    `Gasta ${CALAR_CUSTO} chars: 1 em 3 de calar respostas aleatórias da IA no servidor por 3h (tempo acumula).`
  );

export async function execute(client, data) {
  const { userId, displayName, guildId } = data;

  if (!guildId) {
    return data.reply("Isso só funciona em servidor.");
  }

  const user = getOrCreateUser(userId, displayName, guildId);
  if ((user.charLeft || 0) < CALAR_CUSTO) {
    return data.reply(
      `Você precisa de **${CALAR_CUSTO}** chars. Saldo: **${user.charLeft ?? 0}**.`
    );
  }

  reduceChars(userId, guildId, CALAR_CUSTO);

  if (Math.random() < CHANCE_SUCESSO) {
    await extendGuildAiSilenceMs(guildId, SILENCIO_MS);
    const untilMs = Number(getServerConfig(guildId, 'guildSilenceUntil')) || Date.now();
    const hora = new Date(untilMs).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });
    return data.reply(
      `🔇 **Deu certo.** IA e mensagens aleatórias mais quietas neste servidor até **${hora}** (horário de Brasília). O tempo **acumula** se outra pessoa acertar também.`
    );
  }

  return data.reply(
    `😶 **Não rolou.** Foram **${CALAR_CUSTO}** chars pro ralo. A Yui continua tagarela.`
  );
}
