"""Make setup.json + an 8-character setup code for the agenda board.

The board's private settings (the closing-scores web app link, which carries its key) are encrypted with
AES-GCM using a key derived from the code (PBKDF2-SHA256), so setup.json can sit in this public site.
On the board: ☰ → Settings → 🔑 Enter setup code (or the button on the welcome screen's warning).

  python3 tools/make_setup.py 'https://script.google.com/macros/s/…/exec?k=…'   # prints the new code
  python3 tools/make_setup.py --code ABCD2345 '<link>'                          # reuse a code

Never commit the code itself; give it to Mat.
"""
import base64, json, os, secrets, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"   # no 0/O, 1/I/L
ITER = 310000

def make(settings, code, out_path):
    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(code.encode())
    data = AESGCM(key).encrypt(iv, json.dumps(settings).encode(), None)
    b = lambda x: base64.b64encode(x).decode()
    with open(out_path, "w") as f:
        json.dump({"v": 1, "iter": ITER, "salt": b(salt), "iv": b(iv), "data": b(data)}, f)

if __name__ == "__main__":
    args = sys.argv[1:]
    code = None
    if args[:1] == ["--code"]:
        code = "".join(ch for ch in args[1].upper() if ch.isalnum()); args = args[2:]
    if len(args) != 1 or "/exec" not in args[0]:
        sys.exit("usage: make_setup.py [--code XXXXXXXX] '<closing scores link …/exec?k=…>'")
    code = code or "".join(secrets.choice(ALPHABET) for _ in range(8))
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    make({"closingUrl": args[0].strip()}, code, os.path.join(root, "setup.json"))
    print("setup.json written. Setup code:", code[:4] + "-" + code[4:])
