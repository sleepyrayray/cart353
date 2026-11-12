const starSettings = {
  mass: 1,
  heavyElements: 1,
};

const MAX_DUST_COUNT = 6750;
const DUST_FADE_SECONDS = 1.2;
// Shared display scale for the star and seeds, not a change to their masses.
const BODY_VISUAL_SCALE = 1.5;
const SEED_STARTING_MATERIAL = 4;
const SEED_DUST_RADIUS = 1.1;
// Display radius for one Earth mass, before the shared visual scale.
// Deliberately enlarged for readability, not to scale with the star or distances.
const PLANET_EARTH_MASS_RADIUS = 7.5;
const SEED_GROWTH_SECONDS = 2;
const SEED_MAX_STAR_RATIO = 0.5;
const SEED_COLOUR_THRESHOLD = 3;
// Keep the size transition independent from the earlier colour milestone.
const SEED_EMERGENCE_MATERIAL = 7;
const MIN_SEEDS = 15;
const MAX_SEEDS = 20;
const MAX_VISITORS = 3;
const SEED_INNER_ORBIT_FACTOR = 1.15;
const SEED_OUTER_ORBIT_FACTOR = 5.2;
// Stagger adjacent orbits around the star instead of lining them up at reset.
const SEED_PHASE_STEP = Math.PI * (3 - Math.sqrt(5));
// Mild ovalness for variety, not a measured distribution of young planets.
const SEED_MIN_ECCENTRICITY = 0.03;
const SEED_MAX_ECCENTRICITY = 0.18;
// Saturated planet colours only, assigned without replacement in each system.
const planetColours = [
  [75, 154, 235], // blue
  [237, 133, 57], // orange
  [86, 182, 102], // green
  [164, 101, 220], // purple
  [226, 83, 93], // red
  [46, 190, 165], // teal
  [235, 188, 49], // gold
  [224, 100, 171], // pink
  [163, 194, 52], // lime
  [193, 108, 51], // copper
  [103, 102, 222], // indigo
  [40, 188, 224], // cyan
  [203, 58, 126], // raspberry
  [39, 150, 92], // jade
  [97, 189, 237], // sky blue
  [116, 68, 188], // violet
  [218, 209, 57], // lemon
  [215, 105, 65], // terracotta
  [73, 219, 193], // aqua
  [174, 54, 80], // cranberry
];
// Compressed disk evolution for the experience, not real astronomical timescales.
const DISK_CLEARING_START_SECONDS = 90;
const DISK_CLEARING_DURATION_SECONDS = 90;
const LAST_DUST_DEPARTURE_SECONDS = 160;

let dustParticles = [];
let seeds = [];
let selectedSeed = null;
let roguePlanets = [];
let diskAgeSeconds = 0;
let dustRevealTime = 0;
let isPlaying = false;
let timeAccumulator = 0;
let lastFrameTime = 0;

// Approximate colours for our chosen mass range, not a stellar evolution model.
const starColours = [
  { mass: 0.2, rgb: [255, 121, 91] },
  { mass: 0.5, rgb: [255, 180, 112] },
  { mass: 1, rgb: [255, 239, 210] },
  { mass: 1.5, rgb: [255, 249, 240] },
  { mass: 3, rgb: [218, 231, 255] },
  { mass: 5, rgb: [185, 213, 255] },
];

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("space");
  canvas.elt.addEventListener("click", selectPlanet);
  pixelDensity(min(displayDensity(), 2));
  noLoop();

  document.getElementById("mass").addEventListener("input", updateStarSettings);
  document.getElementById("heavy-elements").addEventListener("input", updateStarSettings);
  document.getElementById("play").addEventListener("click", playOrbit);
  document.getElementById("pause").addEventListener("click", pauseOrbit);
  document.getElementById("reset").addEventListener("click", resetOrbit);
  document.getElementById("add-rogue").addEventListener("click", addRoguePlanet);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isPlaying) pauseOrbit();
  });
  updateStarSettings();
}

