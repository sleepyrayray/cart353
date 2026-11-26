const starSettings = {
  mass: 1,
};

const MAX_DUST_COUNT = 6750;
const DUST_COUNT_MULTIPLIER = 6.75;
const DUST_FADE_SECONDS = 1.2;
// Shared display scale for the star and seeds, not a change to their masses.
const BODY_VISUAL_SCALE = 1.5;
const SEED_STARTING_MATERIAL = 4;
const SEED_DUST_RADIUS = 1.1;
// Display radius for one Earth mass, before the shared visual scale.
// Deliberately enlarged for readability, not to scale with the star or distances.
const PLANET_EARTH_MASS_RADIUS = 7.5;
const SEED_GROWTH_SECONDS = 2;
const MERGER_ANIMATION_SECONDS = 1.1;
const PLANET_FADE_SECONDS = 0.8;
const SEED_MAX_STAR_RATIO = 0.5;
const SEED_COLOUR_THRESHOLD = 3;
// Keep the size transition independent from the earlier colour milestone.
const SEED_EMERGENCE_MATERIAL = 7;
const MIN_SEEDS = 15;
const MAX_SEEDS = 20;
const MAX_ROGUE_PLANETS = 10;
const MAX_COMETS = 5;
const VISITOR_ARRIVAL_INTERVAL = [0.75, 1.5];
const VISITOR_EDGE_OFFSET = 2;
const ROGUE_STAR_SIZE_RATIO = 0.25;
const ROGUE_COLOUR = [85, 85, 85];
const ROGUE_CLOSEST_APPROACH_RANGE = [0.2, 0.7];
const COMET_CORE_RADIUS = 3;
const COMET_TRAIL_SECONDS = 0.8;
const COMET_COLOUR = "255, 73, 85";
const MAX_MOONS = 3;
const OUTER_RING_RADIUS_SCALE = 2.05;
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
const DISK_CLEARING_START_SECONDS = 45;
const DISK_CLEARING_DURATION_SECONDS = 45;
const LAST_DUST_DEPARTURE_SECONDS = 80;

let dustParticles = [];
let seeds = [];
let selectedSeed = null;
let roguePlanets = [];
let comets = [];
let nextRogueAt = 0;
let nextCometAt = 0;
let mergerAnimations = [];
let planetFades = [];
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
  document.getElementById("play").addEventListener("click", playOrbit);
  document.getElementById("pause").addEventListener("click", pauseOrbit);
  document.getElementById("reset").addEventListener("click", resetOrbit);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isPlaying) pauseOrbit();
  });
  updateStarSettings();
}

function updateStarSettings() {
  const previousMass = starSettings.mass;
  starSettings.mass = Number(document.getElementById("mass").value);

  document.getElementById("mass-value").textContent = `${starSettings.mass.toFixed(1)}× Sun`;
  const description = getStarDescription(starSettings.mass);
  document.getElementById("star-description").textContent = description;
  describe(`${description} Mass is ${starSettings.mass.toFixed(1)} times the Sun's. Each run starts with the maximum dust setting for the current screen size. Each reset creates between ${MIN_SEEDS} and ${MAX_SEEDS} seeds with orbit sizes spread across a wide band and slightly oval, differently oriented paths. Some paths can cross, but collisions are not forced. Press Play to reveal the finite dust supply and seeds, which initially look like the other particles. Each seed gently attracts nearby dust and grows by collecting dust that touches it. Its body keeps the size it reached when the dust cleared. Their pull on dust strengthens with growth but is capped. Seeds gravitationally affect each other's orbits using masses based on collected material, while the star stays fixed. Seeds merge when their visible edges touch and combine mass. From forty-five seconds, remaining dust departs outward at varied times, leaving the screen by one minute thirty seconds as gas drag weakens. Dust can also escape or fade near the star. After the dust clears, rogue planets and comets arrive automatically from the edges. Up to ${MAX_ROGUE_PLANETS} rogue planets and ${MAX_COMETS} comets can be active at once. Rogue planets are dark grey, a quarter of the star's width, and tend to pass through the inner system. When a rogue and a resident touch, the resident absorbs the rogue and keeps its orbit at contact. Two rogues merge into one rogue on contact. Each merger lets a resident planet gain or restore one moon, up to three. Once it has three moons, the next merger adds or restores its rings. Comet impacts remove the rings first, then one moon per hit, then the planet. Destroyed planets fade out. Contact with the star removes the comet. Reset starts fresh. Visible sizes, dust attraction, clearing motion, and time are exaggerated.`);

  if (!seeds.length || starSettings.mass !== previousMass) resetOrbit();
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
  comets = [];
  nextRogueAt = 0;
  nextCometAt = 0;
  mergerAnimations = [];
  planetFades = [];
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
      dustMaterial: SEED_STARTING_MATERIAL,
      visibleMaterial: SEED_STARTING_MATERIAL,
      opacity: random(0.45, 0.65),
      planetColour: availableColours.splice(Math.floor(random(availableColours.length)), 1)[0],
      colourProgress: 0,
      collected: 0,
      active: true,
    };
  });
  dustRevealTime = 0;
  timeAccumulator = 0;
  updatePlaybackControls("Ready");
  redraw();
}

