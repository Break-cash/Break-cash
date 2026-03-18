# Application Color System Refresh – Summary

## Overview

The app color system was redesigned and applied globally so the UI uses a single, premium dark fintech palette. Layout, components, and behavior are unchanged; only colors and theme tokens were updated.

## 1. Global Theme / Tokens

### `src/index.css` – `:root` design tokens

- **Already present** (from a previous task):  
  `--bg-base`, `--bg-surface`, `--bg-card`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled`, `--accent-blue`, `--accent-blue-soft`, `--accent-cyan`, `--accent-emerald`, `--accent-emerald-soft`, `--accent-amber`, `--accent-red`, `--border-soft`, `--border-glass`, `--border-blue`, `--border-green`, `--shadow-card`, `--shadow-inner`, `--glow-blue`, `--glow-green`, `--gradient-page`, `--gradient-card`.

- **Updated**:
  - `color` and `background-color` in `:root` now use `var(--text-primary)` and `var(--bg-base)`.
  - `body` background set to `var(--gradient-page)` (replacing the old green-tinted radial gradients).
  - `.app-root` color set to `var(--text-primary)`.
  - `.sidebar` uses `var(--bg-base)` and `var(--border-soft)`.
  - `.logo-circle` and `.menu-item-active` use `var(--accent-emerald-soft)` / `var(--accent-emerald)`.
  - `.logo-sub` uses `var(--text-muted)`; `.menu-item` / `.menu-item:hover` use `var(--text-secondary)` and `var(--bg-elevated)` / `var(--text-primary)`.
  - `.user-chip` and `.avatar-circle` use `var(--bg-surface)`, `var(--border-soft)`, `var(--bg-elevated)`.
  - **Elite overrides:** `--elite-bg`, `--elite-surface`, `--elite-surface-2`, `--elite-border`, `--elite-text`, `--elite-muted`, `--elite-muted-2`, `--elite-accent`, `--elite-accent-soft` now reference the same design tokens (e.g. `var(--bg-base)`, `var(--text-primary)`, `var(--accent-blue)`).
  - **Bulk replacements:** All `#161c2d` (borders and backgrounds) replaced with `var(--border-soft)` or `var(--bg-elevated)`. All `#0a0e17` replaced with `var(--bg-base)`. Old greens `#00e676`, `#00c853`, `#64dd17` replaced with accent tokens. `#007bff` replaced with `var(--accent-blue)`.

### `src/tailwind.css` – Tailwind `@theme` and global classes

- **@theme** now maps app and semantic colors to the design tokens:
  - `--color-app-bg` → `var(--bg-base)` (and same pattern for card, elevated, surface, border, muted, glass).
  - `--color-brand-blue` → `var(--accent-blue)`, `--color-brand-blue-soft` → `rgba(59,130,246,0.18)`.
  - `--color-positive` → `var(--accent-emerald)`, `--color-negative` → `var(--accent-red)`.
  - Added `--color-amber`, `--color-cyan` for future use.
- **html, body, #root:** `background: var(--color-app-bg)`, `color: var(--text-primary)`.
- **.liquid-nav:** Uses `var(--bg-surface)`, `var(--bg-base)`, `var(--shadow-inner)`.
- **.liquid-glass-icon,** **.liquid-glass-item,** **.liquid-glass-item-active:** Use `var(--border-glass)`, `var(--shadow-card)`, `var(--border-blue)`, `var(--glow-blue)`.
- **.nav-level-item,** **.nav-level-icon:** Use `var(--border-glass)` and adjusted gradients.
- **.crypto-bottom-nav-***: Backgrounds use `var(--bg-base)`, `var(--bg-elevated)`; borders use `var(--border-soft)`; text uses `var(--text-secondary)`; FAB and bcmark use theme tokens and `var(--shadow-card)`.
- **.deposit-glow-icon,** **.withdraw-glow-icon:** Use `var(--shadow-inner)`, `var(--border-blue)` / `var(--border-green)`, `var(--glow-blue)` / `var(--glow-green)`, `var(--shadow-card)`.
- **.identity-badge-blue,** **.identity-badge-gold:** Use `var(--border-blue)`, `var(--accent-blue-soft)`, `var(--accent-blue)`, `var(--glow-blue)`, and `var(--accent-amber)`.
- **:root[data-theme='dark']** and **:root[data-theme='light']:** All variables now reference the same design tokens (no separate light palette; both use the dark fintech palette).

## 2. Palette Application Across the App

