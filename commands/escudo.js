import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, reduceChars, setEscudo, getEscudoExpiry } from "../database.js";
import { applyClassModifier, CLASSES, ESCUDO_BLOCK_BASE } from "../functions/classes.js";

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
    return sub === "info" ? "info" : "comprar";
  }
  const a = data.args ?? [];
  const head = a[0]?.toLowerCase();
  if (head === "info" || head === "stats") return "info";
  return "comprar";
}

function formatCostDelta(costMod) {
  const pct = Math.round(costMod * 100);
  if (pct === 0) return "sua classe não altera o preço base.";
  const dir = pct > 0 ? "aumenta" : "reduz";
  return `sua classe **${dir}** o preço em **${Math.abs(pct)}%** em relação aos **${ESCUDO_COST_BASE}** chars base (só custo, não afeta bloqueio).`;
}

function escudoInfoEmbed(user) {
  const clsKey = user.user_class || "none";
  const cls = CLASSES[clsKey] ?? CLASSES.none;
  const finalCost = applyClassModifier(ESCUDO_COST_BASE, "escudoCost", clsKey);
  const bonusMod = cls.modifiers?.escudoBonus ?? 0;
  const costMod = cls.modifiers?.escudoCost ?? 0;

  const blockRate = ESCUDO_BLOCK_BASE + bonusMod;
  const blockPct = Math.min(100, Math.max(0, Math.round(blockRate * 100)));
  const deltaPp = Math.round(bonusMod * 100);
  const deltaLine =
    deltaPp === 0
      ? "sua classe **não** altera a chance (fica na base)."
      : deltaPp > 0
        ? `sua classe **soma +${deltaPp} p.p.** na base (**+** = mais chance de bloquear).`
        : `sua classe **soma ${deltaPp} p.p.** na base (**−** = menos chance de bloquear).`;

  return new EmbedBuilder()
    .setColor("#3BA55D")
    .setTitle("🛡️ Escudo — informações")
    .setDescription(
      "Com **escudo ativo**, cada tentativa de roubo contra você pode ser **bloqueada** (você não perde chars nessa tentativa).\n\n" +
        "**Preço** e **bloqueio** são coisas diferentes: o desconto no preço **não** muda a % de bloqueio."
    )
    .addFields(
      {
        name: "💰 Quanto você paga",
        value:
          `**${finalCost.toLocaleString()}** chars para ativar\n` +
          `(${formatCostDelta(costMod)})`,
        inline: false,
      },
      {
        name: "⏱️ Duração",
        value: `**${ESCUDO_HOURS} horas** após comprar`,
        inline: true,
      },
      {
        name: "🚫 Chance de bloquear o roubo",
        value:
          `**~${blockPct}%** com escudo ativo\n` +
          `• Base do bot: **${Math.round(ESCUDO_BLOCK_BASE * 100)}%**\n` +
          `• ${deltaLine}\n` +
          `_p.p. = pontos percentuais somados à base (não é “% de desconto” do escudo)._`,
        inline: false,
      },
      {
        name: "Classe",
        value: `**${cls.name}**`,
        inline: true,
      }
    );
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
    `🛡️ ${displayName} comprou proteção. Custa **${classCost} chars**, dura **${ESCUDO_HOURS}h**. Quem tentar roubar vai se machucar.`,
  ];

  await data.reply(activateReplies[Math.floor(Math.random() * activateReplies.length)]);
}
