# Протокол моста веб ↔ оболочка Windows

Контракт между веб-приложением (`web/`) и оболочкой WebView2 (`win32/`, шаг 0.5). Источник истины для типов — [`web/src/bridge/protocol.ts`](../web/src/bridge/protocol.ts); этот документ описывает то же самое для C#-стороны.

## Транспорт

- Страница → оболочка: `window.chrome.webview.postMessage(obj)`. В C# приходит в `CoreWebView2.WebMessageReceived`, текст — `e.WebMessageAsJson`.
- Оболочка → страница: `CoreWebView2.PostWebMessageAsJson(json)`. На странице — событие `message`, объект в `event.data`.
- Веб определяет, что работает внутри оболочки, по наличию `window.chrome.webview`. Иначе используется хранилище браузера.

## Сообщения

Запрос (страница → оболочка):

```json
{ "kind": "request", "id": "<uuid>", "method": "storage.save", "payload": { "json": "..." } }
```

Ответ (оболочка → страница), ровно один на каждый запрос, с тем же `id`:

```json
{ "kind": "response", "id": "<uuid>", "ok": true, "result": null }
{ "kind": "response", "id": "<uuid>", "ok": false, "error": { "code": "io_error", "message": "Disk is full" } }
```

Событие (оболочка → страница, без запроса):

```json
{ "kind": "event", "event": "app.activated", "payload": null }
```

Если ответа нет 10 секунд, страница считает запрос неудавшимся (`code: "timeout"`). На неизвестный метод оболочка отвечает `ok: false`, `code: "unknown_method"`.

## Методы

| Метод | payload | result | Что делает оболочка |
|---|---|---|---|
| `storage.load` | `null` | `{ "json": string \| null }` | Читает `%APPDATA%\TaskTracker\data.json` (или каталог из `TASKTRACKER_DATA_DIR`). `null`, если файла нет |
| `storage.save` | `{ "json": string }` | `null` | Пишет файл атомарно: временный файл + замена. При ошибке — `ok: false`, `code: "io_error"` |
| `notify.show` | `{ "title", "body" }` | `null` | Уведомление Windows; щелчок по нему показывает окно и шлёт событие `app.activated` |
| `taskbar.progress` | `{ "state": "none" \| "normal" \| "paused", "value": 0..1 }` | `null` | Прогресс на кнопке панели задач |
| `window.title` | `{ "title" }` | `null` | Заголовок окна |
| `window.theme` | `{ "dark": boolean }` | `null` | Тёмный или светлый заголовок окна (DWM) |
| `shell.openExternal` | `{ "url" }` | `null` | Открывает ссылку в браузере по умолчанию; принимать только `http`/`https` |
| `app.readyToClose` | `null` | `null` | Ответ на событие `app.closing`: несохранённые изменения записаны, окно можно закрыть |
| `app.info` | `null` | `{ "version", "platform": "windows" }` | Версия оболочки |

## События

| Событие | payload | Когда |
|---|---|---|
| `app.activated` | `null` | Пользователь щёлкнул уведомление или значок в трее, окно снова показано |
| `app.closing` | `null` | Пользователь закрывает окно. Страница сохраняет отложенные изменения и вызывает `app.readyToClose`; оболочка ждёт до 2 секунд, затем закрывается в любом случае |

## Формат data.json

Тот же, что в нативной версии до гибрида, плюс поле `schemaVersion` (сейчас `3`: с v2.1.0 — папки и связи заметок с задачами, с v2.2.0 — карточки; см. [architecture.md](architecture.md#данные)). Более старое приложение открывает файл новой схемы только для чтения. Веб читает и старые файлы без `schemaVersion` (версия 0) и сам приводит их к текущей схеме. Файл с `schemaVersion` новее поддерживаемого веб не перезаписывает. Схема и миграции — `web/src/data/schema.ts`.

## Правила безопасности для оболочки

- Отвечать только на сообщения от своей страницы: проверять `e.Source` (виртуальный домен `https://app.local`).
- Не выполнять произвольные команды из `payload`: только перечисленные методы с проверкой полей.
- Не логировать содержимое `storage.save` — в нём заметки и секреты пользователя (`docs/secrets-policy.md`).
