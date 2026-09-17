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
    """Return (key, start, end-exclusive) for root object properties.

    Locale files use two spaces for root properties. A chunk ends where the next
    two-space property begins, so nested object closings cannot confuse us.
    """
    prop_re = re.compile(r'^  ([A-Za-z0-9_]+):')
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
    """Extract direct properties from a `  key: { ... }` root object chunk."""
    prop_re = re.compile(r'^    ([A-Za-z0-9_]+):')
    starts: list[tuple[str, int]] = []
    for i, line in enumerate(object_chunk[1:], start=1):
        m = prop_re.match(line)
        if m:
            starts.append((m.group(1), i))
    props: list[tuple[str, list[str]]] = []
    for idx, (key, start) in enumerate(starts):
        end = starts[idx + 1][1] if idx + 1 < len(starts) else len(object_chunk)
        chunk = object_chunk[start:end]
        # The final property may include the root object's closing line. Remove it;
        # we append one canonical root closing below.
        while chunk and chunk[-1] in ('  },\n', '}\n'):
            chunk = chunk[:-1]
        props.append((key, chunk))
    return props


def merge_duplicate_root_object(rel: str, target_key: str) -> None:
    lines = read(rel).splitlines(keepends=True)
    chunks = top_level_chunks(lines)
    matches = [(start, end) for key, start, end in chunks if key == target_key]
    if len(matches) <= 1:
        # Still dedupe direct keys in the one object if a merge previously left
        # duplicate first-level properties.
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

    # Remove duplicate chunks from last to first, then replace the original first
    # location with the merged canonical block.
    first_start, first_end = matches[0]
    new_lines = lines[:]
    for start, end in reversed(matches[1:]):
        del new_lines[start:end]
    # Recompute the first chunk boundary after deletes; its start is unchanged and
    # its old end is still valid because all removed chunks were later in the file.
    new_lines[first_start:first_end] = rebuilt
    write(rel, ''.join(new_lines))


# Current final TypeScript blockers.
rel = 'apps/mobile/app/(customer)/tracking/[id].tsx'
text = read(rel)
if "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    }).start()" in text:
    replace_exact(
        rel,
        "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    }).start()",
        "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    } as any).start()",
    )

# Locale files accumulated duplicate root `profile` objects and duplicate direct
# keys during prior merges. Canonicalize them deterministically.
for rel in [
    'apps/mobile/lib/i18n/locales/en.ts',
    'apps/mobile/lib/i18n/locales/ta.ts',
    'apps/mobile/lib/i18n/locales/si.ts',
]:
    merge_duplicate_root_object(rel, 'profile')

# Assert the root locale objects now contain unique keys. This prevents us from
# silently reintroducing TS1117 while fixing only the currently reported line.
for rel in [
    'apps/mobile/lib/i18n/locales/en.ts',
    'apps/mobile/lib/i18n/locales/ta.ts',
    'apps/mobile/lib/i18n/locales/si.ts',
]:
    lines = read(rel).splitlines(keepends=True)
    keys = [key for key, _, _ in top_level_chunks(lines)]
    dupes = sorted({key for key in keys if keys.count(key) > 1})
    if dupes:
        raise RuntimeError(f'Duplicate root locale keys remain in {rel}: {dupes}')

print('Phase 11 stage-3 TypeScript fixes applied and locale root keys verified.')