function updateStarSettings() {
  const previousMass = starSettings.mass;
  const previousComposition = starSettings.heavyElements;
  starSettings.mass = Number(document.getElementById("mass").value);
  starSettings.heavyElements = Number(document.getElementById("heavy-elements").value);

  document.getElementById("mass-value").textContent = `${starSettings.mass.toFixed(1)}× Sun`;
  const dustLevel = starSettings.heavyElements < 0.8 ? "Low"
    : starSettings.heavyElements > 1.2 ? "High" : "Medium";
  document.getElementById("heavy-elements-value").textContent = dustLevel;
  document.getElementById("heavy-elements").setAttribute("aria-valuetext", dustLevel);

  const description = getStarDescription(starSettings.mass, starSettings.heavyElements);
  document.getElementById("star-description").textContent = description;
  describe(`${description} Mass is ${starSettings.mass.toFixed(1)} times the Sun's. Dust Particles is set to ${dustLevel.toLowerCase()}. Each reset creates between ${MIN_SEEDS} and ${MAX_SEEDS} seeds with orbit sizes spread across a wide band and slightly oval, differently oriented paths. Some paths can cross, but collisions are not forced. Press Play to reveal the finite dust supply and seeds, which initially look like the other particles. Each seed gently attracts nearby dust and grows by collecting dust that touches it. Their pull on dust strengthens with growth but is capped. Seeds gravitationally affect each other's orbits using masses based on collected material, while the star stays fixed. Seeds merge when their visible edges touch, combining mass and momentum with smooth, capped visual growth. From one minute thirty seconds, remaining dust departs outward at varied times, leaving the screen by three minutes as gas drag weakens. Dust can also escape or fade near the star. Reset starts fresh. Visible sizes, dust attraction, clearing motion, and time are exaggerated.`);

  // Both settings define the starting system; don't spawn extra dust mid-run.
  if (!seeds.length || starSettings.mass !== previousMass || starSettings.heavyElements !== previousComposition) resetOrbit();
  else redraw();
}

function updatePlaybackControls(status) {
  document.getElementById("play").disabled = isPlaying;
  document.getElementById("pause").disabled = !isPlaying;
  document.getElementById("orbit-status").textContent = status;
}

function playOrbit() {
  if (isPlaying) return;
  isPlaying = true;
  lastFrameTime = performance.now();
  updatePlaybackControls("Running");
  loop();
}

function pauseOrbit() {
  isPlaying = false;
  noLoop();
  updatePlaybackControls("Paused");
  redraw();
}

function resetOrbit() {
  isPlaying = false;
  noLoop();
  selectedSeed = null;
  roguePlanets = [];
  updatePlanetInfo();
  const view = getSpaceView();
  // Generate the complete material supply once. Nothing replenishes it mid-run.
  dustParticles = createDustCloud(view);
  diskAgeSeconds = 0;
  updateElapsedTime();
  const startingPhase = random(TWO_PI);
  const seedCount = Math.floor(random(MIN_SEEDS, MAX_SEEDS + 1));
  const availableColours = [...planetColours];
  seeds = Array.from({ length: seedCount }, (_, index) => {
    // Give each starting orbit a similar share of the band area, so the more
    // spacious outer part gets more planets than the crowded inner part.
    const fraction = index / (seedCount - 1);
    const innerSquared = view.innerSeedOrbit ** 2;
    const outerSquared = view.outerSeedOrbit ** 2;
    const semiMajorAxis = Math.sqrt(innerSquared + fraction * (outerSquared - innerSquared));
    const phase = startingPhase + index * SEED_PHASE_STEP;
    const eccentricity = random(SEED_MIN_ECCENTRICITY, SEED_MAX_ECCENTRICITY);
    const orientation = random(TWO_PI);
    const anomaly = phase - orientation;
    const semiLatusRectum = semiMajorAxis * (1 - eccentricity ** 2);
    const distance = semiLatusRectum / (1 + eccentricity * Math.cos(anomaly));
    // Keplerian initial state, then let mutual gravity evolve it freely.
    // https://orbital-mechanics.space/classical-orbital-elements/perifocal-frame.html
    const speedScale = Math.sqrt(GRAVITY * starSettings.mass / semiLatusRectum);
    const radialSpeed = speedScale * eccentricity * Math.sin(anomaly);
    const tangentialSpeed = speedScale * (1 + eccentricity * Math.cos(anomaly));
    return {
      position: { x: Math.cos(phase) * distance, y: Math.sin(phase) * distance },
      velocity: {
        x: Math.cos(phase) * radialSpeed - Math.sin(phase) * tangentialSpeed,
        y: Math.sin(phase) * radialSpeed + Math.cos(phase) * tangentialSpeed,
      },
      material: SEED_STARTING_MATERIAL,
      visibleMaterial: SEED_STARTING_MATERIAL,
      opacity: random(0.45, 0.65),
      planetColour: availableColours.splice(Math.floor(random(availableColours.length)), 1)[0],
      colourProgress: 0,
      collected: 0,
      mergers: 0,
      active: true,
    };
  });
  dustRevealTime = 0;
  timeAccumulator = 0;
  updatePlaybackControls("Ready");
  redraw();
}

