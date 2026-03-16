// WebRTC Manager
class WebRTCManager {
  constructor(socket) {
    this.socket = socket;
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isInitiator = false;
    this.onRemoteStream = null;
    this.onCallEnded = null;

    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    this._bindSocketEvents();
  }

  _bindSocketEvents() {
    this.socket.on('webrtc_offer', async (data) => {
      if (!this.pc) this._createPeerConnection();
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.socket.emit('webrtc_answer', answer);
      } catch (e) {
        console.warn('webrtc_offer error', e);
      }
    });

    this.socket.on('webrtc_answer', async (data) => {
      try {
        await this.pc?.setRemoteDescription(new RTCSessionDescription(data));
      } catch (e) {
        console.warn('webrtc_answer error', e);
      }
    });

    this.socket.on('webrtc_ice', async (data) => {
      try {
        if (data?.candidate) {
          await this.pc?.addIceCandidate(new RTCIceCandidate(data));
        }
      } catch (e) {
        console.warn('webrtc_ice error', e);
      }
    });

    this.socket.on('webrtc_end', () => {
      this.stopRemote();
      if (this.onCallEnded) this.onCallEnded();
    });
  }

  _createPeerConnection() {
    this.pc = new RTCPeerConnection(this.iceServers);

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit('webrtc_ice', e.candidate);
      }
    };

    this.pc.ontrack = (e) => {
      this.remoteStream = e.streams[0];
      if (this.onRemoteStream) this.onRemoteStream(this.remoteStream);
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });
    }
  }

  async startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      return this.localStream;
    } catch (e) {
      console.error('Camera/mic access denied:', e);
      throw e;
    }
  }

  async initiateCall() {
    this.isInitiator = true;
    this._createPeerConnection();
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.socket.emit('webrtc_offer', offer);
    } catch (e) {
      console.warn('initiateCall error', e);
    }
  }

  toggleMute() {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    const enabled = !audioTracks[0]?.enabled;
    audioTracks.forEach(t => { t.enabled = enabled; });
    return enabled;
  }

  toggleCamera() {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    const enabled = !videoTracks[0]?.enabled;
    videoTracks.forEach(t => { t.enabled = enabled; });
    return enabled;
  }

  stopLocal() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
  }

  stopRemote() {
    this.remoteStream?.getTracks().forEach(t => t.stop());
    this.remoteStream = null;
  }

  endCall() {
    this.socket.emit('webrtc_end');
    this.pc?.close();
    this.pc = null;
    this.stopRemote();
  }

  reset() {
    this.endCall();
    this.isInitiator = false;
  }
}
