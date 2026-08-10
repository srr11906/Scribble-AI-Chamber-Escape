export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface PeerVoiceState {
  peerId: string;
  micEnabled: boolean;
  speakerEnabled: boolean;
  voiceConnected: boolean;
  speaking: boolean;
}
