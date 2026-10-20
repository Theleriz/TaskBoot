# Task Tracker для Windows — оболочка WebView2

Нативное окно Windows, внутри которого работает веб-приложение из [`web/`](../web/README.md). Весь интерфейс — общий с веб-версией; оболочка добавляет системное: хранение данных в файле, уведомления Windows и значок в трее, прогресс таймера на кнопке панели задач, тёмный заголовок окна, открытие ссылок в браузере по умолчанию. Обмен между страницей и оболочкой описан в [docs/bridge-protocol.md](../docs/bridge-protocol.md).

Спецификации: [базовое ТЗ](../docs/specs/task_manager_description.md), [расширение 02](../docs/specs/feature_document_02.md). Прежний самостоятельный WPF-интерфейс сохранён в истории под тегом `wpf-legacy`.

## Что нужно пользователю

- Windows 10 или 11. .NET Framework 4.8 уже входит в систему.
- Microsoft Edge WebView2 Runtime — в Windows 11 есть всегда, в Windows 10 обычно установлен вместе с Edge. Если его нет, приложение предложит открыть страницу загрузки.

Ничего устанавливать не нужно: достаточно скопировать папку `dist\TaskTracker` (или zip с ней) и запустить `TaskTracker.exe`.

## Сборка

Нужны Node.js 22.12+ и .NET SDK 8 или новее (`winget install Microsoft.DotNet.SDK.10`).

```bash
win32\build.cmd
```

Скрипт собирает веб-приложение (`npm run build` в `web/`), публикует оболочку в `win32\dist\TaskTracker\` (около 2 МБ) и упаковывает её в `win32\dist\TaskTracker.zip` — этот архив можно отправлять людям. Можно указать другую папку: `build.cmd C:\Temp\TaskTracker`. Версию в `.exe` задаёт переменная `TASKTRACKER_VERSION` (например, `0.6.0`); в выпусках на GitHub её берут из тега.

Только оболочка, без пересборки веба: `dotnet build win32\TaskTracker.csproj`.

## Разработка

Чтобы оболочка показывала dev-сервер Vite с горячей перезагрузкой вместо собранных файлов, запустите `npm run dev` в папке `web/`, а затем собранную оболочку с переменной окружения `TASKTRACKER_DEV_URL=http://localhost:5173`. В этом режиме включены инструменты разработчика (F12).

## Данные

- Файл: `%APPDATA%\TaskTracker\data.json`. Каталог можно переопределить переменной `TASKTRACKER_DATA_DIR`.
- Формат задаёт веб-приложение (`web/src/data`); старые файлы нативной версии читаются и при первом сохранении приводятся к текущей схеме.
- Каждое сохранение атомарное (временный файл + замена); предыдущая версия остаётся в `data.json.bak`, повреждённый файл — в `data.json.corrupt-<дата>`.
- При закрытии окна оболочка ждёт, пока страница сохранит последние изменения (до 2 секунд).
- Профиль WebView2 (кэш браузера) — в `%LOCALAPPDATA%\TaskTracker\WebView2`. Автозаполнение и сохранение паролей в нём выключены.

Секреты хранятся в `data.json` в открытом виде — см. [docs/secrets-policy.md](../docs/secrets-policy.md).

## Значок

`app.ico` встраивается в `.exe` при сборке. Сгенерировать заново: `powershell -ExecutionPolicy Bypass -STA -File tools\make-icon.ps1`.

## Структура

| Путь | Содержимое |
|---|---|
| `TaskTracker.csproj` | SDK-проект WPF, .NET Framework 4.8, пакет `Microsoft.Web.WebView2` (версия закреплена в `packages.lock.json`) |
| `src/Program.cs` | Точка входа |
| `src/ShellWindow.cs` | Окно с WebView2: локальный домен `https://app.local`, запрет перехода на чужие адреса, закрытие с сохранением |
| `src/BridgeHost.cs` | Обработка запросов страницы (протокол моста) |
| `src/DataFile.cs` | Чтение и атомарная запись `data.json` |
| `src/TrayNotifier.cs` | Значок в трее и уведомления Windows |
| `src/NativeMethods.cs` | Тёмный заголовок окна, мигание кнопки на панели задач |
| `build.cmd` | Полная сборка: веб + оболочка |
