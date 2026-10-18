# Star Garden

A 2D p5.js project where you customize a star and watch a planetary system grow around it. The idea is to explore planet formation, gravity, and encounters with other objects in space through a simple interactive simulation.

The current version has a live star preview and two sliders: Mass (0.2–5.0 times the Sun's mass) and Composition (0.3–3.0 times the Sun's heavy-element abundance, represented as dust in the starting material). Mass changes the preview's size, colour, and glow, reaching blue-white at the high end. Composition is saved for future planet formation and doesn't change the preview's appearance.

Small question-mark buttons beside Mass and Composition show explanations on hover or keyboard focus, and on tap on touchscreens. A sentence below the controls describes the current combination of star and starting material, covering five star groups and three composition groups. Both sliders default to 1.0 times the Sun's values.

Open `index.html` in a browser to try it. The appearance and slider ranges are simplified design choices, guided by [NASA's star overview](https://science.nasa.gov/exoplanets/stars/) and [research on heavy elements and planets](https://www.nasa.gov/news-release/small-planets-dont-need-stars-with-heavy-metal-content-to-form/).

The sound library is kept in `js/libraries` but isn't loaded yet.
