// Tooltip rollout (task A-08): every control in the new shell gets the shared tooltip, including the ones the engine builds.
//
// The engine labels its controls with `title` (and, after ui/06e, `data-original-title`) and shows them with its own
// tooltip (ui/06d, unstyled, no state or shortcut). In the new shell that system must never show, and the browser's
// native one must not either. So this file:
//   1. takes the engine's text off those attributes and keeps it in `data-tip`, the moment it appears or changes;
//   2. shows `data-tip` (and `data-tip-state`, `data-tip-description`, `data-tip-shortcut`) with the shared tooltip.
// Views may set the `data-tip*` attributes themselves. Controls built with attachTooltip() or iconButton() keep their own
// tooltip; they are skipped here. Nothing in the engine is changed.

import { delegateTooltips, hasTooltip } from '../components/index.js';

// A title such as "Stamp current time (F1)" carries its shortcut; the tooltip shows it in the shortcut slot.
const SHORTCUT_IN_TEXT = /^(.+?)\s+\(((?:Ctrl|Alt|Shift|Cmd)\+[^\s()]+|F\d{1,2}|Esc|Enter|Space)\)$/;

const text = (value, node) => (typeof value === 'function' ? value(node) : value) || '';

// Controls whose engine markup has no title, or that need more than a name. `name`, `state`, `description` are a string or a
// function of the element. `stayOnPress`: the tooltip stays open on a click and shows the new state (toggles).
const RULES = [
    { selector: '.favorite-btn', stayOnPress: true },
    { selector: '.add-to-queue-btn', description: 'Plays right after the current song' },
    // The engine rewrites this button's aria-label when it becomes current ("pink theme active"), so the name comes from data-theme.
    { selector: '.settings-theme-btn', name: (node) => (node.dataset.theme ? `${node.dataset.theme[0].toUpperCase()}${node.dataset.theme.slice(1)} theme` : node.getAttribute('aria-label')), state: (node) => (node.classList.contains('active') ? 'Current' : '') },
    { selector: '.left-panel-cover-play-btn', name: (node) => node.getAttribute('aria-label') }
];
const RULE_SELECTOR = RULES.map((rule) => rule.selector).join(', ');
const OWNER_SELECTOR = `[data-tip], ${RULE_SELECTOR}`;
const TITLED = '[title], [data-original-title]';

/**
 * Moves the engine's text from `title` and `data-original-title` into `data-tip`. A control that has no accessible name
 * keeps one (a title was its only name). Controls with their own tooltip just lose the attributes.
 */
function claim(node) {
    const label = node.getAttribute('data-original-title') || node.getAttribute('title') || '';
    node.removeAttribute('title');
    node.removeAttribute('data-original-title');
    if (hasTooltip(node)) return;
    if (!label) return node.removeAttribute('data-tip');
    node.setAttribute('data-tip', label);
    if (!node.hasAttribute('aria-label') && !node.hasAttribute('aria-labelledby') && !node.textContent.trim()) node.setAttribute('aria-label', label);
}

function contentOf(node, rule) {
    let name = text(rule && rule.name, node) || node.getAttribute('data-tip') || '';
    let shortcut = node.getAttribute('data-tip-shortcut') || '';
    const split = SHORTCUT_IN_TEXT.exec(name);
    if (split) {
        name = split[1];
        shortcut = shortcut || split[2];
    }
    return {
        name,
        state: text(rule && rule.state, node) || node.getAttribute('data-tip-state') || '',
        description: text(rule && rule.description, node) || node.getAttribute('data-tip-description') || '',
        shortcut
    };
}

function resolve(node) {
    // Before the engine's own mouseover handler can see the title (pointer events come first).
    const titled = node.closest(TITLED);
    if (titled) claim(titled);
    const target = node.closest(OWNER_SELECTOR);
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return null;
    const rule = RULES.find((candidate) => target.matches(candidate.selector));
    if (!contentOf(target, rule).name) return null;
    return { target, read: () => contentOf(target, rule), stayOnPress: Boolean(rule && rule.stayOnPress) || target.hasAttribute('aria-pressed') };
}

/** Starts the rollout for the whole page. Returns a function that stops it (for tests). */
export function installTooltips(root = document) {
    for (const node of root.querySelectorAll(TITLED)) claim(node);

    // The engine rewrites titles as state changes (favorite, mute, play). An element that has no title any more is one this
    // file just took it from (claim() removes it too), so only elements that still have one are claimed; an empty title clears the tip.
    const watcher = new MutationObserver((records) => {
        for (const node of new Set(records.map((record) => record.target))) {
            if (node.hasAttribute('title') || node.hasAttribute('data-original-title')) claim(node);
        }
    });
    watcher.observe(root.documentElement || root, { subtree: true, attributes: true, attributeFilter: ['title', 'data-original-title'] });

    const stop = delegateTooltips(root, resolve);
    return () => {
        watcher.disconnect();
        stop();
    };
}
