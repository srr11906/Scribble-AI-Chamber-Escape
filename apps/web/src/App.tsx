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

  const [sharedChamberId] = useState(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/r\/([A-Z0-9]{6})$/i);
    return match ? match[1].toUpperCase() : '';
  });

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to AI Chamber security uplink.');
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
  if (!chamberState) {
    return (
      <LandingScreen
        initialChamberId={sharedChamberId}
        onCreateChamber={handleCreateChamber}
        onJoinChamber={handleJoinChamber}
        error={error}
        audioMuted={audioMuted}
        onToggleAudio={handleToggleAudio}
      />
    );
  }

  if (chamberState.phase === 'LOBBY') {
    return (
      <LobbyScreen
        state={chamberState}
        myId={socket?.id || ''}
        onUpdateConfig={handleUpdateConfig}
        onStartGame={handleStartGame}
        onKickPlayer={handleKickPlayer}
        onLeaveChamber={handleLeaveChamber}
      />
    );
  }

  // Active game phases (WORD_SELECTION, DRAWING, ROUND_RESULTS, FINAL_RESULTS)
  return (
    <GameScreen
      state={chamberState}
      myId={socket?.id || ''}
      socket={socket}
      audioMuted={audioMuted}
      onToggleAudio={handleToggleAudio}
      onLeaveChamber={handleLeaveChamber}
    />
  );
};

export default App;
