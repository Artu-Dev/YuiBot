import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { achievements } from "../functions/achievmentsData.js";
import { resolveAvatarFromContext } from "../functions/utils.js";

export const name = "ajudaconqs";
export const data = new SlashCommandBuilder()
  .setName("ajudaconqs")
  .setDescription("Mostra a lista de todas as conquistas disponíveis.");

const ITEMS_PER_PAGE = 8; 

function createAchievementEmbed(page, totalPages, userAvatar) {
  const allAchievements = Object.values(achievements);

  const visibleAchievements = allAchievements.filter(a => !a.secret);

  const start = page * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const currentPageItems = visibleAchievements.slice(start, end);

  let description = "";

  currentPageItems.forEach(a => {
    const points = a.charPoints ? ` (+${a.charPoints.toLocaleString()} chars)` : "";
    const categoryEmoji = a.category === "special" ? "✨" : "🏆";
    
    description += `${a.icon || "🏅"} **${a.title || a.name}**\n`;
    description += `> ${a.description}\n`;
    if (points) description += `> ${points}\n`;
    description += "\n";
  });

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setAuthor({
      name: "📘 Lista de Conquistas",
      iconURL: userAvatar
    })
    .setTitle(`Conquistas Disponíveis (${visibleAchievements.length} no total)`)
    .setDescription(description || "Nenhuma conquista visível no momento.")
    .setFooter({ 
      text: `Página ${page + 1} de ${totalPages} • Conquistas secretas não aparecem aqui` 
    })
    .setTimestamp();

  return embed;
}

export async function execute(client, data) {
  const userAvatar = resolveAvatarFromContext(data) ?? undefined;

  const allAchievements = Object.values(achievements);
  const visibleCount = allAchievements.filter(a => !a.secret).length;

  if (visibleCount === 0) {
    return data.reply("Nenhuma conquista visível no momento.");
  }

  const totalPages = Math.ceil(visibleCount / ITEMS_PER_PAGE);
  let currentPage = 0;

  const embed = createAchievementEmbed(currentPage, totalPages, userAvatar);

  // Botões de paginação
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("Anterior")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Próxima")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(totalPages <= 1),
    new ButtonBuilder()
      .setCustomId("first")
      .setLabel("⏪")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("last")
      .setLabel("⏩")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1)
  );

  const response = await data.reply({
    embeds: [embed],
    components: totalPages > 1 ? [row] : []
  });

  if (totalPages <= 1) return;

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000, 
    filter: i => i.user.id === data.userId
  });

  collector.on("collect", async (interaction) => {
    await interaction.deferUpdate();

    if (interaction.customId === "prev") currentPage--;
    else if (interaction.customId === "next") currentPage++;
    else if (interaction.customId === "first") currentPage = 0;
    else if (interaction.customId === "last") currentPage = totalPages - 1;

    const newEmbed = createAchievementEmbed(currentPage, totalPages, userAvatar);

    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("Anterior")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Próxima")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages - 1),
      new ButtonBuilder()
        .setCustomId("first")
        .setLabel("⏪")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId("last")
        .setLabel("⏩")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages - 1)
    );

    await interaction.editReply({
      embeds: [newEmbed],
      components: [newRow]
    });
  });

  collector.on("end", () => {
    response.edit({ components: [] }).catch(() => {});
  });
}