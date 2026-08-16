import { GamePhase, Player, ChamberConfig, ChamberState, StrokeSegment, CompressedStroke, ChatMessage } from 'shared';
import { getRandomWords } from './wordDb';
import { setVal, getVal, delVal } from './redis';

export interface ChamberSession {
  chamberId: string;
  phase: GamePhase;
  config: ChamberConfig;
  players: Player[];
  currentCycle: number; // 1-indexed
  drawerId: string | null;
  wordOptions: string[];
  chosenWord: string | null;
  timer: number;
  phaseEndsAt?: number;
  hints: string;
  revealedIndices: number[];
  canvasHistory: CompressedStroke[];
  chatHistory?: ChatMessage[];
  lastActiveTime: number;
  drawerIndex: number; // Index in players array for current cycle
  wordSelectTimeout: NodeJS.Timeout | null;
  drawingTimeout: NodeJS.Timeout | null;
  resultsTimeout: NodeJS.Timeout | null;
}

// In-memory active sessions map (backed up to Redis)
export const activeSessions = new Map<string, ChamberSession>();

// Periodic cleanup of inactive sessions (>30 minutes of inactivity)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [chamberId, session] of activeSessions.entries()) {
    if (now - session.lastActiveTime > 30 * 60 * 1000) {
      console.log(`Chamber ${chamberId} expired due to inactivity.`);
      clearSessionTimers(session);
      activeSessions.delete(chamberId);
      delVal(`chamber:${chamberId}`);
    }
  }
}, 5 * 60 * 1000);
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

export function clearSessionTimers(session: ChamberSession) {
  if (session.wordSelectTimeout) clearTimeout(session.wordSelectTimeout);
  if (session.drawingTimeout) clearTimeout(session.drawingTimeout);
  if (session.resultsTimeout) clearTimeout(session.resultsTimeout);
  session.wordSelectTimeout = null;
  session.drawingTimeout = null;
  session.resultsTimeout = null;
}

export function generateChamberId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes O, 0, I, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Check collision
  if (activeSessions.has(code)) {
    return generateChamberId();
  }
  return code;
}

export function serializeSession(session: ChamberSession, includeCanvas = false): ChamberState {
  const state: ChamberState = {
    chamberId: session.chamberId,
    phase: session.phase,
    config: session.config,
    players: session.players,
    currentCycle: session.currentCycle,
    drawerId: session.drawerId,
    wordOptions: session.wordOptions,
    chosenWord: session.phase === 'ROUND_RESULTS' || session.phase === 'FINAL_RESULTS' ? session.chosenWord : null,
    timer: session.timer,
    phaseEndsAt: session.phaseEndsAt,
    hints: session.hints,
  };

  if (includeCanvas) {
    state.canvasHistory = session.canvasHistory;
  }

  return state;
}

export async function saveSessionToRedis(session: ChamberSession) {
  session.lastActiveTime = Date.now();
  const state = serializeSession(session, true);
  // We omit timeouts and server-only variables for Redis
  await setVal(`chamber:${session.chamberId}`, JSON.stringify({
    ...state,
    drawerIndex: session.drawerIndex,
    chosenWord: session.chosenWord, // Keep actual word saved on server
    revealedIndices: session.revealedIndices
  }), 1800); // 30 minutes expiry
}

export function createChamber(chamberId: string, hostSocketId: string, codename: string): ChamberSession {
  const host: Player = {
    id: hostSocketId,
    codename,
    score: 0,
    isHost: true,
    isOnline: true,
    isVerified: false,
    isDrawer: false,
    disconnectTime: null,
  };

  const session: ChamberSession = {
    chamberId,
    phase: 'LOBBY',
    config: {
      maxPlayers: 8,
      drawTime: 60,
      cycles: 3,
      wordPack: 'all',
      customWords: [],
    },
    players: [host],
    currentCycle: 1,
    drawerId: null,
    wordOptions: [],
    chosenWord: null,
    timer: 0,
    phaseEndsAt: 0,
    hints: '',
    revealedIndices: [],
    canvasHistory: [],
    lastActiveTime: Date.now(),
    drawerIndex: -1,
    wordSelectTimeout: null,
    drawingTimeout: null,
    resultsTimeout: null,
  };

  activeSessions.set(chamberId, session);
  saveSessionToRedis(session);
  return session;
}

