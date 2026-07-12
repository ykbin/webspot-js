import path from "node:path";
import fs from "node:fs";
import url from 'node:url';
import jsdom from "jsdom";
import webpack from 'webpack';

import { copyFileIfDifferent, fileExists } from './Lib.mjs';
import styleModule from './StyleModule.mjs';
import scriptModule from './ScriptModule.mjs';

const { JSDOM } = jsdom;

function getOptions(params) {
  const defaultOptions = {
    hasMeta: true,
  };
  return Object.assign(defaultOptions, params);
}

async function makeResObject({resource, baseUrl, sourceDir, binaryDir, addAsset}) {
  if (typeof resource !== "string")
    return null;

  const filename = path.basename(resource);
  const href = path.posix.join(baseUrl, filename);

  const input = path.resolve(sourceDir, resource);
  const output = path.resolve(binaryDir, filename);

  addAsset(filename);
  if (await copyFileIfDifferent(input, output))
    console.log(`[dom.configure] Copy ${resource}`);
  
  return { input, output, href };
}

async function configure({dom, baseUrl, sourceDir, binaryDir, addAsset}) {
  if (!dom) return;
  for (const [ name, params ] of Object.entries(dom.targets || {})) {
    params.output = params.output || {};
    params.output.filename = params.output.filename || `${name}.html`;
    params.favicon = await makeResObject({resource: params.favicon || (dom.options && dom.options.favicon), baseUrl, sourceDir, binaryDir, addAsset});
    params.shortcut = {
      light: await makeResObject({
        resource: (params.shortcut && params.shortcut.light) || (dom.options && dom.options.shortcut && dom.options.shortcut.light),
        baseUrl, sourceDir, binaryDir, addAsset
      }),
      dark: await makeResObject({
        resource: (params.shortcut && params.shortcut.dark) || (dom.options && dom.options.shortcut && dom.options.shortcut.dark),
        baseUrl, sourceDir, binaryDir, addAsset
      }),
    };

    if (params.style || (dom.options && dom.options.style)) {
      const globalStyle = (dom.options && dom.options.style) ? dom.options.style : {};
      const localStyle = (typeof params.style === 'string') ? { entry: params.style } : (params.style || {});
      params.style = Object.assign({}, globalStyle, localStyle);
    }

    if (params.bootScript || (dom.options && dom.options.bootScript)) {
      const globalScript = (dom.options && dom.options.bootScript) ? ((typeof dom.options.bootScript === 'string') ? { entry: dom.options.bootScript } : (dom.options.bootScript || {})) : {};
      const localScript = (typeof params.bootScript === 'string') ? { entry: params.bootScript } : (params.bootScript || {});
      params.bootScript = Object.assign({}, globalScript, localScript);
    }

    if (params.script || (dom.options && dom.options.script)) {
      const globalScript = (dom.options && dom.options.script) ? ((typeof dom.options.script === 'string') ? { entry: dom.options.script } : (dom.options.script || {})) : {};
      const localScript = (typeof params.script === 'string') ? { entry: params.script } : (params.script || {});
      params.script = Object.assign({}, globalScript, localScript);
    }

    if (params.control || (dom.options && dom.options.control)) {
      const globalScript = (dom.options && dom.options.control) ? ((typeof dom.options.control === 'string') ? { entry: dom.options.control } : (dom.options.control || {})) : {};
      const localScript = (typeof params.control === 'string') ? { entry: params.control } : (params.control || {});
      params.control = Object.assign({}, globalScript, localScript);
    }
  }
}

function getDarkLightFileList(params)
{
  if (typeof params === 'object') {
    if (params.length == 1) {
      return [ params[0], params[0] ];
    }
    if (params.length >= 2) {
      return [ params[0], params[1] ];
    }
  }
  else if (typeof params === 'string') {
    return [ params, params ];
  }
  return [];
}

