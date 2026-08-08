import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  Player, 
  ChamberConfig, 
  ChamberState,
  StrokeSegment, 
  CompressedStroke,
  ChatMessage,
  CreateChamberSchema,
  JoinChamberSchema,
  ConfigSchema,
  SelectWordSchema,
  SendMessageSchema,
  StrokeSchema
} from 'shared';
import { initRedis, getVal, setVal, delVal } from './redis';
import { 
  activeSessions, 
  createChamber, 
  generateChamberId, 
  serializeSession, 
  saveSessionToRedis, 
  startWordSelection, 
  selectWord, 
  handleGuessScore, 
  endRound,
  clearSessionTimers,
  ChamberSession
} from './game';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

// Map socket ID to player registration
interface SocketSession {
  playerId: string;
  codename: string;
  chamberId: string;
}
const socketSessions = new Map<string, SocketSession>();

function sendChamberStateToSocket(socket: Socket<ClientToServerEvents, ServerToClientEvents>, session: ChamberSession) {
  const state = serializeSession(session);
  const player = session.players.find(p => p.id === socket.id);
  const playerState = { ...state };
  if (session.phase === 'DRAWING' && player) {
    if (player.id === session.drawerId || player.isVerified || player.isSpectator) {
      playerState.chosenWord = session.chosenWord;
    } else {
      playerState.chosenWord = null;
    }
  } else if (session.phase === 'WORD_SELECTION') {
    playerState.chosenWord = null;
  } else {
    playerState.chosenWord = session.chosenWord;
  }
  socket.emit('chamberUpdated', playerState);
  
  if (session.canvasHistory && session.canvasHistory.length > 0) {
    socket.emit('canvasRestore', session.canvasHistory);
  }
}

function broadcastChamberState(session: ChamberSession) {
  const state = serializeSession(session);
  session.players.forEach(p => {
    const playerSocket = io.sockets.sockets.get(p.id);
    if (playerSocket) {
      const playerState = { ...state };
      if (session.phase === 'DRAWING') {
        if (p.id === session.drawerId || p.isVerified || p.isSpectator) {
          playerState.chosenWord = session.chosenWord;
        } else {
          playerState.chosenWord = null;
        }
      } else if (session.phase === 'WORD_SELECTION') {
        playerState.chosenWord = null;
      } else {
        playerState.chosenWord = session.chosenWord;
      }
      playerSocket.emit('chamberUpdated', playerState);
    }
  });
}

// Rate limit helper: socketId -> message timestamps
const chatRateLimits = new Map<string, number[]>();
// Draw rate limit helper: socketId -> { lastTime: number, count: number }
const drawRateLimits = new Map<string, { lastTime: number; count: number }>();

// Profanity list placeholder
const PROFANITY_REGEX = /bastard|fuck|shit|asshole|bitch|crap/gi;
function sanitizeText(text: string): string {
  return text.replace(PROFANITY_REGEX, '[REDACTED]');
}

// AI feed helper
function pushAIAnnouncement(chamberId: string, text: string) {
  const session = activeSessions.get(chamberId);
  if (!session) return;

  const msg: ChatMessage = {
    id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    senderId: null,
    senderName: 'SYSTEM CORE',
    text: text.toUpperCase(),
    isSystem: true,
    isAnnouncement: true,
    timestamp: Date.now(),
  };

  io.to(chamberId).emit('chatMessage', msg);
  io.to(chamberId).emit('aiEvent', text);
}

// Check rate limit (5 messages per 2 seconds)
function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  let timestamps = chatRateLimits.get(socketId) || [];
  timestamps = timestamps.filter(t => now - t < 2000);
  
  if (timestamps.length >= 5) {
    return false;
  }
  
  timestamps.push(now);
  chatRateLimits.set(socketId, timestamps);
  return true;
}

// Broadcast general system messages
function pushSystemMessage(chamberId: string, text: string) {
  const msg: ChatMessage = {
    id: `sys-${Date.now()}`,
    senderId: null,
    senderName: 'CHAMBER CONTROLLER',
    text,
    isSystem: true,
    isAnnouncement: false,
    timestamp: Date.now(),
  };
  io.to(chamberId).emit('chatMessage', msg);
}

// Typing indicators state: chamberId -> { playerId: isTyping }
const typingStates = new Map<string, Record<string, boolean>>();

