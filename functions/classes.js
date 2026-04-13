import { reduceChars, setUserProperty } from "../database.js";

export const ESCUDO_BLOCK_BASE = 0.60;

export const CLASSES = {
  none: {
    name: "Nenhum",
    description: "Sem classe",
    image: "https://upload.wikimedia.org/wikipedia/pt/0/04/Wojak.jpg", 
    modifiers: {
      lucky: 0, //afeta sorte no tigre
      robCost: 0, // afeta custo de roubo
      robDamage: 0, // afeta quantidade que consegue roubar  
      robDefense: 0, // afeta quantidade quando é roubado
      robSuccess: 0, // afeta chance de sucesso do roubo
      singleRobSuccess: 0, // roubo especifico
      singleRobDamage: 0, // dano do roubo especifico
      escudoBonus: 0, // bonus de defesa do escudo
      escudoCost: 0, // desconto no custo do escudo
    },
    unlockCost: 0,
  },
  ladrao: {
    name: "Ladrão",
    description: "Chance de roubo maior, frágil na defesa e escudo um pouco pior que a média",
    image: "https://media.tenor.com/H8Z4VTfZwdsAAAAM/%D0%BE%D1%82%D0%B4%D0%B0%D0%B9.gif",
    modifiers: {
      lucky: 0.15,
      robCost: 0,
      robDamage: 0.60,
      robSuccess: 0.30,
      singleRobSuccess: 0,
      singleRobDamage: 0,
      robDefense: -0.50,
      escudoBonus: -0.20,
      escudoCost: 0.20,
    },
    unlockCost: 1000,
  },
  pobre: {
    name: "Pobre",
    description: "Tudo é mais barato e escudo e defesa é acima da média, mas é azarado.",
    image: "https://media1.tenor.com/m/f8acChNvdVMAAAAd/poor.gif",
    modifiers: {
      lucky: -0.30,
      robCost: -0.50,
      robDamage: -0.10,
      robSuccess: 0,
      singleRobSuccess: 0,
      singleRobDamage: 0,
      robDefense: 0.30,
      escudoBonus: 0.20,
      escudoCost: -0.50,
    },
    unlockCost: 500,
  },
  agiota: {
    name: "Agiota",
    description: "Sniper e dono de cassino. Excelente no roubo com alvo e muita sorte no tigre, mas pra roubar custa caro e defesa é péssima.",
    image: "https://media1.tenor.com/m/dHs_j3duIQ8AAAAd/lucafalcone123.gif",
    modifiers: {
      lucky: 0.60,
      robCost: 0.30,
      robDamage: 0.20,
      robSuccess: -0.10,
      singleRobSuccess: 0.50,
      singleRobDamage: 0.50,
      robDefense: -0.30,
      escudoBonus: 0,
      escudoCost: 0.20,
    },
    unlockCost: 2000,
  },
  hacker: {
    name: "Hacker",
    description: "Roubos baratos e alta taxa de sucesso, perde menos chars por falha.",
    image: "https://media1.tenor.com/m/CgGUXc-LDc4AAAAC/hacker-pc.gif",
    modifiers: {
      lucky: 0.20,
      robCost: -0.40,
      robDamage: -0.40,
      robSuccess: 0.50,
      singleRobSuccess: 0.30,
      singleRobDamage: -0.20,
      robDefense: -0.20,
      escudoBonus: 0.30,
      escudoCost: 0.10,
    },
    unlockCost: 950,
  },
  fantasma: {
    name: "Fantasma",
    description: "Quase impossível de ser roubado, mas sua sorte e ataque são podres.",
    image: "https://media.tenor.com/U2B-0E0VxCIAAAAM/ghost-spooky.gif",
    modifiers: {
      lucky: -0.20,
      robCost: 0.30,
      robDamage: -0.70,
      robSuccess: 0.00,
      singleRobSuccess: 0.00,
      singleRobDamage: 0.00,
      robDefense: 1.00,
      escudoBonus: 0.80,
      escudoCost: 0.20,
    },
    unlockCost: 700,
  },
  sortudo: {
    name: "Sortudo",
    description: "A sorte está sempre ao seu lado, mas falta habilidade para outras coisas.",
    image: "https://media.tenor.com/YsqeTAex5aoAAAAM/gamblecore-stickman.gif",
    modifiers: {
      lucky: 0.60,
      robCost: 0.10,
      robDamage: -0.20,
      robSuccess: -0.10,
      singleRobSuccess: -0.10,
      singleRobDamage: -0.20,
      robDefense: 0.10,
      escudoBonus: 0.10,
      escudoCost: 0,
    },
    unlockCost: 1800,
  },
  maldito: {
    name: "Maldito",
    description: "Kamikaze. Dano de roubo insano, defesa e escudo ruins e AZARADO paporra!!",
    image: "https://i.pinimg.com/736x/32/99/d6/3299d6e842cc095e71009b7cd9839052.jpg",
    modifiers: {
      lucky: -0.80,
      robCost: 0,
      robDamage: 0.90,
      robSuccess: 0.20,
      singleRobDamage: 0.20,
      singleRobSuccess: 0.20,
      robDefense: -0.80,
      escudoBonus: -0.50,
      escudoCost: 0,
    },
    unlockCost: 1500,
  },
  fodao: {
    name: "FODÃO",
    description: "O FODÃO do servidor. Absoluto em tudo.",
    image: "https://media1.tenor.com/m/6_8VJgwt3wMAAAAC/sigma.gif",
    modifiers: {
      lucky: 1,
      robCost: -1,
      robDamage: 1,
      robSuccess: 1,
      singleRobSuccess: 1,
      singleRobDamage: 1,
      robDefense: 1,
      escudoBonus: 1,
      escudoCost: -1,
    },
    unlockCost: 20000,
  }
};

export const CLASS_KEYS_ORDERED = Object.keys(CLASSES).sort((a, b) => {
  if (a === 'none') return -1;
  if (b === 'none') return 1;
  return CLASSES[a].unlockCost - CLASSES[b].unlockCost;
});

export function getClassModifiers(userClass) {
  return CLASSES[userClass]?.modifiers || {};
}

export function getClassModifier(userClass, key) {
  return CLASSES[userClass]?.modifiers?.[key] || 0;
}

export function canUnlockClass(userData, className) {
  const targetClass = CLASSES[className];
  if (!targetClass) return false;
  if (userData.charLeft < targetClass.unlockCost) return false;
  return true;
}

export function unlockClass(userId, guildId, className) {
  const targetClass = CLASSES[className];
  if (!targetClass) return false;
  reduceChars(userId, guildId, targetClass.unlockCost);
  setUserProperty('user_class', userId, guildId, className);
  return true;
}

export function applyClassModifier(baseValue, modifierType, userClass) {
  const mod = getClassModifier(userClass, modifierType);
  const multiplier = 1 + mod;

  if (modifierType === "escudoCost" || modifierType === "robCost") {
    return Math.max(0, Math.round(baseValue * multiplier));
  }

  return Math.max(0, baseValue * multiplier);
}

export function formatModifier(value) {
  const percent = Math.round(value * 100);
  return value >= 0 ? `+${percent}%` : `${percent}%`;
}