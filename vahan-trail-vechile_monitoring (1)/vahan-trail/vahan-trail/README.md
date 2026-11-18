# VAHAN TRAIL — Vehicle Monitoring, Telangana

**Vahan = vehicle.** Clean, Uber-style vehicle monitoring for Telangana.
Cameras record sightings; routes join **only** confirmed, timestamped
camera sightings — never a prediction.

## What it is
Vehicle monitoring only, across Telangana.
Vehicles have a neutral status — **Moving / Active / Idle** — plus
last seen, route, speed and distance.

## Honest design rules
- **No prediction:** anything beyond the last sighting is an *estimated area* — radius = age × last speed, bounded by speed limits. Not a predicted location.
- **Freshness:** a score from 0–1 that falls over 6 hours — it measures how recent the last sighting is, not a location probability.
- **Route:** shortest path (Dijkstra) on a fast in-memory NetworkX corridor graph built from the 1,000 camera nodes. This is **not a live OSM download** — that would need OSMnx and a multi-MB graph fetch at startup. The graph, its node/edge counts, and this limitation are shown in `/api/status`.

## Scale
- 1,000 monitoring cameras across 12 Telangana cities (Hyderabad 150, Warangal 100, Nizamabad 85, Karimnagar 85, Khammam 85, Nalgonda 80, Mahbubnagar 80, Adilabad 75, Suryapet 70, Siddipet 65, Jagtial 65, Miryalaguda 60 — full list in `data/generate_data.py`)
- 1,200 vehicles (VH-2024-0001…1200), 480 Moving / 420 Active / 300 Idle, 3–6 sightings each, 4,833 sightings total; every 10th vehicle runs a long inter-city highway trip between two Telangana cities
- Number plates are Telangana only (TG), from each vehicle's home city (TG 09/10/11/07/08/12/13 Hyderabad, TG 03 Warangal, TG 16 Nizamabad, TG 02 Karimnagar, TG 20 Khammam, TG 05 Nalgonda, TG 06 Mahbubnagar, TG 01 Adilabad, TG 29 Suryapet, TG 36 Siddipet, TG 21 Jagtial, TG 42 Miryalaguda)
- Deterministic data: `python3 data/generate_data.py` regenerates `data/sightings.json` (seed 20241105)

## Features
- Clean light UI: top bar with search, sidebar with all options (Map, Vehicles, Vehicle details, Cameras, Live activity, Add sighting)
- Large live map as the hero — Esri World Imagery satellite tiles (no API key, loads reliably — OpenStreetMap tiles returned 403 "Access blocked" before) plus Esri reference overlays (World Transportation, World Boundaries and Places) so city/place/road names stay readable over the imagery, through the locally vendored Leaflet library (no CDN), with proper Esri attribution, centred on Telangana and fitted to the selected vehicle's route. If no tile loads within a few seconds, a dark satellite-style schematic map of all cameras takes over, so the map is never blank. The map is initialised only after sign-in, when it is visible, and is re-sized and fitted to the selected vehicle's route. The route is bright yellow (#FFD400) with a white casing; the covered part is green over a white casing.
- Vehicle list with search, status filters and pagination (20/page)
- Vehicle details: route, timeline, freshness, estimated area, nearby cameras, watch list, CSV timeline download
- Live activity with Simulate a new sighting, Add sighting form, route playback 1×/2×/5×, camera search and area filter, over-speed-limit flagging (over 60 km/h), camera health in `/api/status`, keyboard shortcut `/` to search

## Demo login — single admin only
| Username | Password | Account |
|---|---|---|
| admin | admin123 | Admin |

There is one administrator account — no multiple logins, no personal names.
The login page is dark and fits one screen: on the left a live "Telangana in
motion" stage where one white car drives a fixed cross-Telangana demo route
(Hyderabad → Warangal → Karimnagar → Nizamabad → Khammam), popping a CAMERA HIT
card at each of the 5 cameras — no vehicle details on the login page.
Click **"Fill & sign in"** in the Demo access box on the login page to sign in.

## Run locally
```bash
cd vahan-trail
python3 data/generate_data.py
pip install -r backend/requirements.txt --break-system-packages
python3 backend/app.py
# open http://localhost:5000
```
Flask serves the API **and** the frontend on one port.

## Deploy on Render (later — not deployed yet)
1. Push this folder to GitHub.
2. In Render: New → Web Service → connect the repo.
3. Build command: `pip install -r backend/requirements.txt`
   Start command: `gunicorn backend.app:app --bind 0.0.0.0:$PORT` (or `python backend/app.py`)
   `render.yaml` in this repo already describes this service.
4. Open the public Render URL — anyone with the link can open the login page (single demo admin login above).

## API
`POST /api/auth/login` · `GET /api/auth/verify` · `POST /api/auth/logout` · `GET /api/status` · `GET /api/analytics` · `GET /api/cameras` · `GET /api/cameras/<id>/crossings` · `GET /api/vehicles` · `GET /api/track/<id>` · `GET /api/nearby/<id>` · `POST /api/add_sighting` · `POST /api/simulate/crossing` · `POST /api/vehicles/<id>/watch`

## Performance
Canvas markers (`preferCanvas`), paginated vehicle list, debounced search (200 ms), cached `/api/track` results, no full map re-render on feed updates, in-memory graph — startup is under 2 seconds with no downloads.
