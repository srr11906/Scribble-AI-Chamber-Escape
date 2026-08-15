import React from 'react';

interface NeonCoreProps {
  size?: 'sm' | 'md' | 'lg';
}

export const NeonCore: React.FC<NeonCoreProps> = ({ size = 'lg' }) => {
  if (size === 'sm') {
    return (
      <div className="relative w-8 h-8 flex items-center justify-center select-none shrink-0">
        {/* Outer Glow Ring */}
        <div className="absolute inset-0 rounded-full border border-chamber-cyan/20 animate-pulse-slow shadow-cyan-glow" />

        {/* Rotating Outer Hex Ring */}
        <svg className="absolute w-7 h-7 animate-spin-slow text-chamber-cyan/30" viewBox="0 0 100 100">
          <polygon
            points="50,3 93,28 93,78 50,97 7,78 7,28"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeDasharray="10 15"
          />
        </svg>

        {/* Center Core Pulsing Glowing Orb */}
        <div className="absolute w-3.5 h-3.5 rounded-full bg-chamber-bg border border-chamber-cyan flex items-center justify-center shadow-cyan-glow z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-chamber-cyan/85 animate-pulse" />
        </div>
      </div>
    );
  }

  if (size === 'md') {
    return (
      <div className="relative w-16 h-16 flex items-center justify-center select-none shrink-0">
        {/* Outer Glow Ring */}
        <div className="absolute inset-0 rounded-full border border-chamber-cyan/20 animate-pulse-slow shadow-cyan-glow" />

        {/* Rotating Outer Hex Ring */}
        <svg className="absolute w-14 h-14 animate-spin-slow text-chamber-cyan/30" viewBox="0 0 100 100">
          <polygon
            points="50,3 93,28 93,78 50,97 7,78 7,28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="6 12"
          />
        </svg>

        {/* Rotating Inner Dash Ring */}
        <svg className="absolute w-11 h-11 text-chamber-cyan/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '6s' }} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="10 15 2 5" />
        </svg>

        {/* Center Core Pulsing Glowing Orb */}
        <div className="absolute w-6 h-6 rounded-full bg-chamber-bg border border-chamber-cyan flex items-center justify-center shadow-cyan-glow z-10">
          <div className="w-2.5 h-2.5 rounded-full bg-chamber-cyan/80 animate-pulse" />
        </div>
      </div>
    );
  }

  // Default large version (lg)
  return (
    <div className="relative w-64 h-64 flex items-center justify-center select-none shrink-0">
      {/* Outer Glow Ring */}
      <div className="absolute inset-0 rounded-full border border-chamber-cyan/20 animate-pulse-slow shadow-cyan-glow" />

      {/* Rotating Outer Hex Ring */}
      <svg className="absolute w-56 h-56 animate-spin-slow text-chamber-cyan/30" viewBox="0 0 100 100">
        <polygon
          points="50,3 93,28 93,78 50,97 7,78 7,28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 8"
        />
      </svg>

      {/* Rotating Inner Dash Ring */}
      <svg className="absolute w-44 h-44 animate-spin text-chamber-cyan/60" style={{ animationDirection: 'reverse', animationDuration: '6s' }} viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="10 15 2 5"
        />
      </svg>

      {/* Center Core Pulsing Glowing Orb */}
      <div className="absolute w-24 h-24 rounded-full bg-chamber-bg border-2 border-chamber-cyan flex flex-col items-center justify-center overflow-hidden shadow-cyan-glow z-10">
        {/* Scanned sweep line */}
        <div className="absolute w-full h-1 bg-chamber-cyan/60 animate-scanline" />
        <div className="w-10 h-10 rounded-full bg-chamber-cyan/25 animate-ping absolute" />
        <div className="w-8 h-8 rounded-full bg-chamber-cyan/40 animate-pulse absolute" />
        <span className="font-cyber text-[9px] text-chamber-cyan/90 tracking-widest font-bold mt-1">AI CORE</span>
        <span className="font-mono text-[8px] text-chamber-green/80 animate-pulse mt-0.5">ONLINE</span>
      </div>

      {/* Ambient Scanning Laser Line */}
      <div className="absolute w-[280px] h-[1px] bg-gradient-to-r from-transparent via-chamber-cyan/40 to-transparent top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 animate-pulse" />
    </div>
  );
};