async function buildPackage(configName, isDebug, outputPath) {
  console.log(`[control.bundle] Generate ${configName}...`);
  const configPath = import.meta.resolve(configName);

  const module = await import(configPath);
  let configObj = module.default({}, {
    mode: isDebug ? "development" : "production",
    outputPath,
  });
  if (configObj instanceof Promise)
    configObj = await configObj;

  configObj.context = path.dirname(url.fileURLToPath(configPath));
  configObj.resolve = configObj.resolve || {};
  configObj.resolve.modules = configObj.resolve.modules || [];
  configObj.resolve.modules.push(path.join(process.cwd(), 'node_modules'));

  const compiler = webpack(configObj);
  await new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (!err && stats.hasErrors()) {
        switch (stats.compilation.errors.length) {
        case 0: err = stats; break;
        case 1: err = stats.compilation.errors[0]; break;
        default: err = stats.compilation.errors; break;
        }
      }
      err ? reject(err) : resolve(stats);
    });
  });
  console.log(`[control.bundle] Generate ${configName}... done`);
}

function doctypeToString(doctype) {
  if (!doctype) return "";
  let str = `<!DOCTYPE ${doctype.name}`;
  if (doctype.publicId)
    str += ` PUBLIC "${doctype.publicId}"`;
  if (doctype.systemId)
    str += doctype.publicId ? ` "${doctype.systemId}"` : ` SYSTEM "${doctype.systemId}"`;
  str += ">";
  return str;
}

async function getControlParams(element) {
  const result = {};
  const params = element.getAttribute("params") || "";
  for (const iter of params.split(";")) {
    if (!iter) continue;
    const index = iter.indexOf(":");
    const key = (index !== -1) ? iter.substring(0, index) : iter;
    const val = (index !== -1) ? iter.substring(index + 1) : "";
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey.trim()] = val.trim();
  }

  return result;
}

async function webpackBuild(config) {
  const compiler = webpack(config);

  const stats = await new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) reject(err);
      else if (stats.hasErrors()) reject(new Error(stats.toString()));
      else resolve(stats);
    });
  });

  await new Promise((resolve) => compiler.close(resolve));
  return stats;
}

