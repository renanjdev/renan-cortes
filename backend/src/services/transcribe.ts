import { ffmpeg } from "./ffmpeg.ts";
import path from "path";
import fs from "fs";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(videoPath: string, destDir: string): Promise<any> {
  const audioPath = path.join(destDir, "audio.mp3");

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY nao configurada no servidor.");
  }

  // 🔥 EXTRAÇÃO OTIMIZADA
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .toFormat("mp3")
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate("32k")
      .audioFilters([
        "silenceremove=1:0:-50dB", // 🔥 remove silêncio
        "loudnorm" // 🔥 normaliza volume
      ])
      .on("end", () => {
        const stats = fs.statSync(audioPath);
        const fileSizeInMegabytes = stats.size / (1024 * 1024);

        if (fileSizeInMegabytes > 25) {
          reject(
            new Error(
              `Audio extraido com ${fileSizeInMegabytes.toFixed(
                2
              )}MB excede o limite de 25MB da OpenAI.`
            )
          );
          return;
        }

        resolve(true);
      })
      .on("error", reject)
      .save(audioPath);
  });

  // 🔥 TRANSCRIÇÃO COM MELHOR QUALIDADE
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    temperature: 0, // 🔥 mais consistência
  });

  return response;
}