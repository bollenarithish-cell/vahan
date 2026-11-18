#!/usr/bin/env python3
"""
VAHAN TRAIL — Vehicle Monitoring, Telangana.
Deterministic data generator: 1,000 monitoring cameras spread across
12 Telangana cities and 1,200 vehicles with 3-6 confirmed sightings
each — exactly 4,833 sightings. Number plates are Telangana only
(TG), from each vehicle's HOME city (TG 09, TG 03, TG 16, TG 02,
TG 20, TG 05, TG 06, TG 01, TG 29, TG 36, TG 21, TG 42). Every 10th
vehicle runs a long inter-city highway trip between two Telangana
cities; all other vehicles stay inside one city. Vehicle monitoring
only. Source of truth: data/sightings.json
"""
import json, random
from pathlib import Path
from datetime import datetime, timedelta, timezone

SEED = 20241105
rng = random.Random(SEED)
label_rng = random.Random(987654)
BASE = Path(__file__).resolve().parent
OUT = BASE / "sightings.json"

# (city, centre lat, centre lon, well-known junctions / roads)
# All 12 cities are inside Telangana (lat 15.9-19.9, lon 77.2-81.3).
CITIES = {
    "Hyderabad": (17.3850, 78.4867, [
        "Banjara Hills Rd 12", "Jubilee Hills Check Post", "Gachibowli X Roads",
        "Hitech City Flyover", "Begumpet Airport Rd", "Secunderabad Clock Tower",
        "Uppal X Roads", "Charminar South Gate", "Abids Circle", "Paradise Circle",
        "Malkajgiri Junction", "Kukatpally Y Junction", "LB Nagar Circle",
        "Madhapur Main Rd", "Rajendranagar Circle", "Koti Bus Stand",
        "Ameerpet Metro", "Nampally Exhibition Ground", "Dilsukhnagar Bus Depot",
        "Mehdipatnam Depot", "Tolichowki Crossroads", "Shamshabad Airport Rd",
        "Ramoji Film City Gate", "Secunderabad Railway Station East",
        "Kacheguda Station Rd",
    ]),
    "Warangal": (18.0059, 79.5581, [
        "Hanamkonda Chowk", "Kazipet Junction", "Warangal Fort Rd",
        "Thousand Pillar Temple Rd", "MGM Hospital Circle", "Kakatiya University Gate",
        "Subedari X Roads", "Nakkalagutta", "Ursu", "Enumamula",
        "Hasanparthy", "Madikonda X Roads", "Hunter Road", "JPN Road",
        "Station Road", "Girmajipet", "Mulugu Road", "Parkal Road",
        "Narsampet Road", "Khila Warangal", "Balasamudram", "Lashkar Bazaar",
        "Gopalpur", "Rangampet", "Pochammakunta",
    ]),
    "Nizamabad": (18.6725, 78.0941, [
        "Gandhi Chowk", "Collectorate Circle", "Kanteshwar", "Armoor Road",
        "Bodhan Road", "Dichpally X Roads", "Nizamabad Fort", "Yellammagutta",
        "Vinayak Nagar", "Shivaji Nagar", "Pragathi Nagar", "Bus Stand Circle",
        "Railway Station Rd", "Mubaraknagar", "Barkatpally", "Shastrinagar",
        "Nizamabad University", "Raghunathnagar", "Saraswati Nagar", "Nehru Park",
        "Nizamabad Market", "Basheerbagh", "Kotagally", "Phulong", "Sarangapur",
    ]),
    "Karimnagar": (18.4386, 79.1288, [
        "Tower Circle", "Kaman Chowk", "Jagtial Road", "Mancherial Road",
        "Collectorate", "Bus Stand", "Vavilalapally", "Sapthagiri Colony",
        "Mankamma Thota", "Kothi Road", "Rekurthi", "Kisan Nagar",
        "Nirmal Road", "Peddapalli Road", "Karimnagar Fort", "Satavahana University",
        "Choppadandi", "Huzurabad Road", "Alugunuru", "Thimmapur",
        "Kothapally", "Railway Station Rd", "Chaitanya Nagar", "Bhagathnagar",
        "Jyothinagar",
    ]),
    "Khammam": (17.2473, 80.1514, [
        "Gandhi Chowk", "Wyra Road", "Kothagudem Road", "Collectorate",
        "Bus Stand", "Khammam Fort", "Danavaigudem", "Burhanpuram",
        "Rotary Nagar", "Tekulapally", "Madhira Road", "Sathupally Road",
        "Railway Station Rd", "Gopalapuram", "NSR Colony", "Mamillagudem",
        "ZP Centre", "Khanapuram", "Gokinepally", "Yellandu Road",
        "Vemsoor Road", "Kallur", "Nelakondapally", "Pallavi Nagar", "Sathupally",
    ]),
    "Nalgonda": (17.0575, 79.2694, [
        "Clock Tower", "Devarakonda Road", "Miryalaguda Road", "Collectorate",
        "Bus Stand", "Nalgonda Fort", "Udaya Samudram", "Panagal",
        "Shaligowraram", "Haliya Road", "Chandur Road", "Munugode Road",
        "Narketpally", "Kanagal", "Anumula", "Kattangur",
        "Nakrekal", "Chityala", "Thipparthi", "Kethepally",
        "Madgulapally", "Arvapally", "Marriguda", "Peddavoora",
        "Nalgonda Railway Station",
    ]),
    "Mahbubnagar": (16.7310, 77.9784, [
        "Clock Tower", "Raichur Road", "Jadcherla Road", "Collectorate",
        "Bus Stand", "Kothakota", "Palakonda", "Boyapally",
        "Devarkadra Road", "Nagarkurnool Road", "Shadnagar Road", "Koilkonda",
        "Mettuguda", "Rajapur", "Bhoothpur", "Yenugonda",
        "Nandipet", "Appannapally", "Ieeja", "Pebbair",
        "Wanaparthy Road", "Madanapur", "Addakal", "Hanwada", "Kothur",
    ]),
    "Adilabad": (19.6641, 78.5320, [
        "Gandhi Chowk", "Nirmal Road", "Collectorate", "Bus Stand",
        "Jainath Road", "Mavala", "Adilabad Fort", "Kadam Road",
        "Kouthala Road", "Bellampally Road", "Talamadugu", "Utnoor Road",
        "Ichoda Road", "Bela Road", "Indravelli", "Narnoor",
        "Railway Station Rd", "Bhuktapur", "Kachkanti", "Pochera",
        "Sirpur Road", "Adilabad Market", "Rajiv Nagar", "Ramnagar", "Khanapur",
    ]),
    "Suryapet": (17.1400, 79.6210, [
        "Bus Stand", "Nalgonda Road", "Kodad Road", "Collectorate",
        "Clock Tower", "Huzurnagar Road", "Pillalamarri", "Suryapet Fort",
        "Thungathurthy", "Athmakur", "Chivvemla", "Penpahad",
        "Garidepally", "Balemla", "Mella Cheruvu", "Nereducherla",
        "Railway Road", "Rajiv Nagar", "Sri Lakshmi Nagar", "Suryapet Market",
        "Annaram", "Jajireddygudem", "Thirumalagiri", "Mothey", "Ananthagiri",
    ]),
    "Siddipet": (18.1016, 78.8520, [
        "Bus Stand", "Hyderabad Road", "Karimnagar Road", "Collectorate",
        "Clock Tower", "Siddipet Fort", "Gajwel Road", "Kondapaka",
        "Dubbak Road", "Mirzapur", "Rajagopalpet", "Cherial Road",
        "Nangunoor", "Husnabad Road", "Komuravelli", "Siddipet Market",
        "Maddur", "Bejjanki", "Thoguta", "Markook",
        "Akkannapet", "Duddeda", "Railway Road", "Ranganayaka Sagar",
        "Vemulawada Road",
    ]),
    "Jagtial": (18.7950, 78.9119, [
        "Bus Stand", "Karimnagar Road", "Nizamabad Road", "Collectorate",
        "Clock Tower", "Jagtial Fort", "Metpally Road", "Korutla Road",
        "Raikal", "Medipally", "Mallial", "Sarangapur",
        "Kathlapur", "Pegadapally", "Endapally", "Buggaram",
        "Kodimial", "Jagtial Market", "Dharmapuri Road", "Gollapally",
        "Railway Road", "Nandipet", "Gumpula", "Venkatapur", "Jagdevpur",
    ]),
    "Miryalaguda": (16.8679, 79.5635, [
        "Bus Stand", "Nalgonda Road", "Vijayawada Road", "Collectorate",
        "Clock Tower", "Miryalaguda Fort", "Haliya Road", "Damarcherla",
        "Kethepally", "Garidepally", "Railway Station Rd", "Vemulapally",
        "Nidamanur", "Tripuraram", "Wadapally", "Miryalaguda Market",
        "Madgulapally", "Ananthagiri", "Chintapally", "Lakshmipuram",
        "Jammikunta", "Peddavoora", "Marriguda", "Vemulapally X Roads",
        "Nereducherla",
    ]),
}

