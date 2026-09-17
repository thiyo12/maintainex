from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')


def brace_depths(text: str) -> list[int]:
    """Return brace depth at the start of each 1-based source line.

    Braces inside strings and // comments are ignored. Locale files do not use
    regex literals for their values, so this is sufficient to diagnose object
    nesting without changing source.
    """
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
                # Skip to newline.
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
    profile_lines = []
    actual_root_keys = []
    prop_re = re.compile(r"^\s*['\"]?([A-Za-z0-9_]+)['\"]?:")
    for idx, line in enumerate(lines):
        depth = depths[idx] if idx < len(depths) else None
        if 'profile' in line.lower():
            profile_lines.append((idx + 1, depth, line))
        m = prop_re.match(line)
        # Root locale object properties are encountered at brace depth 1.
        if m and depth == 1:
            actual_root_keys.append((m.group(1), idx + 1, line))
    dupes = {}
    for key, lineno, line in actual_root_keys:
        dupes.setdefault(key, []).append(lineno)
    dupes = {k: v for k, v in dupes.items() if len(v) > 1}
    print(rel, 'profile lines with actual brace depth:', profile_lines)
    print(rel, 'actual root duplicate keys:', dupes)
    # Show nearby root-key sequence around the reported locale failure region.
    print(rel, 'root keys 850-1060:', [(k, n) for k, n, _ in actual_root_keys if 850 <= n <= 1060])


for rel in [
    'apps/mobile/lib/i18n/locales/en.ts',
    'apps/mobile/lib/i18n/locales/ta.ts',
    'apps/mobile/lib/i18n/locales/si.ts',
]:
    diagnose(rel)

print('Phase 11 structural locale diagnostics complete.')
