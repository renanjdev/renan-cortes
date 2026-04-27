import { getTranscript, getVideoMetadata } from "./services/youtube.ts";
import { transcribeAudio } from "./services/transcribe.ts";
import { analyzeSegments, analyzeFromContext } from "./services/analyze.ts";
import { segmentVideo } from "./services/segment.ts";
import { exportVideoSegment } from "./services/export.ts";
import fs from "fs/promises";
import path from "path";
import { existsSync, mkdirSync } from "fs";

const TEMP_DIR = path.join(process.cwd(), "temp");
const EXPORTS_DIR = path.join(process.cwd(), "exports");

if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR);
}

if (!existsSync(EXPORTS_DIR)) {
  mkdirSync(EXPORTS_DIR);
}

export async function runWorker(data: { url?: string; filePath?: string }, onProgress: (progress: number) => void) {
  const jobId = Math.random().toString(36).substring(7);
  const workDir = path.join(TEMP_DIR, jobId);

  if (!existsSync(workDir)) {
    mkdirSync(workDir);
  }

  try {
    let transcription = "";

    if (data.url) {
      onProgress(10);
      console.log(`[Worker] Processando link: ${data.url}`);

      try {
        transcription = await getTranscript(data.url);
        onProgress(50);
      } catch (error: any) {
        console.warn("[Worker] Nao foi possivel obter a transcricao direta. Tentando metadados.");
        const metadata = await getVideoMetadata(data.url);
        if (!metadata) throw new Error("Link invalido ou inacessivel.");

        onProgress(70);
        return await analyzeFromContext(metadata);
      }
    } else if (data.filePath) {
      onProgress(20);
      console.log(`[Worker] Processando arquivo: ${data.filePath}`);
      transcription = await transcribeAudio(data.filePath, workDir);
      onProgress(60);
    } else {
      throw new Error("Nenhum input fornecido (URL ou arquivo).");
    }

    onProgress(70);
    console.log("[Worker] Segmentando e analisando conteudo...");
    const segments = await segmentVideo(transcription);
    console.log(`[Worker] Candidatos gerados a partir da transcricao: ${segments.length}`);
    const analysis = await analyzeSegments(segments);
    console.log(`[Worker] Cortes aprovados pela analise: ${analysis.length}`);

    if (!data.filePath || analysis.length === 0) {
      onProgress(100);
      return analysis;
    }

    const exportedCuts = [];
    for (let index = 0; index < analysis.length; index += 1) {
      const cut = analysis[index];
      const exportId = `cut_v2_9x16_${jobId}_${String(index + 1).padStart(2, "0")}_${Math.round(cut.score)}_${Math.floor(cut.start)}_${Math.floor(cut.end)}.mp4`;
      const outputPath = path.join(EXPORTS_DIR, exportId);

      await exportVideoSegment(data.filePath, outputPath, cut.start, cut.end - cut.start);

      exportedCuts.push({
        ...cut,
        downloadUrl: `/exports/${exportId}`,
        exportId,
      });

      const progress = 70 + Math.round(((index + 1) / analysis.length) * 30);
      onProgress(Math.min(progress, 100));
    }

    onProgress(100);
    return exportedCuts;
  } catch (error) {
    console.error("[Worker] Erro no processamento:", error);
    throw error;
  } finally {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {}
  }
}
