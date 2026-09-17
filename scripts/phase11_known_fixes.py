from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')


def brace_depths(text: str) -> list[int]:
    depths = []
    depth = 0
    quote = None
    escape = False
    i = 0
    at_line_start = True
    while i < len(text):
        ch = text[i]
        if at_line_start:
            depths.append(depth)
            at_line_start = False
        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
        else:
            if ch in ("'", '"', '`'):
                quote = ch
            elif ch == '/' and i + 1 < len(text) and text[i + 1] == '/':
                nl = text.find('\n', i)
                if nl == -1:
                    break
                i = nl - 1
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
        if ch == '\n':
            at_line_start = True
        i += 1
    return depths


def diagnose(rel: str) -> None:
    text = read(rel)
    lines = text.splitlines()
    depths = brace_depths(text)
    prop_re = re.compile(r"^\s*['\"]?([A-Za-z0-9_]+)['\"]?:")
    actual_root_keys = []
    for idx, line in enumerate(lines):
        depth = depths[idx] if idx < len(depths) else None
        m = prop_re.match(line)
        if m and depth == 1:
            actual_root_keys.append((m.group(1), idx + 1))
    print(rel, 'actual root keys >=400:', [(k, n) for k, n in actual_root_keys if n >= 400])
    # Print every two-space object-looking line with its actual depth from 700 onward,
    # which pinpoints the first section that stopped returning to root depth.
    candidates = []
    for idx, line in enumerate(lines):
        if idx + 1 >= 700 and re.match(r"^  [A-Za-z0-9_]+: \{", line):
            candidates.append((idx + 1, depths[idx], line.strip()))
    print(rel, 'two-space object candidates >=700:', candidates)

for rel in [
    'apps/mobile/lib/i18n/locales/ta.ts',
    'apps/mobile/lib/i18n/locales/si.ts',
]:
    diagnose(rel)

print('Phase 11 nesting diagnostics complete.')
