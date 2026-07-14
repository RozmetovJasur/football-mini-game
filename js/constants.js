export const PITCH = { w: 105, h: 68 };
export const GOAL_HALF_HEIGHT = 3.66;
export const SHOOT_RANGE = 25;
export const PASS_RANGE = 35;
export const CAPTURE_DIST = 2;
export const P_PASS = 0.5;
export const PLAYER_SPEED = 14;   // logical units / sec
export const BALL_FRICTION = 0.85; // velocity kept per sec
export const PASS_SPEED = 45;
export const SHOT_SPEED = 60;
export const HALF_MINUTES = 45;

// --- movement realism (Task: natural, non-parallel motion) ---
export const TURN_RATE = 0.85;      // fraction/sec velocity steers toward desired (inertia)
export const WANDER_AMP = 2.2;      // per-player positional jitter amplitude (units)
export const WANDER_FREQ = 0.5;     // wander oscillation frequency vs game clock
export const SEPARATION_DIST = 5;   // teammates closer than this repel each other (units)
export const SEPARATION_PUSH = 0.6; // repulsion strength factor
