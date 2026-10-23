"""Regenerate synthetic committed behavior fixtures; requires Pillow, python-docx, reportlab."""
from pathlib import Path
from io import BytesIO
import zipfile
import random
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.pdfencrypt import StandardEncryption

root = Path(__file__).resolve().parent
root.mkdir(exist_ok=True)

image = Image.new("RGB", (1000, 400), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 48)
draw.text((40, 80), "IMAGE-CEDAR-5729", fill="black", font=font)
draw.text((40, 160), "Fictional portfolio diagram", fill="black", font=font)
for name, marker in [("image.png", "PNG-ELM-2156"), ("image.jpg", "JPEG-PINE-7392"), ("image.webp", "WEBP-OAK-9513")]:
    variant = Image.new("RGB", (1000, 400), "white")
    ImageDraw.Draw(variant).text((40, 80), marker, fill="black", font=font)
    variant.save(root / name)

def pdf(name, text=None, scan=False, encrypt=None):
    output = canvas.Canvas(str(root / name), encrypt=encrypt)
    if text:
        output.drawString(72, 720, text)
    if scan:
        output.drawImage(ImageReader(image), 40, 450, width=500, height=200)
    output.save()

pdf("text.pdf", "PDF-ORBIT-8462: Fictional engineer builds reliable queues.")
pdf("scan.pdf", scan=True)
pdf("encrypted.pdf", "SECRET-SHOULD-NOT-BE-READ", encrypt=StandardEncryption("fictional-password"))
pdf("encrypted-empty.pdf", "SECRET-SHOULD-NOT-BE-READ", encrypt=StandardEncryption("", ownerPassword="fictional-owner"))
(root / "corrupt.pdf").write_bytes(b"%PDF-1.7\nnot a readable document")
(root / "notes.txt").write_text("TEXT-MAPLE-3187: Fictional engineer. Unicode: \u0e44\u0e17\u0e22.", encoding="utf-8")
(root / "notes.md").write_text("# MARKDOWN-BIRCH-8041\n\nFictional career notes.", encoding="utf-8")
(root / "invalid.txt").write_bytes(b"invalid utf8: \xff\xfe\x00")

doc = Document()
doc.add_heading("DOCX-LARCH-6934", 0)
doc.add_paragraph("Fictional engineer builds reliable queues.")
table = doc.add_table(rows=1, cols=2)
table.cell(0, 0).text = "TABLE-ASH-4628"
table.cell(0, 1).text = "TypeScript"
doc.save(root / "career.docx")
doc = Document()
doc.add_picture(BytesIO((root / "image.png").read_bytes()))
doc.save(root / "image-only.docx")
(root / "corrupt.docx").write_bytes(b"PK\x03\x04not a zip")
(root / "corrupt.png").write_bytes((root / "image.png").read_bytes()[:60])
with zipfile.ZipFile(root / "expanded.docx", "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("word/document.xml", b" " * (21 * 1024 * 1024))
print("Generated synthetic fixtures in", root)

with zipfile.ZipFile(root / "entries.docx", "w", zipfile.ZIP_DEFLATED) as archive:
    for index in range(1001):
        archive.writestr(f"entry-{index}", b"x")
with zipfile.ZipFile(root / "xml-corrupt.docx", "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("[Content_Types].xml", b"<Types/>")
    archive.writestr("word/document.xml", b"not xml")
# Lie about a deflated entry's uncompressed size in both ZIP headers. Yauzl must reject streamed data.
with zipfile.ZipFile(root / "lying-size.docx", "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("word/document.xml", b"x" * 100_000)
raw = bytearray((root / "lying-size.docx").read_bytes())
import struct
struct.pack_into("<I", raw, 22, 1)
central = raw.index(b"PK\x01\x02")
struct.pack_into("<I", raw, central + 24, 1)
(root / "lying-size.docx").write_bytes(raw)
frames = [Image.new("RGB", (4, 4), color) for color in ["red", "blue"]]
frames[0].save(root / "animated.webp", save_all=True, append_images=frames[1:], duration=100, loop=0)
Image.new("RGB", (8001, 1), "white").save(root / "wide.png")
output = canvas.Canvas(str(root / "too-many-pages.pdf"))
for _ in range(101):
    output.drawString(72, 720, "Fictional page")
    output.showPage()
output.save()

# Mark a fictional DOCX entry encrypted without including any password or executable content.
raw = bytearray((root / "career.docx").read_bytes())
struct.pack_into("<H", raw, 6, struct.unpack_from("<H", raw, 6)[0] | 1)
central = raw.index(b"PK\x01\x02")
struct.pack_into("<H", raw, central + 8, struct.unpack_from("<H", raw, central + 8)[0] | 1)
(root / "encrypted.docx").write_bytes(raw)
