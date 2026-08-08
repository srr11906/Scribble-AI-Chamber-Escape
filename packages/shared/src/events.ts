import { ChamberState, StrokeSegment, ChatMessage, ChamberConfig } from './types';

export interface ServerToClientEvents {
  chamberUpdated: (state: ChamberState) => void;
  drawStroke: (stroke: StrokeSegment) => void;
  clearCanvas: () => void;
  undoStroke: () => void;
  chatMessage: (msg: ChatMessage) => void;
  typingState: (playerStates: Record<string, boolean>) => void;
  aiEvent: (announcement: string) => void;
  error: (msg: string) => void;
  playAudio: (soundName: 'hum' | 'beep' | 'chime' | 'buzz' | 'lock' | 'open') => void;
}

export interface ClientToServerEvents {
  createChamber: (codename: string) => void;
  joinChamber: (codename: string, chamberId: string) => void;
  updateConfig: (config: ChamberConfig) => void;
  startGame: () => void;
  selectWord: (word: string) => void;
  drawStroke: (stroke: StrokeSegment) => void;
  clearCanvas: () => void;
  undoStroke: () => void;
  sendMessage: (text: string) => void;
  setTyping: (isTyping: boolean) => void;
  kickPlayer: (playerId: string) => void;
  leaveChamber: () => void;
}
