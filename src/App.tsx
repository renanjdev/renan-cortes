import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileVideo,
  Link2,
  Loader2,
  PlayCircle,
  Scissors,
  Sparkles,
  Trophy,
  Upload,
  Youtube,
} from "lucide-react";
import { VideoPlayer } from "./components/VideoPlayer";

interface Result {
  start: number;
  end: number;
  score: number;
  hook: string;
  motivo: string;
  text?: string;
  downloadUrl?: string;
  exportId?: string;
}

interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: Result[];
  error?: string;
  filePath?: string;
}

type InputMode = "youtube" | "upload";

export default function App() {
  const [mode, setMode] = useState<InputMode>("youtube");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [previewCut, setPreviewCut] = useState<{ videoId?: string; videoUrl?: string; start: number; end: number } | null>(null);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => setServerStatus(res.ok ? "online" : "offline"))
      .catch(() => setServerStatus("offline"));
  }, []);

  useEffect(() => {
    let interval: number;

    if (activeJobId && (jobStatus?.status === "pending" || jobStatus?.status === "processing")) {
      interval = window.setInterval(async () => {
        try {
          const response = await fetch(`/api/status/${activeJobId}`);
          const data = await response.json();
          setJobStatus(data);

          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
          }
        } catch (error) {
          console.error("Error polling status:", error);
        }
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [activeJobId, jobStatus?.status]);

  const canSubmit = useMemo(() => {
    if (mode === "youtube") return Boolean(url.trim()) && !isSubmitting;
    return Boolean(file) && !isSubmitting;
  }, [mode, url, file, isSubmitting]);

  const statusLabel = useMemo(() => {
    if (!jobStatus) return "Pronto";
    if (jobStatus.status === "pending") return "Na fila";
    if (jobStatus.status === "processing") return "Processando";
    if (jobStatus.status === "completed") return "Concluido";
    return "Falhou";
  }, [jobStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setUploadProgress(null);
    setJobStatus(null);
    setPreviewCut(null);

    try {
      let responseData: any;

      if (mode === "upload" && file) {
        responseData = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append("video", file);

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded * 100) / event.total);
              setUploadProgress(percent);
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new Error("Resposta invalida do servidor."));
              }
              return;
            }

            let errorMessage = `Erro no upload: ${xhr.status} ${xhr.statusText}`;
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.error) errorMessage += ` - ${response.error}`;
            } catch {}
            reject(new Error(errorMessage));
          });

          xhr.addEventListener("error", () => reject(new Error("Falha na conexao de rede.")));
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });
      } else {
        const response = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        responseData = await response.json();
      }

      if (responseData.jobId) {
        setActiveJobId(responseData.jobId);
        setJobStatus({ id: responseData.jobId, status: "pending", progress: 0 });
      } else if (responseData.error) {
        setJobStatus({ id: "error", status: "failed", progress: 0, error: responseData.error });
      }
    } catch (error: any) {
      console.error("Error starting process:", error);
      setJobStatus({
        id: "error",
        status: "failed",
        progress: 0,
        error: `Erro ao iniciar processo: ${error.message || "verifique a conexao ou o arquivo enviado."}`,
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleExport = async (cut: Result, index: number) => {
    if (!activeJobId) return;

    setExportingIndex(index);
    try {
      if (cut.downloadUrl) {
        const a = document.createElement("a");
        a.href = cut.downloadUrl;
        a.download = cut.exportId || `corte_${activeJobId}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: activeJobId,
          start: cut.start,
          end: cut.end,
        }),
      });

      const data = await response.json();
      if (data.downloadUrl) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = `corte_${activeJobId}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert(data.error || "Erro ao exportar video.");
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Erro na conexao ao exportar.");
    } finally {
      setExportingIndex(null);
    }
  };

  const openPreview = (cut: Result) => {
    if (jobStatus?.filePath) {
      const normalized = jobStatus.filePath.replace(/\\/g, "/");
      const videoUrl = normalized.startsWith("uploads/") ? `/${normalized}` : `/uploads/${normalized.split("/").pop()}`;
      setPreviewCut({ videoUrl, start: cut.start, end: cut.end });
      return;
    }

    const videoId = extractYoutubeId(url);
    if (videoId) {
      setPreviewCut({ videoId, start: cut.start, end: cut.end });
      return;
    }

    alert("Nao foi possivel carregar a previa deste video.");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-24 bg-white/[0.03]" />
        <div className="absolute left-[-12%] top-24 h-[28rem] w-[28rem] rounded-full bg-lime-500/12 blur-[140px]" />
        <div className="absolute right-[-8%] top-40 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-[160px]" />
      </div>

      <header className="relative z-10 border-b border-white/8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-lime-400/30 bg-lime-400/10">
              <Scissors className="h-5 w-5 text-lime-300" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Cortes IA</div>
              <div className="text-xs text-white/45">Recorte viral para YouTube e arquivos locais</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <StatusPill
              label={serverStatus === "online" ? "Servidor online" : serverStatus === "offline" ? "Servidor offline" : "Verificando"}
              tone={serverStatus === "online" ? "green" : serverStatus === "offline" ? "red" : "neutral"}
            />
            <StatusPill
              label={statusLabel}
              tone={
                jobStatus?.status === "completed"
                  ? "green"
                  : jobStatus?.status === "failed"
                    ? "red"
                    : jobStatus?.status
                      ? "neutral"
                      : "neutral"
              }
            />
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pb-10 pt-14">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-[11px] font-medium text-lime-300">
              <Sparkles className="h-3.5 w-3.5" />
              encontre os melhores cortes sem sair da primeira tela
            </div>
            <h1 className="mx-auto max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              Gere cortes virais a partir de um link ou de um video enviado.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/62">
              Cole a URL do YouTube ou envie um arquivo. O sistema transcreve, segmenta e prioriza os trechos com maior potencial de retencao.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-5xl">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
              <section className="rounded-[24px] border border-white/10 bg-black/40 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center gap-3 border-b border-white/8 pb-4">
                  <ModeButton
                    active={mode === "youtube"}
                    icon={Youtube}
                    label="Link do YouTube"
                    onClick={() => {
                      setMode("youtube");
                      setFile(null);
                    }}
                  />
                  <ModeButton
                    active={mode === "upload"}
                    icon={Upload}
                    label="Upload de arquivo"
                    onClick={() => {
                      setMode("upload");
                      setUrl("");
                    }}
                  />
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-5">
                  {mode === "youtube" ? (
                    <div className="space-y-3">
                      <label className="block text-left text-xs font-medium uppercase tracking-[0.2em] text-white/42">
                        URL do video
                      </label>
                      <div className="flex min-h-16 items-center rounded-[22px] border border-lime-400/50 bg-[#111111] pl-5 pr-2 shadow-[0_0_0_4px_rgba(132,255,92,0.06)] transition-colors focus-within:border-lime-300">
                        <Link2 className="mr-3 h-5 w-5 shrink-0 text-lime-300" />
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => {
                            setUrl(e.target.value);
                            if (e.target.value) setFile(null);
                          }}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="h-full w-full bg-transparent text-base text-white outline-none placeholder:text-white/26"
                        />
                        <button
                          type="submit"
                          disabled={!canSubmit}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime-400 text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25"
                          aria-label="Gerar cortes"
                        >
                          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-white/45">
                        <span className="rounded-full border border-white/10 px-3 py-1">transcricao automatica</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">analise por score</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">{"todos os cortes com score >= 20"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-left text-xs font-medium uppercase tracking-[0.2em] text-white/42">
                        Arquivo local
                      </label>
                      <label className="flex min-h-[220px] cursor-pointer flex-col justify-between rounded-[22px] border border-dashed border-white/14 bg-white/[0.03] p-6 transition hover:border-lime-400/40 hover:bg-white/[0.05]">
                        <input
                          type="file"
                          className="hidden"
                          accept="video/*,audio/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setFile(e.target.files[0]);
                              setUrl("");
                            }
                          }}
                        />

                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                          <FileVideo className="h-6 w-6 text-lime-300" />
                        </div>

                        <div className="space-y-2">
                          <div className="text-left text-xl font-semibold text-white">
                            {file ? file.name : "Arraste ou selecione um arquivo de video"}
                          </div>
                          <div className="text-left text-sm leading-6 text-white/55">
                            {file
                              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB pronto para envio`
                              : "Compatibilidade com MP4, MOV, MP3 e outros formatos aceitos pelo navegador."}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-white/35">limite atual de upload: 1 GB</div>
                          <button
                            type="submit"
                            disabled={!canSubmit}
                            className="inline-flex h-12 items-center gap-2 rounded-full bg-lime-400 px-5 text-sm font-semibold text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25"
                          >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Gerar cortes
                          </button>
                        </div>
                      </label>
                    </div>
                  )}
                </form>
              </section>

              <aside className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Execucao atual</div>
                    <div className="mt-1 text-sm text-white/50">Fila, progresso e observacoes do processamento.</div>
                  </div>
                  {jobStatus?.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-lime-300" />
                  ) : jobStatus?.status === "failed" ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <Clock3 className="h-5 w-5 text-white/45" />
                  )}
                </div>

                <div className="mt-6 space-y-5">
                  <MetricRow label="Fonte" value={mode === "youtube" ? "YouTube" : "Upload local"} />
                  <MetricRow label="Status" value={statusLabel} />
                  <MetricRow label="Progresso" value={`${jobStatus?.progress ?? 0}%`} />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/38">
                      <span>Pipeline</span>
                      <span>{jobStatus?.progress ?? 0}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${jobStatus?.progress ?? 0}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400"
                      />
                    </div>
                  </div>

                  {uploadProgress !== null && (
                    <div className="rounded-2xl border border-lime-400/20 bg-lime-400/8 p-4 text-sm text-lime-200">
                      Upload em andamento: {uploadProgress}%
                    </div>
                  )}

                  {jobStatus?.error ? (
                    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
                      {jobStatus.error}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-black/30 p-4 text-sm leading-6 text-white/55">
                      Para videos longos, a transcricao e a analise podem levar alguns minutos. O backend permanece ativo durante o processamento.
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-16">
          <div className="flex items-center justify-between border-b border-white/8 pb-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Trophy className="h-4 w-4 text-lime-300" />
                Melhores cortes
              </div>
              <div className="mt-1 text-sm text-white/48">Os resultados aparecem aqui assim que a analise for concluida.</div>
            </div>
            {jobStatus?.result?.length ? (
              <div className="rounded-full border border-lime-400/20 bg-lime-400/8 px-3 py-1 text-xs font-medium text-lime-200">
                {jobStatus.result.length} sugestoes
              </div>
            ) : null}
          </div>

          {jobStatus?.result?.length ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {jobStatus.result.map((cut, index) => (
                <article
                  key={`${cut.start}-${cut.end}-${index}`}
                  className="flex min-h-[340px] flex-col rounded-[22px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-lime-400/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Score</div>
                      <div className="mt-2 text-5xl font-semibold tracking-tight text-lime-300">{cut.score}</div>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/45">
                      Corte {index + 1}
                    </div>
                  </div>

                  <div className="mt-6 space-y-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Hook sugerido</div>
                      <p className="mt-2 text-lg font-medium leading-7 text-white">{cut.hook}</p>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Janela do corte</div>
                      <p className="mt-2 inline-flex rounded-full border border-white/10 px-3 py-1 text-sm font-mono text-white/72">
                        {formatTime(cut.start)} - {formatTime(cut.end)}
                      </p>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Justificativa do score</div>
                      <p className="mt-2 text-sm leading-6 text-white/60">{cut.motivo}</p>
                    </div>
                  </div>

                  <div className="mt-auto flex gap-3 pt-6">
                    <button
                      onClick={() => openPreview(cut)}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 text-sm font-medium text-lime-200 transition hover:bg-lime-400/16"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Assistir
                    </button>
                    <button
                      onClick={() => handleExport(cut, index)}
                      disabled={(!file && !cut.downloadUrl) || exportingIndex === index}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] text-sm font-medium text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {exportingIndex === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Exportar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-white/12 bg-white/[0.02] px-8 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                {jobStatus?.status === "processing" || jobStatus?.status === "pending" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-lime-300" />
                ) : (
                  <Scissors className="h-6 w-6 text-white/35" />
                )}
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-white">
                {jobStatus?.status === "processing" || jobStatus?.status === "pending"
                  ? "O processamento esta em andamento"
                  : "Nenhum corte gerado ainda"}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/52">
                {jobStatus?.status === "processing" || jobStatus?.status === "pending"
                  ? "Assim que a transcricao e a analise terminarem, os melhores trechos aparecem aqui com preview e exportacao."
                  : "Escolha um modo, envie o video e acompanhe o resultado na mesma tela."}
              </p>
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {previewCut ? (
          <VideoPlayer
            videoId={previewCut.videoId}
            videoUrl={previewCut.videoUrl}
            start={previewCut.start}
            end={previewCut.end}
            onClose={() => setPreviewCut(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition ${
        active
          ? "border-lime-400/35 bg-lime-400/10 text-lime-200"
          : "border-white/10 bg-white/[0.03] text-white/58 hover:bg-white/[0.06]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-3 text-sm">
      <span className="text-white/42">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "red" | "neutral" }) {
  const styles =
    tone === "green"
      ? "border-lime-400/20 bg-lime-400/10 text-lime-200"
      : tone === "red"
        ? "border-red-500/20 bg-red-500/10 text-red-200"
        : "border-white/10 bg-white/[0.04] text-white/58";

  return <div className={`rounded-full border px-3 py-1.5 ${styles}`}>{label}</div>;
}

function extractYoutubeId(input: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = input.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
