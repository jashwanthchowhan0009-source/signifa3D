# Signifa 3D

Interactive 3D tour for **Signifa Signature**, Machabollaram, Hyderabad ([Signifa Builders & Developers](https://signifadevelopers.com/)).

- **Arrow-driven tour, no page scroll.** ‹ › buttons, arrow keys or a swipe move between camera stops. Drag to look around.
- **Exterior tour (10 stops):** in from the 60 ft road, gate and water body, pool deck with cabana, solar EV station with Cybertrucks, jogging track (follows a runner), kids play area and courts, club house with gym and yoga, residents lobby.
- **Home tours:** 3 BHK (1,695 sft) and 2 BHK (1,060 sft), laid out after the brochure plans. Walls are generated from room rectangles in `PLANS` (main.js). Live floor plan shows where you stand.
- **People:** jointed figures (hips, knees, shoulders, elbows) walking, running, swimming, swinging and doing yoga.
- **Sun dial:** sunrise to night; windows, lamps and the pool light up after dark.
- After the last stop, an information page slides up: projects, amenities, specifications, area statement, contact and footer.

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
| `index.html` | Tour controls, caption, info page (projects, amenities, area statement, contact) |
| `styles.css` | Bronze / gold / ivory theme, layout, transitions |
| `main.js` | Site, tower, amenities, people, both flats (`PLANS`), sun, tour stops (`EXT`, `PLANS[...].stops`) |
| `interactions.js` | Count-ups, magnetic buttons, area statement grid |
| `assets/models/` | Supplied cars (Camaro, K578, 05H, F-150 Raptor), Vino scooters and pool, compressed with meshopt + WebP |
