const STAR_MASS = 1; // Solar masses.
const STAR_COLOUR = [255, 239, 210];
const STAR_GLOW = 0.2583;
const STAR_DISPLAY_FACTOR = 0.3 + 0.7 * (1 / 6) ** 0.6;

const MAX_DUST_COUNT = 6750;
const DUST_COUNT_MULTIPLIER = 6.75;
const DUST_FADE_SECONDS = 1.2;
// Shared display scale for the star and seeds, not a change to their masses.
const BODY_VISUAL_SCALE = 1.8;
const CAMERA_REFERENCE_BODY_SCALE = 1.5;
const SEED_STARTING_MATERIAL = 4;
const SEED_DUST_RADIUS = 1.1;
const SEED_DUST_VISUAL_GAIN = 1.15;
// Display radius for one Earth mass, before the shared visual scale.
// Deliberately enlarged for readability, not to scale with the star or distances.
const PLANET_EARTH_MASS_RADIUS = 7.5;
const SEED_GROWTH_SECONDS = 1.6;
const MERGER_ANIMATION_SECONDS = 1.1;
const PLANET_FADE_SECONDS = 0.8;
const SEED_MAX_STAR_RATIO = 0.5;
const PLANET_SIZE_PROTECTION_BONUS = 0.20;
const MAX_PROTECTED_STAR_RATIO = SEED_MAX_STAR_RATIO * (1 + PLANET_SIZE_PROTECTION_BONUS);
const PLANET_SIZE_TRANSITION_SECONDS = 1.2;
const PLANET_LIFE_WAIT_SECONDS = 30;
const PLANET_LIFE_PULSE_SECONDS = 1.5;
const PLANET_LASER_WAIT_SECONDS = 30;
const LASER_RANGE_PIXELS = 145;
const LASER_SPEED_PIXELS_PER_SECOND = 70;
const LASER_SHOT_INTERVAL_SECONDS = 1.5;
const LASER_SHOT_LIFETIME_SECONDS = 3;
const LASER_SHOT_FADE_SECONDS = 0.6;
const LASER_SHOT_RADIUS = 1.5;
const SEED_COLOUR_THRESHOLD = 3;
// Keep the size transition independent from the earlier colour milestone.
const SEED_EMERGENCE_MATERIAL = 7;
const MIN_SEEDS = 15;
const MAX_SEEDS = 20;
const MAX_ROGUE_PLANETS = 40;
const MAX_COMETS = 5;
const VISITOR_ARRIVAL_INTERVAL = [0.75, 1.5];
const COMET_ARRIVAL_DELAY_SECONDS = 30;
const VISITOR_EDGE_OFFSET = 2;
const ROGUE_STAR_SIZE_RATIO = 0.20;
const ROGUE_COLOUR = [58, 58, 58];
const ROGUE_MOTION_RATE = 0.9;
const ROGUE_CLOSEST_APPROACH_RANGE = [0.2, 0.7];
const COMET_CORE_RADIUS = 3;
const COMET_EXCESS_SPEED_RANGE = [0.55, 1.05];
const COMET_MOTION_RATE = 1.2;
const MERGED_COMET_STRENGTH = 2;
const MERGED_COMET_SPEED_MULTIPLIER = 2;
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
const DISK_CLEARING_START_SECONDS = 30;
const PLANET_COLOUR_REPORT_SECONDS = 50;
const DUST_CLEARING_REPORT_SECONDS = 90;
const DISK_CLEARING_END_SECONDS = 120;
const LAST_DUST_DEPARTURE_START_SECONDS = 100;

let dustParticles = [];
let seeds = [];
let roguePlanets = [];
let comets = [];
let laserShots = [];
let nextRogueAt = 0;
let nextCometAt = null;
let mergerAnimations = [];
let planetFades = [];
let diskAgeSeconds = 0;
let dustRevealTime = 0;
let isPlaying = false;
let timeAccumulator = 0;
let lastFrameTime = 0;

