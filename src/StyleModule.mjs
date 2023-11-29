import fs from "node:fs";
import path from "node:path";
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import autoPrefixer from 'autoprefixer';
import postcssMinify from '@csstools/postcss-minify';
import postcssGlobalData from '@csstools/postcss-global-data';
import postcssCustomProperties from 'postcss-custom-properties';
// import postcssNested from 'postcss-nested';
import { copyParamsIfDifferent } from './Lib.mjs';

async function configure({script, sourceDir, binaryDir}) {
  if (script) {
    for (const name of [ 'entry', 'prop', 'list' ]) {
      await copyParamsIfDifferent(script[name], {sourceDir, binaryDir});
    }
  }
}

async function generate({style, buildType, binaryDir, distDir}) {
  if (style && style.entry) {
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
      const inFilepath = path.resolve(binaryDir, val);
      fs.readFile(inFilepath, "utf-8", (err, content) => {
        if (err) throw err;
        const outFilename = `${key}.bundle.css`;
        const outFullFilepath = path.resolve(distDir, outFilename);
        postcss(stylePlugins).process(content).then(result => {
          fs.writeFile(outFullFilepath, result.css, () => true);
          console.log(`[style] Generate ${outFilename}`);
          if (result.map) {
            fs.writeFile(`${outFullFilepath}.map`, result.map);
            console.log(`[style] Generate ${outFilename}.map`)
          }
        });
      });
    }
  }
};

export default {
  configure,
  generate,
};
