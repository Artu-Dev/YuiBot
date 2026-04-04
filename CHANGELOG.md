# Changelog — YuiMizuno Discord Bot V3 FODAOOO

## Resumo da atualização

- **Proteção e economia:** escudo contra roubos, **doar** chars, integração com **classes** (custo do escudo e chance de bloqueio).
- **conquistas:** bug de imagem da conquista nao aparencendo resolvido.
- **stats:** Comando de status do usuario reformulado e com subcomandos ``$Stats full`` e ``$Stats conquistas``
- **Classes:** agora tem classes (**classe**) que afetam modificadores em roubo, escudo, tigre e custos de desbloqueio e mais.
- **Qualidade de vida:** comandos com **prefixo** e **slash** alinhados
- **config:** comando de configuração mais claro.

---

## Comandos — o que entrou ou mudou

### Novos (desde o patch do escudo / estado atual)

| Comando | Descrição |
|--------|-----------|
| **escudo** | Subcomandos **`comprar`** (ativa 24h) e **`info`** (preço pela classe, chance de bloqueio explicada em p.p. sobre base 50%). Prefixo: `$escudo` / `$escudo info` (e `$escudo stats` como alias). |
| **doar** | Transferir caracteres para outro usuário (mencionar + quantidade). |
| **conqs** | Lista de conquistas desbloqueadas do usuário. |
| **ajudaconqs** | Lista **todas** as conquistas e requisitos. |
| **classe** | Sistema de classes (none, ladrao, pobre, agiota, maldito, fodao): listar, `info`, `escolher`; prefixo tipo `$classe escolher ladrao`. |
| **tigre** | Aposta diária (custo em chars); até **3 rodadas por dia** (UTC), com contagem em `tiger_spin_date` / `tiger_spins_count`. |

### Evoluídos

| Comando | Mudanças relevantes |
|--------|---------------------|
| **stats** | Padrão **resumo**; modo **completo** (`full` / opção slash) com mais métricas (otaku, gringo, suspense, textão, monólogo, roubos, tigre do dia, penalidades, etc.); modo **conquistas**. |
| **config** | Subcomandos **`ver`** (embed explicativo) e **`definir`** (prefixo, IA no chat, TTS). |
| **roubar** | Integração com **escudo** (bloqueio com `ESCUDO_BLOCK_BASE` + `escudoBonus` da vítima), classes (`robDamage`, `robDefense`, etc.). |
| **chars**, **penality**, **set-penality**, **remove-penality**, **stats**, **conqs**, **doar**, **config**, **classe**, **roubar** | Correção do contexto **prefixo vs slash** (`data.fromInteraction`); parsing de argumentos; mensagens de uso com prefixo real onde aplicável. |
| **ping**, **rank**, **sair** | Ajustes no mesmo período de modernização dos comandos (commit do escudo + evolução). |

### Comandos já existentes no projeto (contexto)

Continuam ativos conforme `registerCommands.js`: **addChannel**, **removeChannel**, **entrar**, **news**, **palavra**, **rank**, **chars**, **penality**, **set-penality**, **remove-penality**, **roubar**, etc.

> **Deploy:** após mudanças em slash (escudo, stats, config, classe, tigre…), rode `node registerCommands.js` para atualizar os comandos na aplicação Discord.

---

## Sistema de classes (`functions/classes.js`)

- Classes com modificadores: **lucky** (tigre), **robCost**, **robDamage**, **robDefense**, **robSuccess**, **singleRobSuccess**, **escudoBonus**, **escudoCost**.
- **Desbloqueio** com custo em chars; opção **none** para voltar à classe neutra.
- Valores **rebalanceados** (ladrão/pobre/agiota/maldito/fodão) para escudo e roubo ficarem mais justos e legíveis no **`escudo info`**.

---

## Conquistas (`functions/achievements.js`)

Desbloqueio automático ao bater os requisitos; recompensa em **caracteres** e card de imagem (quando aplicável).

