import AjvModule from "ajv";
import addFormatsModule from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { findRepoRoot } from "./profiles.js";
import type { ParkPlan } from "./types.js";

const Ajv = AjvModule.default;
const addFormats = addFormatsModule.default;

export function validateParkPlan(plan: unknown, repoRoot = findRepoRoot()): ParkPlan {
  const schema = JSON.parse(readFileSync(join(repoRoot, "schemas", "park-plan.schema.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(plan)) {
    throw new Error(`Invalid park plan:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
  }

  return plan as ParkPlan;
}
