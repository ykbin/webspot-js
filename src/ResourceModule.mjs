import path from "node:path";
import { copyFileIfDifferent } from './Lib.mjs';

async function configure({resource, sourceDir, distDir, addAsset}) {
  if (!resource)
    return;

  for(const iter of resource) {
    const inFilename = path.resolve(sourceDir, iter);
    const outFilename = path.resolve(distDir, iter);
    addAsset(iter);
    if (await copyFileIfDifferent(inFilename, outFilename)) {
      console.log(`[resource.configure] Copy ${iter}`);
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