function addRoguePlanet() {
  // Guard the action as well as the button, including off-screen dust and paused time.
  if (diskAgeSeconds <= 0 || dustParticles.length > 0 || roguePlanets.length >= MAX_VISITORS) return;
  const view = getSpaceView();
  const angle = random(TWO_PI);
  const radial = { x: Math.cos(angle), y: Math.sin(angle) };
  // Pick any direction around the star so arrivals can come from all screen edges.
  // Start the entire body beyond the screen, with space for a gradual entrance.
  const entryMargin = view.radius * SEED_MAX_STAR_RATIO + 40;
  const horizontalEdge = Math.abs(radial.x) > 0.000001
    ? ((radial.x > 0 ? width - view.x : view.x) + entryMargin) / Math.abs(radial.x) : Infinity;
  const verticalEdge = Math.abs(radial.y) > 0.000001
    ? ((radial.y > 0 ? height - view.y : view.y) + entryMargin) / Math.abs(radial.y) : Infinity;
  const edgeDistance = Math.min(horizontalEdge, verticalEdge) / view.pixelsPerAU;
  const residents = seeds.filter(seed => seed.active);
  const systemRadius = Math.max(view.outerSeedOrbit,
    ...residents.filter(seed => !roguePlanets.includes(seed))
      .map(seed => Math.hypot(seed.position.x, seed.position.y)));
  const approachRadius = Math.max(edgeDistance, systemRadius * 1.5);
  // Unbound Keplerian approach: choose an encounter distance, NOT a target planet.
  // v² = v_infinity² + 2μ/r; h = q sqrt(v_infinity² + 2μ/q).
  // https://orbital-mechanics.space/the-orbit-equation/hyperbolic-trajectories.html
  const mu = GRAVITY * starSettings.mass;
  const closestApproach = random(0.5, 1.15) * systemRadius;
  const excessSpeed = random(0.3, 0.7) * Math.sqrt(mu / systemRadius);
  const angularMomentum = closestApproach * Math.sqrt(excessSpeed ** 2 + 2 * mu / closestApproach);
  const tangentialSpeed = (random() < 0.5 ? -1 : 1) * angularMomentum / approachRadius;
  const inwardSpeed = -Math.sqrt(Math.max(0,
    excessSpeed ** 2 + 2 * mu / approachRadius - tangentialSpeed ** 2));
  // A stylized 5–30 Earth-mass visitor, not a measured rogue-planet distribution.
  // Keep the same material-to-mass rule and visible-size cap as resident planets.
  const material = random(5, 30) / EARTH_MASSES_PER_MATERIAL_UNIT;
  // Extra palette slots cover all residents and visitors. A merged visitor
  // may leave its colour behind, so choose a currently unused colour each time.
  const visitorColour = [
    [244, 92, 45], [185, 74, 212], [62, 207, 127], [244, 145, 30],
    [235, 65, 140], [125, 210, 45], [35, 155, 132], [72, 109, 225],
    [214, 69, 210], [240, 201, 69], ...planetColours,
  ].find(rgb =>
    !residents.some(seed => seed.planetColour.every((channel, index) => channel === rgb[index])));
  const roguePlanet = {
    position: { x: radial.x * approachRadius, y: radial.y * approachRadius },
    velocity: {
      x: radial.x * inwardSpeed - radial.y * tangentialSpeed,
      y: radial.y * inwardSpeed + radial.x * tangentialSpeed,
    },
    material,
    visibleMaterial: material,
    // Compress the visitor mass range into visible variety instead of every body
    // hitting the same cap. This is a stylized display scale, not a density model.
    visualSizeScale: 0.45 + 0.55 * (material * EARTH_MASSES_PER_MATERIAL_UNIT - 5) / 25,
    opacity: 1,
    planetColour: visitorColour,
    colourProgress: 1,
    mature: true,
    collected: 0,
    mergers: 0,
    active: true,
    hasEnteredView: false,
    escapeRadius: approachRadius * 1.25,
  };
  roguePlanets.push(roguePlanet);
  seeds = [...residents, roguePlanet];
  updateEncounter();
  if (!isPlaying) redraw();
}

function updateEncounter() {
  const view = getSpaceView();
  for (const body of roguePlanets) {
    const x = view.x + body.position.x * view.pixelsPerAU;
    const y = view.y + body.position.y * view.pixelsPerAU;
    const radius = getSeedRadius(body, view.radius);
    const outside = x + radius < 0 || x - radius > width || y + radius < 0 || y - radius > height;
    if (!outside) body.hasEnteredView = true;
    const movingOutward = body.position.x * body.velocity.x + body.position.y * body.velocity.y > 0;
    // Remove only a distant, outbound, unbound visitor. Off-screen bound bodies
    // remain simulated and occupy a visitor slot; never steer or teleport them.
    if (body.active && outside && movingOutward
      && Math.hypot(body.position.x, body.position.y) > body.escapeRadius
      && getOrbitalPeriod(body, starSettings.mass) === null) {
      body.active = false;
    }
  }
  roguePlanets = roguePlanets.filter(body => body.active);
  const locked = diskAgeSeconds <= 0 || dustParticles.length > 0;
  document.getElementById("encounter-panel").hidden = locked;
  document.getElementById("add-rogue").disabled = locked || roguePlanets.length >= MAX_VISITORS;
}

