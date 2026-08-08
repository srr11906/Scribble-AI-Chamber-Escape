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
  StrokeSegment, 
  ChatMessage 
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
    if (player.id === session.drawerId || player.isVerified) {
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
}

function broadcastChamberState(session: ChamberSession) {
  const state = serializeSession(session);
  session.players.forEach(p => {
    const playerSocket = io.sockets.sockets.get(p.id);
    if (playerSocket) {
      const playerState = { ...state };
      if (session.phase === 'DRAWING') {
        if (p.id === session.drawerId || p.isVerified) {
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
  socket.on('createChamber', (codename: string) => {
    try {
      const chamberId = generateChamberId();
      const session = createChamber(chamberId, socket.id, codename.trim());
      
      socket.join(chamberId);
      socketSessions.set(socket.id, { 
        playerId: socket.id, 
        codename: codename.trim(), 
        chamberId 
      });

      sendChamberStateToSocket(socket, session);
      pushSystemMessage(chamberId, `SUBJECT ${codename.toUpperCase()} INITIALIZED AS HOST.`);
      pushAIAnnouncement(chamberId, `NEW SECURE CHAMBER ${chamberId} ACTIVE.`);
    } catch (err: any) {
      socket.emit('error', 'Chamber creation failed.');
    }
  });

  // Handle Chamber Join / Rejoin
  socket.on('joinChamber', (codename: string, chamberId: string) => {
    const cleanChamberId = chamberId.toUpperCase().trim();
    const session = activeSessions.get(cleanChamberId);

    if (!session) {
      socket.emit('error', 'CHAMBER OFFLINE OR DESTROYED.');
      return;
    }

    const trimmedName = codename.trim();

    // Check if player is rejoining (based on codename match)
    const existingPlayer = session.players.find(p => p.codename.toLowerCase() === trimmedName.toLowerCase());

    if (existingPlayer) {
      if (existingPlayer.isOnline) {
        // Prevent duplicate online connections with same player ID/codename
        socket.emit('error', 'IDENTITY DUPLICATION DETECTED. CHOOSE ANOTHER NICKNAME.');
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
        codename: trimmedName, 
        chamberId: cleanChamberId 
      });

      // Update drawer socket ID if they were drawing
      if (session.drawerId === oldSocketId) {
        session.drawerId = socket.id;
      }

      socket.join(cleanChamberId);
      sendChamberStateToSocket(socket, session);
      
      pushSystemMessage(cleanChamberId, `SUBJECT ${trimmedName.toUpperCase()} RE-ESTABLISHED UPLINK.`);
      pushAIAnnouncement(cleanChamberId, `SUBJECT ${trimmedName.toUpperCase()} RECONNECTED.`);
      
      saveSessionToRedis(session);
      broadcastChamberState(session);
      return;
    }

    // New Player Join Check
    if (session.players.length >= session.config.maxPlayers) {
      socket.emit('error', 'CHAMBER CAPACITY MAXIMIZED.');
      return;
    }

    const newPlayer: Player = {
      id: socket.id,
      codename: trimmedName,
      score: 0,
      isHost: false,
      isOnline: true,
      isVerified: false,
      isDrawer: false,
      disconnectTime: null,
    };

    session.players.push(newPlayer);
    socketSessions.set(socket.id, { 
      playerId: socket.id, 
      codename: trimmedName, 
      chamberId: cleanChamberId 
    });

    socket.join(cleanChamberId);
    pushSystemMessage(cleanChamberId, `SUBJECT ${trimmedName.toUpperCase()} INTEGRATED.`);
    pushAIAnnouncement(cleanChamberId, `SUBJECT COUNT: ${session.players.length}.`);

    saveSessionToRedis(session);
    broadcastChamberState(session);
  });

  // Host Configuration Update
  socket.on('updateConfig', (config: ChamberConfig) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session) return;

    // Verify host
    const player = session.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', 'HOST STATUS REQUIRED FOR PROTOCOL MUTATION.');
      return;
    }

    // Validate config limits
    session.config.maxPlayers = Math.max(3, Math.min(12, config.maxPlayers));
    session.config.drawTime = Math.max(30, Math.min(120, config.drawTime));
    session.config.cycles = Math.max(1, Math.min(10, config.cycles));
    session.config.wordPack = config.wordPack;
    session.config.customWords = config.customWords || [];

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
  });

  // Start the Game
  socket.on('startGame', () => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session) return;

    const player = session.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', 'HOST STATUS REQUIRED.');
      return;
    }

    if (session.players.length < 2) { // 3-12 suggested, allow 2 minimum for easy testing
      socket.emit('error', 'MINIMUM 2 SUBJECTS REQUIRED FOR STABILITY.');
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
  });

  // Word selection by drawer
  socket.on('selectWord', (word: string) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session || session.phase !== 'WORD_SELECTION' || session.drawerId !== socket.id) return;

    // Validate option
    if (!session.wordOptions.includes(word)) {
      socket.emit('error', 'INVALID SECURITY CODE.');
      return;
    }

    selectWord(session, socket.id, word, () => {
      broadcastChamberState(session);
    });

    pushAIAnnouncement(sessionDetails.chamberId, `SURVIVAL CODE GENERATED. VENTILATING OXYGEN...`);
  });

  // Batched Drawing strokes
  socket.on('drawStroke', (stroke: StrokeSegment) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session || session.phase !== 'DRAWING' || session.drawerId !== socket.id) return;

    // Anti-cheat: prevent oversized payloads
    if (stroke.points.length > 500) {
      socket.emit('error', 'STROKE BATCH EXCEEDS BANDWIDTH LIMITS.');
      return;
    }

    // Save stroke and broadcast
    session.canvasHistory.push(stroke);
    socket.to(sessionDetails.chamberId).emit('drawStroke', stroke);
  });

  socket.on('clearCanvas', () => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session || session.phase !== 'DRAWING' || session.drawerId !== socket.id) return;

    session.canvasHistory = [];
    io.to(sessionDetails.chamberId).emit('clearCanvas');
  });

  socket.on('undoStroke', () => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails) return;

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session || session.phase !== 'DRAWING' || session.drawerId !== socket.id) return;

    session.canvasHistory.pop();
    io.to(sessionDetails.chamberId).emit('undoStroke');
  });

  // Guess Chat Messages
  socket.on('sendMessage', (text: string) => {
    const sessionDetails = socketSessions.get(socket.id);
    if (!sessionDetails || !text.trim()) return;

    // Rate Limit Check
    if (!checkRateLimit(socket.id)) {
      socket.emit('error', 'AI CORE: MESSAGE TRANSMISSION THROTTLED (RATE LIMIT).');
      return;
    }

    const session = activeSessions.get(sessionDetails.chamberId);
    if (!session) return;

    const sender = session.players.find(p => p.id === socket.id);
    if (!sender) return;

    const cleanText = sanitizeText(text.trim());
    
    // Check if in Drawing phase and word matches
    if (session.phase === 'DRAWING') {
      const isDrawer = session.drawerId === socket.id;
      const isMatch = session.chosenWord && cleanText.toLowerCase() === session.chosenWord;

      if (isMatch) {
        if (isDrawer) {
          socket.emit('error', 'SECURITY THREAT: DRAWER CANNOT REVEAL CODE.');
          return;
        }

        if (sender.isVerified) {
          socket.emit('error', 'IDENTITY ALREADY VERIFIED.');
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
      return;
    }

    // Normal message to all
    io.to(sessionDetails.chamberId).emit('chatMessage', chatMsg);
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
