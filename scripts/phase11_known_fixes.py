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


def top_level_chunks(lines: list[str]) -> list[tuple[str, int, int]]:
    prop_re = re.compile(r"^  ['\"]?([A-Za-z0-9_]+)['\"]?:")
    starts: list[tuple[str, int]] = []
    for i, line in enumerate(lines):
        m = prop_re.match(line)
        if m:
            starts.append((m.group(1), i))
    chunks: list[tuple[str, int, int]] = []
    for idx, (key, start) in enumerate(starts):
        end = starts[idx + 1][1] if idx + 1 < len(starts) else len(lines) - 1
        chunks.append((key, start, end))
    return chunks


def first_level_properties(object_chunk: list[str]) -> list[tuple[str, list[str]]]:
    prop_re = re.compile(r"^    ['\"]?([A-Za-z0-9_]+)['\"]?:")
    starts: list[tuple[str, int]] = []
    for i, line in enumerate(object_chunk[1:], start=1):
        m = prop_re.match(line)
        if m:
            starts.append((m.group(1), i))
    props: list[tuple[str, list[str]]] = []
    for idx, (key, start) in enumerate(starts):
        end = starts[idx + 1][1] if idx + 1 < len(starts) else len(object_chunk)
        chunk = object_chunk[start:end]
        while chunk and chunk[-1] in ('  },\n', '}\n'):
            chunk = chunk[:-1]
        props.append((key, chunk))
    return props


def merge_duplicate_root_object(rel: str, target_key: str) -> None:
    lines = read(rel).splitlines(keepends=True)
    chunks = top_level_chunks(lines)
    matches = [(start, end) for key, start, end in chunks if key == target_key]
    print(rel, 'root', target_key, 'occurrences', [(s + 1, e) for s, e in matches])
    print(rel, 'ALL profile lines', [(i + 1, line.rstrip()) for i, line in enumerate(lines) if re.search(r"profile", line, re.I)])
    if len(matches) <= 1:
        if not matches:
            return
        start, end = matches[0]
        obj = lines[start:end]
        props = first_level_properties(obj)
        seen: set[str] = set()
        rebuilt = [f'  {target_key}: {{\n']
        changed = False
        for key, chunk in props:
            if key in seen:
                changed = True
                continue
            seen.add(key)
            rebuilt.extend(chunk)
        rebuilt.append('  },\n')
        if changed:
            write(rel, ''.join(lines[:start] + rebuilt + lines[end:]))
        return

    ordered_keys: list[str] = []
    merged: dict[str, list[str]] = {}
    for start, end in matches:
        for key, chunk in first_level_properties(lines[start:end]):
            if key not in merged:
                ordered_keys.append(key)
                merged[key] = chunk

    rebuilt = [f'  {target_key}: {{\n']
    for key in ordered_keys:
        rebuilt.extend(merged[key])
    rebuilt.append('  },\n')

    first_start, first_end = matches[0]
    new_lines = lines[:]
    for start, end in reversed(matches[1:]):
        del new_lines[start:end]
    new_lines[first_start:first_end] = rebuilt
    write(rel, ''.join(new_lines))


rel = 'apps/mobile/app/(customer)/tracking/[id].tsx'
text = read(rel)
if "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    }).start()" in text:
    replace_exact(
        rel,
        "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    }).start()",
        "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    } as any).start()",
    )

for rel in [
    'apps/mobile/lib/i18n/locales/en.ts',
    'apps/mobile/lib/i18n/locales/ta.ts',
    'apps/mobile/lib/i18n/locales/si.ts',
]:
    merge_duplicate_root_object(rel, 'profile')

for rel in [
    'apps/mobile/lib/i18n/locales/en.ts',
    'apps/mobile/lib/i18n/locales/ta.ts',
    'apps/mobile/lib/i18n/locales/si.ts',
]:
    lines = read(rel).splitlines(keepends=True)
    keys = [key for key, _, _ in top_level_chunks(lines)]
    dupes = sorted({key for key in keys if keys.count(key) > 1})
    print(rel, 'root dupes', dupes)

print('Phase 11 locale diagnostics complete.')
