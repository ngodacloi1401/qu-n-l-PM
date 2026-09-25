import { detectRequestedArtifactKind, type ChatArtifact, type ChatArtifactKind } from './aiPayload';

const EXTENSIONS: ChatArtifactKind[] = ['docx', 'xlsx', 'csv', 'md', 'txt', 'json'];
const ARTIFACT_PATTERN = /<pm_artifacts>\s*([\s\S]*?)\s*<\/pm_artifacts>/gi;

const safeName = (value: unknown, kind: ChatArtifactKind, index: number) => {
  const fallback = `tep-ai-${index + 1}.${kind}`;
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim().slice(0, 120);
  if (!cleaned) return fallback;
  return cleaned.toLowerCase().endsWith(`.${kind}`) ? cleaned : `${cleaned}.${kind}`;
};

export function extractChatArtifacts(source: string): { text: string; artifacts: ChatArtifact[] } {
  const artifacts: ChatArtifact[] = [];
  const text = source.replace(ARTIFACT_PATTERN, (_match, json: string) => {
    try {
      const value = JSON.parse(json);
      const rows = Array.isArray(value?.artifacts) ? value.artifacts : [];
      for (const row of rows.slice(0, 5 - artifacts.length)) {
        if (!EXTENSIONS.includes(row?.kind) || typeof row?.content !== 'string' || !row.content.trim()) continue;
        const kind = row.kind as ChatArtifactKind;
        artifacts.push({
          id: crypto.randomUUID(),
          name: safeName(row.name, kind, artifacts.length),
          kind,
          title: typeof row.title === 'string' ? row.title.trim().slice(0, 160) : undefined,
          content: row.content.slice(0, 500_000),
        });
      }
    } catch {
      // Keep the answer readable even if a provider emits malformed artifact metadata.
    }
    return '';
  }).trim();
  return { text: text || (artifacts.length ? 'Đã tạo tệp theo yêu cầu.' : source.trim()), artifacts };
}

const refusalPattern = /(kh[oô]ng th[eể].*(t[aạ]o|xu[aấ]t).*(file|t[eệ]p|google docs?|docx)|kh[oô]ng c[oó] quy[eề]n truy c[aậ]p.*(google drive|[oổ] [dđ][iĩ]a)|ch[iỉ] tr[aả] l[oờ]i b[aằ]ng v[aă]n b[aả]n|cannot|can't).*/i;

function removeFileRefusal(text: string) {
  const paragraphs = text.split(/\n\s*\n/);
  const useful = paragraphs.filter(paragraph => !refusalPattern.test(paragraph.trim())).join('\n\n').trim();
  return useful || text.trim();
}

export function ensureRequestedChatArtifacts(userText: string, response: string): { text: string; artifacts: ChatArtifact[] } {
  const parsed = extractChatArtifacts(response);
  if (parsed.artifacts.length) return parsed;
  const kind = detectRequestedArtifactKind(userText);
  if (!kind) return parsed;
  const content = removeFileRefusal(parsed.text);
  const label = kind === 'docx' ? 'Tài liệu Word' : kind === 'xlsx' ? 'Bảng tính Excel' : `Tệp ${kind.toUpperCase()}`;
  return {
    text: refusalPattern.test(parsed.text) ? `Đã chuẩn bị ${label} để bạn tải xuống.\n\n${content}` : parsed.text,
    artifacts: [{ id: crypto.randomUUID(), name: `tai-lieu-ai.${kind}`, kind, title: label, content }],
  };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const stripMarkdown = (text: string) => text
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1');

async function createDocxBlob(content: string) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const headingByLevel = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];
  const children = content.split(/\r?\n/).map(line => {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) return new Paragraph({ text: stripMarkdown(heading[2]), heading: headingByLevel[heading[1].length - 1] });
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) return new Paragraph({ children: [new TextRun(stripMarkdown(bullet[1]))], bullet: { level: 0 } });
    return new Paragraph({ children: [new TextRun(stripMarkdown(line))], spacing: { after: line ? 120 : 60 } });
  });
  const document = new Document({ sections: [{ children }] });
  return Packer.toBlob(document);
}

async function createXlsxBlob(content: string) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  let payload: any;
  try { payload = JSON.parse(content); } catch { payload = null; }
  const markdownLines = content.split(/\r?\n/).filter(line => /^\s*\|.*\|\s*$/.test(line));
  const markdownTable = markdownLines.length >= 2
    ? markdownLines.map(line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())).filter((_, index) => index !== 1)
    : [];
  const fallbackSheet = markdownTable.length
    ? { name: 'Nội dung', headers: markdownTable[0], rows: markdownTable.slice(1) }
    : { name: 'Nội dung', headers: ['Nội dung'], rows: content.split(/\r?\n/).filter(Boolean).map((line: string) => [line]) };
  const sheets = Array.isArray(payload?.sheets) && payload.sheets.length ? payload.sheets.slice(0, 20) : [fallbackSheet];
  for (const [index, source] of sheets.entries()) {
    const name = String(source?.name || `Sheet ${index + 1}`).replace(/[\\/*?:\[\]]/g, '-').slice(0, 31);
    const sheet = workbook.addWorksheet(name || `Sheet ${index + 1}`);
    const headers = Array.isArray(source?.headers) ? source.headers.map(String) : [];
    if (headers.length) {
      const row = sheet.addRow(headers);
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    }
    const rows = Array.isArray(source?.rows) ? source.rows : [];
    rows.slice(0, 50_000).forEach((row: unknown) => sheet.addRow(Array.isArray(row) ? row : [row]));
    sheet.columns.forEach(column => { column.width = Math.min(45, Math.max(12, ...(column.values || []).map(value => String(value ?? '').length + 2))); });
    sheet.views = [{ state: 'frozen', ySplit: headers.length ? 1 : 0 }];
    sheet.autoFilter = headers.length ? { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } } : undefined;
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function downloadChatArtifact(artifact: ChatArtifact) {
  if (artifact.kind === 'docx') return triggerDownload(await createDocxBlob(artifact.content), artifact.name);
  if (artifact.kind === 'xlsx') return triggerDownload(await createXlsxBlob(artifact.content), artifact.name);
  const mime = artifact.kind === 'csv' ? 'text/csv;charset=utf-8' : artifact.kind === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
  triggerDownload(new Blob(['\ufeff', artifact.content], { type: mime }), artifact.name);
}

export async function downloadAnswerAsDocx(text: string, filename = 'tra-loi-ai.docx') {
  triggerDownload(await createDocxBlob(text), filename);
}
