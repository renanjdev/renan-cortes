import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

const resolvedFfmpegPath = typeof ffmpegPath === "string" ? ffmpegPath : null;

if (!resolvedFfmpegPath) {
  throw new Error("Nao foi possivel localizar o binario do ffmpeg.");
}

ffmpeg.setFfmpegPath(resolvedFfmpegPath);

export { ffmpeg, resolvedFfmpegPath };
