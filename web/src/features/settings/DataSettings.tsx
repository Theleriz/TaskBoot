import { useRef, useState } from 'react';
import { DataFormatError, SchemaTooNewError } from '../../data/errors.ts';
import { exportData, exportFileName, importData } from '../../data/exchange.ts';
import { useAppData, usePlatform, useToast } from '../../state/hooks.ts';
import { Box } from './Box.tsx';

function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export and import of all data as JSON (phase 0.3 format, compatible with the native data.json). */
export function DataSettings() {
  const { data, load, replace } = useAppData();
  const platform = usePlatform();
  const toast = useToast();
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const readOnly = load.kind === 'ready' && load.readOnly;
  const where =
    platform.kind === 'shell'
      ? 'в файле %APPDATA%\\TaskTracker\\data.json'
      : 'в хранилище этого браузера (localStorage)';

  const onFile = async (file: File) => {
    setError(null);
    let imported;
    try {
      imported = importData(await file.text());
    } catch (e) {
      setError(
        e instanceof SchemaTooNewError
          ? 'Файл создан более новой версией приложения.'
          : e instanceof DataFormatError
            ? 'Это не файл данных Task Tracker или он повреждён.'
            : 'Не удалось прочитать файл.',
      );
      return;
    }
    const summary = `задач: ${imported.tasks.length}, заметок: ${imported.notes.length}, секретов: ${imported.secrets.length}`;
    if (!window.confirm(`Заменить все текущие данные данными из файла (${summary})?`)) return;
    replace(imported);
    toast('Данные импортированы');
  };

  return (
    <Box title="Данные" color="var(--muted)">
      <p className="setting-sub">Данные хранятся {where}.</p>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            download(exportData(data, { includeSecrets }), exportFileName());
            toast('Файл экспорта создан');
          }}
        >
          Экспорт в JSON
        </button>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeSecrets}
            onChange={(e) => setIncludeSecrets(e.target.checked)}
          />
          включить секреты (в файле они будут в открытом виде)
        </label>
      </div>
      <div className="row import-row">
        <button
          type="button"
          className="btn"
          disabled={readOnly}
          onClick={() => fileInput.current?.click()}
        >
          Импорт из JSON…
        </button>
        <span className="muted">Принимает экспорт и файл data.json нативной версии.</span>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onFile(file);
          }}
        />
      </div>
      {error && <div className="field-error">{error}</div>}
    </Box>
  );
}
