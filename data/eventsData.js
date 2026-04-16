
export const randomEventsData = [
  {
    key: "no_limit",
    name: "Dia Livre",
    charMultiplier: 0,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Hoje vocês não perdem caracteres por falar!!!",
  },
  {
    key: "half_chars",
    name: "Dia da economia",
    charMultiplier: 0.5,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Caracteres gastam só metade hoje!",
  },
  {
    key: "char_1_5x",
    name: "Dia da inflação",
    charMultiplier: 1.5,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Caracteres gastam 1.5x mais",
  },
  {
    key: "char_2x",
    name: "Dia AMALDIÇOADO",
    charMultiplier: 2.0,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Caracteres gastam o DOBRO hoje",
  },
  {
    key: "casino_2x",
    name: "Dia do Tigrinho",
    charMultiplier: 1.0,
    casinoMultiplier: 2.0,
    robSuccess: null,
    description: "Cassinos pagam 2x mais!",
  },
  {
    key: "rob_x2",
    name: "Dia do Roubo",
    charMultiplier: 1.0,
    casinoMultiplier: 1.0,
    robSuccess: 0.50,
    description: "Taxa de roubo 50% maior!",
  },
  {
    key: "rob_100",
    name: "Dia do Roubo Garantido",
    charMultiplier: 1.0,
    casinoMultiplier: 1.0,
    robSuccess: 1.0,
    description: "Roubo 100% garantido hoje!",
  },
  {
    key: "rob_0",
    name: "Dia da honestidade",
    charMultiplier: 1.0,
    casinoMultiplier: 1.0,
    robSuccess: 0,
    description: "A taxa de sucesso de roubo hoje é de 0%!",
  },
  {
    key: "normal",
    name: "Dia Normal",
    charMultiplier: 1.0,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Tudo normal hoje",
  },
];

export const specialEventsData = {
  "0-01": {
    eventKey: "ano_novo",
    charMultiplier: 1.5,
    casinoMultiplier: 1.5,
    robSuccess: null,
    name: "Ano Novo! 🎉",
    description: "Bônus geral para começar o ano bem!",
  },
  // Halloween (mês 9, a partir do dia 25)
  "9-halloween": {
    eventKey: "halloween",
    charMultiplier: 1.5,
    casinoMultiplier: 1.0,
    robSuccess: null,
    name: "Halloween do MEDO!! 👻",
    description: "Evento especial de Halloween!",
  },
  // Natal (mês 11, a partir do dia 25)
  "11-natal": {
    eventKey: "natal",
    charMultiplier: 0.5,
    casinoMultiplier: 2.0,
    robSuccess: null,
    name: "Final de ano da Yui 🎄",
    description: "Final de ano!! Gasta menos chars e cassino paga mais!",
  },
};
