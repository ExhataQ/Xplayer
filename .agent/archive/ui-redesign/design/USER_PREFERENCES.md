# Xplayer — UI Design Preferences

**Status:** Brainstorm / working preferences  
**Goal:** Create a cohesive, minimalist, modern interface with a consistent visual language across the entire application.

These ideas are initial preferences, not strict specifications. Use design judgment to improve them, identify problems, and suggest better alternatives where appropriate.

## 1. Tooltips

Tooltips should provide useful information without cluttering the interface.

**Content**
- Name of the element or action.
- Current state, when relevant.
- A short explanation of its purpose.
- Associated keyboard shortcut, when available.

**Appearance**
- White or near-white text with medium weight.
- Keyboard shortcuts displayed in a dimmer color.
- Comfortable spacing between the description and shortcut.
- Consider rounded corners, a subtle border, and a background that fits the theme.

**Behavior**
- Appear after a reasonable hover delay.
- Disappear immediately when the pointer leaves.
- Use no animation or a barely noticeable one.
- For toggle buttons, show the updated state after interaction. If a tooltip disappears after clicking, allow it to appear again on the next hover.

Choose the behavior that best suits each element rather than forcing every tooltip to behave identically.

## 2. Left Sidebar and Navigation

Consider dividing the left side into two coordinated areas.

**A. Fixed navigation area**

A narrow, fixed-width strip containing the main destinations, with a clear active indicator.

Potential destinations:
- Home
- Library
- Search
- History and recently played
- Settings
- Metadata editor
- Lyrics and synchronization tools

Some destinations may be combined if that produces a simpler information architecture. For example, Search might belong within Library rather than being a separate destination.

**B. Contextual panel**

A wider panel that opens beside the navigation strip and can expand over the main content area, potentially reaching the right-side panel.

Each contextual section should have two layouts:
- **Compact:** Essential information and common actions.
- **Expanded:** Additional controls, tools, and details.

The two layouts should share the same visual language and preserve the user's context when switching modes.

Detailed behavior for individual sections can be specified in separate documents later.

## 3. Lyrics and Lyrics Tools

When a song has no lyrics, show a small, informative empty state with clear actions.

Possible actions:
- Find lyrics online.
- Open the lyrics editor or synchronization tool.
- Search for lyrics or LRC files manually.

Manual search should offer relevant results and let the user choose what to use.

The lyrics panel should distinguish between viewing lyrics, finding lyrics, writing lyrics, and synchronizing LRC timestamps. Reuse existing application functionality where possible rather than duplicating it.

## 4. Layout and View Relationships

Treat each meaningful interface area as a **view**, whether it is a full page, panel, dialog, or small component.

Use three relationships:
- **Parent and child:** One view contains another.
- **Sibling:** Two views sit beside one another.
- **Standalone:** A view exists independently, such as a dialog or notification.

Use a consistent separation system:
- Sibling views may use spacing or subtle borders without requiring different background colors.
- Parent and child views should feel connected. Use borders or restrained background differences when they clarify hierarchy, but avoid unnecessary gaps.
- Standalone views should have clear boundaries and appropriate visual emphasis.

Establish a small set of reusable layout, spacing, border, radius, and background rules. Choose the treatment that makes relationships clear and the overall interface attractive without excessive decoration.

## 5. Logo and Startup View

**Logo**
- Minimalist and medium-sized.
- Consistent with the application's primary theme color.
- Clear and recognizable at different sizes.

**Startup/loading view**
- A visually appealing background with restrained, continuous animation.
- A simple application logo and animated loading indicator.
- A lightweight preview or placeholder while the application initializes.
- Close, minimize, and maximize controls, plus an appropriate application menu.

Keep startup animation inexpensive and unobtrusive. The interface should transition cleanly into the application when loading finishes.

A future welcome screen may guide users through initial preferences and setup.

## 6. Icon System

Use a coherent icon family rather than mixing unrelated styles.

Icons should have consistent:
- Stroke weight and visual complexity.
- Size and alignment.
- Spacing and padding.
- Hover, active, disabled, and selected states.
- Animation behavior.

Prefer a maintained, free icon library with a license compatible with the project. Custom AI-generated icons can be considered for distinctive branding, but should not replace a consistent system for everyday interface controls.

## 7. Notifications

Use two notification types.

**A. Transient popups**
- For short messages, confirmations, minor errors, and completed actions.
- Clear, compact, and easy to dismiss or allowed to disappear automatically when appropriate.

**B. Persistent or ongoing status**
- For downloads, library scanning, extraction, and other operations that take time.
- Use a dedicated status area or top-bar indicator.
- Show progress, current state, and relevant actions when useful.
- Remain visible while the operation needs attention, then transition to an appropriate completed or dismissed state.

Avoid making every notification equally prominent.

## 8. Song List

Keep the song list minimal, readable, and adaptable to resizing.

**Configurable columns**
- Allow users to show or hide supported columns.
- Allow individual columns to be resized.
- Keep resizing predictable and preserve useful widths when possible.

**Compact mode**
- Provide a simpler, denser list with reduced row height.
- Remove cover thumbnails and rearrange the remaining information to use space efficiently.

Preserve existing playback interactions, selection behavior, context menus, and performance. Column customization should make the list more useful without making it complicated to configure.

## 9. Settings and Dialogs

Settings should be divided into clearly named sections, each representing a coherent concept.

Use a uniform design for:
- Section headings and descriptions.
- Controls and their labels.
- Spacing and alignment.
- Focus, hover, disabled, and selected states.
- Dialog layouts, buttons, and close behavior.

Dialogs should feel related to one another while allowing their layouts to reflect their specific purposes.

## 10. Overall Design Principle

Create a reusable design system for the entire application rather than styling every view independently.

Define consistent rules for:
- Colors and theme variants.
- Typography and hierarchy.
- Spacing and alignment.
- Borders, backgrounds, and corner radii.
- Icons and interaction states.
- Motion and transitions.
- Panels, dialogs, tooltips, and notifications.

The result should feel cohesive, polished, and easy to understand. Prefer clarity over decoration, useful functionality over visual novelty, and consistency over unnecessary complexity.

These preferences are a starting point. Improve them where justified, explain important trade-offs, and seek approval before making major design decisions or changing application behavior.