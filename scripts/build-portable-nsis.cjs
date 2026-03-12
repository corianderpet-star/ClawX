/**
 * build-portable-nsis.cjs
 *
 * Convenience wrapper that runs `pnpm run package:win` with the
 * PORTABLE_BUILD=1 environment variable, producing an NSIS installer
 * that ships with the .portable marker — the resulting installation
 * starts in portable mode immediately.
 */
const { execSync } = require('child_process');

process.env.PORTABLE_BUILD = '1';

console.log('[build-portable-nsis] Building NSIS installer in portable mode...');
console.log(
  '[build-portable-nsis] PORTABLE_BUILD=1 is set — afterPack will inject .portable marker\n'
);

try {
  execSync('pnpm run package:win', {
    stdio: 'inherit',
    env: process.env,
    cwd: require('path').join(__dirname, '..'),
  });
} catch (err) {
  process.exit(err.status || 1);
}
