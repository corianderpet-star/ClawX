/**
 * portable-build-driver.cjs
 *
 * Orchestrates the portable build to avoid VS Code file-lock issues:
 *   1. Picks an output directory outside the workspace (TEMP) so VS Code
 *      cannot lock the .asar file.
 *   2. Runs `electron-builder --win dir` targeting that directory.
 *   3. Runs `portable-post-build.cjs` to finalize the portable edition.
 *   4. Copies the result back into the workspace under `release-portable/`.
 */

const { execSync } = require('child_process');
const { existsSync, mkdirSync, rmSync, cpSync } = require('fs');
const { join } = require('path');
const os = require('os');

const projectRoot = join(__dirname, '..');

// 1. Determine the build output directory
//    Use system TEMP to avoid VS Code watcher / file locking.
const tempBase = join(os.tmpdir(), 'clawplus-portable-build');
if (existsSync(tempBase)) {
  console.log(`[portable-build] Cleaning previous temp build: ${tempBase}`);
  rmSync(tempBase, { recursive: true, force: true });
}
mkdirSync(tempBase, { recursive: true });
console.log(`[portable-build] Output dir: ${tempBase}`);

// 2. Run electron-builder
const ebCmd = `npx electron-builder --win dir --config.directories.output="${tempBase}"`;
console.log(`[portable-build] Running: ${ebCmd}`);
try {
  execSync(ebCmd, { cwd: projectRoot, stdio: 'inherit', env: process.env });
} catch (e) {
  console.error('[portable-build] electron-builder failed');
  process.exit(1);
}

// 3. Run portable-post-build.cjs
console.log('[portable-build] Running portable-post-build...');
try {
  execSync(`node scripts/portable-post-build.cjs`, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, PORTABLE_RELEASE_DIR: tempBase },
  });
} catch (e) {
  console.error('[portable-build] portable-post-build failed');
  process.exit(1);
}

// 4. Copy back to workspace
const finalDir = join(projectRoot, 'release-portable');

// Remove old release-portable if it exists (best-effort; may fail if locked)
if (existsSync(finalDir)) {
  console.log(`[portable-build] Removing old ${finalDir}`);
  try {
    rmSync(finalDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[portable-build] Could not remove old release-portable: ${err.message}`);
    console.warn('[portable-build] The new build is available at:', tempBase);
    console.log(`\n✅ Portable build ready at: ${tempBase}\\win-unpacked`);
    process.exit(0);
  }
}

console.log(`[portable-build] Copying to ${finalDir} ...`);
cpSync(tempBase, finalDir, { recursive: true });
console.log(`\n✅ Portable build ready at: ${join(finalDir, 'win-unpacked')}`);

// Cleanup temp
try {
  rmSync(tempBase, { recursive: true, force: true });
} catch {
  // ignore
}
