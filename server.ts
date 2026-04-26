import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { addJob, getJobStatus } from "./backend/src/queue.ts";
import { exportVideoSegment } from "./backend/src/services/export.ts";

import multer from "multer";
import fs from "fs";

const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB
});

if (!fs.existsSync("uploads/")) {
  fs.mkdirSync("uploads/");
}

if (!fs.existsSync("exports/")) {
  fs.mkdirSync("exports/");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Serve static files from exports/ for downloads
  app.use('/exports', express.static('exports'));
  app.use('/uploads', express.static('uploads'));

  // Upload route handles its own body (multipart)
  app.post("/api/upload", (req, res, next) => {
    upload.single("video")(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ error: `Erro de Upload (${err.code}): ${err.message}` });
        }
        return res.status(500).json({ error: `Erro inesperado no upload: ${err.message}` });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    try {
      const jobId = await addJob({ filePath: req.file.path });
      res.json({ jobId, message: "Arquivo enviado com sucesso e adicionado à fila" });
    } catch (error: any) {
      console.error("Queue addJob error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Now apply body parsers for other routes that use JSON
  app.use(express.json({ limit: '2048mb' }));
  app.use(express.urlencoded({ limit: '2048mb', extended: true }));

  // API Routes
  app.post("/api/process", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL do YouTube é obrigatória" });
    }

    try {
      const jobId = await addJob({ url });
      res.json({ jobId, message: "Link adicionado à fila" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  app.get("/api/status/:id", (req, res) => {
    const status = getJobStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: "Job não encontrado" });
    }
    res.json(status);
  });

  app.post("/api/export", async (req, res) => {
    const { jobId, start, end } = req.body;
    const job = getJobStatus(jobId);

    if (!job || !job.filePath) {
      return res.status(400).json({ error: "Exportação disponível apenas para vídeos originais enviados por upload." });
    }

    if (!fs.existsSync(job.filePath)) {
      return res.status(404).json({ error: "Arquivo original expirou ou não está disponível." });
    }

    try {
      const exportId = `cut_${jobId}_${Math.floor(start)}_${Math.floor(end)}.mp4`;
      const outputPath = path.join("exports", exportId);
      
      if (!fs.existsSync(outputPath)) {
        await exportVideoSegment(job.filePath, outputPath, start, end - start);
      }

      res.json({ 
        downloadUrl: `/exports/${exportId}`,
        message: "Corte gerado com sucesso!" 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandle error:", err);
    res.status(500).json({ error: err.message || "Erro interno no servidor" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
