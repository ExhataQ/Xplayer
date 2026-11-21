// Icons drawn for this app (not from Lucide, so the generator never writes this file). icons.js reads them next to the generated set.
// Same grid as Lucide: 24 x 24, stroke only, round caps; icon() draws them with the same stroke width.
//
//   library      two books, one upright with a spine band and one leaning: a shape with depth, where Lucide has four bars.
//   gear         an eight-tooth gear for Settings (the old interface used a gear too); it turns when Settings opens.
//   waveform     five bars for Lyrics; they bounce when Lyrics opens.
//   visualizer   one line that rises and falls like a pulse: the player bar's visualizer button.
//   album, artist   a disc and a head-and-shoulders: the kinds of source in the "Add songs from" picker.
//   link         a chain as two separate halves (the Play from URL button): on hover they pull apart and click back together.
//   lyrics-expand, lyrics-shrink   the lyrics lines with four arrows at the corners, out and in: the right panel's "fill the app" and "lyrics only" buttons.
//   corners-out, corners-in   four corner brackets, apart and together: the right panel's "fill the app" button.
//   eye, refresh-cw, copy, heart-pulse   Lucide's shapes (ISC), kept here because the generated set holds only what the app drew at first: Library health and Duplicates (show again, search again, no duplicates).
//   window-open   a window with a title bar and an arrow leaving its top right corner: "open in a new window" (the Metadata and Sync tools).
//   panel-right-filled   the right panel icon with its right window filled (a plain rectangle, square corners): shown while the panel is open.
//   panel-left, panel-left-filled   the same for the left panel.
//   text-search   lines with a magnifier (Lucide, ISC): the right panel's "Find lyrics online" button.
//   send, cpu   the AI chat box: an arrow up for Send (Lucide's arrow-up) and the model chip (Lucide's cpu).
//   effort-low, effort-medium, effort-high   three rising bars, one, two or all three lit: the chat's mode (Low, Medium, High).
//   star   a five-point star (the rating stars); drawn with the outline, and filled by CSS (fill: currentColor) when a star is on.
//   mini-player, quick-player   the two small players: Lucide's picture-in-picture-2 (ISC) for the Mini Player: a window with a small picture in its bottom right corner, like a floating player; the Quick Player is a wide window with a big picture and two lines of text (Quick).
//   funnel   Lucide's funnel (ISC): the filter icon of the two list-options buttons (the song list header and the Library panel).
//   rail-house   the Home icon of the rail. The first path is a filled copy of the house; shell/rail.css clips it away and lets it rise
//                when Home becomes the active page. `rail-door` turns into a gap in the fill while it is filled.

export const CUSTOM_ICONS = {
    "library": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"18\" rx=\"1.5\"/><path d=\"M3 8h7\"/><path d=\"M16.8 4.5 21.6 5.7 18.0 20.3 13.2 19.1z\"/>",
    "gear": "<path d=\"M9.76 5.47 10.50 2.72 13.50 2.72 14.24 5.47 15.04 5.80 17.50 4.38 19.62 6.50 18.20 8.96 18.53 9.76 21.28 10.50 21.28 13.50 18.53 14.24 18.20 15.04 19.62 17.50 17.50 19.62 15.04 18.20 14.24 18.53 13.50 21.28 10.50 21.28 9.76 18.53 8.96 18.20 6.50 19.62 4.38 17.50 5.80 15.04 5.47 14.24 2.72 13.50 2.72 10.50 5.47 9.76 5.80 8.96 4.38 6.50 6.50 4.38 8.96 5.80z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    "waveform": "<path d=\"M4 10v4\"/><path d=\"M8 6v12\"/><path d=\"M12 3v18\"/><path d=\"M16 7v10\"/><path d=\"M20 10v4\"/>",
    "visualizer": "<path d=\"M2 12h4l3.2-8 5.6 16L18 12h4\"/>",
    "album": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    "artist": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>",
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
    "text-search": "<path d=\"M21 6H3\"/><path d=\"M10 12H3\"/><path d=\"M10 18H3\"/><circle cx=\"17\" cy=\"15\" r=\"3\"/><path d=\"m21 19-1.9-1.9\"/>",
    "languages": "<path d=\"m5 8 6 6\"/><path d=\"m4 14 6-6 2-3\"/><path d=\"M2 5h12\"/><path d=\"M7 2h1\"/><path d=\"m22 22-5-10-5 10\"/><path d=\"M14 18h6\"/>",
    "eye-off": "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"/><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"/><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"/><path d=\"m2 2 20 20\"/>",
    "translation-off": "<path d=\"m5 8 6 6\"/><path d=\"m4 14 6-6 2-3\"/><path d=\"M2 5h12\"/><path d=\"M7 2h1\"/><path d=\"m22 22-5-10-5 10\"/><path d=\"M14 18h6\"/><path d=\"m2 2 20 20\"/>",
    "mini-player": "<path d=\"M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4\"/><rect width=\"10\" height=\"7\" x=\"12\" y=\"13\" rx=\"2\"/>",
    "quick-player": "<rect x=\"2.5\" y=\"5\" width=\"19\" height=\"14\" rx=\"3.5\"/><rect x=\"6\" y=\"8.5\" width=\"6.5\" height=\"6.5\" rx=\"1.5\"/><path d=\"M15.5 10h2.5\"/><path d=\"M15.5 13.5h2.5\"/>",
    "app-window": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"M10 4v4\"/><path d=\"M2 8h20\"/><path d=\"M6 4v4\"/>",
    "window-open": "<path d=\"M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6\"/><path d=\"M4 9h6\"/><path d=\"M14 10 21 3\"/><path d=\"M15 3h6v6\"/>",
    "text-both": "<path d=\"M4 6h16\"/><path d=\"M4 10h11\"/><path d=\"M4 15h16\"/><path d=\"M4 19h11\"/>",
    "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/>",
    "heart-pulse": "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/><path d=\"M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\"/>",
    "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/>",
    "funnel": "<path d=\"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z\"/>",
    "star": "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"/>"
};