function setup() {
  const space = document.getElementById("space");
  const canvas = createCanvas(Math.max(1, space.clientWidth), Math.max(1, space.clientHeight));
  canvas.parent(space);
  pixelDensity(min(displayDensity(), 2));
  noLoop();

  document.getElementById("play-pause").addEventListener("click", togglePlayback);
  document.getElementById("reset").addEventListener("click", resetOrbit);
  // The canvas fills the space above the controls, even when the bar resizes.
  new ResizeObserver(() => {
    const spaceWidth = Math.max(1, space.clientWidth);
    const spaceHeight = Math.max(1, space.clientHeight);
    if (width === spaceWidth && height === spaceHeight) return;
    resizeCanvas(spaceWidth, spaceHeight, true);
    if (!isPlaying) redraw();
  }).observe(space);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isPlaying) pauseOrbit();
  });
  describe(`A Sun-like star born from a dust-rich cloud. Its mass is the same as the Sun's. Each run starts with the maximum dust setting for the current screen size. Each reset creates between ${MIN_SEEDS} and ${MAX_SEEDS} seeds with orbit sizes spread across a wide band and slightly oval, differently oriented paths. Some paths can cross, but collisions are not forced. Press Play to reveal the finite dust supply and seeds, which initially look like the other particles. Each seed gently attracts nearby dust and grows by collecting dust that touches it. The size it reaches when the dust clears becomes its base size. Their pull on dust strengthens with growth but is capped. Seeds gravitationally affect each other's orbits using masses based on collected material, while the star stays fixed. Seeds merge when their visible edges touch and combine mass. Between residents, the planet with more protection survives, counting moons, rings, the size boost, the life glow, and laser defense. If both have equal protection, either can survive. Size decides only when neither has protection. From thirty seconds, leftover dust gradually drifts outward and off the screen at staggered times. All dust is gone by two minutes. After the dust clears, rogue planets arrive automatically from the edges. Comets start arriving thirty seconds after the first rogue enters the screen. Up to ${MAX_ROGUE_PLANETS} rogue planets and ${MAX_COMETS} comets can be active at once. Rogue planets are dark grey, ${Math.round(ROGUE_STAR_SIZE_RATIO * 100)}% of the star's width, and move more slowly as they pass through the inner system. When a rogue and a resident touch, the resident absorbs the rogue and keeps its orbit at contact. Two rogues merge into one rogue on contact. Mergers let a resident planet gain or restore three moons, rings, and a size boost, one layer at a time. After thirty seconds of active playback with the size boost, the planet gains a pulsing glow in its own colour to show that life has begun. Losing the glow restarts the wait if the size boost is still there. Two regular comets merge into one comet twice the normal width and twice their average speed at contact. If a big comet hits another comet, one big comet continues unchanged and the other disappears. A regular comet takes one life and a merged comet takes up to two. After thirty more seconds with the glow, a planet can fire shots in its own colour at nearby comets and resident planets. A shot destroys a comet or a rogue in its path, removes one layer from a protected planet, or destroys one with no protection. Comet impacts remove laser defense first, then the glow, the size boost, the rings, the moons, and finally the planet. Destroyed planets fade out. Contact with the star removes the comet. Reset starts fresh. Visible sizes, dust attraction, clearing motion, and time are exaggerated.`);
  resetOrbit();
}

function updatePlaybackControls() {
  const playback = document.getElementById("play-pause");
  const label = isPlaying ? "Pause" : "Play";
  playback.dataset.playing = String(isPlaying);
  playback.setAttribute("aria-label", label);
}

function togglePlayback() {
  if (isPlaying) pauseOrbit();
  else playOrbit();
}

function playOrbit() {
  if (isPlaying) return;
  isPlaying = true;
  lastFrameTime = performance.now();
  systemReporter.start();
  updatePlaybackControls();
  loop();
}

function pauseOrbit() {
  isPlaying = false;
  noLoop();
  updatePlaybackControls();
  redraw();
}

function resetOrbit() {
  isPlaying = false;
  noLoop();
  roguePlanets = [];
  comets = [];
  laserShots = [];
  nextRogueAt = 0;
  nextCometAt = null;
  mergerAnimations = [];
  planetFades = [];
  const view = getSpaceView();
  // Generate the complete material supply once. Nothing replenishes it mid-run.
  dustParticles = createDustCloud(view);
  diskAgeSeconds = 0;
  updateElapsedTime();
  systemReporter.reset();
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
    const speedScale = Math.sqrt(GRAVITY * STAR_MASS / semiLatusRectum);
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
  updatePlaybackControls();
  redraw();
}

