import React, { useState } from 'react';
import { Player, ChamberState, ChamberConfig } from 'shared';
import { WORD_CATEGORIES } from 'shared';
import { Users, Timer, RefreshCw, Layers, Copy, Trash2, Shield, Play } from 'lucide-react';
import { audioSystem } from './AudioSystem';

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

  const [copied, setCopied] = useState(false);
  const [customWordsText, setCustomWordsText] = useState(config.customWords.join(', '));

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
    <div className="min-h-screen w-full bg-chamber-bg cyber-grid p-4 md:p-8 select-none flex flex-col justify-between">
      <div className="scanlines" />

      {/* Header */}
      <header className="w-full max-w-5xl mx-auto flex justify-between items-center border-b border-chamber-cyan/15 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-cyber font-extrabold tracking-wider text-chamber-cyan animate-pulse">
            CHAMBER {chamberId}
          </h2>
          <p className="text-[10px] text-chamber-secondary uppercase tracking-widest mt-0.5">
            Lobby State — Synchronizing Neural Interfaces
          </p>
        </div>
        <button
          onClick={() => {
            audioSystem.playBuzz();
            onLeaveChamber();
          }}
          className="px-3 py-1.5 border border-chamber-red/25 hover:border-chamber-red text-chamber-red bg-chamber-red/10 rounded-lg text-xs font-cyber tracking-widest transition-all cursor-pointer"
        >
          DISCONNECT
        </button>
      </header>

      {/* Main Grid */}
      <main className="flex-1 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column: Configuration (2 Cols width on desktop if desired, but 1 Col is great) */}
        <section className="lg:col-span-2 flex flex-col gap-6">
          {/* Share Box */}
          <div className="hologram-panel rounded-xl p-5 border border-chamber-cyan/20">
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
          <div className="hologram-panel rounded-xl p-6 border border-chamber-cyan/20 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-xs text-chamber-secondary uppercase tracking-widest font-cyber border-b border-chamber-cyan/10 pb-2 mb-4">
                Chamber protocols
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                {/* Word Pack */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-chamber-secondary uppercase tracking-wider flex items-center gap-1.5 font-cyber">
                    <Layers size={12} className="text-chamber-cyan" />
                    Survival Code Pack
                  </label>
                  <select
                    disabled={!isHost}
                    value={config.wordPack}
                    onChange={e => handleConfigChange('wordPack', e.target.value)}
                    className="w-full bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-3 py-2 text-sm text-chamber-text font-mono disabled:opacity-50"
                  >
                    <option value="all" className="bg-chamber-surface text-chamber-text">ALL CATEGORIES</option>
                    <option value="custom" className="bg-chamber-surface text-chamber-text">CUSTOM PROTOCOL (TEXT)</option>
                    {WORD_CATEGORIES.filter(cat => cat !== 'food').map(cat => (
                      <option key={cat} value={cat} className="bg-chamber-surface text-chamber-text">
                        {cat.toUpperCase()} PACK
                      </option>
                    ))}
                  </select>
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
                    className="w-full h-24 bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-3 py-2 text-xs font-mono text-chamber-text resize-none placeholder:text-chamber-secondary/40 disabled:opacity-50"
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
        <section className="hologram-panel rounded-xl border border-chamber-cyan/20 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs text-chamber-secondary uppercase tracking-widest font-cyber border-b border-chamber-cyan/10 pb-2 mb-4 flex items-center gap-1.5">
              <Users size={14} className="text-chamber-cyan" />
              Chamber Subjects ({players.filter(p => !p.isSpectator).length} / {config.maxPlayers})
            </h3>

            <div className="space-y-2 max-h-[300px] lg:max-h-none overflow-y-auto pr-1">
              {players.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2.5 bg-chamber-bg border border-chamber-cyan/10 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${player.isOnline ? 'bg-chamber-green shadow-green-glow animate-pulse' : 'bg-zinc-600'}`} />
                    <span className={`text-sm font-cyber uppercase ${player.id === myId ? 'text-chamber-cyan font-bold' : 'text-chamber-text'}`}>
                      {player.codename}
                    </span>
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
          <div className="mt-6 pt-4 border-t border-chamber-cyan/10">
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
