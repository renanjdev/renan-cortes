import { ffmpeg } from "./ffmpeg.ts";

const PORTRAIT_FILTER =
  "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";

/**
 * Recorta um segmento de video em formato 9:16.
 */
export async function exportVideoSegment(
  sourcePath: string,
  outputPath: string,
  start: number,
  duration: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .setStartTime(start)
      .setDuration(duration)
      .videoFilters(PORTRAIT_FILTER)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset", "veryfast", "-crf", "23", "-movflags", "+faststart"])
      .output(outputPath)
      .on("end", () => {
        console.log(`[Export] Corte 9:16 concluido: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("[Export] Erro no FFmpeg:", err);
        reject(err);
      })
      .run();
  });
}
