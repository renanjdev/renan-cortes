import { getTranscript, getVideoMetadata } from './services/youtube.ts';
import { transcribeAudio } from './services/transcribe.ts';
import { analyzeSegments, analyzeFromContext } from './services/analyze.ts';
import { segmentVideo } from './services/segment.ts';
import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const TEMP_DIR = path.join(process.cwd(), 'temp');

if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR);
}

export async function runWorker(data: { url?: string; filePath?: string }, onProgress: (progress: number) => void) {
  const jobId = Math.random().toString(36).substring(7);
  const workDir = path.join(TEMP_DIR, jobId);
  
  if (!existsSync(workDir)) {
    mkdirSync(workDir);
  }

  try {
    let transcription = '';

    if (data.url) {
      onProgress(10);
      console.log(`[Worker] Processando link: ${data.url}`);
      
      try {
        transcription = await getTranscript(data.url);
        onProgress(50);
      } catch (e: any) {
        console.warn(`[Worker] Não foi possível obter transcrição direta. Tentando metadados.`);
        const metadata = await getVideoMetadata(data.url);
        if (!metadata) throw new Error("Link inválido ou inacessível.");
        
        onProgress(70);
        return await analyzeFromContext(metadata);
      }
    } else if (data.filePath) {
      onProgress(20);
      console.log(`[Worker] Processando arquivo: ${data.filePath}`);
      transcription = await transcribeAudio(data.filePath, workDir);
      onProgress(60);
    } else {
      throw new Error("Nenhum input fornecido (URL ou Arquivo)");
    }

    onProgress(70);
    console.log(`[Worker] Segmentando e Analisando conteúdo...`);
    const segments = await segmentVideo(transcription);
    const analysis = await analyzeSegments(segments);
    
    onProgress(100);
    return analysis;
  } catch (error) {
    console.error(`[Worker] Erro no processamento:`, error);
    throw error;
  } finally {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
      // Keep data.filePath for export feature
      // if (data.filePath && existsSync(data.filePath)) {
      //   await fs.rm(data.filePath, { force: true });
      // }
    } catch (e) {}
  }
}
