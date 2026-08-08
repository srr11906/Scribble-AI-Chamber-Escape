import { ChamberState, CompressedStroke, ChatMessage, ChamberConfig } from './types';
export interface ServerToClientEvents {
    chamberUpdated: (state: ChamberState) => void;
    drawStroke: (stroke: CompressedStroke) => void;
    canvasRestore: (history: CompressedStroke[]) => void;
    clearCanvas: () => void;
    undoStroke: () => void;
    chatMessage: (msg: ChatMessage) => void;
    typingState: (playerStates: Record<string, boolean>) => void;
    aiEvent: (announcement: string) => void;
    error: (msg: string) => void;
    playAudio: (soundName: 'hum' | 'beep' | 'chime' | 'buzz' | 'lock' | 'open') => void;
}
export interface ClientToServerEvents {
    createChamber: (codename: string, callback?: (res: {
        success: boolean;
        data?: ChamberState;
        error?: string;
    }) => void) => void;
    joinChamber: (codename: string, chamberId: string, callback?: (res: {
        success: boolean;
        data?: ChamberState;
        error?: string;
    }) => void) => void;
    updateConfig: (config: ChamberConfig, callback?: (res: {
        success: boolean;
        error?: string;
    }) => void) => void;
    startGame: (callback?: (res: {
        success: boolean;
        error?: string;
    }) => void) => void;
    selectWord: (word: string, callback?: (res: {
        success: boolean;
        error?: string;
    }) => void) => void;
    drawStroke: (stroke: CompressedStroke, callback?: (res: {
        success: boolean;
        error?: string;
    }) => void) => void;
    clearCanvas: (callback?: (res: {
        success: boolean;
        error?: string;
    }) => void) => void;
    undoStroke: (callback?: (res: {
        success: boolean;
        error?: string;
    }) => void) => void;
    sendMessage: (text: string, callback?: (res: {
        success: boolean;
        error?: string;
    }) => void) => void;
    setTyping: (isTyping: boolean) => void;
    kickPlayer: (playerId: string) => void;
    leaveChamber: () => void;
}
