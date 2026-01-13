/**
 * WebRTC optimization utilities
 * Implements industry-standard practices for call quality
 */

/**
 * Get optimal peer connection configuration with STUN servers
 * @returns {Object} RTCPeerConnection configuration
 */
export const getPeerConnectionConfig = () => {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };
};

/**
 * Get optimal media constraints for voice calls
 * @param {string} quality - 'high', 'medium', or 'low'
 * @returns {Object} getUserMedia constraints
 */
export const getCallMediaConstraints = (quality = 'high') => {
  const constraints = {
    high: {
      video: false,
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 1 },
        latency: { ideal: 0 },
        volume: { ideal: 1.0 }
      }
    },
    medium: {
      video: false,
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        sampleRate: { ideal: 24000 },
        channelCount: { ideal: 1 }
      }
    },
    low: {
      video: false,
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        sampleRate: { ideal: 16000 },
        channelCount: { ideal: 1 }
      }
    }
  };
  
  return constraints[quality] || constraints.high;
};

/**
 * Network quality levels based on metrics
 */
export const NetworkQuality = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  DISCONNECTED: 'disconnected'
};

/**
 * Calculate network quality from WebRTC stats
 * @param {Object} stats - RTCStatsReport
 * @returns {Object} Quality metrics
 */
export const calculateNetworkQuality = (stats) => {
  const metrics = {
    rtt: 0,
    packetLoss: 0,
    jitter: 0,
    bitrate: 0,
    quality: NetworkQuality.DISCONNECTED
  };
  
  if (!stats) return metrics;
  
  let packetsLost = 0;
  let packetsReceived = 0;
  
  stats.forEach((report) => {
    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      metrics.jitter = report.jitter * 1000 || 0; // Convert to ms
      packetsLost += report.packetsLost || 0;
      packetsReceived += report.packetsReceived || 0;
    }
    
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      metrics.rtt = report.currentRoundTripTime * 1000 || 0; // Convert to ms
    }
    
    if (report.type === 'inbound-rtp') {
      const bitrate = report.bytesReceived * 8 / report.timestamp * 1000;
      if (!isNaN(bitrate)) {
        metrics.bitrate = bitrate;
      }
    }
  });
  
  // Calculate packet loss percentage
  if (packetsReceived > 0) {
    metrics.packetLoss = (packetsLost / (packetsLost + packetsReceived)) * 100;
  }
  
  // Determine overall quality
  if (metrics.rtt === 0) {
    metrics.quality = NetworkQuality.DISCONNECTED;
  } else if (metrics.rtt < 150 && metrics.packetLoss < 1 && metrics.jitter < 30) {
    metrics.quality = NetworkQuality.EXCELLENT;
  } else if (metrics.rtt < 250 && metrics.packetLoss < 3 && metrics.jitter < 50) {
    metrics.quality = NetworkQuality.GOOD;
  } else if (metrics.rtt < 400 && metrics.packetLoss < 5 && metrics.jitter < 100) {
    metrics.quality = NetworkQuality.FAIR;
  } else {
    metrics.quality = NetworkQuality.POOR;
  }
  
  return metrics;
};

/**
 * Get recommended audio bitrate based on network quality
 * @param {string} quality - Network quality level
 * @returns {number} Bitrate in bps
 */
export const getRecommendedBitrate = (quality) => {
  const bitrates = {
    [NetworkQuality.EXCELLENT]: 48000,
    [NetworkQuality.GOOD]: 32000,
    [NetworkQuality.FAIR]: 24000,
    [NetworkQuality.POOR]: 16000,
    [NetworkQuality.DISCONNECTED]: 16000
  };
  
  return bitrates[quality] || 32000;
};

/**
 * Format network quality for display
 * @param {Object} metrics - Quality metrics
 * @returns {string} Formatted string
 */
export const formatNetworkQuality = (metrics) => {
  const qualityEmojis = {
    [NetworkQuality.EXCELLENT]: '🟢',
    [NetworkQuality.GOOD]: '🟡',
    [NetworkQuality.FAIR]: '🟠',
    [NetworkQuality.POOR]: '🔴',
    [NetworkQuality.DISCONNECTED]: '⚫'
  };
  
  return `${qualityEmojis[metrics.quality]} ${metrics.quality.toUpperCase()} | RTT: ${metrics.rtt.toFixed(0)}ms | Loss: ${metrics.packetLoss.toFixed(1)}%`;
};

/**
 * Apply adaptive bitrate to peer connection
 * @param {RTCPeerConnection} peerConnection
 * @param {number} bitrate - Target bitrate in bps
 */
export const applyAdaptiveBitrate = async (peerConnection, bitrate) => {
  if (!peerConnection || peerConnection.connectionState !== 'connected') {
    return;
  }
  
  const senders = peerConnection.getSenders();
  
  for (const sender of senders) {
    if (sender.track && sender.track.kind === 'audio') {
      const parameters = sender.getParameters();
      
      if (!parameters.encodings) {
        parameters.encodings = [{}];
      }
      
      parameters.encodings[0].maxBitrate = bitrate;
      
      try {
        await sender.setParameters(parameters);
        console.log(`Applied bitrate: ${bitrate / 1000}kbps`);
      } catch (err) {
        console.error('Failed to apply bitrate:', err);
      }
    }
  }
};
