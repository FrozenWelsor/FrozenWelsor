import { fileURLToPath } from 'node:url';
import { renderProject } from '../src/project.mjs';

try {
  await renderProject(fileURLToPath(new URL('../', import.meta.url)));
  console.log('README и 6 SVG обновлены из локальных данных.');
} catch (error) {
  console.error(`Рендер не выполнен: ${error.message}`);
  process.exitCode = 1;
}
