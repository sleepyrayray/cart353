# Star Garden — project notes

For CART 353, I'm making a 2D p5.js simulation where someone creates a star and watches planets grow around it. Mass and Dust Particles sliders affect the star and the material around it. I want some randomness too, so the same settings don't always give the same system.

The idea is still based on real planet formation and gravity, but I don't need to follow every detail exactly. I want it to feel more stylized, with sizes, timing, and interactions adjusted so things are actually interesting to watch. Keep the research as a starting point and note anything that's simplified or exaggerated.

## How I picture it

Set up the star, press Play, and watch the formation. Dust is already moving around the star, both on-screen and off-screen. Start with 15–20 seeds across a wide band, with more orbits in the roomier outer area. Neighbouring orbits start at different angles so they don't bunch up right away. They start dust-sized and grow smoothly as material actually touches them. Gravity can change their slightly oval orbits, and they can merge on contact or fall into the star, leaving fewer planets. No breaking apart or separate crash effects yet.

Keep planets colourful, with no repeated colours among active bodies and no white, grey, or glowing planets. Colour starts appearing after three dust particles are collected. Sizes follow a stylized mass-based scale, with a cap at half the star's size. The star stays fixed.

The Dust Particles slider gives the system more or less dust. The particle supply is currently 50% higher than before, capped at 6,750. Keep the wider off-screen distribution; concentrating most dust on-screen was too laggy. Leftover particles gradually leave between 1:30 and 3:00 of active playback, rather than just fading away. Gas drag weakens during clearing. Pausing stops the timer too.

Planets are clickable during formation too, even while dust is still around or playback is paused. The panel sits below Your star and shows distance in AU and year length as a percentage of Earth's year. 100% means one Earth year. The year length is an estimate from the current orbit and star mass, so it can change after an encounter; an unbound planet shows No closed orbit instead. Leave mass and merger count out. Clicking empty space hides the panel.

Once all the dust is gone, including off-screen particles, an Add objects panel appears last in the sidebar. Rogue planets start fully hidden, two pixels outside a random browser edge, then slide into view under gravity. Use the current window size, never the panel edges. No manual placement or guaranteed collision. No cooldown between clicks, but up to three rogues on-screen at a time. New arrivals reserve a slot during the short entry. Hide the visitor counter; the button just disables at the limit. Any rogue that leaves frees a slot once its whole body is two pixels beyond the browser edge. Remove it from the simulation at that point, even if its orbit could have brought it back. Falling into the star also frees a slot. After merging with a resident, the resulting planet keeps the Rogue planet label and still counts as one visitor. Two visitors merging become one visitor. A captured visitor only keeps its slot while it remains on-screen. Pause freezes the encounters too, and Reset starts everything over.

For now, rogue planets start with 5–30 Earth masses so close encounters can matter. That's a design range, not a claim about all real rogue planets. They have varying display sizes based on their starting mass, rather than all looking equally big at the size cap. New rogues use 25–50% of the normal capped planet scale, so even the largest starts no bigger than 25% of the star's width. This smaller look doesn't change mass or gravity. They still merge on visible contact. Their starting paths follow a researched flyby model, then the interactions decide what happens.

Make mergers look like the bigger planet is eating the smaller one. The smaller one slides into the moving survivor and shrinks away over about a second, rather than vanishing at contact. This is just an animation: mass and momentum combine once at contact, and the leftover drawing doesn't affect gravity or count as another planet. The survivor keeps smooth growth and the current size cap. Pause freezes the animation, and Reset clears it.

A merger shouldn't delete the resulting planet just because it gets bigger. If both centres were outside the star, don't let the merger's position adjustment put the survivor inside it. Keep its contact position in that case, while still combining mass and momentum. Actually moving into the star or escaping beyond the browser can still remove it.

Then just watch what happens. Planets might change orbits, crash, merge, or get sent away. Not every encounter needs to cause a disaster. The point is to see how the system reacts. No black holes or anything too complicated for now.

## To do

1. Research as needed. The research notes are saved outside the repo. Refer back to them when adding something new, especially the incoming objects and what they can do.

2. Keep the basics working. The project files, star sliders, preview, and Play/Pause/Reset controls are already there.

3. Make formation easier to follow. Growing seeds, shared dust, gravity, and mergers are working. Keep adjusting the pacing and visuals without making it laggy.

4. Keep the next stage tied to dust clearing. The rogue planet button now unlocks after all dust is gone, including off-screen particles. Clicking planets and checking their info stays available during formation too.

5. Try the first encounter. Rogue planets are in place, with short, gradual arrivals from just outside the view and up to three active visitors. Check the pacing and how easy it is to follow the interactions before adding more object types.

6. Add more if there's time. More object choices, better visuals, and smoother controls. Pan/zoom, moons, and more detailed planet types can wait until the main experience feels good.

7. Get it ready to present. Check the GitHub Pages version, organize the sources, and prepare the final presentation. Leave the README alone until I'm ready to update it.
