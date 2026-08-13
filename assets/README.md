# Submission and synthetic visual assets

This directory separates AI-generated fixtures/key art, code-rendered submission graphics, and
controlled browser captures. No asset contains a real participant, personal room, or retained live
webcam frame.

## Room-analysis fixtures

The three `room-fixtures/*.png` files are controlled inputs for `npm run smoke:agent`:

- `open-room.png` — wide Singapore apartment living room, clear central/left/right floor.
- `tight-room.png` — compact room with desk and chair bounding a narrow central lane.
- `uncertain-room.png` — deliberately incomplete framing with only a central lane clearly visible.

They were generated with the built-in image-generation tool as photorealistic, empty, 4:3 room
fixtures. Each prompt prohibited people, pets, identifying reflections, readable text, logos, and
watermarks. These fixtures test scene reasoning; they are not user-trial or camera-performance
evidence.

## Submission cover

`submission/moverealm-cover-source.png` is conceptual Neon Rainforest key art generated with the
built-in image-generation tool. It depicts one anonymous adult reaching with feet planted inside an
ordinary room transformed by vines, fireflies, and a glowing river. The prompt prohibited text,
logos, jumping, equipment, children, medical imagery, and additional worlds.

`submission/moverealm-cover-380x216.png` is the portal-sized derivative. It is marketing art, not a
runtime screenshot; use labelled product screenshots in the demo for implementation evidence.

## Code-rendered and captured submission assets

- `submission/architecture.svg` and `.png` are code-rendered architecture graphics.
- `submission/backup-video-title.svg` and `.png` are code-rendered disclosure/title cards that reuse
  the generated cover art.
- `submission/screenshots/01` through `06` are controlled guided-demo browser captures.
- `submission/screenshots/07` and `08` are controlled fake-camera live-CodeBuddy browser captures.
- `submission/moverealm-guided-backup.mp4` is a reproducible camera-free backup video assembled from
  those consent-free visuals with macOS synthetic narration. Its transcript is stored beside it.

The backup video explicitly labels its synthetic narration and keyboard controls and makes no human
pose-performance claim. Build it with `npm run video:backup`.
