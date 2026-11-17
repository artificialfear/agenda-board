#!/usr/bin/env python3
"""Make the board's spoken-name clips (2.24.0).

The board says the class jobs out loud at pack-up ("Percussion Captains: Jordan T. and Riley M. ...").
With a voice bundle it plays these pre-made clips instead of the ViewBoard's built-in voice.

Real student names NEVER go in this repo. The names file, the say-as file and the bundle all live
outside it (Mat's private Drive folder "Agenda Board Voices"); the board gets the bundle through the
Daily Slides web app (ClosingScores.gs a=voices).

  python3 make-voices.py NAMES.txt SAYAS.txt MODEL.onnx OUT_DIR

NAMES.txt  names exactly as Board Settings writes them ("First L."), separated by commas or new lines
SAYAS.txt  optional fixes, one per line:  Name | how to say it
           plain respelling ("Kye B.") or raw sounds in double brackets ("[[ kˈaɪ bˈiː ]]")
OUT_DIR    gets agenda-voices.json (the bundle) + review.mp3 and review.txt (every name in order, for listening)

Voice: Piper "en_US-amy-low" (offline, runs here; nothing is sent anywhere).
"""
import base64, io, json, os, subprocess, sys, tempfile, wave, datetime

PHRASES = ["Percussion Captain", "Percussion Captains", "Stage Manager", "Stage Managers", "and"]


def key(name):
    """Must match voiceKey() in index.html."""
    k = " ".join(name.lower().split())
    return k[:-1].strip() if k.endswith(".") else k


def read_names(path):
    out, seen = [], set()
    for line in open(path, encoding="utf-8"):
        for n in line.split(","):
            n = n.strip()
            if n and key(n) not in seen:
                seen.add(key(n)); out.append(n)
    return out


def read_sayas(path):
    out = {}
    if path and os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            if "|" in line and not line.lstrip().startswith("#"):
                a, b = line.split("|", 1)
                if a.strip() and b.strip(): out[key(a)] = b.strip()
    return out


def synth(voice, cfg, text):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        voice.synthesize_wav(text, w, syn_config=cfg)
    return buf.getvalue()


def to_mp3(wav_bytes):
    """Trim the silence at both ends, mono 16 kHz MP3 (plays on the ViewBoard's old Chrome)."""
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "a.wav"), os.path.join(d, "a.mp3")
        open(src, "wb").write(wav_bytes)
        trim = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,"
                "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-af", trim, "-ac", "1", "-ar", "16000",
                        "-b:a", "40k", dst], check=True)
        return open(dst, "rb").read()


def main():
    if len(sys.argv) < 5:
        print(__doc__); sys.exit(1)
    names_path, sayas_path, model, out_dir = sys.argv[1:5]
    from piper import PiperVoice, SynthesisConfig
    voice = PiperVoice.load(model)
    cfg = SynthesisConfig(length_scale=1.08)            # a touch slower: names over a noisy room
    names, sayas = read_names(names_path), read_sayas(sayas_path)
    os.makedirs(out_dir, exist_ok=True)
    clips, review_wavs, review_txt = {}, [], []
    for p in PHRASES:
        clips["@" + p.lower()] = base64.b64encode(to_mp3(synth(voice, cfg, p))).decode()
    for i, n in enumerate(names, 1):
        said = sayas.get(key(n), n)
        w = synth(voice, cfg, said)
        clips[key(n)] = base64.b64encode(to_mp3(w)).decode()
        review_wavs.append(w)
        review_txt.append("%3d  %s%s" % (i, n, "   (said as: %s)" % said if said != n else ""))
    bundle = {"v": 1, "voice": "en_US-amy-low", "made": datetime.date.today().isoformat(),
              "count": len(names), "clips": clips}
    json.dump(bundle, open(os.path.join(out_dir, "agenda-voices.json"), "w"), separators=(",", ":"))
    open(os.path.join(out_dir, "review.txt"), "w").write("\n".join(review_txt) + "\n")
    # review.mp3: every name in list order, a short gap between, so they can be checked by ear
    with tempfile.TemporaryDirectory() as d:
        lst = []
        for i, w in enumerate(review_wavs):
            f = os.path.join(d, "%03d.wav" % i)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", "-", "-af", "apad=pad_dur=0.7", f],
                           input=w, check=True)
            lst.append("file '%s'" % f)
        open(os.path.join(d, "l.txt"), "w").write("\n".join(lst))
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i",
                        os.path.join(d, "l.txt"), "-ac", "1", "-b:a", "48k",
                        os.path.join(out_dir, "review.mp3")], check=True)
    print("names:", len(names), " say-as fixes:", sum(1 for n in names if key(n) in sayas),
          " bundle KB:", os.path.getsize(os.path.join(out_dir, "agenda-voices.json")) // 1024)


if __name__ == "__main__":
    main()
