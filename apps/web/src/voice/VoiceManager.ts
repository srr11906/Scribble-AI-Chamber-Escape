import { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from 'shared';
import { ConnectionStatus, PeerVoiceState } from './voiceTypes';

const getIceServers = (): RTCIceServer[] => {
  const stun = import.meta.env.VITE_STUN_SERVER || 'stun:stun.l.google.com:19302';
  const turn = import.meta.env.VITE_TURN_SERVER;
  const username = import.meta.env.VITE_TURN_USERNAME;
  const credential = import.meta.env.VITE_TURN_CREDENTIAL;

  const servers: RTCIceServer[] = [
    { urls: stun }
  ];

  if (turn) {
    servers.push({
      urls: turn,
      username,
      credential
    });
  }

  return servers;
};

export class VoiceManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteAudios: Map<string, HTMLAudioElement> = new Map();
  
  public localStream: MediaStream | null = null;
  public micEnabled = false;
  public speakerEnabled = true;
  public connectionStatus: ConnectionStatus = 'DISCONNECTED';
  
  private onPeersChange: (peers: Map<string, PeerVoiceState>) => void;
  private onLocalStateChange: (state: { micEnabled: boolean; speakerEnabled: boolean }) => void;
  private onConnectionStatusChange: (status: ConnectionStatus) => void;
  private onAutoplayBlocked: () => void;

  private peersState: Map<string, PeerVoiceState> = new Map();

  constructor(
    socket: Socket<ServerToClientEvents, ClientToServerEvents>,
    callbacks: {
      onPeersChange: (peers: Map<string, PeerVoiceState>) => void;
      onLocalStateChange: (state: { micEnabled: boolean; speakerEnabled: boolean }) => void;
      onConnectionStatusChange: (status: ConnectionStatus) => void;
      onAutoplayBlocked: () => void;
    }
  ) {
    this.socket = socket;
    this.onPeersChange = callbacks.onPeersChange;
    this.onLocalStateChange = callbacks.onLocalStateChange;
    this.onConnectionStatusChange = callbacks.onConnectionStatusChange;
    this.onAutoplayBlocked = callbacks.onAutoplayBlocked;
  }

  public initialize() {
    this.socket.on('voice:peer-joined', async ({ peerId, micEnabled, speakerEnabled }) => {
      this.peersState.set(peerId, {
        peerId,
        micEnabled,
        speakerEnabled,
        voiceConnected: false,
        speaking: false
      });
      this.onPeersChange(new Map(this.peersState));

      // The existing peer initiates the offer to the new player
      await this.initiatePeerConnection(peerId);
    });

    this.socket.on('voice:offer', async ({ senderId, sdp }) => {
      await this.handleOffer(senderId, sdp);
    });

    this.socket.on('voice:answer', async ({ senderId, sdp }) => {
      const pc = this.peerConnections.get(senderId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    this.socket.on('voice:ice-candidate', async ({ senderId, candidate }) => {
      const pc = this.peerConnections.get(senderId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    this.socket.on('voice:peer-left', ({ peerId }) => {
      this.closePeerConnection(peerId);
    });

    this.socket.on('voice:peer-state', ({ peerId, micEnabled, speakerEnabled, voiceConnected }) => {
      const peer = this.peersState.get(peerId);
      if (peer) {
        peer.micEnabled = micEnabled;
        peer.speakerEnabled = speakerEnabled;
        if (voiceConnected !== undefined) {
          peer.voiceConnected = voiceConnected;
        }
        this.onPeersChange(new Map(this.peersState));
      }
    });

    this.socket.on('voice:peer-speaking', ({ peerId, speaking }) => {
      const peer = this.peersState.get(peerId);
      if (peer) {
        peer.speaking = speaking;
        this.onPeersChange(new Map(this.peersState));
      }
    });
  }

  public async joinVoice() {
    this.connectionStatus = 'CONNECTING';
    this.onConnectionStatusChange('CONNECTING');
    
    this.socket.emit('voice:join');
    this.connectionStatus = 'CONNECTED';
    this.onConnectionStatusChange('CONNECTED');
  }

  public leaveVoice() {
    this.socket.emit('voice:leave');
    this.destroy();
    
    this.connectionStatus = 'DISCONNECTED';
    this.onConnectionStatusChange('DISCONNECTED');
  }

  public async toggleMic() {
    if (!this.localStream) {
      const success = await this.startLocalStream();
      if (!success) return;
    }

    this.micEnabled = !this.micEnabled;
    
    // Toggle audio track track enabled flag
    const audioTrack = this.localStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = this.micEnabled;
    }

    this.socket.emit('voice:state', {
      micEnabled: this.micEnabled,
      speakerEnabled: this.speakerEnabled
    });
    this.onLocalStateChange({ micEnabled: this.micEnabled, speakerEnabled: this.speakerEnabled });
  }

  public toggleSpeaker() {
    this.speakerEnabled = !this.speakerEnabled;

    // Apply mute/unmute locally to all remote audio tags without disconnecting RTCPeerConnection
    this.remoteAudios.forEach(audio => {
      audio.muted = !this.speakerEnabled;
    });

    this.socket.emit('voice:state', {
      micEnabled: this.micEnabled,
      speakerEnabled: this.speakerEnabled
    });
    this.onLocalStateChange({ micEnabled: this.micEnabled, speakerEnabled: this.speakerEnabled });
  }

  public resumeBlockedAudio() {
    this.remoteAudios.forEach(audio => {
      audio.play().catch(e => console.warn('Failed to resume audio:', e));
    });
  }

  private async startLocalStream(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported by your browser');
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });

      // Mute initially
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = this.micEnabled;
      }

      // Add local track to all active peer connections
      this.peerConnections.forEach(pc => {
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream!);
          });
        }
      });

      return true;
    } catch (e) {
      console.error('Failed to get local mic stream:', e);
      this.micEnabled = false;
      this.onLocalStateChange({ micEnabled: false, speakerEnabled: this.speakerEnabled });
      this.onConnectionStatusChange('ERROR');
      return false;
    }
  }

  private async initiatePeerConnection(peerId: string) {
    if (this.peerConnections.has(peerId)) return;

    const pc = this.createPeerConnection(peerId);
    this.peerConnections.set(peerId, pc);

    // Create SDP Offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.socket.emit('voice:offer', {
        targetId: peerId,
        sdp: offer
      });
    } catch (e) {
      console.error('Error creating offer for peer:', peerId, e);
    }
  }

  private async handleOffer(senderId: string, sdp: any) {
    this.closePeerConnection(senderId);

    const pc = this.createPeerConnection(senderId);
    this.peerConnections.set(senderId, pc);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('voice:answer', {
        targetId: senderId,
        sdp: answer
      });
    } catch (e) {
      console.error('Error handling WebRTC offer from sender:', senderId, e);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: getIceServers()
    });

    // Add local track if we have it
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('voice:ice-candidate', {
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      this.handleRemoteStream(peerId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      const peer = this.peersState.get(peerId);
      switch (pc.connectionState) {
        case 'connected':
          this.updatePeerVoiceConnected(peerId, true);
          break;
        case 'disconnected':
        case 'failed':
          this.updatePeerVoiceConnected(peerId, false);
          this.handleReconnection();
          break;
        case 'closed':
          this.updatePeerVoiceConnected(peerId, false);
          break;
      }
    };

    return pc;
  }

  private handleRemoteStream(peerId: string, stream: MediaStream) {
    this.removeAudioElement(peerId);

    const audio = document.createElement('audio');
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.muted = !this.speakerEnabled;
    audio.style.display = 'none';

    audio.play().catch(e => {
      console.warn('Autoplay blocked for peer stream:', peerId, e);
      this.onAutoplayBlocked();
    });

    document.body.appendChild(audio);
    this.remoteAudios.set(peerId, audio);
  }

  private updatePeerVoiceConnected(peerId: string, isConnected: boolean) {
    const peer = this.peersState.get(peerId);
    if (peer) {
      peer.voiceConnected = isConnected;
      this.onPeersChange(new Map(this.peersState));
    }
  }

  private handleReconnection() {
    this.connectionStatus = 'RECONNECTING';
    this.onConnectionStatusChange('RECONNECTING');
    
    // WebRTC connection will try to self-heal.
    // Set a timeout to mark as connected if they stabilize, or remain reconnecting.
    setTimeout(() => {
      let anyFailed = false;
      this.peerConnections.forEach(pc => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          anyFailed = true;
        }
      });
      
      if (!anyFailed) {
        this.connectionStatus = 'CONNECTED';
        this.onConnectionStatusChange('CONNECTED');
      }
    }, 5000);
  }

  private removeAudioElement(peerId: string) {
    const audio = this.remoteAudios.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudios.delete(peerId);
    }
  }

  private closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.removeAudioElement(peerId);

    if (this.peersState.has(peerId)) {
      this.peersState.delete(peerId);
      this.onPeersChange(new Map(this.peersState));
    }
  }

  public destroy() {
    this.peerConnections.forEach((pc, id) => {
      pc.close();
    });
    this.peerConnections.clear();

    this.remoteAudios.forEach((audio, id) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    this.remoteAudios.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    this.peersState.clear();
    this.onPeersChange(new Map());
    
    this.micEnabled = false;
    this.onLocalStateChange({ micEnabled: false, speakerEnabled: this.speakerEnabled });
    
    // Clear all socket voice event listeners
    this.socket.off('voice:peer-joined');
    this.socket.off('voice:offer');
    this.socket.off('voice:answer');
    this.socket.off('voice:ice-candidate');
    this.socket.off('voice:peer-left');
    this.socket.off('voice:peer-state');
    this.socket.off('voice:peer-speaking');
  }
}
