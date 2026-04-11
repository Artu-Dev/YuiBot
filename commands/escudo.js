import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, reduceChars, setEscudo, getEscudoExpiry } from "../database.js";
import { applyClassModifier, CLASSES, ESCUDO_BLOCK_BASE } from "../functions/classes.js";
import { sample } from 'es-toolkit';

export const name = "escudo";

export const ESCUDO_COST_BASE = 300;
export const ESCUDO_HOURS = 24;

export const data = new SlashCommandBuilder()
  .setName("escudo")
  .setDescription("Escudo contra roubos: comprar proteção ou ver preço e bloqueio.")
  .addSubcommand((sc) =>
    sc
      .setName("comprar")
      .setDescription("Gasta chars e ativa escudo por 24 horas")
  )
  .addSubcommand((sc) =>
    sc
      .setName("info")
      .setDescription("Preço do escudo e chance de bloquear roubo (com escudo ativo)")
  );

function getMode(data) {
  if (data.fromInteraction) {
    const sub = data.getSubcommand(false);
    return sub === "comprar" ? "comprar" : "info";
  }
  const a = data.args ?? [];
  const head = a[0]?.toLowerCase();
  if (head === "comprar" || head === "buy") return "comprar";
  return "info";
}

function escudoInfoEmbed(user) {
  const clsKey = user.user_class || "none";
  const cls = CLASSES[clsKey] ?? CLASSES.none;

  const finalCost = applyClassModifier(ESCUDO_COST_BASE, "escudoCost", clsKey);
  const bonusMod = cls.modifiers?.escudoBonus ?? 0;
  const costMod = cls.modifiers?.escudoCost ?? 0;

  const blockRate = ESCUDO_BLOCK_BASE + bonusMod;
  const blockPct = Math.min(100, Math.max(0, Math.round(blockRate * 100)));

  const pctCost = Math.round(costMod * 100);
  const costText = pctCost === 0 
    ? "preço normal" 
    : pctCost > 0 
      ? `+${pctCost}% mais caro` 
      : `${pctCost}% mais barato`;

  const defenseText = bonusMod === 0 
    ? "chance normal" 
    : bonusMod > 0 
      ? `+${Math.round(bonusMod * 100)}% de defesa` 
      : `${Math.round(bonusMod * 100)}% menos defesa`;

  return new EmbedBuilder()
    .setColor("#3BA55D")
    .setTitle("🛡️ Escudo — Informações")
    .setDescription("Com o escudo ativo, a chance de ser roubado é reduzida drasticamente.")
    .addFields(
      {
        name: "💰 Quanto custa",
        value: `**${finalCost.toLocaleString()} chars**\n_${costText}_`,
        inline: true,
      },
      {
        name: "🛡️ Quanto defende",
        value: `**${blockPct}%** de chance de bloquear roubo\n_${defenseText}_`,
        inline: true,
      },
      {
        name: "⏱️ Duração",
        value: "**24 horas**",
        inline: true,
      }
    )
    .setFooter({ text: "Preço e defesa são alterados pela sua classe" });
}

export async function execute(client, data) {
  const mode = getMode(data);
  const userId = data.userId;
  const guildId = data.guildId;
  const displayName = data.displayName;

  const user = getOrCreateUser(userId, displayName, guildId);

  if (mode === "info") {
    return data.reply({ embeds: [escudoInfoEmbed(user)] });
  }

  const currentExpiry = getEscudoExpiry(userId, guildId);
  if (currentExpiry) {
    const horasRestantes = Math.ceil(
      (currentExpiry.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    await data.reply(
      `Você já tem um escudo ativo! Expira em **${horasRestantes}h**. Para que comprar dois?`
    );
    return;
  }

  const classCost = applyClassModifier(ESCUDO_COST_BASE, "escudoCost", user.user_class || "none");

  if ((user.charLeft || 0) < classCost) {
    await data.reply(
      `O escudo custa **${classCost} chars** e você só tem **${user.charLeft ?? 0}**. Junta dinheiro antes.`
    );
    return;
  }

  reduceChars(userId, guildId, classCost);
  setEscudo(userId, guildId, ESCUDO_HOURS);

  const activateReplies = [
    `🛡️ ${displayName} ativou um escudo por **${ESCUDO_HOURS}h** por **${classCost} chars**. Tenta roubar agora, playboy.`,
    `🛡️ Escudo ativado! ${displayName} pagou **${classCost} chars** pra ficar intocável por **${ESCUDO_HOURS}h**.`,
    `🛡️ ${displayName} comprou pagou **${classCost} chars**, para os cara proteger ele por **${ESCUDO_HOURS}h**. Quem tentar roubar vai se machucar.`,
  ];

  await data.reply(sample(activateReplies));
}