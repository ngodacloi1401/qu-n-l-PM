import test from 'node:test';
import assert from 'node:assert/strict';
import { extractChatArtifacts } from './chatArtifacts';

test('extracts downloadable artifacts and removes machine metadata from the answer', () => {
  const response = `Tôi đã tạo kế hoạch tuần.\n<pm_artifacts>{"artifacts":[{"name":"ke-hoach","kind":"docx","title":"Kế hoạch tuần","content":"# Kế hoạch\\n\\n- Việc 1"},{"name":"du-lieu.xlsx","kind":"xlsx","content":"{\\"sheets\\":[{\\"name\\":\\"Data\\",\\"headers\\":[\\"ID\\"],\\"rows\\":[[1]]}]}"}]}</pm_artifacts>`;
  const parsed = extractChatArtifacts(response);
  assert.equal(parsed.text, 'Tôi đã tạo kế hoạch tuần.');
  assert.equal(parsed.artifacts.length, 2);
  assert.equal(parsed.artifacts[0].name, 'ke-hoach.docx');
  assert.equal(parsed.artifacts[1].kind, 'xlsx');
});

test('ignores unsupported or malformed artifact blocks without exposing metadata', () => {
  const parsed = extractChatArtifacts('Xong.\n<pm_artifacts>{bad json}</pm_artifacts>');
  assert.equal(parsed.text, 'Xong.');
  assert.deepEqual(parsed.artifacts, []);
});
