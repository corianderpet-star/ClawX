/**
 * portable-post-build.cjs
 *
 * Runs after `electron-builder --win dir` to finalize the portable edition:
 *   1. Places a `.portable` marker file in the output directory so the app
 *      auto-detects portable mode on next launch.
 *   2. Creates an empty `LocalData` folder structure so the user sees the
 *      expected directory layout immediately.
 *   3. Writes a small README-portable.txt with usage instructions.
 */

const { existsSync, mkdirSync, writeFileSync, readdirSync } = require('fs');
const { join } = require('path');

// Locate the win-unpacked output directory (electron-builder default)
const releaseDir = join(__dirname, '..', 'release');

function findAllWinUnpackedDirs() {
  if (!existsSync(releaseDir)) return [];
  const entries = readdirSync(releaseDir);
  const dirs = [];
  for (const name of entries) {
    if (name.match(/^win.*-unpacked$/)) {
      dirs.push(join(releaseDir, name));
    }
  }
  return dirs;
}

const outDirs = findAllWinUnpackedDirs();
if (outDirs.length === 0) {
  console.error('[portable-post-build] Could not find win-*-unpacked directory in release/');
  process.exit(1);
}

for (const outDir of outDirs) {
  console.log(`[portable-post-build] Finalizing portable edition in: ${outDir}`);

  // 1. .portable marker
  const markerPath = join(outDir, '.portable');
  writeFileSync(markerPath, 'ClawPlus portable mode marker\nCreated by build script.\n', 'utf-8');
  console.log('  ✓ .portable marker created');

  // 2. Pre-create LocalData directories
  const localData = join(outDir, 'LocalData');
  const subDirs = [
    join(localData, 'electron-userData'),
    join(localData, '.openclaw'),
    join(localData, '.clawx'),
    join(localData, 'logs'),
    join(localData, 'secrets'),
  ];
  for (const dir of subDirs) {
    mkdirSync(dir, { recursive: true });
  }
  console.log('  ✓ LocalData directory structure created');

  // 3. README
  const readmeContent = `=== ClawPlus Portable Edition ===

使用说明 / Usage:
  1. 将整个文件夹复制到 U 盘或任意位置
     Copy this entire folder to a USB drive or any location.

  2. 运行 ClawPlus.exe 即可使用
     Run ClawPlus.exe to start the app.

  3. 所有数据（配置、日志、缓存）自动保存在 LocalData/ 目录下
     All data (settings, logs, cache) is stored in the LocalData/ folder.

  4. 切换电脑时只需拔出 U 盘并在新电脑上运行，数据跟着走
     When switching computers, simply plug in the USB drive and run again.
     Your data travels with you.

技术说明 / Technical Notes:
  - 便携模式通过检测 .portable 标记文件自动激活
    Portable mode is auto-detected via the .portable marker file.
  - 删除 .portable 文件将回退到标准安装模式
    Removing the .portable file reverts to standard (installed) mode.
  - 也可以设置环境变量 CLAWPLUS_PORTABLE=1 强制启用便携模式
    You can also set CLAWPLUS_PORTABLE=1 to force portable mode.
`;

  writeFileSync(join(outDir, 'README-portable.txt'), readmeContent, 'utf-8');
  console.log('  ✓ README-portable.txt created');

  console.log(`[portable-post-build] ✅ Done: ${outDir}`);
} // end for outDirs

console.log('[portable-post-build] All done!');
