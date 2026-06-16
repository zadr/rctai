import assert from "node:assert/strict";
import test from "node:test";

await import("../dist/rctai-builder.js");

const builder = globalThis.RctaiBuilder;

function rideObject(index, identifier, rideType) {
  return {
    index,
    type: "ride",
    identifier,
    legacyIdentifier: "",
    installedObject: {
      identifier,
      legacyIdentifier: ""
    },
    rideType
  };
}

test("OpenRCT2 adapter lets ridecreate auto-select a loaded preferred object", () => {
  const loadCalls = [];
  globalThis.objectManager = {
    getAllObjects(type) {
      assert.equal(type, "ride");
      return [];
    },
    load(identifier) {
      loadCalls.push(identifier);
      assert.equal(identifier, "rct2.ride.scht1");
      return rideObject(74, identifier, [15]);
    },
    unload() {
      throw new Error("matching ride object should not be unloaded");
    },
    installedObjects: []
  };

  const adapter = new builder.OpenRCT2Adapter();
  const resolved = adapter.resolveRideObject("looping_rc", "rct2.ride.scht1");

  assert.deepEqual(resolved, { rideTypeId: 15, rideObjectIndex: 65535 });
  assert.deepEqual(loadCalls, ["rct2.ride.scht1"]);
});

test("OpenRCT2 adapter caches ride objects by ride type and preferred object", () => {
  globalThis.objectManager = {
    getAllObjects(type) {
      assert.equal(type, "ride");
      return [];
    },
    load(identifier) {
      return rideObject(identifier.endsWith("a") ? 11 : 12, identifier, [15]);
    },
    unload() {
      throw new Error("matching ride object should not be unloaded");
    },
    installedObjects: []
  };

  const adapter = new builder.OpenRCT2Adapter();
  const first = adapter.resolveRideObject("looping_rc", "rct2.ride.vehicle-a");
  const second = adapter.resolveRideObject("looping_rc", "rct2.ride.vehicle-b");

  assert.deepEqual(first, { rideTypeId: 15, rideObjectIndex: 65535 });
  assert.deepEqual(second, { rideTypeId: 15, rideObjectIndex: 65535 });
});

test("OpenRCT2 adapter does not unload ride objects that were already loaded while probing installed objects", () => {
  const unloadCalls = [];
  globalThis.objectManager = {
    getAllObjects(type) {
      assert.equal(type, "ride");
      return [rideObject(4, "rct2.ride.loaded-looping", [15])];
    },
    load(identifier) {
      if (identifier === "rct2.ride.loaded-looping") {
        return rideObject(4, identifier, [15]);
      }
      return rideObject(5, identifier, [51]);
    },
    unload(identifier) {
      unloadCalls.push(identifier);
    },
    installedObjects: [
      { type: "ride", identifier: "rct2.ride.loaded-looping" },
      { type: "ride", identifier: "rct2.ride.twister" }
    ]
  };

  const adapter = new builder.OpenRCT2Adapter();
  const resolved = adapter.resolveRideObject("twister_rc", null);

  assert.deepEqual(resolved, { rideTypeId: 51, rideObjectIndex: 65535 });
  assert.deepEqual(unloadCalls, []);
});
