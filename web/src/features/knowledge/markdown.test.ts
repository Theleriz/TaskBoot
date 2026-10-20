import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.ts';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('renderMarkdown', () => {
  it('renders common Markdown', () => {
    const html = renderMarkdown(
      '# Title\n\n**bold** and *it*\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |',
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<table>');
  });

  it('keeps line breaks inside a paragraph', () => {
    expect(renderMarkdown('first\nsecond')).toContain('first<br>');
  });

  it('never renders raw HTML or script links', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('href="javascript:');
  });

  it('shows images as links instead of loading them (N-05)', () => {
    const html = renderMarkdown('![Схема](https://example.com/a.png)');
    expect(html).not.toContain('<img');
    expect(html).toContain(
      '<a class="md-image" href="https://example.com/a.png">Изображение: Схема</a>',
    );
  });

  it('turns plain addresses into links', () => {
    expect(renderMarkdown('see https://example.com')).toContain('<a href="https://example.com">');
  });
});

describe('formulas', () => {
  it('renders inline and display formulas with KaTeX', () => {
    const html = renderMarkdown('Energy $E = mc^2$ and $$\\int_0^1 x\\,dx$$');
    expect(count(html, 'class="katex"')).toBe(2);
    expect(count(html, 'class="katex-display"')).toBe(1);
  });

  it('renders a block formula over several lines', () => {
    const html = renderMarkdown('Text\n\n$$\n\\sum_{i=1}^n i\n= \\frac{n(n+1)}{2}\n$$\n\nAfter');
    expect(html).toContain('<div class="math-block">');
    expect(html).toContain('katex-display');
    expect(html).toContain('<p>After</p>');
  });

  it('leaves prices, escaped dollars and code alone', () => {
    for (const text of [
      'It costs $5 and $10.',
      'Price: \\$5, \\$6',
      'Use `$x$` in code',
      '$ x $',
    ]) {
      expect(renderMarkdown(text)).not.toContain('katex');
    }
    expect(renderMarkdown('Price: \\$5')).toContain('Price: $5');
  });

  it('does not let an unfinished block swallow the rest of the note', () => {
    const html = renderMarkdown('$$\n\\frac{1}{2}\n\n# Heading');
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).not.toContain('math-block');
  });

  it('shows TeX errors in place instead of failing', () => {
    const html = renderMarkdown('Broken $\\frac{1}{$ formula');
    expect(html).toContain('katex-error');
    expect(html).toContain('formula');
  });

  it('does not allow links from TeX commands', () => {
    const html = renderMarkdown('$\\href{javascript:alert(1)}{click}$');
    expect(html).not.toContain('href="javascript:');
  });
});
