// Turns the markdown-lite text Claude produces (lib/icMemo.ts's system
// prompt: "#" headers, "**bold**", "-" bullets) into a real .docx file —
// IC memos get annotated/edited in Word in practice, so that's the export
// format that's actually useful, not a flattened PDF.
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

function parseInlineRuns(line: string): TextRun[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  const runs = parts.map((part) =>
    part.startsWith("**") && part.endsWith("**")
      ? new TextRun({ text: part.slice(2, -2), bold: true })
      : new TextRun(part)
  );
  return runs.length > 0 ? runs : [new TextRun("")];
}

export async function buildMemoDocx(memoText: string, dealName: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [
    new Paragraph({ text: `Investment Committee Memo — ${dealName}`, heading: HeadingLevel.TITLE }),
  ];

  for (const rawLine of memoText.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 } })
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({ text: line.slice(3).trim(), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } })
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(new Paragraph({ children: parseInlineRuns(line.slice(2).trim()), bullet: { level: 0 } }));
    } else {
      paragraphs.push(new Paragraph({ children: parseInlineRuns(line), spacing: { after: 120 } }));
    }
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}
