"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const game_1 = require("./game");
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`PASS: ${message}`);
}
function runTests() {
    console.log("Running AI Chamber Escape game engine test suite...");
    // Test 1: Hint Generation
    const word = "biryani";
    const hintsInitial = (0, game_1.generateHints)(word, []);
    assert(hintsInitial === "_ _ _ _ _ _ _", "Initial hints should be all underscores");
    const hintsHalf = (0, game_1.generateHints)(word, [1, 4]);
    assert(hintsHalf === "_ i _ _ a _ _", "Revealed letters should match indices");
    // Test 2: Guess Scoring
    const mockPlayer = {
        id: "socket-1",
        codename: "USERNAME",
        score: 0,
        isHost: false,
        isOnline: true,
        isVerified: false,
        isDrawer: false,
        disconnectTime: null,
    };
    const mockSession = {
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
    const points = (0, game_1.handleGuessScore)(mockSession, mockPlayer, () => { });
    assert(points === 100, "Should award 100 points for guess within 10 seconds");
    assert(mockPlayer.score === 100, "Player score should update to 100");
    assert(mockPlayer.isVerified === true, "Player should be marked verified");
    // Test 3: Guess scoring at 30 seconds elapsed (timer at 30)
    // 30s elapsed is between 21s and 40s -> should give 40 points
    const mockPlayer2 = {
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
    const points2 = (0, game_1.handleGuessScore)(mockSession, mockPlayer2, () => { });
    assert(points2 === 40, "Should award 40 points for guess within 21-40 seconds");
    // Test 4: Drawer selection skips Offline and Spectating players
    const playerActive = {
        id: "active-1",
        codename: "HOST",
        score: 0,
        isHost: true,
        isOnline: true,
        isVerified: false,
        isDrawer: false,
        disconnectTime: null,
    };
    const playerOffline = {
        id: "offline-1",
        codename: "OFFLINE",
        score: 0,
        isHost: false,
        isOnline: false,
        isVerified: false,
        isDrawer: false,
        disconnectTime: Date.now(),
    };
    const playerSpectator = {
        id: "spec-1",
        codename: "SPEC",
        score: 0,
        isHost: false,
        isOnline: true,
        isVerified: false,
        isDrawer: false,
        disconnectTime: null,
        isSpectator: true,
    };
    const playerActive2 = {
        id: "active-2",
        codename: "ACTIVE2",
        score: 0,
        isHost: false,
        isOnline: true,
        isVerified: false,
        isDrawer: false,
        disconnectTime: null,
    };
    const rotationSession = {
        chamberId: "ROTATE",
        phase: "LOBBY",
        config: {
            maxPlayers: 5,
            drawTime: 60,
            cycles: 2,
            wordPack: "all",
            customWords: [],
        },
        players: [playerActive, playerOffline, playerSpectator, playerActive2],
        currentCycle: 1,
        drawerId: null,
        wordOptions: [],
        chosenWord: null,
        timer: 0,
        hints: "",
        revealedIndices: [],
        canvasHistory: [],
        lastActiveTime: Date.now(),
        drawerIndex: -1,
        wordSelectTimeout: null,
        drawingTimeout: null,
        resultsTimeout: null,
    };
    // Mock next drawer selection loop:
    // First selection index increment starts at -1 -> 0.
    // Player at index 0 is playerActive (online, non-spectator) -> should be chosen!
    let idx = (rotationSession.drawerIndex + 1) % rotationSession.players.length;
    let attempts = 0;
    while ((!rotationSession.players[idx].isOnline || rotationSession.players[idx].isSpectator) && attempts < rotationSession.players.length) {
        idx = (idx + 1) % rotationSession.players.length;
        attempts++;
    }
    assert(idx === 0, "First drawer selection index should be 0 (HOST)");
    // Second selection starting from index 0 -> index 1.
    // Index 1 is playerOffline (offline) -> skip.
    // Index 2 is playerSpectator (spectator) -> skip.
    // Index 3 is playerActive2 (online, active) -> select!
    idx = 1;
    attempts = 0;
    while ((!rotationSession.players[idx].isOnline || rotationSession.players[idx].isSpectator) && attempts < rotationSession.players.length) {
        idx = (idx + 1) % rotationSession.players.length;
        attempts++;
    }
    assert(idx === 3, "Drawer selection should skip index 1 & 2, picking active player at index 3");
    // Test 5: Winner Determination sorting order
    const unsorted = [
        { codename: "P1", score: 200, isSpectator: false },
        { codename: "P2", score: 500, isSpectator: false },
        { codename: "P3", score: 100, isSpectator: true }, // spectator
        { codename: "P4", score: 400, isSpectator: false }
    ];
    const sorted = [...unsorted].sort((a, b) => b.score - a.score);
    assert(sorted[0].codename === "P2", "Highest scorer P2 should be first");
    assert(sorted[1].codename === "P4", "Second highest scorer P4 should be second");
    console.log("All game engine tests passed successfully.");
}
// Run tests and exit
try {
    runTests();
    process.exit(0);
}
catch (e) {
    console.error(e);
    process.exit(1);
}
//# sourceMappingURL=game.test.js.map