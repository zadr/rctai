import AjvModule from "ajv";
import addFormatsModule from "ajv-formats";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { WorkModel } from "./types.js";

const Ajv = AjvModule.default;
const addFormats = addFormatsModule.default;

export function findSpecRoot(startDirectory = process.env.INIT_CWD ?? process.cwd()): string {
  let directory = resolve(startDirectory);

  while (true) {
    if (existsSync(join(directory, "schemas", "work-model.schema.json"))) {
      return directory;
    }

    const parent = dirname(directory);

    if (parent === directory) {
      throw new Error(`Unable to find RCTAI spec root from ${startDirectory}`);
    }

    directory = parent;
  }
}

export function validateWorkModel(workModel: WorkModel, specRoot = findSpecRoot()): void {
  const schemaPath = join(specRoot, "schemas", "work-model.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);

  if (!validate(workModel)) {
    throw new Error(`Extractor emitted invalid work-model:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
  }
}
