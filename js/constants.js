export const PITCH = { w: 105, h: 68 };
export const GOAL_HALF_HEIGHT = 3.66;
export const SHOOT_RANGE = 25;
export const PASS_RANGE = 35;
export const CAPTURE_DIST = 2;
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

// --- ball height (pseudo-3D) ---
export const GRAVITY = 30;          // units / sec^2 pulling the ball down
export const BALL_BOUNCE = 0.45;    // fraction of vertical speed kept on bounce
export const BALL_REACH_Z = 1.6;    // above this height players can't collect the ball
export const LOFT_PASS_DIST = 20;   // passes longer than this are chipped
export const MAX_LOFT_VZ = 11;      // cap keeps lofted balls under the crossbar

// --- build-up play ---
export const HOLD_MIN = 0.5;         // sec a carrier keeps the ball before deciding
export const HOLD_RAND = 0.7;        // + random extra hold time
export const PRESSURE_DIST = 3.5;     // opponent this close = carrier under pressure
export const LANE_BLOCK_DIST = 2.5;  // opponent this close to a pass lane can intercept
export const MIN_PASS_DIST = 6;
export const P_PASS_OPEN = 0.7;      // chance to pass (vs. carry) when not pressed
export const TACKLE_DIST = 2;        // a defender this close can make a challenge
export const TACKLE_RATE = 2;        // successful tackles / sec when in range
export const GOOD_SHOT_ANGLE = 14;   // max |y offset| from goal centre for a long-range shot
export const CLOSE_SHOT_DIST = 16;   // always shoot from inside this distance

// --- feints (taking a man on) ---
export const FEINT_RANGE = 4;        // a defender this close in front can be beaten
export const FEINT_COOLDOWN = 1.5;   // sec between feint decisions for the carrier
export const FEINT_TIME = 0.45;      // sec of the carrier's move and burst
export const STUN_TIME = 0.8;        // sec a beaten defender is wrong-footed
export const FEINT_LOSS = 0.5;       // chance a failed feint gives the ball away
