import { OpenAI } from "openai";
import PQueue from "p-queue";

function getAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada no servidor.");
  }
  return new OpenAI({ apiKey });
}

function normalizeScore(score: unknown) {
  const parsed = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(20, Math.min(100, Math.round(parsed)));
}

function safeJSONParse(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function analyzeSegments(segments: any[]): Promise<any[]> {
  const queue = new PQueue({ concurrency: 4 });

  const analyzedSegments = await Promise.all(
    segments.map((segment, i) =>
      queue.add(async () => {
        const analysis = await analyzeWithAI({
          text: segment.text,
          prev: segments[i - 1]?.text || "",
          next: segments[i + 1]?.text || "",
        });

        return {
          ...segment,
          ...analysis,
          score: normalizeScore(analysis.score),
        };
      }),
    ),
  );

  return analyzedSegments
    .filter((segment) => segment.score >= 20)
    .sort((a, b) => b.score - a.score)
    .reduce((acc: any[], current) => {
      const overlapsTooMuch = acc.some((item) => {
        const overlapStart = Math.max(item.start, current.start);
        const overlapEnd = Math.min(item.end, current.end);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        const shorterDuration = Math.min(item.end - item.start, current.end - current.start);
        return shorterDuration > 0 && overlap / shorterDuration > 0.85;
      });

      if (!overlapsTooMuch) {
        acc.push(current);
      }

      return acc;
    }, []);
}

export async function analyzeFromContext(metadata: any): Promise<any[]> {
  const openai = getAIClient();

  const prompt = `Você é um especialista em estratégia de conteúdo viral.

Analise os metadados do vídeo e sugira cortes com potencial de retenção.

---

TÍTULO: ${metadata.title}
DESCRIÇÃO: ${metadata.description || "Não disponível"}

---

CRITÉRIOS:
- curiosidade
- clareza
- potencial de prender atenção

---

Retorne JSON:

{
  "cuts": [
    {
      "score": number,
      "hook": "hook impactante",
      "motivo": "explicação objetiva",
      "start": number,
      "end": number
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content || "{}";
    const data = safeJSONParse(content);
    const results = Array.isArray(data) ? data : data.cuts || [];

    return results
      .map((r: any) => ({
        ...r,
        score: normalizeScore(r.score),
      }))
      .filter((r: any) => r.score >= 20)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 25);
  } catch (error) {
    console.error("Context Analysis error:", error);
    return getFallbackSimulation(metadata);
  }
}

function getFallbackSimulation(metadata: any) {
  return [
    {
      score: 92,
      hook: `O segredo por trás de ${metadata.title}`,
      motivo: "Simulação baseada em retenção.",
      start: 30,
      end: 65,
    },
  ];
}

async function analyzeWithAI({
  text,
  prev,
  next,
}: {
  text: string;
  prev: string;
  next: string;
}) {
  const openai = getAIClient();

  const prompt = `Você é um especialista em retenção de vídeos curtos (TikTok, Reels, Shorts) com foco em comportamento humano.

Sua função NÃO é apenas analisar.
Você deve JULGAR e MELHORAR o trecho.

---

OBJETIVO:
Determinar se o trecho faria alguém:
- parar o scroll
- assistir até o final

---

CONTEXTO ANTERIOR:
${prev}

TRECHO:
${text}

CONTEXTO POSTERIOR:
${next}

---

CRITÉRIOS:

1. IMPACTO INICIAL (primeiros 3s)
2. CURIOSIDADE ou TENSÃO
3. CLAREZA
4. PROGRESSÃO
5. FINAL (payoff)

---

ESCALA:

90–100 → extremamente viciante  
70–89 → forte  
40–69 → ok  
20–39 → fraco  

---

REGRAS:

- NÃO seja genérico
- NÃO use hooks clichês
- Se o início for fraco, penalize fortemente
- A maioria dos trechos NÃO é excepcional

---

HOOK:
Reescreva o início usando:
- alerta
- erro
- curiosidade
- quebra de padrão

---

PROIBIDO:
"vou te explicar"
"isso é importante"
"preste atenção"

---

OUTPUT:

{
  "score": number,
  "hook": "hook reescrito com alta retenção",
  "motivo": "explicação crítica objetiva"
}

---

IMPORTANTE:
Se não houver potencial real:
- score abaixo de 40
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const parsed = safeJSONParse(
      response.choices[0].message.content || "{}"
    );

    return {
      ...parsed,
      score: normalizeScore(parsed.score),
    };
  } catch (error) {
    console.error("Segment Analysis error:", error);
    return {
      score: 20,
      hook: "Erro na análise",
      motivo: "Falha ao processar com IA.",
    };
  }
}
