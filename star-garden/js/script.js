const starSettings = {
  mass: 1,
  heavyElements: 1,
};

const MAX_DUST_COUNT = 3000;
const DUST_FADE_SECONDS = 1.2;

let dustParticles = [];
let dustBounds;
let dustDensity = 0;
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
  starSettings.mass = Number(document.getElementById("mass").value);
  starSettings.heavyElements = Number(document.getElementById("heavy-elements").value);

  document.getElementById("mass-value").textContent = `${starSettings.mass.toFixed(1)}× Sun`;
  document.getElementById("heavy-elements-value").textContent = `${starSettings.heavyElements.toFixed(1)}× Sun`;

  const description = getStarDescription(starSettings.mass, starSettings.heavyElements);
  document.getElementById("star-description").textContent = description;
  describe(`${description} Mass is ${starSettings.mass.toFixed(1)} times the Sun's. Composition is ${starSettings.heavyElements.toFixed(1)} times the Sun's reference abundance. Press Play to reveal orbiting and drifting dust across the screen. Invisible clockwise-moving gas gradually changes the dust's motion through drag. Some dust can escape or fade near the star. Reset hides the dust again. Visible sizes and time are exaggerated.`);

  if (!dustBounds || starSettings.mass !== previousMass) resetOrbit();
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
  dustParticles = [];
  dustBounds = undefined;
  const view = getSpaceView();
  // Fixed world-space density; the rectangle extends beyond every screen edge.
  dustDensity = view.pixelsPerAU ** 2 / 1300;
  extendDustCloud(view);
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
  // A deliberately simplified heat zone, not a calculated sublimation temperature.
  // Brighter, higher-mass stars clear dust farther out. Gas is not rendered.
  const heatRadius = Math.max(surfaceRadius * 2, 0.12 * starSettings.mass ** 1.75);
  while (timeAccumulator + 1e-12 >= PHYSICS_STEP) {
    for (const particle of dustParticles) {
      if (particle.remaining <= 0) continue;
      if (!stepOrbitingBody(particle, starSettings.mass, PHYSICS_STEP, surfaceRadius)) {
        particle.remaining = 0;
        continue;
      }
      const distance = Math.hypot(particle.position.x, particle.position.y);
      const heat = Math.max(0, 1 - distance / heatRadius);
      particle.remaining = Math.max(0, particle.remaining - heat * PHYSICS_STEP / YEARS_PER_SECOND / 0.6);
    }
    timeAccumulator = Math.max(0, timeAccumulator - PHYSICS_STEP);
  }
  dustParticles = dustParticles.filter(particle => particle.remaining > 0);
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
  return {
    x: (left + width) / 2,
    y: (top + bottom) / 2,
    pixelsPerAU: Math.max(12, Math.min(112, availableSpace * 0.144)),
    radius: Math.min(100, availableSpace * 0.16) * (0.3 + 0.7 * amount ** 0.6) / 2.5,
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
  return {
    position,
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    size: random(0.7, 1.5),
    opacity: random(0.25, 0.75),
    remaining: 1,
  };
}

function extendDustCloud(view) {
  const padding = Math.max(width, height) * 0.5;
  const requested = {
    left: (-padding - view.x) / view.pixelsPerAU,
    right: (width + padding - view.x) / view.pixelsPerAU,
    top: (-padding - view.y) / view.pixelsPerAU,
    bottom: (height + padding - view.y) / view.pixelsPerAU,
  };
  const previous = dustBounds;
  const next = previous ? {
    left: Math.min(previous.left, requested.left),
    right: Math.max(previous.right, requested.right),
    top: Math.min(previous.top, requested.top),
    bottom: Math.max(previous.bottom, requested.bottom),
  } : requested;
  // On resize, populate only newly exposed space without moving existing dust.
  const regions = previous ? [
    [next.left, previous.left, next.top, next.bottom],
    [previous.right, next.right, next.top, next.bottom],
    [previous.left, previous.right, next.top, previous.top],
    [previous.left, previous.right, previous.bottom, next.bottom],
  ] : [[next.left, next.right, next.top, next.bottom]];
  for (const [left, right, top, bottom] of regions) {
    const count = Math.min(MAX_DUST_COUNT - dustParticles.length,
      Math.round((right - left) * (bottom - top) * dustDensity));
    for (let i = 0; i < count; i++) {
      const position = { x: random(left, right), y: random(top, bottom) };
      // No solid dust starts inside the exaggerated stellar surface.
      if (Math.hypot(position.x, position.y) <= view.radius / view.pixelsPerAU) continue;
      dustParticles.push(createDustParticle(position));
    }
  }
  dustBounds = next;
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
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (dustBounds) extendDustCloud(getSpaceView());
  redraw();
}
