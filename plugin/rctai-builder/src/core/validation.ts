/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */

namespace RctaiBuilder {
  export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  export function validatePlanShape(input: unknown): RctaiBuilder.ValidationResult<RctaiBuilder.ParkPlan> {
    const errors: string[] = [];

    if (!isPlainObject(input)) {
      return { ok: false, errors: ["plan must be an object"] };
    }

    if (input.schemaVersion !== 1) {
      errors.push("schemaVersion must be 1");
    }

    if (!isPlainObject(input.park)) {
      errors.push("park must be an object");
    } else {
      if (typeof input.park.name !== "string" || input.park.name.length === 0) {
        errors.push("park.name must be a non-empty string");
      }
      if (!isPlainObject(input.park.size)) {
        errors.push("park.size must be an object");
      } else {
        assertInteger(input.park.size.width, "park.size.width", errors);
        assertInteger(input.park.size.height, "park.size.height", errors);
      }
      if (!isCoordLike(input.park.entrance)) {
        errors.push("park.entrance must have integer x and y");
      }
    }

    if (!Array.isArray(input.rides)) {
      errors.push("rides must be an array");
    } else {
      for (let index = 0; index < input.rides.length; index += 1) {
        validateRideShape(input.rides[index], index, errors);
      }
    }

    if (input.paths !== undefined && !Array.isArray(input.paths)) {
      errors.push("paths must be an array when present");
    }

    if (Array.isArray(input.paths)) {
      for (let index = 0; index < input.paths.length; index += 1) {
        validatePathShape(input.paths[index], index, errors);
      }
    }

    if (input.scenery !== undefined && !Array.isArray(input.scenery)) {
      errors.push("scenery must be an array when present");
    }

    if (Array.isArray(input.scenery)) {
      for (let index = 0; index < input.scenery.length; index += 1) {
        validateSceneryShape(input.scenery[index], index, errors);
      }
    }

    return errors.length === 0
      ? { ok: true, value: input as unknown as RctaiBuilder.ParkPlan, errors: [] }
      : { ok: false, errors };
  }

  function validateRideShape(input: unknown, index: number, errors: string[]): void {
    const prefix = `rides[${index}]`;
    if (!isPlainObject(input)) {
      errors.push(`${prefix} must be an object`);
      return;
    }

    assertString(input.id, `${prefix}.id`, errors);
    assertString(input.name, `${prefix}.name`, errors);
    assertString(input.archetype, `${prefix}.archetype`, errors);
    assertString(input.rideType, `${prefix}.rideType`, errors);

    if (!isPlainObject(input.footprint)) {
      errors.push(`${prefix}.footprint must be an object`);
    } else {
      assertInteger(input.footprint.w, `${prefix}.footprint.w`, errors);
      assertInteger(input.footprint.h, `${prefix}.footprint.h`, errors);
    }

    if (!isCoordLike(input.position)) {
      errors.push(`${prefix}.position must have integer x and y`);
    }

    if (input.rotation !== undefined) {
      assertInteger(input.rotation, `${prefix}.rotation`, errors);
    }

    if (input.track !== undefined && input.track !== null) {
      if (!Array.isArray(input.track)) {
        errors.push(`${prefix}.track must be an array or null`);
      } else {
        for (let trackIndex = 0; trackIndex < input.track.length; trackIndex += 1) {
          const segment = input.track[trackIndex];
          if (!isPlainObject(segment)) {
            errors.push(`${prefix}.track[${trackIndex}] must be an object`);
          } else {
            assertInteger(segment.type, `${prefix}.track[${trackIndex}].type`, errors);
          }
        }
      }
    }
  }

  function validatePathShape(input: unknown, index: number, errors: string[]): void {
    const prefix = `paths[${index}]`;
    if (!isPlainObject(input)) {
      errors.push(`${prefix} must be an object`);
      return;
    }
    assertString(input.from, `${prefix}.from`, errors);
    assertString(input.to, `${prefix}.to`, errors);
    if (input.waypoints !== undefined && !Array.isArray(input.waypoints)) {
      errors.push(`${prefix}.waypoints must be an array when present`);
    }
  }

  function validateSceneryShape(input: unknown, index: number, errors: string[]): void {
    const prefix = `scenery[${index}]`;
    if (!isPlainObject(input)) {
      errors.push(`${prefix} must be an object`);
      return;
    }
    assertString(input.object, `${prefix}.object`, errors);
    if (!isCoordLike(input.position)) {
      errors.push(`${prefix}.position must have integer x and y`);
    }
  }

  function isCoordLike(input: unknown): boolean {
    return isPlainObject(input) && Number.isInteger(input.x) && Number.isInteger(input.y);
  }

  function assertString(value: unknown, path: string, errors: string[]): void {
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`${path} must be a non-empty string`);
    }
  }

  function assertInteger(value: unknown, path: string, errors: string[]): void {
    if (!Number.isInteger(value)) {
      errors.push(`${path} must be an integer`);
    }
  }
}
