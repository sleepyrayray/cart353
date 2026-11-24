# Star Garden — project notes

For CART 353, I'm making a 2D p5.js simulation where someone creates a star and watches planets grow around it. Mass and Dust Particles sliders affect the star and the material around it. I want some randomness too, so the same settings don't always give the same system.

The idea is still based on real planet formation and gravity, but I don't need to follow every detail exactly. I want it to feel more stylized, with sizes, timing, and interactions adjusted so things are actually interesting to watch. Keep the research as a starting point and note anything that's simplified or exaggerated.

## How I picture it

Set up the star, press Play, and watch the formation. Dust is already moving around the star, both on-screen and off-screen. Start with 15–20 seeds across a wide band, with more orbits in the roomier outer area. Neighbouring orbits start at different angles so they don't bunch up right away. They start dust-sized and grow smoothly as material actually touches them. Gravity can change their slightly oval orbits, and they can merge on contact or fall into the star, leaving fewer planets. No breaking apart or separate crash effects yet.

Keep the planets that form from dust colourful, each with its own colour. Colour starts appearing after three dust particles are collected. Sizes follow a stylized mass-based scale, with a cap at half the star's size. The star stays fixed.

The Dust Particles slider gives the system more or less dust. The particle supply is currently 50% higher than before, capped at 6,750. Keep the wider off-screen distribution; concentrating most dust on-screen was too laggy. Leftover particles gradually leave between 1:30 and 3:00 of active playback, rather than just fading away. Gas drag weakens during clearing. Pausing stops the timer too.

Planets are clickable during formation too, even while dust is still around or playback is paused. The panel sits below Your star and shows distance in AU and year length as a percentage of Earth's year. 100% means one Earth year. The year length is an estimate from the current orbit and star mass, so it can change after an encounter; an unbound planet shows No closed orbit instead. Leave mass and merger count out. Clicking empty space hides the panel.

Once all the dust is gone, including off-screen particles, rogue planets and comets start arriving automatically. Both slide in from just outside a random browser edge. Up to 10 rogues and 5 comets can be active at once, including arrivals still entering. Each type has its own 0.75–1.5 second arrival timer when slots are open. A visitor frees its slot when it leaves the screen, hits the star, or is removed in an encounter. Pause freezes the encounters and arrival timers. Reset starts everything over.

Comets have small red cores and matching red trails. The trails shrink and fade along the path. Planetary gravity is exaggerated for comets so their flybys are easier to see. Each hit removes one layer of defense. Rings go first, followed by one moon per hit and finally the bare planet. A fully protected resident takes five hits to destroy, and a rogue takes one. The comet's core disappears on impact with a planet or the star, and its trail fades while its slot frees up. Planets destroyed by comets or absorbed by the star fade out over 0.8 seconds.

The surviving resident planet gets one little grey moon on each of its first three mergers, then Saturn-style rings on its fourth. Eating a rogue counts toward that sequence. The sequence follows the surviving resident's merger count, even after comet hits. Further mergers add mass. A merger between two rogues combines the bodies and leaves the survivor without defenses. Moons orbit outside the rings when both are present.

Rogue planets start with a model mass of 5–30 Earth masses so close encounters can matter. They appear as dark grey disks with a width of 25% of the star's. Their starting paths favour the inner system, giving them more chances to cross resident orbits. Gravity and encounters decide where they end up. A resident planet absorbs a rogue on contact, even when the rogue looks bigger. When two rogues touch, the more massive one absorbs the other and frees one visitor slot.

Make mergers look like one planet is eating the other. Between residents, the bigger-looking planet survives. The absorbed body slides into the moving survivor and shrinks away over about a second. The survivor gains mass at contact and grows smoothly up to the size cap. Mergers between planets of the same type also combine momentum. Eating a rogue keeps the resident's position and velocity at contact. Pause freezes the animation, and Reset clears it.

A merger shouldn't delete the resulting planet just because it gets bigger. If both centres were outside the star, don't let the merger's position adjustment put the survivor inside it. Keep its contact position in that case, while still combining mass and momentum. Actually moving into the star or escaping beyond the browser can still remove it.

Then just watch what happens. Planets might change orbits, crash, merge, or get sent away. Not every encounter needs to cause a disaster. The point is to see how the system reacts. No black holes or anything too complicated for now.

## To do

1. Research as needed. The research notes are saved outside the repo. Refer back to them when adding something new, especially the incoming objects and what they can do.

2. Keep the basics working. The project files, star sliders, preview, and Play/Pause/Reset controls are already there.

3. Make formation easier to follow. Growing seeds, shared dust, gravity, and mergers are working. Keep adjusting the pacing and visuals without making it laggy.

4. Keep encounters tied to dust clearing. Automatic arrivals begin after all dust is gone, including off-screen particles. Clicking planets and checking their info stays available during formation too.

5. Try both encounters. Check how often residents gain defenses from mergers and how easy it is to follow the order that comet impacts remove them.

6. Add more if there's time. More object choices, better visuals, and smoother controls. Pan/zoom and more detailed planet types can wait until the main experience feels good.

7. Get it ready to present. Check the GitHub Pages version, organize the sources, and prepare the final presentation. Leave the README alone until I'm ready to update it.
