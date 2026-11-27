# Star Garden — project notes

For CART 353, I'm making a 2D p5.js simulation where someone watches planets grow around a Sun-like star. The star always has the same mass as our Sun, but the planets can turn out differently each run.

The idea is still based on real planet formation and gravity, but I don't need to follow every detail exactly. I want it to feel more stylized, with sizes, timing, and interactions adjusted so things are actually interesting to watch. Keep the research as a starting point and note anything that's simplified or exaggerated.

## How I picture it

Press Play and watch the planets form. Dust is already moving around the star, both on-screen and off-screen. Start with 15–20 seeds across a wide band, with more orbits in the roomier outer area. Neighbouring orbits start at different angles so they don't bunch up right away. They start dust-sized and grow smoothly as material actually touches them. Gravity can change their slightly oval orbits, and they can merge on contact or fall into the star, leaving fewer planets. No breaking apart or separate crash effects yet.

Keep the planets that form from dust colourful, each with its own colour. Colour starts appearing after three dust particles are collected. Give each bit of dust a small boost to visible growth so planets are easier to see before clearing ends. Ease the growth a little more slowly, with the same dust growth cap of half the star's size. Once the dust clears, that's the planet's base size. Draw the Sun and grown planets a little larger, but keep seeds dust-sized at the start. Draw the Sun in front so anything that hits it disappears behind it.

Start every run at the maximum dust setting for the current screen size, capped at 6,750 particles. Dust starts across the screen and beyond its edges because concentrating it on-screen made the simulation laggy. From about 0:30, leftover particles ease out of their orbits in loose outward arcs and keep moving past the edges. Stagger the exits so the last dust can stay visible close to 2:00. Pausing stops the timer too.

Planets are clickable during formation too, even while dust is still around or playback is paused. The panel sits below the playback controls and shows distance in AU and year length as a percentage of Earth's year. 100% means one Earth year. The year length is an estimate from the current orbit and star mass, so it can change after an encounter; an unbound planet shows No closed orbit instead. Leave mass and merger count out. Clicking empty space hides the panel.

Once the timer reaches 2:00 and all the dust is gone, rogue planets start arriving automatically. Comets wait until 30 seconds of active playback after the first rogue enters the screen. Both slide in from just outside a random browser edge. Up to 40 rogues and 5 comets can be active at once, including arrivals still entering. Each type has its own 0.75–1.5 second arrival timer when slots are open. A visitor frees its slot when it leaves the screen, hits the star, or is removed in an encounter. Pause freezes the encounters and arrival timers. Reset starts everything over.

Comets have small red cores and red trails that shrink and fade. Their speeds still vary, but their whole flight is a bit faster. Planetary gravity is exaggerated so their flybys are easier to see. When two regular comets touch, they merge into one that's twice the normal width and starts at twice their average speed at contact. If a big comet hits another comet, big or small, one big comet keeps going with the same size, path, and damage. The other disappears and frees a comet slot.

A regular comet takes one life and a bigger one takes up to two. Take away protection in reverse order: laser defense, the glow, the size boost, the rings, each moon, then the planet itself. A bigger comet can take out a planet with just one moon or no protection. Rogues still go down in one hit. When a comet hits a planet or the star, its core disappears and its trail fades. Destroyed planets fade over 0.8 seconds.

Mergers can add or restore three little grey moons one at a time, then Saturn-style rings, then a 20% size boost. That's as far as mergers go for protection. The size boost eases in and out without changing the planet's mass. Eating a rogue works the same way. Two rogues combine into a single rogue without defenses.

Once a planet gets the size boost, keep it alive for 30 seconds of active playback and it starts to pulse in its own colour every 1.5 seconds. That's the sign that life has begun, and the glow counts as one layer of protection. If a comet takes only the glow, start another 30-second wait. If it also takes the size boost, start the timer again only after the planet earns the boost back. More mergers don't rush the timer.

Keep the glow for another 30 seconds of active playback to earn laser defense. The planet fires slow shots in its own colour at nearby comets or resident planets. Shots travel at about 70 pixels per second when fired and fade out at the end of a 3-second flight. Each planet waits 1.5 seconds between shots. Rogues aren't targeted, but a stray shot still destroys them. A shot destroys a comet or strips one layer from a resident planet. A planet with no protection is destroyed. If the planet loses just its laser defense, it can earn it back after another 30 seconds with the glow.

Rogue planets start with a model mass of 5–30 Earth masses so close encounters can matter. They appear as darker grey disks at 20% of the star's width. Their speeds vary, and their starting paths still favour the inner system, giving them more chances to cross resident orbits. Gravity and encounters decide where they end up. A resident planet absorbs a rogue on contact, even when the rogue looks bigger. When two rogues touch, the more massive one absorbs the other and frees one visitor slot.

Make mergers look like one planet is eating the other. Between residents, the planet with more layers of protection survives. If both have protection and the same number of layers, give each an even chance. If neither has protection, the bigger one wins. The absorbed body slides into the moving survivor and shrinks away over about a second. The survivor gains physical mass at contact but only gets visibly bigger if the merger unlocked the size boost. Mergers between planets of the same type also combine momentum. Eating a rogue keeps the resident's position and velocity at contact. Pause freezes the animation, and Reset clears it.

A merger shouldn't delete the resulting planet just because it gets bigger. If both centres were outside the star, don't let the merger's position adjustment put the survivor inside it. Keep its contact position in that case, while still combining mass and momentum. Actually moving into the star or escaping beyond the browser can still remove it.

Then just watch what happens. Planets might change orbits, crash, merge, or get sent away. Not every encounter needs to cause a disaster. The point is to see how the system reacts. No black holes or anything too complicated for now.

## To do

1. Research as needed. The research notes are saved outside the repo. Refer back to them when adding something new, especially the incoming objects and what they can do.

2. Keep the basics working. Leave just Play, Pause, Reset, and the timer in the controls panel.

3. Make formation easier to follow. Growing seeds, shared dust, gravity, and mergers are working. Keep adjusting the pacing and visuals without making it laggy.

4. Keep encounters tied to dust clearing. Rogues arrive after 2:00 and all dust is gone. Give them 30 seconds on their own before comets arrive. Clicking planets and checking their info stays available during formation too.

5. Try the encounters. Check that the glow and laser defense each take 30 seconds to earn, that comets strip layers in reverse, and that lasers can hit rogues without targeting them.

6. Add more if there's time. More object choices, better visuals, and smoother controls. Pan/zoom and more detailed planet types can wait until the main experience feels good.

7. Get it ready to present. Check the GitHub Pages version, organize the sources, and prepare the final presentation. Leave the README alone until I'm ready to update it.
