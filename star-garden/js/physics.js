// Distances use AU, masses use Sun masses, and time uses years.
// G = 4π² makes a small body at 1 AU orbit a 1-Sun-mass star in about a year.
const GRAVITY = 4 * Math.PI ** 2;
const PHYSICS_STEP = 1 / 480;
const YEARS_PER_SECOND = 1 / 8;

// NASA Sun/Earth mass ratio: https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
const EARTH_MASS_IN_SOLAR_MASSES = 1 / 332900;
// Model resolution: one material bundle is 0.01 Earth masses, not one literal grain.
// Four starting units = 0.04 Earth masses; 100 full bundles add one Earth mass.
const EARTH_MASSES_PER_MATERIAL_UNIT = 0.01;
// Numerical softening in AU, independent of the exaggerated drawing radii.
// https://rebound.hanno-rein.de/simulation/variables/#gravity
const PLANET_GRAVITY_SOFTENING = 0.01;
const PLANET_GRAVITY_SUBSTEPS = 4;
// Stylized one-way pull so flybys are visible at the simulation's display scale.
const COMET_FLYBY_GRAVITY_BOOST = 300;

function getSeedMass(seed) {
  // Use actual acquired material, never the eased visual size or colour milestone.
  return seed.material * EARTH_MASSES_PER_MATERIAL_UNIT * EARTH_MASS_IN_SOLAR_MASSES;
}

function getSeedAccelerations(bodies, starMass) {
  const accelerations = bodies.map(body => body.active
    ? getGravityAcceleration(body.position, starMass) : { x: 0, y: 0 });
  const masses = bodies.map(getSeedMass);
  // Newton: F = G m1 m2 / r²; vector acceleration is G m_other Δr / |Δr|³.
  // https://imagine.gsfc.nasa.gov/observatories/learning/swift/classroom/law_grav_guide.html
  // Evaluate each pair once for equal-and-opposite forces, not equal accelerations.
  for (let i = 0; i < bodies.length; i++) {
    if (!bodies[i].active) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      if (!bodies[j].active) continue;
      const dx = bodies[j].position.x - bodies[i].position.x;
      const dy = bodies[j].position.y - bodies[i].position.y;
      const distanceSquared = dx * dx + dy * dy + PLANET_GRAVITY_SOFTENING ** 2;
      const factor = GRAVITY / distanceSquared ** 1.5;
      accelerations[i].x += factor * masses[j] * dx;
      accelerations[i].y += factor * masses[j] * dy;
      accelerations[j].x -= factor * masses[i] * dx;
      accelerations[j].y -= factor * masses[i] * dy;
    }
  }
  return accelerations;
}

function crossesStellarSurface(startX, startY, position, surfaceRadius) {
  if (Math.hypot(startX, startY) <= surfaceRadius) return true;
  const dx = position.x - startX;
  const dy = position.y - startY;
  const lengthSquared = dx * dx + dy * dy;
  const closest = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    -(startX * dx + startY * dy) / lengthSquared));
  return Math.hypot(startX + closest * dx, startY + closest * dy) <= surfaceRadius;
}

function getCometAcceleration(position, starMass, planets, positionKey) {
  const acceleration = getGravityAcceleration(position, starMass);
  for (const planet of planets) {
    const center = planet[positionKey];
    const dx = center.x - position.x;
    const dy = center.y - position.y;
    const softening = Math.max(PLANET_GRAVITY_SOFTENING, planet.radius);
    const distanceSquared = dx * dx + dy * dy + softening ** 2;
    const strength = GRAVITY * planet.mass * COMET_FLYBY_GRAVITY_BOOST / distanceSquared ** 1.5;
    acceleration.x += dx * strength;
    acceleration.y += dy * strength;
  }
  return acceleration;
}

function getCircleContactFraction(startX, startY, endX, endY, radius) {
  const dx = endX - startX;
  const dy = endY - startY;
  const outside = startX * startX + startY * startY - radius * radius;
  if (outside <= 0) return 0;
  const speedSquared = dx * dx + dy * dy;
  const dot = startX * dx + startY * dy;
  const discriminant = dot * dot - speedSquared * outside;
  if (dot >= 0 || discriminant < 0) return Infinity;
  const fraction = outside / (-dot + Math.sqrt(discriminant));
  return fraction <= 1 ? fraction : Infinity;
}

function stepComet(comet, starMass, timeStep, starRadius, coreRadius, planets) {
  const start = comet.position;
  const before = getCometAcceleration(start, starMass, planets, "start");
  const end = {
    x: start.x + (comet.velocity.x + before.x * timeStep / 2) * timeStep,
    y: start.y + (comet.velocity.y + before.y * timeStep / 2) * timeStep,
  };
  // Check the entire step, including the planet's motion, for the first impact.
  let fraction = getCircleContactFraction(start.x, start.y, end.x, end.y, starRadius + coreRadius);
  let hitPlanet = null;
  for (const planet of planets) {
    const contact = getCircleContactFraction(start.x - planet.start.x, start.y - planet.start.y,
      end.x - planet.end.x, end.y - planet.end.y, planet.radius + coreRadius);
    if (contact < fraction) {
      fraction = contact;
      hitPlanet = planet;
    }
  }
  if (fraction <= 1) {
    comet.position = {
      x: start.x + (end.x - start.x) * fraction,
      y: start.y + (end.y - start.y) * fraction,
    };
    return { planet: hitPlanet };
  }
  const after = getCometAcceleration(end, starMass, planets, "end");
  comet.velocity.x += (before.x + after.x) * timeStep / 2;
  comet.velocity.y += (before.y + after.y) * timeStep / 2;
  comet.position = end;
  return null;
}

