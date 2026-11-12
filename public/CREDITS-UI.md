# UI credits and licences

Assets used by the Paanai interface (`src/client/ui`, `src/client/styles`). Everything is bundled
locally; the client makes no external requests.

## Fonts

| File (in `public/fonts/`) | Family | Licence | Source |
|---|---|---|---|
| `shrikhand-latin.woff2` | Shrikhand (display) | SIL Open Font License 1.1 (`OFL-Shrikhand.txt`) | github.com/jonpinhorn/shrikhand via npm @fontsource/shrikhand |
| `bricolage-grotesque-latin-var.woff2` | Bricolage Grotesque (UI) | SIL Open Font License 1.1 (`OFL-BricolageGrotesque.txt`) | github.com/ateliertriay/bricolage via npm @fontsource-variable/bricolage-grotesque |
| `fraunces-latin-var.woff2` (62.6 KB) | Fraunces, upright | SIL Open Font License 1.1 (`OFL-Fraunces.txt`) | github.com/undercasetype/Fraunces via github.com/google/fonts (`ofl/fraunces`) |
| `fraunces-italic-latin.woff2` (22.7 KB) | Fraunces, italic | SIL Open Font License 1.1 (`OFL-Fraunces.txt`) | same as above |
| `atkinson-hyperlegible-next-latin-var.woff2` (19.8 KB) | Atkinson Hyperlegible Next | SIL Open Font License 1.1 (`OFL-AtkinsonHyperlegibleNext.txt`) | github.com/googlefonts/atkinson-hyperlegible-next via github.com/google/fonts (`ofl/atkinsonhyperlegiblenext`) |

Total: 105 KB (budget 120 KB, build guide section 13).

- Copyright 2018 The Fraunces Project Authors (Undercase Type, Phaedra Charles, Flavia Zimbardi).
- Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors (Braille Institute, Applied Design Works, Elliott Scott, Megan Eiswerth, Letters From Sweden).
- Neither font declares a Reserved Font Name, so the subset files keep their original family names.

### How the files were made (12 Nov 2026)

Modified versions, as the OFL allows. Made with fontTools 4.65 (`varLib.instancer` + `subset`, woff2 flavour):

- **Fraunces upright:** variable font pinned to `WONK=0`, `SOFT=0`; kept `opsz` 24 to 144 and `wght` 400 to 700.
- **Fraunces italic:** static instance at `WONK=0`, `SOFT=0`, `opsz=48`, `wght=500`.
- **Atkinson Hyperlegible Next:** variable font with `wght` limited to 400 to 700.
- **All three:** subset to the Google Fonts "latin" range (U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD), with hinting removed and the name table (copyright and licence) kept.
- **OpenType features kept:**
  - Fraunces: kern, liga, case, rvrn, ss01
  - Atkinson Hyperlegible Next: kern, case, ccmp, locl, mark, mkmk, tnum, pnum, frac

## Icons and illustrations

All icons (`src/client/ui/icons.tsx`) and onboarding illustrations (`src/client/ui/screens/illustrations.tsx`) are original inline SVG drawn for Paanai. No icon library is used.
