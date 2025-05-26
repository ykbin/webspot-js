import path from "node:path";
import url from "node:url";

import { copyFileIfDifferent } from './Lib.mjs';

const FILE_SCHEME = "file://";
const IMPORT_SCHEME = "import://";

async function configure({resource, sourceDir, distDir, addAsset}) {
  if (!resource)
    return;

  for(const iter of resource) {
    let input;
    let output = ".";

    if (typeof iter === "string") {
      input = iter;
    }
    else {
      input = iter.input;
      if (iter.output) {
        output = iter.output;
        if (path.isAbsolute(output))
          throw new Error(`Not supported ${output} absolute output path`);
      }
    }

    if (input.startsWith(IMPORT_SCHEME)) {
      const moduleName = input.slice(IMPORT_SCHEME.length);
      input = import.meta.resolve(moduleName);
    }
    if (input.startsWith(FILE_SCHEME)) {
      input = url.fileURLToPath(input);
    }

    let rfile;
    if (path.isAbsolute(input)) {
      rfile = path.relative(sourceDir, input);
      if (rfile.startsWith(".")) {
        rfile = path.basename(rfile);
      }
    }
    else {
      rfile = input;
      input = path.resolve(sourceDir, rfile);
    }

    if (output === "." || output.endsWith("/")) {
      output = path.join(output, rfile);
    }

    output = path.resolve(distDir, output);
    rfile = path.relative(distDir, output);

    addAsset(rfile);
  
    if (await copyFileIfDifferent(input, output)) {
      console.log(`[resource.configure] Copy ${rfile}`);
    }
  }
}

async function generate({resource}) {
  if (!resource)
    return;
};

export default {
  configure,
  generate,
};