function getVisitorScreenBounds() {
  // The canvas fills the current browser viewport. Panels never define an edge.
  return { left: 0, right: width, top: 0, bottom: height };
}

function getVisitorEntryPoint(radius) {
  const { left, right, top, bottom } = getVisitorScreenBounds();
  // Start with the entire disk hidden and only a two-pixel gap before it enters.
  const offset = radius + VISITOR_EDGE_OFFSET;
  const cornerInset = Math.min(Math.max(24, radius * 2), (right - left) / 4, (bottom - top) / 4);
  const edge = Math.floor(random(4));
  return {
    x: edge === 0 ? left - offset : edge === 1 ? right + offset : random(left + cornerInset, right - cornerInset),
    y: edge === 2 ? top - offset : edge === 3 ? bottom + offset : random(top + cornerInset, bottom - cornerInset),
    inwardX: edge === 0 ? 1 : edge === 1 ? -1 : 0,
    inwardY: edge === 2 ? 1 : edge === 3 ? -1 : 0,
  };
}

function getVisitorApproach(view, radius, residents, closestApproachRange = [0, 1.15]) {
  const entry = getVisitorEntryPoint(radius);
  const position = {
    x: (entry.x - view.x) / view.pixelsPerAU,
    y: (entry.y - view.y) / view.pixelsPerAU,
  };
  const approachRadius = Math.hypot(position.x, position.y);
  if (approachRadius <= view.radius / view.pixelsPerAU) return null;
  const radial = { x: position.x / approachRadius, y: position.y / approachRadius };
  const systemRadius = Math.max(view.outerSeedOrbit,
    ...residents.filter(seed => !seed.isRogue)
      .map(seed => Math.hypot(seed.position.x, seed.position.y)));
  // Unbound Keplerian approach: choose an encounter distance, NOT a target planet.
  // v² = v_infinity² + 2μ/r; h² = q² v_infinity² + 2μq.
  // https://orbital-mechanics.space/the-orbit-equation/hyperbolic-trajectories.html
  const mu = GRAVITY * starSettings.mass;
  // A viewport edge can be inside the outer orbits. Keep the planned closest
  // approach inside the spawn radius so the visitor still starts moving inward.
  const closestApproach = random(...closestApproachRange) * Math.min(systemRadius, approachRadius * 0.8);
  const excessSpeed = random(0.3, 0.7) * Math.sqrt(mu / systemRadius);
  const angularMomentum = Math.sqrt((closestApproach * excessSpeed) ** 2 + 2 * mu * closestApproach);
  let tangentialSpeed = (random() < 0.5 ? -1 : 1) * angularMomentum / approachRadius;
  const inwardSpeed = -Math.sqrt(Math.max(0,
    excessSpeed ** 2 + 2 * mu / approachRadius - tangentialSpeed ** 2));
  // Avoid a grazing launch that barely moves across the entry edge.
  const normalInwardSpeed = inwardSpeed * (radial.x * entry.inwardX + radial.y * entry.inwardY);
  const tangentNormal = -radial.y * entry.inwardX + radial.x * entry.inwardY;
  if (tangentialSpeed * tangentNormal < -normalInwardSpeed * 0.5) tangentialSpeed *= -1;
  return {
    position,
    velocity: {
      x: radial.x * inwardSpeed - radial.y * tangentialSpeed,
      y: radial.y * inwardSpeed + radial.x * tangentialSpeed,
    },
    active: true,
    hasEnteredScreen: false,
  };
}

