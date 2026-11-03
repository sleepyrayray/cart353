# Star Garden — project notes

For CART 353, I'm making a 2D p5.js simulation where someone creates a star and watches planets grow around it. Mass and Composition sliders affect the star and the material around it. I want some randomness too, so the same settings don't always give the same system.

The idea is still based on real planet formation and gravity, but I don't need to follow every detail exactly. I want it to feel more stylized, with sizes, timing, and interactions adjusted so things are actually interesting to watch. Keep the research as a starting point and note anything that's simplified or exaggerated.

## How I picture it

Set up the star, press Play, and watch the formation. Dust is already moving around the star, both on-screen and off-screen. There are 5–12 starting seeds, though mergers or falling into the star can leave fewer planets. They start dust-sized and grow smoothly as material actually touches them. Gravity can change their slightly oval orbits, and visible contact makes them merge. No breaking apart or separate crash effects yet.

Keep planets colourful, with no repeated colours among active bodies and no white, grey, or glowing planets. Colour starts appearing after three dust particles are collected. Sizes follow a stylized mass-based scale, with a cap at half the star's size. The star stays fixed.

Composition gives the system more or less dust. The particle supply is currently 50% higher than before, capped at 6,750. Keep the wider off-screen distribution; concentrating most dust on-screen was too laggy. Leftover particles gradually leave between 1:30 and 3:00 of active playback, rather than just fading away. Gas drag weakens during clearing. Pausing stops the timer too.

Planets are clickable during formation too, even while dust is still around or playback is paused. The panel sits below Your star and shows distance in AU and year length as a percentage of Earth's year. 100% means one Earth year. The year length is an estimate from the current orbit and star mass, so it can change after an encounter; an unbound planet shows No closed orbit instead. Leave mass and merger count out. Clicking empty space hides the panel.

Once all the dust is gone, including off-screen particles, an Add objects panel appears last in the sidebar. The rogue planet starts off-screen and comes towards the system under gravity, with no manual placement or guaranteed collision. No cooldown between clicks, but up to ten active visitors at a time for now, including ones still approaching off-screen. Hide the visitor counter; the button just disables at the limit. A distant, escaping visitor or one falling into the star frees a slot. After merging with a resident, the resulting planet keeps the Rogue planet label and still counts as one visitor. Two visitors merging become one visitor. A captured visitor still counts towards the limit, even off-screen. Pause freezes the encounters too, and Reset starts everything over.

For now, rogue planets start with 5–30 Earth masses so close encounters can matter. That's a design range, not a claim about all real rogue planets. They have varying display sizes based on their starting mass, rather than all looking equally big at the size cap. They use the same gravity and visible-contact mergers as other planets. Their starting paths follow a researched flyby model, then the interactions decide what happens.

Then just watch what happens. Planets might change orbits, crash, merge, or get sent away. Not every encounter needs to cause a disaster. The point is to see how the system reacts. No black holes or anything too complicated for now.

## To do

1. Research as needed. The research notes are saved outside the repo. Refer back to them when adding something new, especially the incoming objects and what they can do.

2. Keep the basics working. The project files, star sliders, preview, and Play/Pause/Reset controls are already there.

3. Make formation easier to follow. Growing seeds, shared dust, gravity, and mergers are working. Keep adjusting the pacing and visuals without making it laggy.

4. Keep the next stage tied to dust clearing. The rogue planet button now unlocks after all dust is gone, including off-screen particles. Clicking planets and checking their info stays available during formation too.

5. Try the first encounter. Rogue planets are in place, with gradual off-screen arrivals and up to ten active visitors. Check the pacing and how easy it is to follow the interactions before adding more object types.

6. Add more if there's time. More object choices, better visuals, and smoother controls. Pan/zoom, moons, and more detailed planet types can wait until the main experience feels good.

7. Get it ready to present. Check the GitHub Pages version, organize the sources, and prepare the final presentation. Leave the README alone until I'm ready to update it.
