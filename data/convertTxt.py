import sqlite3
import unicodedata
import re

def limpar_palavra(palavra):
    palavra = palavra.strip().upper()
    nfkd_form = unicodedata.normalize('NFKD', palavra)
    palavra_limpa = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    palavra_limpa = re.sub(r'[^A-Z]', '', palavra_limpa)
    return palavra_limpa

def txt_para_sqlite(arquivo_txt, banco_sqlite):
    conn = sqlite3.connect(banco_sqlite)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS palavras_wordle (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            palavra TEXT NOT NULL
        )
    ''')

    palavras_processadas = []
    
    with open(arquivo_txt, 'r', encoding='utf-8') as f:
        for linha in f:
            palavra = limpar_palavra(linha)
            if len(palavra) == 5:
                palavras_processadas.append((palavra,))

    palavras_unicas = list(set(palavras_processadas))

    cursor.executemany('INSERT INTO palavras_wordle (palavra) VALUES (?)', palavras_unicas)

    conn.commit()
    conn.close()
    print(f"Sucesso! {len(palavras_unicas)} palavras limpas de 5 letras importadas.")

txt_para_sqlite('./data/lexico.txt', './data/lexico.db')