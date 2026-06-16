import os, re, json, glob

RTD_DIR = "OpenRCT2/src/openrct2/ride/rtd"
rides = []

for path in glob.glob(os.path.join(RTD_DIR, "**", "*.h"), recursive=True):
    txt = open(path, encoding="utf-8", errors="ignore").read()
    # split into descriptor chunks
    parts = re.split(r"RideTypeDescriptor\s+\w+RTD\s*=", txt)
    for chunk in parts[1:]:
        name = re.search(r'\.Name\s*=\s*"([^"]+)"', chunk)
        if not name:
            continue
        cat = re.search(r'\.Category\s*=\s*RideCategory::(\w+)', chunk)
        def groups(field):
            m = re.search(field + r"\s*=\s*\{(.*?)\}", chunk, re.DOTALL)
            if not m: return []
            return sorted(set(re.findall(r"TrackGroup::(\w+)", m.group(1))))
        enabled = groups("enabledTrackGroups")
        extra = groups("extraTrackGroups")
        flags = re.search(r"\.flags\s*=\s*(.*?);", chunk, re.DOTALL)
        flagtxt = flags.group(1) if flags else ""
        rm = re.search(r"\.RatingsMultipliers\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", chunk)
        heights = re.search(r"\.Heights\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", chunk)
        feats = sorted(set(enabled) | set(extra))
        rides.append({
            "name": name.group(1),
            "category": cat.group(1) if cat else "unknown",
            "trackGroups": feats,
            "hasInversions": any(g in feats for g in
                ["verticalLoop","corkscrew","corkscrewLarge","halfLoop","halfLoopMedium",
                 "halfLoopLarge","barrelRoll","quarterLoop","zeroGRoll","zeroGRollLarge",
                 "diveLoop","largeHalfLoop","inlineTwist","flyingHalfLoop"]),
            "hasGForces": "checkGForces" in flagtxt,
            "ratingsMultipliers": [int(rm.group(1)),int(rm.group(2)),int(rm.group(3))] if rm else None,
            "heights": [int(heights.group(i)) for i in range(1,5)] if heights else None,
        })

rides.sort(key=lambda r:(r["category"], r["name"]))
out = {"schemaVersion":1, "source":"OpenRCT2/src/openrct2/ride/rtd", "count":len(rides), "rides":rides}
os.makedirs("data", exist_ok=True)
json.dump(out, open("data/ride-catalog.json","w"), indent=2)
print("rides extracted:", len(rides))
from collections import Counter
print("by category:", dict(Counter(r["category"] for r in rides)))
print("with inversions:", sum(1 for r in rides if r["hasInversions"]))
