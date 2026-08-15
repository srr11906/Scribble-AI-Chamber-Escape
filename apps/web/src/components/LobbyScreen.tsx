import React, { useState, useEffect } from 'react';
import { Player, ChamberState, ChamberConfig } from 'shared';
import { WORD_CATEGORIES } from 'shared';
import { Users, Timer, RefreshCw, Layers, Copy, Trash2, Shield, Play, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { audioSystem } from './AudioSystem';
import { useVoice } from '../voice/VoiceContext';
import { NeonCore } from './NeonCore';

interface LobbyScreenProps {
  state: ChamberState;
  myId: string;
  onUpdateConfig: (config: ChamberConfig) => void;
  onStartGame: () => void;
  onKickPlayer: (playerId: string) => void;
  onLeaveChamber: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  state,
  myId,
  onUpdateConfig,
  onStartGame,
  onKickPlayer,
  onLeaveChamber,
}) => {
  const { chamberId, config, players } = state;
  const me = players.find(p => p.id === myId);
  const isHost = me?.isHost || false;

  const { micEnabled, speakerEnabled, toggleMic, toggleSpeaker } = useVoice();

  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<'protocols' | 'subjects'>('subjects');
  const [customWordsText, setCustomWordsText] = useState(config.customWords.join(', '));

  useEffect(() => {
    setCustomWordsText(config.customWords.join(', '));
  }, [config.customWords]);

  const shareUrl = `${window.location.origin}/r/${chamberId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    audioSystem.playBeep();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfigChange = (key: keyof ChamberConfig, value: any) => {
    if (!isHost) return;
    const newConfig = { ...config, [key]: value };
    onUpdateConfig(newConfig);
  };

  const handleCustomWordsBlur = () => {
    if (!isHost) return;
    const words = customWordsText
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);
    handleConfigChange('customWords', words);
  };

  return (
    <div className="h-[100dvh] w-full bg-chamber-bg cyber-grid p-3 md:p-6 select-none flex flex-col justify-between overflow-hidden relative">
      <div className="scanlines" />

      {/* Header */}
      <header className="w-full max-w-5xl mx-auto flex justify-between items-center border-b border-chamber-cyan/15 pb-2 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <NeonCore size="sm" />
          <div>
            <h2 className="text-base sm:text-lg font-cyber font-extrabold tracking-wider text-chamber-cyan animate-pulse">
              CHAMBER {chamberId}
            </h2>
            <p className="text-[8px] text-chamber-secondary uppercase tracking-widest mt-0.5">
              Lobby State — Synchronizing Neural Interfaces
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Voice Controls */}
          <button
            onClick={toggleMic}
            className={`p-1 sm:px-2 sm:py-1 border rounded text-[9px] font-cyber tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 ${
              micEnabled
                ? 'border-chamber-cyan text-chamber-cyan bg-chamber-cyan/10 shadow-cyan-glow'
                : 'border-chamber-secondary/30 text-chamber-secondary/50 hover:border-chamber-secondary bg-chamber-surface/20'
            }`}
            title="Toggle Microphone"
          >
            {micEnabled ? <Mic size={11} /> : <MicOff size={11} />}
            <span className="hidden sm:inline">Microphone: {micEnabled ? 'ACTIVE' : 'MUTED'}</span>
          </button>
          
          <button
            onClick={toggleSpeaker}
            className={`p-1 sm:px-2 sm:py-1 border rounded text-[9px] font-cyber tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 ${
              speakerEnabled
                ? 'border-chamber-cyan text-chamber-cyan bg-chamber-cyan/10 shadow-cyan-glow'
                : 'border-chamber-red/40 text-chamber-red bg-chamber-red/10 shadow-red-glow'
            }`}
            title="Toggle Voice Speaker"
          >
            {speakerEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
            <span className="hidden sm:inline">Speaker: {speakerEnabled ? 'ACTIVE' : 'MUTED'}</span>
          </button>

          {(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && (
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
              className="p-1 border border-chamber-cyan/20 hover:border-chamber-cyan text-chamber-cyan bg-chamber-cyan/5 rounded text-[9px] font-cyber px-1.5 shrink-0"
              title="Toggle Fullscreen"
            >
              <span className="hidden sm:inline">FS</span>
              <span className="sm:hidden block px-0.5 font-bold">FS</span>
            </button>
          )}
          <button
            onClick={() => {
              audioSystem.playBuzz();
              onLeaveChamber();
            }}
            className="p-1 sm:px-2.5 sm:py-1 border border-chamber-red/25 hover:border-chamber-red text-chamber-red bg-chamber-red/10 rounded text-[9px] font-cyber tracking-widest transition-all cursor-pointer shrink-0"
            title="Disconnect"
          >
            <span className="hidden sm:inline">DISCONNECT</span>
            <span className="sm:hidden block px-0.5 font-bold">X</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Selector */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-chamber-bg border border-chamber-cyan/15 rounded-lg mb-3 lg:hidden shrink-0 w-full max-w-5xl mx-auto z-10">
        <button
          onClick={() => {
            setMobileTab('subjects');
            audioSystem.playBeep();
          }}
          className={`py-1.5 rounded text-[10px] font-cyber tracking-wider uppercase transition-all ${
            mobileTab === 'subjects'
              ? 'bg-chamber-cyan/20 text-chamber-cyan border border-chamber-cyan/35'
              : 'text-chamber-secondary hover:text-white'
          }`}
        >
          Subjects ({players.filter(p => !p.isSpectator).length})
        </button>
        <button
          onClick={() => {
            setMobileTab('protocols');
            audioSystem.playBeep();
          }}
          className={`py-1.5 rounded text-[10px] font-cyber tracking-wider uppercase transition-all ${
            mobileTab === 'protocols'
              ? 'bg-chamber-cyan/20 text-chamber-cyan border border-chamber-cyan/35'
              : 'text-chamber-secondary hover:text-white'
          }`}
        >
          Protocols
        </button>
      </div>

      {/* Main Grid */}
      <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col lg:grid lg:grid-cols-3 gap-4 md:gap-6 mb-3 min-h-0 overflow-hidden pr-0.5 z-10">
        {/* Left Column: Configuration */}
        <section className={`lg:col-span-2 flex flex-col gap-3 min-h-0 overflow-y-auto pr-0.5 pb-2 ${mobileTab === 'protocols' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Share Box */}
          <div className="hologram-panel rounded-xl p-3.5 sm:p-5 border border-chamber-cyan/20">
            <h3 className="text-xs text-chamber-secondary uppercase tracking-widest font-cyber mb-3">
              Chamber access key
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-chamber-bg border border-chamber-cyan/15 rounded-lg px-3 py-2 text-xs font-mono text-chamber-cyan select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-chamber-cyan/25 hover:bg-chamber-cyan text-chamber-cyan hover:text-chamber-bg border border-chamber-cyan/35 rounded-lg text-xs font-cyber font-bold tracking-widest transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Copy size={14} />
                {copied ? 'COPIED' : 'COPY'}
              </button>
            </div>
          </div>

          {/* Config Parameters */}
          <div className="hologram-panel rounded-xl p-3.5 sm:p-5 border border-chamber-cyan/20 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-xs text-chamber-secondary uppercase tracking-widest font-cyber border-b border-chamber-cyan/10 pb-2 mb-4">
                Chamber protocols
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Max Players */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-chamber-secondary uppercase tracking-wider flex items-center gap-1.5 font-cyber">
                    <Users size={12} className="text-chamber-cyan" />
                    Maximum Subjects (3 - 12)
                  </label>
                  <select
                    disabled={!isHost}
                    value={config.maxPlayers}
                    onChange={e => handleConfigChange('maxPlayers', parseInt(e.target.value))}
                    className="w-full bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-3 py-2 text-sm text-chamber-text font-mono disabled:opacity-50"
                  >
                    {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <option key={n} value={n} className="bg-chamber-surface text-chamber-text">
                        {n} SUBJECTS
                      </option>
                    ))}
                  </select>
                </div>

                {/* Draw Time */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-chamber-secondary uppercase tracking-wider flex items-center gap-1.5 font-cyber">
                    <Timer size={12} className="text-chamber-cyan" />
                    Oxygen Venting Speed (Draw Time)
                  </label>
                  <select
                    disabled={!isHost}
                    value={config.drawTime}
                    onChange={e => handleConfigChange('drawTime', parseInt(e.target.value))}
                    className="w-full bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-3 py-2 text-sm text-chamber-text font-mono disabled:opacity-50"
                  >
                    {[30, 45, 60, 75, 90, 105, 120].map(s => (
                      <option key={s} value={s} className="bg-chamber-surface text-chamber-text">
                        {s} SECONDS
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cycles */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-chamber-secondary uppercase tracking-wider flex items-center gap-1.5 font-cyber">
                    <RefreshCw size={12} className="text-chamber-cyan" />
                    Chamber Cycles (Rounds)
                  </label>
                  <select
                    disabled={!isHost}
                    value={config.cycles}
                    onChange={e => handleConfigChange('cycles', parseInt(e.target.value))}
                    className="w-full bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-3 py-2 text-sm text-chamber-text font-mono disabled:opacity-50"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
                      <option key={r} value={r} className="bg-chamber-surface text-chamber-text">
                        {r} CYCLES
                      </option>
                    ))}
                  </select>
                </div>

                {/* Word Pack Selection */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] text-chamber-secondary uppercase tracking-wider flex items-center gap-1.5 font-cyber">
                    <Layers size={12} className="text-chamber-cyan" />
                    Survival Code Pack Mode
                  </label>
                  
                  {/* Mode Selector Buttons */}
                  <div className="grid grid-cols-3 gap-2 p-1 bg-chamber-bg border border-chamber-cyan/15 rounded-lg mb-3">
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleConfigChange('wordPack', 'all')}
                      className={`py-1.5 rounded text-[10px] font-cyber tracking-wider uppercase transition-all ${
                        config.wordPack === 'all'
                          ? 'bg-chamber-cyan/20 text-chamber-cyan border border-chamber-cyan/35'
                          : 'text-chamber-secondary hover:text-white disabled:opacity-50'
                      }`}
                    >
                      ALL PACKS
                    </button>
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleConfigChange('wordPack', 'custom')}
                      className={`py-1.5 rounded text-[10px] font-cyber tracking-wider uppercase transition-all ${
                        config.wordPack === 'custom'
                          ? 'bg-chamber-cyan/20 text-chamber-cyan border border-chamber-cyan/35'
                          : 'text-chamber-secondary hover:text-white disabled:opacity-50'
                      }`}
                    >
                      CUSTOM WORDS
                    </button>
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => {
                        handleConfigChange('wordPack', 'movies');
                      }}
                      className={`py-1.5 rounded text-[10px] font-cyber tracking-wider uppercase transition-all ${
                        config.wordPack !== 'all' && config.wordPack !== 'custom'
                          ? 'bg-chamber-cyan/20 text-chamber-cyan border border-chamber-cyan/35'
                          : 'text-chamber-secondary hover:text-white disabled:opacity-50'
                      }`}
                    >
                      SELECT PACKS
                    </button>
                  </div>

                  {/* Multi-Pack Selection Grid */}
                  {config.wordPack !== 'all' && config.wordPack !== 'custom' && (
                    <div className="space-y-2 mt-2">
                      <label className="text-[9px] text-chamber-secondary/70 uppercase tracking-widest font-cyber block mb-1">
                        Select Active Code Categories:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 sm:max-h-48 overflow-y-auto border border-chamber-cyan/10 p-2.5 rounded-lg bg-chamber-bg/50">
                        {WORD_CATEGORIES.map(cat => {
                          const activeCategories = config.wordPack.split(',').map(c => c.trim());
                          const isSelected = activeCategories.includes(cat);

                          const handleToggleCategory = () => {
                            if (!isHost) return;
                            let newCategories: string[];
                            if (isSelected) {
                              newCategories = activeCategories.filter(c => c !== cat);
                            } else {
                              newCategories = [...activeCategories, cat];
                            }
                            if (newCategories.length === 0) {
                              handleConfigChange('wordPack', 'all');
                            } else {
                              handleConfigChange('wordPack', newCategories.join(','));
                            }
                          };

                          return (
                            <button
                              key={cat}
                              type="button"
                              disabled={!isHost}
                              onClick={handleToggleCategory}
                              className={`py-1 px-2 border rounded text-[9px] font-cyber tracking-wider uppercase transition-all text-left truncate flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'border-chamber-cyan text-chamber-cyan bg-chamber-cyan/15 shadow-cyan-glow'
                                  : 'border-chamber-cyan/10 text-chamber-secondary/70 bg-chamber-surface/10 hover:border-chamber-cyan/30 hover:text-chamber-text'
                              } disabled:cursor-not-allowed`}
                            >
                              <span>{cat}</span>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-chamber-cyan animate-pulse shadow-cyan-glow" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom words text-area */}
              {config.wordPack === 'custom' && (
                <div className="mt-4 space-y-1.5">
                  <label className="text-[10px] text-chamber-secondary uppercase tracking-wider font-cyber">
                    Custom Survival Codes (Comma separated)
                  </label>
                  <textarea
                    disabled={!isHost}
                    value={customWordsText}
                    onChange={e => setCustomWordsText(e.target.value)}
                    onBlur={handleCustomWordsBlur}
                    placeholder="E.g. maggi, autos, placement, metro, paneer"
                    className="w-full h-16 sm:h-24 bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-3 py-2 text-xs font-mono text-chamber-text resize-none placeholder:text-chamber-secondary/40 disabled:opacity-50"
                  />
                </div>
              )}
            </div>

            {/* Host Alert */}
            {!isHost && (
              <div className="mt-6 flex items-center gap-2 p-3 bg-chamber-surface border border-chamber-cyan/10 rounded-lg text-xs text-chamber-secondary">
                <Shield size={14} className="text-chamber-cyan" />
                <span>Host authority is active. Configuration lock engaged.</span>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Player Roster */}
        <section className={`hologram-panel rounded-xl border border-chamber-cyan/20 p-3 sm:p-4 flex flex-col justify-between min-h-0 overflow-hidden ${mobileTab === 'subjects' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex flex-col min-h-0 flex-1">
            <h3 className="text-xs text-chamber-secondary uppercase tracking-widest font-cyber border-b border-chamber-cyan/10 pb-2 mb-3 flex items-center gap-1.5 shrink-0">
              <Users size={14} className="text-chamber-cyan" />
              Chamber Subjects ({players.filter(p => !p.isSpectator).length} / {config.maxPlayers})
            </h3>

            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 min-h-[120px]">
              {players.map(player => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3.5 sm:p-2.5 bg-chamber-bg border rounded-lg transition-all ${
                    player.speaking
                      ? 'border-chamber-cyan shadow-cyan-glow bg-chamber-cyan/5 scale-[1.01]'
                      : 'border-chamber-cyan/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 sm:w-1.5 sm:h-1.5 rounded-full ${player.isOnline ? 'bg-chamber-green shadow-green-glow animate-pulse' : 'bg-zinc-600'}`} />
                    <span className={`text-base sm:text-sm font-cyber uppercase ${player.id === myId ? 'text-chamber-cyan font-bold' : 'text-chamber-text'}`}>
                      {player.codename}
                    </span>
                    {player.voiceConnected && (
                      <span className="flex items-center gap-1.5 ml-1 text-chamber-secondary">
                        {player.speaking ? (
                          <span className="flex items-center gap-[1.5px] px-1 bg-chamber-cyan/10 border border-chamber-cyan/20 rounded h-4.5 shrink-0">
                            <span className="w-[1.5px] h-1.5 bg-chamber-cyan rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <span className="w-[1.5px] h-2.5 bg-chamber-cyan rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            <span className="w-[1.5px] h-1.5 bg-chamber-cyan rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                          </span>
                        ) : player.micEnabled ? (
                          <Mic className="w-3.5 h-3.5 sm:w-2.5 sm:h-2.5 text-chamber-cyan/80 animate-pulse" />
                        ) : (
                          <MicOff className="w-3.5 h-3.5 sm:w-2.5 sm:h-2.5 text-chamber-secondary/40" />
                        )}
                        {!player.speakerEnabled && (
                          <VolumeX className="w-3.5 h-3.5 sm:w-2.5 sm:h-2.5 text-chamber-red/70 animate-pulse" />
                        )}
                      </span>
                    )}
                    {player.isHost && (
                      <span className="px-1.5 py-0.5 border border-chamber-cyan/30 text-chamber-cyan text-[7px] font-cyber tracking-widest bg-chamber-cyan/10 rounded animate-pulse">
                        HOST
                      </span>
                    )}
                    {player.isSpectator && (
                      <span className="px-1.5 py-0.5 border border-chamber-secondary/30 text-chamber-secondary text-[7px] font-cyber tracking-widest bg-chamber-surface rounded">
                        SPECTATOR
                      </span>
                    )}
                  </div>

                  {isHost && player.id !== myId && (
                    <button
                      onClick={() => {
                        audioSystem.playBuzz();
                        onKickPlayer(player.id);
                      }}
                      className="p-1 text-chamber-secondary hover:text-chamber-red transition-colors cursor-pointer"
                      title="Exile Player"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Start Action */}
          <div className="mt-3 sm:mt-6 pt-3 sm:pt-4 border-t border-chamber-cyan/10">
            {isHost ? (
              <button
                onClick={() => {
                  audioSystem.playLock();
                  onStartGame();
                }}
                disabled={players.filter(p => !p.isSpectator).length < 2}
                className="w-full py-3 bg-chamber-cyan hover:bg-chamber-cyan/85 text-chamber-bg font-cyber font-bold rounded-lg tracking-widest transition-all flex items-center justify-center gap-2 shadow-cyan-glow disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Play size={16} />
                SEAL CHAMBER & START
              </button>
            ) : (
              <div className="text-center py-2 px-3 border border-chamber-cyan/10 bg-chamber-bg/40 rounded-lg text-xs text-chamber-secondary font-cyber tracking-wide">
                AWAITING HOST ACTION...
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer System Status */}
      <footer className="w-full max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center text-[9px] text-chamber-secondary/70 gap-1 mt-4">
        <span>ATMOSPHERE PRESSURE: STABLE (1.0 ATM)</span>
        <span>OXYGEN LEVELS: 100% — LOCK PROTOCOL INITIALIZED</span>
      </footer>
    </div>
  );
};
