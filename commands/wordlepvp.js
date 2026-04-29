import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ChannelFlags,
} from "discord.js";
import {
  getOrCreateUser,
  addChars,
  reduceChars,
  getSpendableChars,
  getServerConfig,
  getBankBalance,
  withdrawFromBank,
} from "../database.js";
import { renderDuetoImage } from "../functions/wordleCanva.js";
import { DICTIONARY, versusPlayedToday, saveVersusResult } from "../functions/database/wordle.js";
import { hasEffect, removeEffect } from '../functions/effects.js';

export const name = "termoversus";
export const aliases = ["versus", "termovs", "wordlevs", "vs"];
export const requiresCharLimit = true;

const JOIN_TIME      = 60_000;
const GAME_TIME      = 600_000;
const MAX_ATT        = 6;
const LOSS_PER_LOSER = 500;

const TEAM_NAMES = [
  "Time Gays Unidos",
  "Time dos Malditos",
  "Ant Zorah's",
  "Time dos Gays Separados",
  "Time Sem Time",
  "Pior Time",
  "Time Cu",
  "Time Meninos",
  "Time Meninas",
  "Equipe Cão",
];

const activeVersusGames = new Map();

let penaltyA = 0;
let penaltyB = 0;
 
for (const pid of teamAIds) {
  if (hasEffect(pid, guildId, 'sabotador')) {
    penaltyB += 2;
    removeEffect(pid, guildId, 'sabotador');
    break; 
  }
}
for (const pid of teamBIds) {
  if (hasEffect(pid, guildId, 'sabotador')) {
    penaltyA += 2;
    removeEffect(pid, guildId, 'sabotador');
    break;
  }
}

function normalizeWord(w) {
  return w.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function checkGuess(normalizedGuess, accentedAnswer) {
  const normAnswer = accentedAnswer.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const result = Array.from({ length: 5 }, (_, i) => ({
    letter: normalizedGuess[i],
    status: "absent",
  }));

  const used = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (normalizedGuess[i] === normAnswer[i]) {
      result[i].status = "correct";
      result[i].letter = accentedAnswer[i];
      used[i]          = true;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i].status === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && normalizedGuess[i] === normAnswer[j]) {
        result[i].status = "present";
        used[j]          = true;
        break;
      }
    }
  }

  return result;
}

function pickTwoWords() {
  const words = [...DICTIONARY];
  const idx1  = Math.floor(Math.random() * words.length);
  let   idx2  = Math.floor(Math.random() * (words.length - 1));
  if (idx2 >= idx1) idx2++;
  return [words[idx1], words[idx2]];
}

