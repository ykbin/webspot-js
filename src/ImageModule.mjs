import path from "node:path";
import { copyFileIfDifferent, getFilenamesFromParams } from './Lib.mjs';

async function configure({image, sourceDir, distDir}) {
  const list = [];
  for (const name of (image ? ['icon', 'logo', 'list'] : []))
    list.push(...getFilenamesFromParams(image[name]));
  for(const iter of list) {
    const inDirname = path.resolve(sourceDir, 'img');
    const inFilename = path.resolve(sourceDir, iter);
    const filename = path.relative(inDirname, inFilename);
    await copyFileIfDifferent(filename, inDirname, distDir);
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
