import json, math
cat = json.load(open("data/ride-catalog.json"))
rides = [r for r in cat["rides"] if r["category"] != "none"]
INVERSIONS = ["verticalLoop","halfLoop","halfLoopMedium","halfLoopLarge","largeHalfLoop",
              "corkscrew","corkscrewLarge","barrelRoll","quarterLoop","zeroGRoll",
              "zeroGRollLarge","diveLoop","inlineTwist","flyingHalfLoop"]
STEEP=["slopeSteepUp","slopeSteepDown","slopeSteepLong","slopeVertical","curveVertical"]
BANK=["flatRollBanking","slopeRollBanking","slopeCurveBanked"]
# size base lowered for coasters; feature-count is the real size discriminator
CAT_BASE={"shop":(0.05,0.02,0.02),"gentle":(0.22,0.18,0.20),"transport":(0.78,0.22,0.20),
          "water":(0.45,0.45,0.40),"thrill":(0.28,0.55,0.62),"rollerCoaster":(0.20,0.62,0.45)}
clamp=lambda x:max(0.0,min(1.0,x))
maxfeat=max(len(r["trackGroups"]) for r in rides)
for r in rides:
    sb,ab,rb=CAT_BASE.get(r["category"],(0.3,0.3,0.3))
    feats=r["trackGroups"]; invs=[g for g in feats if g in INVERSIONS]
    helices=[g for g in feats if g.startswith("helix")]
    steeps=[g for g in feats if g in STEEP]; banks=[g for g in feats if g in BANK]
    rm=r["ratingsMultipliers"] or [30,20,10]; exc,inten,naus=rm
    h=r["heights"][0] if r["heights"] else 16
    featFrac=len(feats)/maxfeat
    adv=ab+0.20*(len(invs)>0)+0.12*min(len(invs)/6,1)+0.12*featFrac
    risk=rb+0.16*(inten/50)+0.16*(naus/30)+0.10*r["hasGForces"]+0.10*(len(invs)>0)
    size=sb+0.55*featFrac+0.18*min(h,96)/96
    r["axisProfile"]={"size":round(clamp(size),3),"adventure":round(clamp(adv),3),"risk":round(clamp(risk),3)}
    r["buildOut"]={"isCoaster":r["category"]=="rollerCoaster","isTower":"tower" in feats,
        "inversions":invs,"helices":helices,"steepDrops":steeps,"banking":banks,
        "supportsLiftHill":"liftHill" in feats}
rides.sort(key=lambda r:(r["category"],r["axisProfile"]["size"]))
json.dump({"schemaVersion":1,"count":len(rides),"inversionVocab":INVERSIONS,"rides":rides},
          open("data/ride-profiles.json","w"),indent=2)
# show coaster size spread
cs=sorted([r for r in rides if r["category"]=="rollerCoaster"],key=lambda r:r["axisProfile"]["size"])
print("coaster size spread (low..high):")
for r in cs[:4]+cs[-4:]:
    print(f"  {r['name']:22s} size={r['axisProfile']['size']:.2f} adv={r['axisProfile']['adventure']:.2f} risk={r['axisProfile']['risk']:.2f}")