function advanceOrbit(frameSeconds) {
  // Fixed physics steps keep the orbits independent of drawing speed.
  // Cap long stalls instead of making the dust leap forward after them.
  timeAccumulator += Math.min(frameSeconds, 0.25) * YEARS_PER_SECOND;
  const view = getSpaceView();
  const surfaceRadius = view.radius / view.pixelsPerAU;
  const heatRadius = getDustHeatRadius(view);
  while (timeAccumulator + 1e-12 >= PHYSICS_STEP) {
    diskAgeSeconds += PHYSICS_STEP / YEARS_PER_SECOND;
    const clearing = Math.max(0, Math.min(1,
      (diskAgeSeconds - DISK_CLEARING_START_SECONDS) / DISK_CLEARING_DURATION_SECONDS));
    const gasAmount = 1 - smoothProgress(clearing);
    // Real mass-scaled mutual gravity, separate from the exaggerated dust pull.
    // The star remains fixed; visible contact merges seeds, with no seed gas drag.
    stepSeeds(seeds, starSettings.mass, PHYSICS_STEP, surfaceRadius,
      () => mergeTouchingSeeds(view));
    const attractors = seeds.filter(seed => seed.active).map(seed => ({
      position: seed.position,
      materialRatio: seed.visibleMaterial / SEED_STARTING_MATERIAL,
    }));
    for (const particle of dustParticles) {
      if (particle.remaining <= 0) continue;
      if (diskAgeSeconds >= particle.departureAt) {
        moveDepartingDust(particle, view);
        if (particle.remaining > 0) collectDust(particle, view.pixelsPerAU, view.radius);
        continue;
      }
      if (!stepOrbitingBody(particle, starSettings.mass, PHYSICS_STEP, surfaceRadius, true, attractors, gasAmount)) {
        particle.remaining = 0;
        continue;
      }
      const distance = Math.hypot(particle.position.x, particle.position.y);
      const heat = Math.max(0, 1 - distance / heatRadius);
      particle.remaining = Math.max(0, particle.remaining - heat * PHYSICS_STEP / YEARS_PER_SECOND / 0.6);
      if (particle.remaining > 0) collectDust(particle, view.pixelsPerAU, view.radius);
    }
    // Ease toward collected material instead of jumping in size on each contact.
    // Only runs while playing, and never grows beyond material already collected.
    const growthBlend = -Math.expm1(-PHYSICS_STEP / YEARS_PER_SECOND / SEED_GROWTH_SECONDS);
    // Colour is a visual milestone, not a scientific planet-formation threshold.
    const colourBlend = -Math.expm1(-PHYSICS_STEP / YEARS_PER_SECOND / 2);
    for (const seed of seeds) {
      seed.visibleMaterial += (seed.material - seed.visibleMaterial) * growthBlend;
      const colourTarget = seed.mature || seed.collected >= SEED_COLOUR_THRESHOLD ? 1 : 0;
      seed.colourProgress += (colourTarget - seed.colourProgress) * colourBlend;
    }
    timeAccumulator = Math.max(0, timeAccumulator - PHYSICS_STEP);
  }
  dustParticles = dustParticles.filter(particle => particle.remaining > 0);
  updateElapsedTime();
}

function updateElapsedTime() {
  // Use the same active-playback clock as clearing; paused time is excluded.
  const seconds = Math.floor(diskAgeSeconds);
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const timer = document.getElementById("elapsed-time");
  if (timer.textContent !== elapsed) timer.textContent = elapsed;
}

function selectPlanet(event) {
  // Listen only on the canvas so using the controls never changes selection.
  const bounds = event.currentTarget.getBoundingClientRect();
  const clickX = (event.clientX - bounds.left) * width / bounds.width;
  const clickY = (event.clientY - bounds.top) * height / bounds.height;
  const view = getSpaceView();
  selectedSeed = null;
  let closest = Infinity;
  // Any revealed planet can be selected, including during formation or while paused.
  // Allow a small click margin for tiny seeds; don't select invisible ones before Play.
  if (dustRevealTime > 0) {
    for (const seed of seeds) {
      if (!seed.active) continue;
      const x = view.x + seed.position.x * view.pixelsPerAU;
      const y = view.y + seed.position.y * view.pixelsPerAU;
      const distance = Math.hypot(clickX - x, clickY - y);
      if (distance <= Math.max(8, getSeedRadius(seed, view.radius)) && distance < closest) {
        selectedSeed = seed;
        closest = distance;
      }
    }
  }
  updatePlanetInfo();
  if (!isPlaying) redraw();
}

