import { log } from "../bot.js";
import { db } from "../database.js";

export async function cleanupLeftUsers(client) {
  let totalRemoved = 0;

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      if (guild.memberCount !== guild.members.cache.size) {
        await guild.members.fetch();
      }

      const memberIds = guild.members.cache.keys();
      const memberArray = Array.from(memberIds);
      
      if (memberArray.length === 0) {
        const result = db.prepare("DELETE FROM users WHERE guild_id = ?").run(guildId);
        totalRemoved += result.changes;
        log(`[${guild.name}] Todos os usuários removidos (guilda vazia)`, "Limpeza", 32);
      } else {
        const placeholders = memberArray.map(() => '?').join(',');
        const stmt = db.prepare(`DELETE FROM users WHERE guild_id = ? AND id NOT IN (${placeholders})`);
        
        const result = stmt.run(guildId, ...memberArray);
        totalRemoved += result.changes;
        
        if (result.changes > 0) {
          log(`[${guild.name}] ${result.changes} usuário(s) removido(s) do banco`, "Limpeza", 32);
        }
      }
    } catch (err) {
      log(`❌ Erro ao limpar guild ${guildId}: ${err.message}`, "Limpeza", 31);
    }
  }

  if (totalRemoved > 0) {
    log(`Limpeza concluída. Total removido: ${totalRemoved} usuário(s).`, "Limpeza", 32);
  }
}