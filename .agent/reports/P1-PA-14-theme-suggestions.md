# P1-PA-14 Theme suggestions

Status: four themes of round 2 are built so the owner can see them in the app (2026-10-25): Pure Black, Graphite Gold, Carbon and Honey, High Contrast. They are in `tokens.css`, listed in Appearance settings (with preview swatches), and in the boot script. `ui-next-tokens` (contrast and name rules) passes with them. On 2026-10-26 the owner also asked for the colored ones of round 1 except Nordic Dusk, so Midnight Blue, Aubergine and Rose, Ocean Teal, Crimson Noir and Violet Night are built too (12 themes in all; the tokens test passes with 59 checks). Steel and Lemon, Ash and Mustard, Nordic Dusk and the gradients are not built.

The app has three dark themes: Warm Graphite, Deep Forest and Espresso Copper. Each theme is a block of the same 15 `--c-*` names, so a theme only swaps token values (D3, D60). Every block below was checked against the rules in `ui-next-tokens.test.js`: text, accent and danger reach 4.5:1 on all four surfaces, text on the accent reaches 4.5:1, and the five accent choices (green, pink, purple, yellow, white) keep 4.5:1 on every surface of the theme.

## Round 2: black, grey and yellow (the owner's direction)
| Theme | Feel | Accent |
|---|---|---|
| Pure Black | true black (OLED), white text, bright yellow | #ffd60a |
| Graphite Gold | neutral dark grey, warm gold | #f5c518 |
| Steel and Lemon | cool steel greys, sharp lemon | #f2e63c |
| Ash and Mustard | warm taupe greys, muted mustard | #e3b341 |
| Carbon and Honey | blue-black carbon, honey yellow, glow ready | #ffc94d |
| High Contrast | black and white, strong borders, signal yellow | #ffe600 |

How they differ: Pure Black is true black for OLED. Graphite Gold is neutral grey with gold. Steel and Lemon is cooler grey with a sharper lemon. Ash and Mustard is warm taupe grey with a muted mustard, the calmest. Carbon and Honey is blue-black and the best base for the gradients. High Contrast is black and white with strong borders and signal yellow, for accessibility.

## Gradients (a second step, all token based)
1. **Ambient glow:** a faint radial wash of the accent (about 8 to 14 percent, `color-mix`) in the top corner of the main view and fading out. No new color names. Shown on Carbon and Honey in the preview.
2. **Accent sheen:** the Play button and the progress fill get a light gradient from `--accent-hover` to `--accent`. Also shown on Carbon and Honey.
3. **Cover tint (later):** the main view's top takes a very low-opacity tint of the playing song's cover; needs a color read from the cover, so it is a small build of its own.

## Not suggested yet
A light theme (Porcelain and Teal in D63): text, accents and the engine's old shapes assume dark surfaces, and the accent-choices test would need a second set of accents. It is a separate, larger task.

## Blocks, round 2
```css
:root[data-theme='pure-black'] {
    --c-ground: #000000;
    --c-surface: #0a0a0a;
    --c-raised: #141414;
    --c-selected: #1e1e1e;
    --c-line: #1d1d1d;
    --c-line-strong: #2c2c2c;
    --c-ink: #f2f2f2;
    --c-ink-dim: #a3a3a3;
    --c-ink-faint: #939393;
    --c-accent: #ffd60a;
    --c-accent-hover: #ffe04d;
    --c-accent-own: #ffd60a;
    --c-accent-rgb: 255 214 10;
    --c-on-accent: #000000;
    --c-danger: #ff8a80;
}

:root[data-theme='graphite-gold'] {
    --c-ground: #141516;
    --c-surface: #1b1c1e;
    --c-raised: #232527;
    --c-selected: #2c2e31;
    --c-line: #2a2c2f;
    --c-line-strong: #393c40;
    --c-ink: #eeeeee;
    --c-ink-dim: #a4a7ab;
    --c-ink-faint: #989b9f;
    --c-accent: #f5c518;
    --c-accent-hover: #f8d24a;
    --c-accent-own: #f5c518;
    --c-accent-rgb: 245 197 24;
    --c-on-accent: #141516;
    --c-danger: #f08a80;
}

:root[data-theme='steel-lemon'] {
    --c-ground: #15181c;
    --c-surface: #1c2024;
    --c-raised: #252a30;
    --c-selected: #2b3036;
    --c-line: #2c3238;
    --c-line-strong: #3b434b;
    --c-ink: #eceff2;
    --c-ink-dim: #a2abb4;
    --c-ink-faint: #96a0aa;
    --c-accent: #f2e63c;
    --c-accent-hover: #f6ed6c;
    --c-accent-own: #f2e63c;
    --c-accent-rgb: 242 230 60;
    --c-on-accent: #15181c;
    --c-danger: #f08a80;
}

:root[data-theme='ash-mustard'] {
    --c-ground: #1a1918;
    --c-surface: #21201e;
    --c-raised: #2a2826;
    --c-selected: #2f2d2b;
    --c-line: #34312e;
    --c-line-strong: #443f3b;
    --c-ink: #efeae3;
    --c-ink-dim: #aaa49b;
    --c-ink-faint: #a39d94;
    --c-accent: #e3b341;
    --c-accent-hover: #e9c264;
    --c-accent-own: #e3b341;
    --c-accent-rgb: 227 179 65;
    --c-on-accent: #1a1918;
    --c-danger: #f08a80;
}

:root[data-theme='carbon-honey'] {
    --c-ground: #0d0e10;
    --c-surface: #131518;
    --c-raised: #1b1e22;
    --c-selected: #24282d;
    --c-line: #22262b;
    --c-line-strong: #313740;
    --c-ink: #eaecef;
    --c-ink-dim: #9ca3ad;
    --c-ink-faint: #8f97a2;
    --c-accent: #ffc94d;
    --c-accent-hover: #ffd677;
    --c-accent-own: #ffc94d;
    --c-accent-rgb: 255 201 77;
    --c-on-accent: #0d0e10;
    --c-danger: #f08a80;
}

:root[data-theme='high-contrast'] {
    --c-ground: #000000;
    --c-surface: #080808;
    --c-raised: #111111;
    --c-selected: #1c1c1c;
    --c-line: #4a4a4a;
    --c-line-strong: #7a7a7a;
    --c-ink: #ffffff;
    --c-ink-dim: #d0d0d0;
    --c-ink-faint: #bdbdbd;
    --c-accent: #ffe600;
    --c-accent-hover: #fff04d;
    --c-accent-own: #ffe600;
    --c-accent-rgb: 255 230 0;
    --c-on-accent: #000000;
    --c-danger: #ff9d94;
}
```

