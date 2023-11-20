import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

import postcss from 'postcss';
import postcssImport from 'postcss-import';
import autoPrefixer from 'autoprefixer';
import postcssMinify from '@csstools/postcss-minify';
import postcssGlobalData from '@csstools/postcss-global-data';
import postcssCustomProperties from 'postcss-custom-properties';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildStyle({style, buildType, binaryDir}) {
  const stylePlugins = [
    postcssImport,
    autoPrefixer,
    postcssGlobalData({
      files: [
        style.prop,
      ],
    }),
    postcssCustomProperties({
      preserve: false
    }),
  ];

  if (buildType !== "Debug")
    stylePlugins.push(postcssMinify);

  for (const [ key, val ] of Object.entries(style.entry)) {
    const styleFilepath = path.resolve(binaryDir, val);
    const style = fs.readFileSync(styleFilepath, "utf-8");
    const filename = `${key}.bundle.css`;
    const output = path.resolve(binaryDir, 'dist', filename);
    postcss(stylePlugins).process(style).then(result => {
      fs.writeFile(output, result.css, () => true);
      console.log(`Generate ${filename} [postcss]`);
    });
  }
};

function build(config) {
  buildStyle(config);
}

export default {
  buildStyle,
  build,
};