# Cameras per city — 1,000 total across 12 Telangana cities.
CITY_COUNTS = [
    ("Hyderabad", 150), ("Warangal", 100), ("Nizamabad", 85),
    ("Karimnagar", 85), ("Khammam", 85), ("Nalgonda", 80),
    ("Mahbubnagar", 80), ("Adilabad", 75), ("Suryapet", 70),
    ("Siddipet", 65), ("Jagtial", 65), ("Miryalaguda", 60),
]

# Home-city TG plate prefix (TG RTO district code). Telangana only —
# every vehicle is TG registered. Hyderabad uses several RTO codes.
CITY_PLATE = {
    "Hyderabad": ["TG 09", "TG 10", "TG 11", "TG 07", "TG 08", "TG 12", "TG 13"],
    "Warangal": "TG 03",
    "Nizamabad": "TG 16",
    "Karimnagar": "TG 02",
    "Khammam": "TG 20",
    "Nalgonda": "TG 05",
    "Mahbubnagar": "TG 06",
    "Adilabad": "TG 01",
    "Suryapet": "TG 29",
    "Siddipet": "TG 36",
    "Jagtial": "TG 21",
    "Miryalaguda": "TG 42",
}

MAKES = [
    ("Maruti Suzuki", "Swift"), ("Maruti Suzuki", "Baleno"), ("Hyundai", "i20"),
    ("Hyundai", "Creta"), ("Tata", "Nexon"), ("Tata", "Harrier"),
    ("Mahindra", "Scorpio-N"), ("Mahindra", "Thar"), ("Toyota", "Innova Crysta"),
    ("Toyota", "Fortuner"), ("Kia", "Seltos"), ("Kia", "Sonet"),
    ("Honda", "City"), ("Honda", "Amaze"), ("Skoda", "Slavia"),
    ("Volkswagen", "Virtus"), ("MG", "Hector"), ("Jeep", "Compass"),
]
COLOURS = ["Pearl White", "Midnight Black", "Silver Grey", "Deep Blue", "Crimson Red",
           "Titanium Grey", "Sunset Orange", "Forest Green", "Champagne Gold", "Steel Blue"]
