/**
 * Compression utilities for images, audio, and video
 * Implements industry-standard compression before encryption
 */

/**
 * Compress image using Canvas API and convert to WebP
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width (default: 1920px)
 * @param {number} quality - Quality 0-1 (default: 0.85)
 * @returns {Promise<Blob>} Compressed image blob
 */
export const compressImage = async (file, maxWidth = 1920, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to WebP (or JPEG as fallback)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/webp',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Get optimal audio recording constraints
 * @param {string} quality - 'high', 'medium', or 'low'
 * @returns {Object} MediaRecorder constraints
 */
export const getAudioConstraints = (quality = 'medium') => {
  const constraints = {
    high: {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
        sampleSize: 16
      }
    },
    medium: {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 24000,
        channelCount: 1,
        sampleSize: 16
      }
    },
    low: {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
        sampleSize: 16
      }
    }
  };
  
  return constraints[quality] || constraints.medium;
};

/**
 * Get optimal MediaRecorder options
 * @returns {Object} MediaRecorder options
 */
export const getMediaRecorderOptions = () => {
  // Try Opus codec first (best compression for voice)
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/ogg',
  ];
  
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      console.log(`Using audio codec: ${mimeType}`);
      return {
        mimeType,
        audioBitsPerSecond: 32000 // 32 kbps - optimal for voice
      };
    }
  }
  
  // Fallback to default
  return { audioBitsPerSecond: 32000 };
};

/**
 * Detect file type and recommend compression
 * @param {File} file
 * @returns {Object} Compression recommendation
 */
export const getCompressionStrategy = (file) => {
  const type = file.type.split('/')[0];
  const size = file.size;
  
  const strategy = {
    shouldCompress: false,
    method: null,
    estimatedSize: size,
    estimatedTime: 0
  };
  
  if (type === 'image' && size > 500 * 1024) { // > 500KB
    strategy.shouldCompress = true;
    strategy.method = 'image';
    strategy.estimatedSize = size * 0.2; // ~80% reduction
    strategy.estimatedTime = Math.min(size / (1024 * 1024) * 1000, 5000); // Max 5s
  } else if (type === 'video' && size > 5 * 1024 * 1024) { // > 5MB
    strategy.shouldCompress = true;
    strategy.method = 'video';
    strategy.estimatedSize = size * 0.15; // ~85% reduction (would need FFmpeg)
    strategy.estimatedTime = Math.min(size / (1024 * 1024) * 2000, 30000); // Max 30s
  }
  
  return strategy;
};
