import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = process.cwd();

const pairs = [
  {
    schemaPath: "schemas/work-model.schema.json",
    fixturePath: "fixtures/sample.work-model.json",
    name: "sample.work-model"
  },
  {
    schemaPath: "schemas/park-plan.schema.json",
    fixturePath: "fixtures/sample.park-plan.json",
    name: "sample.park-plan"
  }
];

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

const ajv = new Ajv({
  allErrors: true,
  strict: false
});
addFormats(ajv);

let failed = false;

for (const pair of pairs) {
  const schema = readJson(pair.schemaPath);
  const fixture = readJson(pair.fixturePath);
  const validate = ajv.compile(schema);

  if (!validate(fixture)) {
    failed = true;
    console.error(`${pair.name}: invalid`);
    console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
    continue;
  }

  console.log(
    `${pair.name}: valid (${relative(root, pair.fixturePath)} against ${relative(root, pair.schemaPath)})`
  );
}

if (failed) {
  process.exitCode = 1;
}
