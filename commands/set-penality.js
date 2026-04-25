import {
  SlashCommandBuilder,
  ChannelFlags,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getOrCreateUser, setUserPenality } from "../database.js";
import { penaltiesData } from "../data/penaltiesData.js";

export const name = "set-penalty";
export const aliases = ["set-penalidade","set-penality", "add-penalty", "add-penalidade", "add-p", "set-p"];

const PENALTIES = Object.entries(penaltiesData).map(([key, data]) => ({ key, nome: data.nome }));

export const data = new SlashCommandBuilder()
  .setName("set-penalty")
  .setDescription("Adiciona uma penalidade a um usuário.");

export async function execute(client, data) {
  const { guildId } = data;

  if (!data.isAdmin()) {
    return data.reply({
      content: "❌ Apenas administradores podem usar este comando.",
      flags: ChannelFlags.Ephemeral,
    });
  }

  const userSelect = new UserSelectMenuBuilder()
    .setCustomId("pen_select_user")
    .setPlaceholder("Selecione o usuário para aplicar a penalidade")
    .setMinValues(1)
    .setMaxValues(1);

  const cancelBtn = new ButtonBuilder()
    .setCustomId("pen_cancel")
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Secondary);

  const embed = new EmbedBuilder()
    .setTitle("Aplicar Penalidade")
    .setDescription("**Etapa 1/2** — Selecione o usuário que receberá a penalidade.")
    .setColor(0xe74c3c);

  const reply = await data.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(userSelect),
      new ActionRowBuilder().addComponents(cancelBtn),
    ],
    flags: ChannelFlags.Ephemeral,
    withResponse: true,
  });

  const collector = reply.createMessageComponentCollector({ time: 60_000 });

  let selectedUser = null;

  collector.on("collect", async (comp) => {
    if (comp.user.id !== data.userId) return;

    if (comp.customId === "pen_cancel") {
      collector.stop("cancelled");
      return comp.update({ content: "❌ Cancelado.", embeds: [], components: [] });
    }

    if (comp.customId === "pen_select_user") {
      const targetId = comp.values[0];
      const targetMember = await comp.guild.members.fetch(targetId).catch(() => null);
      selectedUser = { id: targetId, username: targetMember?.user?.username ?? targetId };

      const penaltySelect = new StringSelectMenuBuilder()
        .setCustomId("pen_select_penalty")
        .setPlaceholder("Selecione a penalidade")
        .addOptions(
          PENALTIES.map((p) => ({
            label: p.nome,
            value: p.key,
          }))
        );

      const backBtn = new ButtonBuilder()
        .setCustomId("pen_back")
        .setLabel("Voltar")
        .setStyle(ButtonStyle.Secondary);

      const stepEmbed = new EmbedBuilder()
        .setTitle("Aplicar Penalidade")
        .setDescription(
          `**Etapa 2/2** — Escolha a penalidade para <@${targetId}>:`
        )
        .setColor(0xe74c3c);

      return comp.update({
        embeds: [stepEmbed],
        components: [
          new ActionRowBuilder().addComponents(penaltySelect),
          new ActionRowBuilder().addComponents(backBtn, cancelBtn),
        ],
      });
    }

    if (comp.customId === "pen_back") {
      selectedUser = null;

      const stepEmbed = new EmbedBuilder()
        .setTitle("Aplicar Penalidade")
        .setDescription("**Etapa 1/2** — Selecione o usuário que receberá a penalidade.")
        .setColor(0xe74c3c);

      return comp.update({
        embeds: [stepEmbed],
        components: [
          new ActionRowBuilder().addComponents(userSelect),
          new ActionRowBuilder().addComponents(cancelBtn),
        ],
      });
    }

    if (comp.customId === "pen_select_penalty" && selectedUser) {
      const penaltyKey = comp.values[0];
      const penaltyNome = penaltiesData[penaltyKey]?.nome ?? penaltyKey;

      getOrCreateUser(selectedUser.id, selectedUser.username, guildId);
      const added = setUserPenality(selectedUser.id, guildId, penaltyKey, true);

      collector.stop("done");

      if (!added) {
        return comp.update({
          content: `⚠️ <@${selectedUser.id}> já possui a penalidade **${penaltyNome}**.`,
          embeds: [],
          components: [],
        });
      }

      return comp.update({
        content: `✅ Penalidade **${penaltyNome}** aplicada a <@${selectedUser.id}>!`,
        embeds: [],
        components: [],
      });
    }
  });

  collector.on("end", (_, reason) => {
    if (reason === "time") {
      reply.edit({ content: "⏰ Tempo esgotado.", embeds: [], components: [] }).catch(() => {});
    }
  });
}