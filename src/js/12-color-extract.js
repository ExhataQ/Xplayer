// ==============================================================================
// DOMINANT COLOR EXTRACTION
// ==============================================================================

const _colorExtractCache = new Map();
let _colorExtractCanvas = null;
let _colorExtractCtx = null;

function _getColorExtractCanvas() {
    if (_colorExtractCanvas)
        return {
            canvas: _colorExtractCanvas,
            ctx: _colorExtractCtx
        };
    _colorExtractCanvas = document.createElement('canvas');
    _colorExtractCanvas.width = 32;
    _colorExtractCanvas.height = 32;
    _colorExtractCtx = _colorExtractCanvas.getContext('2d', {
        willReadFrequently: true
    });
    return {
        canvas: _colorExtractCanvas,
        ctx: _colorExtractCtx
    };
}

function _rgbToHex(r, g, b) {
    const h = (n) => n.toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
}

function _rgbToCss(r, g, b) {
    return `rgb(${r}, ${g}, ${b})`;
}

function _lightenHex(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.round(r + (255 - r) * amount));
    g = Math.min(255, Math.round(g + (255 - g) * amount));
    b = Math.min(255, Math.round(b + (255 - b) * amount));
    return _rgbToHex(r, g, b);
}

function _luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function _isNearBlack(r, g, b) {
    return _luminance(r, g, b) < 25;
}

function _isNearWhite(r, g, b) {
    return r > 250 && g > 250 && b > 250;
}

function _saturation(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0) return 0;
    return (max - min) / max;
}

function _isBackish(r, g, b) {
    if (_luminance(r, g, b) < 40) return true;
    return _saturation(r, g, b) < 0.1;
}

