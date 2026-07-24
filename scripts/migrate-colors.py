#!/usr/bin/env python3
"""
Migrate screens from `import { Colors } from '@/theme'` to useThemeColors() hook.

Two strategies:
  A) THEME-AWARE (for screens that should react to light/dark/outdoor):
     - Replace import with hook import
     - Add `const Colors = useThemeColors();` after the function declaration
     - Replace StyleSheet.create with useMemo(StyleSheet.create, [Colors])
       OR convert StyleSheet styles to inline if few enough

  B) STATIC (for screens that always use the same colors regardless of theme):
     - Replace `Colors.X` with literal hex values
     - Remove the import

Strategy A is better for screens with View backgrounds and text colors that
should adapt. Strategy B is fine for screens with fixed brand colors
(auth gradient screens, etc.) — already done for auth.

This script handles strategy A for the listed screens.
"""
import re
import sys
from pathlib import Path

# Color name → hex literal (for fallback / static replacement)
COLOR_MAP = {
    'metarduNavyDark': '#061122',
    'metarduNavyLight': '#1E3A5F',
    'metarduNavy': '#0B1F3A',
    'metarduOrangeDark': '#EA580C',
    'metarduOrangeLight': '#FB923C',
    'metarduOrange': '#F97316',
    'metarduCream': '#FAF7F2',
    'metarduWhite': '#FFFFFF',
    'successLight': '#D1FAE5',
    'success': '#10B981',
    'warningLight': '#FEF3C7',
    'warning': '#F59E0B',
    'dangerLight': '#FEE2E2',
    'danger': '#EF4444',
    'infoLight': '#DBEAFE',
    'info': '#3B82F6',
    'gray900': '#111827',
    'gray800': '#1F2937',
    'gray700': '#374151',
    'gray600': '#4B5563',
    'gray500': '#6B7280',
    'gray400': '#9CA3AF',
    'gray300': '#D1D5DB',
    'gray200': '#E5E7EB',
    'gray100': '#F3F4F6',
    'gray50': '#F9FAFB',
}

def static_migrate(filepath: Path) -> bool:
    """Replace all Colors.X with literals and remove import."""
    content = filepath.read_text()
    original = content

    for name, hex_val in COLOR_MAP.items():
        # Match Colors.name with word boundary
        content = re.sub(rf'\bColors\.{name}\b', f"'{hex_val}'", content)
    # Also handle template literals: `${Colors.X}15` → `${'#XXXXXX'}15`
    content = re.sub(r"\`\$\{Colors\.(\w+)\}", lambda m: f"`{{'{COLOR_MAP.get(m.group(1), '#000')}'", content)

    # Remove the Colors import line
    content = re.sub(r"^import \{ Colors \} from '@\/theme';\n", '', content, flags=re.MULTILINE)

    if content != original:
        filepath.write_text(content)
        return True
    return False

if __name__ == '__main__':
    files = sys.argv[1:]
    for f in files:
        path = Path(f)
        if path.exists():
            changed = static_migrate(path)
            print(f"{'MIGRATED' if changed else 'NO CHANGE'}: {f}")
        else:
            print(f"NOT FOUND: {f}")
