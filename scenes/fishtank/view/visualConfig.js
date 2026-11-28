// Visual numbers (decision D18): bubble timings, sway, decor placement. They are starting values for
// the default 480 x 320 window, in units of height / 320 (see layout.js), and are tuned by eye.
// The game economy lives in scenes/fishtank/game/config.js; the server never needs these.

export const visual = {
  bubbles: {
    poolSize: 60,
    chainMin: 5,
    chainMax: 12,
    spacing: 0.12, // seconds between bubbles in a chain
    pauseMin: 4, // seconds between chains
    pauseMax: 15,
    firstPauseMax: 4, // the first chain of each source starts soon after launch
    sizeMin: 3, // diameter in units
    sizeMax: 10,
    riseMin: 22, // units per second
    riseMax: 34,
    wobbleAmplitude: [1.5, 4], // units
    wobbleSpeed: [1.6, 3.2], // radians per second
    growth: 0.2, // grows by 20% on the way up
    popSeconds: 0.3,
    alpha: 0.85,
  },
  sand: {
    waveAmplitude: 2, // units
    lipFraction: 0.2, // height of the front sand lip, as a fraction of the sand height
    grainScale: 0.5, // tile scale in units
  },
  // The far reef behind the decor (backdrop.js). Heights are in units above the sand; the colours are the Water
  // family, darker and bluer with each layer, so the shapes read as distance and never compete with the fish.
  backdrop: {
    layers: [
      // swells: how many bumps per cell of the profile; base + swell + tower is the tallest the layer can get.
      { color: 0x2b86a8, alpha: 0.42, base: 34, swell: 44, tower: 52, swells: 0.55, blades: 0 },
      {
        color: 0x1c6b93,
        alpha: 0.5,
        base: 16,
        swell: 30,
        tower: 30,
        swells: 0.8,
        blades: 1.6,
        bladeHeight: [28, 52],
      },
      {
        color: 0x124f7a,
        alpha: 0.58,
        base: 5,
        swell: 16,
        tower: 14,
        swells: 1.1,
        blades: 2.2,
        bladeHeight: [18, 36],
      },
    ],
  },
  decor: {
    // The back row is paler and bluer than the front row: one veil of water colour over the whole row (so a back
    // coral never shows through a back rock, which per-piece transparency did).
    backHaze: 0.22,
    backTint: 0xe3f3f9,
    // Where the base of a decoration sits inside the sand band (fractions of its height).
    backBase: [0.05, 0.3],
    frontBase: [0.45, 0.85],
  },
  sway: {
    verticesY: 8,
  },
  fish: {
    flipSeconds: 0.25, // the left/right turn eases through zero over this time (FR-42)
    pitchMaxDegrees: 25, // the body tilts up when climbing and down when diving (FR-45)
    pitchSmoothing: 5, // per second
    acceleration: 2.2, // how fast the velocity follows the wanted velocity, in 1/second
    hopSeconds: [4, 10], // time between new horizontal targets
    verticalSpeedFraction: 0.65, // vertical speed limit, as a fraction of the swim speed
    wallMargin: 38, // units; the soft margin around the sides, the surface and the sand
    separationRadius: 30, // units, times the size of the fish
    chaseSeparation: 1.0, // how hard a fish chasing food keeps apart from the others (wandering uses 1.2)
    chaseSeparationFade: 20, // units from its pellet at which that push starts to fade out
    drowsySpeed: 0.55,
    sizeSmoothing: 3, // per second; points are applied smoothly
    stageBlendSeconds: 2, // palette blend at a stage change (FR-14)
    chaseSpeed: 1.4, // times the swim speed while chasing food (FR-47)
    chaseSpeedMax: 3.2, // never faster than this, even to catch a pellet that is about to land
    eatRadius: 7, // units, plus 4 per size
    wiggleSeconds: 0.9,
    fadeInSeconds: 1, // a freshly hatched fish fades in
    startArea: 0.6, // new fish start inside the middle part of the tank
  },
  food: {
    pelletDiameter: 3.4, // units (an adult tetra is 44 units long)
    sinkSeconds: 6, // from the top of the water to the sand (FR-46)
    swayAmplitude: 1.6, // units
    swaySpeed: 1.9, // radians per second
    feedLoopSeconds: 2, // "Feed until full" drops a pellet this often, in scene time (D28)
  },
  // Pellets that float in the tank and are collected by a click (FR-3, FR-4).
  floating: {
    diameter: 7, // units; bigger than a dropped pellet so it is easy to click
    hitRadius: 10, // units
    topMargin: 30, // units; pellets never appear in the top strip (D5)
    bobAmplitude: 2.2, // units
    bobSpeed: 1.1, // radians per second
    driftAmplitude: 3, // units
    driftSpeed: 0.55,
    fadeInSeconds: 1.2,
    flySeconds: 0.45, // from the water to the stash counter
    flyStagger: 0.06, // seconds between pellets when several are collected at once
  },
  eggs: {
    width: 13, // units
    hitRadius: 13,
    maxShown: 4, // eggs drawn at once; the rest wait
    hatchSeconds: 0.9,
    slots: [0.42, 0.58, 0.3, 0.7], // where on the sand they rest, as fractions of the width
  },
  touch: {
    pokeSeconds: 0.5, // a click on a fish makes it wiggle this long (FR-48; no label since DEC-69)
  },
  // Fish react to the mouse pointer (FR-49, D26). Distances are in units.
  pointer: {
    noticeDistance: 120,
    movedRecentlySeconds: 2, // the pointer must have moved this recently to be noticed
    followDistance: 40, // a curious fish stops about this far away
    giveUpSeconds: 8,
    stillSeconds: 3, // a curious fish loses interest when the pointer rests this long
    cooldownSeconds: 20,
    curiousShare: 0.6,
    seekSpeed: 0.85, // times the swim speed
    fleeSpeed: 1.15,
    fleeFastBoost: 1.6, // flee speed is scaled up to this when the pointer is fast
    fastSpeed: 700, // units per second that counts as a fast pointer
    fleeClearDistance: 1.5, // a shy fish is calm again at this many times the notice distance
  },
};
