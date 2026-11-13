# UI credits and licences

Assets used by the Paanai interface (`src/client/ui`, `src/client/styles`). Everything is bundled
locally; the client makes no external requests.

## Fonts

All fonts are under the SIL Open Font License 1.1, self-hosted from the npm Fontsource packages (unmodified latin subsets). Licence texts sit next to the files in `public/fonts/`.

| File (in `public/fonts/`) | Family | Where it is used | Licence file | Source |
| --- | --- | --- | --- | --- |
| `bagel-fat-one-latin.woff2` | Bagel Fat One | Loading screen, feed splash and wheel screens (titles) | `OFL-BagelFatOne.txt` | npm @fontsource/bagel-fat-one |
| `fraunces-black-latin.woff2`, `fraunces-black-italic-latin.woff2` | Fraunces (900) | Home and menu pages (headlines) | `OFL-Fraunces.txt` | npm @fontsource/fraunces |
| `outfit-latin-var.woff2` | Outfit | All body text, buttons and numbers | `OFL-Outfit.txt` | npm @fontsource-variable/outfit |

## Icons and illustrations

All icons (`src/client/ui/icons.tsx`) and onboarding illustrations (`src/client/ui/screens/illustrations.tsx`) are original inline SVG drawn for Paanai. No icon library is used.
