export interface PaginatorConfig {
  containerWidth: number;
  containerHeight: number;
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  paragraphSpacing: number;
  paddingHorizontal: number;
  paddingVertical: number;
}

export interface Page {
  pageIndex: number;
  content: string;
  startCharIndex: number;
  endCharIndex: number;
}

export class Paginator {
  private config: PaginatorConfig;

  constructor(config: PaginatorConfig) {
    this.config = config;
  }

  private get contentWidth() {
    return Math.max(0, this.config.containerWidth - this.config.paddingHorizontal * 2);
  }

  private get contentHeight() {
    return Math.max(0, this.config.containerHeight - this.config.paddingVertical * 2);
  }

  private get charsPerLine(): number {
    const avgCharWidth = this.config.fontSize * 0.55;
    return Math.max(1, Math.floor(this.contentWidth / avgCharWidth));
  }

  private get linesPerPage(): number {
    return Math.max(1, Math.floor(this.contentHeight / this.config.lineHeight));
  }

  paginate(chapterText: string): Page[] {
    const paragraphs = chapterText.split('\n');
    const pages: Page[] = [];

    let currentPageLines: string[] = [];
    let currentLineCount = 0;
    let charOffset = 0;
    let pageStartOffset = 0;

    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
      const paragraph = paragraphs[paragraphIndex];
      const isLastParagraph = paragraphIndex === paragraphs.length - 1;
      const lines = this.wrapParagraph(paragraph);

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        if (currentLineCount >= this.linesPerPage) {
          pages.push({
            pageIndex: pages.length,
            content: currentPageLines.join('\n'),
            startCharIndex: pageStartOffset,
            endCharIndex: charOffset,
          });
          currentPageLines = [];
          currentLineCount = 0;
          pageStartOffset = charOffset;
        }

        currentPageLines.push(line);
        currentLineCount++;
        charOffset += line.length;

        if (lineIndex === lines.length - 1 && !isLastParagraph) {
          charOffset += 1;
        }
      }

      const spacingLines = Math.ceil(this.config.paragraphSpacing / this.config.lineHeight);
      if (!isLastParagraph && spacingLines > 0) {
        for (let spacingIndex = 0; spacingIndex < spacingLines; spacingIndex += 1) {
          if (currentLineCount >= this.linesPerPage) {
            pages.push({
              pageIndex: pages.length,
              content: currentPageLines.join('\n'),
              startCharIndex: pageStartOffset,
              endCharIndex: charOffset,
            });
            currentPageLines = [];
            currentLineCount = 0;
            pageStartOffset = charOffset;
          }

          currentPageLines.push('');
          currentLineCount += 1;
        }
      }
    }

    if (currentPageLines.length > 0) {
      pages.push({
        pageIndex: pages.length,
        content: currentPageLines.join('\n'),
        startCharIndex: pageStartOffset,
        endCharIndex: charOffset,
      });
    }

    return pages;
  }

  private wrapParagraph(text: string): string[] {
    if (!text) return [''];

    const lines: string[] = [];
    const normalized = text.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ').filter(Boolean);

    if (words.length <= 1) {
      const chars = Array.from(text);
      let currentLine = '';

      for (const char of chars) {
        if (currentLine.length + char.length > this.charsPerLine) {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = '';
          }
        }

        currentLine += char;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines.length > 0 ? lines : [''];
    }

    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        if (word.length <= this.charsPerLine) {
          currentLine = word;
        } else {
          const chunks = Array.from(word);
          for (let index = 0; index < chunks.length; index += this.charsPerLine) {
            lines.push(chunks.slice(index, index + this.charsPerLine).join(''));
          }
          currentLine = '';
        }
        continue;
      }

      if (currentLine.length + 1 + word.length <= this.charsPerLine) {
        currentLine += ` ${word}`;
        continue;
      }

      lines.push(currentLine);

      if (word.length <= this.charsPerLine) {
        currentLine = word;
      } else {
        const chunks = Array.from(word);
        for (let index = 0; index < chunks.length; index += this.charsPerLine) {
          lines.push(chunks.slice(index, index + this.charsPerLine).join(''));
        }
        currentLine = '';
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}
