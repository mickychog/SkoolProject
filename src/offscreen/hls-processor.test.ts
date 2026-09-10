import { describe, it, expect } from 'vitest';
import { HlsProcessor } from './hls-processor';

describe('HlsProcessor (Spec 02 & Spec 04)', () => {
  it('parses individual media playlist segments and durations', () => {
    const samplePlaylist = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXTINF:5.000,
segment_0.ts
#EXTINF:6.000,
segment_1.ts
#EXTINF:4.500,
https://cdn.example.com/stream/segment_2.ts
#EXT-X-ENDLIST
    `.trim();

    const segments = HlsProcessor.parseMediaPlaylist(
      samplePlaylist,
      'https://stream.skool.com/video/1080p/index.m3u8'
    );

    expect(segments.length).toBe(3);
    expect(segments[0].url).toBe('https://stream.skool.com/video/1080p/segment_0.ts');
    expect(segments[0].duration).toBe(5);

    expect(segments[1].url).toBe('https://stream.skool.com/video/1080p/segment_1.ts');
    expect(segments[1].duration).toBe(6);

    expect(segments[2].url).toBe('https://cdn.example.com/stream/segment_2.ts');
    expect(segments[2].duration).toBe(4.5);
  });
});