function updateTyping(chamberId: string) {
  const states = typingStates.get(chamberId) || {};
  io.to(chamberId).emit('typingState', states);
}

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle Chamber Creation
  socket.on('createChamber', (codename: string, callback?: (res: { success: boolean; data?: ChamberState; error?: string }) => void) => {
    try {
      const parsed = CreateChamberSchema.safeParse({ codename });
      if (!parsed.success) {
        const errMsg = parsed.error.issues[0].message;
        socket.emit('error', errMsg);
        if (callback) callback({ success: false, error: errMsg });
        return;
      }

      const validatedName = parsed.data.codename;
      const chamberId = generateChamberId();
      const session = createChamber(chamberId, socket.id, validatedName);
      
      socket.join(chamberId);
      socketSessions.set(socket.id, { 
        playerId: socket.id, 
        codename: validatedName, 
        chamberId 
      });

      sendChamberStateToSocket(socket, session);
      pushSystemMessage(chamberId, `SUBJECT ${validatedName.toUpperCase()} INITIALIZED AS HOST.`);
      pushAIAnnouncement(chamberId, `NEW SECURE CHAMBER ${chamberId} ACTIVE.`);
      if (callback) callback({ success: true, data: serializeSession(session) });
    } catch (err: any) {
      socket.emit('error', 'Chamber creation failed.');
      if (callback) callback({ success: false, error: 'Chamber creation failed.' });
    }
  });

  // Handle Chamber Join / Rejoin
  socket.on('joinChamber', (codename: string, chamberId: string, callback?: (res: { success: boolean; data?: ChamberState; error?: string }) => void) => {
    const parsed = JoinChamberSchema.safeParse({ codename, chamberId });
    if (!parsed.success) {
      const errMsg = parsed.error.issues[0].message;
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    const validatedName = parsed.data.codename;
    const cleanChamberId = parsed.data.chamberId;
    const session = activeSessions.get(cleanChamberId);

    if (!session) {
      const errMsg = 'CHAMBER OFFLINE OR DESTROYED.';
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    // Check if player is rejoining (based on codename match)
    const existingPlayer = session.players.find(p => p.codename.toLowerCase() === validatedName.toLowerCase());

    if (existingPlayer) {
      if (existingPlayer.isOnline) {
        const errMsg = 'IDENTITY DUPLICATION DETECTED. CHOOSE ANOTHER NICKNAME.';
        socket.emit('error', errMsg);
        if (callback) callback({ success: false, error: errMsg });
        return;
      }

      // Reconnect Player
      const oldSocketId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.isOnline = true;
      existingPlayer.disconnectTime = null;

      // Transfer session index mapping
      socketSessions.set(socket.id, { 
        playerId: socket.id, 
        codename: validatedName, 
        chamberId: cleanChamberId 
      });

      // Update drawer socket ID if they were drawing
      if (session.drawerId === oldSocketId) {
        session.drawerId = socket.id;
      }

      socket.join(cleanChamberId);
      sendChamberStateToSocket(socket, session);
      
      pushSystemMessage(cleanChamberId, `SUBJECT ${validatedName.toUpperCase()} RE-ESTABLISHED UPLINK.`);
      pushAIAnnouncement(cleanChamberId, `SUBJECT ${validatedName.toUpperCase()} RECONNECTED.`);
      
      saveSessionToRedis(session);
      broadcastChamberState(session);
      if (callback) callback({ success: true, data: serializeSession(session) });
      return;
    }

    // Prevent duplicate join mapping from same socket ID
    const alreadyConnected = session.players.some(p => p.id === socket.id);
    if (alreadyConnected) {
      const errMsg = 'IDENTITY DUPLICATION DETECTED.';
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    // Spectator Mode Check
    const activePlayersCount = session.players.filter(p => !p.isSpectator).length;
    const isSpectator = activePlayersCount >= session.config.maxPlayers;

    const newPlayer: Player = {
      id: socket.id,
      codename: validatedName,
      score: 0,
      isHost: false,
      isOnline: true,
      isVerified: false,
      isDrawer: false,
      disconnectTime: null,
      isSpectator
    };

    session.players.push(newPlayer);
    socketSessions.set(socket.id, { 
      playerId: socket.id, 
      codename: validatedName, 
      chamberId: cleanChamberId 
    });

    socket.join(cleanChamberId);
    
    if (isSpectator) {
      pushSystemMessage(cleanChamberId, `SUBJECT ${validatedName.toUpperCase()} INTEGRATED AS SPECTATOR.`);
      pushAIAnnouncement(cleanChamberId, `SPECTATOR MODE ENGAGED.`);
    } else {
      pushSystemMessage(cleanChamberId, `SUBJECT ${validatedName.toUpperCase()} INTEGRATED.`);
      pushAIAnnouncement(cleanChamberId, `SUBJECT COUNT: ${session.players.filter(p => !p.isSpectator).length}.`);
    }

    saveSessionToRedis(session);
    broadcastChamberState(session);
    if (callback) callback({ success: true, data: serializeSession(session) });
  });

  // Host Configuration Update
  socket.on('updateConfig', (config: ChamberConfig, callback?: (res: { success: boolean; error?: string }) => void) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    // Verify host
    const player = session.players.find(p => p.id === socket.id);
    if (!player || !player.isHost || player.isSpectator) {
      const errMsg = 'HOST STATUS REQUIRED FOR PROTOCOL MUTATION.';
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    // Zod validation
    const parsed = ConfigSchema.safeParse(config);
    if (!parsed.success) {
      const errMsg = parsed.error.issues[0].message;
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    const validatedConfig = parsed.data;

    // Apply config
    session.config.maxPlayers = validatedConfig.maxPlayers;
    session.config.drawTime = validatedConfig.drawTime;
    session.config.cycles = validatedConfig.cycles;
    session.config.wordPack = validatedConfig.wordPack;
    session.config.customWords = validatedConfig.customWords;

    // Reset game state to LOBBY if coming from FINAL_RESULTS (game complete restart)
    if (session.phase === 'FINAL_RESULTS') {
      session.phase = 'LOBBY';
      session.currentCycle = 1;
      session.drawerId = null;
      session.drawerIndex = -1;
      session.chosenWord = null;
      session.timer = 0;
      session.hints = '';
      session.revealedIndices = [];
      session.canvasHistory = [];
      session.players.forEach(p => {
        p.score = 0;
        p.isVerified = false;
        p.isDrawer = false;
      });
      pushAIAnnouncement(sessionDetails.chamberId, 'ESCAPE CYCLE TERMINATED. PROTOCOLS RESTORED TO LOBBY.');
    }

    saveSessionToRedis(session);
    broadcastChamberState(session);
    pushSystemMessage(sessionDetails.chamberId, `CHAMBER PROTOCOLS MUTATED BY HOST.`);
    if (callback) callback({ success: true });
  });

  // Start the Game
  socket.on('startGame', (callback?: (res: { success: boolean; error?: string }) => void) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    const player = session.players.find(p => p.id === socket.id);
    if (!player || !player.isHost || player.isSpectator) {
      const errMsg = 'HOST STATUS REQUIRED.';
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    const activePlayersCount = session.players.filter(p => !p.isSpectator).length;
    if (activePlayersCount < 2) { // 3-12 suggested, allow 2 minimum for easy testing
      const errMsg = 'MINIMUM 2 ACTIVE SUBJECTS REQUIRED FOR STABILITY.';
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    session.currentCycle = 1;
    session.drawerIndex = -1;
    session.canvasHistory = [];

    pushAIAnnouncement(sessionDetails.chamberId, 'CHAMBER SEALED. SURVIVAL PROTOCOL ESCAPE_V1 ENGAGED.');
    socket.to(sessionDetails.chamberId).emit('playAudio', 'lock');
    socket.emit('playAudio', 'lock');

    startWordSelection(session, () => {
      broadcastChamberState(session);
    });
    if (callback) callback({ success: true });
  });

  // Word selection by drawer
  socket.on('selectWord', (word: string, callback?: (res: { success: boolean; error?: string }) => void) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session || session.phase !== 'WORD_SELECTION' || session.drawerId !== socket.id) {
      if (callback) callback({ success: false, error: 'NOT_DRAWER' });
      return;
    }

    // Zod validation
    const parsed = SelectWordSchema.safeParse(word);
    if (!parsed.success) {
      const errMsg = parsed.error.issues[0].message;
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    const validatedWord = parsed.data;

    // Validate option
    if (!session.wordOptions.includes(validatedWord)) {
      const errMsg = 'INVALID SECURITY CODE.';
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    selectWord(session, socket.id, validatedWord, () => {
      broadcastChamberState(session);
    });

    pushAIAnnouncement(sessionDetails.chamberId, `SURVIVAL CODE GENERATED. VENTILATING OXYGEN...`);
    if (callback) callback({ success: true });
  });

  // Batched Drawing strokes
  socket.on('drawStroke', (stroke: CompressedStroke, callback?: (res: { success: boolean; error?: string }) => void) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session || session.phase !== 'DRAWING' || session.drawerId !== socket.id) {
      if (callback) callback({ success: false, error: 'NOT_DRAWER' });
      return;
    }

    // Zod validation
    const parsed = StrokeSchema.safeParse(stroke);
    if (!parsed.success) {
      const errMsg = parsed.error.issues[0].message;
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    // Rate Limit Check
    const now = Date.now();
    const limit = drawRateLimits.get(socket.id) || { lastTime: now, count: 0 };
    if (now - limit.lastTime > 1000) {
      limit.lastTime = now;
      limit.count = 0;
    }
    limit.count++;
    drawRateLimits.set(socket.id, limit);
    if (limit.count > 45) {
      socket.emit('error', 'RATE LIMIT EXCEEDED: DRAWING STROKES THROTTLED.');
      if (callback) callback({ success: false, error: 'Throttled' });
      return;
    }

    const validatedStroke = parsed.data as CompressedStroke;

    // Anti-cheat: prevent oversized payloads
    if (validatedStroke.points.length > 500) {
      const errMsg = 'STROKE BATCH EXCEEDS BANDWIDTH LIMITS.';
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    // Save stroke and broadcast
    session.canvasHistory.push(validatedStroke);
    socket.to(sessionDetails.chamberId).emit('drawStroke', validatedStroke);
    if (callback) callback({ success: true });
  });

  socket.on('clearCanvas', (callback?: (res: { success: boolean; error?: string }) => void) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session || session.phase !== 'DRAWING' || session.drawerId !== socket.id) {
      if (callback) callback({ success: false, error: 'NOT_DRAWER' });
      return;
    }

    session.canvasHistory = [];
    io.to(sessionDetails.chamberId).emit('clearCanvas');
    if (callback) callback({ success: true });
  });

  socket.on('undoStroke', (callback?: (res: { success: boolean; error?: string }) => void) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session || session.phase !== 'DRAWING' || session.drawerId !== socket.id) {
      if (callback) callback({ success: false, error: 'NOT_DRAWER' });
      return;
    }

    session.canvasHistory.pop();
    io.to(sessionDetails.chamberId).emit('undoStroke');
    if (callback) callback({ success: true });
  });

  // Guess Chat Messages
  socket.on('sendMessage', (text: string, callback?: (res: { success: boolean; error?: string }) => void) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    // Rate Limit Check
    if (!checkRateLimit(socket.id)) {
      socket.emit('error', 'AI CORE: MESSAGE TRANSMISSION THROTTLED (RATE LIMIT).');
      if (callback) callback({ success: false, error: 'Throttled' });
      return;
    }

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session) {
      if (callback) callback({ success: false, error: 'NO_SESSION' });
      return;
    }

    const sender = session.players.find(p => p.id === socket.id);
    if (!sender) {
      if (callback) callback({ success: false, error: 'NO_PLAYER' });
      return;
    }

    // Zod validation
    const parsed = SendMessageSchema.safeParse(text);
    if (!parsed.success) {
      const errMsg = parsed.error.issues[0].message;
      socket.emit('error', errMsg);
      if (callback) callback({ success: false, error: errMsg });
      return;
    }

    const validatedText = parsed.data;

    // Sanitize input (strip simple HTML/script tags)
    const cleanText = sanitizeText(validatedText)
      .replace(/<[^>]*>?/gm, '');

    if (!cleanText.trim()) {
      if (callback) callback({ success: false, error: 'Message cannot be empty' });
      return;
    }
    
    // Check if in Drawing phase and word matches
    if (session.phase === 'DRAWING') {
      const isDrawer = session.drawerId === socket.id;
      const isMatch = session.chosenWord && cleanText.toLowerCase() === session.chosenWord;

      if (isMatch) {
        if (isDrawer) {
          socket.emit('error', 'SECURITY THREAT: DRAWER CANNOT REVEAL CODE.');
          if (callback) callback({ success: false, error: 'Drawer cannot guess' });
          return;
        }

        if (sender.isSpectator) {
          socket.emit('error', 'SPECTATORS CANNOT SUBMIT ESCAPE CODES.');
          if (callback) callback({ success: false, error: 'Spectators cannot guess' });
          return;
        }

        if (sender.isVerified) {
          socket.emit('error', 'IDENTITY ALREADY VERIFIED.');
          if (callback) callback({ success: false, error: 'Already verified' });
          return;
        }

        // Correct Guess
        const pointsGained = handleGuessScore(session, sender, () => {
          broadcastChamberState(session);
        });
        pushSystemMessage(sessionDetails.chamberId, `SUBJECT ${sender.codename.toUpperCase()} — IDENTITY VERIFIED (+${pointsGained} Oxygen Points)`);
        
        // Play success chime
        io.to(sessionDetails.chamberId).emit('playAudio', 'chime');

        // Contextual AI Core Announcements
        if (session.config.drawTime - session.timer <= 10) {
          pushAIAnnouncement(sessionDetails.chamberId, `SUBJECT ${sender.codename.toUpperCase()} — RESPONSE EFFICIENCY HIGH.`);
        }

        saveSessionToRedis(session);
        broadcastChamberState(session);
        if (callback) callback({ success: true });
        return;
      }
    }

    // Normal chat message routing
    const chatMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      senderId: socket.id,
      senderName: sender.codename,
      text: cleanText,
      isSystem: false,
      isAnnouncement: false,
      timestamp: Date.now()
    };

    // If player has solved the word in drawing phase, hide their text from unsolved players
    if (session.phase === 'DRAWING' && sender.isVerified) {
      chatMsg.isVerification = true; // Mark as verified chat
      
      // Send to verified players and the drawer only
      session.players.forEach(p => {
        if (p.isOnline && (p.isVerified || p.id === session.drawerId)) {
          io.to(p.id).emit('chatMessage', chatMsg);
        }
      });
      if (callback) callback({ success: true });
      return;
    }

    // Normal message to all
    io.to(sessionDetails.chamberId).emit('chatMessage', chatMsg);
    if (callback) callback({ success: true });
  });

  // Typing indicator
  socket.on('setTyping', (isTyping: boolean) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    let states = typingStates.get(sessionDetails.chamberId) || {};
    states[sessionDetails.playerId] = isTyping;
    typingStates.set(sessionDetails.chamberId, states);

    updateTyping(sessionDetails.chamberId);
  });

  // Host Player Kick
  socket.on('kickPlayer', (targetPlayerId: string) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session) return;

    // Check host authority
    const host = session.players.find(p => p.id === socket.id);
    if (!host || !host.isHost) {
      socket.emit('error', 'HOST PRIVILEGES REQUIRED.');
      return;
    }

    const targetPlayer = session.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) return;

    pushSystemMessage(sessionDetails.chamberId, `SUBJECT ${targetPlayer.codename.toUpperCase()} EXILED BY HOST.`);
    pushAIAnnouncement(sessionDetails.chamberId, `SUBJECT ELIMINATED.`);

    // Remove player
    session.players = session.players.filter(p => p.id !== targetPlayerId);
    
    // If target player is connected, notify them and force leave
    const targetSocket = io.sockets.sockets.get(targetPlayerId);
    if (targetSocket) {
      targetSocket.emit('error', 'YOU HAVE BEEN EXILED FROM THE CHAMBER.');
      targetSocket.leave(sessionDetails.chamberId);
    }

    // If game is in progress and drawer got kicked, skip round
    if (session.phase !== 'LOBBY' && session.drawerId === targetPlayerId) {
      endRound(session, () => {
        broadcastChamberState(session);
      });
    } else {
      saveSessionToRedis(session);
      broadcastChamberState(session);
    }
  });

  // Leave Chamber Explicitly
  socket.on('leaveChamber', () => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const { chamberId } = sessionDetails;
    const session = activeSessions.get(chamberId);
    if (!session) return;

    pushSystemMessage(chamberId, `SUBJECT ${sessionDetails.codename.toUpperCase()} DISCONNECTED.`);
    
    // Remove player from session
    session.players = session.players.filter(p => p.id !== socket.id);
    socketSessions.delete(socket.id);
    socket.leave(chamberId);

    // If room is empty, clean up
    if (session.players.length === 0) {
      clearSessionTimers(session);
      activeSessions.delete(chamberId);
      delVal(`chamber:${chamberId}`);
      return;
    }

    // If host left, delegate host
    const hostIndex = session.players.findIndex(p => p.isHost);
    if (hostIndex === -1 && session.players.length > 0) {
      session.players[0].isHost = true;
      pushSystemMessage(chamberId, `SUBJECT ${session.players[0].codename.toUpperCase()} ELEVATED TO HOST.`);
    }

    // If in progress and drawer left, end round
    if (session.phase !== 'LOBBY' && session.drawerId === socket.id) {
      endRound(session, () => {
        broadcastChamberState(session);
      });
    } else {
      saveSessionToRedis(session);
      broadcastChamberState(session);
    }
  });

  // Socket Disconnection (e.g. tab closed or wifi dropped)
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const { chamberId, playerId, codename } = sessionDetails;
    const session = activeSessions.get(chamberId);
    if (!session) return;

    const player = session.players.find(p => p.id === socket.id);
    if (player) {
      player.isOnline = false;
      player.disconnectTime = Date.now();
      
      pushSystemMessage(chamberId, `SUBJECT ${codename.toUpperCase()} CONNECTION INTERRUPTED.`);
      pushAIAnnouncement(chamberId, `SUBJECT OFFLINE. RECONNECT TIMEOUT ENGAGED.`);

      // Immediate Host Transfer
      if (player.isHost) {
        const nextHost = session.players.find(p => p.isOnline && p.id !== socket.id && !p.isSpectator);
        if (nextHost) {
          player.isHost = false;
          nextHost.isHost = true;
          pushSystemMessage(chamberId, `SUBJECT ${nextHost.codename.toUpperCase()} ELEVATED TO HOST (PREVIOUS HOST CONNECTION INTERRUPTED).`);
        }
      }

      // Update typing indicator
      const states = typingStates.get(chamberId) || {};
      delete states[playerId];
      typingStates.set(chamberId, states);
      updateTyping(chamberId);

      saveSessionToRedis(session);
      broadcastChamberState(session);

      // Reconnect Grace Timer (60 seconds)
      setTimeout(async () => {
        const currentSession = activeSessions.get(chamberId);
        if (!currentSession) return;

        const checkPlayer = currentSession.players.find(p => p.codename === codename);
        if (checkPlayer && !checkPlayer.isOnline) {
          // Permanently delete player or convert to spectator if game in progress
          if (currentSession.phase === 'LOBBY') {
            currentSession.players = currentSession.players.filter(p => p.codename !== codename);
            pushSystemMessage(chamberId, `SUBJECT ${codename.toUpperCase()} EXPUNGED FROM CHAMBER.`);
          } else {
            pushSystemMessage(chamberId, `SUBJECT ${codename.toUpperCase()} RECONNECTION ATTEMPTS EXPIRED. SYSTEM CONTAINED.`);
            // If they are drawer and offline, end round
            if (currentSession.drawerId === checkPlayer.id) {
              endRound(currentSession, () => {
                broadcastChamberState(currentSession);
              });
              return;
            }
          }
          
          // Double check host status if they got expunged
          if (checkPlayer.isHost) {
            const nextHost = currentSession.players.find(p => p.isOnline && !p.isSpectator);
            if (nextHost) {
              nextHost.isHost = true;
              pushSystemMessage(chamberId, `SUBJECT ${nextHost.codename.toUpperCase()} ELEVATED TO HOST.`);
            }
          }

          saveSessionToRedis(currentSession);
          broadcastChamberState(currentSession);
        }
      }, 60000);
    }

    socketSessions.delete(socket.id);
  });
});

app.get('/health', (req, res) => {
  res.send({ status: 'active', activeChambers: activeSessions.size });
});

// Bootstrapper
(async () => {
  await initRedis();
  httpServer.listen(PORT, () => {
    console.log(`AI Chamber Escape Server is running on port ${PORT}`);
  });
})();
