import { useEffect, useRef } from 'react';

interface ChromaKeyVideoProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const ChromaKeyVideo: React.FC<ChromaKeyVideoProps> = ({ videoRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      if (!videoRef.current || !canvas) return;
      canvas.width = videoRef.current.videoWidth || 640;  // fallback size
      canvas.height = videoRef.current.videoHeight || 480; // fallback size
    };

    const processFrame = () => {
      if (!videoRef.current || !ctx) return;
      
      // Update canvas size if video dimensions change
      if (canvas.width !== videoRef.current.videoWidth) {
        updateCanvasSize();
      }

      // Only process if video has valid dimensions
      if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Detect green screen (adjust these values as needed)
          if (g > 100 && g > r * 1.4 && g > b * 1.4) {
            data[i + 3] = 0; // Set alpha to 0 for green pixels
          }
        }

        ctx.putImageData(imageData, 0, 0);
      }
      
      requestAnimationFrame(processFrame);
    };

    // Wait for video metadata to load
    videoRef.current.addEventListener('loadedmetadata', updateCanvasSize);
    videoRef.current.addEventListener('play', processFrame);

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', updateCanvasSize);
        videoRef.current.removeEventListener('play', processFrame);
      }
    };
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        backgroundColor: '#121212',
      }}
    />
  );
};

export default ChromaKeyVideo; 