function pickTeamNames() {
  const shuffled = [...TEAM_NAMES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

async function replaceMessage(oldMsg, payload) {
  await oldMsg.delete().catch(() => {});
  return oldMsg.channel.send(payload);
}

async function deductWithBankFallback(userId, guildId, amount) {
  const available = await getSpendableChars(userId, guildId);

  if (available >= amount) {
    await reduceChars(userId, guildId, amount);
    return { chars: amount, bank: 0 };
  }

  if (available > 0) await reduceChars(userId, guildId, available);

  const remainder = amount - available;
  const bankBal   = await getBankBalance(userId, guildId);
  const fromBank  = Math.min(remainder, bankBal);

  if (fromBank > 0) await withdrawFromBank(userId, guildId, fromBank);

  return { chars: available, bank: fromBank };
}

async function startVersusGame(client, channel, initialMsg, answerA, answerB, teamA, teamB, nameA, nameB, guildId) {
  const attemptsA    = [];
  const attemptsB    = [];
  const usedLettersA = {};
  const usedLettersB = {};
  let solvedA        = false;
  let solvedB        = false;

  const teamAIds = new Set(teamA.keys());
  const teamBIds = new Set(teamB.keys());
  const maxAttA = MAX_ATT - penaltyA;
  const maxAttB = MAX_ATT - penaltyB;

  const formatTeam = (team, label) =>
    `**${label}**\n${[...team.values()].map(n => `• ${n}`).join("\n")}`;

  const statusLine = () => {
    const a = solvedA ? `${nameA}: resolvida` : `${nameA}: ${attemptsA.length}/${maxAttA}`;
    const b = solvedB ? `${nameB}: resolvida` : `${nameB}: ${attemptsB.length}/${maxAttB}`;
    return `${a}  |  ${b}`;
  };

  const buildPayload = (footerText, desc, color = "#E74C3C") => {



    const buffer     = renderDuetoImage(attemptsA, attemptsB, usedLettersA, usedLettersB, solvedA, solvedB);
    const attachment = new AttachmentBuilder(buffer, { name: "versus.png" });
    const embed      = new EmbedBuilder()
      .setColor(color)
      .setTitle("Termo Versus")
      .setImage("attachment://versus.png")
      .setDescription(desc)
      .setFooter({ text: footerText });
    return { embeds: [embed], files: [attachment] };
  };

  const mainDesc = () => [
    formatTeam(teamA, nameA),
    "",
    formatTeam(teamB, nameB),
    "",
    statusLine(),
    "",
    "Cada time tenta adivinhar sua própria palavra. Primeiro a acertar leva os chars do adversário.",
  ].join("\n");

  let currentMsg = await replaceMessage(
    initialMsg,
    buildPayload(`${nameA}: 0/${maxAttA}  |  ${nameB}: 0/${maxAttB}`, mainDesc())
  );

  const collector = channel.createMessageCollector({
    filter: msg =>
      (teamAIds.has(msg.author.id) || teamBIds.has(msg.author.id)) &&
      /^[a-zA-ZÀ-ú]{5}$/.test(msg.content.trim()),
    time: GAME_TIME,
  });

  const finish = async ({ winner, loser, winnerLabel, loserLabel, triggerMsg = null, draw = false }) => {
    collector.stop("finished");
    activeVersusGames.delete(guildId);

    const allPlayerIds = [...teamAIds, ...teamBIds];
    saveVersusResult({
      guildId,
      word1: answerA,
      word2: answerB,
      winner: draw ? null : winnerLabel,
      draw,
      playerIds: allPlayerIds,
    });

    let color, title, desc;

    if (draw) {
      color = "#95A5A6";
      title = "Empate";
      desc  = [
        "Nenhum time conseguiu resolver.",
        "",
        `Palavra do ${nameA}: **${answerA}**`,
        `Palavra do ${nameB}: **${answerB}**`,
      ].join("\n");

      currentMsg = await replaceMessage(currentMsg, buildPayload(`Empate — ${answerA} | ${answerB}`, mainDesc(), color));
    } else {
      const winnerIds      = [...winner.keys()];
      const loserIds       = [...loser.keys()];
      const deductions     = [];
      let   totalCollected = 0;

      for (const pid of loserIds) {
        const { chars, bank } = await deductWithBankFallback(pid, guildId, LOSS_PER_LOSER);
        totalCollected += chars + bank;
        deductions.push({ pid, chars, bank });
      }

      const rewardPerWin = Math.floor(totalCollected / winnerIds.length);
      for (const pid of winnerIds) await addChars(pid, guildId, rewardPerWin);

      const guesserName = triggerMsg ? (winner.get(triggerMsg.author.id) ?? winnerLabel) : winnerLabel;

      const lossLines = deductions.map(({ pid, chars, bank }) => {
        const pName = loser.get(pid);
        if (chars > 0 && bank > 0) return `• ${pName}: -${chars} chars e -${bank} do banco`;
        if (bank > 0)              return `• ${pName}: -${bank} do banco (sem chars)`;
        return                            `• ${pName}: -${chars} chars`;
      });

      color = "#F1C40F";
      title = `${winnerLabel} venceu`;
      desc  = [
        `**${guesserName}** acertou e deu a vitória pro **${winnerLabel}**.`,
        "",
        `Palavra do ${nameA}: **${answerA}**`,
        `Palavra do ${nameB}: **${answerB}**`,
        "",
        `**${loserLabel}** perdeu ${LOSS_PER_LOSER} chars cada:`,
        ...lossLines,
        "",
        `**${winnerLabel}** recebeu **${totalCollected} chars** — **+${rewardPerWin}** cada.`,
      ].join("\n");

      currentMsg = await replaceMessage(currentMsg, buildPayload(`${winnerLabel} venceu`, mainDesc(), color));
    }

    await channel.send({
      embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc)],
    });
  };

  // ── Processa guesses ─────────────────────────────────────────────────────────
  collector.on("collect", async (msg) => {
    const rawGuess   = msg.content.trim();
    const guess      = normalizeWord(rawGuess);
    const willDelete = msg.delete().catch(() => {});

    if (!DICTIONARY.has(guess)) {
      await willDelete;
      const inv = await channel.send(`"${rawGuess}" não é uma palavra válida.`);
      setTimeout(() => inv.delete().catch(() => {}), 4000);
      return;
    }

    const isTeamA     = teamAIds.has(msg.author.id);
    const guesserName = isTeamA ? teamA.get(msg.author.id) : teamB.get(msg.author.id);

    if (isTeamA && solvedA)  { await willDelete; return; }
    if (!isTeamA && solvedB) { await willDelete; return; }

    if (isTeamA) {
      const result = checkGuess(guess, answerA);
      attemptsA.push(result);
      for (const { letter, status } of result) {
        const prev = usedLettersA[letter];
        if (prev !== "correct" && !(prev === "present" && status === "absent"))
          usedLettersA[letter] = status;
      }
      if (result.every(r => r.status === "correct")) solvedA = true;
    } else {
      const result = checkGuess(guess, answerB);
      attemptsB.push(result);
      for (const { letter, status } of result) {
        const prev = usedLettersB[letter];
        if (prev !== "correct" && !(prev === "present" && status === "absent"))
          usedLettersB[letter] = status;
      }
      if (result.every(r => r.status === "correct")) solvedB = true;
    }

    await willDelete;

    const aExhausted = !solvedA && attemptsA.length >= maxAttA;
    const bExhausted = !solvedB && attemptsB.length >= maxAttB;

    if (solvedA && !solvedB && !bExhausted)
      return finish({ winner: teamA, loser: teamB, winnerLabel: nameA, loserLabel: nameB, triggerMsg: msg });
    if (solvedB && !solvedA && !aExhausted)
      return finish({ winner: teamB, loser: teamA, winnerLabel: nameB, loserLabel: nameA, triggerMsg: msg });
    if (solvedA && solvedB)
      return finish({ winner: teamA, loser: teamB, winnerLabel: nameA, loserLabel: nameB, triggerMsg: msg });
    if (aExhausted && !solvedB)
      return finish({ winner: teamB, loser: teamA, winnerLabel: nameB, loserLabel: nameA });
    if (bExhausted && !solvedA)
      return finish({ winner: teamA, loser: teamB, winnerLabel: nameA, loserLabel: nameB });
    if (aExhausted && bExhausted)
      return finish({ draw: true });

    currentMsg = await replaceMessage(
      currentMsg,
      buildPayload(
        `${nameA}: ${attemptsA.length}/${maxAttA}  |  ${nameB}: ${attemptsB.length}/${maxAttB}  |  ${guesserName}`,
        mainDesc()
      )
    );
  });

  collector.on("end", async (_, reason) => {
    if (reason === "finished") return;
    activeVersusGames.delete(guildId);

    if (solvedA && !solvedB) return finish({ winner: teamA, loser: teamB, winnerLabel: nameA, loserLabel: nameB });
    if (solvedB && !solvedA) return finish({ winner: teamB, loser: teamA, winnerLabel: nameB, loserLabel: nameA });
    return finish({ draw: true });
  });
}


