from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel: str, text: str) -> None:
    (ROOT / rel).write_text(text, encoding='utf-8')


def replace_exact(rel: str, old: str, new: str) -> None:
    text = read(rel)
    if old not in text:
        raise RuntimeError(f'Expected text not found in {rel}: {old[:160]!r}')
    write(rel, text.replace(old, new, 1))


def object_blocks(lines: list[str], key: str) -> list[tuple[int, int]]:
    starts = [i for i, line in enumerate(lines) if line == f'  {key}: {{\n']
    blocks: list[tuple[int, int]] = []
    for start in starts:
        end = None
        for j in range(start + 1, len(lines)):
            if lines[j] == '  },\n':
                end = j
                break
        if end is None:
            raise RuntimeError(f'Could not find end of top-level {key} block')
        blocks.append((start, end))
    return blocks


def parse_first_level_props(block_lines: list[str]) -> list[tuple[str, list[str]]]:
    prop_re = re.compile(r'^    ([A-Za-z0-9_]+):')
    starts: list[tuple[int, str]] = []
    for i, line in enumerate(block_lines):
        m = prop_re.match(line)
        if m:
            starts.append((i, m.group(1)))
    out: list[tuple[str, list[str]]] = []
    for idx, (start, key) in enumerate(starts):
        end = starts[idx + 1][0] if idx + 1 < len(starts) else len(block_lines)
        out.append((key, block_lines[start:end]))
    return out


def normalize_top_level_object(rel: str, key: str) -> None:
    lines = read(rel).splitlines(keepends=True)
    blocks = object_blocks(lines, key)
    if not blocks:
        raise RuntimeError(f'No top-level {key} block in {rel}')

    merged_order: list[str] = []
    merged: dict[str, list[str]] = {}
    for start, end in blocks:
        props = parse_first_level_props(lines[start + 1:end])
        for prop_key, chunk in props:
            if prop_key not in merged:
                merged_order.append(prop_key)
                merged[prop_key] = chunk

    rebuilt = [f'  {key}: {{\n']
    for prop_key in merged_order:
        rebuilt.extend(merged[prop_key])
    rebuilt.append('  },\n')

    # Replace first block, then remove subsequent duplicate blocks while preserving
    # unrelated top-level sections between them.
    first_start, first_end = blocks[0]
    new_lines = lines[:first_start] + rebuilt + lines[first_end + 1:]

    # Re-find duplicate blocks after the first replacement and remove every later one.
    while True:
        current = object_blocks(new_lines, key)
        if len(current) <= 1:
            break
        start, end = current[-1]
        new_lines = new_lines[:start] + new_lines[end + 1:]

    write(rel, ''.join(new_lines))


# react-native-maps AnimatedRegion timing works at runtime with latitude/longitude
# directly; its current TypeScript declaration also requires TimingAnimationConfig.
rel = 'apps/mobile/app/(customer)/tracking/[id].tsx'
replace_exact(
    rel,
    "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    }).start()",
    "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    } as any).start()",
)

# Locale files accumulated duplicate profile objects / keys during previous merges.
# Merge duplicate profile objects and keep the first translation for duplicate keys,
# while preserving any keys that only exist in later blocks.
for rel in [
    'apps/mobile/lib/i18n/locales/en.ts',
    'apps/mobile/lib/i18n/locales/ta.ts',
    'apps/mobile/lib/i18n/locales/si.ts',
]:
    normalize_top_level_object(rel, 'profile')

print('Phase 11 stage-2 TypeScript fixes applied.')
