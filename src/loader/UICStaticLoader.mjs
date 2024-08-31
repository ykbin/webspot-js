import { pathToFileURL } from 'node:url';

async function makeStaticRegisterScript(module)
{
  const {PKG, CTLS} = module;

  let scriptContent = `import { ControlManager } from 'webnetq-js';\n\n`;
  for (const name in CTLS) {
    scriptContent += `import { default as ${name} } from '${PKG}/control/${name}';\n`;
  };
  scriptContent += `\n`;

  scriptContent += `const manager = ControlManager.getInstance();\n\n`;

  for (const name in CTLS) {
    let ctlModule = await import(`${PKG}/control/${name}/template`);
    if (ctlModule.buildComponent instanceof Promise)
      ctlModule = await ctlModule.buildComponent();
    else if (typeof ctlModule.buildComponent === 'function')
      ctlModule = ctlModule.buildComponent();
    for (const iter of ['ROOT_HTML', 'CSS', 'ROOT_CLASS']) {
      if (!(iter in ctlModule)) {
        throw `Can't find ${iter} for '${name}' control`;
      }
      if (typeof ctlModule[iter] !== 'string') {
        console.info(`${iter}:`, ctlModule[iter]);
        throw `Class ${iter} isn't string of '${name}' control`;
      }
    }
    const ctlParams = {
      name,
      rootHTML: ctlModule.ROOT_HTML,
      // rootCSS: ctlModule.CSS,
      rootClass: ctlModule.ROOT_CLASS,
    };
    if (typeof ctlModule.PORT_CLASS === 'string') {
      ctlParams.portClass = ctlModule.PORT_CLASS;
    }
    else if (typeof ctlModule.PORT_CLASS !== 'undefined') {
      throw `Wrong type of 'PORT_CLASS' for '${name}' control`;
    }
    scriptContent += `manager.register(${name}, ${JSON.stringify(ctlParams)});\n`;
  };
  scriptContent += `\n`;

  scriptContent += `export const PKG = '${PKG}';\n`;
  scriptContent += `export const CTLS = {\n`;
  for (const name in CTLS) {
    scriptContent += `  ${name},\n`;
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
