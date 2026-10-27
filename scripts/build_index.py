"""Rebuild free-ai/index.html so it has one card for every guide folder.

Usage: python3 build_index.py <free-ai repo path>
"""
import html
import re
import subprocess
import sys
from pathlib import Path

CARD_TILTS = ("0.7deg", "-0.8deg")
GRID_START = '<div class="cards">'
GRID_END = "</div>\n<footer>"


def first_commit_time(repo: Path, folder: str) -> int:
    out = subprocess.run(
        ["git", "log", "--diff-filter=A", "--format=%ct", "--", f"{folder}/index.html"],
        cwd=repo, capture_output=True, text=True, check=True,
    ).stdout.split()
    return int(out[-1]) if out else 0


SITE_BLURB = "Free AI tools, tested and explained in plain English. Every guide from my reels lives here."
SIGNUP_BLURB = "I post one free AI tool at a time"
MAX_DESC_CHARS = 170


def clip(text: str) -> str:
    if len(text) <= MAX_DESC_CHARS:
        return text
    return text[:MAX_DESC_CHARS].rsplit(" ", 1)[0].rstrip(",.;:") + "..."


def first_paragraph(text: str) -> str:
    for raw in re.findall(r"<p>(.*?)(?:</p>|<p>|<ul|<ol|<pre|<h)", text, re.S):
        para = html.escape(html.unescape(re.sub(r"<[^>]+>", "", raw)).strip(), quote=False)
        if len(para) >= 40 and not para.startswith(SIGNUP_BLURB):
            return clip(para)
    return ""


def read_meta(page: Path) -> tuple[str, str]:
    text = page.read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    heading = re.search(r"<h1>(.*?)</h1>", text, re.S)
    desc = re.search(r'<meta name="description" content="(.*?)"', text, re.S)
    title_text = title.group(1).strip() if title else ""
    if heading and ":" not in title_text and ":" in heading.group(1):
        title_text = heading.group(1).strip()
    desc_text = desc.group(1).strip() if desc else ""
    if not desc_text or desc_text == SITE_BLURB:
        desc_text = first_paragraph(text)
    return title_text, desc_text


def build_cards(repo: Path) -> str:
    guides = [p.parent for p in repo.glob("*/index.html")]
    guides.sort(key=lambda d: (-first_commit_time(repo, d.name), d.name))
    cards = []
    for i, folder in enumerate(guides):
        title, desc = read_meta(folder / "index.html")
        cards.append(
            f'<a class="card" style="--r:{CARD_TILTS[i % 2]}" href="{folder.name}/">\n'
            f'<span class="kw">{html.escape(folder.name.upper())}</span>'
            f"<h3>{title}</h3><p>{desc}</p></a>"
        )
    return "".join(cards)


def main(repo_arg: str) -> None:
    repo = Path(repo_arg)
    index = repo / "index.html"
    page = index.read_text(encoding="utf-8")
    start = page.index(GRID_START) + len(GRID_START)
    end = page.index(GRID_END)
    index.write_text(page[:start] + build_cards(repo) + page[end:], encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
