import { getServerConfig } from "../../../database.js";
import { contextFromMessage, safeReplyToMessage } from "../../utils.js";
import { log } from "../../../bot.js";

/**
 * Handler para execução de comandos com prefix
 * Responsabilidades:
 * - Verificar se mensagem é comando
 * - Encontrar comando no client.commands
 * - Executar comando com tratamento de erro
 */

export async function handleCommand(message, client, text) {
  if (!text) return false;

  const guildId = message.guild?.id;
  if (!guildId) return false;

  const prefix = getServerConfig(guildId, 'prefix') || "$";
  if (!text.startsWith(prefix)) return false;

  const raw = text.slice(prefix.length).trim();
  const args = raw.split(/ +/);
  const cmdName = args.shift().toLowerCase();

  const command = client.commands.get(cmdName);
  if (!command) return false;

  if (typeof command.execute !== "function") {
    log(`⚠️ Comando "${cmdName}" sem função execute.`, "Comando", 31);
    return true;
  }

  try {
    await command.execute(client, contextFromMessage(message));
  } catch (error) {
    // Diferenciar erros de API vs erros lógicos
    const isApiError = error?.code === 'ERR_HTTP_REQUEST_TIMEOUT' || 
                       error?.code === 50013 || // Missing Permissions
                       error?.status >= 500;
    
    if (isApiError) {
      log(`⚠️ Erro de API ao executar "${cmdName}": ${error.message}`, "Comando", 33);
    } else {
      log(`❌ Erro ao executar comando "${cmdName}": ${error.message}`, "Comando", 31);
      // Log completo para debug
      if (error.stack) {
        console.error(error.stack);
      }
    }
    
    try {
      const errorMsg = isApiError 
        ? "⚠️ Erro de conexão com Discord, tenta de novo."
        : "❌ Ocorreu um erro ao executar esse comando.";
      
      await safeReplyToMessage(message, errorMsg);
    } catch (e) {
      log(`❌ Falha ao enviar mensagem de erro: ${e.message}`, "Comando", 31);
      // Último recurso: tentar reação apenas
      try {
        await message.react("❌").catch(() => {});
      } catch (reactionError) {
        log(`❌ Falha ao reagir com erro: ${reactionError.message}`, "Comando", 31);
      }
    }
  }

  return true;
}
