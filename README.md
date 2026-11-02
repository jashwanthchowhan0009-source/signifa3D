# Signifa 3D

Interactive 3D website for [Signifa Builders & Developers](https://signifadevelopers.com/), Hyderabad.

- **Walk-through tour** — scroll from the gate, past the lobby, up the lift to the fifth floor,
  through the teak front door and into every room of a representative 3 BHK
  (living, balcony, dining & kitchen, three bedrooms).
- **Built in code** — the tower, site, flat, furniture and lighting are generated in `main.js`
  with Three.js. No model files to download, so it loads fast.
- **Live floor plan** — a mini plan shows where you are and which way you face. Click a room to jump there.
- **Sun dial** — drag from sunrise to night; sky, shadows, windows and room lights follow.
- **Projects, amenities and specifications** from signifadevelopers.com, EMI calculator, WhatsApp site-visit form.

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
| `index.html` | Page content: one slide per tour stop, then projects, amenities and contact |
| `styles.css` | Bronze / gold / ivory theme, layout, transitions |
| `main.js` | Builds the tower and the 3 BHK, sun and lights, tour camera (`STOPS`), floor plan |
| `interactions.js` | Text reveals, count-ups, tilt cards, magnetic buttons, EMI calculator |
| `assets/models/` | Supplied cars (Camaro, K578, 05H, F-150 Raptor), Vino scooters and pool, compressed with meshopt + WebP |
