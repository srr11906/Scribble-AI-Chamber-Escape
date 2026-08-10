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
    'voice:peer-joined': (payload: {
        peerId: string;
        micEnabled: boolean;
        speakerEnabled: boolean;
    }) => void;
    'voice:offer': (payload: {
        senderId: string;
        sdp: any;
    }) => void;
    'voice:answer': (payload: {
        senderId: string;
        sdp: any;
    }) => void;
    'voice:ice-candidate': (payload: {
        senderId: string;
        candidate: any;
    }) => void;
    'voice:peer-left': (payload: {
        peerId: string;
    }) => void;
    'voice:peer-state': (payload: {
        peerId: string;
        micEnabled: boolean;
        speakerEnabled: boolean;
        voiceConnected?: boolean;
    }) => void;
    'voice:peer-speaking': (payload: {
        peerId: string;
        speaking: boolean;
    }) => void;
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
    'voice:join': () => void;
    'voice:offer': (payload: {
        targetId: string;
        sdp: any;
    }) => void;
    'voice:answer': (payload: {
        targetId: string;
        sdp: any;
    }) => void;
    'voice:ice-candidate': (payload: {
        targetId: string;
        candidate: any;
    }) => void;
    'voice:leave': () => void;
    'voice:state': (payload: {
        micEnabled: boolean;
        speakerEnabled: boolean;
    }) => void;
    'voice:speaking': (payload: {
        speaking: boolean;
    }) => void;
}