NOTES = [
    "Regular route monitoring", "Long-distance trip", "Frequent city travel",
    "Daily commute route", "Airport shuttle route", "Weekend travel",
    "Business travel", "Delivery route", "Inter-city travel", "Routine monitoring",
]
GROUPS = ["Fleet A", "Fleet B", "Fleet C", "Fleet D"]

def plate(prefix):
    if isinstance(prefix, (list, tuple)):
        prefix = rng.choice(prefix)
    return f"{prefix} {rng.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}{rng.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')} {rng.randint(1000,9999)}"

def main():
    cameras = []
    city_cam_idx = {}
    i = 0
    for city, count in CITY_COUNTS:
        clat, clon, junctions = CITIES[city]
        city_cam_idx[city] = []
        for _ in range(count):
            lat = round(max(clat - 0.22, min(clat + 0.22, rng.gauss(clat, 0.075))), 5)
            lon = round(max(clon - 0.22, min(clon + 0.22, rng.gauss(clon, 0.075))), 5)
            j = junctions[(i * 7 + rng.randrange(5)) % len(junctions)]
            health = "degraded" if (i * 37) % 97 < 4 else "online"
            cameras.append({
                "camera_id": f"CAM-{i+1:04d}", "name": f"{j} — Cam {i+1:04d}",
                "zone": city, "road": j,
                "lat": lat, "lon": lon, "health": health,
                "speed_limit_kmh": 60,
                "installed": f"20{rng.randint(19,24)}-{rng.randint(1,12):02d}-{rng.randint(1,28):02d}",
            })
            city_cam_idx[city].append(i)
            i += 1

    # Neutral vehicle status: Moving / Active / Idle (480 / 420 / 300).
    statuses = (["Moving"]*480 + ["Active"]*420 + ["Idle"]*300)
    rng.shuffle(statuses)
    # Sightings per vehicle: exactly 4,833 in total across 1,200 vehicles.
    # 150 x 3 + 897 x 4 + 123 x 5 + 30 x 6 = 4833.
    sight_counts = [3]*150 + [4]*897 + [5]*123 + [6]*30
    rng.shuffle(sight_counts)
    # Home city: 100 vehicles per Telangana city (12 x 100 = 1,200).
    city_names = [c for c, _ in CITY_COUNTS]
    home_cities = []
    for city in city_names:
        home_cities += [city] * 100
    rng.shuffle(home_cities)

    vehicles = []
    for v in range(1200):
        vid = f"VH-2024-{v+1:04d}"
        status = statuses[v]
        make, model = rng.choice(MAKES)
        city = home_cities[v]
        n = sight_counts[v]
        # Every 10th vehicle runs a long inter-city highway trip WITHIN
        # Telangana: the first half of its sightings are in its home
        # city, the rest in a different Telangana city. All others stay
        # inside one city.
        inter = (v % 10 == 9)
        other_city = None
        if inter:
            other_city = rng.choice([c for c in city_names if c != city])
        cam_idx = []
        if inter:
            half = max(1, n // 2)
            for part, (cc, cnt) in enumerate(((city, half), (other_city, n - half))):
                pool = city_cam_idx[cc]
                start = rng.choice(pool)
                cam_idx.append(start)
                for _ in range(cnt - 1):
                    cur = cameras[cam_idx[-1]]
                    nearby = sorted(pool, key=lambda k: (cameras[k]["lat"]-cur["lat"])**2 + (cameras[k]["lon"]-cur["lon"])**2)
                    cam_idx.append(rng.choice(nearby[1:12]))
        else:
            start = rng.choice(city_cam_idx[city])
            cam_idx = [start]
            for _ in range(n-1):
                cur = cameras[cam_idx[-1]]
                nearby = sorted(city_cam_idx[city], key=lambda k: (cameras[k]["lat"]-cur["lat"])**2 + (cameras[k]["lon"]-cur["lon"])**2)
                cam_idx.append(rng.choice(nearby[1:12]))
        gaps = [rng.randint(10, 35) for _ in range(n-1)]
        end = datetime.now(timezone.utc) - timedelta(minutes=rng.randint(5, 120))
        times = [end - timedelta(minutes=sum(gaps[i:])) for i in range(n-1)] + [end]
        sightings = []
        for j, ci in enumerate(cam_idx):
            t = times[j]
            cam = cameras[ci]
            lim = cam["speed_limit_kmh"]
            speed = round(rng.uniform(lim + 3, lim + 18), 1) if rng.random() < 0.15 else round(rng.uniform(28, lim - 4), 1)
            sightings.append({
                "seq": j+1, "camera_id": cam["camera_id"], "camera_name": cam["name"],
                "zone": cam["zone"], "lat": cam["lat"], "lon": cam["lon"],
                "timestamp": t.isoformat().replace("+00:00", "Z"),
                "speed_kmh": speed, "detection_confidence": round(rng.uniform(0.86, 0.99), 3),
            })
        _plate = plate(CITY_PLATE[city])
        _colour = rng.choice(COLOURS)
        _year = rng.randint(2018, 2024)
        vehicles.append({
            "vehicle_id": vid, "plate": _plate, "make": make, "model": model,
            "colour": _colour, "year": _year,
            "status": status, "note": label_rng.choice(NOTES), "group": label_rng.choice(GROUPS),
            "sightings": sightings, "watched": False,
        })

    data = {"generated_at": datetime.now(timezone.utc).isoformat(), "seed": SEED,
            "country": "Telangana", "cities": [c for c, _ in CITY_COUNTS],
            "cameras": cameras, "vehicles": vehicles}
    OUT.write_text(json.dumps(data, indent=2))
    print(f"Wrote {OUT}: {len(cameras)} cameras, {len(vehicles)} vehicles, "
          f"{sum(len(v['sightings']) for v in vehicles)} sightings")

if __name__ == "__main__":
    main()
