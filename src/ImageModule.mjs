import path from "node:path";
import { copyFileIfDifferent, getFilenamesFromParams } from './Lib.mjs';

async function configure({image, sourceDir, distDir}) {
  const list = [];
  for (const name of (image ? ['icon', 'logo', 'list'] : []))
    list.push(...getFilenamesFromParams(image[name]));
  console.log(">>> image", list);
  for(const filename of list) {
    const inParentPath = path.resolve(sourceDir, 'img');
    const inFilename = path.resolve(sourceDir, filename);
    const fname = path.relative(inParentPath, inFilename);
    const outFilename = path.resolve(distDir, fname);
    await copyFileIfDifferent(inFilename, outFilename);
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
