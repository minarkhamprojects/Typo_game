import re
import unicodedata

SRC = "/tmp/claude-0/-home-user-proyecto-base/30db7a79-b807-5029-8334-9e16de19621a/scratchpad/spanish_words_utf8.txt"
OUT = "/workspace/typo_game/data/words_es.txt"

MIN_LEN = 3
MAX_LEN = 16

def strip_accents_keep_enye(word):
    # Normalize accented vowels but preserve Ñ as a distinct letter
    word = word.replace("ñ", "\x00").replace("Ñ", "\x00")
    nfkd = unicodedata.normalize("NFKD", word)
    only_ascii = "".join(c for c in nfkd if not unicodedata.combining(c))
    return only_ascii.replace("\x00", "ñ")

valid_chars = re.compile(r"^[a-zñ]+$")

words = set()
with open(SRC, encoding="utf-8", errors="ignore") as f:
    for line in f:
        w = line.strip().lower()
        if not w:
            continue
        w = strip_accents_keep_enye(w)
        if not valid_chars.match(w):
            continue
        if len(w) < MIN_LEN or len(w) > MAX_LEN:
            continue
        words.add(w.upper())

sorted_words = sorted(words)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(sorted_words))

print(f"Total palabras limpias: {len(sorted_words)}")