function updatePlanetInfo() {
  if (selectedSeed && !selectedSeed.active) selectedSeed = null;
  const panel = document.getElementById("planet-info");
  panel.hidden = !selectedSeed;
  if (!selectedSeed) return;
  const seed = selectedSeed;
  const distance = Math.hypot(seed.position.x, seed.position.y);
  const period = getOrbitalPeriod(seed, starSettings.mass);
  const values = {
    "planet-distance": `${distance.toFixed(2)} AU`,
    "planet-year": period === null ? "No closed orbit" : `${Math.round(period * 100)}% of Earth’s`,
  };
  for (const [id, value] of Object.entries(values)) {
    const field = document.getElementById(id);
    if (field.textContent !== value) field.textContent = value;
  }
}

function smoothProgress(amount) {
  const progress = Math.max(0, Math.min(1, amount));
  return progress * progress * (3 - 2 * progress);
}

function moveDepartingDust(particle, view) {
  // A timed, wind-inspired clearing animation, not a computed radiation force.
  // Normal gravity and gas drag govern dust until its individual departure begins.
  const farthestCorner = Math.hypot(Math.max(view.x, width - view.x), Math.max(view.y, height - view.y));
  const exitDistance = (farthestCorner + 80) / view.pixelsPerAU;
  if (!particle.departure) {
    const { x, y } = particle.position;
    const radius = Math.max(0.000001, Math.hypot(x, y));
    particle.departure = {
      radius,
      angle: Math.atan2(y, x),
      angularSpeed: (x * particle.velocity.y - y * particle.velocity.x) / radius ** 2 * YEARS_PER_SECOND,
      exitDistance: Math.max(radius + 1, exitDistance),
    };
  }
  const path = particle.departure;
  // Account for a larger window without adding dust or leaving dust visible at 3:00.
  path.exitDistance = Math.max(path.exitDistance, exitDistance);
  const elapsed = Math.max(0, diskAgeSeconds - particle.departureAt);
  const progress = Math.min(1, elapsed / particle.departureDuration);
  const radius = path.radius + (path.exitDistance - path.radius) * smoothProgress(progress);
  // Retain its orbit direction at first, then gradually unwind into outward travel.
  const angle = path.angle + path.angularSpeed * elapsed * (1 - progress / 2);
  particle.position.x = Math.cos(angle) * radius;
  particle.position.y = Math.sin(angle) * radius;
  // Removal happens beyond every screen edge, never as an on-screen clearing fade.
  if (progress >= 1) particle.remaining = 0;
}

function getDustHeatRadius(view) {
  // A deliberately simplified heat zone, not a calculated sublimation temperature.
  // Brighter, higher-mass stars clear dust farther out. Gas is not rendered.
  return Math.max(view.radius / view.pixelsPerAU * 2, 0.12 * starSettings.mass ** 1.75);
}

function getSeedRadius(seed, starRadius) {
  // Shared mass-to-size mapping, with a compressed display scale for large visitors.
  // Cube-root scaling is a simple common-density assumption, not a composition model.
  // Ease the material first so dust collection and mergers never snap the size.
  const visibleEarthMasses = seed.visibleMaterial * EARTH_MASSES_PER_MATERIAL_UNIT;
  const massRadius = PLANET_EARTH_MASS_RADIUS * Math.cbrt(visibleEarthMasses) * BODY_VISUAL_SCALE;
  // Start the same size as a dust dot, then smoothly reveal the mass-based scale
  // over the first seven full material bundles. No extra growth just from waiting.
  const acquired = Math.max(0, seed.visibleMaterial - SEED_STARTING_MATERIAL);
  const emergence = smoothProgress(acquired / SEED_EMERGENCE_MATERIAL);
  const grownRadius = SEED_DUST_RADIUS + (massRadius - SEED_DUST_RADIUS) * emergence;
  return Math.min(grownRadius, starRadius * SEED_MAX_STAR_RATIO) * (seed.visualSizeScale ?? 1);
}

