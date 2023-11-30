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

async function configure({style, sourceDir, binaryDir}) {
  if (style) {
    for (const name of [ 'entry', 'prop', 'list' ]) {
      await copyParamsIfDifferent(style[name], {sourceDir, binaryDir});
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
  
    for (const [ key, entry ] of Object.entries(style.entry)) {
      const inFilepath = path.resolve(binaryDir, entry);
      const content = await fs.promises.readFile(inFilepath, "utf-8");
      const outFilename = `${key}.bundle.css`;
      const outFullFilepath = path.resolve(distDir, outFilename);
      const result = await postcss(stylePlugins).process(content, { from: entry, to: outFilename });
      await fs.promises.writeFile(outFullFilepath, result.css);
      console.log(`[style.bundle] Generate ${outFilename}`);
      if (result.map) {
        await fs.promises.writeFile(`${outFullFilepath}.map`, result.map);
        console.log(`[style.bundle] Generate ${outFilename}.map`);
      }
    }
  }
};

export default {
  configure,
  generate,
};