function getVisitorScreenBounds() {
  // The canvas ends at the top of the controls bar.
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

function getVisitorApproach(view, radius, residents, {
  closestApproachRange = [0, 1.15],
  excessSpeedRange = [0.3, 0.7],
} = {}) {
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
  const mu = GRAVITY * STAR_MASS;
  // A viewport edge can be inside the outer orbits. Keep the planned closest
  // approach inside the spawn radius so the visitor still starts moving inward.
  const closestApproach = random(...closestApproachRange) * Math.min(systemRadius, approachRadius * 0.8);
  const excessSpeed = random(...excessSpeedRange) * Math.sqrt(mu / systemRadius);
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
  const approach = getVisitorApproach(view, COMET_CORE_RADIUS, seeds.filter(seed => seed.active), {
    excessSpeedRange: COMET_EXCESS_SPEED_RANGE,
  });
  if (!approach) return;
  comets.push({ ...approach, strength: 1, motionRate: COMET_MOTION_RATE, trail: [] });
}

function getCometRadius(comet) {
  return COMET_CORE_RADIUS * comet.strength;
}

function addRoguePlanet(view) {
  // A stylized 5–30 Earth-mass visitor with a fixed display size.
  const earthMasses = random(5, 30);
  const material = earthMasses / EARTH_MASSES_PER_MATERIAL_UNIT;
  const radius = view.radius * ROGUE_STAR_SIZE_RATIO;
  const residents = seeds.filter(seed => seed.active);
  const approach = getVisitorApproach(view, radius, residents, {
    closestApproachRange: ROGUE_CLOSEST_APPROACH_RANGE,
  });
  if (!approach) return;
  const roguePlanet = {
    ...approach,
    material,
    visibleMaterial: material,
    isRogue: true,
    motionRate: ROGUE_MOTION_RATE,
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
  body.visibleOnScreen = visible;
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
    if (comet.active) retireOffscreenVisitor(comet, comet.position, getCometRadius(comet), view);
    comet.trail = comet.trail.filter(point => diskAgeSeconds - point.time < COMET_TRAIL_SECONDS);
  }
  roguePlanets = roguePlanets.filter(body => body.active);
  comets = comets.filter(comet => comet.active || comet.trail.length > 0);
  if (!isPlaying || diskAgeSeconds < DISK_CLEARING_END_SECONDS || dustParticles.length > 0) return;

  if (!systemReporter.hasSeenIntro("rogues") && roguePlanets.filter(body => body.visibleOnScreen).length >= 2) {
    systemReporter.intro("rogues");
  }
  if (!systemReporter.hasSeenIntro("comets")
    && comets.filter(comet => comet.active && comet.visibleOnScreen).length >= 2) {
    systemReporter.intro("comets");
  }
  if (diskAgeSeconds >= nextRogueAt && roguePlanets.length < MAX_ROGUE_PLANETS) {
    addRoguePlanet(view);
    nextRogueAt = diskAgeSeconds + random(...VISITOR_ARRIVAL_INTERVAL);
  }
  if (nextCometAt === null && roguePlanets.some(body => body.hasEnteredScreen)) {
    nextCometAt = diskAgeSeconds + COMET_ARRIVAL_DELAY_SECONDS;
  }
  if (nextCometAt !== null && diskAgeSeconds >= nextCometAt
    && comets.filter(comet => comet.active).length < MAX_COMETS) {
    addComet(view);
    nextCometAt = diskAgeSeconds + random(...VISITOR_ARRIVAL_INTERVAL);
  }
}

function advanceComets(view, surfaceRadius, planets) {
  const motions = [];
  for (const comet of comets) {
    if (!comet.active) continue;
    const start = comet.position;
    const radius = getCometRadius(comet);
    const cometStep = PHYSICS_STEP * comet.motionRate;
    const impact = stepComet(comet, STAR_MASS, cometStep, surfaceRadius, radius / view.pixelsPerAU, planets);
    comet.trail.push({ ...comet.position, radius, time: diskAgeSeconds });
    if (!impact) {
      motions.push({ comet, start });
      continue;
    }
    comet.active = false;
    if (!impact.planet) continue;
    const { seed } = impact.planet;
    for (let damage = 0; damage < comet.strength; damage++) {
      if (!removePlanetProtection(seed)) {
        destroyPlanet(seed, view);
        // Stop at destruction, even if the comet had damage left over.
        planets.splice(planets.indexOf(impact.planet), 1);
        break;
      }
    }
    if (!seed.isRogue) systemReporter.report(seed.active ? "cometDamage" : "cometDestroyedPlanet");
  }
  mergeTouchingComets(motions, view.pixelsPerAU);
  return motions;
}

function mergeTouchingComets(motions, pixelsPerAU) {
  const contacts = [];
  for (let i = 0; i < motions.length; i++) {
    const { comet: a, start: startA } = motions[i];
    for (let j = i + 1; j < motions.length; j++) {
      const { comet: b, start: startB } = motions[j];
      const fraction = getCircleContactFraction(startA.x - startB.x, startA.y - startB.y,
        a.position.x - b.position.x, a.position.y - b.position.y,
        (getCometRadius(a) + getCometRadius(b)) / pixelsPerAU);
      if (fraction <= 1) contacts.push({ a, b, fraction });
    }
  }
  // Resolve the earliest contacts first. Recheck altered paths on the next step.
  contacts.sort((a, b) => a.fraction - b.fraction);
  const changedPaths = new Set();
  for (const { a, b } of contacts) {
    if (!a.active || !b.active || changedPaths.has(a) || changedPaths.has(b)) continue;
    const [survivor, absorbed] = a.strength >= b.strength ? [a, b] : [b, a];
    if (survivor.strength < MERGED_COMET_STRENGTH) {
      // Only two regular comets combine paths. An existing big comet stays unchanged.
      const firstSpeed = Math.hypot(survivor.velocity.x, survivor.velocity.y);
      const secondSpeed = Math.hypot(absorbed.velocity.x, absorbed.velocity.y);
      const speed = (firstSpeed + secondSpeed) / 2 * MERGED_COMET_SPEED_MULTIPLIER;
      const combinedX = survivor.velocity.x + absorbed.velocity.x;
      const combinedY = survivor.velocity.y + absorbed.velocity.y;
      const combinedSpeed = Math.hypot(combinedX, combinedY);
      // Near head-on, keep the faster comet's direction so they don't stall.
      const fallback = firstSpeed >= secondSpeed ? survivor.velocity : absorbed.velocity;
      const angle = combinedSpeed > (firstSpeed + secondSpeed) * 0.05
        ? Math.atan2(combinedY, combinedX)
        : Math.atan2(fallback.y, fallback.x);
      survivor.velocity.x = Math.cos(angle) * speed;
      survivor.velocity.y = Math.sin(angle) * speed;
      for (const axis of ["x", "y"]) {
        survivor.position[axis] = lerp(survivor.position[axis], absorbed.position[axis], 0.5);
      }
      survivor.strength = MERGED_COMET_STRENGTH;
      survivor.hasEnteredScreen ||= absorbed.hasEnteredScreen;
      changedPaths.add(survivor);
      systemReporter.report("cometMerger");
    }
    absorbed.active = false; // Its existing trail fades normally.
  }
}

function findLaserThreat(shooter, origin, range) {
  let nearest = null;
  let closest = range * range;
  function consider(body, position, targetPlanet = null) {
    const dx = position.x - origin.x;
    const dy = position.y - origin.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > 0 && distanceSquared < closest) {
      closest = distanceSquared;
      nearest = { dx, dy, velocity: body.velocity, motionRate: body.motionRate ?? 1, targetPlanet };
    }
  }
  for (const comet of comets) {
    if (comet.active) consider(comet, comet.position);
  }
  for (const planet of seeds) {
    if (planet.active && !planet.isRogue && planet !== shooter) {
      consider(planet, getSeedDisplayPosition(planet), planet);
    }
  }
  return nearest;
}