export function generateHints(word: string, revealedIndices: number[]): string {
  let hints = '';
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ' ') {
      hints += '  '; // Double space for word separation
    } else if (revealedIndices.includes(i)) {
      hints += `${word[i]} `;
    } else {
      hints += '_ ';
    }
  }
  return hints.trim();
}

export function startWordSelection(session: ChamberSession, broadcastState: () => void) {
  clearSessionTimers(session);
  session.phase = 'WORD_SELECTION';
  
  // Clean drawing-specific round details
  session.canvasHistory = [];
  session.players.forEach(p => {
    p.isVerified = false;
    p.isDrawer = false;
    delete p.lastVerifiedTime;
  });

  // Pick next drawer
  const activePlayers = session.players.filter(p => p.isOnline && !p.isSpectator);
  if (activePlayers.length === 0) {
    session.phase = 'LOBBY';
    saveSessionToRedis(session);
    broadcastState();
    return;
  }

  session.drawerIndex = (session.drawerIndex + 1) % session.players.length;
  // Ensure we select an online player as drawer, skip offline ones and spectators
  let attempts = 0;
  while ((!session.players[session.drawerIndex].isOnline || session.players[session.drawerIndex].isSpectator) && attempts < session.players.length) {
    session.drawerIndex = (session.drawerIndex + 1) % session.players.length;
    attempts++;
  }

  // If we cycled back to beginning, check cycle count
  if (session.drawerIndex === 0 && attempts < session.players.length) {
    // Wait, let's increment cycle only when we completed a full cycle.
    // If it's the first drawer of a new cycle, increment.
    // Wait, we started at cycle 1, so drawerIndex=0 in subsequent passes increments cycle.
  }

  const drawer = session.players[session.drawerIndex];
  drawer.isDrawer = true;
  session.drawerId = drawer.id;
  
  // Generate word options
  session.wordOptions = getRandomWords(session.config.wordPack, 3, session.config.customWords);
  session.chosenWord = null;
  session.timer = 10; // 10 seconds to select
  session.phaseEndsAt = Date.now() + 10 * 1000;
  session.hints = '';
  session.revealedIndices = [];

  saveSessionToRedis(session);
  broadcastState();

  const tick = () => {
    const remaining = Math.max(0, Math.ceil((session.phaseEndsAt! - Date.now()) / 1000));
    session.timer = remaining;
    if (session.timer <= 0) {
      // Auto select first option
      const defaultWord = session.wordOptions[0] || 'idli';
      selectWord(session, drawer.id, defaultWord, broadcastState);
    } else {
      broadcastState();
      session.wordSelectTimeout = setTimeout(tick, 1000);
    }
  };
  session.wordSelectTimeout = setTimeout(tick, 1000);
}

export function selectWord(session: ChamberSession, playerId: string, word: string, broadcastState: () => void) {
  if (session.phase !== 'WORD_SELECTION' || session.drawerId !== playerId) return;
  
  clearSessionTimers(session);
  session.chosenWord = word.toLowerCase();
  session.phase = 'DRAWING';
  session.timer = session.config.drawTime;
  session.phaseEndsAt = Date.now() + session.config.drawTime * 1000;
  session.hints = generateHints(session.chosenWord, []);
  session.revealedIndices = [];
  
  saveSessionToRedis(session);
  broadcastState();

  const totalTime = session.config.drawTime;
  const fiftyPercentTime = Math.floor(totalTime * 0.5);
  const seventyFivePercentTime = Math.floor(totalTime * 0.25); // remaining 25%

  const tick = () => {
    const remaining = Math.max(0, Math.ceil((session.phaseEndsAt! - Date.now()) / 1000));
    session.timer = remaining;
    
    // Hint revelations
    if (session.chosenWord) {
      const wordLength = session.chosenWord.replace(/\s+/g, '').length;
      if (session.timer === fiftyPercentTime && session.revealedIndices.length === 0 && wordLength > 2) {
        revealHintLetter(session);
      } else if (session.timer === seventyFivePercentTime && session.revealedIndices.length === 1 && wordLength > 4) {
        revealHintLetter(session);
      }
    }

    if (session.timer <= 0) {
      endRound(session, broadcastState);
    } else {
      broadcastState();
      session.drawingTimeout = setTimeout(tick, 1000);
    }
  };
  
  session.drawingTimeout = setTimeout(tick, 1000);
}

