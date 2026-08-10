export type GamePhase = 'LOBBY' | 'WORD_SELECTION' | 'DRAWING' | 'ROUND_RESULTS' | 'FINAL_RESULTS';
export interface Player {
    id: string;
    codename: string;
    score: number;
    isHost: boolean;
    isOnline: boolean;
    isVerified: boolean;
    lastVerifiedTime?: number;
    isDrawer: boolean;
    disconnectTime: number | null;
    isSpectator?: boolean;
    micEnabled?: boolean;
    speakerEnabled?: boolean;
    voiceConnected?: boolean;
    speaking?: boolean;
}
export interface ChamberConfig {
    maxPlayers: number;
    drawTime: number;
    cycles: number;
    wordPack: string;
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
export interface CompressedStroke {
    points: number[];
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
    isAnnouncement: boolean;
    timestamp: number;
    isVerification?: boolean;
}
export interface ChamberState {
    chamberId: string;
    phase: GamePhase;
    config: ChamberConfig;
    players: Player[];
    currentCycle: number;
    drawerId: string | null;
    wordOptions: string[];
    chosenWord: string | null;
    timer: number;
    hints: string;
    canvasHistory?: CompressedStroke[];
}
