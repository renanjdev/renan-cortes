import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Obtém a transcrição de um vídeo do YouTube sem fazer download.
 */
export async function getTranscript(url: string): Promise<string> {
  try {
    const videoId = extractYoutubeId(url);
    if (!videoId) throw new Error('URL do YouTube inválida');

    console.log(`[YouTube] Buscando transcrição para: ${videoId}`);
    
    // Adiciona um timeout de 10 segundos para a busca da transcrição
    const transcriptPromise = YoutubeTranscript.fetchTranscript(videoId);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout ao buscar transcrição do YouTube')), 10000)
    );

    const transcriptItems = await Promise.race([transcriptPromise, timeoutPromise]) as any[];
    
    return transcriptItems
      .map(item => item.text)
      .join(' ');
  } catch (error: any) {
    console.error('[YouTube] Erro ao buscar transcrição:', error.message);
    throw new Error('Não foi possível obter a transcrição deste vídeo. Verifique se ele possui legendas ou tente o upload direto do arquivo.');
  }
}

function extractYoutubeId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

export async function getVideoMetadata(url: string) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!response.ok) return null;
    const data: any = await response.json();
    return {
      title: data.title,
      author: data.author_name
    };
  } catch (e) {
    return null;
  }
}
