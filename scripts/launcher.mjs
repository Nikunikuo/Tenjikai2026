import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.runtime');
const url = 'http://127.0.0.1:4319/';
async function health() {
  try {
    const response = await fetch(url + '__airloop/health', {
      signal: AbortSignal.timeout(800),
    });
    const state = await response.json();
    return state.app === 'air-loop' ? state : null;
  } catch {
    return null;
  }
}
try {
  if (process.argv.includes('--stop')) {
    const running = await health();
    if (!running) {
      console.log('AIR LOOP is not running.');
      process.exit(0);
    }
    const state = JSON.parse(
      fs.readFileSync(path.join(runtime, 'server.json'), 'utf8'),
    );
    if (state.pid !== running.pid)
      throw new Error(
        'Server identity mismatch; refusing to stop another process.',
      );
    const response = await fetch(url + '__airloop/stop', {
      method: 'POST',
      headers: { 'X-AirLoop-Token': state.token },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('Could not stop AIR LOOP.');
    console.log('AIR LOOP stopped.');
    process.exit(0);
  }
  if (!(await health())) {
    fs.mkdirSync(runtime, { recursive: true });
    const log = fs.openSync(path.join(runtime, 'server.log'), 'a');
    const child = spawn(
      process.execPath,
      [path.join(root, 'scripts', 'local-server.mjs')],
      {
        cwd: root,
        detached: true,
        windowsHide: true,
        stdio: ['ignore', log, log],
      },
    );
    child.unref();
    fs.closeSync(log);
    let ready = false;
    for (let i = 0; i < 30; i++) {
      if (await health()) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!ready)
      throw new Error(
        'AIR LOOP could not start. Check .runtime/server.log or whether port 4319 is in use.',
      );
  }
  console.log(`AIR LOOP: ${url}`);
  if (!process.argv.includes('--no-open')) {
    const browser = spawn(
      'rundll32.exe',
      ['url.dll,FileProtocolHandler', url],
      { detached: true, windowsHide: true, stdio: 'ignore' },
    );
    browser.unref();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
