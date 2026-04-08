import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getOrCreateUser, getBotPrefix } from "../database.js";
import { unlockClass, CLASSES } from "../functions/classes.js";

const attributeDescriptions = {
  lucky: "Sorte no tigre",
  robCost: "Custo de roubo",
  robDamage: "Dano de roubo",
  robDefense: "Defesa contra roubo",
  robSuccess: "Chance de sucesso do roubo",
  singleRobSuccess: "Chance de sucesso do roubo específico",
  singleRobDamage: "Dano do roubo específico",
  escudoBonus: "Bônus de defesa do escudo",
  escudoCost: "Desconto no custo do escudo",
};

function parseClasseArgs(data) {
  if (data.fromInteraction) {
    return {
      subcommand: data.getString("ação"),
      className: data.getString("classe"),
    };
  }

  const args = data.args ?? [];
  let subcommand = null;
  let className = null;
  const positional = [];

  for (const raw of args) {
    const t = String(raw).trim();
    if (!t) continue;
    const colon = t.indexOf(":");
    if (colon !== -1) {
      const key = t.slice(0, colon).toLowerCase().replace(/\s/g, "");
      const val = t.slice(colon + 1).trim().toLowerCase();
      if (key === "ação" || key === "acao") subcommand = val;
      else if (key === "classe") className = val;
      continue;
    }
    positional.push(t.toLowerCase());
  }

  if (positional[0] === "info" || positional[0] === "escolher") {
    subcommand = positional[0];
    if (positional[1]) className = positional[1].toLowerCase().trim() || null;
  }

  return {
    subcommand,
    className: className || null,
  };
}

export const name = "classe";

export const data = new SlashCommandBuilder()
  .setName("classe")
  .setDescription("Sistema de classes (none, ladrao, pobre, agiota, maldito, fodao).")
  .addStringOption(option =>
    option.setName("ação")
      .setDescription("O que você quer fazer?")
      .addChoices(
        { name: "info", value: "info" },
        { name: "escolher", value: "escolher" }
      )
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("classe")
      .setDescription("A classe que quer escolher ou ver info")
      .addChoices(
        { name: "nenhum (sem classe)", value: "none" },
        { name: "ladrao", value: "ladrao" },
        { name: "pobre", value: "pobre" },
        { name: "agiota", value: "agiota" },
        { name: "maldito", value: "maldito" },
        { name: "fodao", value: "fodao" }
      )
      .setRequired(false)
  );

export async function execute(client, data) {
  const { userId, guildId, displayName } = data;
  const userData = getOrCreateUser(userId, displayName, guildId);

  const { subcommand, className } = parseClasseArgs(data);

  if ((subcommand === "info" || subcommand === "escolher") && !className) {
    return data.reply({
      content: "⚠️ Você precisa informar a **classe** ao usar essa ação!",
      ephemeral: true,
    });
  }

  switch (subcommand) {
    case null:
    case undefined:
      return handleList(data, userData);
    case "info":
      return handleInfo(data, className);
    case "escolher":
      return handleChoose(data, userData, userId, guildId, className);
    default:
      return data.reply({ content: "❌ subcomando inválido.", ephemeral: true });
  }
}

function handleList(data, userData) {
  const p = getBotPrefix();
  const current = CLASSES[userData.user_class ?? "none"];

  const classList = Object.entries(CLASSES)
    .map(([key, c]) => {
      const affordable = userData.charLeft >= c.unlockCost;
      const owned = userData.user_class === key;

      let status = "";
      if (owned) status = "[**☑️**]";
      else if (affordable) status = "[**🔓**]";
      else status = "[**🚫**]";

      const cost = c.unlockCost > 0
        ? ` — ${c.unlockCost.toLocaleString()} chars`
        : " — GRÁTIS";

      return `${status} **${c.name}**${cost}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("CLASSES DA YUI!!!")
    .setDescription(`**Sua classe agora:** ${current.name}\n> ${current.description}`)
    .addFields(
      { name: "CLASSES", value: classList, inline: false },
      {
        name: "💡 COMO USAR MANO",
        value:
          "**Slash:** `/classe` com opções no menu.\n" +
          `**Prefixo:** \`${p}classe\` lista · \`${p}classe info <classe>\` · \`${p}classe escolher <classe>\` (\`none\` = sem classe)`,
        inline: false,
      }
    )
    .setFooter({ text: `Seus chars: ${userData.charLeft.toLocaleString()}` });

  return data.reply({ embeds: [embed] });
}

function handleInfo(data, className) {
  const target = CLASSES[className];
  if (!target) {
    return data.reply({
      content: `❌ Classe **${className ?? "?"}** não achada krl.`,
      ephemeral: true,
    });
  }

  const perks = Object.entries(target.modifiers)
    .map(([key, value]) => `▸ ${attributeDescriptions[key] || key}: ${value}`)
    .join("\n") || "Nenhum benefício foda por enquanto.";

  const embed = new EmbedBuilder()
    .setTitle(`# ${target.name} - DETALHES`)
    .setDescription(target.description)
    .addFields(
      { name: "➤  O QUE GANHA", value: perks, inline: false },
      {
        name: "➤  CUSTO",
        value: target.unlockCost > 0
          ? `${target.unlockCost.toLocaleString()} chars`
          : "GRÁTIS PORRA",
        inline: true,
      }
    );

  return data.reply({ embeds: [embed] });
}

function handleChoose(data, userData, userId, guildId, className) {
  const target = CLASSES[className];
  if (!target) {
    return data.reply({ content: `❌ Classe **${className}** não existe porra.`, ephemeral: true });
  }

  const currentClass = userData.user_class ?? "none";
  if (currentClass === className) {
    return data.reply({ content: `ℹ️ tu já é **${target.name}**, relaxa.`, ephemeral: true });
  }

  if (className !== "none" && userData.charLeft < target.unlockCost) {
    const falta = (target.unlockCost - userData.charLeft).toLocaleString();
    return data.reply({
      content: `❌ Chars insuficientes mano. Faltam **${falta}** pra liberar **${target.name}** krl.`,
      ephemeral: true,
    });
  }

  const success = unlockClass(userId, guildId, className);
  if (!success) {
    return data.reply({ content: "❌ deu ruim krl. Tenta de novo mano.", ephemeral: true });
  }

  if (className === "none") {
    const embed = new EmbedBuilder()
      .setTitle("SEM CLASSE")
      .setDescription(`Você voltou pra **${target.name}** — sem modificadores de classe.`)
      .setFooter({ text: `Seus chars: ${userData.charLeft.toLocaleString()}` });
    return data.reply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setTitle("CLASSE ESCOLHIDA PAE!!")
    .setDescription(`**${target.name}**\n> ${target.description}`)
    .addFields(
      {
        name: "BENEFÍCIOS",
        value: Object.entries(target.modifiers)
          .map(([key, value]) => `• ${attributeDescriptions[key] || key}: ${value}`)
          .join("\n"),
        inline: false,
      },
      { name: "Custo pago", value: `${target.unlockCost.toLocaleString()} chars`, inline: true },
      { name: "Chars restantes", value: `${(userData.charLeft - target.unlockCost).toLocaleString()}`, inline: true }
    );

  return data.reply({ embeds: [embed] });
}