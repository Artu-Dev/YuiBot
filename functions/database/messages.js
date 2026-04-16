import { db } from "../../database.js";
import dayjs from "dayjs";
import { isValidChannelId, isValidGuildId } from "../../functions/validation.js";
import { log } from "../../bot.js";

export function saveMessageContext(channelId, guildId, author, content, userId, messageId = null, imageUrl = null) {
  if (!content && !imageUrl) return;
  if (!isValidChannelId(channelId) || !isValidGuildId(guildId)) return;

  try {
    const timestamp = dayjs().valueOf(); 

    const transaction = db.transaction(() => {
      db.queries.saveMessageContext.run(channelId, guildId, author, content, timestamp, userId, messageId, imageUrl);

      const countRow = db.queries.countMessagesInChannel.get(channelId, guildId);
      if (countRow && countRow.total > 110) {
        db.queries.deleteExcessMessages.run(channelId, guildId, channelId, guildId);
      }
    });
    transaction();
  } catch (error) {
    console.error('[saveMessageContext] Erro ao salvar mensagem:', error);
  }
}

export function getRecentMessages(channelId, guildId, limit = 20) {
  try {
    const rows = db.queries.getRecentMessages.all(channelId, guildId, limit);
    return rows
      .reverse()
      .map((row) => {
        const date = new Date(row.timestamp);
        const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        let messageLine = `[${time}] ${row.author}: ${row.content}`;
        if (row.image_analysis) {
          messageLine += ` [IMAGEM DESCRITA: ${row.image_analysis}]`;
        }
        return messageLine;
      })
      .join("\n");
  } catch (error) {
    log('Erro ao buscar mensagens:' + error, "getRecentMessages", 31);
    return '';
  }
}

export const getRecentMessagesArray = (channelId, guildId, limit = 20) => {
  try {
    const rows = db.queries.getRecentMessagesArray.all(channelId, guildId, limit);
    return rows.reverse();
  } catch (error) {
    console.error('[getRecentMessagesArray] Erro:', error);
    return [];
  }
};

export const getLastAuthorMessage = (channelId, guildId, userId) => {
  if (!isValidChannelId(channelId) || !isValidGuildId(guildId)) {
    return null;
  }
  try {
    const row = db.queries.getLastAuthorMessage.get(userId, guildId, channelId);
    return row ? row.timestamp : null;
  } catch (error) {
    console.error('[getLastAuthorMessage] Erro:', error);
    return null;
  }
};

export function getMessageContextByMessageId(messageId, guildId) {
  try {
    return db.queries.getMessageContextByMessageId.get(messageId, guildId);
  } catch (error) {
    console.error('[getMessageContextByMessageId] Erro:', error);
    return null;
  }
}

export function setMessageImageAnalysis(messageId, guildId, analysis) {
  try {
    db.queries.setMessageImageAnalysis.run(analysis, messageId, guildId);
  } catch (error) {
    console.error('[setMessageImageAnalysis] Erro:', error);
  }
}

export function getPreviousMessageAuthor(channelId, guildId) {
  if (!isValidChannelId(channelId) || !isValidGuildId(guildId)) {
    return null;
  }
  try {
    const row = db.queries.getPreviousMessageAuthor.get(channelId, guildId);
    return row?.userId ?? null;
  } catch (error) {
    console.error('[getPreviousMessageAuthor] Erro:', error);
    return null;
  }
}
