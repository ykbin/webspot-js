import fs from "node:fs";
import path from "node:path";

export async function copyFileIfDifferent(filepath, {sourceDir, binaryDir, useBasename}) {
  const inFilename = path.resolve(sourceDir, filepath);

  const relFilename = useBasename ? path.basename(filepath) : filepath;
  const outFilename = path.resolve(binaryDir, relFilename);

  const inStats = await fs.promises.stat(inFilename);

  let outStats = null;
  try { outStats = await fs.promises.stat(outFilename); } catch (e) { }
  if (outStats === null || inStats.mtime.getTime() !== outStats.mtime.getTime()) {
    console.log(`[configure] Copy ${filepath}`);
    await fs.promises.cp(inFilename, outFilename, {recursive: true});
    await fs.promises.utimes(outFilename, inStats.atime, inStats.mtime);
  }
}

export async function copyParamsIfDifferent(params, {sourceDir, binaryDir, useBasename}) {
  if (params) {
    const sources = [];

    if (Array.isArray(params))
      sources.push(...params);
    else if (typeof params === "object")
      sources.push(...Object.values(params));
    else if (typeof params === "string")
      sources.push(params);
    else
      throw "Not support params type";

    for (const i in sources) {
      await copyFileIfDifferent(sources[i], {sourceDir, binaryDir, useBasename});
    }
  }
}
