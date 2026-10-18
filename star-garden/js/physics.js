// Distances use AU, masses use Sun masses, and time uses years.
// G = 4π² makes a small body at 1 AU orbit a 1-Sun-mass star in about a year.
const GRAVITY = 4 * Math.PI ** 2;
const PHYSICS_STEP = 1 / 480;
const YEARS_PER_SECOND = 1 / 8;

function createTestPlanet(starMass, settings) {
  const { semiMajorAxis, eccentricity, phase, orientation, colour, size } = settings;
  const orbitParameter = semiMajorAxis * (1 - eccentricity ** 2);
  const distance = orbitParameter / (1 + eccentricity * Math.cos(phase));
  const speedScale = Math.sqrt(GRAVITY * starMass / orbitParameter);
  const cosAngle = Math.cos(orientation);
  const sinAngle = Math.sin(orientation);
  const x = distance * Math.cos(phase);
  const y = distance * Math.sin(phase);
  // Keplerian starting velocity lets gravity produce the ellipse naturally.
  const vx = -speedScale * Math.sin(phase);
  const vy = speedScale * (eccentricity + Math.cos(phase));

  return {
    mass: 0.000003,
    colour,
    size,
    maxDistance: semiMajorAxis * (1 + eccentricity),
    position: { x: x * cosAngle - y * sinAngle, y: x * sinAngle + y * cosAngle },
    velocity: { x: vx * cosAngle - vy * sinAngle, y: vx * sinAngle + vy * cosAngle },
  };
}

function getGravityAcceleration(position, starMass) {
  const distance = Math.hypot(position.x, position.y);
  const strength = -GRAVITY * starMass / distance ** 3;
  return { x: position.x * strength, y: position.y * strength };
}

function stepPlanet(planet, starMass, timeStep) {
  // Velocity Verlet: use gravity before and after moving to limit orbit drift.
  // Only the fixed star's gravity is included, not pulls between planets.
  const before = getGravityAcceleration(planet.position, starMass);
  planet.position.x += planet.velocity.x * timeStep + 0.5 * before.x * timeStep ** 2;
  planet.position.y += planet.velocity.y * timeStep + 0.5 * before.y * timeStep ** 2;

  const after = getGravityAcceleration(planet.position, starMass);
  planet.velocity.x += 0.5 * (before.x + after.x) * timeStep;
  planet.velocity.y += 0.5 * (before.y + after.y) * timeStep;
}
