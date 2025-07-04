import { IncomingForm } from 'formidable';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import os from 'os';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

function assEscape(text) {
  return text.replace(/([{}\\])/g, '\\$1').replace(/\n/g, '\\N');
}

function generateASS(subtitles, videoWidth = 1280, videoHeight = 720) {
  // Basic ASS header with default style
  let ass = `
[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,2,2,30,30,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  for (const sub of subtitles) {
    // Skip watermark/default text
    if (sub.text === "New subtitle at this time") continue;
    // Convert seconds to ASS time (h:mm:ss.cs)
    const toASSTime = s => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      const cs = Math.floor((s * 100) % 100);
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
    };
    // Positioning: x/y are relative (0-1), convert to pixels
    const x = Math.round((sub.x ?? 0.5) * videoWidth);
    const y = Math.round((sub.y ?? 0.8) * videoHeight);
    // Alignment: 2=center, 7=top-left, 9=top-right, 1=bottom-left, 3=bottom-right
    const alignment = 2;
    // Text styling (bold, italic, underline)
    let styleTags = '';
    if (sub.isBold) styleTags += '{\\b1}';
    if (sub.isItalic) styleTags += '{\\i1}';
    if (sub.isUnderline) styleTags += '{\\u1}';
    // Color (ASS uses &HBBGGRR)
    let colorTag = '';
    if (sub.textColor) {
      // Convert #RRGGBB to &HBBGGRR
      const hex = sub.textColor.replace('#', '');
      if (hex.length === 6) {
        const r = hex.slice(0, 2);
        const g = hex.slice(2, 4);
        const b = hex.slice(4, 6);
        colorTag = `{\\c&H${b}${g}${r}}`;
      }
    }
    // Font
    let fontTag = '';
    if (sub.fontFamily) fontTag += `{\\fn${sub.fontFamily}}`;
    if (sub.fontSize) fontTag += `{\\fs${sub.fontSize}}`;
    // Compose override tags
    const override = `{\\an${alignment}\\pos(${x},${y})}`;
    ass += `Dialogue: 0,${toASSTime(sub.start)},${toASSTime(sub.end)},Default,,0,0,0,,${override}${fontTag}${colorTag}${styleTags}${assEscape(sub.text)}\n`;
  }
  return ass;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Formidable error:', err);
      return res.status(500).json({ error: 'Error parsing the file: ' + err.message });
    }
    const videoFile = Array.isArray(files.video) ? files.video[0] : files.video;
    const videoPath = videoFile?.filepath || videoFile?.path;
    const subtitlesRaw = Array.isArray(fields.subtitles) ? fields.subtitles[0] : fields.subtitles;

    if (!videoPath) {
      console.error('No video file uploaded');
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    if (!subtitlesRaw) {
      console.error('No subtitles provided');
      return res.status(400).json({ error: 'No subtitles provided' });
    }

    let subtitles;
    try {
      subtitles = JSON.parse(subtitlesRaw);
    } catch (e) {
      console.error('Invalid subtitles JSON:', e);
      return res.status(400).json({ error: 'Invalid subtitles JSON' });
    }

    // Optionally, detect video dimensions (for now, use 1280x720)
    const videoWidth = parseInt(fields.videoWidth) || 1280;
    const videoHeight = parseInt(fields.videoHeight) || 720;
    const assContent = generateASS(subtitles, videoWidth, videoHeight);
    const assPath = path.join(os.tmpdir(), `subtitles_${Date.now()}.ass`);
    fs.writeFileSync(assPath, assContent);

    // Output video temp file
    const outputPath = path.join(os.tmpdir(), `video_with_subtitles_${Date.now()}.mp4`);

    // Run ffmpeg to write to file
    const ffmpegCmd = [
      '-i', videoPath,
      '-vf', `ass=${assPath}`,
      '-c:a', 'copy',
      '-y', // Overwrite output file if exists
      outputPath
    ];

    execSync(`ffmpeg ${ffmpegCmd.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ')}`);

    // Send the file as a response
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video_with_subtitles.mp4"');
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    fileStream.on('close', () => {
      fs.unlinkSync(assPath);
      fs.unlinkSync(outputPath);
    });
    fileStream.on('error', (err) => {
      fs.unlinkSync(assPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to send video', details: err.message });
      }
    });
  });
} 