function firePlanetLasers(view) {
  const range = Math.min(LASER_RANGE_PIXELS, Math.min(width, height) * 0.3) / view.pixelsPerAU;
  const speed = LASER_SPEED_PIXELS_PER_SECOND / view.pixelsPerAU;
  for (const planet of seeds) {
    if (!planet.active || !planet.laserDefense || diskAgeSeconds < planet.nextLaserShotAt) continue;
    const origin = getSeedDisplayPosition(planet);
    const threat = findLaserThreat(planet, origin, range);
    if (!threat) continue;
    // Lead moving targets a little. Once fired, the shot flies straight.
    const lead = Math.min(0.8, Math.hypot(threat.dx, threat.dy) / speed)
      * YEARS_PER_SECOND * threat.motionRate;
    const aimX = threat.dx + threat.velocity.x * lead;
    const aimY = threat.dy + threat.velocity.y * lead;
    const angle = aimX === 0 && aimY === 0
      ? Math.atan2(threat.dy, threat.dx)
      : Math.atan2(aimY, aimX);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const offset = (getSeedRadius(planet, view.radius) + LASER_SHOT_RADIUS) / view.pixelsPerAU;
    laserShots.push({
      shooter: planet,
      position: { x: origin.x + dx * offset, y: origin.y + dy * offset },
      dx, dy, speed,
      colour: getSeedAppearance(planet).colour.join(","),
      expiresAt: diskAgeSeconds + LASER_SHOT_LIFETIME_SECONDS,
    });
    // A fight needs actual shots aimed both ways, not just two nearby armed planets.
    const target = threat.targetPlanet;
    if (target?.lastLaserTarget === planet
      && diskAgeSeconds - target.lastLaserShotAt <= LASER_SHOT_LIFETIME_SECONDS) {
      systemReporter.report("planetLaserExchange");
    }
    planet.lastLaserTarget = target;
    planet.lastLaserShotAt = diskAgeSeconds;
    planet.nextLaserShotAt = diskAgeSeconds + LASER_SHOT_INTERVAL_SECONDS;
  }
}

function cometThreatensPlanet(comet, planet, view, surfaceRadius) {
  if (!planet.active) return false;
  // Only report a save if a short projection puts the comet on course for its shooter.
  const origin = getSeedDisplayPosition(planet);
  const lookahead = 2 * YEARS_PER_SECOND;
  const endX = comet.position.x + comet.velocity.x * comet.motionRate * lookahead;
  const endY = comet.position.y + comet.velocity.y * comet.motionRate * lookahead;
  const coreRadius = getCometRadius(comet) / view.pixelsPerAU;
  const contact = getCircleContactFraction(
    comet.position.x - origin.x, comet.position.y - origin.y,
    endX - origin.x - planet.velocity.x * lookahead,
    endY - origin.y - planet.velocity.y * lookahead,
    coreRadius + getSeedRadius(planet, view.radius) / view.pixelsPerAU,
  );
  const starContact = getCircleContactFraction(comet.position.x, comet.position.y, endX, endY,
    surfaceRadius + coreRadius);
  return contact <= 1 && contact < starContact;
}

