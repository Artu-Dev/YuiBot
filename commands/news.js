import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from "discord.js";
import { generateFakeNews, generateFullArticle } from "../functions/generateNews.js";
import { createNewsImage } from "../functions/newsImage.js";

export const name = "news";

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

    const loadingMsg = data.fromInteraction
      ? await data.reply({
          content: "📰 *Gerando notícia exclusiva...*",
          fetchReply: true,
        })
      : await data.reply("📰 *Gerando notícia exclusiva...*");

    const newsHeadline = await generateFakeNews(channelId, guildId);
    const article = await generateFullArticle(newsHeadline);

    const imageBuffer = await createNewsImage(newsHeadline, article);
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
  } catch (error) {
    console.error('Erro ao gerar fake news:', error);
    await data.reply('vai da pra gerar samerda nao, deu erro aqui boy');
  }
}
