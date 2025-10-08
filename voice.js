// voice.js
import { socket } from './network.js';

let localStream;
const peerConnections = {};

export async function initVoice() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Microphone access granted");

    // Handle incoming offers
    socket.on('webrtc-offer', async ({ sourceId, offer }) => {
      const pc = createPeerConnection(sourceId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetId: sourceId, answer });
    });

    // Handle answers
    socket.on('webrtc-answer', async ({ sourceId, answer }) => {
      await peerConnections[sourceId]?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // Handle ICE candidates
    socket.on('webrtc-candidate', async ({ sourceId, candidate }) => {
      if (candidate)
        await peerConnections[sourceId]?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // When a new user joins, send them an offer
    socket.on('user-list', (users) => {
      users.forEach(({ id }) => {
        if (id !== socket.id) {
          if (!peerConnections[id]) {
            console.log("Creating offer for new user:", id);
            createOffer(id);
          }
        }
      });
    });

  } catch (err) {
    console.error("Failed to initialize voice:", err);
  }
}

function createPeerConnection(targetId) {
  // include STUN server for NAT traversal
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });
  pc.onconnectionstatechange = () => {
  console.log("WebRTC connectionState:", pc.connectionState);
  };


  peerConnections[targetId] = pc;

  // add microphone tracks
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // handle remote audio
  pc.ontrack = ({ streams: [stream] }) => {
    console.log("Received remote stream from", targetId);
    const audio = document.createElement('audio');
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true; // avoid fullscreen mode on mobile
    audio.style.display = 'none';
    document.body.appendChild(audio);
  };

  // handle ICE candidates
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('webrtc-candidate', { targetId, candidate });
  };

  // log connection state
  pc.onconnectionstatechange = () => {
    console.log(`WebRTC(${targetId}) state:`, pc.connectionState);
  };

  return pc;
}

async function createOffer(targetId) {
  const pc = createPeerConnection(targetId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('webrtc-offer', { targetId, offer });
}
