#!/usr/bin/env python3
"""
Convert static hex literals back to useThemeColors() hook calls.

Strategy: For each screen, identify hex literals that should be theme-reactive
(backgrounds, text colors, borders) and replace them with Colors.X from the hook.
Brand colors (orange, navy, white, cream) and semantic colors (success, warning,
danger, info) stay as literals — they're constant across themes.

Themeable hex → Colors token mapping (light mode values):
"""
import re
import sys
from pathlib import Path

# Hex literals that SHOULD be theme-reactive (these are the light-mode values)
# When we see these, replace with Colors.X
THEMEABLE = {
    # Backgrounds
    '#FAFAFA': 'bg',           # gray50 — page background
    '#FAF7F2': 'bg',           # metarduCream — also page background (legacy)
    '#F4F4F5': 'bgSubtle',     # gray100
    '#FFFFFF': 'bgCard',       # white — card background
    '#09090B': 'bg',           # gray950 — dark mode bg
    '#18181B': 'bgCard',       # gray900 — dark card
    '#27272A': 'border',       # gray800 — dark border
    # Text
    '#3F3F46': 'fgSecondary',  # gray700
    '#52525B': 'fgSecondary',  # gray600
    '#71717A': 'fgMuted',      # gray500
    '#6B7280': 'fgMuted',      # gray500 (legacy neutral)
    '#A1A1AA': 'fgSubtle',     # gray400
    '#9CA3AF': 'fgSubtle',     # gray400 (legacy neutral)
    '#D4D4D8': 'borderStrong', # gray300
    # Borders
    '#E4E4E7': 'border',       # gray200
    '#F3F4F6': 'bgSubtle',     # gray100 (legacy)
}

# These hex values are BRAND or SEMANTIC colors — keep as literals
KEEP_AS_LITERAL = {
    '#F97316', '#FB923C', '#EA580C',  # metarduOrange variants
    '#0B1F3A', '#1E3A5F', '#061122',  # metarduNavy variants
    '#10B981', '#F59E0B', '#EF4444', '#3B82F6',  # semantic
    '#D1FAE5', '#FEF3C7', '#FEE2E2', '#DBEAFE',  # semantic light
}

def migrate(filepath: Path) -> bool:
    """Convert themeable hex literals to Colors.X and add hook."""
    content = filepath.read_text()
    original = content

    # Check if already has the hook
    has_hook = 'useThemeColors' in content

    # Replace themeable hex literals with Colors.X
    # Match: '#XXXXXX' (with quotes)
    for hex_val, token in THEMEABLE.items():
        # Only replace if not in the keep-as-literal set
        if hex_val in KEEP_AS_LITERAL:
            continue
        # Replace '#XXXXXX' with Colors.token
        content = content.replace(f"'{hex_val}'", f'Colors.{token}')

    # Also handle template literals: `${'#XXXXXX'}15` → `${Colors.token}15`
    # Already handled by the above since we replace the quoted hex

    if content == original:
        return False

    # Add the hook import and call if not present
    if not has_hook:
        # Add import after the last @/ import
        import_pattern = r"(import [^']+'@/[^']+'\n)"
        matches = list(re.finditer(import_pattern, content))
        if matches:
            last_import = matches[-1]
            insert_pos = last_import.end()
            content = content[:insert_pos] + "import { useThemeColors } from '@/hooks/useThemeColors';\n" + content[insert_pos:]

        # Add hook call after function declaration
        # Find: export default function XXX() {
        #        or: export function XXX({
        func_pattern = r"(export default function \w+\([^)]*\)\s*\{)"
        match = re.search(func_pattern, content)
        if match:
            insert_pos = match.end()
            content = content[:insert_pos] + '\n  const Colors = useThemeColors();' + content[insert_pos:]

    filepath.write_text(content)
    return True

if __name__ == '__main__':
    files = sys.argv[1:]
    for f in files:
        path = Path(f)
        if path.exists():
            changed = migrate(path)
            print(f"{'MIGRATED' if changed else 'NO CHANGE'}: {f}")
        else:
            print(f"NOT FOUND: {f}")
