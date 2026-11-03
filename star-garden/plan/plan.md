# Star Garden — project notes

For CART 353, I'm making a 2D p5.js simulation where someone creates a star and watches planets grow around it. Mass and Composition sliders affect the star and the material around it. I want some randomness too, so the same settings don't always give the same system.

The idea is still based on real planet formation and gravity, but I don't need to follow every detail exactly. I want it to feel more stylized, with sizes, timing, and interactions adjusted so things are actually interesting to watch. Keep the research as a starting point and note anything that's simplified or exaggerated.

## How I picture it

Set up the star, press Play, and watch the formation. Dust is already moving around the star. There are 3–10 seeds that start off looking like dust, then grow and gain their own colours as they collect material. Planets affect each other's orbits and can merge when they touch.

Once all the dust is gone, the planets become clickable. Clicking one shows its mass as a percentage of Earth's mass, distance from the star, and merger count. I want this part to give someone a moment to look at what formed.

After that, they can choose an object and press a button to bring it into the system. No placing objects manually. The object slowly enters from off-screen towards the system, so there's time to notice it coming. Maybe an asteroid, comet, rogue planet, or passing star. Still need to choose which ones to include.

Then just watch what happens. Planets might change orbits, crash, merge, or get sent away. Not every encounter needs to cause a disaster. The point is to see how the system reacts. No black holes or anything too complicated for now.

## To do

1. Research as needed. The research notes are saved outside the repo. Refer back to them when adding something new, especially the incoming objects and what they can do.

2. Keep the basics working. The project files, star sliders, preview, and Play/Pause/Reset controls are already there.

3. Make formation easier to follow. Growing seeds, shared dust, gravity, and mergers are working. Keep adjusting the pacing and visuals without making it laggy.

4. Make the next stage unlock after the dust is gone. The planet info panel is already there, but clicking planets still needs to be restricted to this stage. The object controls should unlock then too.

5. Add one incoming object first. Give it a selection option and a button, then have it gradually arrive from off-screen. Let the interaction happen without forcing a collision.

6. Add more if there's time. More object choices, better visuals, and smoother controls. Pan/zoom, moons, and more detailed planet types can wait until the main experience feels good.

7. Get it ready to present. Check the GitHub Pages version, organize the sources, and prepare the final presentation. Leave the README alone until I'm ready to update it.
