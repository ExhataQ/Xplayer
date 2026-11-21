// Whether animation is reduced right now. The one answer for every script: the root attribute data-motion ("reduced" or "full"), which
// shell/appearance-boot.js sets before the first paint and shell/appearance.js keeps current (the Reduce animations setting, which starts
// as the system's "reduce motion"). The CSS reads the same attribute; no file asks the system directly any more.

export const reducedMotion = () => typeof document !== 'undefined' && !!document.documentElement && document.documentElement.dataset.motion === 'reduced';
