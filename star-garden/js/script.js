const starSettings = {
  mass: 1,
  heavyElements: 1,
};

const MAX_DUST_COUNT = 4500;
const DUST_FADE_SECONDS = 1.2;
// Shared display scale for the star and seeds, not a change to their masses.
const BODY_VISUAL_SCALE = 1.5;
const SEED_STARTING_MATERIAL = 4;
const SEED_VISUAL_GROWTH = 2.5;
const SEED_GROWTH_SECONDS = 2;
const SEED_MAX_STAR_RATIO = 0.5;
const SEED_COLOUR_THRESHOLD = 7;
const MAX_SEEDS = 10;
const SEED_OUTER_ORBIT_FACTOR = 2;
// Mild ovalness for variety, not a measured distribution of young planets.
const SEED_MIN_ECCENTRICITY = 0.03;
const SEED_MAX_ECCENTRICITY = 0.18;
const planetColours = [[121, 165, 191], [180, 122, 100], [128, 158, 125], [160, 137, 182]];
// Compressed disk evolution for the experience, not real astronomical timescales.
const DISK_CLEARING_START_SECONDS = 90;
const DISK_CLEARING_DURATION_SECONDS = 90;
const LAST_DUST_DEPARTURE_SECONDS = 160;

let dustParticles = [];
let seeds = [];
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
  pixelDensity(min(displayDensity(), 2));
  noLoop();

  document.getElementById("mass").addEventListener("input", updateStarSettings);
  document.getElementById("heavy-elements").addEventListener("input", updateStarSettings);
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
  const previousComposition = starSettings.heavyElements;
  starSettings.mass = Number(document.getElementById("mass").value);
  starSettings.heavyElements = Number(document.getElementById("heavy-elements").value);

  document.getElementById("mass-value").textContent = `${starSettings.mass.toFixed(1)}× Sun`;
  document.getElementById("heavy-elements-value").textContent = `${starSettings.heavyElements.toFixed(1)}× Sun`;

  const description = getStarDescription(starSettings.mass, starSettings.heavyElements);
  document.getElementById("star-description").textContent = description;
  describe(`${description} Mass is ${starSettings.mass.toFixed(1)} times the Sun's. Composition is ${starSettings.heavyElements.toFixed(1)} times the Sun's reference abundance. Each reset creates between one and ten seeds with evenly spaced orbit sizes and slightly oval, differently oriented paths. Some paths can cross, but collisions are not forced. Press Play to reveal the finite dust supply and seeds, which initially look like the other particles. Each seed gently attracts nearby dust and grows by collecting dust that touches it. Their pull on dust strengthens with growth but is capped. Seeds gravitationally affect each other's orbits using masses based on collected material, while the star stays fixed. Seeds merge when their visible edges touch, combining mass and momentum with smooth, capped visual growth. From one minute thirty seconds, remaining dust departs outward at varied times, leaving the screen by three minutes as gas drag weakens. Dust can also escape or fade near the star. Reset starts fresh. Visible sizes, dust attraction, clearing motion, and time are exaggerated.`);

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
  const view = getSpaceView();
  // Generate the complete material supply once. Nothing replenishes it mid-run.
  dustParticles = createDustCloud(view);
  diskAgeSeconds = 0;
  updateElapsedTime();
  const startingPhase = random(TWO_PI);
  const seedCount = Math.floor(random(1, MAX_SEEDS + 1));
  seeds = Array.from({ length: seedCount }, (_, index) => {
    // Equal semi-major-axis gaps; actual distances vary along the oval orbits.
    // A single seed starts with an orbit size midway through the same range.
    const fraction = seedCount === 1 ? 0.5 : index / (seedCount - 1);
    const factor = 1 + fraction * (SEED_OUTER_ORBIT_FACTOR - 1);
    const semiMajorAxis = view.seedOrbitBase * factor;
    const phase = startingPhase + index * TWO_PI / seedCount;
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
      size: random(1.1, 1.5),
      opacity: random(0.45, 0.65),
      planetColour: random(planetColours),
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
  // Exaggerated cube-root visual growth, capped below the displayed star's size.
  // This is a display mapping, not a physical radius or density calculation.
  const acquired = seed.visibleMaterial - SEED_STARTING_MATERIAL;
  const grownRadius = seed.size * Math.cbrt(1 + acquired * SEED_VISUAL_GROWTH) * BODY_VISUAL_SCALE;
  return Math.min(grownRadius, starRadius * SEED_MAX_STAR_RATIO);
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
  // Fit the largest supported system at every mass, rather than zooming out as
  // mass increases. Otherwise the camera can make a growing star appear to shrink.
  const maxMass = starColours[starColours.length - 1].mass;
  const maxBaseRadius = Math.min(100, availableSpace * 0.16) / 2.5 * BODY_VISUAL_SCALE;
  const maxHeatRadius = Math.max(maxBaseRadius / basePixelsPerAU * 2, 0.12 * maxMass ** 1.75);
  const maxSeedOrbitBase = Math.max(1.3, maxHeatRadius * 1.25 + 0.15);
  // Include the farthest point of the most oval starting orbit in the camera fit.
  const outerOrbit = maxSeedOrbitBase * SEED_OUTER_ORBIT_FACTOR
    * (1 + SEED_MAX_ECCENTRICITY) * 1.04;
  const pixelsPerAU = Math.max(1, Math.min(basePixelsPerAU, availableSpace * 0.4 / outerOrbit));
  return {
    x: (left + width) / 2,
    y: (top + bottom) / 2,
    pixelsPerAU,
    radius: baseRadius * pixelsPerAU / basePixelsPerAU,
    seedOrbitBase,
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
  const count = Math.min(MAX_DUST_COUNT, Math.round(referenceCount * (1.5 + starSettings.heavyElements)));
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
    const seedOpacity = seed.opacity + (1 - seed.opacity) * acquired / (acquired + 12);
    const dustColour = [218, 204, 181];
    const seedColour = dustColour.map((channel, index) =>
      Math.round(channel + (seed.planetColour[index] - channel) * seed.colourProgress)
    );
    context.fillStyle = `rgba(${seedColour.join(",")}, ${seedOpacity * dustOpacity})`;
    context.beginPath();
    context.arc(seedX, seedY, seedRadius, 0, Math.PI * 2);
    context.fill();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Resizing changes the view only; it must never introduce extra material.
  redraw();
}
