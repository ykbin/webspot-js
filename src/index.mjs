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
      if (result.map) {
        fs.writeFile(`${output}.map`, result.map);
        console.log(`Generate ${filename}.map  [postcss]`)
      }
    });
  }
};

async function buildConstants({script, sourceDir, binaryDir}) {
  if (script.hasOwnProperty("const")) {
    const inFilename = path.resolve(sourceDir, script.const);
    const { default: constants } = await import(inFilename);

    let content = "";
  
    for (const [ key, val ] of Object.entries(constants)) {
      content += `static const char ${key}[] = "${val}";\n`;
    }
  
    const outFilename = path.resolve(binaryDir, "Constans.h");
    fs.writeFile(outFilename, content, { encoding: 'utf8', flag: 'w' }, (err) => {
      if (err) {
        console.log(err);
        process.exit(1);
      }
      else {
        console.log("Generate Constans.h [webspot]"); 
      }
    }); 
  }
}

function build(config) {
  buildStyle(config);
  buildConstants(config);
}

export default {
  build,
};
