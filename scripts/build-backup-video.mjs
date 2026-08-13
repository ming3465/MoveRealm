import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "assets/submission/moverealm-guided-backup.mp4");
const transcriptOutput = resolve(root, "assets/submission/moverealm-guided-backup-transcript.txt");
const temporary = mkdtempSync(join(tmpdir(), "moverealm-video-"));

const slides = [
  {
    image: "assets/submission/backup-video-title.png",
    narration:
      "For time-poor adults, MoveRealm makes any room a movement adventure. This is a camera-free backup demo with synthetic narration and keyboard controls. No person appears, and no pose-performance result is claimed. The live agent evidence shown later uses a synthetic camera and is labelled as controlled evidence.",
  },
  {
    image: "assets/submission/screenshots/01-landing.png",
    narration:
      "The product is for a time-poor adult who wants light, low-impact movement without equipment or setup friction. It is not medical or rehabilitation guidance; stop if you feel unwell. The user chooses an energy level and a three-minute session. No jumping is locked on. They can scan their room for the full experience, or enter this resilient guided path when a camera or network service is unavailable.",
  },
  {
    image: "assets/submission/screenshots/07-live-codebuddy-scene.png",
    narration:
      "In the live path, the user explicitly captures one room still. The local Node adapter sends that still to CodeBuddy, the runtime Movement Director. Here a synthetic camera contains no usable room, so CodeBuddy correctly returns an uncertain profile with only the centre lane permitted. The visible thirty-four point eight second badge is agent source latency, not movement-response latency. The temporary still is deleted after analysis.",
  },
  {
    image: "assets/submission/screenshots/02-confirm-room.png",
    narration:
      "The agent never gets the final word on physical safety. The user must confirm that the floor is clear, and can narrow or remove side steps before planning. The continue action stays disabled until that explicit confirmation. Unknown movements, jumping, plans outside the requested duration, and movements that conflict with these confirmed directions are rejected.",
  },
  {
    image: "assets/submission/screenshots/03-calibration.png",
    narration:
      "A real camera run then calibrates framing with a T pose, an outward step, and a verified return to centre. MediaPipe runs in a browser worker. If confidence drops or the person leaves view, the game pauses instead of guessing. This backup uses the clearly labelled keyboard control option, so tracking frames per second and movement latency remain not applicable.",
  },
  {
    image: "assets/submission/screenshots/04-game.png",
    narration:
      "The room becomes one polished Neon Rainforest. Reaches collect fireflies and grow branches. Squats shelter seedlings from rain. Permitted side steps redirect a glowing river. Each target has one cancellable lifecycle timer, and each movement must meet the displayed range envelope. In a real run, pose events stay on-device. In this guided run, the keyboard is a transparent judging control, not fabricated pose telemetry.",
  },
  {
    image: "assets/submission/screenshots/08-live-codebuddy-adaptation.png",
    narration:
      "After round one, the loop closes. Completion, observed movement range, tracking confidence when available, and the user's explicit difficulty answer become constrained telemetry. In this controlled live CodeBuddy example, only one of seven targets was reached and the user chose too hard. The Movement Director reduced range from sixty to forty-five percent, tempo from point nine to point seven, and target rate from seven to five. The validator permits parameter tuning, but never lets the agent replace the known movement.",
  },
  {
    image: "assets/submission/screenshots/05-adaptation.png",
    narration:
      "The public guided build demonstrates the same product language with deterministic provenance. It visibly says Guided demo, not CodeBuddy live. Wide targets were missed, so the next envelope, tempo, and rate all change on screen. If the agent times out or returns malformed data, the production adapter uses this safe validated fallback rather than blocking the adventure or hiding the source.",
  },
  {
    image: "assets/submission/screenshots/06-postcard.png",
    narration:
      "The experience ends with a garden postcard, completion, and honest runtime evidence. Three fifty-two second movement rounds equal two point six active minutes. Two twelve second rests bring the complete adventure clock to exactly three minutes. Keyboard tracking is shown as N A, not thirty frames per second. The proof row also states that live video was never uploaded.",
  },
  {
    image: "assets/submission/architecture.png",
    narration:
      "Here is the technical loop. One approved still crosses the browser boundary for scene analysis. CodeBuddy proposes a scene, a three-round quest, and later adaptations through an asynchronous Node adapter. Zod contracts enforce the room directions, exact duration, no jumping, three known movements, and conservative fallback behavior. Separately, live frames remain inside the browser. A MediaPipe worker produces thirty-three landmarks, the movement state machines emit validated events, and Phaser renders immediate feedback. Telemetry returns only after a round, and another safety boundary validates the changed parameters before the next world state is applied. The build approach was vertical-slice first: reliable input and one complete round before agent integration. A practical CodeBuddy tip is to request strict JSON schemas and one repair prompt, then validate again outside the model.",
  },
  {
    image: "assets/submission/backup-video-title.png",
    narration:
      "The defensible idea is the closed loop: understand the actual room, constrain the plan, turn movement into play, observe the result, and visibly adapt. The public guided demo and source repository are ready, along with controlled open, tight, and uncertain room evidence. Real-person frame rate, visible response latency, time to first movement, and three user trials are still marked pending rather than estimated. MoveRealm: turn any room into an adaptive movement adventure.",
  },
];

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

function probeDuration(path) {
  return Number(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
      { encoding: "utf8" },
    ).trim(),
  );
}

try {
  const segmentPaths = [];
  for (const [index, slide] of slides.entries()) {
    const name = String(index + 1).padStart(2, "0");
    const audio = join(temporary, `${name}.aiff`);
    const segment = join(temporary, `${name}.mp4`);
    run("say", ["-v", "Samantha", "-r", "165", "-o", audio, slide.narration]);
    const duration = probeDuration(audio) + 0.7;
    run("ffmpeg", [
      "-loglevel", "error",
      "-y",
      "-loop", "1",
      "-framerate", "30",
      "-i", resolve(root, slide.image),
      "-i", audio,
      "-filter_complex",
      "[0:v]scale=1440:810:force_original_aspect_ratio=decrease,pad=1440:810:(ow-iw)/2:(oh-ih)/2:color=0x020a08,format=yuv420p[v];[1:a]apad=pad_dur=0.7[a]",
      "-map", "[v]",
      "-map", "[a]",
      "-t", duration.toFixed(3),
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "20",
      "-c:a", "aac",
      "-b:a", "160k",
      segment,
    ]);
    segmentPaths.push(segment);
  }

  const concatFile = join(temporary, "segments.txt");
  writeFileSync(
    concatFile,
    segmentPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n") + "\n",
  );
  run("ffmpeg", [
    "-loglevel", "error",
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatFile,
    "-c", "copy",
    "-movflags", "+faststart",
    output,
  ]);

  writeFileSync(
    transcriptOutput,
    [
      "MoveRealm camera-free backup demo transcript",
      "Synthetic narration; guided keyboard controls; no human pose-performance claims.",
      "",
      ...slides.flatMap((slide, index) => [`${index + 1}. ${slide.narration}`, ""]),
    ].join("\n"),
  );

  const duration = probeDuration(output);
  if (duration < 180 || duration > 300) {
    rmSync(output, { force: true });
    throw new Error(`Video duration ${duration.toFixed(2)}s is outside the required 3–5 minute range.`);
  }
  console.log(`Created ${output}`);
  console.log(`Duration ${duration.toFixed(2)} seconds`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
