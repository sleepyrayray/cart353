# CART 353 Final Project Plan — Star Garden

For my final project, I plan to create **Star Garden**, a 2D simulation where the user customizes a star and watches a planetary system develop around it. Two sliders will control the star's mass and heavy-element abundance, with numerical values and fixed limits. Its size, colour, and brightness will follow from its properties.

When the user presses Play, particles representing gas and dust will move around the young star. Material will gradually gather into clumps and grow into planets. The star's settings and variations in the surrounding material will influence what forms, so the same settings can still produce different systems. Planets will move under simplified gravity, without visible orbit lines.

The user will be able to pan and zoom to observe their system. Later, incoming objects such as asteroids, comets, rogue planets, or a passing star could create new interactions. These might change orbits, cause impacts, or send a planet out of the system. The behaviour will be based on research, with simplified physics and compressed time to keep the experience manageable.

The project will be made with HTML, CSS, JavaScript, and p5.js, with a dark, colourful, glowing visual style. The first version will focus on star customization, particle-based planet formation, orbital movement, and camera controls. Moons and more elaborate encounters can come later. The main goal is to let users discover how their choices and simple rules lead to different systems and unexpected interactions.

## Development Checklist

1. **Research the basic rules.** Gather references for star properties, planet formation, gravity, and encounters. Decide how to simplify these ideas for the simulation and keep track of the sources.

2. **Set up the project.** Create the HTML, CSS, and p5.js files, with a full-screen space canvas and a basic interface.

3. **Build star customization.** Add the mass and heavy-element abundance sliders, numerical values, and a star preview that updates with the settings.

4. **Get orbital movement working.** Start with a few test bodies and make sure gravity produces stable movement. Add Play, Pause, and Reset controls.

5. **Add gradual planet formation.** Introduce gas and dust particles that gather into growing bodies. Connect the formation rules to the star settings and allow different results between runs.

6. **Add camera controls.** Make pan and zoom work smoothly and frame the developing system so it is easy to follow.

7. **Introduce encounters.** Start with one incoming asteroid, then add other researched objects and outcomes as time allows. Make the effects on the system easy to notice.

8. **Polish and test.** Refine the visuals, interface, and pacing. Try different settings, check performance, and fix problems with formation or orbital stability.

9. **Finish and publish.** Deploy through GitHub Pages, update the project documentation and references, and prepare the final presentation.

Moons and more elaborate encounters are extras to explore once the core experience works.
