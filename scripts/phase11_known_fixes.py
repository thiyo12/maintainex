from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch_missing_company_close(rel: str) -> None:
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    bad = "    },\n  postJob: {"
    good = "    },\n  },\n  postJob: {"
    count = text.count(bad)
    if count != 1:
        raise RuntimeError(f'Expected exactly one missing company close pattern in {rel}; found {count}')
    path.write_text(text.replace(bad, good, 1), encoding='utf-8')


for rel in [
    'apps/mobile/lib/i18n/locales/ta.ts',
    'apps/mobile/lib/i18n/locales/si.ts',
]:
    patch_missing_company_close(rel)

print('Restored missing company-object closures in Tamil and Sinhala locale files.')
