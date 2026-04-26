import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, Scissors, Loader2, CheckCircle2, AlertCircle, PlayCircle, Trophy, Sparkles, Download } from 'lucide-react';
import { VideoPlayer } from './components/VideoPlayer';

interface Result {
  start: number;
  end: number;
  score: number;
  hook: string;
  motivo: string;
  text?: string;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: Result[];
  error?: string;
  filePath?: string;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [previewCut, setPreviewCut] = useState<{ videoId?: string, videoUrl?: string, start: number, end: number } | null>(null);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.ok ? setServerStatus('online') : setServerStatus('offline'))
      .catch(() => setServerStatus('offline'));
  }, []);

  const handleExport = async (cut: Result, index: number) => {
    if (!activeJobId) return;
    
    setExportingIndex(index);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: activeJobId,
          start: cut.start,
          end: cut.end
        }),
      });

      const data = await response.json();
      if (data.downloadUrl) {
        // Trigger download
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = `corte_${activeJobId}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert(data.error || "Erro ao exportar vídeo.");
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Erro na conexão ao exportar.");
    } finally {
      setExportingIndex(null);
    }
  };

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url && !file) return;

    setIsSubmitting(true);
    setUploadProgress(null);
    
    try {
      let responseData;
      if (file) {
        responseData = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append('video', file);

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded * 100) / e.total);
              setUploadProgress(percent);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                reject(new Error("Resposta do servidor inválida"));
              }
            } else {
              let errorMessage = `Erro no upload: ${xhr.status} ${xhr.statusText}`;
              try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) errorMessage += ` - ${response.error}`;
              } catch (e) {}
              reject(new Error(errorMessage));
            }
          });

          xhr.addEventListener('error', () => reject(new Error("Falha na conexão de rede")));
          xhr.open('POST', '/api/upload');
          xhr.send(formData);
        });
      } else {
        const response = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        responseData = await response.json();
      }

      const data = responseData as any;
      if (data.jobId) {
        setActiveJobId(data.jobId);
        setJobStatus({ id: data.jobId, status: 'pending', progress: 0 });
      } else if (data.error) {
        setJobStatus({ id: 'error', status: 'failed', progress: 0, error: data.error });
      }
    } catch (error: any) {
      console.error('Error starting process:', error);
      setJobStatus({ 
        id: 'error', 
        status: 'failed', 
        progress: 0, 
        error: `Erro ao iniciar processo: ${error.message || 'Verifique sua conexão ou o tamanho do arquivo'}` 
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  useEffect(() => {
    let interval: number;
    if (activeJobId && (jobStatus?.status === 'pending' || jobStatus?.status === 'processing')) {
      interval = window.setInterval(async () => {
        try {
          const response = await fetch(`/api/status/${activeJobId}`);
          const data = await response.json();
          setJobStatus(data);
          
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [activeJobId, jobStatus?.status]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-teal-500/30 flex flex-col">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Scissors size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter uppercase italic">Cortes <span className="text-teal-400">IA</span></h1>
          <span className="hidden sm:inline ml-4 text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/40 uppercase tracking-widest font-mono">v1.0.4-engine</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              serverStatus === 'online' ? 'bg-teal-500' : 
              serverStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
            }`}></div>
            <span className="text-[10px] text-white/60 font-mono uppercase">
              Engine: {serverStatus === 'online' ? 'Connected' : serverStatus === 'offline' ? 'Disconnected' : 'Checking...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${activeJobId ? 'bg-teal-500 animate-pulse' : 'bg-slate-700'}`}></div>
            <span className="text-[10px] text-white/60 font-mono uppercase">Status: {activeJobId ? 'Processing' : 'Idle'}</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto w-full px-6 py-12 flex-1">
        <header className="text-center mb-12">
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-teal-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-2"
          >
            Motor de Geração de Cortes Virais
          </motion.p>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-lg max-w-xl mx-auto"
          >
            Transforme vídeos em trechos de alta retenção com análise de IA especializada.
          </motion.p>
        </header>

        <section className="mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-6 p-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* URL Input */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 flex items-center gap-2">
                  <Youtube size={14} className="text-red-500" />
                  Opção 1: Link do YouTube (Transcrição rápida)
                </label>
                <div className="flex items-center px-4 gap-3 bg-black/40 rounded-xl border border-white/5 group focus-within:border-teal-500/50 transition-all">
                  <input 
                    type="url" 
                    placeholder="https://www.youtube.com/watch?v=..." 
                    className="w-full bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-700 py-3.5 text-sm font-mono"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (e.target.value) setFile(null); // Clear file if URL provided
                    }}
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-bold">
                  <span className="bg-[#050505] px-4 text-white/20">OU</span>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 flex items-center gap-2">
                  <Scissors size={14} className="text-teal-500" />
                  Opção 2: Upload de Vídeo/Áudio (IA Local)
                </label>
                <label 
                  className={`
                    relative flex flex-col items-center justify-center w-full h-32 
                    border-2 border-dashed rounded-xl cursor-pointer
                    transition-all duration-300 group
                    ${file 
                      ? 'border-teal-500 bg-teal-500/10' 
                      : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/40'
                    }
                  `}
                >
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="video/*,audio/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setFile(e.target.files[0]);
                        setUrl(""); // Clear URL
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center">
                    {file ? (
                      <>
                        <CheckCircle2 size={32} className="text-teal-500 mb-2" />
                        <p className="text-xs text-white/80 font-mono font-bold">{file.name}</p>
                        <p className="text-[10px] text-white/40 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <Sparkles size={32} className="text-white/10 group-hover:text-teal-500/30 transition-colors mb-2" />
                        <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 group-hover:text-white/60">Arraste seu arquivo aqui</p>
                        <p className="text-[9px] text-white/20">MP4, MOV, MP3 (Máx 1GB)</p>
                      </>
                    )}
                  </div>
                </label>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting || (!url && !file)}
                className="w-full py-4 bg-teal-500 text-black font-bold rounded-xl hover:bg-teal-400 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase tracking-widest text-xs shadow-lg shadow-teal-500/20"
              >
                {isSubmitting ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    {uploadProgress !== null && (
                      <span className="text-[10px] font-mono">Enviando: {uploadProgress}%</span>
                    )}
                  </div>
                ) : (
                  <>
                    <Sparkles size={18} className="text-black/60" />
                    Gerar Cortes Virais
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </section>

        <AnimatePresence mode="wait">
          {jobStatus && (
            <motion.div
              key={jobStatus.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              {/* Status Section */}
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {jobStatus.status === 'processing' && <Loader2 size={18} className="text-teal-400 animate-spin" />}
                    {jobStatus.status === 'pending' && <Loader2 size={18} className="text-slate-500 animate-spin" />}
                    {jobStatus.status === 'completed' && <CheckCircle2 size={18} className="text-teal-400" />}
                    {jobStatus.status === 'failed' && <AlertCircle size={18} className="text-red-400" />}
                    <span className="text-[10px] text-teal-400 uppercase tracking-widest font-bold">
                      {jobStatus.status === 'processing' ? 'Analysing Data...' : jobStatus.status}
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs font-mono">{jobStatus.progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${jobStatus.progress}%` }}
                    className="h-full bg-gradient-to-r from-teal-500 to-blue-500"
                  />
                </div>
                {jobStatus.error && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-xs flex items-center gap-2 font-mono leading-relaxed">
                      <AlertCircle size={14} className="shrink-0" />
                      <span className="font-bold uppercase tracking-wider">[ERRO]:</span> {jobStatus.error}
                    </p>
                    <p className="mt-2 text-[10px] text-red-400/60 font-mono">
                      Sugestão: Tente fazer o upload do arquivo MP4/MP3 diretamente se o link do YouTube falhar.
                    </p>
                  </div>
                )}
              </div>

              {/* Results Section */}
              {jobStatus.result && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-white/40 flex items-center gap-2">
                      <Trophy size={14} className="text-teal-500" />
                      Resultado Final: Top 3 Cortes Virais
                    </h2>
                    {jobStatus.progress === 100 && !jobStatus.result?.[0]?.text && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20 font-mono animate-pulse">
                        SIMULATION_MODE: IA ANALYSIS ONLY
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {jobStatus.result.map((cut, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative bg-black/40 hover:border-teal-500/50 transition-all border border-white/10 rounded-2xl overflow-hidden p-6 flex flex-col"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <span className="text-4xl font-mono font-bold text-teal-500 opacity-80 leading-none">{cut.score}</span>
                          <span className="text-[9px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded uppercase font-bold tracking-widest border border-teal-500/20">Viral Score</span>
                        </div>
                        
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                              <h3 className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Hook Melhorado:</h3>
                              <p className="text-sm font-semibold leading-relaxed text-white">"{cut.hook}"</p>
                            </div>
                            <button 
                              onClick={() => {
                                if (jobStatus?.filePath) {
                                  // For local uploads, use the filePath from jobStatus (ensuring it's served via /uploads/)
                                  const videoUrl = jobStatus.filePath.startsWith('uploads') 
                                    ? `/${jobStatus.filePath}` 
                                    : `/uploads/${jobStatus.filePath.split('/').pop()}`;
                                  setPreviewCut({ videoUrl, start: cut.start, end: cut.end });
                                  return;
                                }

                                const videoId = extractYoutubeId(url);
                                if (videoId) {
                                  setPreviewCut({ videoId, start: cut.start, end: cut.end });
                                } else {
                                  console.error("Não foi possível identificar a fonte do vídeo.");
                                  alert("Não foi possível carregar a prévia deste vídeo.");
                                }
                              }}
                              className={`p-2 rounded-lg border transition-all ${
                                !url && !jobStatus?.filePath ? 'opacity-20 cursor-not-allowed' : 'text-teal-400 hover:text-teal-300 bg-teal-500/5 border-teal-500/10 group-hover:border-teal-500/30'
                              }`}
                              title="Assistir Trecho"
                              disabled={!url && !jobStatus?.filePath}
                            >
                              <PlayCircle size={20} />
                            </button>
                            <button 
                              onClick={() => handleExport(cut, index)}
                              className={`p-2 rounded-lg border transition-all ${
                                !file ? 'opacity-20 cursor-not-allowed text-white/20' : 'text-blue-400 hover:text-blue-300 bg-blue-500/5 border-blue-500/10 group-hover:border-blue-500/30'
                              }`}
                              title={file ? "Exportar Corte" : "Exportação disponível apenas para uploads"}
                              disabled={!file || exportingIndex === index}
                            >
                              {exportingIndex === index ? (
                                <Loader2 size={20} className="animate-spin" />
                              ) : (
                                <Download size={20} />
                              )}
                            </button>
                          </div>

                          <div className="flex flex-col gap-1">
                            <h3 className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Segmento:</h3>
                            <p className="text-xs font-mono text-white/60 bg-white/5 px-2 py-1 rounded inline-block w-fit">
                              {formatTime(cut.start)} — {formatTime(cut.end)}
                            </p>
                          </div>

                          <div className="pt-4 border-t border-white/5 mt-auto">
                            <p className="text-[10px] italic text-white/40 leading-snug font-sans">
                              "{cut.motivo}"
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {previewCut && (
          <VideoPlayer 
            videoId={previewCut.videoId}
            videoUrl={previewCut.videoUrl}
            start={previewCut.start}
            end={previewCut.end}
            onClose={() => setPreviewCut(null)}
          />
        )}
      </AnimatePresence>

      <footer className="h-12 border-t border-white/10 flex items-center justify-between px-8 bg-black text-[10px] font-mono text-white/40 relative z-20">
        <div className="flex gap-4">
          <span>NODE_ENV: production</span>
          <span className="hidden sm:inline">FFMPEG: v6.0-static</span>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 uppercase">
            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></span>
            System Health: Optimal
          </span>
        </div>
      </footer>
    </div>
  );
}

function extractYoutubeId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