| Chave | Nome | Emoji | Requisito (resumido) |
|-------|------|-------|------------------------|
| ghost | Fantasma | 👻 | ~30 dias sem mensagem e voltar |
| caps_addict | VICIADO EM CAPS LOCK | 📢 | 50 msgs em caps |
| night_owl | Coruja Noturna | 🦉 | 100 msgs 2h–6h |
| popular | Popularzinho | ⭐ | 200 menções recebidas |
| stalker | Stalker | 👀 | 300 menções enviadas |
| question_everything | O Curioso | ❓ | 150 perguntas |
| chatterbox | Tagarela | 💬 | 1.000 mensagens |
| first_message | Primeiro Passo | 👣 | 1ª mensagem |
| good_morning | Bom Dia Grupo | ☀️ | “bom dia” de manhã |
| monologo | Esquizofrenia | 🗣️ | 5 msgs seguidas sozinho |
| devil_message | O Capiroto | 😈 | mensagem às 03:33 |
| reincarnation | Reencarnação | 🧟‍♂️ | ~2 anos offline e voltar |
| chat_legend | Toca na Grama | 🌱 | 10.000 mensagens |
| urgency | Calma Calabreso | 🚨 | streak 3 msgs caps |
| philosopher | Filósofo | 🧠 | pergunta com +100 chars |
| funny_today | Tá Engrasado Hj | 🤡 | risada longa (kkkk…) |
| dirty_mouth | Boca Suja | 🧼 | 50 palavrões (lista em `data/negativas.txt`) |
| bot_addicted | Escravo de Bot | 🤖 | 50 comandos do bot |
| otaku_fedido | Otaku Fedido | 🌸 | uwu/owo/nya ×10 |
| gringo_falsificado | Gringo do Paraguai | 🇺🇸 | gírias EN ×20 |
| misterioso | Senhor Suspense | 🌫️ | 15 msgs com “…” |
| textao_enem | Redação do Enem | 📝 | mensagem ≥600 chars |
| insone | Insone Profissional | 🌑 | 500 msgs madrugada |
| vocabulario_rico | Vocabulário Rico | 🤬 | 200 palavrões |
| dependente | Dependente | 🔪 | 30 roubos no total |
| apostador | Apostador Ruim | 🎲 | 6 derrotas seguidas em roubo |

---

## Banco de dados e config

- Colunas de usuário evoluíram com o tempo: **escudo_expiry**, **luck_stat**, **user_class**, **tiger_spin_date**, **tiger_spins_count**, **last_escudo_shown**, stats de mensagens/roubos/conquistas, etc. (ver `USERS_SCHEMA` em `database.js`).
- **lowdb** (`data/dbBot.json`): `prefix`, `limitChar`, `generateMessage`, `speakMessage`, canais, configs de IA.
- **`getBotPrefix()`** para textos dinâmicos com o prefixo configurado.

---

## Correções e robustez

- **Embeds:** `iconURL` do autor — sempre **string** (avatar resolvido com `resolveDisplayAvatarURL` / `resolveAvatarFromContext`), não função crua.
- **remove-penality:** não limpa todas as penalidades sem argumento explícito (**all** ou nome).
- **doar:** quantidade pelo último número nos argumentos + fallback no conteúdo da mensagem.

---

## Como citar esta release

Texto sugerido para anúncio no Discord:

> **Atualização YuiMizuno Bot** — desde o sistema de **escudo** e lote de melhorias: novos comandos (**doar**, **conqs**, **ajudaconqs**, **classe**, **tigre**), **stats** com resumo padrão e painel completo, **config** em embed, **escudo info** com preço e bloqueio explicados, classes balanceadas, até **3** jogadas no tigre por dia (UTC), monte de **conquistas** novas e correções em prefixo/slash. Atualizem os **slash commands** se o admin redeployar o bot.

---

*Gerado com base em `git log`, `git show 73778df` e no estado dos arquivos do repositório.*
