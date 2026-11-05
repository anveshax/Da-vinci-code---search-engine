import React, { useRef, useEffect } from 'react';
import { VoiceState } from '../../services/voiceService';

interface AudioVisualizerProps {
  status: VoiceState;
  frequencyData: number[];
  audioLevel: number;
  width?: number;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  status,
  frequencyData,
  audioLevel,
  width = 320,
  height = 90,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const numPoints = frequencyData.length || 24;
    const sliceWidth = width / (numPoints - 1);

    // Pick gradient based on status
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    if (status === 'SPEAKING') {
      gradient.addColorStop(0, '#10b981');
      gradient.addColorStop(0.5, '#06b6d4');
      gradient.addColorStop(1, '#3b82f6');
    } else if (status === 'PROCESSING') {
      gradient.addColorStop(0, '#a855f7');
      gradient.addColorStop(0.5, '#6366f1');
      gradient.addColorStop(1, '#ec4899');
    } else if (status === 'ERROR') {
      gradient.addColorStop(0, '#ef4444');
      gradient.addColorStop(1, '#f97316');
    } else {
      gradient.addColorStop(0, '#06b6d4');
      gradient.addColorStop(0.5, '#38bdf8');
      gradient.addColorStop(1, '#3b82f6');
    }

    // Draw smooth top and mirrored bottom bezier curves
    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < numPoints; i++) {
      const x = i * sliceWidth;
      const amp = (frequencyData[i] || 0) * (height * 0.42) * (status === 'IDLE' ? 0.1 : 1.0);
      const y = centerY - amp;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * sliceWidth;
        const prevAmp = (frequencyData[i - 1] || 0) * (height * 0.42) * (status === 'IDLE' ? 0.1 : 1.0);
        const prevY = centerY - prevAmp;
        const cX = (prevX + x) / 2;
        const cY = (prevY + y) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cX, cY);
      }
    }
    ctx.stroke();

    // Mirrored lower line with subtle glow
    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < numPoints; i++) {
      const x = i * sliceWidth;
      const amp = (frequencyData[i] || 0) * (height * 0.35) * (status === 'IDLE' ? 0.1 : 1.0);
      const y = centerY + amp;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * sliceWidth;
        const prevAmp = (frequencyData[i - 1] || 0) * (height * 0.35) * (status === 'IDLE' ? 0.1 : 1.0);
        const prevY = centerY + prevAmp;
        const cX = (prevX + x) / 2;
        const cY = (prevY + y) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cX, cY);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }, [frequencyData, audioLevel, status, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="pointer-events-none"
    />
  );
};