## Round 1 (colored darks, kept as an alternative)
Midnight Blue `#6fa8ff`, Aubergine and Rose `#f08cb6`, Ocean Teal `#4fd1c5`, Crimson Noir `#ee6770`, Nordic Dusk `#88c0d0`, Violet Night `#a58bff`. Their blocks:

```css
:root[data-theme='midnight-blue'] {
    --c-ground: #0a0e1a;
    --c-surface: #0f1524;
    --c-raised: #161d31;
    --c-selected: #1e2740;
    --c-line: #1c2540;
    --c-line-strong: #28345a;
    --c-ink: #e8ecf6;
    --c-ink-dim: #97a2bd;
    --c-ink-faint: #8993b0;
    --c-accent: #6fa8ff;
    --c-accent-hover: #8bbaff;
    --c-accent-own: #6fa8ff;
    --c-accent-rgb: 111 168 255;
    --c-on-accent: #0a0e1a;
    --c-danger: #f08a80;
}

:root[data-theme='aubergine-rose'] {
    --c-ground: #130c14;
    --c-surface: #1a111c;
    --c-raised: #231925;
    --c-selected: #2d2132;
    --c-line: #2b1f30;
    --c-line-strong: #3a2b41;
    --c-ink: #f1e7ef;
    --c-ink-dim: #ab97aa;
    --c-ink-faint: #9e8b9e;
    --c-accent: #f08cb6;
    --c-accent-hover: #f4a3c6;
    --c-accent-own: #f08cb6;
    --c-accent-rgb: 240 140 182;
    --c-on-accent: #130c14;
    --c-danger: #f08a80;
}

:root[data-theme='ocean-teal'] {
    --c-ground: #091214;
    --c-surface: #0e1a1d;
    --c-raised: #142327;
    --c-selected: #1b2f34;
    --c-line: #1a2b30;
    --c-line-strong: #253b41;
    --c-ink: #e2eeee;
    --c-ink-dim: #8fa8aa;
    --c-ink-faint: #829b9d;
    --c-accent: #4fd1c5;
    --c-accent-hover: #6ddbd1;
    --c-accent-own: #4fd1c5;
    --c-accent-rgb: 79 209 197;
    --c-on-accent: #091214;
    --c-danger: #f08a80;
}

:root[data-theme='crimson-noir'] {
    --c-ground: #0f0b0c;
    --c-surface: #171112;
    --c-raised: #1f1719;
    --c-selected: #291f22;
    --c-line: #291d20;
    --c-line-strong: #382a2d;
    --c-ink: #f0e7e7;
    --c-ink-dim: #a79496;
    --c-ink-faint: #9a8789;
    --c-accent: #ee6770;
    --c-accent-hover: #f2838a;
    --c-accent-own: #ee6770;
    --c-accent-rgb: 238 103 112;
    --c-on-accent: #0f0b0c;
    --c-danger: #f4a29a;
}

:root[data-theme='nordic-dusk'] {
    --c-ground: #171c25;
    --c-surface: #1d232e;
    --c-raised: #252c3a;
    --c-selected: #272e3c;
    --c-line: #2a3240;
    --c-line-strong: #374155;
    --c-ink: #e5e9f0;
    --c-ink-dim: #9aa5b8;
    --c-ink-faint: #97a2b5;
    --c-accent: #88c0d0;
    --c-accent-hover: #a0cdda;
    --c-accent-own: #88c0d0;
    --c-accent-rgb: 136 192 208;
    --c-on-accent: #171c25;
    --c-danger: #f09a90;
}

:root[data-theme='violet-night'] {
    --c-ground: #0e0c17;
    --c-surface: #141120;
    --c-raised: #1c182b;
    --c-selected: #251f38;
    --c-line: #231e36;
    --c-line-strong: #322a4a;
    --c-ink: #ece9f6;
    --c-ink-dim: #9d97b8;
    --c-ink-faint: #9089ab;
    --c-accent: #a58bff;
    --c-accent-hover: #b8a2ff;
    --c-accent-own: #a58bff;
    --c-accent-rgb: 165 139 255;
    --c-on-accent: #0e0c17;
    --c-danger: #f08a80;
}
```
After a pick: add the blocks to `tokens.css`, add the names to `THEMES` in the tokens test and to the Appearance previews (`tokens.css` section 3), and run `ui-next-tokens`, `ui-next-appearance`.
