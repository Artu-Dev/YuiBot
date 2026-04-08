export const achievementsByUpdate = {
  night_owl_messages:   ["night_owl", "insone"],
  messages_sent:        ["chatterbox", "first_message", "chat_legend"],
  caps_lock_messages:   ["caps_addict"],
  question_marks:       ["question_everything"],
  morning_messages:     ["good_morning"],
  laught_messages:      ["funny_today"],
  swears_count:         ["dirty_mouth", "vocabulario_rico"],
  long_questions:       ["philosopher"],
  caps_streak:          ["urgency"],
  specific_time_messages: ["devil_message"],
  suspense_messages:    ["misterioso"],
  textao_messages:      ["textao_enem"],
  monologo_streak:      ["monologo"],
  bot_commands_used:    ["bot_addicted"],
  mentions_sent:        ["stalker"],
  mentions_received:    ["popular"],
  bounties_placed: ["patrocinador_do_caos", "agiota_profissional", "el_capo"],
  bounties_claimed: ["cacador_de_recompensas", "cacador_de_cabecas", "xerife_do_oeste"],
  times_bountied: ["alvo_facil", "alvo_procurado", "inimigo_publico_numero_um"],
};

export const achievements = {
  ghost: {
    id: 1,
    name: "Fantasma",
    charPoints: 5000,
    emoji: "👻",
    description: "30 dias sem mensagens e voltou",
    check: () => false,
  },

  caps_addict: {
    id: 3,
    charPoints: 800,
    name: "VICIADO EM CAPS LOCK",
    emoji: "📢",
    description: "50 mensagens gritando",
    check: (stats) => stats.caps_lock_messages >= 50,
  },

  night_owl: {
    id: 5,
    charPoints: 1000,
    name: "Coruja Noturna",
    emoji: "🦉",
    description: "Mandou 100 mensagens na madrugada (2h-6h)",
    check: (stats) => stats.night_owl_messages >= 100,
  },

  popular: {
    id: 6,
    charPoints: 2000,
    name: "Popularzinho",
    emoji: "⭐",
    description: "200 menções recebidas",
    check: (stats) => stats.mentions_received >= 200,
  },

  stalker: {
    id: 7,
    charPoints: 1500,
    name: "Stalker",
    emoji: "👀",
    description: "Mencionou os outros 300 vezes",
    check: (stats) => stats.mentions_sent >= 300,
  },

  question_everything: {
    id: 8,
    charPoints: 2000,
    name: "Curioso",
    emoji: "❓",
    description: "Fez 150 perguntas no chat",
    check: (stats) => stats.question_marks >= 150,
  },

  chatterbox: {
    id: 11,
    charPoints: 1850,
    name: "Tagarela",
    emoji: "💬",
    description: "1.000 mensagens enviadas",
    check: (stats) => stats.messages_sent >= 1000,
  },

  first_message: {
    id: 12,
    charPoints: 100,
    name: "Primeiro Passo",
    emoji: "👣",
    description: "Enviou sua primeira mensagem",
    check: (stats) => stats.messages_sent >= 1,
  },

  good_morning: {
    id: 13,
    charPoints: 400,
    name: "Acorda!!!",
    emoji: "☀️",
    description: "Mandou 'bom dia' no chat",
    check: (stats) => stats.morning_messages >= 1,
  },

  monologo: {
    id: 14,
    charPoints: 400,
    name: "Esquizofrenico",
    emoji: "🗣️",
    description: "10 mensagens seguidas falando sozinho",
    check: (stats) => stats.monologo_streak >= 10,
  },

  devil_message: {
    id: 15,
    charPoints: 1500,
    name: "DIABOLICO",
    emoji: "😈",
    description: "Mandou mensagem exatamente às 03:33",
    check: (stats) => stats.specific_time_messages >= 1,
  },

  reincarnation: {
    id: 16,
    charPoints: 50000,
    name: "Reencarnou",
    emoji: "🧟‍♂️",
    description: "Voltou depois de 1 ano sem mandar mensagem",
    check: () => false,
  },

  chat_legend: {
    id: 17,
    charPoints: 10000,
    name: "Inimigo da Vida Social",
    emoji: "🌱",
    description: "Enviou 10.000 mensagens",
    check: (stats) => stats.messages_sent >= 10000,
  },

  urgency: {
    id: 18,
    charPoints: 100,
    name: "Calma Calabreso",
    emoji: "🚨",
    description: "3 mensagens seguidas em CAPS",
    check: (stats) => stats.caps_streak >= 3,
  },

  philosopher: {
    id: 19,
    charPoints: 150,
    name: "Filósofo",
    emoji: "🧠",
    description: "Pergunta com mais de 100 caracteres",
    check: (stats) => stats.long_questions >= 1,
  },

  funny_today: {
    id: 20,
    charPoints: 200,
    name: "paliasso",
    emoji: "🤡",
    description: "Deu uma risada muito longa (kkkkkk)",
    check: (stats) => stats.laught_messages >= 1,
  },

  dirty_mouth: {
    id: 21,
    charPoints: 300,
    name: "Boca Suja",
    emoji: "🧼",
    description: "Falou palavrao 50 vezes",
    check: (stats) => stats.swears_count >= 50,
  },

  bot_addicted: {
    id: 22,
    charPoints: 400,
    name: "Entusiasta do Bot",
    emoji: "🤖",
    description: "50 comandos usados",
    check: (stats) => stats.bot_commands_used >= 50,
  },

  misterioso: {
    id: 25,
    charPoints: 150,
    name: "Misterioso",
    emoji: "🌫️",
    description: "15 Mensagens com reticências...",
    check: (stats) => stats.suspense_messages >= 15,
  },

  textao_enem: {
    id: 26,
    charPoints: 800,
    name: "Escritor maldito",
    emoji: "📝",
    description: "Mandou um textão com mais de 600 caracteres",
    check: (stats) => stats.textao_messages >= 1,
  },

  insone: {
    id: 27,
    charPoints: 1500,
    name: "Insonia PLUS",
    emoji: "🌑",
    description: "500 mensagens de madrugada (2h-6h).",
    check: (stats) => stats.night_owl_messages >= 500,
  },

  vocabulario_rico: {
    id: 28,
    charPoints: 1000,
    name: "Vocabulário Rico",
    emoji: "🤬",
    description: "200 palavrões ditos",
    check: (stats) => stats.swears_count >= 200,
  },

  dependente: {
    id: 29,
    charPoints: 700,
    name: "Ladrão profissional",
    emoji: "🔪",
    description: "Roubou 30 vezes no total.",
    check: (stats) => (stats.total_robberies || 0) >= 30,
  },

  apostador: {
    id: 30,
    charPoints: 500,
    name: "Apostador Ruim",
    emoji: "🎲",
    description: "Perdeu 6 roubos seguidos. Talento natural.",
    check: (stats) => (stats.consecutive_robbery_losses || 0) >= 6,
  },

  generoso: {
    id: 31,
    charPoints: 2500,
    name: "Filantropo",
    emoji: "🤲",
    description: "Doou 10.000 caracteres no total",
    check: (stats) => (stats.total_chars_donated || 0) >= 10000,
  },

  tigrinho_lenda: {
    id: 32,
    charPoints: 100,
    name: "CEO do tigrinho",
    emoji: "🎰",
    description: "Ganhou 2 jackpot's no tigre",
    check: (stats) => (stats.tiger_jackpots || 0) >= 2,
  },

  tigre_centuria: {
    id: 33,
    charPoints: 1500,
    name: "Viciado no Tigrinho",
    emoji: "🐯",
    description: "Jogou o tigre 100 vezes no total",
    check: (stats) => (stats.lifetime_tiger_spins || 0) >= 100,
  },
  cacador_de_recompensas: {
    id: 34,
    name: "CAÇADOR DE RECOMPENSAS",
    charPoints: 1200,
    emoji: "🏹",
    description: "Pegou 10 recompensas na cabeça de alguém",
    check: (stats) => (stats.bounties_claimed || 0) >= 10,
  },

  cacador_de_cabecas: {
    id: 35,
    name: "CAÇADOR DE CABEÇAS",
    charPoints: 2800,
    emoji: "💀",
    description: "Pegou 20 recompensas como um verdadeiro carniceiro",
    check: (stats) => (stats.bounties_claimed || 0) >= 20,
  },

  xerife_do_oeste: {
    id: 36,
    name: "XERIFE DO OESTE",
    charPoints: 6000,
    emoji: "⭐",
    description: "Pegou 50 recompensas. A lei é você agora, porra",
    check: (stats) => (stats.bounties_claimed || 0) >= 50,
  },
  
  patrocinador_do_caos: {
    id: 37,
    name: "PATROCINADOR DO CAOS",
    charPoints: 1000,
    emoji: "🔥",
    description: "Colocou 10 recompensas na cabeça dos outros",
    check: (stats) => (stats.bounties_placed || 0) >= 10,
  },

  agiota_profissional: {
    id: 38,
    name: "AGIOTA PROFISSIONAL",
    charPoints: 2500,
    emoji: "💰",
    description: "Colocou 20 recompensas. Seu dinheiro fala mais alto",
    check: (stats) => (stats.bounties_placed || 0) >= 20,
  },

  el_capo: {
    id: 39,
    name: "EL CAPO",
    charPoints: 6500,
    emoji: "👑",
    description: "Colocou 50 recompensas. O chefão do submundo",
    check: (stats) => (stats.bounties_placed || 0) >= 50,
  },
    alvo_facil: {
    id: 40,
    name: "ALVO FÁCIL",
    charPoints: 800,
    emoji: "🐑",
    description: "Recebeu 10 recompensas em sua cabeça.",
    check: (stats) => (stats.times_bountied || 0) >= 10,
  },

  alvo_procurado: {
    id: 41,
    name: "ALVO PROCURADO",
    charPoints: 2200,
    emoji: "💸",
    description: "Recebeu 25 recompensas em sua cabeça.",
    check: (stats) => (stats.times_bountied || 0) >= 25,
  },

  inimigo_publico_numero_um: {
    id: 42,
    name: "INIMIGO PÚBLICO Nº 1",
    charPoints: 5500,
    emoji: "🔪",
    description: "Recebeu 50 recompensas em sua cabeça.",
    check: (stats) => (stats.times_bountied || 0) >= 50,
  },
};