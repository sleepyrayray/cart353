const starSettings = {
  mass: 1,
  heavyElements: 1,
};

const MAX_DUST_COUNT = 4500;
const DUST_FADE_SECONDS = 1.2;
const SEED_STARTING_MATERIAL = 4;
const SEED_VISUAL_GROWTH = 2.5;
const SEED_GROWTH_SECONDS = 2;
const SEED_MAX_STAR_RATIO = 0.5;
const SEED_COLOUR_THRESHOLD = 10;
const SEED_ORBIT_FACTORS = [1, 1.5, 2];
const planetColours = [[121, 165, 191], [180, 122, 100], [128, 158, 125], [160, 137, 182]];
// Compressed disk evolution for the experience, not real astronomical timescales.
const DISK_CLEARING_START_SECONDS = 60;
const DISK_CLEARING_DURATION_SECONDS = 120;

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
  describe(`${description} Mass is ${starSettings.mass.toFixed(1)} times the Sun's. Composition is ${starSettings.heavyElements.toFixed(1)} times the Sun's reference abundance. Press Play to reveal a finite dust supply and three seeds that initially look like the other particles. Each seed gently attracts nearby dust and grows only by collecting dust that touches it. Their pull strengthens with growth but is capped. Seeds do not pull on or collide with one another. Remaining dust gradually fades out by about three minutes of playback as gas drag weakens, leaving the seeds visible. Dust can also escape or fade near the star. Reset starts fresh. Visible sizes, seed attraction, and time are exaggerated.`);

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
  seeds = SEED_ORBIT_FACTORS.map((factor, index) => {
    const distance = view.seedOrbitBase * factor * random(0.96, 1.04);
    const phase = startingPhase + index * TWO_PI / 3 + random(-0.3, 0.3);
    const speed = Math.sqrt(GRAVITY * starSettings.mass / distance);
    return {
      position: { x: Math.cos(phase) * distance, y: Math.sin(phase) * distance },
      velocity: { x: -Math.sin(phase) * speed, y: Math.cos(phase) * speed },
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
    // Seeds only feel the star: no gas drag, mutual gravity, or mutual collisions.
    for (const seed of seeds) {
      if (seed.active) {
        seed.active = stepOrbitingBody(seed, starSettings.mass, PHYSICS_STEP, surfaceRadius, false);
      }
    }
    const attractors = seeds.filter(seed => seed.active).map(seed => ({
      position: seed.position,
      materialRatio: seed.visibleMaterial / SEED_STARTING_MATERIAL,
    }));
    for (const particle of dustParticles) {
      if (particle.remaining <= 0) continue;
      const progress = (clearing - particle.clearingStart) / (particle.clearingEnd - particle.clearingStart);
      particle.diskFraction = 1 - smoothProgress(progress);
      if (particle.diskFraction <= 0) continue;
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
  dustParticles = dustParticles.filter(particle => particle.remaining > 0 && particle.diskFraction > 0);
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

function getDustHeatRadius(view) {
  // A deliberately simplified heat zone, not a calculated sublimation temperature.
  // Brighter, higher-mass stars clear dust farther out. Gas is not rendered.
  return Math.max(view.radius / view.pixelsPerAU * 2, 0.12 * starSettings.mass ** 1.75);
}

function getSeedRadius(seed, starRadius) {
  // Exaggerated cube-root visual growth, capped below the displayed star's size.
  // This is a display mapping, not a physical radius or density calculation.
  const acquired = seed.visibleMaterial - SEED_STARTING_MATERIAL;
  const grownRadius = seed.size * Math.cbrt(1 + acquired * SEED_VISUAL_GROWTH);
  return Math.min(grownRadius, starRadius * SEED_MAX_STAR_RATIO);
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
  // Material already cleared from a fading bundle cannot also feed the seed.
  collector.material += particle.remaining * particle.diskFraction;
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
  const baseRadius = Math.min(100, availableSpace * 0.16) * (0.3 + 0.7 * amount ** 0.6) / 2.5;
  const heatRadius = Math.max(baseRadius / basePixelsPerAU * 2, 0.12 * starSettings.mass ** 1.75);
  const seedOrbitBase = Math.max(1.3, heatRadius * 1.25 + 0.15);
  // Zoom out as needed to keep even the outer seed's full orbit on screen.
  const outerOrbit = seedOrbitBase * Math.max(...SEED_ORBIT_FACTORS) * 1.04;
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
  // Most material shares a rotation direction. Some has enough speed to pass by.
  // Randomness is assigned once; particles never randomly steer each frame.
  const passing = random() < 0.15 + 0.45 * (1 - Math.exp(-distance / 5));
  const direction = passing ? random(TWO_PI) : angle + HALF_PI + random(-0.08, 0.08);
  const speed = circularSpeed * (passing ? random(1.45, 1.8) : random(0.92, 1.04));
  const clearingStart = random(0, 0.65);
  return {
    position,
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    size: random(0.7, 1.5),
    opacity: random(0.25, 0.75),
    remaining: 1,
    diskFraction: 1,
    // Varied responses to one shared clearing phase, not independent death timers.
    clearingStart,
    // Stagger the final fades near the three-minute mark; no permanent dust remains.
    clearingEnd: random(0.85, 1),
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
    context.fillStyle = `rgba(218, 204, 181, ${particle.opacity * dustOpacity * particle.remaining * particle.diskFraction})`;
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
