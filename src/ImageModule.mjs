import { copyParamsIfDifferent } from './Lib.mjs';

async function configure({image, sourceDir, distDir}) {
  if (image) {
    for (const name of [ 'icon', 'logo', 'list' ]) {
      await copyParamsIfDifferent(image[name], {sourceDir, binaryDir: distDir, useBasename: true});
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
