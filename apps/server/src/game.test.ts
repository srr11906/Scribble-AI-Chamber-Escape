import { generateHints, handleGuessScore, ChamberSession } from './game';
import { Player } from 'shared';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

export function runTests() {
  console.log("Running AI Chamber Escape game engine test suite...");

  // Test 1: Hint Generation
  const word = "biryani";
  const hintsInitial = generateHints(word, []);
  assert(hintsInitial === "_ _ _ _ _ _ _", "Initial hints should be all underscores");

  const hintsHalf = generateHints(word, [1, 4]);
  assert(hintsHalf === "_ i _ _ a _ _", "Revealed letters should match indices");

  // Test 2: Guess Scoring
  const mockPlayer: Player = {
    id: "socket-1",
    codename: "PRIYA",
    score: 0,
    isHost: false,
    isOnline: true,
    isVerified: false,
    isDrawer: false,
    disconnectTime: null,
  };

  const mockSession: ChamberSession = {
    chamberId: "TEST12",
    phase: "DRAWING",
    config: {
      maxPlayers: 5,
      drawTime: 60,
      cycles: 3,
      wordPack: "all",
      customWords: [],
    },
    players: [mockPlayer],
    currentCycle: 1,
    drawerId: "socket-drawer",
    wordOptions: [],
    chosenWord: "biryani",
    timer: 55, // 5 seconds elapsed from 60 seconds
    hints: "",
    revealedIndices: [],
    canvasHistory: [],
    lastActiveTime: Date.now(),
    drawerIndex: 0,
    wordSelectTimeout: null,
    drawingTimeout: null,
    resultsTimeout: null,
  };

  // Guess score within 10s (timer at 55 means 5s elapsed)
  // 5s <= 10s -> should give 100 points
  const points = handleGuessScore(mockSession, mockPlayer, () => {});
  assert(points === 100, "Should award 100 points for guess within 10 seconds");
  assert(mockPlayer.score === 100, "Player score should update to 100");
  assert(mockPlayer.isVerified === true, "Player should be marked verified");

  // Test 3: Guess scoring at 30 seconds elapsed (timer at 30)
  // 30s elapsed is between 21s and 40s -> should give 40 points
  const mockPlayer2: Player = {
    id: "socket-2",
    codename: "ARJUN",
    score: 0,
    isHost: false,
    isOnline: true,
    isVerified: false,
    isDrawer: false,
    disconnectTime: null,
  };
  mockSession.timer = 30;
  const points2 = handleGuessScore(mockSession, mockPlayer2, () => {});
  assert(points2 === 40, "Should award 40 points for guess within 21-40 seconds");

  console.log("All game engine tests passed successfully.");
}

// Run tests and exit
try {
  runTests();
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
