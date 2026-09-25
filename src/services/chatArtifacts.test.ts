import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureRequestedChatArtifacts, extractChatArtifacts } from './chatArtifacts';

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

test('creates a DOCX fallback when a provider refuses a file request', () => {
  const parsed = ensureRequestedChatArtifacts(
    'Tạo cho tôi kế hoạch tuần sau ra file Google Docs',
    'Tôi không thể tạo trực tiếp file Google Docs hoặc tải file .docx lên máy của bạn do không có quyền truy cập ổ đĩa.\n\n# Kế hoạch tuần sau\n\n- Hoàn thành nghiệm thu',
  );
  assert.equal(parsed.artifacts.length, 1);
  assert.equal(parsed.artifacts[0].kind, 'docx');
  assert.equal(parsed.artifacts[0].content, '# Kế hoạch tuần sau\n\n- Hoàn thành nghiệm thu');
  assert.match(parsed.text, /Đã chuẩn bị Tài liệu Word/);
  assert.doesNotMatch(parsed.text, /không thể tạo/i);
});

test('does not add a file to ordinary chat answers', () => {
  const parsed = ensureRequestedChatArtifacts('Tóm tắt tiến độ dự án', 'Dự án đang đúng tiến độ.');
  assert.deepEqual(parsed.artifacts, []);
});
