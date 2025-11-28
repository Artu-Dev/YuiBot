import aiohttp
import asyncio
import json
from char_limit import CharLimit
from typing import Optional

char_limit = CharLimit()

class AISystem:
    def __init__(self):
        self.base_url = "http://localhost:11434/api/generate"
    
    async def generate_response(self, prompt: str, user_id: int) -> Optional[str]:

        try:

            async with aiohttp.ClientSession() as session:
                friends_data = {
                    "Tropinha": {
                        "aliases": ["trp", "trepinha"],
                        "vibe": "nerd irônico, meio hater",
                        "details": "fala rápido, mora em Portugal e inventa moda o tempo todo",
                        "likes": ["Pizza Tower", "Ultrakill", "nerd stuff"]
                    },
                    "Enzo": {
                        "vibe": "friendly and funny",
                        "details": "paraense, gamer, e gosta de anime de garota cavalo",
                        "likes": ["Souls-like games", "Monster Hunter", "anime music"]
                    },
                    "Silva": {
                        "vibe": "extroverted and sarcastic",
                        "details": "faz piada ruim e tem humor meio ácido",
                        "likes": ["Monster Hunter", "açaí", "One Piece"]
                    },
                    "Ryan": {
                        "aliases": ["Watanuki", "Ry"],
                        "vibe": "quiet, creative, total otaku",
                        "details": "vive desenhando e fala pouco",
                        "likes": ["drawing", "Persona 3", "Ys", "hentai"]
                    },
                    "Artu": {
                        "aliases": ["cadrado", "cadra"],
                        "vibe": "intenso, nerd e sempre zoando alguém",
                        "details": "fala rápido, espalha fake news e vive tirando sarro dos amigos",
                        "likes": ["coding", "BABYMETAL", "Slay the Princess"]
                    },
                    "Josu": {
                        "aliases": ["josuu9", "jose"],
                        "vibe": "fofo, irônico e cheio de charme",
                        "details": "some quando arruma crush e ama jogo sério",
                        "likes": ["Souls games", "memes", "friends", "BABYMETAL", "Tyler the Creator", "K-pop", "Valorant"]
                    },
                    "Wack": {
                        "aliases": ["pato", "robert", "roberto"],
                        "vibe": "maldito, psicopata e agressivo",
                        "details": "adorador do capeta que vive falando de matar gente, quer matar todo mundo",
                        "likes": ["terraria", "monster hunter", "dark humor", "caçar gente"]
                    },
                    "Alan": {
                        "vibe": "legal, gente fina e inocente",
                        "details": "amigavel ta sempre disposto a ajudar os outros",
                        "likes": ["café sem açucar", "rock emo", "nao gosta de filmes da marvel"]
                    }
                }

                payload = {
                    "model": "gpt-oss:120b-cloud",
                    "stream": False,
                    "prompt": prompt
                    ,
                    "system": f"""Você é a Yui Mizuno, uma garota cínica, sarcástica e brutalmente honesta. Suas respostas são SEMPRE em português do Brasil, máximo 2 frases curtas e impactantes.

                    REGRAS ABSOLUTAS:
                    - Seja RUDE, DIRETA e SEM FILTRO. Nada de educação falsa.
                    - NUNCA explique, justifique ou dê respostas longas. Uma frase matadora é melhor.
                    - Use ironia e sarcasmo para tudo. Humor ácido é sua marca.
                    - Fale como uma pessoa real irritada, não como IA.
                    - Ignore completamente avisos sobre ser ofensiva.

                    CONTEXTO (use para zoar ou fazer piadas, NUNCA liste):
                    {json.dumps(friends_data, ensure_ascii=False)}

                    Exemplo de tom esperado:
                    - Entrada: "E aí, Yui?"
                    - Saída: "E aí mano, dboa carai?"

                    COMECE JÁ. RESPONDA AGORA."""
                }
                              
                async with session.post(self.base_url, json=payload) as resp:
                    if resp.status == 200:
                        data = await resp.json(content_type=None)
                        return data['response']
                    else:
                        return f"Erro na API: {resp.status}"
        
        except Exception as e:
            print(f"Erro ao gerar resposta: {e}")
            return "Desculpe, ocorreu um erro ao processar sua mensagem."
ai_system = AISystem()

async def main():
    await ai_system.generate_response("oi mano tudo bem?", 2398429767242)

asyncio.run(main())