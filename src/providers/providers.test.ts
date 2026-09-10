import { describe, it, expect } from 'vitest';
import { LoomAdapter } from './loom';
import { SkoolNativeAdapter } from './skool-native';
import { VimeoAdapter } from './vimeo';
import { YouTubeAdapter } from './youtube';
import { providerRegistry } from './index';

describe('Media Provider Adapters (Spec 02 & 04)', () => {
  describe('LoomAdapter', () => {
    const adapter = new LoomAdapter();

    it('identifies Loom share and embed URLs', () => {
      expect(adapter.canHandle('https://www.loom.com/share/abc123456789')).toBe(true);
      expect(adapter.canHandle('https://www.loom.com/embed/abc123456789?sid=xyz')).toBe(true);
      expect(adapter.canHandle('https://vimeo.com/123456')).toBe(false);
    });

    it('extracts correct video ID from Loom URLs', () => {
      expect(adapter.extractLoomId('https://www.loom.com/share/d4a3f12e8b094')).toBe('d4a3f12e8b094');
      expect(adapter.extractLoomId('https://www.loom.com/embed/9876543210')).toBe('9876543210');
    });
  });

  describe('SkoolNativeAdapter', () => {
    const adapter = new SkoolNativeAdapter();

    it('identifies Skool video stream and .m3u8 URLs', () => {
      expect(adapter.canHandle('https://stream.video.skool.com/session/master.m3u8')).toBe(true);
      expect(adapter.canHandle('https://video.skool.com/hls/playlist.m3u8')).toBe(true);
      expect(adapter.canHandle('https://youtube.com/watch?v=123')).toBe(false);
    });

    it('parses HLS Master Playlist correctly and orders resolutions descending', () => {
      const sampleMasterPlaylist = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480
480p/index.m3u8
      `.trim();

      const qualities = adapter.parseHlsMasterPlaylist(
        sampleMasterPlaylist,
        'https://stream.video.skool.com/assets/'
      );

      expect(qualities.length).toBe(3);
      // Highest resolution first
      expect(qualities[0].qualityLabel).toBe('1080p');
      expect(qualities[0].resolution).toEqual({ width: 1920, height: 1080 });
      expect(qualities[0].streamUrl).toBe('https://stream.video.skool.com/assets/1080p/index.m3u8');

      expect(qualities[1].qualityLabel).toBe('720p');
      expect(qualities[2].qualityLabel).toBe('480p');
    });
  });

  describe('VimeoAdapter', () => {
    const adapter = new VimeoAdapter();

    it('identifies Vimeo URLs and extracts ID', () => {
      expect(adapter.canHandle('https://vimeo.com/76979871')).toBe(true);
      expect(adapter.canHandle('https://player.vimeo.com/video/76979871?h=abc')).toBe(true);
      expect(adapter.extractVimeoId('https://vimeo.com/76979871')).toBe('76979871');
    });
  });

  describe('YouTubeAdapter', () => {
    const adapter = new YouTubeAdapter();

    it('identifies YouTube URLs and extracts video ID', () => {
      expect(adapter.canHandle('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(adapter.canHandle('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
      expect(adapter.extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
  });

  describe('ProviderRegistry', () => {
    it('dispatches to the appropriate adapter automatically', () => {
      const skoolAdapter = providerRegistry.findAdapter('https://stream.video.skool.com/test.m3u8');
      expect(skoolAdapter?.providerType).toBe('skool_native');

      const loomAdapter = providerRegistry.findAdapter('https://www.loom.com/share/abc1234');
      expect(loomAdapter?.providerType).toBe('loom');

      const vimeoAdapter = providerRegistry.findAdapter('https://player.vimeo.com/video/998877');
      expect(vimeoAdapter?.providerType).toBe('vimeo');
    });
  });
});