function mergeTouchingSeeds(view) {
  // Contact uses the drawn edges, not the larger dust-attraction reach.
  // Restart after a merge: the new centre of mass might touch a third body.
  let merged;
  do {
    merged = false;
    for (let i = 0; i < seeds.length && !merged; i++) {
      if (!seeds[i].active) continue;
      for (let j = i + 1; j < seeds.length; j++) {
        if (!seeds[j].active) continue;
        const first = seeds[i];
        const second = seeds[j];
        const firstRadius = getSeedRadius(first, view.radius);
        const secondRadius = getSeedRadius(second, view.radius);
        const contactDistance = (firstRadius + secondRadius) / view.pixelsPerAU;
        if (Math.hypot(first.position.x - second.position.x,
          first.position.y - second.position.y) > contactDistance) continue;
        // Preserve the larger visible body so its radius never snaps down on contact.
        const survivor = firstRadius >= secondRadius ? first : second;
        const absorbed = survivor === first ? second : first;
        mergeSeedBodies(survivor, absorbed);
        // Count all merger events in the resulting planet's history.
        survivor.mergers += absorbed.mergers + 1;
        const mergingVisitors = roguePlanets.filter(body => body === first || body === second);
        if (mergingVisitors.length > 0) {
          // Keep the rogue identity even when the resident is the surviving object.
          // Two visitors merging occupy one slot; a visitor + resident still occupy one.
          survivor.mature = true;
          survivor.hasEnteredView = mergingVisitors.some(body => body.hasEnteredView);
          survivor.escapeRadius = Math.max(...mergingVisitors.map(body => body.escapeRadius));
          roguePlanets = roguePlanets.filter(body => body !== first && body !== second);
          roguePlanets.push(survivor);
        }
        if (selectedSeed === absorbed) selectedSeed = survivor;
        if (Math.hypot(survivor.position.x, survivor.position.y)
          <= view.radius / view.pixelsPerAU) survivor.active = false;
        merged = true;
        break;
      }
    }
  } while (merged);
}

function collectDust(particle, pixelsPerAU, starRadius) {
  // Contact uses exactly the radii drawn on screen, converted to world units.
  // Each dot is one material bundle; heat loss reduces what it can contribute.
  // If contacts overlap, choose the closest seed instead of favouring array order.
  let collector = null;
  let closest = Infinity;
  for (const seed of seeds) {
    if (!seed.active) continue;
    const collectionRadius = (getSeedRadius(seed, starRadius) + particle.size) / pixelsPerAU;
    const dx = particle.position.x - seed.position.x;
    const dy = particle.position.y - seed.position.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared <= collectionRadius ** 2 && distanceSquared < closest) {
      collector = seed;
      closest = distanceSquared;
    }
  }
  if (!collector) return;
  // Heat loss reduces the material contributed; outward clearing does not fade it.
  collector.material += particle.remaining;
  collector.collected++;
  particle.remaining = 0;
  // This first growth test transfers material without changing the seed's velocity.
}

function getSpaceView() {
  const panel = document.querySelector(".controls").getBoundingClientRect();
  const header = document.querySelector(".intro").getBoundingClientRect();
  const compact = width <= 640;
  const left = compact ? 0 : panel.right;
  const top = compact ? header.bottom : 0;
  const bottom = compact ? panel.top : height;
  const availableSpace = Math.max(0, Math.min(width - left, bottom - top));
  const amount = (starSettings.mass - 0.2) / 4.8;
  const basePixelsPerAU = Math.max(12, Math.min(112, availableSpace * 0.144));
  const baseRadius = Math.min(100, availableSpace * 0.16) * (0.3 + 0.7 * amount ** 0.6) / 2.5 * BODY_VISUAL_SCALE;
  const heatRadius = Math.max(baseRadius / basePixelsPerAU * 2, 0.12 * starSettings.mass ** 1.75);
  const seedOrbitBase = Math.max(1.3, heatRadius * 1.25 + 0.15);
  // Keep the original camera scale across star masses. Widen the starting orbits
  // within that view so the extra space isn't lost to a matching zoom-out.
  const maxMass = starColours[starColours.length - 1].mass;
  const maxBaseRadius = Math.min(100, availableSpace * 0.16) / 2.5 * BODY_VISUAL_SCALE;
  const maxHeatRadius = Math.max(maxBaseRadius / basePixelsPerAU * 2, 0.12 * maxMass ** 1.75);
  const maxSeedOrbitBase = Math.max(1.3, maxHeatRadius * 1.25 + 0.15);
  const cameraReferenceOrbit = maxSeedOrbitBase * 2
    * (1 + SEED_MAX_ECCENTRICITY) * 1.04;
  const pixelsPerAU = Math.max(1, Math.min(basePixelsPerAU, availableSpace * 0.4 / cameraReferenceOrbit));
  const radius = baseRadius * pixelsPerAU / basePixelsPerAU;
  // Use the free area up to the edge, reserving room for the oval's farthest
  // point and a fully grown planet. Keep a usable band in very small views.
  const visibleOrbitLimit = (availableSpace * 0.5 - radius * SEED_MAX_STAR_RATIO - 4)
    / (pixelsPerAU * (1 + SEED_MAX_ECCENTRICITY));
  const outerSeedOrbit = Math.min(seedOrbitBase * SEED_OUTER_ORBIT_FACTOR,
    Math.max(seedOrbitBase * 2, visibleOrbitLimit));
  return {
    x: (left + width) / 2,
    y: (top + bottom) / 2,
    pixelsPerAU,
    radius,
    innerSeedOrbit: seedOrbitBase * SEED_INNER_ORBIT_FACTOR,
    outerSeedOrbit,
  };
}