function advanceLaserShots(view, surfaceRadius, planets, cometMotions) {
  const dt = PHYSICS_STEP / YEARS_PER_SECOND;
  const shotRadius = LASER_SHOT_RADIUS / view.pixelsPerAU;
  const cometTargets = cometMotions.filter(({ comet }) => comet.active).map(({ comet, start }) => ({
    comet, start, end: comet.position, radius: getCometRadius(comet) / view.pixelsPerAU,
  }));
  laserShots = laserShots.filter(shot => {
    if (diskAgeSeconds >= shot.expiresAt) return false;
    const start = shot.position;
    const end = { x: start.x + shot.dx * shot.speed * dt, y: start.y + shot.dy * shot.speed * dt };
    let fraction = getCircleContactFraction(start.x, start.y, end.x, end.y, surfaceRadius + shotRadius);
    let hit = null;
    function consider(target) {
      const contact = getCircleContactFraction(start.x - target.start.x, start.y - target.start.y,
        end.x - target.end.x, end.y - target.end.y, target.radius + shotRadius);
      if (contact < fraction) {
        fraction = contact;
        hit = target;
      }
    }
    for (const target of cometTargets) {
      if (target.comet.active) consider(target);
    }
    for (const target of planets) {
      if (target.seed.active && target.seed !== shot.shooter) consider(target);
    }
    if (fraction <= 1) {
      if (hit?.comet) {
        hit.comet.active = false;
        if (systemReporter.canReport("interceptedComet")
          && cometThreatensPlanet(hit.comet, shot.shooter, view, surfaceRadius)) {
          systemReporter.report("interceptedComet");
        }
      } else if (hit?.seed && (hit.seed.isRogue || !removePlanetProtection(hit.seed))) {
        destroyPlanet(hit.seed, view);
        if (!hit.seed.isRogue) systemReporter.report("planetShotDown");
      }
      return false;
    }
    shot.position = end;
    return true;
  });
}