function absorbSeedMaterial(survivor, absorbed) {
  survivor.material += absorbed.material;
  survivor.collected += absorbed.collected;
  // Mergers transfer physical mass. Dust collection sets the display radius.
  absorbed.active = false;
}

function mergeSeedBodies(survivor, absorbed, surfaceRadius = 0) {
  // Perfectly inelastic contact: conserve mass and linear momentum, not kinetic
  // energy. Real impacts can fragment; this model always sticks the bodies together.
  // https://rebound.hanno-rein.de/ipython_examples/User_Defined_Collision_Resolve/
  const firstMass = getSeedMass(survivor);
  const secondMass = getSeedMass(absorbed);
  const totalMass = firstMass + secondMass;
  const mergedPosition = {};
  for (const axis of ["x", "y"]) {
    mergedPosition[axis] = (firstMass * survivor.position[axis]
      + secondMass * absorbed.position[axis]) / totalMass;
    survivor.velocity[axis] = (firstMass * survivor.velocity[axis]
      + secondMass * absorbed.velocity[axis]) / totalMass;
  }
  // Our exaggerated contact radii can span a chord through the drawn star.
  // Recentring must not falsely count as a body travelling into that star.
  // In this visual-model edge case, keep the survivor's contact position.
  // Mass and momentum still combine normally; genuine surface crossings are
  // handled by stepSeeds, not by this instantaneous merger position adjustment.
  const bothOutsideStar = Math.hypot(survivor.position.x, survivor.position.y) > surfaceRadius
    && Math.hypot(absorbed.position.x, absorbed.position.y) > surfaceRadius;
  const recenteringInsideStar = surfaceRadius > 0 && bothOutsideStar
    && Math.hypot(mergedPosition.x, mergedPosition.y) <= surfaceRadius;
  if (!recenteringInsideStar) {
    survivor.position.x = mergedPosition.x;
    survivor.position.y = mergedPosition.y;
  }
  absorbSeedMaterial(survivor, absorbed);
}

function stepSeeds(bodies, starMass, timeStep, surfaceRadius, resolveContacts, absorbPlanet) {
  // Synchronized Velocity Verlet: calculate all forces before moving any body.
  // Small substeps help close encounters and check visible contact more frequently.
  const substep = timeStep / PLANET_GRAVITY_SUBSTEPS;
  resolveContacts();
  for (let step = 0; step < PLANET_GRAVITY_SUBSTEPS; step++) {
    for (const body of bodies) {
      if (body.active && Math.hypot(body.position.x, body.position.y) <= surfaceRadius) {
        absorbPlanet(body);
      }
    }
    const before = getSeedAccelerations(bodies, starMass);
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (!body.active) continue;
      const startX = body.position.x;
      const startY = body.position.y;
      // Rogues take shorter motion steps so they move more slowly even near the star.
      const bodyStep = substep * (body.motionRate ?? 1);
      body.position.x += body.velocity.x * bodyStep + 0.5 * before[i].x * bodyStep ** 2;
      body.position.y += body.velocity.y * bodyStep + 0.5 * before[i].y * bodyStep ** 2;
      // Preserve existing absorption at the fixed star.
      if (crossesStellarSurface(startX, startY, body.position, surfaceRadius)) absorbPlanet(body);
    }
    const after = getSeedAccelerations(bodies, starMass);
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (!body.active) continue;
      const bodyStep = substep * (body.motionRate ?? 1);
      body.velocity.x += 0.5 * (before[i].x + after[i].x) * bodyStep;
      body.velocity.y += 0.5 * (before[i].y + after[i].y) * bodyStep;
    }
    // Merge after both velocity kicks, so momentum uses the same instant for all bodies.
    resolveContacts();
  }
}

// Tuned for a visible transition, not measured gas density or real grain sizes.
const GAS_DRAG_RATE = 1.4;
const GAS_DENSITY_SCALE = 5;
// Keep the gas slightly below circular orbital speed without excessive inward drift.
const GAS_ORBIT_SPEED = 0.995;

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
  // Coupling stands for unresolved grain properties, not a force that steers by angle.
  // Fine, tightly coupled dust follows gas more readily than weakly coupled solids.
  const coupling = body.dragCoupling ?? 1;
  const rate = GAS_DRAG_RATE * Math.exp(-distance / GAS_DENSITY_SCALE) / body.size * coupling * gasAmount;
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
  if (crossesStellarSurface(startX, startY, body.position, surfaceRadius)) return false;

  const after = getGravityAcceleration(body.position, starMass, attractors);
  body.velocity.x += 0.5 * (before.x + after.x) * timeStep;
  body.velocity.y += 0.5 * (before.y + after.y) * timeStep;
  if (useGasDrag) applyGasDrag(body, starMass, timeStep / 2, gasAmount);
  return true;
}
