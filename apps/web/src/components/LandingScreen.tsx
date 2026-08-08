import React, { useState } from 'react';
import { NeonCore } from './NeonCore';
import { Volume2, VolumeX, ShieldAlert, ArrowRight, Server } from 'lucide-react';
import { audioSystem } from './AudioSystem';

interface LandingScreenProps {
  initialChamberId?: string;
  onCreateChamber: (codename: string) => void;
  onJoinChamber: (codename: string, chamberId: string) => void;
  error: string | null;
  audioMuted: boolean;
  onToggleAudio: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  initialChamberId = '',
  onCreateChamber,
  onJoinChamber,
  error,
  audioMuted,
  onToggleAudio,
}) => {
  const [codename, setCodename] = useState('');
  const [chamberId, setChamberId] = useState(initialChamberId);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialChamberId ? 'join' : 'create');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codename.trim()) {
      audioSystem.playBuzz();
      return;
    }
    onCreateChamber(codename);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codename.trim() || !chamberId.trim()) {
      audioSystem.playBuzz();
      return;
    }
    onJoinChamber(codename, chamberId);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-6 cyber-grid bg-chamber-bg relative select-none">
      {/* Scanline Overlay */}
      <div className="scanlines" />

      {/* Top Header Controls */}
      <header className="flex justify-between items-center w-full max-w-4xl mx-auto z-10">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-chamber-cyan animate-pulse" />
          <span className="font-cyber text-[10px] text-chamber-cyan/70 tracking-widest font-bold">
            SECURITY SYSTEM V25.8
          </span>
        </div>
        <button
          onClick={onToggleAudio}
          className="p-2 border border-chamber-cyan/20 hover:border-chamber-cyan/60 rounded-lg text-chamber-cyan bg-chamber-surface/65 shadow-cyan-glow transition-all"
        >
          {audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </header>

      {/* Main Core Section */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-12 max-w-4xl w-full mx-auto my-3 sm:my-6 z-10 min-h-0">
        {/* Core Column */}
        <div className="flex flex-col items-center text-center shrink-0">
          <div className="hidden sm:block">
            <NeonCore />
          </div>
          <div className="mt-2 sm:mt-4">
            <h1 className="text-xl sm:text-3xl font-cyber font-black uppercase tracking-wider text-chamber-text glow-cyan leading-none">
              AI CHAMBER ESCAPE
            </h1>
            <p className="text-[8px] sm:text-xs text-chamber-secondary uppercase tracking-widest mt-1">
              MULTIPLAYER SOCIAL SURVIVAL
            </p>
          </div>
          <div className="mt-2 sm:mt-4 px-3 py-1 bg-chamber-red/10 border border-chamber-red/35 rounded text-[8px] sm:text-[10px] text-chamber-red font-cyber tracking-widest animate-pulse">
            WARNING: HUMAN SUBJECT DETECTED. DOORS LOCKED.
          </div>
        </div>

        {/* Panel Form Column */}
        <div className="w-full max-w-sm hologram-panel rounded-xl border border-chamber-cyan/20 p-4 sm:p-6 flex flex-col shrink-0">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-chamber-bg border border-chamber-cyan/15 rounded-lg mb-4 sm:mb-6">
            <button
              onClick={() => {
                setActiveTab('create');
                audioSystem.playBeep();
              }}
              className={`py-2 rounded text-xs font-cyber tracking-wider uppercase transition-all ${
                activeTab === 'create'
                  ? 'bg-chamber-cyan/20 text-chamber-cyan border border-chamber-cyan/35'
                  : 'text-chamber-secondary hover:text-white'
              }`}
            >
              Setup Chamber
            </button>
            <button
              onClick={() => {
                setActiveTab('join');
                audioSystem.playBeep();
              }}
              className={`py-2 rounded text-xs font-cyber tracking-wider uppercase transition-all ${
                activeTab === 'join'
                  ? 'bg-chamber-cyan/20 text-chamber-cyan border border-chamber-cyan/35'
                  : 'text-chamber-secondary hover:text-white'
              }`}
            >
              Link Uplink
            </button>
          </div>

          {/* Form */}
          {activeTab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[8px] sm:text-[10px] text-chamber-secondary uppercase tracking-widest font-cyber mb-1">
                  Subject Nickname
                </label>
                <input
                  type="text"
                  name="codename"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={12}
                  value={codename}
                  onChange={(e) => setCodename(e.target.value)}
                  placeholder="E.g., Nickname"
                  className="w-full bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-4 py-2 sm:py-2.5 text-chamber-text font-mono text-base sm:text-sm tracking-wider placeholder:text-chamber-secondary/40"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2 bg-chamber-red/10 border border-chamber-red/20 rounded text-[10px] text-chamber-red">
                  <ShieldAlert size={12} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 sm:py-3 bg-chamber-cyan hover:bg-chamber-cyan/85 text-chamber-bg font-cyber font-bold rounded-lg transition-all flex items-center justify-center gap-2 group shadow-cyan-glow cursor-pointer text-xs"
              >
                INITIALIZE CHAMBER
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-[10px] text-chamber-secondary uppercase tracking-widest font-cyber mb-1">
                  Subject Nickname
                </label>
                <input
                  type="text"
                  name="codename"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={12}
                  value={codename}
                  onChange={(e) => setCodename(e.target.value)}
                  placeholder="E.g., Nickname"
                  className="w-full bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-4 py-2 sm:py-2.5 text-chamber-text font-mono text-base sm:text-sm tracking-wider placeholder:text-chamber-secondary/40"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-chamber-secondary uppercase tracking-widest font-cyber mb-1">
                  Chamber code
                </label>
                <input
                  type="text"
                  name="chamber-id"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={6}
                  value={chamberId}
                  onChange={(e) => setChamberId(e.target.value.toUpperCase())}
                  placeholder="K7M2QF"
                  className="w-full bg-chamber-bg border border-chamber-cyan/20 hover:border-chamber-cyan/40 focus:border-chamber-cyan/70 focus:outline-none rounded-lg px-4 py-2 sm:py-2.5 text-chamber-text font-mono text-base sm:text-sm tracking-widest uppercase placeholder:text-chamber-secondary/40"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2 bg-chamber-red/10 border border-chamber-red/20 rounded text-xs text-chamber-red">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-chamber-green hover:bg-chamber-green/85 text-chamber-bg font-cyber font-bold rounded-lg transition-all flex items-center justify-center gap-2 group shadow-green-glow cursor-pointer"
              >
                ESTABLISH UPLINK
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center text-[10px] text-chamber-secondary/70 gap-2 z-10">
        <span>AUTHENTICATOR LAYER ACTIVE — ENCRYPTED TRANSMISSIONS ONLY</span>
        <span>GITHUB - srr11906</span>
      </footer>
    </div>
  );
};
