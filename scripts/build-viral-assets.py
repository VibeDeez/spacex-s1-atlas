#!/usr/bin/env python3
import json
import math
import os
import re
import shutil
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DATA = ROOT / 'processed' / 'dashboard_data.json'
if not DATA.exists():
    DATA = ROOT.parent / 'processed' / 'dashboard_data.json'
SOCIAL = PUBLIC / 'social'
SHARE = PUBLIC / 'share'
SOCIAL.mkdir(parents=True, exist_ok=True)
SITE_TITLE = 'SpaceX S-1 Atlas'
SITE_DESCRIPTION = "A source-cited map of SpaceX's S-1: business stack, financials, risks, exhibits, OCR, and source packets."
CANONICAL_URL = os.environ.get('PUBLIC_BASE_URL', 'https://silent-aurora-p5v5.here.now').rstrip('/')
IMAGE_BASE_URL = os.environ.get('SHARE_IMAGE_BASE_URL', CANONICAL_URL).rstrip('/')
SOCIAL_IMAGE_PATH = '/social/spacex-s1-atlas-card.png'
CARD_IMAGE_URL = f'{IMAGE_BASE_URL}{SOCIAL_IMAGE_PATH}'

def slugify(value: str) -> str:
    value = re.sub(r'[\u2010-\u2015]', '-', str(value).lower())
    value = re.sub(r'[^a-z0-9]+', '-', value).strip('-')
    return value[:96] or 'packet'

def money(value):
    if value is None:
        return '—'
    try:
        v = float(value)
    except Exception:
        return str(value)
    sign = '−' if v < 0 else ''
    v = abs(v)
    if v >= 1000:
        return f'{sign}${v/1000:.1f}B'
    return f'{sign}${v:,.0f}M'

def trim(text, n=240):
    text = re.sub(r'\s+', ' ', str(text or '')).strip()
    return text if len(text) <= n else text[: n - 1].rstrip() + '…'

def source_count_line(data):
    counts = data.get('sourceCounts') or {}
    return (
        f"{counts.get('sections', 0)} sections · "
        f"{counts.get('exhibits', 0)} exhibits · "
        f"{counts.get('graphics', 0)} graphics/OCR · "
        f"{counts.get('risk_headings', len(data.get('risks', [])))} risk factors · "
        f"{counts.get('glossary_terms', 0)} glossary terms"
    )

def risk_factor_count(data):
    return (data.get('sourceCounts') or {}).get('risk_headings') or len(data.get('risks', []))

def add_packet(rows, packet_type, title, detail, source, url=None, subtype=None, sort=0):
    title = str(title or 'Untitled packet').strip()
    detail = str(detail or '').strip()
    source = str(source or '').strip()
    base = f'{packet_type}-{subtype or ""}-{title}-{source}'
    pid = slugify(base)
    existing = {r['id'] for r in rows}
    if pid in existing:
        pid = f'{pid}-{len(existing)+1}'
    caption = f"SpaceX S-1 Atlas\n\nPacket: {packet_type.title()} → {title}\nSource: {source}\n\n"
    rows.append({
        'id': pid,
        'type': packet_type,
        'subtype': subtype or packet_type,
        'title': title,
        'detail': detail,
        'source': source,
        'url': url,
        'sort': sort,
        'caption': caption,
        'hash': f'/packet/{packet_type}/{pid}',
        'sharePath': f'/share/packet/{pid}/',
    })

