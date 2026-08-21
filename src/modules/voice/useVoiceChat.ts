import { useState, useEffect, useRef, useCallback } from 'react';
import { syncSocket } from '../../ws/socket';

export interface VoiceParticipant {
  userId: string;
  name: string;
  avatar?: string;
  color?: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  volume: number; // 0 to 100
  audioLevel?: number; // 0 to 100
  stream?: MediaStream;
}

export interface UseVoiceChatOptions {
  roomId: string;
  userId: string;
  name: string;
  avatar?: string;
  color?: string;
  isMutedByMod?: boolean;
  onSpeakingChange?: (isSpeaking: boolean, volume: number) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

/**
 * useVoiceChat Hook
 * Complete WebRTC Mesh Voice Chat with VAD, Mute/Deafen, Audio Device Switcher,
 * and Per-Participant Volume Control using the existing WebSocket signaling connection.
 */
export function useVoiceChat({
  roomId,
  userId,
  name,
  avatar = '🍿',
  color = '#6366f1',
  isMutedByMod = false,
  onSpeakingChange,
}: UseVoiceChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  // Refs for WebRTC & Audio Context persistence
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const vadAnimFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const isMutedRef = useRef(isMuted);
  const isDeafenedRef = useRef(isDeafened);
  const isConnectedRef = useRef(isConnected);

  isMutedRef.current = isMuted;
  isDeafenedRef.current = isDeafened;
  isConnectedRef.current = isConnected;

  // Enumerate input devices
  const updateAudioDevices = useCallback(async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailableDevices(devices.filter((d) => d.kind === 'audioinput'));
      }
    } catch (err) {
      console.warn('[useVoiceChat] Device enumeration failed:', err);
    }
  }, []);

  useEffect(() => {
    updateAudioDevices();
  }, [updateAudioDevices]);

  // Clean up Audio VAD (Voice Activity Detection)
  const cleanupVAD = useCallback(() => {
    if (vadAnimFrameRef.current !== null) {
      cancelAnimationFrame(vadAnimFrameRef.current);
      vadAnimFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Initialize VAD on local microphone stream
  const setupVAD = useCallback((stream: MediaStream) => {
    try {
      cleanupVAD();

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const THRESHOLD = 12; // 12% speaking volume threshold

      let currentSpeakingState = false;

      const vadLoop = () => {
        if (!analyserRef.current || !audioContextRef.current) return;

        if (isMutedRef.current) {
          if (currentSpeakingState) {
            currentSpeakingState = false;
            setIsSpeaking(false);
            setAudioLevel(0);
            onSpeakingChange?.(false, 0);
            syncSocket.sendVoiceSpeaking(false);
          }
          vadAnimFrameRef.current = requestAnimationFrame(vadLoop);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(100, Math.round((rms / 128) * 100));

        setAudioLevel(level);

        if (level >= THRESHOLD) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (!currentSpeakingState) {
            currentSpeakingState = true;
            setIsSpeaking(true);
            onSpeakingChange?.(true, level);
            syncSocket.sendVoiceSpeaking(true);
          }
        } else if (currentSpeakingState && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            currentSpeakingState = false;
            setIsSpeaking(false);
            silenceTimerRef.current = null;
            onSpeakingChange?.(false, 0);
            syncSocket.sendVoiceSpeaking(false);
          }, 320);
        }

        vadAnimFrameRef.current = requestAnimationFrame(vadLoop);
      };

      vadAnimFrameRef.current = requestAnimationFrame(vadLoop);
    } catch (e) {
      console.warn('[useVoiceChat] VAD setup warning:', e);
    }
  }, [cleanupVAD, onSpeakingChange]);

  // Create or get RTCPeerConnection for a remote peer
  const getOrCreatePeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(remoteUserId);
    if (pc) return pc;

    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Send ICE candidates via WebSocket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        syncSocket.sendVoiceIce(remoteUserId, event.candidate);
      }
    };

    // Handle incoming audio track
    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);

      let audioEl = remoteAudioElementsRef.current.get(remoteUserId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        remoteAudioElementsRef.current.set(remoteUserId, audioEl);
      }

      audioEl.srcObject = stream;
      audioEl.muted = isDeafenedRef.current;

      audioEl.play().catch((e) => {
        console.warn('[useVoiceChat] Audio element play warning:', e);
      });

      setParticipants((prev) => {
        const existing = prev[remoteUserId];
        if (existing && audioEl) {
          audioEl.volume = (existing.volume ?? 100) / 100;
        }
        return {
          ...prev,
          [remoteUserId]: {
            ...(existing || {
              userId: remoteUserId,
              name: 'Участник',
              avatar: '🍿',
              color: '#6366f1',
              isSpeaking: false,
              isMuted: false,
              isDeafened: false,
              volume: 100,
            }),
            stream,
          },
        };
      });
    };

    pc.oniceconnectionstatechange = () => {
      if (
        pc?.iceConnectionState === 'disconnected' ||
        pc?.iceConnectionState === 'failed' ||
        pc?.iceConnectionState === 'closed'
      ) {
        closePeer(remoteUserId);
      }
    };

    peerConnectionsRef.current.set(remoteUserId, pc);
    return pc;
  }, []);

  // Close peer connection and cleanup audio
  const closePeer = useCallback((remoteUserId: string) => {
    const pc = peerConnectionsRef.current.get(remoteUserId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(remoteUserId);
    }

    const audioEl = remoteAudioElementsRef.current.get(remoteUserId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      remoteAudioElementsRef.current.delete(remoteUserId);
    }

    setParticipants((prev) => {
      const next = { ...prev };
      delete next[remoteUserId];
      return next;
    });
  }, []);

  // Create and send WebRTC Offer to a peer
  const createAndSendOffer = useCallback(async (remoteUserId: string) => {
    const pc = getOrCreatePeerConnection(remoteUserId);

    try {
      if (localStreamRef.current) {
        const senders = pc.getSenders();
        localStreamRef.current.getAudioTracks().forEach((track) => {
          if (!senders.some((s) => s.track === track)) {
            pc.addTrack(track, localStreamRef.current!);
          }
        });
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      syncSocket.sendVoiceOffer(remoteUserId, offer);
    } catch (err) {
      console.error(`[useVoiceChat] Failed to create offer for ${remoteUserId}:`, err);
    }
  }, [getOrCreatePeerConnection]);

  // Handle incoming Offer
  const handleOffer = useCallback(async (fromUserId: string, offer: RTCSessionDescriptionInit, metadata?: any) => {
    if (!isConnectedRef.current || !fromUserId) return;

    if (metadata) {
      setParticipants((prev) => ({
        ...prev,
        [fromUserId]: {
          ...(prev[fromUserId] || {
            userId: fromUserId,
            name: metadata.name || 'Участник',
            avatar: metadata.avatar || '🍿',
            color: metadata.color || '#6366f1',
            isSpeaking: false,
            isMuted: false,
            isDeafened: false,
            volume: 100,
          }),
        },
      }));
    }

    const pc = getOrCreatePeerConnection(fromUserId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      if (localStreamRef.current) {
        const senders = pc.getSenders();
        localStreamRef.current.getAudioTracks().forEach((track) => {
          if (!senders.some((s) => s.track === track)) {
            pc.addTrack(track, localStreamRef.current!);
          }
        });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      syncSocket.sendVoiceAnswer(fromUserId, answer);
    } catch (err) {
      console.error(`[useVoiceChat] Failed to handle offer from ${fromUserId}:`, err);
    }
  }, [getOrCreatePeerConnection]);

  // Handle incoming Answer
  const handleAnswer = useCallback(async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc) return;

    try {
      if (pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error(`[useVoiceChat] Failed to handle answer from ${fromUserId}:`, err);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIce = useCallback(async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc || !candidate) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[useVoiceChat] ICE candidate addition warning from ${fromUserId}:`, err);
    }
  }, []);

  // Connect to Voice Chat
  const joinVoice = useCallback(async (options?: { deviceId?: string }): Promise<boolean> => {
    try {
      setIsConnecting(true);
      setError(null);

      const constraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (options?.deviceId) {
        constraints.deviceId = { exact: options.deviceId };
        setSelectedAudioDevice(options.deviceId);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: constraints,
        video: false,
      });

      localStreamRef.current = stream;
      setIsMuted(false);
      setIsConnected(true);
      setIsConnecting(false);

      setupVAD(stream);

      // Send voice:join event over WebSocket
      syncSocket.sendVoiceJoin(false);

      updateAudioDevices();
      return true;
    } catch (err: any) {
      console.error('[useVoiceChat] Microphone connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setError(err.message || 'Не удалось получить доступ к микрофону');
      return false;
    }
  }, [setupVAD, updateAudioDevices]);

  // Disconnect from Voice Chat
  const leaveVoice = useCallback(() => {
    if (isConnectedRef.current) {
      syncSocket.sendVoiceLeave();
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    remoteAudioElementsRef.current.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    remoteAudioElementsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    cleanupVAD();

    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setAudioLevel(0);
    setParticipants({});
  }, [cleanupVAD]);

  // Mute / Unmute
  const toggleMute = useCallback((): boolean => {
    setIsMuted((prev) => {
      const next = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      if (next) {
        setIsSpeaking(false);
        setAudioLevel(0);
        onSpeakingChange?.(false, 0);
      }
      syncSocket.sendVoiceState(next, isDeafenedRef.current);
      return next;
    });
    return !isMuted;
  }, [isMuted, onSpeakingChange]);

  const setMute = useCallback((muted: boolean) => {
    setIsMuted(muted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (muted) {
      setIsSpeaking(false);
      setAudioLevel(0);
      onSpeakingChange?.(false, 0);
    }
    syncSocket.sendVoiceState(muted, isDeafenedRef.current);
  }, [onSpeakingChange]);

  // Deafen / Undeafen
  const toggleDeafen = useCallback((): boolean => {
    setIsDeafened((prev) => {
      const next = !prev;
      remoteAudioElementsRef.current.forEach((el) => {
        el.muted = next;
      });
      syncSocket.sendVoiceState(isMutedRef.current, next);
      return next;
    });
    return !isDeafened;
  }, [isDeafened]);

  const setDeafen = useCallback((deafened: boolean) => {
    setIsDeafened(deafened);
    remoteAudioElementsRef.current.forEach((el) => {
      el.muted = deafened;
    });
    syncSocket.sendVoiceState(isMutedRef.current, deafened);
  }, []);

  // Per-Participant Volume Control (0 - 100%)
  const setPeerVolume = useCallback((peerUserId: string, volume: number) => {
    const clamped = Math.max(0, Math.min(100, volume));
    setParticipants((prev) => {
      if (!prev[peerUserId]) return prev;
      return {
        ...prev,
        [peerUserId]: {
          ...prev[peerUserId],
          volume: clamped,
        },
      };
    });

    const audioEl = remoteAudioElementsRef.current.get(peerUserId);
    if (audioEl) {
      audioEl.volume = clamped / 100;
    }
  }, []);

  // Switch Microphone Audio Device
  const switchAudioDevice = useCallback(async (deviceId: string) => {
    try {
      setSelectedAudioDevice(deviceId);
      if (!isConnectedRef.current) return;

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const newAudioTrack = newStream.getAudioTracks()[0];

      // Replace audio track in all active RTCPeerConnections
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender && newAudioTrack) {
          audioSender.replaceTrack(newAudioTrack);
        }
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      localStreamRef.current = newStream;
      newAudioTrack.enabled = !isMutedRef.current;
      setupVAD(newStream);
    } catch (e) {
      console.error('[useVoiceChat] Failed to switch audio device:', e);
    }
  }, [setupVAD]);

  // Handle Moderator Forced Mute
  useEffect(() => {
    if (isMutedByMod && !isMuted && isConnected) {
      setMute(true);
    }
  }, [isMutedByMod, isMuted, isConnected, setMute]);

  // WebSocket signaling subscription for Voice Events
  useEffect(() => {
    const unsub = syncSocket.subscribe((msg: any) => {
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'voice:peers_list': {
          if (!isConnectedRef.current) return;
          const peers = Array.isArray(msg.peers) ? msg.peers : [];
          for (const peer of peers) {
            if (peer.userId && peer.userId !== userId) {
              setParticipants((prev) => ({
                ...prev,
                [peer.userId]: {
                  userId: peer.userId,
                  name: peer.name || 'Участник',
                  avatar: peer.avatar || '🍿',
                  color: peer.color || '#6366f1',
                  isMuted: Boolean(peer.isMuted),
                  isDeafened: Boolean(peer.isDeafened),
                  isSpeaking: Boolean(peer.isSpeaking),
                  volume: 100,
                },
              }));
              createAndSendOffer(peer.userId);
            }
          }
          break;
        }

        case 'voice:user_joined': {
          if (!isConnectedRef.current) return;
          const peer = msg.peer;
          if (peer && peer.userId && peer.userId !== userId) {
            setParticipants((prev) => ({
              ...prev,
              [peer.userId]: {
                userId: peer.userId,
                name: peer.name || 'Участник',
                avatar: peer.avatar || '🍿',
                color: peer.color || '#6366f1',
                isMuted: Boolean(peer.isMuted),
                isDeafened: Boolean(peer.isDeafened),
                isSpeaking: false,
                volume: 100,
              },
            }));
            createAndSendOffer(peer.userId);
          }
          break;
        }

        case 'voice:user_left': {
          if (msg.userId) {
            closePeer(msg.userId);
          }
          break;
        }

        case 'voice:offer': {
          if (msg.fromUserId && msg.offer) {
            handleOffer(msg.fromUserId, msg.offer, {
              name: msg.name,
              avatar: msg.avatar,
              color: msg.color,
            });
          }
          break;
        }

        case 'voice:answer': {
          if (msg.fromUserId && msg.answer) {
            handleAnswer(msg.fromUserId, msg.answer);
          }
          break;
        }

        case 'voice:ice':
        case 'voice:ice_candidate': {
          const candidate = msg.candidate || msg.ice;
          if (msg.fromUserId && candidate) {
            handleIce(msg.fromUserId, candidate);
          }
          break;
        }

        case 'voice:state': {
          if (msg.userId && msg.userId !== userId) {
            setParticipants((prev) => {
              const p = prev[msg.userId];
              if (!p) return prev;
              return {
                ...prev,
                [msg.userId]: {
                  ...p,
                  isMuted: typeof msg.isMuted === 'boolean' ? msg.isMuted : p.isMuted,
                  isDeafened: typeof msg.isDeafened === 'boolean' ? msg.isDeafened : p.isDeafened,
                },
              };
            });
          }
          break;
        }

        case 'voice:speaking':
        case 'voice:active': {
          if (msg.userId && msg.userId !== userId) {
            const speaking = typeof msg.isSpeaking === 'boolean' ? msg.isSpeaking : Boolean(msg.active);
            const level = typeof msg.volume === 'number' ? msg.volume : (msg.audioLevel ?? 0);
            setParticipants((prev) => {
              const p = prev[msg.userId];
              if (!p) return prev;
              return {
                ...prev,
                [msg.userId]: {
                  ...p,
                  isSpeaking: speaking,
                  audioLevel: level,
                },
              };
            });
          }
          break;
        }
      }
    });

    return () => {
      unsub();
    };
  }, [userId, createAndSendOffer, handleOffer, handleAnswer, handleIce, closePeer]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice]);

  return {
    isConnected,
    isConnecting,
    isMuted,
    isDeafened,
    isSpeaking,
    audioLevel,
    participants: Object.values(participants),
    participantsMap: participants,
    error,
    selectedAudioDevice,
    availableDevices,
    joinVoice,
    leaveVoice,
    toggleMute,
    setMute,
    toggleDeafen,
    setDeafen,
    setPeerVolume,
    switchAudioDevice,
  };
}

export default useVoiceChat;