async function generate(context) {
  const {dom, baseUrl, isDebug, sourceDir, binaryDir, writeAsset, addAsset, setApplication} = context;

  if (!dom) return;

  const lookupTemplate = (pkg, name) => {
    return undefined;
  };

  const lookupObjectImpl = async (pkg, name, type, cache) => {
    let pkgObj = cache[pkg];
    if (!pkgObj)
      cache[pkg] = pkgObj = {};

    let docObj = pkgObj[name];
    if (docObj)
      return docObj;

    const modulePath = `${pkg}/${type}/${name}`;
    const docUrl = import.meta.resolve(modulePath);
    if (!await fileExists(url.fileURLToPath(docUrl))) {
      const configModule = await import(`${pkg}/webpack.config.mjs`);

      const argv = { env: {}, [ `config_${type}` ]: name };
      if (isDebug) {
        process.env.WEBMAKE_BUILD_TYPE = 'Debug';
        argv.mode = "development";
      }

      const config = await configModule.default(argv.env, argv);
      config.output.clean = false;
      const stats = await webpackBuild(config);
      console.log("--------------------------------------------------------------------------------");
      console.log(`[${type}] build ${modulePath}`);
      console.log(stats.toString({ colors: true }));
    }

    const module = await import(modulePath);
    if (!module[name])
      throw new Error(`Export ${name} not exists in ${modulePath}`);
    pkgObj[name] = docObj = module[name];
    return docObj;
  };

  const documents = {};
  const lookupDocument = async (pkg, name) => {
    return lookupObjectImpl(pkg, name, "document", documents);
  };

  const controls = {};
  const lookupControl = async (pkg, name) => {
    return lookupObjectImpl(pkg, name, "control", controls);
  };

  for (const [ name, params ] of Object.entries(dom.targets || {})) {
    const parameters = getOptions(params);
    const staticControlFile = parameters.control && parameters.control.basic && path.resolve(sourceDir, parameters.control.basic) || null;
    const { entry, alias, title, description, hasMeta, output, style, script, bootScript } = parameters;
    const inFilename = path.resolve(sourceDir, entry);

    const cssFilename = `${name}.bundle.css`;
    const cssOptionList = [];

    const jsBootFilename = `${name}.boot.js`;
    const jsBundleFilename = `${name}.bundle.js`;

    let fileContent = fs.readFileSync(inFilename, 'utf8').toString();
    fileContent = fileContent.replace(/^\uFEFF/, '');

    let dom = new JSDOM(fileContent);

    let pkgDefault = null;
    const cssMap = {};

    {
      const templateElm = dom.window.document.createElement('template');
      templateElm.innerHTML = fileContent;
      if (templateElm.content.childElementCount == 1) {
        const rootElm = templateElm.content.firstElementChild;
        if (rootElm.tagName.toLowerCase() === 'webdocument') {
          const pkg = rootElm.getAttribute("pkg");
          const name = rootElm.getAttribute("name");
          const pkgMainUrl = import.meta.resolve(pkg);
          const pkgMainDir = path.posix.dirname(pkgMainUrl);
          const docUrl = path.posix.join(pkgMainDir, 'document', name, 'index.mjs');
          const workDir = path.dirname(url.fileURLToPath(docUrl));

          const ctlBundleModule = lookupTemplate(pkg, name);
          const controlBundle = await lookupDocument(pkg, name);
          if (!ctlBundleModule && !controlBundle)
            throw new Error(`Document ${name} not exists in ${pkg}`);
          if (!controlBundle.createDocument)
            throw new Error(`No function createDocument declared in ${pkg}/${name}`);
          const newDocument = controlBundle.createDocument(dom.window.document, await getControlParams(rootElm));
          const id = rootElm.getAttribute("id");
          if (id)
            newDocument.id = id;
          const HTML = doctypeToString(newDocument.doctype) + newDocument.documentElement.outerHTML;
          if (typeof HTML !== 'string') {
            console.log('doc module:', ctlBundleModule);
            throw `Not exists ROOT_HTML for ${name}`;
          }

          const innerHTML = rootElm.innerHTML;
          dom = new JSDOM(HTML);

          const portClass = controlBundle?.classList?.PORT_CLASS || ctlBundleModule?.PORT_CLASS;
          if (portClass) {
            const documentElement = dom.window.document.documentElement;
            const portElm = documentElement.classList.contains(portClass) ? documentElement : documentElement.querySelector(`.${portClass}`);
            if (!portElm) {
              throw `Cannot find port documentElement with ${portClass} classname of ${name}`
            }
            portElm.innerHTML = innerHTML;
          }

          let cssText = ctlBundleModule?.CSS;
          if (controlBundle?.initRules) {
            const styleSheet = new dom.window.CSSStyleSheet;
            controlBundle.initRules(styleSheet);
            for (const rule of styleSheet.cssRules) {
              cssText = cssText ? cssText + "\n" + rule.cssText : rule.cssText;
            }
          }
          if (cssText) {
            cssOptionList.push({
              from: 'index.css',
              to: cssFilename,
              prop: null,
              isDebug,
              workDir,
              isInlineSvg: true,
              content: cssText,
            });
          }

          pkgDefault = pkg;
        }
      }
    }

    const document = dom.window.document;
    // boot
    let bootScriptString = null;
    if (bootScript) {
      await scriptModule.processScript({
        from: bootScript.entry,
        to: jsBootFilename,
        isDebug: false,
        workDir: sourceDir,
        binaryDir,
        addAsset: null,
        staticControlFile: null,
      });
      bootScriptString = await fs.promises.readFile(path.resolve(binaryDir, jsBootFilename), "utf8");
    }
    // head
    const headFrg = document.createDocumentFragment();
    {

      if (isDebug) {
        const comment = document.createComment(`Genrated from '${entry}'`);
        headFrg.appendChild(comment);
      }

      if (hasMeta) {
        const metaElm = document.createElement('meta');
        metaElm.setAttribute("http-equiv", "Content-Type");
        metaElm.setAttribute("content", "text/html; charset=utf-8");
        headFrg.appendChild(metaElm);  
      }

      if (description) {
        const metaElm = document.createElement('meta');
        metaElm.setAttribute("name", "description");
        metaElm.setAttribute("content", description);
        headFrg.appendChild(metaElm);  
      }

      if (!document.head.querySelector("title")) {
        const titleStr = (title || path.parse(entry).name) + (isDebug ? " (Debug)" : "");
        const titleElm = document.createElement('title');
        titleElm.setAttribute("class", "notranslate");
        titleElm.setAttribute("translate", "no");
        titleElm.textContent = titleStr;
        headFrg.appendChild(titleElm);
      }

      if (params.favicon) {
        const linkElm = document.createElement('link');
        linkElm.setAttribute("rel", "icon");
        linkElm.setAttribute("href", params.favicon.href);
        linkElm.setAttribute("sizes", "any");
        headFrg.appendChild(linkElm);
      }

      const addShortcutLink = (obj, scheme) => {
        if (obj) {
          const linkElm = document.createElement('link');
          linkElm.setAttribute("rel", "shortcut icon");
          linkElm.setAttribute("href", obj.href);
          linkElm.setAttribute("type", "image/x-icon");
          linkElm.setAttribute("media", `(prefers-color-scheme: ${scheme})`);
          headFrg.appendChild(linkElm);
        }
      };

      addShortcutLink(params.shortcut.light, 'light');
      addShortcutLink(params.shortcut.dark, 'dark');

      if (bootScriptString) {
        const scriptElm = document.createElement('script');
        scriptElm.setAttribute("type", "text/javascript");
        scriptElm.textContent = bootScriptString;
        headFrg.appendChild(scriptElm);
      }

      if (style) {
        cssOptionList.push({
          from: style.entry,
          to: cssFilename,
          prop: style.prop,
          isDebug,
          workDir: sourceDir,
          isInlineSvg: false,
        });
      }

      if (script) {
        const scriptElm = document.createElement('script');
        scriptElm.setAttribute("defer", "defer");
        scriptElm.setAttribute("src", path.posix.join(baseUrl, jsBundleFilename));
        headFrg.appendChild(scriptElm);
      }
    }

    // html controls
    {
      const templateElm = document.createElement('template');

      const replaceWebctl = async (element) => {
        for await (const iter of Array.from(element.children)) {
          await replaceWebctl(iter);
        }

        if (element.tagName.toLowerCase() === "webctl") {
          const pkg = element.getAttribute("pkg") || pkgDefault;
          cssMap[pkg] = cssMap[pkg] || {};
          const name = element.getAttribute("ctl");
          if (!name)
            throw `Cannot find attribute 'ctl' in webctl`;

          let mode = element.getAttribute("mode");
          mode = mode ? mode.split(",").map(i => i.toLowerCase()) : [ "debug", "release" ];
          if (mode.includes(isDebug ? "debug" : "release")) {
            const pkgMainUrl = import.meta.resolve(pkg);
            const pkgMainDir = url.fileURLToPath(path.posix.dirname(pkgMainUrl));
            let ctlFile = path.join(pkgMainDir, name, 'index.mjs');
            if (!fs.existsSync(ctlFile)) {
              ctlFile = path.join(pkgMainDir, 'control', name, 'index.mjs');
            }
            const workDir = path.dirname(ctlFile);

            const ctlBundleModule = lookupTemplate(pkg, name);
            const controlBundle = await lookupControl(pkg, name);
            if (!ctlBundleModule && !controlBundle)
              throw new Error(`Control ${name} not exists in ${pkg}`);
            if (!controlBundle.createElement)
              throw new Error(`No function createElement declared in ${pkg}/${name}`);
            const newElement = controlBundle.createElement(dom.window.document, await getControlParams(element));
            if (!newElement) {
              throw new Error(`HTML is broken for ${pkg}/${name}`);
            }
            const id = element.getAttribute("id");
            if (id)
              newElement.id = id;

            let portClass = controlBundle?.classList?.PORT_CLASS || ctlBundleModule?.PORT_CLASS;
            if (portClass) {
              const portElm = newElement.classList.contains(portClass) ? newElement : newElement.querySelector(`.${portClass}`);
              if (!portElm) {
                throw `Cannot find port element with ${portClass} classname of ${name}`
              }
              while (element.firstChild) {
                const child = element.removeChild(element.firstChild);
                portElm.appendChild(child);
              }
            }

            element.replaceWith(newElement);

            if (!cssMap[pkg][name]) {
              let cssText = ctlBundleModule?.CSS;
              const controlBundle = await lookupControl(pkg, name);
              if (controlBundle.initRules) {
                const styleSheet = new dom.window.CSSStyleSheet;
                controlBundle.initRules(styleSheet);
                for (const rule of styleSheet.cssRules) {
                  cssText = cssText ? cssText + "\n" + rule.cssText : rule.cssText;
                }
              }
              if (cssText) {
                cssOptionList.push({
                  from: 'index.css',
                  to: cssFilename,
                  prop: null,
                  isDebug,
                  workDir,
                  isInlineSvg: true,
                  content: cssText,
                });
              }
              cssMap[pkg][name] = true;
            }

          }
          else {
            element.remove();
          }
        }
      }

      await replaceWebctl(document.documentElement);
    }

    if (staticControlFile) {
      const module = await import(url.pathToFileURL(staticControlFile));
      const pkg = module.PKG
      cssMap[pkg] = cssMap[pkg] || {};
      for (const name in module.CTLS) {
        const pkgMainUrl = import.meta.resolve(pkg);
        const pkgMainDir = url.fileURLToPath(path.posix.dirname(pkgMainUrl));
        let ctlFile = path.join(pkgMainDir, 'control', name, 'index.mjs');
        const workDir = path.dirname(ctlFile);
  
        if (!cssMap[pkg][name]) {
            const ctlBundleModule = lookupTemplate(pkg, name);
            let cssText = ctlBundleModule?.CSS;
            const controlBundle = await lookupControl(pkg, name);
            if (controlBundle.initRules) {
              const styleSheet = new dom.window.CSSStyleSheet;
              controlBundle.initRules(styleSheet);
              for (const rule of styleSheet.cssRules) {
                cssText = cssText ? cssText + "\n" + rule.cssText : rule.cssText;
              }
            }
          if (cssText) {
            cssOptionList.push({
              from: 'index.css',
              to: cssFilename,
              prop: null,
              isDebug,
              workDir,
              isInlineSvg: true,
              content: cssText,
            });
          }
          cssMap[pkg][name] = true;
        }

      }
    }

    const cssResult = [];
    for (const options of cssOptionList) {
      const cssText = await styleModule.process(options);
      cssResult.push(cssText);
    }

    if (cssResult.length) {
      await writeAsset(cssFilename, cssResult.join(""), {type: "text/css"});
      console.log(`[style.bundle] Generate ${cssFilename}`);
    }

    if (script) {
      await scriptModule.processScript({
        from: script.entry,
        to: jsBundleFilename,
        isDebug,
        workDir: sourceDir,
        binaryDir,
        addAsset,
        staticControlFile,
      });
    }

    if (cssResult.length) {
      const linkElm = document.createElement("link");
      linkElm.setAttribute("rel", "stylesheet");
      linkElm.setAttribute("type", "text/css");
      linkElm.setAttribute("href", path.posix.join(baseUrl, cssFilename));
      headFrg.appendChild(linkElm);
    }

    document.head.insertBefore(headFrg, document.head.firstChild);

    let options = {
      type: "text/html",
    };

    const toUrlString = (pathStr) => {
      return pathStr.startsWith("/") ? pathStr : path.posix.join(baseUrl, pathStr);
    }

    if (typeof alias === "string")
      options.alias = [ toUrlString(alias) ];
    else if (alias) {
      options.alias = [];
      for (const iter of alias) {
        options.alias.push(toUrlString(iter));
      }
    }

    if (params.application) {
      const application = {
        title,
        main: output.filename, // DELME: options.alias ? options.alias[0] : output.filename,
        description,
      };

      const addAppImage = async (pathStr) => {
        const filename = path.basename(pathStr);

        const inFilename = path.resolve(sourceDir, pathStr);
        const outFilename = path.resolve(binaryDir, filename);
  
        addAsset(filename);
        if (await copyFileIfDifferent(inFilename, outFilename))
          console.log(`[dom.configure] Copy ${filename}`);

        return filename;
      }

      if (params.application.icon) {
        application.icon = [];
        for (const iter of getDarkLightFileList(params.application.icon)) {
          application.icon.push(await addAppImage(iter));
        }
      }

      if (params.application.logo) {
        application.logo = [];
        for (const iter of getDarkLightFileList(params.application.logo)) {
          application.logo.push(await addAppImage(iter));
        }
      }

      setApplication(application);
    }

    const html = dom.serialize();
    await writeAsset(output.filename, html, options);
    console.log(`[dom.bundle] Generate ${output.filename}`);
  }
};

export default {
  configure,
  generate,
};