- **Backgrounds:** Base/surface/card/elevated come from `--bg-*` and Tailwind `bg-app-bg`, `bg-app-card`, `bg-app-elevated` (and elite vars in legacy CSS).
- **Text:** Primary/secondary/muted use `--text-*`; Tailwind `text-app-muted` etc. use the new muted/secondary.
- **Borders:** Global borders use `var(--border-soft)` or `var(--border-glass)`; blue/green accents use `var(--border-blue)` and `var(--border-green)`.
- **Brand blue:** Navigation, active states, links, primary actions use `--color-brand-blue` (Tailwind `brand-blue`) = `#2563EB`.
- **Green / emerald:** Deposit, success, profit, withdrawable balances use `--accent-emerald` / `--accent-emerald-soft` (and existing Tailwind `emerald-500` where kept).
- **Amber:** Locked balances, warnings, chips use `--accent-amber`.
- **Red:** Errors and destructive actions use `--color-negative` / `--accent-red`.

Buttons (e.g. Deposit / Withdraw on Profile) were not restyled; they already use Tailwind `border-emerald-500/30` and `border-brand-blue/30`, which now resolve against the new theme (brand-blue updated; emerald-500 remains Tailwind default, close to the new green).

## 3. Files Modified

| File | Changes |
|------|--------|
| **src/index.css** | `:root` and body use tokens; sidebar, logo, menu, user-chip, avatar, elite vars and all bulk hex replacements (e.g. #161c2d, #0a0e17, #00e676, #00c853, #007bff) switched to design tokens. |
| **src/tailwind.css** | @theme variables point to design tokens; liquid-nav, liquid-glass-*, nav-level-*, crypto-bottom-nav-*, deposit/withdraw-glow-icon, identity-badge-blue/gold, and data-theme blocks updated to new palette. |
| **src/pages/Profile.tsx** | Owner tools chip: `bg-[#252d3a]` / `hover:bg-[#2b3443]` replaced with `bg-app-elevated` and `hover:bg-app-card`. |
| **src/components/mobile/MobileBottomNav.tsx** | Nav container uses `var(--bg-surface)` and `var(--shadow-card)`; FAB gradient uses `var(--bg-elevated)` and `var(--bg-base)`; active state uses `var(--border-blue)` and updated shadow. |

No other component files were changed. Cards, modals, inputs, and tabs that already use Tailwind classes like `bg-app-card`, `border-app-border`, `text-app-muted`, or `brand-blue` now automatically use the new palette via the updated theme and tokens.

## 4. Manual Overrides / Exceptions

- **Tailwind v4 @theme:** Uses `var(--bg-base)` etc. These resolve at runtime from `:root` in `index.css`; the build succeeds and output CSS contains the variable references.
- **identity-badge-gold:** One gradient stop left as hex `#b45309` (darker amber) for contrast; the rest use `var(--accent-amber)`.
- **Profile Deposit/Withdraw buttons:** Still use Tailwind `emerald-500` and `brand-blue`; no class changes, only theme semantics.
- **TotalAssetsCard, WalletPage, Layout:** No structural or class changes; they rely on global background and Tailwind theme (e.g. `border-white/10`, `shadow-xl`, `brand-blue`).

## 5. Old Inconsistent Colors Removed

- Replaced across `index.css`: `#161c2d`, `#0a0e17`, `#00e676`, `#00c853`, `#64dd17`, `#007bff`, and the old elite hex values.
- Replaced in `tailwind.css`: Old `#1b1d21`, `#24272d`, `#007bff`, liquid-nav and bottom-nav hex backgrounds/borders, and deposit/withdraw glow hex with token-based values.
- Grep for `#007bff`, `#1b1d21`, `#24272d`, `#2ecc71`, `#ff4d4f` in `src` returns no matches.

## 6. Validation

- **Build:** `npm run build` completes successfully.
- **Consistency:** Single source of truth is `:root` in `index.css`; Tailwind and global classes reference it.
- **Contrast / readability:** Primary text `#F8FAFC` on dark backgrounds; secondary/muted tuned for hierarchy.
- **RTL / layout:** No layout or RTL logic changed; only color values and token references.
- **Mobile:** Mobile bottom nav uses the same tokens; no structural changes.

## 7. Functional Color Mapping (Reference)

| Meaning | Use |
|--------|-----|
| Blue | Navigation, active states, linked actions, highlights (`--accent-blue`, `--border-blue`, `brand-blue`) |
| Green / Emerald | Deposit, profit, success, withdrawable (`--accent-emerald`, `--border-green`, `emerald-500`) |
| Amber | Locked balances, pending, warnings (`--accent-amber`) |
| Red | Errors, destructive actions (`--accent-red`, `--color-negative`) |
| Neutral | Inactive, secondary UI (`--border-soft`, `--text-muted`, `--text-secondary`) |
