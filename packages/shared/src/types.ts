export type GamePhase = 'LOBBY' | 'WORD_SELECTION' | 'DRAWING' | 'ROUND_RESULTS' | 'FINAL_RESULTS';

export interface Player {
  id: string;
  codename: string;
  score: number;
  isHost: boolean;
  isOnline: boolean;
  isVerified: boolean; // Has guessed the word in the current cycle
  lastVerifiedTime?: number; // Socket client's response timestamp
  isDrawer: boolean;
  disconnectTime: number | null; // Timestamp of disconnect, null if connected
}

export interface ChamberConfig {
  maxPlayers: number; // 3 - 12
  drawTime: number; // 30 - 120s
  cycles: number; // 1 - 10 (rounds)
  wordPack: string; // 'all' or specific categories
  customWords: string[];
}

export interface Point {
  x: number;
  y: number;
}

export interface StrokeSegment {
  points: Point[];
  color: string;
  size: number;
  isEraser: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  text: string;
  isSystem: boolean;
  isAnnouncement: boolean; // For AI feed announcements
  timestamp: number;
  isVerification?: boolean; // True if it signifies a correct guess
}

export interface ChamberState {
  chamberId: string;
  phase: GamePhase;
  config: ChamberConfig;
  players: Player[];
  currentCycle: number;
  drawerId: string | null;
  wordOptions: string[];
  chosenWord: string | null; // Null for guessers during drawing, shown for drawer and in results
  timer: number; // Seconds remaining (Oxygen)
  hints: string; // E.g., "_ _ a _ _"
  canvasHistory: StrokeSegment[]; // Backlog of drawing for newly connected players
}
