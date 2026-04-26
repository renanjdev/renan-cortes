export async function segmentVideo(transcription: any): Promise<any[]> {
  // Logic to group transcription segments into ranges of 10-40 seconds
  const results = [];
  let currentSegment: any = null;

  const segments = transcription.segments || [];

  for (const seg of segments) {
    if (!currentSegment) {
      currentSegment = {
        start: seg.start,
        end: seg.end,
        text: seg.text
      };
    } else {
      const duration = seg.end - currentSegment.start;
      if (duration <= 40) {
        currentSegment.end = seg.end;
        currentSegment.text += " " + seg.text;
      } else {
        results.push(currentSegment);
        currentSegment = {
          start: seg.start,
          end: seg.end,
          text: seg.text
        };
      }
    }
  }

  if (currentSegment) {
    results.push(currentSegment);
  }

  // Filter segments shorter than 10 seconds unless it's the only one
  return results.filter(s => (s.end - s.start >= 10) || results.length === 1);
}
