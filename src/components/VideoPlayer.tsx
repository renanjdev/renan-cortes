import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoPlayerProps {
  videoId?: string;
  videoUrl?: string;
  start: number;
  end: number;
  onClose: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, videoUrl, start, end, onClose }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.currentTime = start;
      const handleTimeUpdate = () => {
        if (videoRef.current && videoRef.current.currentTime >= end) {
          videoRef.current.pause();
        }
      };
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
      return () => {
        videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [videoUrl, start, end]);

  // YouTube embed URL with start and end parameters
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?start=${Math.floor(start)}&end=${Math.floor(end)}&autoplay=1&rel=0` : '';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors border border-white/10"
        >
          <X size={20} />
        </button>
        
        {videoId ? (
          <iframe
            src={embedUrl}
            title="YouTube Video Player"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        ) : videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/50">
            Fonte de vídeo não encontrada
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10">
          <p className="text-white/60 text-[10px] font-mono tracking-widest uppercase">
            Preview Segmento: {Math.floor(start)}s — {Math.floor(end)}s
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