function advanceOrbit(frameSeconds) {
  // Fixed physics steps keep the orbits independent of drawing speed.
  timeAccumulator += frameSeconds * YEARS_PER_SECOND;
  const view = getSpaceView();
  const surfaceRadius = view.radius / view.pixelsPerAU;
  const heatRadius = getDustHeatRadius(view);
  const dustExitRadius = Math.hypot(Math.max(view.x, width - view.x),
    Math.max(view.y, height - view.y)) / view.pixelsPerAU;
  while (timeAccumulator + 1e-12 >= PHYSICS_STEP) {
    diskAgeSeconds += PHYSICS_STEP / YEARS_PER_SECOND;
    const clearing = Math.max(0, Math.min(1,
      (diskAgeSeconds - DISK_CLEARING_START_SECONDS)
        / (DISK_CLEARING_END_SECONDS - DISK_CLEARING_START_SECONDS)));
    const gasAmount = 1 - smoothProgress(clearing);
    const hasActiveComets = comets.some(comet => comet.active);
    const planetStarts = hasActiveComets || laserShots.length > 0
      ? seeds.filter(seed => seed.active).map(seed => ({ seed, start: { ...getSeedDisplayPosition(seed) } }))
      : null;
    // Real mass-scaled mutual gravity, separate from the exaggerated dust pull.
    // The star remains fixed; visible contact merges seeds, with no seed gas drag.
    stepSeeds(seeds, STAR_MASS, PHYSICS_STEP, surfaceRadius,
      () => mergeTouchingSeeds(view), seed => destroyPlanet(seed, view));
    if (planetStarts) {
      const planets = planetStarts.filter(({ seed }) => seed.active).map(({ seed, start }) => ({
        seed, start, end: getSeedDisplayPosition(seed), mass: getSeedMass(seed),
        radius: getSeedRadius(seed, view.radius) / view.pixelsPerAU,
      }));
      const cometMotions = hasActiveComets ? advanceComets(view, surfaceRadius, planets) : [];
      if (laserShots.length > 0) advanceLaserShots(view, surfaceRadius, planets, cometMotions);
    }
    const attractors = seeds.filter(seed => seed.active).map(seed => ({
      position: seed.position,
      materialRatio: seed.visibleMaterial / SEED_STARTING_MATERIAL,
    }));
    const hasDust = dustParticles.some(particle => particle.remaining > 0);
    for (const particle of dustParticles) {
      if (particle.remaining <= 0) continue;
      if (diskAgeSeconds >= particle.departureStart) {
        moveDepartingDust(particle, dustExitRadius);
        if (particle.remaining > 0) collectDust(particle, view.pixelsPerAU, view.radius);
        continue;
      }
      if (!stepOrbitingBody(particle, STAR_MASS, PHYSICS_STEP, surfaceRadius, true, attractors, gasAmount)) {
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
      if (!seed.active || seed.isRogue) continue;
      updatePlanetEvolution(seed);
      if (hasDust) seed.visibleMaterial += (seed.dustMaterial - seed.visibleMaterial) * growthBlend;
      const colourTarget = seed.collected >= SEED_COLOUR_THRESHOLD ? 1 : 0;
      seed.colourProgress += (colourTarget - seed.colourProgress) * colourBlend;
    }
    firePlanetLasers(view);
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

function smoothProgress(amount) {
  const progress = Math.max(0, Math.min(1, amount));
  return progress * progress * (3 - 2 * progress);
}

function moveDepartingDust(particle, exitRadius) {
  // Clear on loose outward arcs, with no slowdown or waypoints at the screen edges.
  const exitDistance = exitRadius * particle.departureReach;
  if (!particle.departure) {
    const { x, y } = particle.position;
    const radius = Math.max(0.000001, Math.hypot(x, y));
    particle.departure = {
      radius,
      angle: Math.atan2(y, x),
      angularSpeed: (x * particle.velocity.y - y * particle.velocity.x) / radius ** 2 * YEARS_PER_SECOND,
      startedAt: diskAgeSeconds,
      exitDistance: Math.max(radius + 1, exitDistance),
    };
  }
  const path = particle.departure;
  path.exitDistance = Math.max(path.exitDistance, exitDistance);
  const elapsed = diskAgeSeconds - path.startedAt;
  const progress = Math.min(1, elapsed / (particle.departureEnd - path.startedAt));
  const drift = progress * progress * (0.55 + 0.45 * progress);
  const radius = path.radius + (path.exitDistance - path.radius) * drift;
  const angle = path.angle + path.angularSpeed * elapsed * (1 - 0.5 * progress);
  particle.position.x = Math.cos(angle) * radius;
  particle.position.y = Math.sin(angle) * radius;
  if (progress >= 1) particle.remaining = 0;
}

function getDustHeatRadius(view) {
  // A deliberately simplified heat zone, not a calculated sublimation temperature.
  // Brighter, higher-mass stars clear dust farther out. Gas is not rendered.
  return Math.max(view.radius / view.pixelsPerAU * 2, 0.12 * STAR_MASS ** 1.75);
}

function getPlanetSizeProtectionProgress(seed) {
  const transition = seed.sizeProtection;
  if (!transition) return 0;
  const blend = smoothProgress((diskAgeSeconds - transition.startedAt) / PLANET_SIZE_TRANSITION_SECONDS);
  const target = transition.active ? 1 : 0;
  return transition.from + (target - transition.from) * blend;
}

function setPlanetSizeProtection(seed, active) {
  seed.sizeProtection = { active, from: getPlanetSizeProtectionProgress(seed), startedAt: diskAgeSeconds };
  seed.lifeReadyAt = active ? diskAgeSeconds + PLANET_LIFE_WAIT_SECONDS : null;
}

function addPlanetProtection(seed) {
  if (seed.isRogue) return;
  seed.moons ??= [];
  if (seed.moons.length < MAX_MOONS) {
    seed.moons.push({ angle: random(TWO_PI), startedAt: diskAgeSeconds });
    return "moon";
  }
  if (!seed.hasRings) {
    seed.hasRings = true;
    return "rings";
  }
  if (!seed.sizeProtection?.active) {
    setPlanetSizeProtection(seed, true);
    return "sizeBoost";
  }
}

function updatePlanetEvolution(seed) {
  if (seed.lifeReadyAt != null && diskAgeSeconds >= seed.lifeReadyAt) {
    seed.lifeReadyAt = null;
    seed.lifeStartedAt = diskAgeSeconds;
    seed.laserReadyAt = diskAgeSeconds + PLANET_LASER_WAIT_SECONDS;
    systemReporter.report("life");
  }
  if (seed.laserReadyAt != null && diskAgeSeconds >= seed.laserReadyAt) {
    seed.laserReadyAt = null;
    seed.laserDefense = true;
    seed.nextLaserShotAt = diskAgeSeconds;
    systemReporter.report("lasers");
  }
}

function removePlanetProtection(seed) {
  if (seed.laserDefense) {
    seed.laserDefense = false;
    seed.laserReadyAt = diskAgeSeconds + PLANET_LASER_WAIT_SECONDS;
    systemReporter.report("laserTechDamaged");
  } else if (seed.lifeStartedAt != null) {
    seed.lifeStartedAt = null;
    seed.laserReadyAt = null;
    seed.lifeReadyAt = diskAgeSeconds + PLANET_LIFE_WAIT_SECONDS;
  } else if (seed.sizeProtection?.active) {
    setPlanetSizeProtection(seed, false);
  } else if (seed.hasRings) {
    seed.hasRings = false;
  } else if (seed.moons?.length) {
    seed.moons.pop();
  } else {
    return false;
  }
  return true;
}

function getPlanetProtectionCount(seed) {
  return (seed.moons?.length ?? 0) + Number(Boolean(seed.hasRings))
    + Number(Boolean(seed.sizeProtection?.active)) + Number(seed.lifeStartedAt != null)
    + Number(Boolean(seed.laserDefense));
}

function getSeedRadius(seed, starRadius) {
  if (seed.isRogue) return starRadius * ROGUE_STAR_SIZE_RATIO;
  // Cube-root scaling is a simple common-density assumption, not a composition model.
  // Give collected dust a small visual boost without changing its physical mass.
  const acquired = Math.max(0, seed.visibleMaterial - SEED_STARTING_MATERIAL) * SEED_DUST_VISUAL_GAIN;
  const visibleEarthMasses = (SEED_STARTING_MATERIAL + acquired) * EARTH_MASSES_PER_MATERIAL_UNIT;
  const massRadius = PLANET_EARTH_MASS_RADIUS * Math.cbrt(visibleEarthMasses) * BODY_VISUAL_SCALE;
  // Start the same size as a dust dot, then smoothly reveal the mass-based scale
  // as it collects its first few bundles of dust.
  const emergence = smoothProgress(acquired / SEED_EMERGENCE_MATERIAL);
  const grownRadius = SEED_DUST_RADIUS + (massRadius - SEED_DUST_RADIUS) * emergence;
  const radius = Math.min(grownRadius, starRadius * SEED_MAX_STAR_RATIO);
  if (!seed.sizeProtection) return radius;
  return radius * (1 + PLANET_SIZE_PROTECTION_BONUS * getPlanetSizeProtectionProgress(seed));
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
    lifeStartedAt: seed.lifeStartedAt,
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
    const radius = Math.min(animation.radius, view.radius * MAX_PROTECTED_STAR_RATIO) * (1 - blend);
    const opacity = animation.opacity * dustOpacity * (1 - smoothProgress((progress - 0.65) / 0.35));
    context.fillStyle = `rgba(${animation.colour.join(",")}, ${opacity})`;
    context.beginPath();
    context.arc(view.x + x * view.pixelsPerAU, view.y + y * view.pixelsPerAU,
      radius, 0, Math.PI * 2);
    context.fill();
  }
}

function firstPlanetSurvives(first, second, firstRadius, secondRadius) {
  if (first.isRogue && second.isRogue) return first.material >= second.material;
  if (first.isRogue || second.isRogue) return !first.isRogue;

  const firstProtection = getPlanetProtectionCount(first);
  const secondProtection = getPlanetProtectionCount(second);
  if (firstProtection !== secondProtection) return firstProtection > secondProtection;
  return firstProtection === 0 ? firstRadius >= secondRadius : random() < 0.5;
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
        const bothRogues = first.isRogue && second.isRogue;
        const bothResidents = !first.isRogue && !second.isRogue;
        const firstSurvives = firstPlanetSurvives(first, second, firstRadius, secondRadius);
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
        const protection = addPlanetProtection(survivor);
        if (bothResidents && protection === "moon" && dustParticles.some(particle => particle.remaining > 0)) {
          systemReporter.report("dustMoonMerger");
        } else {
          if (bothResidents) systemReporter.report("planetMerger");
          if (protection) systemReporter.report(protection);
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
  // Heat loss reduces the material contributed; outward drift does not.
  collector.material += particle.remaining;
  collector.dustMaterial += particle.remaining;
  collector.collected++;
  particle.remaining = 0;
  // This first growth test transfers material without changing the seed's velocity.
}

function getSpaceView() {
  // Centre the system in the canvas above the console.
  const availableSpace = Math.min(width, height);
  const basePixelsPerAU = Math.max(12, Math.min(112, availableSpace * 0.144));
  const baseRadius = Math.min(100, availableSpace * 0.16) * STAR_DISPLAY_FACTOR / 2.5 * BODY_VISUAL_SCALE;
  const heatRadius = Math.max(baseRadius / basePixelsPerAU * 2, 0.12 * STAR_MASS ** 1.75);
  const seedOrbitBase = Math.max(1.3, heatRadius * 1.25 + 0.15);
  // Keep the camera framed the same as the original 1× Sun preview.
  const cameraReferenceMass = 5;
  const maxBaseRadius = Math.min(100, availableSpace * 0.16) / 2.5 * CAMERA_REFERENCE_BODY_SCALE;
  const maxHeatRadius = Math.max(maxBaseRadius / basePixelsPerAU * 2, 0.12 * cameraReferenceMass ** 1.75);
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
    x: width / 2,
    y: height / 2,
    pixelsPerAU,
    radius,
    innerSeedOrbit: seedOrbitBase * SEED_INNER_ORBIT_FACTOR,
    outerSeedOrbit,
  };
}

function createDustParticle(position) {
  const distance = Math.hypot(position.x, position.y);
  const angle = Math.atan2(position.y, position.x);
  const circularSpeed = Math.sqrt(GRAVITY * STAR_MASS / distance);
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
  // Stagger both ends of the outward drift so the disk never moves as one sheet.
  const departureStart = random(DISK_CLEARING_START_SECONDS, LAST_DUST_DEPARTURE_START_SECONDS);
  const departureEnd = random(Math.max(60, departureStart + 18), DISK_CLEARING_END_SECONDS);
  return {
    position,
    velocity,
    size,
    dragCoupling,
    opacity: random(0.25, 0.75),
    remaining: 1,
    departureStart,
    departureEnd,
    departureReach: random(1.03, 1.16),
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

function drawComets(context, x, y, pixelsPerAU) {
  for (const comet of comets) {
    for (const point of comet.trail) {
      const remaining = 1 - (diskAgeSeconds - point.time) / COMET_TRAIL_SECONDS;
      context.fillStyle = `rgba(${COMET_COLOUR}, ${0.6 * remaining ** 2})`;
      context.beginPath();
      context.arc(x + point.x * pixelsPerAU, y + point.y * pixelsPerAU,
        point.radius * remaining, 0, Math.PI * 2);
      context.fill();
    }
    if (comet.active) {
      context.fillStyle = `rgb(${COMET_COLOUR})`;
      context.beginPath();
      context.arc(x + comet.position.x * pixelsPerAU, y + comet.position.y * pixelsPerAU,
        getCometRadius(comet), 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawLaserShots(context, view) {
  if (!laserShots.length) return;
  context.save();
  context.lineWidth = LASER_SHOT_RADIUS * 2;
  context.lineCap = "round";
  for (const shot of laserShots) {
    const x = view.x + shot.position.x * view.pixelsPerAU;
    const y = view.y + shot.position.y * view.pixelsPerAU;
    const opacity = smoothProgress((shot.expiresAt - diskAgeSeconds) / LASER_SHOT_FADE_SECONDS);
    context.strokeStyle = `rgba(${shot.colour}, ${opacity})`;
    context.beginPath();
    context.moveTo(x - shot.dx * 7, y - shot.dy * 7);
    context.lineTo(x, y);
    context.stroke();
  }
  context.restore();
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

function drawPlanetLifeGlow(context, x, y, radius, colour, opacity, startedAt) {
  if (radius <= 0 || opacity <= 0) return;
  const phase = (diskAgeSeconds - startedAt) / PLANET_LIFE_PULSE_SECONDS * TWO_PI;
  const pulse = (1 - Math.cos(phase)) / 2;
  const haloRadius = radius * (1.8 + 0.55 * pulse);
  const glow = context.createRadialGradient(x, y, radius * 0.7, x, y, haloRadius);
  const rgb = colour.join(",");
  glow.addColorStop(0, `rgba(${rgb}, ${opacity * (0.24 + 0.46 * pulse)})`);
  glow.addColorStop(1, `rgba(${rgb}, 0)`);
  context.fillStyle = glow;
  context.fillRect(x - haloRadius, y - haloRadius, haloRadius * 2, haloRadius * 2);
}

function drawPlanetBody(context, x, y, radius, appearance, planet, visibility) {
  const opacity = appearance.opacity * visibility;
  if (planet.lifeStartedAt != null) {
    drawPlanetLifeGlow(context, x, y, radius, appearance.colour, opacity, planet.lifeStartedAt);
  }
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
    const radius = Math.min(planet.radius, view.radius * MAX_PROTECTED_STAR_RATIO);
    drawPlanetBody(context, x, y, radius, planet.appearance, planet, visibility * (1 - smoothProgress(progress)));
  }
}

function drawStar(context, { x, y, radius }) {
  const rgb = STAR_COLOUR;
  const brightness = STAR_GLOW;

  // Draw a soft halo around the star.
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
}

function drawSpaceBodies(context, view, dustOpacity) {
  const { x, y, radius, pixelsPerAU } = view;
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
  drawLaserShots(context, view);
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
        // Reveal only the part that has crossed into the simulation area.
        context.save();
        context.beginPath();
        context.rect(left, top, right - left, bottom - top);
        context.clip();
      }
    }
    drawPlanetBody(context, seedX, seedY, seedRadius, getSeedAppearance(seed), seed, dustOpacity);
    if (seed.entering) context.restore();
  }
}

function reportFormationMessages(view) {
  const first = !systemReporter.hasSeenIntro("firstPlanets");
  const clearing = diskAgeSeconds >= DUST_CLEARING_REPORT_SECONDS
    && diskAgeSeconds < DISK_CLEARING_END_SECONDS
    && !systemReporter.hasSeenIntro("dustClearing");
  if (!first && !clearing) return;
  const visible = seeds.filter(seed => {
    if (!seed.active || seed.isRogue || seed.colourProgress < 0.25) return false;
    const position = getSeedDisplayPosition(seed);
    const x = view.x + position.x * view.pixelsPerAU;
    const y = view.y + position.y * view.pixelsPerAU;
    return x >= 0 && x <= width && y >= 0 && y <= height;
  });
  if (first && visible.length >= 3) systemReporter.intro("firstPlanets");
  if (clearing && visible.length >= 2) systemReporter.intro("dustClearing");
}

function draw() {
  if (isPlaying) {
    const now = performance.now();
    // Limit catch-up after a stall instead of making the simulation jump ahead.
    const frameSeconds = Math.min((now - lastFrameTime) / 1000, 0.25);
    advanceOrbit(frameSeconds);
    dustRevealTime = Math.min(DUST_FADE_SECONDS, dustRevealTime + frameSeconds);
    lastFrameTime = now;
  }
  const view = getSpaceView();
  updateVisitors(view);
  if (isPlaying) {
    reportFormationMessages(view);
    if (diskAgeSeconds >= PLANET_COLOUR_REPORT_SECONDS && dustParticles.length > 0) {
      systemReporter.intro("planetColours");
    }
    systemReporter.update(diskAgeSeconds);
  }
  background("#0b0d16");
  if (view.radius <= 0) return;

  // Fade reveals material that's already moving.
  const dustOpacity = smoothProgress(dustRevealTime / DUST_FADE_SECONDS);
  const context = drawingContext;
  if (dustOpacity > 0) drawSpaceBodies(context, view, dustOpacity);
  // Draw the star last, so bodies and their fade animations pass behind it.
  drawStar(context, view);
}