export async function execute(client, data) {
  const { userId, guildId, displayName } = data;

  if (!getServerConfig(guildId, "charLimitEnabled"))
    return data.reply("O sistema de caracteres está desligado neste servidor.");
  if (activeVersusGames.has(guildId))
    return data.reply("Já tem uma partida de Versus rolando neste servidor.");
  if (versusPlayedToday(guildId))
    return data.reply("O Versus de hoje já foi jogado. Volte amanhã.");

  getOrCreateUser(userId, displayName, guildId);

  const players = new Map([[userId, displayName]]);
  activeVersusGames.set(guildId, true);

  const buildLobbyEmbed = () =>
    new EmbedBuilder()
      .setColor("#E74C3C")
      .setTitle("Termo Versus — Lobby")
      .setDescription([
        `**${displayName}** quer uma batalha de Termo.`,
        "",
        "Os jogadores serão divididos aleatoriamente em dois times.",
        "Cada time recebe uma palavra diferente e tenta resolver antes do adversário.",
        "",
        `O time perdedor perde **${LOSS_PER_LOSER} chars** cada — que vão direto pro time vencedor.`,
        "Se não tiver chars suficientes, o restante é descontado do banco.",
        "",
        `**Inscritos (${players.size}):**`,
        ...[...players.values()].map(n => `• ${n}`),
      ].join("\n"))
      .setFooter({ text: "Mínimo 2 jogadores para iniciar." });

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("versus_join")
      .setLabel("Entrar")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("versus_start")
      .setLabel("Começar")
      .setStyle(ButtonStyle.Danger)
  );

  const lobbyMsg = await data.reply({
    embeds: [buildLobbyEmbed()],
    components: [joinRow],
    withResponse: true,
  });

  const joinCollector = lobbyMsg.createMessageComponentCollector({ time: JOIN_TIME });

  joinCollector.on("collect", async (btnInt) => {
    if (btnInt.customId === "versus_join") {
      if (players.has(btnInt.user.id))
        return btnInt.reply({ content: "Você já está inscrito.", flags: ChannelFlags.Ephemeral });
      getOrCreateUser(btnInt.user.id, btnInt.user.displayName, guildId);
      players.set(btnInt.user.id, btnInt.user.displayName);
      return btnInt.update({ embeds: [buildLobbyEmbed()] });
    }

    if (btnInt.customId === "versus_start") {
      if (btnInt.user.id !== userId)
        return btnInt.reply({ content: "Só quem iniciou pode forçar o começo.", flags: ChannelFlags.Ephemeral });
      if (players.size < 2)
        return btnInt.reply({ content: "Precisa de pelo menos 2 jogadores.", flags: ChannelFlags.Ephemeral });

      joinCollector.stop("force_start");
      await btnInt.deferUpdate().catch(() => {});
    }
  });

  joinCollector.on("end", async () => {
    if (players.size < 2) {
      activeVersusGames.delete(guildId);
      return lobbyMsg.edit({
        embeds: [
          new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("Versus cancelado")
            .setDescription("Não apareceram jogadores suficientes. Precisa de pelo menos 2 pessoas."),
        ],
        components: [],
      });
    }

    const shuffled       = [...players.entries()].sort(() => Math.random() - 0.5);
    const half           = Math.ceil(shuffled.length / 2);
    const teamA          = new Map(shuffled.slice(0, half));
    const teamB          = new Map(shuffled.slice(half));
    const [nameA, nameB] = pickTeamNames();
    const [answerA, answerB] = pickTwoWords();

    const revealEmbed = new EmbedBuilder()
      .setColor("#E74C3C")
      .setTitle("Times Formados")
      .setDescription([
        `**${nameA}:**\n${[...teamA.values()].map(n => `• ${n}`).join("\n")}`,
        "",
        `**${nameB}:**\n${[...teamB.values()].map(n => `• ${n}`).join("\n")}`,
        "",
        "O jogo começa em instantes.",
      ].join("\n"))
      .setFooter({ text: `${LOSS_PER_LOSER} chars cada do time perdedor vão pro time vencedor.` });

    await lobbyMsg.edit({ embeds: [revealEmbed], components: [] });

    setTimeout(
      () => startVersusGame(client, lobbyMsg.channel, lobbyMsg, answerA, answerB, teamA, teamB, nameA, nameB, guildId),
      3000
    );
  });
}