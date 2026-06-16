import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Ajv, type AnySchema, type ErrorObject } from "ajv";

import type { ParkPlan } from "./types.js";

export async function readAndValidateParkPlan(path: string): Promise<ParkPlan> {
  const [inputText, schemaText] = await Promise.all([
    readFile(path, "utf8"),
    readFile(resolveSchemaPath(), "utf8")
  ]);

  const plan = parseJson(inputText, path);
  const schema = parseJson(schemaText, "schemas/park-plan.schema.json");
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile<ParkPlan>(schema as AnySchema);

  if (!validate(plan)) {
    throw new Error(`Invalid park-plan input:\n${formatAjvErrors(validate.errors ?? [])}`);
  }

  return plan as ParkPlan;
}

function resolveSchemaPath(): string {
  const candidates = [
    resolve(process.cwd(), "../../schemas/park-plan.schema.json"),
    resolve(process.cwd(), "schemas/park-plan.schema.json")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? "schemas/park-plan.schema.json";
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse ${label}: ${message}`);
  }
}

function formatAjvErrors(errors: ErrorObject[]): string {
  if (errors.length === 0) {
    return "schema validation failed without a detailed error";
  }

  return errors
    .map((error) => {
      const location = error.instancePath === "" ? "/" : error.instancePath;
      return `- ${location} ${error.message ?? "is invalid"}`;
    })
    .join("\n");
}
