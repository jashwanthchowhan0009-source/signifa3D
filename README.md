# Signifa 3D

Interactive 3D website for [Signifa Builders & Developers](https://signifadevelopers.com/), Hyderabad.

- **3D villa** (`assets/house.glb`) — the LHouse SketchUp model, painted into luxury materials
  (charcoal stone, gloss-white bands and fins, amber-lit glazing, timber, garden) and
  meshopt-compressed from 15.7 MB to ~1 MB.
- **Slides** — scroll through near and far camera shots: roof, pool, sky gardens, tower, aerial, projects.
- **Sun dial** — drag from sunrise to night; shadows move, windows and pool light up after dark.
- **Hotspots, drag-to-turn, letter/word reveals, tilt cards, EMI calculator, WhatsApp site-visit form.**

## Run locally

Any static server works:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly from disk won't load the model.)

## Deploy

Static files only — GitHub Pages, Vercel or Netlify. Three.js loads from jsDelivr.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page content and slides (each `data-cam` = azimuth, elevation, distance, target x,y,z) |
| `styles.css` | Bronze / gold / ivory theme, layout, transitions |
| `main.js` | Three.js scene, materials, sun, camera path, hotspots |
| `interactions.js` | Text reveals, count-ups, tilt cards, magnetic buttons, EMI calculator |
| `assets/` | Painted model, walkthrough video and poster |
