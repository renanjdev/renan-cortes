import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

/**
 * Recorta um segmento de um vídeo.
 */
export async function exportVideoSegment(
  sourcePath: string, 
  outputPath: string, 
  start: number, 
  duration: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .setStartTime(start)
      .setDuration(duration)
      .output(outputPath)
      .on('end', () => {
        console.log(`[Export] Corte concluído: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[Export] Erro no FFmpeg:`, err);
        reject(err);
      })
      .run();
  });
}