function revealHintLetter(session: ChamberSession) {
  if (!session.chosenWord) return;
  const letters = [];
  for (let i = 0; i < session.chosenWord.length; i++) {
    if (session.chosenWord[i] !== ' ' && !session.revealedIndices.includes(i)) {
      letters.push(i);
    }
  }
  if (letters.length > 0) {
    const randIndex = letters[Math.floor(Math.random() * letters.length)];
    session.revealedIndices.push(randIndex);
    session.hints = generateHints(session.chosenWord, session.revealedIndices);
  }
}

export function endRound(session: ChamberSession, broadcastState: () => void) {
  clearSessionTimers(session);
  session.phase = 'ROUND_RESULTS';
  session.timer = 8; // 8 seconds display results
  session.phaseEndsAt = Date.now() + 8 * 1000;

  // Calculate drawer scoring
  const correctGuessers = session.players.filter(p => p.isVerified && p.id !== session.drawerId && !p.isSpectator);
  const guessersCount = session.players.filter(p => p.id !== session.drawerId && !p.isSpectator).length;
  
  const drawer = session.players.find(p => p.id === session.drawerId);
  if (drawer && correctGuessers.length > 0) {
    let drawerBonus = correctGuessers.length * 20;
    
    // Everyone guessed
    if (correctGuessers.length === guessersCount && guessersCount > 0) {
      drawerBonus += 50;
    }
    
    // All guessed within 15 seconds
    const allWithin15 = correctGuessers.every(p => p.lastVerifiedTime && (session.config.drawTime - p.lastVerifiedTime <= 15));
    if (allWithin15 && correctGuessers.length === guessersCount && guessersCount > 0) {
      drawerBonus += 30;
    }
    
    drawer.score += drawerBonus;
  }

  saveSessionToRedis(session);
  broadcastState();

  const tick = () => {
    const remaining = Math.max(0, Math.ceil((session.phaseEndsAt! - Date.now()) / 1000));
    session.timer = remaining;
    if (session.timer <= 0) {
      // Check if game has ended
      // Simulate next drawer selection to check if cycle wraps around
      let nextIndex = (session.drawerIndex + 1) % session.players.length;
      let attempts = 0;
      while ((!session.players[nextIndex].isOnline || session.players[nextIndex].isSpectator) && attempts < session.players.length) {
        nextIndex = (nextIndex + 1) % session.players.length;
        attempts++;
      }

      let cycleIncrement = 0;
      if (nextIndex <= session.drawerIndex || attempts >= session.players.length) {
        cycleIncrement = 1;
      }

      if (session.currentCycle + cycleIncrement > session.config.cycles) {
        // Game Over! Transition to final results
        session.phase = 'FINAL_RESULTS';
        session.timer = 15;
        session.phaseEndsAt = Date.now() + 15 * 1000;
        saveSessionToRedis(session);
        broadcastState();
      } else {
        session.currentCycle += cycleIncrement;
        startWordSelection(session, broadcastState);
      }
    } else {
      broadcastState();
      session.resultsTimeout = setTimeout(tick, 1000);
    }
  };

  session.resultsTimeout = setTimeout(tick, 1000);
}

export function handleGuessScore(session: ChamberSession, player: Player, broadcastState: () => void): number {
  const timeElapsed = session.config.drawTime - session.timer;
  let points = 20; // default minimum
  if (timeElapsed <= 10) {
    points = 100;
  } else if (timeElapsed <= 20) {
    points = 70;
  } else if (timeElapsed <= 40) {
    points = 40;
  } else if (timeElapsed <= 60) {
    points = 20;
  }
  
  player.score += points;
  player.isVerified = true;
  player.lastVerifiedTime = session.timer;
  
  // If everyone online has now guessed, end the round early!
  const unsolvedGuesser = session.players.find(p => p.isOnline && !p.isVerified && p.id !== session.drawerId && !p.isSpectator);
  if (!unsolvedGuesser) {
    // Everyone solved, skip to results
    setTimeout(() => {
      endRound(session, broadcastState);
    }, 1000);
  }

  return points;
}
