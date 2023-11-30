import fs from "node:fs";
import path from "node:path";

async function configure({image, sourceDir, distDir}) {
  if (image) {
    for (const name of [ 'icon', 'logo', 'list' ]) {
      await copyParamsIfDifferent(image[name], {sourceDir, binaryDir: distDir});
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
