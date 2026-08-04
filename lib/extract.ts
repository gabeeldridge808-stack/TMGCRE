import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export interface ExtractedPage {
  /** 1-indexed page number. Only populated for PDFs — docx/plain text have
   *  no reliable page concept at extraction time. */
  pageNumber: number | null;
  text: string;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

export const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  DOCX_MIME,
  GOOGLE_DOC_MIME,
  "text/plain", // Google Docs are exported to this before reaching here
]);

/**
 * pdf-parse's default text extraction concatenates every page with no
 * boundary markers. Supplying a custom `pagerender` lets us capture text
 * per page (needed for the `page_number` column) at the cost of driving
 * pdfjs's page-render API directly instead of the one-line default.
 */
async function extractPdf(buffer: Buffer): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];
  let pageNumber = 0;

  await pdfParse(buffer, {
    pagerender: async (pageData: {
      getTextContent: () => Promise<{ items: { str: string }[] }>;
    }) => {
      pageNumber += 1;
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item) => item.str).join(" ");
      pages.push({ pageNumber, text });
      return text;
    },
  });

  return pages.filter((p) => p.text.trim().length > 0);
}

async function extractDocx(buffer: Buffer): Promise<ExtractedPage[]> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim() ? [{ pageNumber: null, text: value }] : [];
}

/**
 * Extract text as an array of pages. Returns [] for empty/unextractable
 * content (e.g. a scanned image-only PDF with no text layer) rather than
 * throwing — callers should treat an empty result as "skip, no OCR yet."
 * Throws only for genuinely unsupported mime types; callers should check
 * SUPPORTED_MIME_TYPES first to skip those with a clear reason instead.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<ExtractedPage[]> {
  if (mimeType === "application/pdf") {
    return extractPdf(buffer);
  }
  if (mimeType === DOCX_MIME) {
    return extractDocx(buffer);
  }
  if (mimeType === "text/plain") {
    const text = buffer.toString("utf-8");
    return text.trim() ? [{ pageNumber: null, text }] : [];
  }
  throw new Error(`Unsupported mime type for extraction: ${mimeType}`);
}
