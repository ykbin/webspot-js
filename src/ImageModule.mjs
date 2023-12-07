import path from "node:path";
import { copyFileIfDifferent, getFilenamesFromParams } from './Lib.mjs';

async function configure({image, sourceDir, distDir, addAsset}) {
  const list = [];
  for (const name of (image ? ['icon', 'logo', 'list'] : []))
    list.push(...getFilenamesFromParams(image[name]));
  for(const iter of list) {
    const inDirname = path.resolve(sourceDir, 'img');
    const inFilename = path.resolve(sourceDir, iter);
    const filename = path.relative(inDirname, inFilename);
    const outFilename = path.resolve(distDir, filename);
    addAsset(filename);
    if (await copyFileIfDifferent(inFilename, outFilename)) {
      console.log(`[image.configure] Copy ${iter}`);
    }
  }
}

async function generate({image}) {
  if (image) {
  }
};

export default {
  configure,
  generate,
};
