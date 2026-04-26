import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function transcribeAudio(videoPath: string, destDir: string): Promise<any> {
  const audioPath = path.join(destDir, 'audio.mp3');

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada no servidor.');
  }

  // Extract audio optimized for Whisper (mono, low bitrate to stay under 25MB)
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .toFormat('mp3')
      .audioChannels(1)
      .audioBitrate('64k')
      .on('end', () => {
        const stats = fs.statSync(audioPath);
        const fileSizeInMegabytes = stats.size / (1024 * 1024);
        if (fileSizeInMegabytes > 25) {
          console.warn(`[Transcribe] Aviso: Áudio extraído (${fileSizeInMegabytes.toFixed(2)}MB) excede o limite de 25MB da OpenAI.`);
        }
        resolve(true);
      })
      .on('error', reject)
      .save(audioPath);
  });

  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
  });

  return response;
}
