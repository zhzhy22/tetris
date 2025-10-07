export const TETROMINO_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;

export type TetrominoType = (typeof TETROMINO_TYPES)[number];

export interface RandomState {
  seed: string;
  bag: TetrominoType[];
  history: TetrominoType[];
}

export interface DrawResult {
  piece: TetrominoType;
  state: RandomState;
}

const MAX_UINT32 = 0xffffffff;

function generateDefaultSeed(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(2);
    crypto.getRandomValues(buffer);
    return Array.from(buffer, (value) => value.toString(16).padStart(8, '0')).join('');
  }

  const randomPart = () => Math.floor(Math.random() * (MAX_UINT32 + 1)).toString(16).padStart(8, '0');
  return `${randomPart()}${randomPart()}`;
}

function hashSeed(baseSeed: string, bagIndex: number): number {
  let hash = 0x811c9dc5 ^ bagIndex;

  for (let i = 0; i < baseSeed.length; i += 1) {
    hash ^= baseSeed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }

  return hash >>> 0;
}

function createPrng(seedValue: number): () => number {
  let state = seedValue >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / (MAX_UINT32 + 1);
  };
}

function generateBag(seed: string, bagIndex: number): TetrominoType[] {
  const prng = createPrng(hashSeed(seed, bagIndex));
  const bag = [...TETROMINO_TYPES];

  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(prng() * (i + 1));
    const temp = bag[i];
    bag[i] = bag[j];
    bag[j] = temp;
  }

  return bag;
}

function determineBagIndex(historyLength: number): number {
  return Math.floor(historyLength / TETROMINO_TYPES.length);
}

/**
 * Create a deterministic seven-bag random generator.
 * The same seed will always produce identical piece sequences.
 */
export function createSevenBagRng(seed = generateDefaultSeed()): RandomState {
  return {
    seed,
    bag: generateBag(seed, 0),
    history: [],
  };
}

/**
 * Draw the next tetromino from the generator, automatically refilling the bag
 * when exhausted while preserving determinism across redraws.
 */
export function drawNextPiece(state: RandomState): DrawResult {
  const history = state.history;
  const needsRefill = state.bag.length === 0;
  const bag = needsRefill
    ? generateBag(state.seed, determineBagIndex(history.length))
    : state.bag;

  const [piece, ...remaining] = bag;
  const nextHistory = [...history, piece];
  const nextBag = remaining.length === 0 ? [] : remaining;

  return {
    piece,
    state: {
      seed: state.seed,
      bag: nextBag,
      history: nextHistory,
    },
  };
}
