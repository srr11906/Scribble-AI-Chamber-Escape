import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChamberState, ChamberConfig } from 'shared';
import { LandingScreen } from './components/LandingScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { audioSystem } from './components/AudioSystem';
import { Eye, Layers } from 'lucide-react';
import { VoiceProvider, useVoice } from './voice/VoiceContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

const AppContent: React.FC<{ socket: Socket | null }> = ({ socket }) => {
  const [chamberState, setChamberState] = useState<ChamberState | null>(null);
  const [codename, setCodename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const { autoplayBlocked, resumeBlockedAudio, joinVoice, leaveVoice, connectionStatus, voiceError, clearVoiceError } = useVoice();

  const [sharedChamberId] = useState<string>(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/r\/([A-Z0-9]{6})$/i);
    return match ? match[1].toUpperCase() : '';
  });
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [prevPhase, setPrevPhase] = useState<string | null>(null);
  const [showHomescreenPrompt, setShowHomescreenPrompt] = useState(false);

  useEffect(() => {
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    setIsMobileDevice(mobile);

    if (mobile) {
      try {
        const prompted = sessionStorage.getItem('fullscreen_prompted');
        if (!prompted) {
          setShowFullscreenPrompt(true);
        }
      } catch (e) {
        setShowFullscreenPrompt(true);
      }
    }
  }, []);

  // Capture PWA deferred install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Track phase transitions for homescreen prompt trigger
  useEffect(() => {
    if (chamberState) {
      if (prevPhase === 'FINAL_RESULTS' && chamberState.phase === 'LOBBY' && isMobileDevice) {
        setShowHomescreenPrompt(true);
      }
      setPrevPhase(chamberState.phase);
    } else {
      setPrevPhase(null);
    }
  }, [chamberState, prevPhase, isMobileDevice]);

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

  // Register socket listeners on the connection
  useEffect(() => {
    if (!socket) return;

    if (socket.connected) {
      setIsConnected(true);
    }

    const onConnect = () => {
      console.log('Connected to AI Chamber security uplink.');
      setIsConnected(true);
      setError(null);
    };

    const onConnectError = () => {
      setIsConnected(false);
    };

    const onChamberUpdated = (state: ChamberState) => {
      setChamberState(state);
      setError(null);
    };

    const onCanvasRestore = (history: any[]) => {
      setChamberState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          canvasHistory: history,
        };
      });
    };

    const onError = (message: string) => {
      setError(message);
      audioSystem.playBuzz();
    };

    const onDisconnect = () => {
      console.warn('Uplink interrupted. Attempting reconnection...');
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('chamberUpdated', onChamberUpdated);
    socket.on('canvasRestore', onCanvasRestore);
    socket.on('error', onError);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('chamberUpdated', onChamberUpdated);
      socket.off('canvasRestore', onCanvasRestore);
      socket.off('error', onError);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  // Synchronize WebRTC voice lifecycle based on chamber join status
  useEffect(() => {
    if (chamberState) {
      if (connectionStatus === 'DISCONNECTED') {
        joinVoice().catch(err => console.error('Failed to join voice room:', err));
      }
    } else {
      if (connectionStatus !== 'DISCONNECTED') {
        leaveVoice();
      }
    }
  }, [chamberState, connectionStatus, joinVoice, leaveVoice]);

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

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={handleEngageFullscreen}
                className="w-full py-2 bg-chamber-cyan text-chamber-bg font-cyber tracking-widest font-black uppercase text-[9px] rounded-lg shadow-cyan-glow cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                ENGAGE FULLSCREEN
              </button>
              <button
                onClick={handleDismissFullscreen}
                className="w-full py-1.5 border border-chamber-secondary/25 text-chamber-secondary font-cyber tracking-widest uppercase text-[8px] rounded-lg cursor-pointer transition-all hover:text-white"
              >
                STAY WINDOWED
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Autoplay Blocked Alert banner */}
      {autoplayBlocked && (
        <div 
          onClick={resumeBlockedAudio}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-chamber-cyan text-chamber-bg border border-chamber-cyan shadow-cyan-glow font-cyber uppercase tracking-widest text-[9px] font-black px-4 py-2.5 rounded-lg cursor-pointer z-[250] hover:scale-105 active:scale-95 transition-all text-center animate-pulse animate-duration-1000"
        >
          ⚠️ TAP HERE TO UNLOCK REMOTE CHAMBER AUDIO STABILIZER
        </div>
      )}

      {/* Voice Error Alert Banner */}
      {voiceError && (
        <div 
          onClick={clearVoiceError}
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-chamber-red text-chamber-text border border-chamber-red/60 shadow-red-glow font-cyber uppercase tracking-widest text-[9px] font-black px-4 py-2.5 rounded-lg cursor-pointer z-[250] hover:scale-105 active:scale-95 transition-all text-center animate-pulse"
        >
          ⚠️ {voiceError} (TAP TO DISMISS)
        </div>
      )}
      {/* Mobile Add to Homescreen holographic prompt overlay */}
      {showHomescreenPrompt && isMobileDevice && (
        <div className="fixed inset-0 bg-chamber-bg/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 select-none">
          <div className="hologram-panel border border-chamber-cyan/30 rounded-xl p-5 w-full max-w-sm text-center flex flex-col items-center shadow-cyan-glow relative animate-crt-flicker">
            <div className="absolute top-2 left-2 font-mono text-[6px] text-chamber-cyan/50 tracking-widest uppercase">
              SYS_LAUNCH_OPTIMIZATION
            </div>
            
            <div className="w-10 h-10 rounded-full border border-chamber-cyan/20 flex items-center justify-center text-chamber-cyan bg-chamber-cyan/5 mb-3 animate-pulse">
              <Layers className="w-5 h-5" />
            </div>

            <h3 className="text-xs font-cyber font-black tracking-widest text-chamber-cyan uppercase mb-1.5">
              ADD TO HOME SCREEN
            </h3>
            
            <p className="text-[8px] text-chamber-secondary uppercase tracking-wider leading-relaxed mb-4">
              Install AI Chamber Escape to your home screen for zero-latency launching, native fullscreen, and stable layouts.
            </p>

            {/* iOS specific guide */}
            {/iPhone|iPod|iPad/i.test(navigator.userAgent) ? (
              <div className="border border-chamber-cyan/10 bg-chamber-surface/30 px-3 py-2 rounded text-[7.5px] text-chamber-secondary uppercase tracking-widest leading-normal mb-4 text-left w-full space-y-1">
                <div className="font-bold text-chamber-cyan flex items-center gap-1">
                  1. TAP SHARE BUTTON
                </div>
                <div className="pl-3">
                  Tap the Safari <span className="text-white font-cyber font-bold">[Share]</span> icon at the bottom.
                </div>
                <div className="font-bold text-chamber-cyan flex items-center gap-1 mt-1.5">
                  2. ADD TO HOME SCREEN
                </div>
                <div className="pl-3">
                  Scroll down and tap <span className="text-white font-cyber font-bold">"Add to Home Screen"</span>.
                </div>
              </div>
            ) : (
              <div className="w-full mb-4">
                <button
                  onClick={() => {
                    const promptEvent = (window as any).deferredInstallPrompt;
                    if (promptEvent) {
                      promptEvent.prompt();
                      promptEvent.userChoice.then((choiceResult: any) => {
                        console.log(`User choice: ${choiceResult.outcome}`);
                        (window as any).deferredInstallPrompt = null;
                      });
                    } else {
                      alert("Tap the three dots menu in the browser address bar and select 'Install app' or 'Add to Home screen'.");
                    }
                    setShowHomescreenPrompt(false);
                    audioSystem.playLock();
                  }}
                  className="w-full py-2 bg-chamber-cyan text-chamber-bg font-cyber tracking-widest font-black uppercase text-[9px] rounded-lg shadow-cyan-glow cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  INSTALL WEB APP
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowHomescreenPrompt(false);
                audioSystem.playBeep();
              }}
              className="text-[8px] text-chamber-secondary hover:text-chamber-red uppercase tracking-widest font-cyber cursor-pointer transition-colors mt-2"
            >
              [ DISMISS AND CONTINUE ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);

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

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <VoiceProvider socket={socket}>
      <AppContent socket={socket} />
    </VoiceProvider>
  );
};

export default App;
