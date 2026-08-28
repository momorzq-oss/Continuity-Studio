import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const kind = process.argv[2] ?? "full";
const plan = JSON.parse(readFileSync(path.join(root, "tutorial-chapters.json"), "utf8"));
const spec = plan.videos[kind];
if (!spec) throw new Error(`Unknown tutorial edit: ${kind}. Use full, quick, or social.`);

const audioPath = path.join(root, spec.audio);
const captionPath = path.join(root, spec.captions);
const outputPath = path.join(root, spec.output);
if (!existsSync(audioPath)) throw new Error(`Missing narration audio: ${audioPath}`);
if (!existsSync(captionPath)) throw new Error(`Missing Whisper captions: ${captionPath}`);

const ffprobe = (file) => Number(execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file,
], { encoding: "utf8" }).trim());

const audioDuration = ffprobe(audioPath);
if (!Number.isFinite(audioDuration) || audioDuration <= 0) throw new Error("Narration duration could not be measured.");

const work = path.join(root, "work", `render-${kind}`);
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const fontBold = "C\\:/Windows/Fonts/segoeuib.ttf";
const fontRegular = "C\\:/Windows/Fonts/segoeui.ttf";
const scale = audioDuration / spec.estimatedDurationSeconds;
const clips = [];
let shotIndex = 0;

for (const chapter of spec.chapters) {
  const chapterDuration = chapter.estimatedDurationSeconds * scale;
  const shotDuration = chapterDuration / chapter.captures.length;
  for (let captureIndex = 0; captureIndex < chapter.captures.length; captureIndex += 1) {
    const capture = path.join(root, "captures", chapter.captures[captureIndex]);
    if (!existsSync(capture)) throw new Error(`Missing real-interface capture: ${capture}`);
    const clip = path.join(work, `${String(shotIndex).padStart(3, "0")}.mp4`);
    const cursorStartX = 1540 - (shotIndex % 4) * 260;
    const cursorStartY = 165 + (shotIndex % 3) * 145;
    const cursorEndX = 470 + (shotIndex % 5) * 235;
    const cursorEndY = 690 - (shotIndex % 4) * 115;
    const safeTitle = chapter.title.replaceAll("'", "’").replaceAll(":", "\\:");
    const showTitle = captureIndex === 0;
    const filters = [
      "scale=1920:1080:force_original_aspect_ratio=increase",
      "crop=1920:1080",
      "zoompan=z='min(max(zoom,pzoom)+0.00006,1.055)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30",
      showTitle ? "drawbox=x=54:y=48:w=700:h=82:color=0x071015@0.88:t=fill:enable='lt(t,2.4)'" : null,
      showTitle ? `drawtext=fontfile='${fontBold}':text='${safeTitle}':fontcolor=white:fontsize=34:x=82:y=72:enable='lt(t,2.4)'` : null,
      `drawtext=fontfile='${fontRegular}':text='▶':fontcolor=0xE7A93A:borderw=3:bordercolor=0x071015:fontsize=35:x='${cursorStartX}+(${cursorEndX}-${cursorStartX})*min(t/${shotDuration.toFixed(3)},1)':y='${cursorStartY}+(${cursorEndY}-${cursorStartY})*min(t/${shotDuration.toFixed(3)},1)'`,
      "format=yuv420p",
    ].filter(Boolean).join(",");
    execFileSync("ffmpeg", [
      "-y", "-loop", "1", "-framerate", "30", "-i", capture,
      "-t", shotDuration.toFixed(3), "-vf", filters,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-an", clip,
    ], { stdio: "inherit" });
    clips.push(clip);
    shotIndex += 1;
  }
}

const concatPath = path.join(work, "clips.ffconcat");
writeFileSync(concatPath, `ffconcat version 1.0\n${clips.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join("\n")}\n`, "utf8");

const silentVideo = path.join(work, "silent.mp4");
execFileSync("ffmpeg", [
  "-y", "-f", "concat", "-safe", "0", "-i", concatPath,
  "-c", "copy", "-movflags", "+faststart", silentVideo,
], { stdio: "inherit" });

const escapedCaptionPath = captionPath.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
const captionFilter = `subtitles=filename='${escapedCaptionPath}':force_style='FontName=Segoe UI,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=2,Shadow=0,MarginV=36,Alignment=2'`;
execFileSync("ffmpeg", [
  "-y", "-i", silentVideo, "-i", audioPath,
  "-vf", captionFilter,
  "-map", "0:v:0", "-map", "1:a:0", "-shortest",
  "-c:v", "libx264", "-preset", "medium", "-crf", "23",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", outputPath,
], { stdio: "inherit" });

console.log(`${kind} tutorial rendered: ${outputPath}`);
