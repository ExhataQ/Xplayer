// ==============================================================================
// GLOBAL TOOLTIP SYSTEM
// ==============================================================================
let tooltip = null;
let tooltipTimeout = null;

function temporarilySuppressTooltip(element, duration = 200) {
    if (!element) return;

    if (tooltip) {
        tooltip.style.opacity = '0';
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }

    element.classList.add('tooltip-suppressed');

    if (element._tooltipSuppressTimeout) {
        clearTimeout(element._tooltipSuppressTimeout);
    }

    element._tooltipSuppressTimeout = setTimeout(() => {
        if (element) {
            element.classList.remove('tooltip-suppressed');
            element._tooltipSuppressTimeout = null;
        }
    }, duration);
}

function createTooltipElement() {
    const el = document.createElement('div');
    el.className = 'custom-tooltip';
    return el;
}

function positionTooltip(target) {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + rect.width / 2;
    let top = rect.top - 6;

    if (left - tooltipRect.width / 2 < 6) {
        left = tooltipRect.width / 2 + 6;
    }

    if (left + tooltipRect.width / 2 > window.innerWidth - 6) {
        left = window.innerWidth - tooltipRect.width / 2 - 6;
    }

    if (top - tooltipRect.height < 6) {
        top = rect.bottom + 6;
        tooltip.style.transform = 'translate(-50%, 0)';
    } else {
        tooltip.style.transform = 'translate(-50%, -100%)';
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

document.addEventListener('mouseover', function (e) {
    const target = e.target.closest('[title], [data-original-title]');
    if (!target) return;

    if (document.body.classList.contains('suppress-tooltips')) return;

    if (target.classList && target.classList.contains('tooltip-suppressed')) return;

    if (target.disabled || target.style.opacity === '0.5') {
        target.removeAttribute('title');
        target.removeAttribute('data-original-title');
        return;
    }

    const titleText = target.getAttribute('title') || target.getAttribute('data-original-title');
    if (!titleText) return;

    if (!tooltip) {
        tooltip = createTooltipElement();
        document.body.appendChild(tooltip);
    }

    clearTimeout(tooltipTimeout);
    tooltip.style.opacity = '0';

    tooltipTimeout = setTimeout(() => {
        tooltip.textContent = titleText;

        if (target.hasAttribute('title')) {
            target.setAttribute('data-original-title', titleText);
            target.removeAttribute('title');
        }

        positionTooltip(target);
        tooltip.style.opacity = '1';
    }, 300);

    target.addEventListener(
        'mouseleave',
        function hideTooltip() {
            clearTimeout(tooltipTimeout);
            if (tooltip) {
                tooltip.style.opacity = '0';
            }
            target.removeEventListener('mouseleave', hideTooltip);
        },
        {
            once: true
        }
    );
});

document.addEventListener('click', function () {
    if (tooltip && !tooltip.classList.contains('progress-tooltip')) {
        tooltip.style.opacity = '0';
    }
});
