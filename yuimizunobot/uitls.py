import random
import re

def fix_text(text):
    final_text = re.sub(r'^[\s\S]*?<\/think>', '', text)
    
    def replace_laugh(match):
        count = len(match.group())
        if count <= 5:
            return "<laugh>hahahahahaha</laugh>"
        else:
            return "<laughing>HAHAHAHHAHAHHAHAHAHHAHAHAHHAHAHAHHAHAHHAHAHAHHAHAHAH<laughing>"
    
    final_text = re.sub(r'k{3,}', replace_laugh, final_text, flags=re.IGNORECASE)
    
    if len(final_text) > 400:
        final_text = final_text[:400]
    return final_text

def get_random_time(min_seconds, max_seconds):
    return random.randint(min_seconds * 1000, max_seconds * 1000)

