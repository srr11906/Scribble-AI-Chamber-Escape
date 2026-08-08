import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChamberState, ChamberConfig } from 'shared';
import { LandingScreen } from './components/LandingScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { audioSystem } from './components/AudioSystem';
import { Eye } from 'lucide-react';

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
  
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobileDevice(mobile);

    if (mobile) {
      try {
        const prompted = sessionStorage.getItem('fullscreen_prompted');
        if (!prompted) {
          setShowFullscreenPrompt(true);
        }
      } catch (e) {
        // Fallback for private mode without session storage access
        setShowFullscreenPrompt(true);
      }
    }
  }, []);

  const handleEngageFullscreen = () => {
    try {
      sessionStorage.setItem('fullscreen_prompted', 'true');
    } catch (e) {
      console.warn("Storage write blocked.");
    }
    setShowFullscreenPrompt(false);
    
    const doc = document.documentElement;
    try {
      if (doc.requestFullscreen) doc.requestFullscreen();
      // @ts-ignore
      else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
      // @ts-ignore
      else if (doc.mozRequestFullScreen) doc.mozRequestFullScreen();
      // @ts-ignore
      else if (doc.msRequestFullscreen) doc.msRequestFullscreen();
    } catch (e) {
      console.warn("Fullscreen request denied or unsupported.");
    }
    
    audioSystem.playOpen();
  };

  const handleDismissFullscreen = () => {
    try {
      sessionStorage.setItem('fullscreen_prompted', 'true');
    } catch (e) {
      console.warn("Storage write blocked.");
    }
    setShowFullscreenPrompt(false);
    audioSystem.playBeep();
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
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

    newSocket.on('canvasRestore', (history: any[]) => {
      setChamberState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          canvasHistory: history,
        };
      });
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
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-chamber-bg select-none">
      {screenContent}

      {/* Mobile Fullscreen holographic prompt modal */}
      {showFullscreenPrompt && isMobileDevice && (
        <div className="fixed inset-0 bg-chamber-bg/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 select-none">
          <div className="hologram-panel border border-chamber-cyan/30 rounded-xl p-5 w-full max-w-sm text-center flex flex-col items-center shadow-cyan-glow relative">
            <div className="absolute top-2 left-2 font-mono text-[6px] text-chamber-cyan/50 tracking-widest uppercase">
              SYS_UI_CALIBRATION
            </div>
            
            <div className="w-10 h-10 rounded-full border border-chamber-cyan/20 flex items-center justify-center text-chamber-cyan bg-chamber-cyan/5 mb-3 animate-pulse">
              <Eye className="w-5 h-5" />
            </div>

            <h3 className="text-xs font-cyber font-black tracking-widest text-chamber-cyan uppercase mb-1.5">
              OPTIMIZE UPLINK DISPLAY
            </h3>
            
            <p className="text-[8px] text-chamber-secondary uppercase tracking-wider leading-relaxed mb-4">
              To stabilize neural interfaces and prevent layout cropping, engage fullscreen display.
            </p>

            {/* iOS specific tip */}
            {/iPhone|iPod/i.test(navigator.userAgent) && (
              <div className="border border-chamber-cyan/10 bg-chamber-surface/30 px-2.5 py-1.5 rounded text-[7px] text-chamber-secondary uppercase tracking-widest leading-normal mb-4 text-left">
                💡 iOS DETECTED: For native fullscreen, tap browser <span className="text-chamber-cyan font-bold">Share</span> and select <span className="text-chamber-cyan font-bold">"Add to Home Screen"</span>.
              </div>
            )}

            <div className="flex flex-col gap-1.5 w-full">
              <button
                onClick={handleEngageFullscreen}
                className="w-full py-2 bg-chamber-cyan text-chamber-bg font-cyber font-bold tracking-widest text-[10px] rounded-lg shadow-cyan-glow hover:bg-chamber-cyan/90 transition-all cursor-pointer"
              >
                ENGAGE FULLSCREEN
              </button>
              <button
                onClick={handleDismissFullscreen}
                className="w-full py-1.5 border border-chamber-cyan/25 text-chamber-secondary font-cyber tracking-widest text-[8px] rounded-lg hover:border-chamber-cyan/45 transition-all cursor-pointer"
              >
                SKIP CALIBRATION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
