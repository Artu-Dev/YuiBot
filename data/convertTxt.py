import sqlite3
import unicodedata
import re

def limpar_com_acento(palavra):
    """Mantém acentos, remove só o que não é letra."""
    palavra = palavra.strip().upper()
    return re.sub(r'[^A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ]', '', palavra)

def limpar_sem_acento(palavra):
    """Remove acentos completamente (para validação)."""
    palavra = limpar_com_acento(palavra)
    nfkd = unicodedata.normalize('NFKD', palavra)
    return "".join([c for c in nfkd if not unicodedata.combining(c)])

def icf_para_sqlite(arquivo_icf, banco_sqlite, icf_max=14.0):
    conn = sqlite3.connect(banco_sqlite)
    cursor = conn.cursor()

    cursor.execute('DROP TABLE IF EXISTS palavras_resposta')
    cursor.execute('DROP TABLE IF EXISTS palavras_validas')

    cursor.execute('''
        CREATE TABLE palavras_resposta (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            palavra TEXT NOT NULL,  -- com acento: "PAVÃO"
            icf     REAL NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE palavras_validas (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            palavra TEXT NOT NULL   -- sem acento: "PAVAO"
        )
    ''')

    respostas = {}   # normalizado -> (acentuado, icf)
    validas   = set()

    with open(arquivo_icf, 'r', encoding='utf-8') as f:
        for linha in f:
            linha = linha.strip()
            if not linha or ',' not in linha:
                continue
            partes = linha.rsplit(',', 1)
            if len(partes) != 2:
                continue
            try:
                icf = float(partes[1])
            except ValueError:
                continue

            com_acento = limpar_com_acento(partes[0])
            sem_acento = limpar_sem_acento(partes[0])

            if len(com_acento) != 5 or len(sem_acento) != 5:
                continue

            # palavras_validas: todas sem acento
            validas.add(sem_acento)

            # palavras_resposta: curadas por ICF, com acento
            if icf <= icf_max:
                if sem_acento not in respostas or icf < respostas[sem_acento][1]:
                    respostas[sem_acento] = (com_acento, icf)

    cursor.executemany(
        'INSERT INTO palavras_resposta (palavra, icf) VALUES (?, ?)',
        sorted([(v[0], v[1]) for v in respostas.values()], key=lambda x: x[1])
    )
    cursor.executemany(
        'INSERT INTO palavras_validas (palavra) VALUES (?)',
        [(p,) for p in sorted(validas)]
    )

    conn.commit()
    conn.close()
    print(f"Respostas: {len(respostas)} palavras (com acento)")
    print(f"Válidas  : {len(validas)} palavras (sem acento)")

icf_para_sqlite('./data/icf.txt', './data/lexico.db')