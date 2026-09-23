// ==============================================================================
// EXTERNAL SCROLLBAR FUNCTIONALITY
// ==============================================================================

function updateScrollbarById(contentId) {
    setTimeout(() => {
        if (!window.scrollbarInstances) return;
        const scrollbarInstance = window.scrollbarInstances.find((instance) => instance.content?.id === contentId);
        if (scrollbarInstance?.updateScrollbar) {
            scrollbarInstance.updateScrollbar();
        }
    }, 50);
}

window.addEventListener('beforeunload', function () {
    if (window.scrollbarInstances) {
        window.scrollbarInstances.forEach((instance) => {
            if (instance.content) {
                instance.content.removeEventListener('scroll', instance.scheduleScrollbarUpdate);
                instance.content.removeEventListener('mouseenter', instance.handleMouseEnter);
                instance.content.removeEventListener('mouseleave', instance.handleMouseLeave);
                window.removeEventListener('resize', instance.updateScrollbar);
            }
        });
    }
});

let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener(
    'mousemove',
    (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    },
    { passive: true, capture: true }
);

function initExternalScrollbar(contentId, scrollbarId, thumbId) {
    const content = document.getElementById(contentId);
    const externalScrollbar = document.getElementById(scrollbarId);
    const scrollbarThumb = document.getElementById(thumbId);

    if (!content || !externalScrollbar || !scrollbarThumb) return;

    let scrollbarUpdateRAF = null;
    function scheduleScrollbarUpdate() {
        if (scrollbarUpdateRAF) return;
        scrollbarUpdateRAF = requestAnimationFrame(() => {
            scrollbarUpdateRAF = null;
            updateScrollbar();
        });
    }

    function updateScrollbar() {
        const contentHeight = content.scrollHeight;
        const visibleHeight = content.clientHeight;

        if (contentHeight <= visibleHeight) {
            scrollbarThumb.style.height = '0px';
            scrollbarThumb.style.display = 'none';
            return;
        }

        scrollbarThumb.style.display = 'block';
        const scrollRatio = visibleHeight / contentHeight;

        const topOffset = contentId === 'main-content' ? 52 : 0;
        const bottomGap = 6;
        const trackHeight = externalScrollbar.clientHeight - topOffset - bottomGap;
        const maxThumbHeight = Math.max(30, trackHeight * 0.98);
        const rawThumbHeight = scrollRatio * visibleHeight;
        const thumbHeight = Math.min(maxThumbHeight, Math.max(30, rawThumbHeight));
        scrollbarThumb.style.height = thumbHeight + 'px';

        const scrollTop = content.scrollTop;
        const maxScrollTop = contentHeight - visibleHeight;
        const scrollPercent = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
        const maxThumbTop = trackHeight - thumbHeight;
        scrollbarThumb.style.top = topOffset + scrollPercent * maxThumbTop + 'px';
    }

    if (contentId === 'main-content') {
        updateExternalScrollbar = updateScrollbar;
    }

    content.addEventListener('scroll', scheduleScrollbarUpdate);

    window.addEventListener('resize', updateScrollbar);

    updateScrollbar();

    if (content.scrollHeight > content.clientHeight) {
        externalScrollbar.classList.add('visible');
    }

    const checkMouseOver = () => {
        const rect = content.getBoundingClientRect();
        if (
            lastMouseX >= rect.left &&
            lastMouseX <= rect.right &&
            lastMouseY >= rect.top &&
            lastMouseY <= rect.bottom &&
            content.scrollHeight > content.clientHeight
        ) {
            externalScrollbar.classList.add('visible');
        }
    };
    setTimeout(checkMouseOver, 200);
    setTimeout(checkMouseOver, 500);
    setTimeout(checkMouseOver, 800);

    let hideTimeout = null;
    let isDragging = false;
    let isDraggingTrack = false;

    function showScrollbar() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        if (content.scrollHeight > content.clientHeight) {
            externalScrollbar.classList.add('visible');
        }
    }

    function hideScrollbarAfterDelay() {
        if (isDragging) return;
        if (isDraggingTrack) return;
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        hideTimeout = setTimeout(() => {
            externalScrollbar.classList.remove('visible');
            hideTimeout = null;
        }, 750);
    }

    function handleMouseEnter() {
        showScrollbar();
    }

    function handleMouseLeave() {
        hideScrollbarAfterDelay();
    }

    content.addEventListener('mouseenter', handleMouseEnter);
    content.addEventListener('mouseleave', handleMouseLeave);

    scrollbarThumb.addEventListener('mouseenter', showScrollbar);
    scrollbarThumb.addEventListener('mouseleave', hideScrollbarAfterDelay);

    externalScrollbar.addEventListener('mouseenter', showScrollbar);
    externalScrollbar.addEventListener('mouseleave', hideScrollbarAfterDelay);

    if (!window.scrollbarInstances) {
        window.scrollbarInstances = [];
    }
    window.scrollbarInstances.push({
        content: content,
        updateScrollbar: updateScrollbar,
        scheduleScrollbarUpdate: scheduleScrollbarUpdate,
        handleMouseEnter: handleMouseEnter,
        handleMouseLeave: handleMouseLeave
    });

    scrollbarThumb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        showScrollbar();
        isDragging = true;
        document.body.classList.add('no-select');
        document.body.classList.add('dragging-scrollbar');
        document.body.classList.add('scrollbar-holding');
        if (contentId === 'left-panel-main-content') {
            document.body.classList.add('dragging-left-scrollbar');
        }
        scrollbarThumb.classList.add('dragging');
        externalScrollbar.classList.add('visible');

        const startY = e.clientY;
        // parseFloat, not parseInt: truncating the thumb's fractional top makes the list
        // jump by several rows the moment the thumb is grabbed on a big list.
        const startTop = parseFloat(scrollbarThumb.style.top) || 0;
        const contentHeight = content.scrollHeight;
        const visibleHeight = content.clientHeight;
        const thumbHeight = parseInt(scrollbarThumb.style.height) || 30;
        const topOffset = contentId === 'main-content' ? 52 : 0;
        const bottomGap = 6;
        const trackHeight = externalScrollbar.clientHeight - topOffset - bottomGap;
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const maxScrollTop = contentHeight - visibleHeight;

        let lastThumbY = e.clientY;

        function onMouseMove(e) {
            const deltaY = e.clientY - startY;
            let newTop = startTop + deltaY;
            newTop = Math.max(topOffset, Math.min(topOffset + maxThumbTop, newTop));
            const scrollPercent = maxScrollTop > 0 ? (newTop - topOffset) / maxThumbTop : 0;
            content.scrollTop = scrollPercent * maxScrollTop;
            scrollbarThumb.style.top = newTop + 'px';

            if (typeof syncPlaceholdersForJump === 'function') {
                syncPlaceholdersForJump(content);
            }
            if (Math.abs(e.clientY - lastThumbY) > 2) {
                lastThumbY = e.clientY;
                if (typeof scheduleThumbHoldSettle === 'function') {
                    scheduleThumbHoldSettle(content);
                }
            }
        }

        function onMouseUp(e) {
            isDragging = false;
            document.body.classList.remove('no-select');
            document.body.classList.remove('dragging-scrollbar');
            document.body.classList.remove('scrollbar-holding');
            document.body.classList.remove('dragging-left-scrollbar');
            scrollbarThumb.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (typeof hideHoverHighlight === 'function') {
                hideHoverHighlight();
                hoveredSongIndex = -1;
            }

            if (typeof settleVirtualScrollAfterThumbRelease === 'function') {
                settleVirtualScrollAfterThumbRelease(content);
            }

            const mouseX = e.clientX;
            const mouseY = e.clientY;
            const rect = content.getBoundingClientRect();
            if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
                externalScrollbar.classList.add('visible');
            } else {
                hideScrollbarAfterDelay();
            }
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    let trackHoldTarget = null;
    let stepAnimationId = null;
    let isFirstStep = true;
    isDraggingTrack = false;

    externalScrollbar.addEventListener('mousedown', (e) => {
        if (e.target === scrollbarThumb) return;

        e.preventDefault();
        e.stopPropagation();
        isDraggingTrack = true;
        document.body.classList.add('no-select');
        document.body.style.userSelect = 'none';
        externalScrollbar.classList.add('visible');

        const rect = externalScrollbar.getBoundingClientRect();
        const thumbHeight = parseInt(scrollbarThumb.style.height) || 30;
        const topOffset = contentId === 'main-content' ? 52 : 0;
        const bottomGap = 6;
        const trackHeight = externalScrollbar.clientHeight - topOffset - bottomGap;
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const maxScrollTop = content.scrollHeight - content.clientHeight;
        const visibleHeight = content.clientHeight;

        function updateTarget(clientY) {
            const clickY = clientY - rect.top;
            let newTop = clickY - thumbHeight / 2;
            newTop = Math.max(topOffset, Math.min(topOffset + maxThumbTop, newTop));
            const scrollPercent = maxThumbTop > 0 ? (newTop - topOffset) / maxThumbTop : 0;
            trackHoldTarget = scrollPercent * maxScrollTop;
        }

        updateTarget(e.clientY);
        isFirstStep = true;

        function doStep() {
            if (trackHoldTarget === null) return;

            const direction = Math.sign(trackHoldTarget - content.scrollTop);
            const remaining = Math.abs(trackHoldTarget - content.scrollTop);
            const firstJumpDistance = Math.min(visibleHeight * 1.4, remaining * 0.3);
            const stepDistance = isFirstStep ? firstJumpDistance : visibleHeight * 1.4;
            const duration = isFirstStep ? 200 : 50;
            const delay = isFirstStep ? 200 : 0;

            const targetStep = content.scrollTop + direction * stepDistance;

            const finalTarget =
                Math.abs(trackHoldTarget - content.scrollTop) < stepDistance ? trackHoldTarget : targetStep;

            const startScrollTop = content.scrollTop;
            const distance = finalTarget - startScrollTop;
            const startTime = performance.now();

            function animateStep(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                content.scrollTop = startScrollTop + distance * eased;

                if (progress < 1) {
                    stepAnimationId = requestAnimationFrame(animateStep);
                } else if (trackHoldTarget !== null && Math.abs(trackHoldTarget - content.scrollTop) > 1) {
                    if (isFirstStep) {
                        isFirstStep = false;
                        setTimeout(() => doStep(), delay);
                    } else {
                        doStep();
                    }
                }
            }

            stepAnimationId = requestAnimationFrame(animateStep);
        }

        doStep();

        const onMouseMove = (e) => updateTarget(e.clientY);
        const onMouseUp = () => {
            trackHoldTarget = null;
            if (stepAnimationId) cancelAnimationFrame(stepAnimationId);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}
