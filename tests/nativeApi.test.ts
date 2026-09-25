import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

test('compiled serverless API starts in native Node ESM without the tsx resolver', async () => {
  const root = resolve('.qa');
  await mkdir(root, { recursive: true });
  const output = await mkdtemp(join(root, 'native-'));
  try {
    await build({ entryPoints: ['api/index.ts', 'lib/auth.ts', 'lib/geminiErrors.ts', 'lib/geminiChat.ts', 'lib/geminiModels.ts', 'lib/geminiReasoning.ts', 'lib/aiProviders.ts', 'lib/aiRoutes.ts'], outbase: '.', outdir: output, platform: 'node', format: 'esm', bundle: false });
    const url = pathToFileURL(join(output, 'api/index.js')).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const { default: app } = await import(${JSON.stringify(url)}); if (typeof app !== 'function') throw new Error('Missing Express handler'); console.log('API starts');`], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /API starts/);
  } finally {
    assert.ok(resolve(output).startsWith(root + '\\') || resolve(output).startsWith(root + '/'));
    await rm(output, { recursive: true, force: true });
  }
});
