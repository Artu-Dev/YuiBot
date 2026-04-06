import sqlite3

def txt_para_sqlite(arquivo_txt, banco_sqlite):
    conn = sqlite3.connect(banco_sqlite)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS palavras_proibidas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            palavra TEXT NOT NULL
        )
    ''')

    with open(arquivo_txt, 'r', encoding='utf-8') as f:
        palavras = [(linha.strip(),) for linha in f if linha.strip()]

    cursor.executemany('INSERT INTO palavras_proibidas (palavra) VALUES (?)', palavras)

    conn.commit()
    conn.close()
    print(f"Sucesso! {len(palavras)} palavras importadas para {banco_sqlite}.")

txt_para_sqlite('./data/negativas.txt', './data/palavras_proibidas.db')