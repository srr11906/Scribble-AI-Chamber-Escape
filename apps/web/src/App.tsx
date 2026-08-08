import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChamberState, ChamberConfig } from 'shared';
import { LandingScreen } from './components/LandingScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { audioSystem } from './components/AudioSystem';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chamberState, setChamberState] = useState<ChamberState | null>(null);
  const [codename, setCodename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(true);

  const [sharedChamberId] = useState<string>(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/r\/([A-Z0-9]{6})$/i);
    return match ? match[1].toUpperCase() : '';
  });
  const [isConnected, setIsConnected] = useState(false);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to AI Chamber security uplink.');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
    });

    newSocket.on('chamberUpdated', (state: ChamberState) => {
      setChamberState(state);
      setError(null);
    });

    newSocket.on('error', (message: string) => {
      setError(message);
      audioSystem.playBuzz();
    });

    newSocket.on('disconnect', () => {
      console.warn('Uplink interrupted. Attempting reconnection...');
      setIsConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Pre-fill Join Room Tab if link contains code
  useEffect(() => {
    const sharedId = sharedChamberId;
    if (sharedId && socket) {
      console.log(`Shared Chamber ID detected: ${sharedId}`);
    }
  }, [socket, sharedChamberId]);

  const handleToggleAudio = () => {
    const nextMute = !audioMuted;
    setAudioMuted(nextMute);
    audioSystem.setMute(nextMute);
    
    // Play interaction beep
    if (!nextMute) {
      audioSystem.playBeep();
    }
  };

  const handleCreateChamber = (name: string) => {
    if (!socket) return;
    setCodename(name);
    socket.emit('createChamber', name);
  };

  const handleJoinChamber = (name: string, roomId: string) => {
    if (!socket) return;
    setCodename(name);
    socket.emit('joinChamber', name, roomId);
  };

  const handleUpdateConfig = (config: ChamberConfig) => {
    if (!socket) return;
    socket.emit('updateConfig', config);
  };

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('startGame');
  };

  const handleKickPlayer = (playerId: string) => {
    if (!socket) return;
    socket.emit('kickPlayer', playerId);
  };

  const handleLeaveChamber = () => {
    if (!socket) return;
    socket.emit('leaveChamber');
    setChamberState(null);
    setCodename('');
    setError(null);
    // Clear URL path to reset state
    window.history.pushState({}, '', '/');
  };

  // Determine what screen to render
  let screenContent;
  if (!chamberState) {
    screenContent = (
      <LandingScreen
        initialChamberId={sharedChamberId}
        onCreateChamber={handleCreateChamber}
        onJoinChamber={handleJoinChamber}
        error={error}
        audioMuted={audioMuted}
        onToggleAudio={handleToggleAudio}
      />
    );
  } else if (chamberState.phase === 'LOBBY') {
    screenContent = (
      <LobbyScreen
        state={chamberState}
        myId={socket?.id || ''}
        onUpdateConfig={handleUpdateConfig}
        onStartGame={handleStartGame}
        onKickPlayer={handleKickPlayer}
        onLeaveChamber={handleLeaveChamber}
      />
    );
  } else {
    screenContent = (
      <GameScreen
        state={chamberState}
        myId={socket?.id || ''}
        socket={socket}
        audioMuted={audioMuted}
        onToggleAudio={handleToggleAudio}
        onLeaveChamber={handleLeaveChamber}
      />
    );
  }

  return (
    <div className="relative w-full h-[100dvh] min-h-0 overflow-hidden bg-chamber-bg">
      {/* Global connection status indicator */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-[60] bg-chamber-surface/60 backdrop-blur-sm px-2 py-0.5 rounded border border-chamber-cyan/10 pointer-events-none select-none">
        <span className={`w-1.2 h-1.2 rounded-full ${isConnected ? 'bg-chamber-cyan animate-pulse shadow-cyan-glow' : 'bg-chamber-red animate-ping shadow-red-glow'}`} />
        <span className="font-mono text-[6px] text-chamber-secondary uppercase tracking-widest font-cyber">
          {isConnected ? 'UPLINK STABLE' : 'UPLINK INTERRUPTED'}
        </span>
      </div>
      {screenContent}
    </div>
  );
};

export default App;
