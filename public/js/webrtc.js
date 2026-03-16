class WebRTCConnection {
    constructor(io, config = {}) {
        this.io = io;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.config = config;
        this.peerId = null;
        this.remotePeerId = null;
    }

    async startConnection(remotePeerId) {
        try {
            // Get local media stream
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            });

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: ['stun:stun.l.google.com:19302'] },
                    { urls: ['stun:stun1.l.google.com:19302'] }
                ]
            });

            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                this.onRemoteStreamReceived(event.streams[0]);
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.io.emit('signal', {
                        to: remotePeerId,
                        signal: {
                            type: 'candidate',
                            candidate: event.candidate
                        }
                    });
                }
            };

            this.remotePeerId = remotePeerId;

            // Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.io.emit('signal', {
                to: remotePeerId,
                signal: {
                    type: 'offer',
                    offer: offer
                }
            });

            return this.localStream;
        } catch (error) {
            console.error('Error starting connection:', error);
            throw error;
        }
    }

    async handleSignal(signal, fromPeerId) {
        try {
            if (signal.type === 'offer') {
                if (!this.peerConnection) {
                    this.localStream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 1280, height: 720 },
                        audio: true
                    });

                    this.peerConnection = new RTCPeerConnection({
                        iceServers: [
                            { urls: ['stun:stun.l.google.com:19302'] },
                            { urls: ['stun:stun1.l.google.com:19302'] }
                        ]
                    });

                    this.localStream.getTracks().forEach(track => {
                        this.peerConnection.addTrack(track, this.localStream);
                    });

                    this.peerConnection.ontrack = (event) => {
                        this.remoteStream = event.streams[0];
                        this.onRemoteStreamReceived(event.streams[0]);
                    };

                    this.peerConnection.onicecandidate = (event) => {
                        if (event.candidate) {
                            this.io.emit('signal', {
                                to: fromPeerId,
                                signal: {
                                    type: 'candidate',
                                    candidate: event.candidate
                                }
                            });
                        }
                    };
                }

                this.remotePeerId = fromPeerId;

                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);

                this.io.emit('signal', {
                    to: fromPeerId,
                    signal: {
                        type: 'answer',
                        answer: answer
                    }
                });
            } else if (signal.type === 'answer') {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
            } else if (signal.type === 'candidate') {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } catch (e) {
                    console.warn('Error adding ICE candidate:', e);
                }
            }
        } catch (error) {
            console.error('Error handling signal:', error);
        }
    }

    stopConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.remoteStream = null;
        this.remotePeerId = null;
    }

    toggleAudio(enabled) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    toggleVideo(enabled) {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    onRemoteStreamReceived(stream) {
        console.log('Remote stream received');
    }
}