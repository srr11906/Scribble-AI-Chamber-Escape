import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from 'shared';
import { ConnectionStatus, PeerVoiceState } from './voiceTypes';
import { VoiceManager } from './VoiceManager';
import { AudioAnalyser } from './AudioAnalyser';

interface VoiceContextProps {
  micEnabled: boolean;
  speakerEnabled: boolean;
  connectionStatus: ConnectionStatus;
  peersVoiceState: Record<string, PeerVoiceState>;
  autoplayBlocked: boolean;
  voiceError: string | null;
  toggleMic: () => Promise<void>;
  toggleSpeaker: () => void;
  joinVoice: () => Promise<void>;
  leaveVoice: () => void;
  resumeBlockedAudio: () => void;
  clearVoiceError: () => void;
}

const VoiceContext = createContext<VoiceContextProps | undefined>(undefined);

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

interface VoiceProviderProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  children: React.ReactNode;
}

export const VoiceProvider: React.FC<VoiceProviderProps> = ({ socket, children }) => {
  const [micEnabled, setMicEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [peersVoiceState, setPeersVoiceState] = useState<Record<string, PeerVoiceState>>({});
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const managerRef = useRef<VoiceManager | null>(null);
  const analyserRef = useRef<AudioAnalyser | null>(null);

  useEffect(() => {
    if (!socket) return;

    const manager = new VoiceManager(socket, {
      onPeersChange: (peersMap) => {
        const peersObj: Record<string, PeerVoiceState> = {};
        peersMap.forEach((val, key) => {
          peersObj[key] = val;
        });
        setPeersVoiceState(peersObj);
      },
      onLocalStateChange: (state) => {
        setMicEnabled(state.micEnabled);
        setSpeakerEnabled(state.speakerEnabled);
      },
      onConnectionStatusChange: (status) => {
        setConnectionStatus(status);
        if (status === 'ERROR') {
          setVoiceError(manager.lastError || 'MICROPHONE ACCESS FAILED.');
        } else {
          setVoiceError(null);
        }
      },
      onAutoplayBlocked: () => {
        setAutoplayBlocked(true);
      }
    });

    manager.initialize();
    managerRef.current = manager;

    return () => {
      if (analyserRef.current) {
        analyserRef.current.stop();
        analyserRef.current = null;
      }
      manager.destroy();
      managerRef.current = null;
    };
  }, [socket]);

  // Audio Analyser speaking state tracking
  useEffect(() => {
    if (!socket || !managerRef.current) return;

    if (micEnabled && managerRef.current.localStream) {
      const analyser = new AudioAnalyser(
        managerRef.current.localStream,
        (speaking) => {
          socket.emit('voice:speaking', { speaking });
        }
      );
      analyser.start();
      analyserRef.current = analyser;
    } else {
      if (analyserRef.current) {
        analyserRef.current.stop();
        analyserRef.current = null;
      }
    }
  }, [micEnabled, socket]);

  const joinVoice = async () => {
    if (managerRef.current) {
      await managerRef.current.joinVoice();
    }
  };

  const leaveVoice = () => {
    if (analyserRef.current) {
      analyserRef.current.stop();
      analyserRef.current = null;
    }
    if (managerRef.current) {
      managerRef.current.leaveVoice();
    }
    setAutoplayBlocked(false);
    setVoiceError(null);
  };

  const toggleMic = async () => {
    if (managerRef.current) {
      await managerRef.current.toggleMic();
    }
  };

  const toggleSpeaker = () => {
    if (managerRef.current) {
      managerRef.current.toggleSpeaker();
    }
  };

  const resumeBlockedAudio = () => {
    if (managerRef.current) {
      managerRef.current.resumeBlockedAudio();
      setAutoplayBlocked(false);
    }
  };

  const clearVoiceError = () => {
    setVoiceError(null);
  };

  return (
    <VoiceContext.Provider
      value={{
        micEnabled,
        speakerEnabled,
        connectionStatus,
        peersVoiceState,
        autoplayBlocked,
        voiceError,
        toggleMic,
        toggleSpeaker,
        joinVoice,
        leaveVoice,
        resumeBlockedAudio,
        clearVoiceError
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};
