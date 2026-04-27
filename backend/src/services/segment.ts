type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

type CandidateSegment = {
  start: number;
  end: number;
  text: string;
};

const MIN_DURATION_SECONDS = 20;
const MAX_DURATION_SECONDS = 45;
const MIN_TEXT_LENGTH = 80;
const MAX_CANDIDATES = 120;

function normalizeSegments(transcription: any): TranscriptSegment[] {
  return (transcription.segments || [])
    .map((segment: any) => ({
      start: Number(segment.start),
      end: Number(segment.end),
      text: String(segment.text || "").trim(),
    }))
    .filter((segment: TranscriptSegment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start && segment.text);
}

function pickRepresentativeCandidates(candidates: CandidateSegment[]) {
  const unique = new Map<string, CandidateSegment>();

  for (const candidate of candidates) {
    const key = `${Math.round(candidate.start)}-${Math.round(candidate.end)}`;
    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  return Array.from(unique.values())
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .slice(0, MAX_CANDIDATES);
}

export async function segmentVideo(transcription: any): Promise<CandidateSegment[]> {
  const segments = normalizeSegments(transcription);
  if (segments.length === 0) return [];

  const candidates: CandidateSegment[] = [];

  for (let startIndex = 0; startIndex < segments.length; startIndex += 1) {
    let textParts: string[] = [];

    for (let endIndex = startIndex; endIndex < segments.length; endIndex += 1) {
      const start = segments[startIndex].start;
      const end = segments[endIndex].end;
      const duration = end - start;

      if (duration > MAX_DURATION_SECONDS) {
        break;
      }

      textParts.push(segments[endIndex].text);

      if (duration < MIN_DURATION_SECONDS) {
        continue;
      }

      const text = textParts.join(" ").replace(/\s+/g, " ").trim();
      if (text.length < MIN_TEXT_LENGTH) {
        continue;
      }

      candidates.push({
        start,
        end,
        text,
      });
    }
  }

  const representativeCandidates = pickRepresentativeCandidates(candidates);

  if (representativeCandidates.length > 0) {
    return representativeCandidates;
  }

  const fallback = {
    start: segments[0].start,
    end: segments[segments.length - 1].end,
    text: segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim(),
  };

  return fallback.text
    ? [fallback]
    : [];
}
