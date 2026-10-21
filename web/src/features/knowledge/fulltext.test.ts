import { describe, expect, it } from 'vitest';
import { NoteIndex, termRanges } from './fulltext.ts';

const note = (id: string, title: string, text: string, updatedAt = 1) => ({
  id,
  title,
  text,
  updatedAt,
});

function indexOf(...notes: ReturnType<typeof note>[]) {
  const index = new NoteIndex();
  index.sync(notes);
  return index;
}

const ids = (index: NoteIndex, query: string) => index.find(query).map((h) => h.noteId);

describe('full-text search', () => {
  const notes = [
    note('a', 'Задачи на неделю', 'Сдать отчёт по ёлкам. Позвонить маме.'),
    note('b', 'Физика', 'Энергия и масса: E = mc^2'),
    note('c', 'Покупки', 'молоко, хлеб, задача про яблоки'),
  ];

  it('finds word beginnings and small typos', () => {
    const index = indexOf(...notes);
    expect(ids(index, 'задач').sort()).toEqual(['a', 'c']);
    expect(ids(index, 'энерг')).toEqual(['b']);
    expect(ids(index, 'фезика')).toEqual(['b']);
  });

  it('treats ё and е as the same letter and ignores case', () => {
    const index = indexOf(...notes);
    expect(ids(index, 'елкам')).toEqual(['a']);
    expect(ids(index, 'ОТЧЕТ')).toEqual(['a']);
  });

  it('needs every word of the query and ranks titles higher', () => {
    const index = indexOf(...notes);
    expect(ids(index, 'задача яблоки')).toEqual(['c']);
    expect(ids(index, 'задачи')[0]).toBe('a');
    expect(ids(index, 'задача марс')).toEqual([]);
  });

  it('returns where the words are, for highlighting', () => {
    const [hit] = indexOf(...notes).find('ёлкам');
    const text = notes[0]!.text;
    expect(hit?.titleRanges).toEqual([]);
    expect(hit?.textRanges).toEqual([
      { from: text.indexOf('ёлкам'), to: text.indexOf('ёлкам') + 5 },
    ]);
  });

  it('follows changes of the notes', () => {
    const index = indexOf(...notes);
    index.sync([note('a', 'Задачи на неделю', 'теперь про кошек', 2), notes[1]!]);
    expect(ids(index, 'ёлкам')).toEqual([]);
    expect(ids(index, 'кошек')).toEqual(['a']);
    expect(ids(index, 'молоко')).toEqual([]);
  });

  it('marks only word beginnings', () => {
    expect(termRanges('кот котик скот', ['кот'])).toEqual([
      { from: 0, to: 3 },
      { from: 4, to: 7 },
    ]);
  });
});
