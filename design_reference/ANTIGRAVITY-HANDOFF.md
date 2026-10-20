# Dashboard entrance animation

Use dashboard-own-edge-reveal.mp4 as the approved visual reference.
Use dashboard-reveal.css and dashboard-reveal.js as a framework-neutral implementation starting point. Adapt them to the existing application.

## Required movement

- Preserve the current dashboard appearance, dimensions, spacing, widget contents and functionality.
- Keep the top navigation, filters and customization bar stationary.
- Animate the four existing dashboard widgets simultaneously: Tasks Overview, Calendar / Focus Timer, Monthly Goals, Completed Tasks.
- Each widget emerges upward from its OWN final bottom edge, through a fixed clipping viewport matching its final footprint.
- Translate the inner widget surface from translateY(100%) to translateY(0). The percentage refers to the surface's own height. Do not start it at the bottom of the browser viewport.
- The clipping viewport must occupy the final widget space throughout the animation. All content remains clipped to that space during entry, with no layout shifts or overlap into adjacent widgets.
- Start widgets at 150 ms, use 950 ms duration and cubic-bezier(.22, 1, .36, 1). All four start together.
- After the widgets settle, animate the sticky notes upward from their containing widget's bottom edge to their current positions. Use 1180 ms initial delay, 140 ms stagger per note and 800 ms duration with the same easing.
- Keep note rotation on the inner note element. Animate an outer wrapper so rotation and existing hover styles survive.
- Keep the result crisp: no fog, blur, bounce, zoom or added rotation.
- Play once when the dashboard mounts; do not replay when the timer updates, notes change or the component rerenders.
- Respect reduced-motion preferences and clean up animations on unmount.
- Preserve existing responsive behavior. The supplied masks are wrappers, not a new dashboard layout.

## Wrapper structure

```html
<main class="dashboard dashboard-preparing">
  <!-- Repeat this structure for each of the four existing grid cells. -->
  <div class="widget-reveal">
    <section class="widget-surface">
      <!-- Existing widget heading, controls, content and layout stay here. -->

      <!-- Wrap each existing sticky note at its current layout position. -->
      <div class="note-motion">
        <article class="existing-sticky-note">Existing note content</article>
      </div>
    </section>
  </div>
</main>
```

The widget-reveal element owns the final grid sizing and clipping. The widget-surface owns the visible panel background, border, padding, and content. Move those existing visual styles onto the surface; don't leave a visible stationary card behind it. For stretched grid cells, ensure the surface fills the viewport's final height, using the existing layout sizing rules. Don't introduce arbitrary fixed heights.

The note-motion wrapper must preserve the note's existing layout dimensions and position. If the current note is absolutely positioned or a grid/flex child, move its layout-positioning rules onto the wrapper while retaining its visual rotation on the note itself. Limit selectors to the intended widget and note wrappers.

## Plain JavaScript initialization

```html
<link rel="stylesheet" href="./dashboard-reveal.css">
<script type="module">
  import { animateDashboard } from './dashboard-reveal.js';
  await document.fonts.ready;
  animateDashboard(document.querySelector('.dashboard'));
</script>
```

Initialize after the actual dashboard data and dimensions are ready. If using React, initialize from a layout effect on the dashboard root ref and return the cleanup function. Keep the effect dependencies stable so timer ticks and note edits do not replay the entrance. Account for React development Strict Mode's setup/cleanup cycle.

## Verify in the actual application

Check that all four widgets emerge from their own lower edges at the same moment, notes follow afterward, and no frame shows content escaping into neighboring widgets. Confirm the final dashboard exactly matches the original layout. Check mobile layout, reduced motion, drag and drop, timer updates and note controls. Menus that need to escape a clipped widget should use the application's existing portal layer.

The video is a screenshot-based motion sample. The supplied code still needs integration and visual verification inside the actual project.