function createDustParticle(position) {
  const distance = Math.hypot(position.x, position.y);
  const angle = Math.atan2(position.y, position.x);
  const circularSpeed = Math.sqrt(GRAVITY * starSettings.mass / distance);
  // A rotating disk should mostly share a direction, even before it settles.
  // These population fractions are design choices, not measured disk statistics.
  const passingChance = 0.025 + 0.015 * (1 - Math.exp(-distance / 5));
  const population = random();
  const passing = population < passingChance;
  const counterclockwise = !passing && population < passingChance + 0.005 && distance > 1;
  const unsettled = !passing && !counterclockwise && random() < 0.5;
  let direction = angle + HALF_PI + random(-0.08, 0.08);
  let speed = circularSpeed * random(0.97, 1.03);
  let dragCoupling = random(1, 3);
  let size = random(0.7, 1.5);
  if (passing) {
    // Fast, weakly coupled material can leave instead of being forced into orbit.
    // A small flyby population has varied directions, not an outward-only bias.
    direction = random(TWO_PI);
    speed = circularSpeed * random(1.5, 1.8);
    dragCoupling = random(0.05, 0.25);
    size = random(1.1, 1.5);
  } else if (counterclockwise) {
    // Rare fine grains respond quickly enough to gas to have a chance to turn.
    // They can still lose angular momentum and fall inward; survival is not forced.
    direction = angle - HALF_PI + random(-0.2, 0.2);
    speed = circularSpeed * random(0.7, 0.95);
    dragCoupling = random(25, 50);
    size = random(0.7, 0.9);
  }
  let velocity = { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed };
  if (unsettled) {
    // A positive clockwise component and modest radial motion keep initial energy
    // below escape energy, without sending most grains straight toward the star.
    // These begin on mildly eccentric bound paths; drag can gradually settle them.
    const tangentialSpeed = circularSpeed * random(0.94, 1.04);
    const radialSpeed = circularSpeed * random(-0.2, 0.2);
    velocity = {
      x: -Math.sin(angle) * tangentialSpeed + Math.cos(angle) * radialSpeed,
      y: Math.cos(angle) * tangentialSpeed + Math.sin(angle) * radialSpeed,
    };
    dragCoupling = random(3, 8);
  }
  // Initial conditions only: gravity and gas drag determine subsequent motion.
  const departureAt = random(DISK_CLEARING_START_SECONDS, LAST_DUST_DEPARTURE_SECONDS);
  const clearingEnd = DISK_CLEARING_START_SECONDS + DISK_CLEARING_DURATION_SECONDS;
  return {
    position,
    velocity,
    size,
    dragCoupling,
    opacity: random(0.25, 0.75),
    remaining: 1,
    departureAt,
    // Leave enough flight time for a gradual exit, with every path finished by 3:00.
    departureDuration: random(15, Math.min(35, clearingEnd - departureAt)),
    departure: null,
  };
}

function createDustCloud(view) {
  const padding = Math.max(width, height) * 0.5;
  const bounds = {
    left: (-padding - view.x) / view.pixelsPerAU,
    right: (width + padding - view.x) / view.pixelsPerAU,
    top: (-padding - view.y) / view.pixelsPerAU,
    bottom: (height + padding - view.y) / view.pixelsPerAU,
  };
  const dustDensity = view.pixelsPerAU ** 2 / 1300;
  // Add a baseline supply so low Composition still gives seeds material to find.
  // Higher Composition adds more dust, without changing dot size or seed growth.
  // This is a visual mapping of solid abundance, not a calibrated disk mass.
  const referenceCount = Math.min(1000,
    (bounds.right - bounds.left) * (bounds.bottom - bounds.top) * dustDensity);
  // 50% more particles at every composition; each bundle still contributes the same mass.
  const count = Math.min(MAX_DUST_COUNT,
    Math.round(referenceCount * (1.5 + starSettings.heavyElements) * 1.5));
  const particles = [];
  for (let i = 0; i < count; i++) {
    const position = { x: random(bounds.left, bounds.right), y: random(bounds.top, bounds.bottom) };
    // No solid dust starts inside the exaggerated stellar surface.
    if (Math.hypot(position.x, position.y) <= view.radius / view.pixelsPerAU) continue;
    particles.push(createDustParticle(position));
  }
  return particles;
}

// Five mass groups and three composition groups cover all 15 descriptions.
// These boundaries are for the interface, not exact scientific cutoffs.
function getStarDescription(mass, composition) {
  let star = "A very hot, bright blue-white star";
  if (mass < 0.45) star = "A small, cool red star";
  else if (mass < 0.8) star = "A softly glowing orange star";
  else if (mass < 1.2) star = "A Sun-like star";
  else if (mass < 3) star = "A hot, bright white star";

  let mixture = "a familiar mix of gas and dust";
  if (composition < 0.8) mixture = "a mixture with relatively little dust";
  else if (composition > 1.2) mixture = "a mixture with relatively more dust";
  else if (mass >= 0.8 && mass < 1.2) {
    return "A star like our Sun, born from a familiar mix of gas and dust.";
  }

  return `${star} born from ${mixture}.`;
}