def build_atlas(data):
    rows = []
    for f in data.get('facts', []):
        add_packet(rows, 'fact', f.get('k'), f.get('v'), f.get('src'), sort=0)
    for s in data.get('sections', []):
        detail = f"Lines {s.get('start_line'):,}–{s.get('end_line'):,} · {s.get('chars'):,} chars"
        add_packet(rows, 'section', s.get('title'), detail, s.get('key'), sort=1)
    for r in data.get('financials', {}).get('consolidated', []):
        detail = f"Revenue {money(r.get('revenue'))} · Op. income {money(r.get('op_income'))} · Net income {money(r.get('net_income'))}"
        if r.get('adjusted_ebitda'):
            detail += f" · Adj. EBITDA {money(r.get('adjusted_ebitda'))}"
        add_packet(rows, 'financial', f"Consolidated · {r.get('period')}", detail, r.get('source') or 'MD&A / financial statements', subtype='consolidated', sort=2)
    for r in data.get('financials', {}).get('segments', []):
        detail = f"Revenue {money(r.get('revenue'))} · Op. income {money(r.get('op_income'))} · Segment Adj. EBITDA {money(r.get('adj_ebitda'))} · Capex {money(r.get('capex'))}"
        add_packet(rows, 'financial', f"{r.get('segment')} segment · {r.get('period')}", detail, 'Segment tables / summary', subtype='segment', sort=3)
    for r in data.get('risks', []):
        add_packet(rows, 'risk', r.get('heading'), r.get('group'), 'Risk Factors', subtype=r.get('group'), sort=4)
    for e in data.get('exhibits', []):
        add_packet(rows, 'exhibit', f"{e.get('type')} · {e.get('title')}", e.get('preview') or e.get('document'), e.get('document'), url=e.get('url'), subtype=e.get('type'), sort=5)
    for g in data.get('glossary', []):
        add_packet(rows, 'glossary', g.get('term'), g.get('definition'), 'Glossary of Terms', sort=6)
    for g in data.get('governance', []):
        add_packet(rows, 'governance', f"{g.get('name')} · {g.get('role')}", g.get('notes'), g.get('src'), sort=7)
    for r in data.get('related', []):
        add_packet(rows, 'related', r.get('party'), ' '.join(r.get('items', [])), r.get('src'), sort=8)
    for o in data.get('ocrItems', []):
        add_packet(rows, 'ocr', o.get('file'), o.get('preview') or o.get('text') or 'Image / no reliable OCR text', o.get('image'), url=o.get('url'), sort=9)
    rows.sort(key=lambda r: (r['sort'], r['title']))
    return rows

def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding='utf-8')


