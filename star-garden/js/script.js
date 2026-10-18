const starSettings = {
  mass: 1,
  heavyElements: 1,
};

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
  updateStarSettings();
}

function updateStarSettings() {
  starSettings.mass = Number(document.getElementById("mass").value);
  starSettings.heavyElements = Number(document.getElementById("heavy-elements").value);

  document.getElementById("mass-value").textContent = `${starSettings.mass.toFixed(1)}× Sun`;
  document.getElementById("heavy-elements-value").textContent = `${starSettings.heavyElements.toFixed(1)}× Sun`;

  const description = getStarDescription(starSettings.mass, starSettings.heavyElements);
  document.getElementById("star-description").textContent = description;
  describe(`${description} Mass is ${starSettings.mass.toFixed(1)} times the Sun's. Composition is ${starSettings.heavyElements.toFixed(1)} times the Sun's dust abundance. The star's appearance is simplified.`);
  redraw();
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
  background("#0b0d16");

  // Keep the preview clear of the controls on desktop and smaller screens.
  const panel = document.querySelector(".controls").getBoundingClientRect();
  const header = document.querySelector(".intro").getBoundingClientRect();
  const compact = width <= 640;
  const left = compact ? 0 : panel.right;
  const top = compact ? header.bottom : 0;
  const bottom = compact ? panel.top : height;
  const availableSpace = max(0, min(width - left, bottom - top));
  const x = (left + width) / 2;
  const y = (top + bottom) / 2;

  const amount = (starSettings.mass - 0.2) / 4.8;
  const radius = min(100, availableSpace * 0.16) * (0.3 + 0.7 * pow(amount, 0.6));
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
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
