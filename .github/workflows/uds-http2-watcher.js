const { resolve } = require("node:path");
const { access, copyFile, readFile, writeFile } = require("node:fs/promises");

async function run(args) {
  // args[0] = <path to node bin>
  // args[1] = <path to this script>
  // args[2] = <path to package.json>

  const pathArg = args[2];
  if (!pathArg) {
    throw "arg error: must pass path to package.json";
  }

  if (!pathArg.endsWith("package.json")) {
    throw `arg error: path (${pathArg}) must end in 'package.json'`;
  }

  let path = resolve(pathArg);
  access(path).catch(e => {
    throw e;
  });

  await copyFile(path, `${path}.bak`);

  const pkg = JSON.parse(await readFile(path, "utf8"));
  let env = pkg?.pepr?.env || {};
  env = { ...env, PEPR_HTTP2_WATCH: "true" };
  pkg.pepr.env = env;

  await writeFile(path, JSON.stringify(pkg, null, 2));
}

run(process.argv).catch(err => {
  console.error(err);
  process.exit(-1);
});
