import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { emitKeypressEvents } from 'node:readline';
import { stdin, stderr, stdout } from 'node:process';

const ITERATIONS = 200000;

function readHiddenInput() {
  return new Promise((resolve, reject) => {
    let value = '';
    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdout.write('Review password: ');

    const onKeypress = (character, key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Cancelled'));
      } else if (key.name === 'return') {
        cleanup();
        stdout.write('\n');
        resolve(value);
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (!key.ctrl && !key.meta && character) {
        value += character;
      }
    };

    const cleanup = () => {
      stdin.off('keypress', onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdin.on('keypress', onKeypress);
  });
}

try {
  const password = await readHiddenInput();
  const salt = randomBytes(16);
  const verifier = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');

  stdout.write(`Salt: ${salt.toString('base64')}\n`);
  stdout.write(`Iterations: ${ITERATIONS}\n`);
  stdout.write(`Verifier: ${verifier.toString('base64')}\n`);
} catch (error) {
  if (error.message !== 'Cancelled') {
    stderr.write('Unable to generate verifier.\n');
  }
  process.exitCode = 1;
}