import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { ChamberState, Player, ChatMessage, CompressedStroke } from 'shared';
import { DrawingCanvas } from './DrawingCanvas';
import { 
  Trophy, MessageSquare, Send, Bell, Shield, Zap, Key, 
  Volume2, VolumeX, CheckCircle, ChevronUp, AlertCircle,
  Eye, EyeOff, Copy
} from 'lucide-react';
import { audioSystem } from './AudioSystem';
import confetti from 'canvas-confetti';

interface GameScreenProps {
  state: ChamberState;
  myId: string;
  socket: Socket | null;
  audioMuted: boolean;
  onToggleAudio: () => void;
  onLeaveChamber: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  state,
  myId,
  socket,
  audioMuted,
  onToggleAudio,
  onLeaveChamber,
}) => {
  const { phase, players, timer, hints, drawerId, wordOptions, chosenWord, chamberId, canvasHistory } = state;
  const me = players.find(p => p.id === myId);
  const isDrawer = drawerId === myId;
  const activeDrawer = players.find(p => p.id === drawerId);

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiEvents, setAiEvents] = useState<string[]>([]);
  const [typingPlayers, setTypingPlayers] = useState<Record<string, boolean>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [revealedRanksCount, setRevealedRanksCount] = useState(0);
  const [showWordToDrawer, setShowWordToDrawer] = useState(true);
  const [copied, setCopied] = useState(false);

  // Lock keyboard adjustments for mobile viewports
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleViewportChange = () => {
      const height = vv.height;
      document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    };

    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);
    handleViewportChange();

    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  const handleCopyChamberCode = () => {
    navigator.clipboard.writeText(`${window.location.origin}/r/${chamberId}`);
    setCopied(true);
    audioSystem.playBeep();
    setTimeout(() => setCopied(false), 2000);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const mobileChatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sound listeners from server
  useEffect(() => {
    if (!socket) return;

    const onPlayAudio = (sound: 'hum' | 'beep' | 'chime' | 'buzz' | 'lock' | 'open') => {
      if (sound === 'beep') audioSystem.playBeep();
      if (sound === 'chime') audioSystem.playChime();
      if (sound === 'buzz') audioSystem.playBuzz();
      if (sound === 'lock') audioSystem.playLock();
      if (sound === 'open') audioSystem.playOpen();
    };

    socket.on('playAudio', onPlayAudio);
    return () => {
      socket.off('playAudio', onPlayAudio);
    };
  }, [socket]);

  // Audio system state sync
  useEffect(() => {
    audioSystem.setMute(audioMuted);
  }, [audioMuted]);

  // Handle countdown beeps in the last 5 seconds of Drawing
  useEffect(() => {
    if (phase === 'DRAWING' && timer <= 5 && timer > 0) {
      audioSystem.playBeep();
    }
  }, [timer, phase]);

  // Listen for socket chat and typing indicators
  useEffect(() => {
    if (!socket) return;

    const handleChat = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      if (msg.isAnnouncement) {
        setAiEvents(prev => [msg.text, ...prev].slice(0, 30));
      }
    };

    const handleTyping = (states: Record<string, boolean>) => {
      // Remove self from typing states
      const filtered = { ...states };
      if (me) {
        delete filtered[me.id];
      }
      setTypingPlayers(filtered);
    };

    socket.on('chatMessage', handleChat);
    socket.on('typingState', handleTyping);

    return () => {
      socket.off('chatMessage', handleChat);
      socket.off('typingState', handleTyping);
    };
  }, [socket, me]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    mobileChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingPlayers]);

  // Handle final results sequence (confetti and ranking reveal)
  useEffect(() => {
    if (phase === 'FINAL_RESULTS') {
      // Trigger alarm lock sounds
      audioSystem.playLock();
      
      // Gradually reveal ranks one by one
      setRevealedRanksCount(0);
      const interval = setInterval(() => {
        setRevealedRanksCount(prev => {
          if (prev >= players.length) {
            clearInterval(interval);
            return prev;
          }
          // Play a click sound as each rank is revealed
          audioSystem.playBeep();
          const nextVal = prev + 1;
          
          // Trigger confetti if top 3 is revealed
          const sorted = [...players].sort((a, b) => b.score - a.score);
          const currentRevealingPlayer = sorted[sorted.length - nextVal]; // revealing from bottom to top
          const rank = sorted.indexOf(currentRevealingPlayer) + 1;
          
          if (rank <= 3 && nextVal === players.length) {
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 }
            });
            audioSystem.playChime();
          }

          return nextVal;
        });
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [phase, players]);

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.emit('sendMessage', chatInput);
    setChatInput('');
    handleTypingEmit(false);
  };

  // Emit typing indicator
  const handleTypingEmit = (typing: boolean) => {
    if (!socket) return;
    setIsTyping(typing);
    socket.emit('setTyping', typing);
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    
    if (!isTyping) {
      handleTypingEmit(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingEmit(false);
    }, 1500);
  };

  const handleSelectWord = (word: string) => {
    if (socket) {
      socket.emit('selectWord', word);
      audioSystem.playLock();
    }
  };

  // Sort players for leaderboard
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // SVG circular countdown progress (timer / drawTime)
  const drawTimeMax = state.config.drawTime;
  const timerPercent = (timer / drawTimeMax) * 100;
  const strokeDashoffset = 113 - (113 * timerPercent) / 100;

  return (
    <div 
      className="w-full bg-chamber-bg cyber-grid flex flex-col justify-between overflow-hidden select-none relative"
      style={{ height: 'var(--viewport-height, 100dvh)' }}
    >
      <div className="scanlines animate-scanline" />

      {/* 1. Header Bar */}
      <header className="px-3 py-2 border-b border-chamber-cyan/15 bg-chamber-surface/65 backdrop-blur-md flex justify-between items-center z-30 gap-2">
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0 relative">
          <div>
            <h2 className="text-xs md:text-sm font-cyber font-extrabold text-chamber-cyan tracking-wider">
              <span className="hidden sm:inline">CHAMBER </span>CYCLE {state.currentCycle} / {state.config.cycles}
            </h2>
            <span 
              onClick={handleCopyChamberCode}
              className="text-[8px] text-chamber-secondary hover:text-chamber-cyan font-cyber tracking-widest uppercase flex items-center gap-1 mt-0.5 cursor-pointer transition-colors"
              title="Copy Chamber URL"
            >
              SECTOR IDENT: {chamberId} <Copy size={8} />
            </span>
          </div>
          {copied && (
            <span className="absolute left-0 -bottom-5 bg-chamber-cyan/20 border border-chamber-cyan text-chamber-cyan text-[7px] px-1 py-0.5 rounded font-cyber tracking-widest animate-pulse z-50">
              COPIED CHAMBER LINK
            </span>
          )}
        </div>

        {/* Word hint / Selection header */}
        <div className="flex-1 flex justify-center px-1 sm:px-4 min-w-0">
          {phase === 'DRAWING' && (
            <div className="flex flex-col items-center max-w-full">
              <span className="text-[8px] sm:text-[9px] text-chamber-secondary uppercase tracking-widest font-cyber block text-center truncate w-full">
                {me?.isVerified ? 'SURVIVAL CODE RESOLVED' : 'SURVIVAL CODE HINT'}
              </span>
              <span className="text-xs sm:text-base md:text-xl font-mono tracking-[0.08em] sm:tracking-[0.12em] md:tracking-[0.25em] text-chamber-cyan font-bold glow-cyan select-text uppercase whitespace-nowrap overflow-hidden text-center truncate max-w-[120px] sm:max-w-xs md:max-w-none">
                {me?.isVerified ? (chosenWord || hints) : hints}
              </span>
            </div>
          )}
          {phase === 'WORD_SELECTION' && (
            <div className="text-[10px] md:text-sm font-cyber text-chamber-red animate-pulse tracking-wider md:tracking-widest uppercase truncate">
              {isDrawer ? 'GENERATE ESCAPE CODE...' : `DRAWER ${activeDrawer?.codename.toUpperCase()} CHOOSING`}
            </div>
          )}
          {phase === 'ROUND_RESULTS' && (
            <div className="text-[10px] md:text-sm font-cyber text-chamber-green tracking-wider md:tracking-widest uppercase truncate">
              SCAN COMPLETED
            </div>
          )}
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1.5 shrink-0 z-10">
          {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
            <button
              onClick={() => {
                const doc = document.documentElement;
                if (!document.fullscreenElement) {
                  if (doc.requestFullscreen) doc.requestFullscreen();
                  // @ts-ignore
                  else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
                } else {
                  if (document.exitFullscreen) document.exitFullscreen();
                }
                audioSystem.playBeep();
              }}
              className="p-1 border border-chamber-cyan/20 hover:border-chamber-cyan rounded text-chamber-cyan bg-chamber-bg/60 transition-colors text-[9px] font-cyber px-2"
              title="Toggle Fullscreen"
            >
              FS
            </button>
          )}
          <button
            onClick={onToggleAudio}
            className="p-1 sm:p-1.5 border border-chamber-cyan/20 hover:border-chamber-cyan/50 rounded text-chamber-cyan bg-chamber-bg/60 transition-colors"
          >
            {audioMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            onClick={() => {
              audioSystem.playBuzz();
              onLeaveChamber();
            }}
            className="p-1 sm:px-2 sm:py-1 border border-chamber-red/20 hover:border-chamber-red/60 rounded text-chamber-red bg-chamber-red/5 hover:bg-chamber-red/10 transition-all cursor-pointer flex items-center justify-center"
            title="Abort Match"
          >
            <span className="hidden sm:inline text-[9px] font-cyber tracking-widest px-1">ABORT</span>
            <span className="sm:hidden block px-1 text-[9px] font-cyber font-bold">X</span>
          </button>
        </div>
      </header>

      {/* 2. Main Game Screen Layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col md:flex-row relative overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: Leaderboard & Player List (Desktop only) */}
        <aside className="hidden lg:flex w-64 border-r border-chamber-cyan/15 bg-chamber-surface/30 p-4 flex-col gap-4 overflow-y-auto z-10 shrink-0">
          <div className="flex items-center gap-2 border-b border-chamber-cyan/10 pb-2">
            <Trophy size={14} className="text-chamber-cyan" />
            <h3 className="text-xs font-cyber text-chamber-secondary uppercase tracking-widest">
              Subject Ranking
            </h3>
          </div>
          <div className="space-y-2">
            {sortedPlayers.map((p, idx) => (
              <div
                key={p.id}
                className={`relative flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                  p.id === myId
                    ? 'bg-chamber-cyan/10 border-chamber-cyan/40 shadow-cyan-glow'
                    : 'bg-chamber-bg/60 border-chamber-cyan/5'
                } ${p.isSpectator ? 'opacity-60' : ''}`}
              >
                {p.isVerified && (
                  <div className="absolute -top-1 -right-1 bg-chamber-green text-chamber-bg rounded-full p-0.5 shadow-green-glow z-10">
                    <CheckCircle size={10} />
                  </div>
                )}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-chamber-secondary w-4">
                    {p.isSpectator ? '-' : `#${idx + 1}`}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-cyber uppercase truncate ${p.id === myId ? 'text-chamber-cyan font-bold' : 'text-chamber-text'}`}>
                      {p.codename}
                    </span>
                    {p.isDrawer && (
                      <span className="text-[7px] text-chamber-red font-cyber tracking-widest uppercase animate-pulse">
                        TRANSMITTING DRAWING
                      </span>
                    )}
                    {p.isSpectator && (
                      <span className="text-[7px] text-chamber-secondary font-cyber tracking-widest uppercase">
                        SPECTATOR
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs text-chamber-cyan glow-cyan">
                    {p.isSpectator ? 'OBS' : p.score}
                  </span>
                  <span className="text-[7px] text-chamber-secondary block font-cyber tracking-widest">
                    {p.isSpectator ? 'WATCHING' : 'O2 PTS'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER COLUMN: Drawing Canvas & Phase States */}
        <main className="flex-[65] md:flex-1 flex flex-col p-2 md:p-6 items-center justify-center relative overflow-hidden min-h-0 w-full">
          <div className="w-full max-w-[720px] flex-1 flex flex-col justify-center min-h-0">
            
            {/* WORD SELECTION PHASE */}
            {phase === 'WORD_SELECTION' && (
              <div className="w-full py-4 md:py-6 flex flex-col items-center justify-center animate-crt-flicker min-h-0">
                <div className="text-center mb-3 md:mb-6 max-w-sm px-2 shrink-0">
                  <h3 className="text-sm md:text-lg font-cyber text-chamber-cyan uppercase tracking-widest glow-cyan">
                    SELECT ESCAPE SECURITY CODE
                  </h3>
                  <p className="text-[8px] md:text-[10px] text-chamber-secondary uppercase tracking-widest mt-0.5">
                    Select a survival code to begin neural mapping.
                  </p>
                </div>

                {isDrawer ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 md:gap-4 w-full max-w-lg mt-1 md:mt-2 px-2 shrink-0">
                    {wordOptions.map((word) => (
                      <button
                        key={word}
                        onClick={() => handleSelectWord(word)}
                        className="hologram-panel hover:border-chamber-cyan text-chamber-text hover:text-chamber-cyan rounded-lg py-1.5 px-3 md:p-5 border border-chamber-cyan/20 text-center font-cyber uppercase tracking-wider text-xs md:text-sm transition-all hover:scale-105 shadow-hologram cursor-pointer hover:shadow-cyan-glow"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 md:p-8 hologram-panel border border-chamber-red/20 rounded-xl text-center flex flex-col items-center max-w-xs shrink-0">
                    <div className="w-7 h-7 md:w-10 md:h-10 border border-chamber-red/30 rounded-full flex items-center justify-center text-chamber-red animate-pulse mb-2 bg-chamber-red/10">
                      <AlertCircle size={16} />
                    </div>
                    <h4 className="text-[10px] md:text-xs font-cyber text-chamber-red uppercase tracking-wider">
                      NEURAL PROTOCOL SYNCHRONIZING
                    </h4>
                    <span className="text-[8px] md:text-[10px] text-chamber-secondary uppercase tracking-widest mt-1 block">
                      Awaiting subject {activeDrawer?.codename.toUpperCase()} choice...
                    </span>
                  </div>
                )}

                {/* Selection timer ring */}
                <div className="mt-2 md:mt-8 flex flex-col items-center shrink-0">
                  <svg className="w-8 h-8 md:w-16 md:h-16" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(0, 245, 255, 0.05)" strokeWidth="1.5" />
                    <circle 
                      cx="20" 
                      cy="20" 
                      r="18" 
                      fill="none" 
                      stroke="#00F5FF" 
                      strokeWidth="2" 
                      strokeDasharray="113" 
                      strokeDashoffset={113 - (113 * (timer / 10))} 
                      transform="rotate(-90 20 20)" 
                    />
                    <text x="20" y="24" textAnchor="middle" fill="#00F5FF" className="font-mono text-[10px] md:text-xs font-bold font-cyber">
                      {timer}s
                    </text>
                  </svg>
                  <span className="text-[7px] md:text-[8px] text-chamber-cyan font-cyber tracking-widest uppercase mt-1">SELECTION BUFFER</span>
                </div>
              </div>
            )}

            {/* DRAWING PHASE */}
            {phase === 'DRAWING' && (
              <div className="w-full flex-1 flex flex-col justify-between relative min-h-0 h-full">
                {/* HUD Panel: Timer (Oxygen ring) & Drawer Tag */}
                <div className="mb-2.5 flex items-center justify-between p-2.5 hologram-panel rounded-lg border border-chamber-cyan/15">
                  <div className="flex items-center gap-3">
                    {/* Circle Timer */}
                    <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                      <svg className="w-10 h-10 transform -rotate-90">
                        <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255, 46, 99, 0.1)" strokeWidth="2" />
                        <circle
                          cx="20"
                          cy="20"
                          r="18"
                          fill="none"
                          stroke={timer <= 15 ? '#FF2E63' : '#00F5FF'}
                          strokeWidth="2"
                          strokeDasharray="113"
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <span className={`absolute font-mono text-[10px] font-bold ${timer <= 15 ? 'text-chamber-red animate-pulse' : 'text-chamber-cyan'}`}>
                        {timer}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-chamber-secondary uppercase tracking-widest font-cyber block">OXYGEN LEVEL</span>
                      <span className={`text-[10px] font-cyber tracking-wider ${timer <= 15 ? 'text-chamber-red glow-red animate-pulse' : 'text-chamber-cyan'}`}>
                        {timer <= 15 ? 'O2 RESERVES CRITICAL' : 'O2 DEGRADING STABLY'}
                      </span>
                    </div>
                  </div>

                  {/* Drawer status or Word display if you are drawer */}
                  <div className="text-right">
                    {isDrawer ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] text-chamber-secondary uppercase tracking-widest font-cyber block">YOUR DRAWING CODE</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-cyber text-chamber-green glow-green uppercase font-bold tracking-widest">
                            {showWordToDrawer ? chosenWord : hints}
                          </span>
                          <button
                            onClick={() => {
                              setShowWordToDrawer(!showWordToDrawer);
                              audioSystem.playBeep();
                            }}
                            className="p-0.5 border border-chamber-green/20 hover:border-chamber-green/50 rounded text-chamber-green bg-chamber-bg hover:bg-chamber-green/5 transition-all cursor-pointer"
                            title={showWordToDrawer ? "Show Hints" : "Show Word"}
                          >
                            {showWordToDrawer ? <EyeOff size={10} /> : <Eye size={10} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[8px] text-chamber-secondary uppercase tracking-widest font-cyber block">TRANSMITTING SIGNAL</span>
                        <span className="text-xs font-cyber text-chamber-red uppercase tracking-wider">
                          SUBJECT: {activeDrawer?.codename.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Canvas Container */}
                <div className="flex-1 flex items-center justify-center min-h-0 w-full relative">
                  <DrawingCanvas
                    isDrawer={isDrawer}
                    socket={socket}
                    canvasHistory={canvasHistory}
                    chamberId={chamberId}
                  />
                </div>
              </div>
            )}

            {/* ROUND RESULTS PHASE */}
            {phase === 'ROUND_RESULTS' && (
              <div className="w-full flex flex-col items-center justify-center p-3 md:p-6 bg-chamber-surface/40 border border-chamber-cyan/20 rounded-xl hologram-panel animate-crt-flicker min-h-0">
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border border-chamber-green/40 flex items-center justify-center text-chamber-green bg-chamber-green/10 mb-2 md:mb-4 animate-pulse shrink-0">
                  <CheckCircle size={18} className="shadow-green-glow" />
                </div>
                
                <h3 className="text-[10px] md:text-sm font-cyber text-chamber-secondary uppercase tracking-widest mb-0.5 shrink-0">
                  SECURITY CODE RESOLVED
                </h3>
                <h2 className="text-lg md:text-2xl font-cyber font-bold text-chamber-green glow-green uppercase tracking-widest mb-3 md:mb-6 shrink-0">
                  {chosenWord}
                </h2>

                <div className="w-full max-w-md bg-chamber-bg/60 border border-chamber-cyan/10 rounded-lg p-2.5 md:p-4 space-y-1.5 md:space-y-3 overflow-y-auto max-h-[140px] md:max-h-none min-h-0">
                  <h4 className="text-[8px] md:text-[10px] text-chamber-secondary uppercase tracking-widest border-b border-chamber-cyan/10 pb-1.5 font-cyber shrink-0">
                    Oxygen points allocation
                  </h4>
                  <div className="space-y-1 md:space-y-2">
                    {players.map(p => {
                      const isCorrect = p.isVerified && p.id !== drawerId;
                      const isD = p.id === drawerId;
                      return (
                        <div key={p.id} className="flex justify-between items-center text-[10px] md:text-xs font-mono">
                          <span className={`uppercase font-cyber ${p.isSpectator ? 'text-zinc-600' : isD ? 'text-chamber-red' : isCorrect ? 'text-chamber-green' : 'text-zinc-500'}`}>
                            {p.codename} {p.isSpectator ? '(SPECTATOR)' : isD ? '(DRAWER)' : isCorrect ? '(VERIFIED)' : '(CONTAINED)'}
                          </span>
                          <span className={`font-mono ${p.isSpectator ? 'text-zinc-600' : isD || isCorrect ? 'text-chamber-cyan' : 'text-zinc-500'}`}>
                            {p.isSpectator ? 'OBS' : `${p.score} PTS`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 md:mt-8 flex flex-col items-center shrink-0">
                  <span className="text-[7px] md:text-[8px] text-chamber-secondary font-cyber tracking-widest uppercase">VENTILATING CHAMBER IN</span>
                  <span className="text-sm md:text-lg font-mono text-chamber-cyan glow-cyan mt-0.5">{timer}s</span>
                </div>
              </div>
            )}

            {/* FINAL RESULTS PHASE (ESCAPE SEQUENCES) */}
            {phase === 'FINAL_RESULTS' && (
              <div className="w-full flex flex-col items-center justify-center p-3 md:p-6 bg-chamber-surface/50 border border-chamber-red/20 rounded-xl hologram-panel animate-crt-flicker relative overflow-hidden min-h-0">
                {/* Alarm Light indicator */}
                <div className="absolute top-0 left-0 w-full h-1 bg-chamber-red animate-pulse" />
                
                <h2 className="text-base md:text-2xl font-cyber font-black text-chamber-red glow-red tracking-widest uppercase mb-1 animate-pulse shrink-0">
                  ESCAPE PROTOCOL COMPLETE
                </h2>
                <p className="text-[8px] md:text-[9px] text-chamber-secondary uppercase tracking-widest mb-3 md:mb-8 text-center max-w-sm shrink-0">
                  Escape candidates selected. Unverified subjects remain contained.
                </p>

                {/* Rankings revealed one by one */}
                <div className="w-full max-w-md space-y-1.5 md:space-y-3 mb-3 md:mb-8 overflow-y-auto max-h-[160px] md:max-h-none min-h-0">
                  {sortedPlayers.map((player, idx) => {
                    const rank = idx + 1;
                    const isRevealed = (players.length - revealedRanksCount) <= idx;
                    const escaped = rank <= 3 && !player.isSpectator;

                    return (
                      <div
                        key={player.id}
                        style={{ opacity: isRevealed ? 1 : 0, transition: 'all 0.5s ease' }}
                        className={`flex items-center justify-between p-2 md:p-3.5 border rounded-lg transition-all ${
                          player.isSpectator
                            ? 'bg-chamber-surface/40 border-chamber-secondary/20 opacity-60'
                            : escaped
                              ? 'bg-chamber-green/10 border-chamber-green/30 shadow-green-glow'
                              : 'bg-chamber-red/5 border-chamber-red/25 opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className={`font-mono text-xs md:text-sm font-bold ${player.isSpectator ? 'text-chamber-secondary' : escaped ? 'text-chamber-green' : 'text-chamber-red'}`}>
                            {player.isSpectator ? '-' : `#${rank}`}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-xs md:text-sm font-cyber uppercase font-bold text-chamber-text leading-none mb-0.5">
                              {player.codename}
                            </span>
                            <span className={`text-[7px] md:text-[8px] font-cyber tracking-widest uppercase ${player.isSpectator ? 'text-chamber-secondary' : escaped ? 'text-chamber-green' : 'text-chamber-red'}`}>
                              {player.isSpectator ? 'SPECTATOR' : escaped ? 'ESCAPE CANDIDATE' : 'CONTAINED'}
                            </span>
                          </div>
                        </div>

                        {/* Rewards / Badges */}
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="text-right">
                            <span className="font-mono text-[10px] md:text-xs text-chamber-cyan block">
                              {player.isSpectator ? 'OBSERVING' : `${player.score} PTS`}
                            </span>
                          </div>

                          {isRevealed && escaped && (
                            <div className="flex items-center justify-center p-0.5 md:p-1 bg-chamber-green/20 border border-chamber-green/40 rounded text-chamber-green" title={rank === 1 ? 'Platinum Shield' : rank === 2 ? 'Energy Mask' : 'Access Card'}>
                              {rank === 1 && <Shield size={12} className="animate-bounce" />}
                              {rank === 2 && <Zap size={12} className="animate-pulse" />}
                              {rank === 3 && <Key size={12} />}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Return to Lobby Option for Host */}
                {players.find(p => p.id === myId)?.isHost ? (
                  <button
                    onClick={() => {
                      if (socket) {
                        socket.emit('updateConfig', state.config); // Reset back to lobby
                        audioSystem.playOpen();
                      }
                    }}
                    className="px-4 py-2 md:px-6 md:py-2.5 bg-chamber-cyan hover:bg-chamber-cyan/80 text-chamber-bg font-cyber font-bold rounded-lg tracking-widest text-[10px] md:text-xs shadow-cyan-glow transition-all cursor-pointer shrink-0"
                  >
                    RESET SECURITY LOOP
                  </button>
                ) : (
                  <div className="text-[9px] md:text-xs text-chamber-secondary font-cyber uppercase tracking-widest animate-pulse shrink-0">
                    AWAITING HOST PROTOCOL RESET...
                  </div>
                )}
              </div>
            )}

          </div>
        </main>

        {/* MOBILE BOTTOM DASHBOARD: Rankings & Chat (Mobile split-screen) */}
        <div className="flex md:hidden flex-[35] border-t border-chamber-cyan/15 bg-chamber-surface/20 order-2 overflow-hidden shrink-0 min-h-0 w-full">
          {/* Left Side: Rankings */}
          <div className="w-[38%] border-r border-chamber-cyan/15 p-1.5 flex flex-col overflow-y-auto gap-1">
            {sortedPlayers.map((player, idx) => (
              <div
                key={player.id}
                className={`relative flex items-center justify-between p-1 rounded border text-[9px] ${
                  player.id === myId
                    ? 'bg-chamber-cyan/10 border-chamber-cyan/40 shadow-cyan-glow'
                    : 'bg-chamber-bg/60 border-chamber-cyan/5'
                } ${player.isSpectator ? 'opacity-65' : ''}`}
              >
                {player.isVerified && (
                  <div className="absolute -top-0.5 -right-0.5 bg-chamber-green text-chamber-bg rounded-full p-0.5 shadow-green-glow z-10">
                    <CheckCircle size={6} />
                  </div>
                )}
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-[9px] text-chamber-secondary">
                    {player.isSpectator ? '-' : `#${idx + 1}`}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[9px] font-cyber uppercase truncate ${player.id === myId ? 'text-chamber-cyan font-bold' : 'text-chamber-text'}`}>
                      {player.codename}
                    </span>
                    {player.isDrawer && (
                      <span className="text-[6px] text-chamber-red font-cyber tracking-widest uppercase animate-pulse leading-none">
                        DRAWING
                      </span>
                    )}
                    {player.isSpectator && (
                      <span className="text-[6px] text-chamber-secondary font-cyber tracking-widest uppercase leading-none">
                        SPECTATOR
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-[9px] text-chamber-cyan font-bold block leading-none font-cyber">
                    {player.isSpectator ? 'OBS' : player.score}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Side: Chat Interface */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden p-1.5 min-w-0">
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mb-1.5">
              {messages.map((msg) => {
                const isSystem = msg.isSystem;
                const isOwn = msg.senderId === myId;
                const senderPlayer = players.find(p => p.id === msg.senderId);
                const isVerifiedMsg = msg.isVerification;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-[8px] bg-chamber-surface/85 border border-chamber-cyan/5 p-1 rounded font-mono">
                      <p className="text-chamber-secondary uppercase leading-tight">{msg.text}</p>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-0.5 text-[7px] text-chamber-secondary font-cyber uppercase tracking-wider mb-0.5">
                      <span>{msg.senderName}</span>
                      {senderPlayer?.isVerified && (
                        <span className="text-chamber-green font-bold text-[6px] border border-chamber-green/20 bg-chamber-green/5 px-0.5 rounded">
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <div className={`px-1.5 py-0.5 rounded text-[10px] leading-snug max-w-[90%] break-words ${
                      isVerifiedMsg
                        ? 'bg-chamber-green/10 border border-chamber-green/20 text-chamber-green font-semibold'
                        : isOwn
                          ? 'bg-chamber-cyan/20 border-chamber-cyan/35 text-chamber-text'
                          : 'bg-chamber-bg border border-chamber-cyan/5 text-chamber-text'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicators */}
              {Object.keys(typingPlayers).length > 0 && (
                <div className="flex items-center gap-1 text-[7px] text-chamber-secondary font-mono italic animate-pulse">
                  <span>TYPING: {Object.values(players).filter(p => typingPlayers[p.id]).map(p => p.codename.toUpperCase()).join(', ')}</span>
                </div>
              )}
              <div ref={mobileChatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="flex gap-1 shrink-0">
              <input
                disabled={isDrawer || (phase === 'DRAWING' && me?.isVerified)}
                type="text"
                name="chat-guess-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={40}
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder={isDrawer ? "DRAWER CANNOT GUESS" : me?.isVerified ? "VERIFIED" : me?.isSpectator ? "CHAT (SPECTATOR)..." : "GUESS..."}
                className="flex-1 bg-chamber-bg border border-chamber-cyan/20 focus:border-chamber-cyan/50 focus:outline-none rounded px-2 py-1 text-[10px] font-mono text-chamber-text placeholder:text-chamber-secondary/30 disabled:opacity-40"
              />
              <button
                disabled={isDrawer || (phase === 'DRAWING' && me?.isVerified)}
                type="submit"
                className="px-2 bg-chamber-cyan hover:bg-chamber-cyan/85 disabled:bg-chamber-cyan/20 text-chamber-bg disabled:text-chamber-secondary rounded transition-colors cursor-pointer flex items-center justify-center"
              >
                <Send size={10} />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Chat Box & AI Announcements Feed (Desktop) */}
        <section className="hidden md:flex w-72 border-l border-chamber-cyan/15 bg-chamber-surface/30 flex-col justify-between overflow-hidden z-10 shrink-0">
          {/* AI Announcements Log */}
          <div className="h-44 border-b border-chamber-cyan/15 flex flex-col p-3 overflow-hidden bg-chamber-bg/40">
            <h4 className="text-[10px] text-chamber-secondary uppercase tracking-widest font-cyber border-b border-chamber-cyan/10 pb-1 flex items-center gap-1.5 shrink-0">
              <Bell size={12} className="text-chamber-red animate-ping" />
              AI Core Security Log
            </h4>
            <div className="flex-1 overflow-y-auto space-y-1.5 py-1.5 pr-1 font-mono text-[9px] text-chamber-cyan/85">
              {aiEvents.length === 0 ? (
                <div className="text-chamber-secondary/40 uppercase tracking-widest text-center py-6">
                  NO ANNOUNCEMENTS YET
                </div>
              ) : (
                aiEvents.map((evt, idx) => (
                  <div key={idx} className="flex gap-1 items-start border-l border-chamber-cyan/25 pl-1.5 py-0.5">
                    <span className="text-chamber-red shrink-0">&gt;</span>
                    <p className="leading-tight uppercase font-mono">{evt}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Chat Interface */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden p-3 relative bg-chamber-surface/20">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
              {messages.map((msg) => {
                const isSystem = msg.isSystem;
                const isOwn = msg.senderId === myId;
                const senderPlayer = players.find(p => p.id === msg.senderId);
                const isVerifiedMsg = msg.isVerification; // Correct guess chat message

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-[9px] bg-chamber-surface/85 border border-chamber-cyan/10 p-2 rounded-lg font-mono">
                      <div className="text-chamber-cyan font-bold tracking-wide uppercase text-[7px]">SYSTEM BROADCAST</div>
                      <p className="text-chamber-secondary uppercase leading-normal">{msg.text}</p>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1 text-[8px] text-chamber-secondary font-cyber uppercase tracking-wider mb-0.5">
                      <span>{msg.senderName}</span>
                      {senderPlayer?.isVerified && (
                        <span className="text-chamber-green font-bold text-[7px] border border-chamber-green/30 bg-chamber-green/5 px-0.5 rounded">
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <div className={`px-2.5 py-1.5 rounded-lg text-xs leading-normal max-w-[85%] break-words ${
                      isVerifiedMsg 
                        ? 'bg-chamber-green/10 border border-chamber-green/30 text-chamber-green font-semibold shadow-green-glow' 
                        : isOwn 
                          ? 'bg-chamber-cyan/20 border border-chamber-cyan/35 text-chamber-text' 
                          : 'bg-chamber-bg border border-chamber-cyan/5 text-chamber-text'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicators */}
              {Object.keys(typingPlayers).length > 0 && (
                <div className="flex items-center gap-1 text-[8px] text-chamber-secondary font-mono italic animate-pulse">
                  <span>SUBJECTS TYPING: </span>
                  <span>{Object.values(players).filter(p => typingPlayers[p.id]).map(p => p.codename.toUpperCase()).join(', ')}...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handleSendMessage} className="flex gap-1.5 shrink-0 z-10">
              <input
                disabled={isDrawer || (phase === 'DRAWING' && me?.isVerified)}
                type="text"
                name="mobile-chat-guess-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={40}
                value={chatInput}
                onChange={handleChatInputChange}
                onFocus={() => {
                  setTimeout(() => {
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
                    document.body.scrollTop = 0;
                  }, 60);
                }}
                placeholder={isDrawer ? "DRAWER CANNOT GUESS" : me?.isVerified ? "IDENTITY VERIFIED" : me?.isSpectator ? "CHAT (SPECTATOR)..." : "ENTER GUESS CODE..."}
                className="flex-1 bg-chamber-bg border border-chamber-cyan/20 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-3 py-2 text-base font-mono text-chamber-text placeholder:text-chamber-secondary/35 disabled:opacity-40"
              />
              <button
                disabled={isDrawer || (phase === 'DRAWING' && me?.isVerified)}
                type="submit"
                className="p-2 bg-chamber-cyan hover:bg-chamber-cyan/85 disabled:bg-chamber-cyan/20 text-chamber-bg disabled:text-chamber-secondary rounded-lg transition-colors cursor-pointer"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </section>

      </div>



    </div>
  );
};
