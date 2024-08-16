/* eslint-disable */
/* eslint-enable semi, indent */
"use strict";

const fs = require('fs');
const path = require('path');


const buildDir = path.resolve(process.cwd(), 'dist');

async function recursiveRemoveDirectoryFiles(dir) {
  if(!fs.existsSync(dir)) return;

  for(const filename of (await fs.promises.readdir(dir))) {
    const stats = await fs.promises.stat(path.join(dir, filename));

    if(stats.isDirectory()) {
      await recursiveRemoveDirectoryFiles(path.join(dir, filename));
    } else {
      await fs.promises.unlink(path.join(dir, filename));
    }
  }

  await fs.promises.rmdir(dir);
}


async function _recursiveCopy(source, dest) {
  if(!fs.existsSync(dest)) {
    await fs.promises.mkdir(dest, { mode: 0o755 });
  }

  for(const item of await fs.promises.readdir(source)) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(dest, item);
    const stats = await fs.promises.stat(sourcePath);

    if(stats.isDirectory()) {
      await _recursiveCopy(sourcePath, destPath);
    } else {
      await fs.promises.copyFile(sourcePath, destPath);
    }
  }
}

const buildNamespacesDir = path.join(buildDir, '_extern', 'namespaces');

async function main() {
  let exclude = [];

  for(let i = 0; i < process.argv.length; i++) {
    if(process.argv[i] === '--ignore' || process.argv[i] === '-i') {
      exclude = process.argv[i + 1]?.split(',').map(item => item.trim()) || [];
    }
  }

  for(const folderName of (await fs.promises.readdir(buildNamespacesDir))) {
    if(exclude.includes(folderName)) continue;

    await _recursiveCopy(path.join(buildNamespacesDir, folderName),
      path.join(process.cwd(), '_htmlnamespaces', folderName));
  }

  await recursiveRemoveDirectoryFiles(path.join(process.cwd(), 'dist'));
}

main().then();