def write_share_page(path: Path, *, title: str, description: str, target_hash: str, page_url: str, image_url: str = CARD_IMAGE_URL, eyebrow: str = 'SpaceX S‑1 Atlas'):
    path.mkdir(parents=True, exist_ok=True)
    html = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#050506" />
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="{escape(title)}" />
    <meta property="og:description" content="{escape(description)}" />
    <meta property="og:url" content="{escape(page_url)}" />
    <meta property="og:image" content="{escape(image_url)}" />
    <meta property="og:image:secure_url" content="{escape(image_url)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(title)}" />
    <meta name="twitter:description" content="{escape(description)}" />
    <meta name="twitter:image" content="{escape(image_url)}" />
    <link rel="canonical" href="{escape(page_url)}" />
    <style>
      html,body{{margin:0;min-height:100svh;background:#050506;color:#f7f8f8;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}}
      main{{min-height:100svh;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));background:radial-gradient(circle at 50% 112%,rgba(183,216,255,.20),transparent 38%),linear-gradient(180deg,#050506,#07080a 52%,#030304);}}
      section{{width:min(720px,100%);border:1px solid rgba(255,255,255,.09);background:rgba(10,11,13,.92);border-radius:22px;padding:24px;box-shadow:inset 0 1px 0 rgba(255,255,255,.045)}}
      .eyebrow{{font:700 10px ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.24em;color:rgba(255,255,255,.52)}}
      h1{{margin:12px 0 0;font-size:clamp(34px,9vw,58px);line-height:.92;letter-spacing:-.06em;font-weight:560;color:#b7d8ff}}
      p{{color:rgba(255,255,255,.66);font-size:15px;line-height:1.65}}
      a{{display:inline-flex;min-height:44px;align-items:center;margin-top:8px;border-radius:12px;background:#b7d8ff;color:#050506;padding:0 14px;text-decoration:none;font-weight:650}}
    </style>
    <script>window.setTimeout(() => window.location.replace('/#/{target_hash.lstrip('/')}'), 250)</script>
  </head>
  <body>
    <main><section><div class="eyebrow">{escape(eyebrow)}</div><h1>{escape(title)}</h1><p>{escape(description)}</p><p>This source-cited filing map is not investment advice and is not affiliated with SpaceX. External model assumptions are separate from filed facts.</p><a href="/#/{escape(target_hash.lstrip('/'))}">Open interactive atlas</a></section></main>
  </body>
</html>
'''
    (path / 'index.html').write_text(html, encoding='utf-8')


def write_share_pages(data, atlas):
    if SHARE.exists():
        shutil.rmtree(SHARE)
    SHARE.mkdir(parents=True, exist_ok=True)
    posters = {
        'business-stack': ('SpaceX S‑1 Atlas · Business Stack', 'Space, Connectivity, and AI as a source-cited operating map from the S‑1.'),
        'financial-telemetry': ('SpaceX S‑1 Atlas · Financials', 'Consolidated results, segment snapshots, Starlink metrics, and cash flow from the filing.'),
        'risk-radar': ('SpaceX S‑1 Atlas · Risk Radar', f'{risk_factor_count(data)} S‑1 risk factors made navigable. No invented severity score.'),
        'governance-control': ('SpaceX S‑1 Atlas · Governance', 'Management, related-party disclosures, and offering mechanics from the filing.'),
    }
    for variant, (title, desc) in posters.items():
        write_share_page(SHARE / variant, title=title, description=desc, target_hash=f'/poster/{variant}', page_url=f'{CANONICAL_URL}/share/{variant}/', eyebrow='S‑1 Filing Map')
    packet_root = SHARE / 'packet'
    for packet in atlas:
        title = f"SpaceX S‑1 packet · {trim(packet['title'], 86)}"
        desc = f"{packet['type'].title()} packet from the source-cited atlas. {trim(packet.get('detail'), 150)} SRC · {trim(packet.get('source'), 80)}"
        write_share_page(packet_root / packet['id'], title=title, description=desc, target_hash=packet['hash'], page_url=f"{CANONICAL_URL}{packet['sharePath']}", eyebrow=packet.get('type', 'packet'))


def write_robots_txt():
    (PUBLIC / 'robots.txt').write_text(
        f'User-agent: *\nAllow: /\nSitemap: {CANONICAL_URL}/sitemap.xml\n',
        encoding='utf-8',
    )


def write_sitemap(atlas):
    urls = ['/']
    urls.extend([
        '/share/business-stack/',
        '/share/financial-telemetry/',
        '/share/risk-radar/',
        '/share/governance-control/',
    ])
    urls.extend(packet['sharePath'] for packet in atlas)
    body = '\n'.join(
        f'  <url><loc>{escape(CANONICAL_URL + path)}</loc></url>'
        for path in urls
    )
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{body}
</urlset>
'''
    (PUBLIC / 'sitemap.xml').write_text(xml, encoding='utf-8')

def draw_social_card(data):
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), '#050506')
    d = ImageDraw.Draw(img)

    # Deep-space gradient.
    for y in range(H):
        t = y / max(H - 1, 1)
        r = int(5 + 12 * t)
        g = int(6 + 18 * t)
        b = int(9 + 34 * t)
        d.line((0, y, W, y), fill=(r, g, b))

    # Larger, more visible star field. Deterministic so the asset is stable.
    for i in range(118):
        x = (47 + i * 197) % (W - 40) + 20
        y = (31 + i * 89) % (H - 56) + 22
        size = 2 if i % 11 == 0 else 1
        shade = 235 if i % 7 == 0 else 190 if i % 3 == 0 else 145
        if i % 5 == 0:
            color = (183, 216, 255)
        else:
            color = (shade, shade, min(255, shade + 10))
        d.ellipse((x - size, y - size, x + size, y + size), fill=color)

    # Subtle orbital horizon, kept secondary to the headline.
    for rr, color in [(720, '#1f344f'), (520, '#253141')]:
        d.ellipse((W//2 - rr, H + 110 - rr, W//2 + rr, H + 110 + rr), outline=color, width=2)

    def font(size, bold=False):
        candidates = [
            '/System/Library/Fonts/SFNS.ttf',
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',
            '/Library/Fonts/Arial.ttf'
        ]
        for p in candidates:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
        return ImageFont.load_default()

    title_f = font(86, True)
    sub_f = font(34)
    body_f = font(24)
    mono_f = font(18)
    small_f = font(17)
    label_f = font(13)

    d.text((62, 78), 'SpaceX S‑1 Atlas', fill='#f7f8f8', font=title_f)
    d.text((68, 184), 'Business stack · financials · risks · sources', fill='#b7d8ff', font=sub_f)
    d.text((70, 244), 'A source-cited map built from the S‑1 filing package.', fill='#9ca3af', font=body_f)

    colors = {'Space': '#B7D8FF', 'Connectivity': '#74E3D4', 'AI': '#F3BE63'}
    y0 = 330
    for i, name in enumerate(['Space', 'Connectivity', 'AI']):
        y = y0 + i * 62
        d.rounded_rectangle((70, y, 470, y + 46), radius=14, outline=colors[name], fill='#090a0d', width=2)
        d.ellipse((94, y + 18, 106, y + 30), fill=colors[name])
        d.text((122, y + 11), name, fill=colors[name], font=mono_f)

    def risk_theme(heading, group):
        h = str(heading or '').lower()
        if re.search(r'starship|launch|rocket|reusable|dragon|mission|payload|orbital', h): return 'Launch / Starship'
        if re.search(r'starlink|satellite|connectivity|broadband|mobile|spectrum', h): return 'Starlink / Network'
        if re.search(r'ai|xai|grok|compute|model|data center', h): return 'AI / Compute'
        if re.search(r'government|regulat|law|fda|license|faa|fcc|export|security|defense', h): return 'Regulatory'
        if re.search(r'stock|voting|offering|controlled|class|shares|market', h) or group != 'Business': return 'Offering / Control'
        return 'Operations / Market'

    theme_meta = [
        ('Launch / Starship', '#B7D8FF', 'Launch'),
        ('Starlink / Network', '#74E3D4', 'Starlink'),
        ('AI / Compute', '#F3BE63', 'AI'),
        ('Regulatory', '#EF7D7D', 'Reg.'),
        ('Operations / Market', '#C6D0DD', 'Ops'),
        ('Offering / Control', '#9DB9FF', 'Control'),
    ]
    risks = data.get('risks', [])
    risk_count = risk_factor_count(data)
    counts = [(theme, sum(1 for r in risks if risk_theme(r.get('heading'), r.get('group')) == theme), color, short) for theme, color, short in theme_meta]

    # Clean risk radar: one readable panel, no tiny disclosure paragraph.
    d.rounded_rectangle((720, 160, 1082, 532), radius=28, outline='#27303c', fill='#090a0d', width=2)
    d.text((760, 208), 'Risk Radar', fill='#ef7d7d', font=sub_f)
    cx, cy = 900, 382
    for rr, outline in [(128, '#27303c'), (90, '#202732'), (50, '#1a2029')]:
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=outline, width=2)
    for i, (theme, count, color, short) in enumerate(counts):
        angle = (i / len(counts)) * math.tau - math.pi / 2
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        x = cx + cos_a * 104
        y = cy + sin_a * 104
        d.line((cx, cy, x, y), fill='#1d232d', width=1)
        d.ellipse((x - 14, y - 14, x + 14, y + 14), fill=color, outline='#050506', width=2)
        tw = d.textlength(str(count), font=label_f)
        d.text((x - tw/2, y - 8), str(count), fill='#050506', font=label_f)
        label_r = 134
        lx = cx + cos_a * label_r
        ly = cy + sin_a * label_r
        lw = d.textlength(short, font=label_f)
        if cos_a > 0.35:
            tx = lx + 5
        elif cos_a < -0.35:
            tx = lx - lw - 5
        else:
            tx = lx - lw / 2
        d.text((tx, ly - 8), short, fill=color, font=label_f)
    d.ellipse((cx - 50, cy - 50, cx + 50, cy + 50), outline='#344052', fill='#07080a', width=2)
    for text, yy, fnt, fill in [(str(risk_count), cy - 40, body_f, '#f7f8f8'), ('RISK', cy - 8, label_f, '#a6adb9'), ('FACTORS', cy + 9, label_f, '#a6adb9')]:
        tw = d.textlength(text, font=fnt)
        d.text((cx - tw / 2, yy), text, fill=fill, font=fnt)

    d.text((62, 578), 'Source-grounded from the S‑1 package', fill='#b7d8ff', font=small_f)
    d.text((62, 604), source_count_line(data), fill='#8b94a3', font=small_f)
    out = SOCIAL / 'spacex-s1-atlas-card.png'
    img.save(out, optimize=True)
    return out


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    source = data.get('sourcePayload', {})
    atlas = build_atlas(data)
    summary = {
        'sourceUrl': data.get('sourceUrl'),
        'generatedFrom': data.get('generatedFrom'),
        'sourceCounts': data.get('sourceCounts'),
        'facts': data.get('facts'),
        'segments': data.get('segments'),
        'strategy': data.get('strategy'),
        'governance': data.get('governance'),
        'related': data.get('related'),
        'compensation': data.get('compensation'),
        'offering': data.get('offering'),
        'capital': data.get('capital'),
        'sections': data.get('sections'),
    }
    write_json(PUBLIC / 'summary.json', summary)
    write_json(PUBLIC / 'atlas-index.json', {'rows': atlas, 'count': len(atlas)})
    write_json(PUBLIC / 'financials.json', data.get('financials'))
    write_json(PUBLIC / 'risks.json', {'risks': data.get('risks')})
    write_json(PUBLIC / 'source-main.json', {'main_text': source.get('main_text',''), 'exfilingfees': source.get('exfilingfees','')})
    write_json(PUBLIC / 'source-exhibits.json', {'exhibits': source.get('exhibits', {})})
    write_json(PUBLIC / 'ocr.json', {'ocr': source.get('ocr',''), 'items': data.get('ocrItems', [])})
    out = draw_social_card(data)
    write_share_pages(data, atlas)
    write_robots_txt()
    write_sitemap(atlas)
    print(json.dumps({
        'summary': (PUBLIC / 'summary.json').stat().st_size,
        'atlas': (PUBLIC / 'atlas-index.json').stat().st_size,
        'financials': (PUBLIC / 'financials.json').stat().st_size,
        'risks': (PUBLIC / 'risks.json').stat().st_size,
        'source_main': (PUBLIC / 'source-main.json').stat().st_size,
        'source_exhibits': (PUBLIC / 'source-exhibits.json').stat().st_size,
        'ocr': (PUBLIC / 'ocr.json').stat().st_size,
        'social_card': str(out),
        'social_card_size': out.stat().st_size,
        'packets': len(atlas),
        'share_pages': len(list(SHARE.rglob('index.html'))),
        'card_image_url': CARD_IMAGE_URL,
        'canonical_url': CANONICAL_URL,
        'sitemap': str(PUBLIC / 'sitemap.xml'),
    }, indent=2))

if __name__ == '__main__':
    main()