function addComet(view) {
  const approach = getVisitorApproach(view, COMET_CORE_RADIUS, seeds.filter(seed => seed.active));
  if (!approach) return;
  comets.push({ ...approach, trail: [] });
}

function addRoguePlanet(view) {
  // A stylized 5–30 Earth-mass visitor with a fixed display size.
  const earthMasses = random(5, 30);
  const material = earthMasses / EARTH_MASSES_PER_MATERIAL_UNIT;
  const radius = view.radius * ROGUE_STAR_SIZE_RATIO;
  const residents = seeds.filter(seed => seed.active);
  const approach = getVisitorApproach(view, radius, residents, ROGUE_CLOSEST_APPROACH_RANGE);
  if (!approach) return;
  const roguePlanet = {
    ...approach,
    material,
    visibleMaterial: material,
    isRogue: true,
    collected: 0,
    entering: true,
  };
  roguePlanets.push(roguePlanet);
  seeds = [...residents, roguePlanet];
}

function retireOffscreenVisitor(body, position, radius, view) {
  const x = view.x + position.x * view.pixelsPerAU;
  const y = view.y + position.y * view.pixelsPerAU;
  const visible = x + radius >= 0 && x - radius <= width
    && y + radius >= 0 && y - radius <= height;
  if (visible) body.hasEnteredScreen = true;
  const outside = x + radius < -VISITOR_EDGE_OFFSET || x - radius > width + VISITOR_EDGE_OFFSET
    || y + radius < -VISITOR_EDGE_OFFSET || y - radius > height + VISITOR_EDGE_OFFSET;
  // A new arrival reserves a slot while crossing the tiny off-screen gap.
  const movingAwayFromScreen = (x + radius < 0 && body.velocity.x < 0)
    || (x - radius > width && body.velocity.x > 0)
    || (y + radius < 0 && body.velocity.y < 0)
    || (y - radius > height && body.velocity.y > 0);
  if (outside && (body.hasEnteredScreen || movingAwayFromScreen)) body.active = false;
}

function updateVisitors(view) {
  for (const body of roguePlanets) {
    retireOffscreenVisitor(body, getSeedDisplayPosition(body), getSeedRadius(body, view.radius), view);
  }
  for (const comet of comets) {
    if (comet.active) retireOffscreenVisitor(comet, comet.position, COMET_CORE_RADIUS, view);
    comet.trail = comet.trail.filter(point => diskAgeSeconds - point.time < COMET_TRAIL_SECONDS);
  }
  roguePlanets = roguePlanets.filter(body => body.active);
  comets = comets.filter(comet => comet.active || comet.trail.length > 0);
  if (!isPlaying || diskAgeSeconds <= 0 || dustParticles.length > 0) return;

  if (diskAgeSeconds >= nextRogueAt && roguePlanets.length < MAX_ROGUE_PLANETS) {
    addRoguePlanet(view);
    nextRogueAt = diskAgeSeconds + random(...VISITOR_ARRIVAL_INTERVAL);
  }
  if (diskAgeSeconds >= nextCometAt && comets.filter(comet => comet.active).length < MAX_COMETS) {
    addComet(view);
    nextCometAt = diskAgeSeconds + random(...VISITOR_ARRIVAL_INTERVAL);
  }
}

