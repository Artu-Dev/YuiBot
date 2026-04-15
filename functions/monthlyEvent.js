import dayjs from 'dayjs';
import { db, unlockAchievement, getOrCreateUser } from '../database.js';
import { EmbedBuilder } from 'discord.js';

export async function runMonthlyEvent(client, guildId) {
  if (!guildId) return;

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log(`[MonthlyEvent] Guild ${guildId} não encontrada`);
      return;
    }

    // Pega todos os usuários do servidor
    const users = db.prepare(`
      SELECT id, display_name, charLeft 
      FROM users 
      WHERE guild_id = ? 
      ORDER BY charLeft DESC 
      LIMIT 3
    `).all(guildId);

    if (users.length === 0) {
      console.log(`[MonthlyEvent] Nenhum usuário encontrado em ${guildId}`);
      return;
    }

    // Define os rankings
    const rankings = [
      { position: 1, achievement: 'milionario_do_mes', emoji: '🥇', title: 'Milionário do Mês' },
      { position: 2, achievement: 'ricao_do_mes', emoji: '🥈', title: 'Ricão do Mês' },
      { position: 3, achievement: 'abastado_do_mes', emoji: '🥉', title: 'Abastado do Mês' },
    ];

    // Desbloqueia as conquistas
    const winners = [];
    for (let i = 0; i < Math.min(users.length, 3); i++) {
      const user = users[i];
      const ranking = rankings[i];

      // Desbloqueia a conquista
      unlockAchievement(user.id, guildId, ranking.achievement);
      
      // Verifica se é a 1ª vez ganhando (para milestone)
      const achData = db.prepare(`
        SELECT achievements_unlocked FROM users WHERE id = ? AND guild_id = ?
      `).get(user.id, guildId);

      const achieved = JSON.parse(achData?.achievements_unlocked || '{}');
      
      // Se tem milionario_do_mes e ricao_do_mes e abastado_do_mes, pode premiar reincidente
      if (achieved.milionario_do_mes && achieved.ricao_do_mes && achieved.abastado_do_mes) {
        // Conta quantos meses ganhou milionario
        const milCount = (achieved.milionario_dos_meses_count || 0) + 1;
        if (milCount >= 5 && ranking.position === 1) {
          unlockAchievement(user.id, guildId, 'milionario_reincidente');
        }
      }

      winners.push({
        userId: user.id,
        displayName: user.display_name,
        chars: user.charLeft,
        ...ranking,
      });
    }

    // Cria embed de anúncio
    const embed = new EmbedBuilder()
      .setTitle('📊 FIM DE MÊS - RANKING DE CHARS')
      .setColor(0xFFD700)
      .setDescription(`**${dayjs().format('MMMM YYYY')}**\n\nOs 3 mais ricos do servidor:`)
      .setTimestamp();

    for (const winner of winners) {
      embed.addFields({
        name: `${winner.emoji} ${winner.title}`,
        value: `<@${winner.userId}> — **${winner.chars.toLocaleString()}** chars 💰`,
        inline: false,
      });
    }

    // Posta em todos os canais (tenta postar em channels com permissão)
    const channels = guild.channels.cache.filter(ch => 
      ch.isTextBased() && 
      ch.permissionsFor(guild.members.me).has('SendMessages')
    );

    if (channels.size > 0) {
      const channel = channels.first();
      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    console.log(`[MonthlyEvent] ✅ Evento de fim de mês executado em ${guild.name}`);
  } catch (error) {
    console.error('[MonthlyEvent] Erro:', error);
  }
}

/**
 * Verifica se hoje é o último dia do mês
 */
export function isLastDayOfMonth() {
  const today = dayjs();
  const tomorrow = today.add(1, 'day');
  return today.month() !== tomorrow.month();
}

/**
 * Verifica se é hora de rodar o evento (23:55 do último dia)
 */
export function shouldRunMonthlyEvent() {
  const now = dayjs();
  const isLastDay = isLastDayOfMonth();
  const hour = now.hour();
  const minute = now.minute();
  
  // Roda entre 23:55 e 23:59 do último dia do mês
  return isLastDay && hour === 23 && minute >= 55;
}
