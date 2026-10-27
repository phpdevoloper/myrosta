# How the narrator was chosen (6 Oct 2026): sample one sentence in every female preset (narration.py with each name), convert to 16 kHz mono wav,
# then rank with this classifier — run: uv run --python 3.11 --with speechbrain --with torch --with torchaudio --with huggingface_hub python accent.py wav/*.wav | sort -rn
# Accent classifier (SpeechBrain CommonAccent ECAPA, 16 English accents). Usage: python accent.py file.wav [...]
import sys,warnings; warnings.filterwarnings("ignore")
import torch
from speechbrain.inference.classifiers import EncoderClassifier
clf=EncoderClassifier.from_hparams(source="Jzuluaga/accent-id-commonaccent_ecapa",savedir="model")
for f in sys.argv[1:]:
    out=clf.classify_file(f); raw=out[0].squeeze(); probs=raw.tolist(); labels=clf.hparams.label_encoder.decode_ndim(torch.arange(len(probs)))
    ranked=sorted(zip(labels,probs),key=lambda x:-x[1])[:4]
    au=dict(zip(labels,probs)).get("australia",0.0); print(f"{au:.3f}", f, "=>", ", ".join(f"{l} {p:.2f}" for l,p in ranked), flush=True)
