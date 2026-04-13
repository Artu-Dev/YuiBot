import { log } from "../bot.js";
import { db } from "../database.js";

export async function cleanupLeftUsers(client) {
  let totalRemoved = 0;

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const members = await guild.members.fetch();
      const memberIds = new Set(members.keys());

      const dbUsers = db.prepare("SELECT id FROM users WHERE guild_id = ?").all(guildId);

      const toRemove = dbUsers.filter(u => !memberIds.has(u.id));
      
      if (toRemove.length > 0) { 
        const deleteStmt = db.prepare("DELETE FROM users WHERE id = ? AND guild_id = ?");
        const deleteAll = db.transaction((users) => {
          for (const user of users) {
            deleteStmt.run(user.id, guildId);
          }
        });
        
        deleteAll(toRemove);
        totalRemoved += toRemove.length;
        
        log( `[${guild.name}] ${toRemove.length} usuário(s) removido(s) do banco`, "Limpeza", 32);
      }
    } catch (err) {
      log(`❌ Erro ao limpar guild ${guildId}: ${err.message}`, "Limpeza", 31);
    }
  }

  if (totalRemoved === 0) return

  log(`Limpeza concluída. Total removido: ${totalRemoved} usuário(s).`, "Limpeza", 32);
}