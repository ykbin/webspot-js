import { pathToFileURL } from 'node:url';

function makeCtlModuleUrl(pkg, name)
{
  return `${pkg}/control/${name}`;
}

async function makeStaticRegisterScript(module)
{
  const {PKG, CTLS} = module;

  let scriptContent = `import { ControlManager } from 'webnetq-js';\n\n`;
  for (const key in CTLS) {
    const ctlModuleUrl = makeCtlModuleUrl(PKG, key);
    scriptContent += `import { default as ${key} } from '${ctlModuleUrl}';\n`;
  };
  scriptContent += `\n`;

  scriptContent += `const manager = ControlManager.getInstance();\n\n`;

  for (const key in CTLS) {
    const ctlModuleUrl = makeCtlModuleUrl(PKG, key);
    const ctlModule = await import(ctlModuleUrl);
    for (const iter of ['NAME', 'ROOT_HTML', 'CSS', 'ROOT_CLASS']) {
      if (typeof ctlModule[iter] !== 'string') {
        throw `Can't find ${iter} for '${key}' control`;
      }
    }
    const ctlParams = {
      name: ctlModule.NAME,
      rootHTML: ctlModule.ROOT_HTML,
      rootCSS: ctlModule.CSS,
      rootClass: ctlModule.ROOT_CLASS,
    };
    if (ctlModule.PORT_CLASS) {
      ctlParams.portClass = ctlModule.PORT_CLASS;
    }
    scriptContent += `manager.register(${key}, ${JSON.stringify(ctlParams)})\n`;
  };
  scriptContent += `\n`;

  scriptContent += `export const PKG = '${PKG}';\n`;
  scriptContent += `export const CTLS = {\n`;
  for (const key in CTLS) {
    scriptContent += `  ${key},\n`;
  };
  scriptContent += `};\n`;

  return scriptContent;
}

export default function(source) {
  const resourceUrl = pathToFileURL(this.resourcePath);
  const callback = this.async();
	(async () => {
    const module = await import(resourceUrl);
		return await makeStaticRegisterScript(module);
	})().then((res) => callback(undefined, res), (err) => callback(err));
}
