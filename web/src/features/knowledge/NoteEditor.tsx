// Markdown editor on CodeMirror 6. Loaded lazily: the boards do not need it.
// The editor is uncontrolled: it starts from `initialText` and reports every change;
// NotePane mounts a new editor for each note (key = note id).

import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  HighlightStyle,
  Language,
  LanguageSupport,
  defineLanguageFacet,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, keymap, placeholder } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { GFM, parser } from '@lezer/markdown';
import { useEffect, useRef, useState } from 'react';

// Markdown with GitHub extensions (tables, strikethrough, task lists) and nothing else:
// @codemirror/lang-markdown would also pull in HTML, CSS and JavaScript support (D-05).
const markdown = new LanguageSupport(
  new Language(defineLanguageFacet(), parser.configure(GFM), [], 'markdown'),
);

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--accent)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--accent)' },
  { tag: tags.monospace, fontFamily: "'Cascadia Mono', Consolas, ui-monospace, monospace" },
  { tag: tags.quote, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.meta], color: 'var(--muted)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--text)', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.6' },
  '.cm-content': { padding: '10px 2px', caretColor: 'var(--text)' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--accent-soft) !important',
  },
  '.cm-placeholder': { color: 'var(--muted)' },
});

/** A place in the text to select and scroll to, e.g. a search match. A new object jumps again. */
export interface Jump {
  from: number;
  to: number;
}

export default function NoteEditor({
  initialText,
  onChange,
  jump = null,
}: {
  initialText: string;
  onChange: (text: string) => void;
  jump?: Jump | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changed = useRef(onChange);
  const [initial] = useState(initialText);

  useEffect(() => {
    changed.current = onChange;
  });

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const editor = new EditorView({
      parent,
      state: EditorState.create({
        doc: initial,
        extensions: [
          history(),
          drawSelection(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown,
          syntaxHighlighting(highlight),
          EditorView.lineWrapping,
          theme,
          placeholder('Текст в Markdown. Формулы: $E = mc^2$ или $$ … $$ на отдельных строках.'),
          EditorView.contentAttributes.of({ 'aria-label': 'Текст заметки', spellcheck: 'true' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) changed.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      view.current = null;
      editor.destroy();
    };
  }, [initial]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || !jump) return;
    const length = editor.state.doc.length;
    const from = Math.min(jump.from, length);
    const to = Math.min(jump.to, length);
    editor.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: 'center' }),
    });
    editor.focus();
  }, [jump]);

  return <div className="note-editor" ref={host} />;
}
