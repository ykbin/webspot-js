import fs from "node:fs";
import path from "node:path";
import postcss from 'postcss';
import postcssUrl from 'postcss-url';
import postcssImport from 'postcss-import';
import autoPrefixer from 'autoprefixer';
import postcssMinify from '@csstools/postcss-minify';
import postcssGlobalData from '@csstools/postcss-global-data';
import postcssCustomProperties from 'postcss-custom-properties';
// import postcssNested from 'postcss-nested';
import { copyFileIfDifferent, getFilenamesFromParams } from './Lib.mjs';

async function process({ from, to, prop, isDebug, workDir, writeAsset, isInlineSvg }) {
  const propFiles = prop ? [ path.join(workDir, prop) ] : [];
  const stylePlugins = [
    postcssImport({
      path: [ workDir ],
    }),
    autoPrefixer,
    postcssGlobalData({
      files: propFiles,
    }),
    postcssCustomProperties({
      preserve: false
    }),
  ];

  if (isInlineSvg) {
    stylePlugins.push(postcssUrl({
      url: 'inline',
      filter: '**/*.svg',
      basePath: workDir,
    }));
  }

   if (!isDebug)
    stylePlugins.push(postcssMinify);

  const inFilepath = path.resolve(workDir, from);
  const content = await fs.promises.readFile(inFilepath, "utf-8");
  const result = await postcss(stylePlugins).process(content, { from, to });

  if (writeAsset) {
    await writeAsset(to, result.css, {type: "text/css"});
    console.log(`[style.bundle] Generate from ${from} to ${to}`);
  }

  if (result.map && writeAsset) {
    await writeAsset(`${to}.map`, result.map, {type: "text/plain"});
    console.log(`[style.bundle] Generate ${to}.map`);
  }

  return result.css;
}

async function configure({style, sourceDir, binaryDir}) {
  const list = [];
  for (const name of (style ? ['entry', 'prop', 'list'] : [])) {
    list.push(...getFilenamesFromParams(style[name]));
  }
  for(const iter of list) {
    const inFilename = path.resolve(sourceDir, iter);
    const outFilename = path.resolve(binaryDir, iter);
    if (await copyFileIfDifferent(inFilename, outFilename)) {
      console.log(`[style.configure] Copy ${iter}`);
    }
  }
}

async function generate({style, buildType, binaryDir, writeAsset}) {
  if (style && style.entry) {
    const stylePlugins = [
      postcssImport({
        path: [ binaryDir ],
      }),
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
      const result = await postcss(stylePlugins).process(content, { from: entry, to: outFilename });
      await writeAsset(outFilename, result.css, {type: "text/css"});
      console.log(`[style.bundle] Generate ${outFilename}`);
      if (result.map) {
        await writeAsset(`${outFilename}.map`, result.map, {type: "text/plain"});
        console.log(`[style.bundle] Generate ${outFilename}.map`);
      }
    }
  }
};

export default {
  configure,
  generate,
  process,
};
