"""Extract paragraphs from a DOCX into the private JSON format used by this site.

Uses only Python's standard library. The output must stay in private/ and must
never be committed to a public repository.
"""

import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_docx.py INPUT.docx private/source.json")
    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    if destination.parent.name != "private":
        raise SystemExit("output must be inside a private/ directory")

    with ZipFile(source) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))

    paragraphs = []
    headings = []
    body = root.find(f"{W}body")
    for index, element in enumerate(body):
        if element.tag != f"{W}p":
            continue
        text = "".join(node.text or "" for node in element.iter(f"{W}t")).strip()
        if not text:
            continue
        style_node = element.find(f"{W}pPr/{W}pStyle")
        style = style_node.get(f"{W}val", "Normal") if style_node is not None else "Normal"
        if style.startswith("Heading"):
            level = int(style.removeprefix("Heading"))
            headings = headings[: level - 1] + [text]
        section = "Preliminary analysis" if index < 19 else " / ".join(headings) or "Introduction"
        kind = "preliminary" if index < 19 else "market_note"
        paragraphs.append({"id": f"p{index}", "section": section, "style": style, "kind": kind, "text": text})

    payload = {
        "schema": 1,
        "title": "India legal market note",
        "suggested_questions": [
            "How does the note describe where high-value corporate legal work is concentrated in India?",
            "Which sources does the note identify for finding higher-value corporate law firms?",
            "How does the note suggest identifying higher-value litigation practices?",
            "What payment and contracting patterns does the note describe for Indian B2B software buyers?",
            "What court-operations problem does the note identify as a priority for litigators?",
            "Who influences legal-tech buying decisions for in-house teams, according to the note?",
        ],
        "paragraphs": paragraphs,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(paragraphs)} paragraphs to {destination}")


if __name__ == "__main__":
    main()
