import fs from 'fs/promises';
import path from 'path';

const resultsDir = path.join(__dirname, '../test-results');

async function renameVideos() {
  const entries = await fs.readdir(resultsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.includes('marketing')) {
      const videoPath = path.join(resultsDir, entry.name, 'video.webm');
      try {
        await fs.access(videoPath);
        // Extract test name from directory (e.g., "empty-state-Landing-chromium")
        const testName = entry.name.split('-').slice(0, -1).join('-');
        const newPath = path.join(resultsDir, `${testName}.webm`);
        await fs.rename(videoPath, newPath);
        console.log(`Renamed ${videoPath} -> ${newPath}`);
      } catch {
        // video might not exist yet
      }
    }
  }
}

renameVideos().catch(console.error);