function advanceComets(view, surfaceRadius, planets) {
  const coreRadius = COMET_CORE_RADIUS / view.pixelsPerAU;
  for (const comet of comets) {
    if (!comet.active) continue;
    const impact = stepComet(comet, starSettings.mass, PHYSICS_STEP, surfaceRadius, coreRadius, planets);
    comet.trail.push({ ...comet.position, time: diskAgeSeconds });
    if (!impact) continue;
    comet.active = false;
    if (!impact.planet) continue;
    const { seed } = impact.planet;
    if (seed.hasRings) {
      seed.hasRings = false;
    } else if (seed.moons?.length) {
      seed.moons.pop();
    } else {
      destroyPlanet(seed, view);
      // Later comets in this step can fly through the space the planet occupied.
      planets.splice(planets.indexOf(impact.planet), 1);
    }
  }
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
    const cometTargets = comets.some(comet => comet.active)
      ? seeds.filter(seed => seed.active).map(seed => ({ seed, start: { ...getSeedDisplayPosition(seed) } }))
      : null;
    // Real mass-scaled mutual gravity, separate from the exaggerated dust pull.
    // The star remains fixed; visible contact merges seeds, with no seed gas drag.
    stepSeeds(seeds, starSettings.mass, PHYSICS_STEP, surfaceRadius,
      () => mergeTouchingSeeds(view), seed => destroyPlanet(seed, view));
    if (cometTargets) {
      const planets = cometTargets.filter(({ seed }) => seed.active).map(({ seed, start }) => ({
        seed, start, end: getSeedDisplayPosition(seed), mass: getSeedMass(seed),
        radius: getSeedRadius(seed, view.radius) / view.pixelsPerAU,
      }));
      advanceComets(view, surfaceRadius, planets);
    }
    const attractors = seeds.filter(seed => seed.active).map(seed => ({
      position: seed.position,
      materialRatio: seed.visibleMaterial / SEED_STARTING_MATERIAL,
    }));
    const hasDust = dustParticles.some(particle => particle.remaining > 0);
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
    // Ease toward dust collected by this planet. When the disk clears, the body
    // stays at the size it reached during formation.
    const growthBlend = -Math.expm1(-PHYSICS_STEP / YEARS_PER_SECOND / SEED_GROWTH_SECONDS);
    // Colour is a visual milestone, not a scientific planet-formation threshold.
    const colourBlend = -Math.expm1(-PHYSICS_STEP / YEARS_PER_SECOND / 2);
    for (const seed of seeds) {
      if (seed.isRogue) continue;
      if (hasDust) seed.visibleMaterial += (seed.dustMaterial - seed.visibleMaterial) * growthBlend;
      const colourTarget = seed.collected >= SEED_COLOUR_THRESHOLD ? 1 : 0;
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
    const entryBounds = roguePlanets.some(body => body.entering) ? getVisitorScreenBounds() : null;
    for (const seed of seeds) {
      if (!seed.active) continue;
      if (seed.entering && (clickX < entryBounds.left || clickX > entryBounds.right
        || clickY < entryBounds.top || clickY > entryBounds.bottom)) continue;
      const position = getSeedDisplayPosition(seed);
      const x = view.x + position.x * view.pixelsPerAU;
      const y = view.y + position.y * view.pixelsPerAU;
      const distance = Math.hypot(clickX - x, clickY - y);
      const radius = getSeedRadius(seed, view.radius);
      const targetRadius = seed.entering ? radius : Math.max(8, radius);
      if (distance <= targetRadius && distance < closest) {
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
  // Account for a larger window while keeping the same clearing deadline.
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
  if (seed.isRogue) return starRadius * ROGUE_STAR_SIZE_RATIO;
  // Cube-root scaling is a simple common-density assumption, not a composition model.
  // Display size uses only the dust collected during formation.
  const visibleEarthMasses = seed.visibleMaterial * EARTH_MASSES_PER_MATERIAL_UNIT;
  const massRadius = PLANET_EARTH_MASS_RADIUS * Math.cbrt(visibleEarthMasses) * BODY_VISUAL_SCALE;
  // Start the same size as a dust dot, then smoothly reveal the mass-based scale
  // over the first seven full material bundles. No extra growth just from waiting.
  const acquired = Math.max(0, seed.visibleMaterial - SEED_STARTING_MATERIAL);
  const emergence = smoothProgress(acquired / SEED_EMERGENCE_MATERIAL);
  const grownRadius = SEED_DUST_RADIUS + (massRadius - SEED_DUST_RADIUS) * emergence;
  return Math.min(grownRadius, starRadius * SEED_MAX_STAR_RATIO);
}

function getSeedDisplayPosition(seed) {
  const offset = seed.mergeDisplayOffset;
  if (!offset) return seed.position;
  const remaining = 1 - smoothProgress((diskAgeSeconds - offset.startedAt) / MERGER_ANIMATION_SECONDS);
  return {
    x: seed.position.x + offset.x * remaining,
    y: seed.position.y + offset.y * remaining,
  };
}

function getSeedAppearance(seed) {
  if (seed.isRogue) return { opacity: 1, colour: ROGUE_COLOUR };
  const acquired = seed.visibleMaterial - SEED_STARTING_MATERIAL;
  return {
    opacity: seed.opacity + (1 - seed.opacity) * acquired / (acquired + 4),
    colour: [218, 204, 181].map((channel, index) =>
      Math.round(channel + (seed.planetColour[index] - channel) * seed.colourProgress)),
  };
}

function destroyPlanet(seed, view) {
  planetFades.push({
    position: { ...getSeedDisplayPosition(seed) },
    radius: getSeedRadius(seed, view.radius),
    appearance: getSeedAppearance(seed),
    hasRings: seed.hasRings,
    moons: seed.moons,
    startedAt: diskAgeSeconds,
  });
  seed.active = false;
}

function drawMergerAnimations(context, view, dustOpacity) {
  // These are visual remnants only: no gravity, collection, labels, or click targets.
  mergerAnimations = mergerAnimations.filter(animation => animation.target.active
    && diskAgeSeconds - animation.startedAt < MERGER_ANIMATION_SECONDS);
  for (const animation of mergerAnimations) {
    const progress = (diskAgeSeconds - animation.startedAt) / MERGER_ANIMATION_SECONDS;
    const blend = smoothProgress(progress);
    const target = getSeedDisplayPosition(animation.target);
    const x = animation.position.x + (target.x - animation.position.x) * blend;
    const y = animation.position.y + (target.y - animation.position.y) * blend;
    const radius = Math.min(animation.radius, view.radius * SEED_MAX_STAR_RATIO) * (1 - blend);
    const opacity = animation.opacity * dustOpacity * (1 - smoothProgress((progress - 0.65) / 0.35));
    context.fillStyle = `rgba(${animation.colour.join(",")}, ${opacity})`;
    context.beginPath();
    context.arc(view.x + x * view.pixelsPerAU, view.y + y * view.pixelsPerAU,
      radius, 0, Math.PI * 2);
    context.fill();
  }
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
        // Residents take priority in mixed encounters. Rogues have equal display sizes.
        const bothRogues = first.isRogue && second.isRogue;
        const firstSurvives = bothRogues
          ? first.material >= second.material
          : second.isRogue || (!first.isRogue && firstRadius >= secondRadius);
        const survivor = firstSurvives ? first : second;
        const absorbed = survivor === first ? second : first;
        const absorbedPosition = { ...getSeedDisplayPosition(absorbed) };
        const absorbedAppearance = getSeedAppearance(absorbed);
        if (absorbed.isRogue && !survivor.isRogue) {
          // Feeding a resident transfers material while keeping its orbit at contact.
          absorbSeedMaterial(survivor, absorbed);
        } else {
          const survivorPosition = { ...getSeedDisplayPosition(survivor) };
          mergeSeedBodies(survivor, absorbed, view.radius / view.pixelsPerAU);
          // Ease the survivor's display position after physical recentering.
          survivor.mergeDisplayOffset = {
            x: survivorPosition.x - survivor.position.x,
            y: survivorPosition.y - survivor.position.y,
            startedAt: diskAgeSeconds,
          };
        }
        if (!survivor.isRogue) {
          // Rebuild defenses in order using what the survivor currently has.
          survivor.moons ??= [];
          if (survivor.moons.length < MAX_MOONS) {
            survivor.moons.push({ angle: random(TWO_PI), startedAt: diskAgeSeconds });
          } else {
            survivor.hasRings = true;
          }
        }
        // Retarget ongoing absorptions if their host is itself eaten in a chain.
        for (const animation of mergerAnimations) {
          if (animation.target === absorbed) animation.target = survivor;
        }
        mergerAnimations.push({
          target: survivor,
          position: absorbedPosition,
          radius: getSeedRadius(absorbed, view.radius),
          ...absorbedAppearance,
          startedAt: diskAgeSeconds,
        });
        if (bothRogues) {
          survivor.entering = first.entering && second.entering;
          survivor.hasEnteredScreen = first.hasEnteredScreen || second.hasEnteredScreen;
        }
        if (selectedSeed === absorbed) selectedSeed = survivor;
        if (Math.hypot(survivor.position.x, survivor.position.y)
          <= view.radius / view.pixelsPerAU) destroyPlanet(survivor, view);
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
  collector.dustMaterial += particle.remaining;
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
    // Give every particle time to drift off-screen before the clearing deadline.
    departureDuration: random(7.5, Math.min(17.5, clearingEnd - departureAt)),
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
  // Use the former maximum dust setting, scaled by the viewport's sampling area.
  const referenceCount = Math.min(1000,
    (bounds.right - bounds.left) * (bounds.bottom - bounds.top) * dustDensity);
  const count = Math.min(MAX_DUST_COUNT,
    Math.round(referenceCount * DUST_COUNT_MULTIPLIER));
  const particles = [];
  for (let i = 0; i < count; i++) {
    const position = { x: random(bounds.left, bounds.right), y: random(bounds.top, bounds.bottom) };
    // No solid dust starts inside the exaggerated stellar surface.
    if (Math.hypot(position.x, position.y) <= view.radius / view.pixelsPerAU) continue;
    particles.push(createDustParticle(position));
  }
  return particles;
}

// These five mass groups use approximate descriptions for the interface.
function getStarDescription(mass) {
  let star = "A very hot, bright blue-white star";
  if (mass < 0.45) star = "A small, cool red star";
  else if (mass < 0.8) star = "A softly glowing orange star";
  else if (mass < 1.2) star = "A Sun-like star";
  else if (mass < 3) star = "A hot, bright white star";

  return `${star} born from a dust-rich cloud.`;
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

function drawComets(context, x, y, pixelsPerAU) {
  for (const comet of comets) {
    for (const point of comet.trail) {
      const remaining = 1 - (diskAgeSeconds - point.time) / COMET_TRAIL_SECONDS;
      context.fillStyle = `rgba(${COMET_COLOUR}, ${0.6 * remaining ** 2})`;
      context.beginPath();
      context.arc(x + point.x * pixelsPerAU, y + point.y * pixelsPerAU,
        COMET_CORE_RADIUS * remaining, 0, Math.PI * 2);
      context.fill();
    }
    if (comet.active) {
      context.fillStyle = `rgb(${COMET_COLOUR})`;
      context.beginPath();
      context.arc(x + comet.position.x * pixelsPerAU, y + comet.position.y * pixelsPerAU,
        COMET_CORE_RADIUS, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawMoons(context, moons, x, y, planetRadius, hasRings, opacity) {
  if (!moons?.length) return;
  context.fillStyle = `rgba(168, 173, 184, ${opacity})`;
  const radius = Math.min(2, Math.max(0.8, planetRadius * 0.25));
  // Leave room for the outer ring's stroke and the moon's full disk.
  const firstOrbit = hasRings
    ? Math.max(planetRadius + 5, planetRadius * (OUTER_RING_RADIUS_SCALE + 0.05) + radius + 2)
    : planetRadius + 5;
  for (const [index, moon] of moons.entries()) {
    const angle = moon.angle + (diskAgeSeconds - moon.startedAt) * 1.8;
    const distance = firstOrbit + index * 5;
    context.beginPath();
    context.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawRingHalf(context, x, y, planetRadius, front, opacity) {
  // The planet disk covers the back half. Draw the front half over the disk.
  const startAngle = front ? 0 : Math.PI;
  const endAngle = startAngle + Math.PI;
  const tilt = -Math.PI / 8;
  context.save();
  context.globalAlpha = opacity;
  context.strokeStyle = "#d9c49e";
  context.lineWidth = Math.max(0.7, planetRadius * 0.18);
  context.beginPath();
  context.ellipse(x, y, planetRadius * 1.65, planetRadius * 0.55, tilt, startAngle, endAngle);
  context.stroke();
  context.strokeStyle = "#a99677";
  context.lineWidth = Math.max(0.55, planetRadius * 0.09);
  context.beginPath();
  context.ellipse(x, y, planetRadius * OUTER_RING_RADIUS_SCALE, planetRadius * 0.68, tilt, startAngle, endAngle);
  context.stroke();
  context.restore();
}

function drawPlanetBody(context, x, y, radius, appearance, planet, visibility) {
  const opacity = appearance.opacity * visibility;
  if (planet.hasRings) drawRingHalf(context, x, y, radius, false, opacity);
  context.fillStyle = `rgba(${appearance.colour.join(",")}, ${opacity})`;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  if (planet.hasRings) drawRingHalf(context, x, y, radius, true, opacity);
  drawMoons(context, planet.moons, x, y, radius, planet.hasRings, visibility);
}

function drawPlanetFades(context, view, visibility) {
  planetFades = planetFades.filter(planet => diskAgeSeconds - planet.startedAt < PLANET_FADE_SECONDS);
  for (const planet of planetFades) {
    const progress = (diskAgeSeconds - planet.startedAt) / PLANET_FADE_SECONDS;
    const x = view.x + planet.position.x * view.pixelsPerAU;
    const y = view.y + planet.position.y * view.pixelsPerAU;
    const radius = Math.min(planet.radius, view.radius * SEED_MAX_STAR_RATIO);
    drawPlanetBody(context, x, y, radius, planet.appearance, planet, visibility * (1 - smoothProgress(progress)));
  }
}

function draw() {
  if (isPlaying) {
    const now = performance.now();
    const frameSeconds = Math.min((now - lastFrameTime) / 1000, 0.25);
    advanceOrbit(frameSeconds);
    dustRevealTime = Math.min(DUST_FADE_SECONDS, dustRevealTime + frameSeconds);
    lastFrameTime = now;
  }
  const view = getSpaceView();
  updateVisitors(view);
  updatePlanetInfo();
  background("#0b0d16");

  // Keep the star clear of the controls, while dust fills the whole canvas.
  const { x, y, radius, pixelsPerAU } = view;

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
  // Draw the smaller remnants underneath the survivors, so they slide into the disk.
  drawMergerAnimations(context, view, dustOpacity);
  drawPlanetFades(context, view, dustOpacity);
  drawComets(context, x, y, pixelsPerAU);
  const entryBounds = roguePlanets.some(body => body.entering) ? getVisitorScreenBounds() : null;
  for (const seed of seeds) {
    if (!seed.active) continue;
    const position = getSeedDisplayPosition(seed);
    const seedX = x + position.x * pixelsPerAU;
    const seedY = y + position.y * pixelsPerAU;
    const seedRadius = getSeedRadius(seed, radius);
    if (seed.entering) {
      const { left, right, top, bottom } = entryBounds;
      seed.entering = seedX - seedRadius < left || seedX + seedRadius > right
        || seedY - seedRadius < top || seedY + seedRadius > bottom;
      if (seed.entering) {
        // Reveal only the part that has crossed the browser edge, not a panel edge.
        context.save();
        context.beginPath();
        context.rect(left, top, right - left, bottom - top);
        context.clip();
      }
    }
    drawPlanetBody(context, seedX, seedY, seedRadius, getSeedAppearance(seed), seed, dustOpacity);
    if (seed === selectedSeed) {
      context.strokeStyle = "#f2cf9c";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(seedX, seedY, seedRadius + 4, 0, Math.PI * 2);
      context.stroke();
    }
    if (seed.entering) context.restore();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Resizing changes the view only; it must never introduce extra material.
  redraw();
}
