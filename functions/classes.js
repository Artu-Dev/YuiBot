import { reduceChars, setUserProperty } from "../database.js";

/** Chance base de bloquear roubo quando a vítima tem escudo (somar escudoBonus da classe). */
export const ESCUDO_BLOCK_BASE = 0.5;

export const CLASSES = {
  none: {
    name: "Nenhum",
    description: "Sem classe - jogador comum",
    modifiers: {
      lucky: 0, //afeta sorte no tigre
      robCost: 0, // afeta custo de roubo
      robDamage: 0, // afeta quantidade que consegue roubar  
      robDefense: 0, // afeta quantidade quando é roubado
      robSuccess: 0, // afeta chance de sucesso do roubo
      singleRobSuccess: 0, // roubo especifico
      escudoBonus: 0, // bonus de defesa do escudo
      escudoCost: 0, // desconto no custo do escudo
    },
    unlockCost: 0,
  },

  ladrao: {
    name: "Ladrão",
    description: "Forte no roubo, frágil na defesa e escudo um pouco pior que a média",
    modifiers: {
      lucky: 0,
      robCost: 0,
      robDamage: 0.45,
      robSuccess: 0,
      robDefense: -0.40,
      singleRobSuccess: 0.05,
      escudoBonus: -0.12,
      escudoCost: 0,
    },
    unlockCost: 1000,
  },

  pobre: {
    name: "Pobre",
    description: "Escudo mais barato e bloqueio levemente acima da média; azarado no tigre e roubo mais barato",
    modifiers: {
      lucky: -0.25,
      robCost: -0.45,
      robDamage: 0,
      robSuccess: 0,
      robDefense: 0,
      singleRobSuccess: 0,
      escudoBonus: 0.08,
      escudoCost: -0.45,
    },
    unlockCost: 500,
  },

  agiota: {
    name: "Agiota",
    description: "Boa sorte e roubo direcionado; escudo levemente pior (classe de risco)",
    modifiers: {
      lucky: 0.15,
      robCost: 0,
      robDamage: 0,
      robSuccess: 0,
      singleRobSuccess: 0.18,
      robDefense: 0,
      escudoBonus: -0.05,
      escudoCost: 0,
    },
    unlockCost: 1200,
  },

  maldito: {
    name: "Maldito",
    description: "Dano de roubo alto e azar forte; sem foco em escudo",
    modifiers: {
      lucky: -0.45,
      robCost: 0,
      robDamage: 0.8,
      robSuccess: 0,
      singleRobSuccess: 0.18,
      robDefense: -0.08,
      escudoBonus: 0,
      escudoCost: 0,
    },
    unlockCost: 1500,
  },

  fodao: {
    name: "FODÃO",
    description: "Classe endgame: vantagens amplas, escudo forte e mais barato (não extremo)",
    modifiers: {
      lucky: 0.28,
      robCost: -0.22,
      robDamage: 0.22,
      robSuccess: 0.22,
      singleRobSuccess: 0.22,
      robDefense: 0.06,
      escudoBonus: 0.18,
      escudoCost: -0.55,
    },
    unlockCost: 15000,
  }
};


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
    return Math.max(1, Math.round(baseValue * multiplier));
  }

  return Math.max(0, baseValue * multiplier);
}