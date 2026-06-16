import { Ajv, type AnySchema, type ErrorObject } from "ajv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schemaUrl = new URL("../../../../schemas/park-plan.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as AnySchema;
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

export function loadAndValidatePlan(planPath: string): RctaiBuilder.ParkPlan {
  const absolutePath = resolve(planPath);
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;

  if (!validate(parsed)) {
    throw new Error(`park plan failed schema validation: ${formatErrors(validate.errors ?? [])}`);
  }

  const structural = RctaiBuilder.validatePlanShape(parsed);
  if (!structural.ok || structural.value === undefined) {
    throw new Error(`park plan failed runtime validation: ${structural.errors.join("; ")}`);
  }

  return structural.value;
}

function formatErrors(errors: ErrorObject[]): string {
  return errors.map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`).join("; ");
}