function getStarColour(mass) {
  for (let i = 1; i < starColours.length; i++) {
    const lower = starColours[i - 1];
    const upper = starColours[i];
    if (mass <= upper.mass) {
      const amount = (mass - lower.mass) / (upper.mass - lower.mass);
      return lower.rgb.map((channel, index) => round(lerp(channel, upper.rgb[index], amount)));
    }
  }
  return starColours[starColours.length - 1].rgb;
}

function draw() {
  if (isPlaying) {
    const now = performance.now();
    const frameSeconds = Math.min((now - lastFrameTime) / 1000, 0.25);
    advanceOrbit(frameSeconds);
    dustRevealTime = Math.min(DUST_FADE_SECONDS, dustRevealTime + frameSeconds);
    lastFrameTime = now;
  }
  updateEncounter();
  updatePlanetInfo();
  background("#0b0d16");

  // Keep the star clear of the controls, while dust fills the whole canvas.
  const { x, y, radius, pixelsPerAU } = getSpaceView();

  const amount = (starSettings.mass - 0.2) / 4.8;
  if (radius <= 0) return;

  const rgb = getStarColour(starSettings.mass);
  const brightness = lerp(0.18, 0.65, amount);
  const context = drawingContext;

  // A soft halo makes higher-mass stars look brighter without adding shaders.
  const glow = context.createRadialGradient(x, y, radius * 0.5, x, y, radius * 3);
  glow.addColorStop(0, `rgba(${rgb.join(",")}, ${brightness})`);
  glow.addColorStop(0.4, `rgba(${rgb.join(",")}, ${brightness * 0.3})`);
  glow.addColorStop(1, `rgba(${rgb.join(",")}, 0)`);
  context.fillStyle = glow;
  context.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6);

  const surface = context.createRadialGradient(x, y, 0, x, y, radius);
  const core = rgb.map(channel => round(lerp(channel, 255, 0.55)));
  surface.addColorStop(0, `rgb(${core.join(",")})`);
  surface.addColorStop(1, `rgb(${rgb.join(",")})`);
  context.fillStyle = surface;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();

  // Fade reveals material that is already moving, rather than spawning it.
  // Resizing only changes the view, not the dust's physical coordinates.
  const fadeProgress = dustRevealTime / DUST_FADE_SECONDS;
  const dustOpacity = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
  if (dustOpacity === 0) return;
  for (const particle of dustParticles) {
    const particleX = x + particle.position.x * pixelsPerAU;
    const particleY = y + particle.position.y * pixelsPerAU;
    if (particleX < -2 || particleX > width + 2 || particleY < -2 || particleY > height + 2) continue;
    if (Math.hypot(particleX - x, particleY - y) <= radius + particle.size) continue;
    context.fillStyle = `rgba(218, 204, 181, ${particle.opacity * dustOpacity * particle.remaining})`;
    context.beginPath();
    context.arc(particleX, particleY, particle.size, 0, Math.PI * 2);
    context.fill();
  }
  for (const seed of seeds) {
    if (!seed.active) continue;
    const seedX = x + seed.position.x * pixelsPerAU;
    const seedY = y + seed.position.y * pixelsPerAU;
    const seedRadius = getSeedRadius(seed, radius);
    // Start dust-like, then become more opaque only as material is collected.
    const acquired = seed.visibleMaterial - SEED_STARTING_MATERIAL;
    const seedOpacity = seed.opacity + (1 - seed.opacity) * acquired / (acquired + 4);
    const dustColour = [218, 204, 181];
    const seedColour = dustColour.map((channel, index) =>
      Math.round(channel + (seed.planetColour[index] - channel) * seed.colourProgress)
    );
    context.fillStyle = `rgba(${seedColour.join(",")}, ${seedOpacity * dustOpacity})`;
    context.beginPath();
    context.arc(seedX, seedY, seedRadius, 0, Math.PI * 2);
    context.fill();
    if (roguePlanets.includes(seed)) {
      context.font = "12px Arial, sans-serif";
      context.textAlign = "center";
      context.fillStyle = "#dce2ed";
      context.fillText("Rogue planet", seedX, seedY - seedRadius - 8);
    }
    if (seed === selectedSeed) {
      context.strokeStyle = "#f2cf9c";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(seedX, seedY, seedRadius + 4, 0, Math.PI * 2);
      context.stroke();
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Resizing changes the view only; it must never introduce extra material.
  redraw();
}
