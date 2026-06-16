/* eslint-disable @typescript-eslint/no-namespace */

namespace RctaiBuilder {
  interface OpenRCT2SocketState {
    buffer: string;
  }

  export class OpenRCT2Adapter implements RctaiBuilder.BuilderAdapter {
    executeAction(
      action: RctaiBuilder.GameActionName,
      args: Record<string, unknown>,
      callback: (result: RctaiBuilder.GameActionResultLike) => void
    ): void {
      context.executeAction(action, args, (result) => callback(result));
    }

    resolveRideObject(rideType: string, preferredObject: string | null): RctaiBuilder.ResolvedRideObject | null {
      const rideTypeId = RctaiBuilder.resolveRideTypeId(rideType);
      if (rideTypeId === null) {
        return null;
      }

      const objects = objectManager.getAllObjects("ride");
      let fallback: RideObject | null = null;
      for (const object of objects) {
        if (object.rideType.indexOf(rideTypeId) < 0) {
          continue;
        }
        if (fallback === null) {
          fallback = object;
        }
        if (preferredObject !== null && object.identifier === preferredObject) {
          return { rideTypeId, rideObjectIndex: object.index };
        }
      }

      if (fallback !== null) {
        return { rideTypeId, rideObjectIndex: fallback.index };
      }

      return null;
    }

    resolveObject(type: RctaiBuilder.ObjectLookupType, identifier: string): number | null {
      const objects = objectManager.getAllObjects(type);
      for (const object of objects) {
        if (object.identifier === identifier || object.legacyIdentifier.trim() === identifier.trim()) {
          return object.index;
        }
      }
      return null;
    }

    resolvePathObjects(): RctaiBuilder.PathObjects {
      const surfaces = objectManager.getAllObjects("footpath_surface");
      const railings = objectManager.getAllObjects("footpath_railings");
      return {
        surfaceObject: surfaces[0]?.index ?? 0,
        railingsObject: railings[0]?.index ?? 0
      };
    }

    getExistingRideIds(): number[] {
      return map.rides.map((ride) => ride.id);
    }

    savePark(name: string, callback: (result: RctaiBuilder.GameActionResultLike) => void): void {
      try {
        console.executeLegacy(`save ${name}`);
        callback({});
      } catch (error) {
        callback({
          error: 1,
          errorTitle: "Save failed",
          errorMessage: error instanceof Error ? error.message : "legacy save command failed"
        });
      }
    }

    log(message: string): void {
      console.log(message);
    }
  }

  export function startOpenRCT2Server(port = RctaiBuilder.DEFAULT_PORT): RctaiBuilder.BuildController {
    const adapter = new OpenRCT2Adapter();
    const controller = new RctaiBuilder.BuildController(adapter);
    const listener = network.createListener();

    listener.on("connection", (socket) => {
      const state: OpenRCT2SocketState = { buffer: "" };
      socket.setNoDelay(true);
      socket.on("data", (data) => {
        state.buffer += data;
        const parsed = RctaiBuilder.parseHttpRequest(state.buffer);
        if (!parsed.ok && parsed.incomplete === true) {
          return;
        }

        const response = parsed.ok && parsed.request !== undefined
          ? RctaiBuilder.routeHttpRequest(parsed.request, controller)
          : { status: parsed.status ?? 400, body: { error: parsed.error ?? "malformed request" } };

        socket.end(RctaiBuilder.formatHttpResponse(response));
      });
      socket.on("error", (errorString) => {
        adapter.log(`[rctai-builder] socket error: ${errorString}`);
      });
    });

    listener.listen(port, "127.0.0.1");
    context.subscribe("interval.tick", () => {
      controller.tick();
    });
    adapter.log(`[rctai-builder] listening on 127.0.0.1:${port}`);
    return controller;
  }
}

(globalThis as { RctaiBuilder?: typeof RctaiBuilder }).RctaiBuilder = RctaiBuilder;

if (typeof registerPlugin !== "undefined") {
  registerPlugin({
    name: "RCTAI Builder",
    version: RctaiBuilder.VERSION,
    authors: "RCTAI",
    type: "local",
    licence: "MIT",
    targetApiVersion: 66,
    main() {
      const configuredPort = context.sharedStorage.get<number>("rctai.builder.port", RctaiBuilder.DEFAULT_PORT);
      RctaiBuilder.startOpenRCT2Server(configuredPort);
    }
  });
}
