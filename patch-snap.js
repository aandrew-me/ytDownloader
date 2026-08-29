const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'node_modules/app-builder-lib/out/targets/snap/coreLegacy.js');
if (fs.existsSync(file)) {
  const code = fs.readFileSync(file, 'utf8');
  const target = 'await this.stageSnapFiles({ stageDir, appOutDir, hooksDir, extraAppArgs, isTemplate: true });';
  const marker = '// @snap-desktop-scripts-patch';
  const fix = `${target}\n        ${marker}\n        const _path = require("path");\n        const _fs = require("fs/promises");\n        const _snapTemplateDir = require("../../util/pathManager").getTemplatePath("snap");\n        for (const _s of ["desktop-init.sh", "desktop-common.sh", "desktop-gnome-specific.sh"]) {\n            await _fs.copyFile(_path.join(_snapTemplateDir, _s), _path.join(stageDir, _s));\n            await _fs.chmod(_path.join(stageDir, _s), 0o755);\n        }`;

  if (!code.includes(marker) && code.includes(target)) {
    fs.writeFileSync(file, code.replace(target, fix), 'utf8');
    console.log('Successfully patched coreLegacy.js for snap build');
  }
}
