import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from 'url';

import scriptModule from './ScriptModule.mjs';

import postcss from 'postcss';
import postcssImport from 'postcss-import';
import autoPrefixer from 'autoprefixer';
import postcssMinify from '@csstools/postcss-minify';
import postcssGlobalData from '@csstools/postcss-global-data';
import postcssCustomProperties from 'postcss-custom-properties';

//import postcssNested from 'postcss-nested';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function preBuild(config) {
  config.distDir = path.join(config.binaryDir, "dist");
  if (fs.existsSync(distDir))
    fs.rmSync(distDir, {recursive: true});
  fs.mkdirSync(distDir);
}

async function buildStyle({style, buildType, binaryDir, distDir}) {
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
          console.log(`Generate ${outFilename} [postcss]`);
          if (result.map) {
            fs.writeFile(`${outFullFilepath}.map`, result.map);
            console.log(`Generate ${outFilename}.map  [postcss]`)
          }
        });
      });
    }
  }
};

async function buildConstants({script, sourceDir, binaryDir}) {
  if (script && script.const) {
    const inFilename = path.resolve(sourceDir, script.const);
    const { default: constants } = await import(pathToFileURL(inFilename));

    let content = "";
  
    for (const [ key, val ] of Object.entries(constants)) {
      content += `static const char ${key}[] = "${val}";\n`;
    }
  
    const outFilename = path.resolve(binaryDir, "Constans.h");
    fs.writeFile(outFilename, content, { encoding: 'utf8', flag: 'w' }, (err) => {
      if (err) throw err;
      console.log("Generate Constans.h [webspot]");
    }); 
  }
}

async function buildJSON({json, sourceDir, binaryDir, distDir}) {
  if (json && json.list) {
    for (let i = 0; i < json.list.length; i++) {
      const inFilename = path.resolve(sourceDir, json.list[i]);
      const outFilename = path.basename(inFilename, '.mjs') + ".json";
      const { default: module } = await import(pathToFileURL(inFilename));
      const content = JSON.stringify(module);
      fs.writeFile(path.resolve(distDir, outFilename), content, { encoding: 'utf8', flag: 'w' }, (err) => {
        if (err) throw err;
        console.log(`Generate ${outFilename} [webspot]`);
      });
    }
  }
}

export default {
  build(config) {
    function onError(err) {
      console.log(err);
      console.error(err.stack);
      process.exit(1);
    }  
    (async () => {
      await scriptModule.configure(config).catch(onError);

      await preBuild(config);
      await scriptModule.generate(config).catch(onError);
      await buildStyle(config).catch(onError);
      await buildConstants(config).catch(onError);
      await buildJSON(config).catch(onError);
    })();
  }
};
