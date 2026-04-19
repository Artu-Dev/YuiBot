import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from "discord.js";
import { generateFakeNews, generateFullArticle } from "../functions/ai/generateNews.js";
import { createNewsImage } from "../functions/newsImage.js";
import { log } from "../bot.js";

export const name = "news";
export const aliases = ["noticia", "notícias", "noticiafalsa", "fakeNews"];

const NEWS_COOLDOWN = 60 * 60 * 1000;
const newsCooldowns = new Map();

export const data = new SlashCommandBuilder()
  .setName("news")
  .setDescription("Gera uma notícia falsa aleatória.");

function parseArgs(data) {
  // No args for news
  return {};
}

export async function execute(client, data) {
  try {
    const guildId = data.guildId;
    const channelId = data.channelId;
    const userId = data.userId;

    if (newsCooldowns.has(userId)) {
      const lastTime = newsCooldowns.get(userId);
      const timeRemaining = NEWS_COOLDOWN - (Date.now() - lastTime);
      const minutes = Math.ceil(timeRemaining / 60000);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("⏰ Cooldown Ativo")
        .setDescription(`Você precisa esperar **${minutes} minuto${minutes > 1 ? 's' : ''}** para gerar outra notícia!`)
        .setTimestamp();

      return data.reply({ embeds: [embed], flags: 64 });
    }

    const loadingMsg = data.fromInteraction
      ? await data.reply({
          content: "📰 *Gerando notícia exclusiva...*",
          fetchReply: true,
        })
      : await data.reply("📰 *Gerando notícia exclusiva...*");

    const newsHeadline = await generateFakeNews(channelId, guildId);
    const article = await generateFullArticle(newsHeadline);

    const guild = client.guilds.cache.get(guildId);
    const imageBuffer = await createNewsImage(newsHeadline, article, guild);
    const attachment = new AttachmentBuilder(imageBuffer, { name: "noticia.png" });

    const embed = new EmbedBuilder()
      .setTitle("📰 ÚLTIMA HORA!")
      .setDescription(`**${newsHeadline}**`)
      .setColor("#C4170C")
      .setImage("attachment://noticia.png")
      .setTimestamp()
      .setFooter({
        text: "⚠️ Esta notícia é 100% REAL PORRA!!!!",
      });

    if (loadingMsg && typeof loadingMsg.edit === "function") {
      await loadingMsg.edit({
        content: null,
        embeds: [embed],
        files: [attachment],
      });
    } else {
      await data.followUp({ embeds: [embed], files: [attachment] });
    }

    newsCooldowns.set(userId, Date.now());

    setTimeout(() => {
      newsCooldowns.delete(userId);
    }, NEWS_COOLDOWN);
  } catch (error) {
    log(`❌ Erro ao gerar notícia: ${error.message}`, "News", 31);
    await data.reply('vai da pra gerar samerda nao, deu erro aqui boy');
  }
}