function _colorDistance(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Extract the dominant non-trivial color from an image URL.
// Returns { rgb: "r, g, b", hex: "#rrggbb", hoverHex, isFallback } or null on failure.
async function extractDominantColor(imageUrl) {
    if (!imageUrl) return null;
    if (_colorExtractCache.has(imageUrl)) return _colorExtractCache.get(imageUrl);

    const result = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const { ctx } = _getColorExtractCanvas();
                ctx.clearRect(0, 0, 32, 32);
                ctx.drawImage(img, 0, 0, 32, 32);
                const data = ctx.getImageData(0, 0, 32, 32).data;

                const buckets = new Map();
                let total = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
                    if (a < 200) continue;
                    if (_isNearBlack(r, g, b)) continue;
                    if (_isNearWhite(r, g, b)) continue;

                    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
                    let entry = buckets.get(key);
                    if (!entry) {
                        entry = {
                            count: 0,
                            r: 0,
                            g: 0,
                            b: 0,
                            peakScore: -1,
                            peakR: r,
                            peakG: g,
                            peakB: b
                        };
                        buckets.set(key, entry);
                    }
                    entry.count++;
                    entry.r += r;
                    entry.g += g;
                    entry.b += b;

                    const sat = _saturation(r, g, b);
                    const lum = _luminance(r, g, b) / 255;
                    const peakScore = sat * (0.4 + lum * 0.6);
                    if (peakScore > entry.peakScore) {
                        entry.peakScore = peakScore;
                        entry.peakR = r;
                        entry.peakG = g;
                        entry.peakB = b;
                    }
                    total++;
                }

                if (total === 0 || buckets.size === 0) {
                    resolve(null);
                    return;
                }

                const rawFamilies = [];
                for (const entry of buckets.values()) {
                    rawFamilies.push({
                        count: entry.count,
                        buckets: 1,
                        r: entry.r / entry.count,
                        g: entry.g / entry.count,
                        b: entry.b / entry.count,
                        peakR: entry.peakR,
                        peakG: entry.peakG,
                        peakB: entry.peakB,
                        peakScore: entry.peakScore
                    });
                }
                rawFamilies.sort((a, b) => b.count - a.count);

                const MERGE_DISTANCE = 40;
                const families = [];
                for (const fam of rawFamilies) {
                    let merged = false;
                    for (const existing of families) {
                        if (_colorDistance(fam.r, fam.g, fam.b, existing.r, existing.g, existing.b) < MERGE_DISTANCE) {
                            const totalCount = existing.count + fam.count;
                            existing.r = (existing.r * existing.count + fam.r * fam.count) / totalCount;
                            existing.g = (existing.g * existing.count + fam.g * fam.count) / totalCount;
                            existing.b = (existing.b * existing.count + fam.b * fam.count) / totalCount;
                            existing.count = totalCount;
                            existing.buckets += fam.buckets;
                            if (fam.peakScore > existing.peakScore) {
                                existing.peakScore = fam.peakScore;
                                existing.peakR = fam.peakR;
                                existing.peakG = fam.peakG;
                                existing.peakB = fam.peakB;
                            }
                            merged = true;
                            break;
                        }
                    }
                    if (!merged) {
                        families.push({
                            count: fam.count,
                            buckets: fam.buckets,
                            r: fam.r,
                            g: fam.g,
                            b: fam.b,
                            peakR: fam.peakR,
                            peakG: fam.peakG,
                            peakB: fam.peakB,
                            peakScore: fam.peakScore
                        });
                    }
                }

                for (const fam of families) {
                    const lum = _luminance(fam.peakR, fam.peakG, fam.peakB) / 255;
                    const sat = _saturation(fam.peakR, fam.peakG, fam.peakB);
                    const sizeScore = fam.count * Math.pow(fam.buckets, 0.7);
                    const lightScore = 0.15 + Math.pow(lum, 1.6);
                    const satScore = 0.5 + sat * 0.5;
                    fam.score = sizeScore * lightScore * satScore;
                }
                families.sort((a, b) => b.score - a.score);

                const topN = families.slice(0, 8);
                let chosen = null;
                let bestScore = -1;
                for (const fam of topN) {
                    if (_isBackish(fam.peakR, fam.peakG, fam.peakB)) continue;
                    const lum = _luminance(fam.peakR, fam.peakG, fam.peakB) / 255;
                    const sat = _saturation(fam.peakR, fam.peakG, fam.peakB);
                    const pickScore = sat * (0.3 + lum * 0.7);
                    if (pickScore > bestScore) {
                        bestScore = pickScore;
                        chosen = fam;
                    }
                }
                if (!chosen) {
                    for (const fam of families) {
                        if (!_isBackish(fam.peakR, fam.peakG, fam.peakB)) {
                            chosen = fam;
                            break;
                        }
                    }
                }
                if (!chosen && families.length > 0) {
                    chosen = families[0];
                }
                if (!chosen) {
                    resolve(null);
                    return;
                }

                let r = chosen.peakR;
                let g = chosen.peakG;
                let b = chosen.peakB;

                const SAT_BOOST = 1.2;
                const maxC = Math.max(r, g, b);
                const minC = Math.min(r, g, b);
                const mid = (maxC + minC) / 2;

                r = mid + (r - mid) * SAT_BOOST;
                g = mid + (g - mid) * SAT_BOOST;
                b = mid + (b - mid) * SAT_BOOST;

                const LIFT_TOWARD_WHITE = 0.3;
                r = r + (255 - r) * LIFT_TOWARD_WHITE;
                g = g + (255 - g) * LIFT_TOWARD_WHITE;
                b = b + (255 - b) * LIFT_TOWARD_WHITE;

                r = Math.max(0, Math.min(255, Math.round(r)));
                g = Math.max(0, Math.min(255, Math.round(g)));
                b = Math.max(0, Math.min(255, Math.round(b)));

                const hex = _rgbToHex(r, g, b);
                const lum = _luminance(r, g, b) / 255;

                let darkBias = Math.max(0, Math.min(1, 1 - lum));
                darkBias = Math.pow(darkBias, 1.6) * 0.55;

                resolve({
                    rgb: `${r}, ${g}, ${b}`,
                    hex: hex,
                    hoverHex: _lightenHex(hex, 0.18),
                    lum: lum,
                    darkBias: darkBias
                });
            } catch (e) {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = imageUrl;
    });

    _colorExtractCache.set(imageUrl, result);
    return result;
}

// Apply the extracted color to the body as the active view accent.
// Pass null to revert to the color that the current view class would use.
async function applyViewColorFromCover(imageUrl) {
    const body = document.body;
    const fallback = () => {
        body.style.removeProperty('--view-accent');
        body.style.removeProperty('--view-accent-hover');
        body.style.removeProperty('--view-accent-rgb');
        body.style.removeProperty('--view-accent-lum');
        body.style.removeProperty('--view-accent-dark-bias');
    };

    if (!imageUrl) {
        fallback();
        return;
    }

    const color = await extractDominantColor(imageUrl);
    if (!color) {
        fallback();
        return;
    }

    body.style.setProperty('--view-accent', color.hex);
    body.style.setProperty('--view-accent-hover', color.hoverHex);
    body.style.setProperty('--view-accent-rgb', color.rgb);
    body.style.setProperty('--view-accent-lum', String(color.lum));
    body.style.setProperty('--view-accent-dark-bias', String(color.darkBias));
}
