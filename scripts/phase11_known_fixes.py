from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel: str, text: str) -> None:
    (ROOT / rel).write_text(text, encoding='utf-8')


def replace_exact(rel: str, old: str, new: str, required: bool = True) -> None:
    text = read(rel)
    if old not in text:
        if required:
            raise RuntimeError(f'Expected text not found in {rel}: {old[:120]!r}')
        return
    write(rel, text.replace(old, new))


def remove_nth_exact_line(rel: str, line: str, n: int) -> None:
    text = read(rel)
    needle = line + '\n'
    positions = []
    start = 0
    while True:
        pos = text.find(needle, start)
        if pos < 0:
            break
        positions.append(pos)
        start = pos + len(needle)
    if len(positions) < n:
        raise RuntimeError(f'Expected at least {n} copies of {line!r} in {rel}; found {len(positions)}')
    pos = positions[n - 1]
    text = text[:pos] + text[pos + len(needle):]
    write(rel, text)


# Customer create flow: React 19 no longer exposes a global JSX namespace.
rel = 'apps/mobile/app/(customer)/jobs/v2/create.tsx'
replace_exact(rel, "import { Component, useState, useEffect, useRef } from 'react'", "import React, { Component, useState, useEffect, useRef } from 'react'")
replace_exact(rel, ".filter(l => l.trim())", ".filter((l: string) => l.trim())", required=False)
replace_exact(rel, "Record<string, (props: any) => JSX.Element>", "Record<string, React.ComponentType<any>>")
replace_exact(rel, "function categoryIcon(name?: string): (props: any) => JSX.Element", "function categoryIcon(name?: string): React.ComponentType<any>")

# Quote list uses the package's default export.
rel = 'apps/mobile/app/(customer)/jobs/v2/quotes/[id].tsx'
replace_exact(rel, "import { ReanimatedSwipeable } from 'react-native-gesture-handler/ReanimatedSwipeable'", "import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'")

# Waiting screen: the API can legitimately return a null budget; protect nullable job while polling.
rel = 'apps/mobile/app/(customer)/jobs/waiting/[id].tsx'
replace_exact(rel, '  budgetAmount: number\n', '  budgetAmount: number | null\n')
replace_exact(rel, '            {job.quotes.map((q) => (', '            {(job?.quotes || []).map((q) => (')
replace_exact(rel, '`/(customer)/jobs/v2/quotes/${job.id}?highlight=${q.id}`', '`/(customer)/jobs/v2/quotes/${job?.id || jobId}?highlight=${q.id}`')
replace_exact(rel, '`/(customer)/jobs/v2/quotes/${job.id}`', '`/(customer)/jobs/v2/quotes/${job?.id || jobId}`')

# react-native-maps AnimatedRegion owns its animation API; React Native Animated.timing does not accept it.
rel = 'apps/mobile/app/(customer)/tracking/[id].tsx'
replace_exact(
    rel,
    "    Animated.timing(animCoord, {\n      toValue: { latitude: providerCoord.latitude, longitude: providerCoord.longitude },\n      duration: 1500,\n      useNativeDriver: false,\n    }).start()",
    "    animCoord.timing({\n      latitude: providerCoord.latitude,\n      longitude: providerCoord.longitude,\n      duration: 1500,\n      useNativeDriver: false,\n    }).start()",
)

# Tasker earnings references a topBar style that was omitted during the earlier visual conversion.
rel = 'apps/mobile/app/(tasker)/(tabs)/earnings.tsx'
replace_exact(
    rel,
    "const makeStyles = (colors: any) => StyleSheet.create({\n  container: { flex: 1, backgroundColor: colors.cream },\n  heading:",
    "const makeStyles = (colors: any) => StyleSheet.create({\n  container: { flex: 1, backgroundColor: colors.background },\n  topBar: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },\n  heading:",
)

# Supported Phosphor icon names + strict useRef initial values.
rel = 'apps/mobile/app/(tasker)/(tabs)/index.tsx'
replace_exact(rel, 'AlertTriangle', 'Warning')
replace_exact(rel, 'useRef<ReturnType<typeof setInterval>>()', 'useRef<ReturnType<typeof setInterval> | null>(null)')

rel = 'apps/mobile/app/(tasker)/(tabs)/profile.tsx'
replace_exact(rel, 'Ribbon', 'Medal')

rel = 'apps/mobile/app/(tasker)/jobs/v2/manage/[id].tsx'
replace_exact(rel, 'Navigation', 'NavigationArrow')

# Skills endpoint has had both array and {categories} response shapes across versions.
rel = 'apps/mobile/app/(tasker)/settings/job-selection.tsx'
replace_exact(
    rel,
    "      const res = await skillsApi.list()\n      setCats(res.categories || [])",
    "      const res: any = await skillsApi.list()\n      setCats(Array.isArray(res) ? res : (res?.categories || []))",
)

# Search refs need explicit initial values and tasker API results need normalization into the view model.
rel = 'apps/mobile/components/shared/AISearchBar.tsx'
replace_exact(rel, 'const debounceRef = useRef<ReturnType<typeof setTimeout>>()', 'const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)')
replace_exact(
    rel,
    "            const real = (list || []).slice(0, 3)\n            setTaskerResults(real.length > 0 ? real : SAMPLE_TASKER_RESULTS)",
    "            const real: TaskerResult[] = (list || []).slice(0, 3).map((item: any) => ({\n              id: item.id,\n              userId: item.userId || item.user?.id || item.id,\n              bio: item.bio || '',\n              hourlyRate: Number(item.hourlyRate || 0),\n              skills: Array.isArray(item.skills) ? item.skills : [],\n              rating: Number(item.rating || 0),\n              completedJobs: Number(item.completedJobs || 0),\n              isVerified: !!item.isVerified,\n              isOnline: !!item.isOnline,\n              user: {\n                id: item.user?.id || item.userId || item.id,\n                name: item.user?.name || item.name || 'Tasker',\n                phone: item.user?.phone || '',\n                email: item.user?.email || '',\n              },\n            }))\n            setTaskerResults(real.length > 0 ? real : SAMPLE_TASKER_RESULTS)",
)

# Remove duplicate translation keys while keeping the earlier, more detailed copy.
for rel, duplicate_lines in {
    'apps/mobile/lib/i18n/locales/en.ts': [
        ("    reviews: 'Reviews',", 2),
        ("    rating: 'Rating',", 2),
        ("    fullName: 'Full Name',", 1),
        ("    messages: 'Messages',", 2),
    ],
    'apps/mobile/lib/i18n/locales/ta.ts': [
        ("    reviews: 'மதிப்புரைகள்',", 2),
        ("    fullName: 'முழு பெயர்',", 1),
        ("    messages: 'செய்திகள்',", 2),
    ],
    'apps/mobile/lib/i18n/locales/si.ts': [
        ("    reviews: 'සමාලෝචන',", 2),
        ("    fullName: 'සම්පූර්ණ නම',", 1),
        ("    messages: 'පණිවිඩ',", 2),
    ],
}.items():
    for line, nth in duplicate_lines:
        remove_nth_exact_line(rel, line, nth)

print('Phase 11 deterministic fixes applied.')
