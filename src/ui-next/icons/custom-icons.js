// Icons drawn for this app (not from Lucide, so the generator never writes this file). icons.js reads them next to the generated set.
// Same grid as Lucide: 24 x 24, stroke only, round caps; icon() draws them with the same stroke width.
//
//   library      two books, one upright with a spine band and one leaning (task PA-03, brief 2.4): a shape with depth, where Lucide has four bars.
//   gear         an eight-tooth gear for Settings (the old interface used a gear too); it turns when Settings opens (brief 2.8).
//   waveform     five bars for Lyrics; they bounce when Lyrics opens.
//   link         a chain as two separate halves (the Play from URL button): on hover they pull apart and click back together (PA-08).
//   lyrics-expand, lyrics-shrink   the lyrics lines with four arrows at the corners, out and in: the right panel's "fill the app" and "lyrics only" buttons.
//   corners-out, corners-in   four corner brackets, apart and together: the right panel's "fill the app" button.
//   panel-right-filled   the right panel icon with its right window filled (a plain rectangle, square corners): shown while the panel is open.
//   panel-left, panel-left-filled   the same for the left panel.
//   send, cpu   the AI chat box: an arrow up for Send (Lucide's arrow-up) and the model chip (Lucide's cpu).
//   effort-low, effort-medium, effort-high   three rising bars, one, two or all three lit: the chat's mode (Low, Medium, High).
//   rail-house   the Home icon of the rail. The first path is a filled copy of the house; shell/rail.css clips it away and lets it rise
//                when Home becomes the active page (brief 2.7). `rail-door` turns into a gap in the fill while it is filled.

export const CUSTOM_ICONS = {
    "library": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"18\" rx=\"1.5\"/><path d=\"M3 8h7\"/><path d=\"M16.8 4.5 21.6 5.7 18.0 20.3 13.2 19.1z\"/>",
    "gear": "<path d=\"M9.76 5.47 10.50 2.72 13.50 2.72 14.24 5.47 15.04 5.80 17.50 4.38 19.62 6.50 18.20 8.96 18.53 9.76 21.28 10.50 21.28 13.50 18.53 14.24 18.20 15.04 19.62 17.50 17.50 19.62 15.04 18.20 14.24 18.53 13.50 21.28 10.50 21.28 9.76 18.53 8.96 18.20 6.50 19.62 4.38 17.50 5.80 15.04 5.47 14.24 2.72 13.50 2.72 10.50 5.47 9.76 5.80 8.96 4.38 6.50 6.50 4.38 8.96 5.80z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    "waveform": "<path d=\"M4 10v4\"/><path d=\"M8 6v12\"/><path d=\"M12 3v18\"/><path d=\"M16 7v10\"/><path d=\"M20 10v4\"/>",
    "link": "<path class=\"link-a\" d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path class=\"link-b\" d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
    "rail-house": "<path class=\"rail-fill\" d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" stroke=\"none\"/><path class=\"rail-door\" d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>",
    "lyrics-expand": "<path d=\"M8 9.5h8\"/><path d=\"M8 12h8\"/><path d=\"M8 14.5h5\"/><path d=\"M7 7 3 3\"/><path d=\"M3 7V3h4\"/><path d=\"m17 7 4-4\"/><path d=\"M17 3h4v4\"/><path d=\"m7 17-4 4\"/><path d=\"M3 17v4h4\"/><path d=\"m17 17 4 4\"/><path d=\"M21 17v4h-4\"/>",
    "lyrics-shrink": "<path d=\"M8 9.5h8\"/><path d=\"M8 12h8\"/><path d=\"M8 14.5h5\"/><path d=\"M3 3 7 7\"/><path d=\"M7 3v4H3\"/><path d=\"m21 3-4 4\"/><path d=\"M17 3v4h4\"/><path d=\"m3 21 4-4\"/><path d=\"M7 21v-4H3\"/><path d=\"m21 21-4-4\"/><path d=\"M17 21v-4h4\"/>",
    "corners-out": "<path d=\"M8 3H5a2 2 0 0 0-2 2v3\"/><path d=\"M21 8V5a2 2 0 0 0-2-2h-3\"/><path d=\"M3 16v3a2 2 0 0 0 2 2h3\"/><path d=\"M16 21h3a2 2 0 0 0 2-2v-3\"/>",
    "corners-in": "<path d=\"M8 3v3a2 2 0 0 1-2 2H3\"/><path d=\"M21 8h-3a2 2 0 0 1-2-2V3\"/><path d=\"M3 16h3a2 2 0 0 1 2 2v3\"/><path d=\"M16 21v-3a2 2 0 0 1 2-2h3\"/>",
    "send": "<path d=\"m5 12 7-7 7 7\"/><path d=\"M12 19V5\"/>",
    "cpu": "<path d=\"M12 20v2\"/><path d=\"M12 2v2\"/><path d=\"M17 20v2\"/><path d=\"M17 2v2\"/><path d=\"M2 12h2\"/><path d=\"M2 17h2\"/><path d=\"M2 7h2\"/><path d=\"M20 12h2\"/><path d=\"M20 17h2\"/><path d=\"M20 7h2\"/><path d=\"M7 20v2\"/><path d=\"M7 2v2\"/><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/><rect x=\"8\" y=\"8\" width=\"8\" height=\"8\" rx=\"1\"/>",
    "effort-low": "<path d=\"M6 19v-3\"/><path d=\"M12 19v-7\" opacity=\"0.3\"/><path d=\"M18 19V5\" opacity=\"0.3\"/>",
    "effort-medium": "<path d=\"M6 19v-3\"/><path d=\"M12 19v-7\"/><path d=\"M18 19V5\" opacity=\"0.3\"/>",
    "effort-high": "<path d=\"M6 19v-3\"/><path d=\"M12 19v-7\"/><path d=\"M18 19V5\"/>",
    "panel-right-filled": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M15 3v18\"/><rect x=\"15\" y=\"4\" width=\"5\" height=\"16\" fill=\"currentColor\" stroke=\"none\"/>",
    "panel-left": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M9 3v18\"/>",
    "panel-left-filled": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M9 3v18\"/><rect x=\"4\" y=\"4\" width=\"5\" height=\"16\" fill=\"currentColor\" stroke=\"none\"/>",
    "languages": "<path d=\"m5 8 6 6\"/><path d=\"m4 14 6-6 2-3\"/><path d=\"M2 5h12\"/><path d=\"M7 2h1\"/><path d=\"m22 22-5-10-5 10\"/><path d=\"M14 18h6\"/>",
    "eye-off": "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"/><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"/><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"/><path d=\"m2 2 20 20\"/>",
    "translation-off": "<path d=\"m5 8 6 6\"/><path d=\"m4 14 6-6 2-3\"/><path d=\"M2 5h12\"/><path d=\"M7 2h1\"/><path d=\"m22 22-5-10-5 10\"/><path d=\"M14 18h6\"/><path d=\"m2 2 20 20\"/>",
    "app-window": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"M10 4v4\"/><path d=\"M2 8h20\"/><path d=\"M6 4v4\"/>",
    "text-both": "<path d=\"M4 6h16\"/><path d=\"M4 10h11\"/><path d=\"M4 15h16\"/><path d=\"M4 19h11\"/>"
};
