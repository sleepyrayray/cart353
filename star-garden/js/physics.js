// Distances use AU, masses use Sun masses, and time uses years.
// G = 4π² makes a small body at 1 AU orbit a 1-Sun-mass star in about a year.
const GRAVITY = 4 * Math.PI ** 2;
const PHYSICS_STEP = 1 / 480;
const YEARS_PER_SECOND = 1 / 8;

// Tuned for a visible transition, not measured gas density or real grain sizes.
const GAS_DRAG_RATE = 1.4;
const GAS_DENSITY_SCALE = 5;
const GAS_ORBIT_SPEED = 0.98;

// Exaggerated seed attraction for this visual model, not a calibrated planet mass.
const SEED_INITIAL_PULL = 0.08;
const SEED_MAX_PULL = 0.4;
const SEED_MAX_ACCELERATION = 4;
const SEED_PULL_SOFTENING = 0.06;

function applyGasDrag(body, starMass, timeStep, gasAmount = 1) {
  const distance = Math.max(0.000001, Math.hypot(body.position.x, body.position.y));
  const gasSpeed = GAS_ORBIT_SPEED * Math.sqrt(GRAVITY * starMass / distance);
  // Canvas y points down, so this tangent rotates clockwise on screen.
  const gasVelocityX = -body.position.y / distance * gasSpeed;
  const gasVelocityY = body.position.x / distance * gasSpeed;
  // An assumed gas disk extends smoothly outward, with weaker drag farther away.
  // Smaller visual grains couple more strongly; there is no dust-to-dust force.
  const rate = GAS_DRAG_RATE * Math.exp(-distance / GAS_DENSITY_SCALE) / body.size * gasAmount;
  // Exact relaxation for a locally fixed flow prevents overshooting its velocity.
  const blend = -Math.expm1(-rate * timeStep);
  body.velocity.x += (gasVelocityX - body.velocity.x) * blend;
  body.velocity.y += (gasVelocityY - body.velocity.y) * blend;
}

function getGravityAcceleration(position, starMass, attractors = []) {
  const distance = Math.max(0.000001, Math.hypot(position.x, position.y));
  const strength = -GRAVITY * starMass / distance ** 3;
  const acceleration = { x: position.x * strength, y: position.y * strength };
  for (const attractor of attractors) {
    const dx = attractor.position.x - position.x;
    const dy = attractor.position.y - position.y;
    const separation = Math.hypot(dx, dy);
    if (separation > 0) {
      // Pull and reach increase smoothly with acquired material, then level off.
      const growth = Math.max(0, attractor.materialRatio - 1);
      const amount = growth / (growth + 4);
      const pull = SEED_INITIAL_PULL + (SEED_MAX_PULL - SEED_INITIAL_PULL) * amount;
      const reach = 0.45 + 0.35 * amount;
      const softened = separation ** 2 + SEED_PULL_SOFTENING ** 2;
      const force = Math.min(SEED_MAX_ACCELERATION, pull * separation / softened ** 1.5)
        * Math.exp(-((separation / reach) ** 4));
      // Local, smoothly fading deflection; never teleport dust or mark it collected.
      acceleration.x += dx / separation * force;
      acceleration.y += dy / separation * force;
    }
  }
  return acceleration;
}

function stepOrbitingBody(body, starMass, timeStep, surfaceRadius, useGasDrag = true, attractors = [], gasAmount = 1) {
  // Split gas drag around the gravity step; gravity still uses Velocity Verlet.
  // Gas is an assumed background flow, not a full fluid or N-body simulation.
  const startX = body.position.x;
  const startY = body.position.y;
  if (Math.hypot(startX, startY) <= surfaceRadius) return false;
  if (useGasDrag) applyGasDrag(body, starMass, timeStep / 2, gasAmount);
  const before = getGravityAcceleration(body.position, starMass, attractors);
  body.position.x += body.velocity.x * timeStep + 0.5 * before.x * timeStep ** 2;
  body.position.y += body.velocity.y * timeStep + 0.5 * before.y * timeStep ** 2;

  // Absorb surface crossings before evaluating gravity near the central singularity.
  const dx = body.position.x - startX;
  const dy = body.position.y - startY;
  const lengthSquared = dx * dx + dy * dy;
  const closest = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    -(startX * dx + startY * dy) / lengthSquared));
  if (Math.hypot(startX + closest * dx, startY + closest * dy) <= surfaceRadius) return false;

  const after = getGravityAcceleration(body.position, starMass, attractors);
  body.velocity.x += 0.5 * (before.x + after.x) * timeStep;
  body.velocity.y += 0.5 * (before.y + after.y) * timeStep;
  if (useGasDrag) applyGasDrag(body, starMass, timeStep / 2, gasAmount);
  return true;
}
