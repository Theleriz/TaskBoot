# Архитектура Task Tracker

Гибридная схема (решение — [дорожная карта](roadmap.md), реализация — [фаза 0](phase-0.md)): весь интерфейс и логика живут в веб-приложении `web/`, а приложение для Windows — тонкая оболочка `win32/`, которая показывает тот же веб-интерфейс во встроенном Edge (WebView2) и даёт ему доступ к возможностям Windows.

## Как это устроено

```mermaid
flowchart LR
  subgraph Web["web/ — React + TypeScript (одна кодовая база)"]
    UI["Интерфейс<br/>features/*"] --> State["Состояние<br/>state/AppDataProvider"]
    UI --> Platform["Платформа<br/>platform/platform.ts"]
    State --> Store["Хранилище<br/>data/store.ts"]
  end

  subgraph Browser["Обычный браузер / GitHub Pages"]
    LS[("localStorage<br/>taskTracker.data")]
    NotifAPI["Notification API,<br/>document.title"]
  end

  subgraph Shell["win32/ — оболочка WebView2 (.NET Framework 4.8)"]
    Bridge["BridgeHost"] --> File[("%APPDATA%\TaskTracker<br/>data.json")]
    Bridge --> Win["Трей и уведомления,<br/>панель задач, заголовок окна"]
  end

  Store -- "в браузере" --> LS
  Platform -- "в браузере" --> NotifAPI
  Store -- "в оболочке: мост" --> Bridge
  Platform -- "в оболочке: мост" --> Bridge
```

Какой путь выбрать, решает `createEnvironment()` в `web/src/platform/platform.ts`: если на странице есть `window.chrome.webview`, приложение работает внутри оболочки, и хранилище с платформенными функциями идут через мост; иначе используются API браузера. Остальной код об этом не знает.

## Веб-приложение (`web/`)

| Слой | Где | Что делает |
|---|---|---|
| Модель и формат данных | `src/data/model.ts`, `normalize.ts`, `schema.ts` | Типы задач, заметок, секретов, настроек; «очистка» любых входных данных; номер схемы и миграции |
| Хранилище | `src/data/store.ts` | Единый интерфейс `DataStore` с тремя реализациями: браузер, оболочка (мост), память |
| Импорт и экспорт | `src/data/exchange.ts`, `legacy.ts` | Экспорт в JSON (секреты по выбору), импорт экспорта и нативного `data.json`, перенос из прежней веб-версии |
| Состояние | `src/state/AppDataContext.tsx`, `ops.ts` | Данные в React-контексте; изменения — чистые функции над копией; сохранение с задержкой 300 мс и принудительно при закрытии |
| Платформа | `src/platform/platform.ts` | Уведомления, заголовок окна, прогресс на панели задач, внешние ссылки, сигнал о закрытии |
| Тема | `src/theme/` | Палитра из пары «фон + акцент» → CSS-переменные; режимы системная, светлая, тёмная, своя, случайная, сохранённая |
| Функции | `src/features/` | Доски, детали задачи, Pomodoro, «Пространство», настройки |

Правила кода: TypeScript в строгом режиме, правила React Compiler в ESLint (никаких `Date.now()` и `Math.random()` при рендере, данные меняются только через `apply()`), тесты Vitest рядом с кодом. Перед коммитом — `npm run check`.

## Данные

- Формат — объект `AppData` (`web/src/data/model.ts`) с полем `schemaVersion`. Он совпадает с прежним нативным `data.json` (версия схемы 0), поэтому старые файлы читаются без конвертации.
- Изменение формата: увеличить `CURRENT_SCHEMA_VERSION` в `schema.ts` и добавить миграцию с предыдущей версии. Данные из более новой версии приложения открываются только для чтения и не перезаписываются.
- Где лежат: в браузере — ключ `taskTracker.data` (старые ключи `taskTracker.*` только читаются при первом запуске); в оболочке — `%APPDATA%\TaskTracker\data.json` (атомарная запись, копия предыдущей версии в `data.json.bak`).
- Секреты хранятся в открытом виде — [docs/secrets-policy.md](secrets-policy.md).

## Мост веб ↔ оболочка

Полный контракт — [bridge-protocol.md](bridge-protocol.md), типы — `web/src/bridge/protocol.ts`, реализация в оболочке — `win32/src/BridgeHost.cs`.

Сохранение и закрытие окна:

```mermaid
sequenceDiagram
  participant P as Страница (web)
  participant S as Оболочка (C#)
  participant F as data.json

  P->>S: request storage.save { json }
  S->>F: запись во временный файл и замена (+ .bak)
  S-->>P: response ok

  Note over S: пользователь закрывает окно
  S->>P: event app.closing
  P->>S: request storage.save (если есть несохранённое)
  S-->>P: response ok
  P->>S: request app.readyToClose
  S->>S: окно закрывается (не дольше 2 с ожидания)
```

## Оболочка Windows (`win32/`)

- Веб-сборка лежит рядом с exe в папке `web\` и отдаётся с виртуального домена `https://app.local` — без сервера и без интернета.
- Безопасность: переход на любой другой адрес отменяется, ссылка открывается в браузере по умолчанию; сообщения моста принимаются только от своей страницы; автозаполнение и сохранение паролей в WebView2 выключены; профиль браузера — в `%LOCALAPPDATA%\TaskTracker\WebView2`.
- Разработка: переменная `TASKTRACKER_DEV_URL=http://localhost:5173` показывает dev-сервер Vite с горячей перезагрузкой и включает инструменты разработчика.

## Сборка и выпуск

| Что | Как |
|---|---|
| Веб локально | `cd web` → `npm ci` → `npm run dev` / `npm run build` |
| Windows локально | `win32\build.cmd` → `win32\dist\TaskTracker\` и `TaskTracker.zip` |
| Проверки | GitHub Actions `ci.yml` на каждый push и PR: веб (типы, линтер, формат, тесты, сборка), Windows (сборка, пакет, актуальность `THIRD_PARTY_NOTICES.md`) |
| Выпуск | тег `vX.Y.Z` → `release.yml` публикует GitHub Release с zip для Windows и для веба |
| Веб онлайн | `pages.yml` → GitHub Pages (включается владельцем репозитория) |
| Зависимости | закреплены lock-файлами; Dependabot раз в неделю; лицензии — правила D-01…D-06 в ТЗ и `THIRD_PARTY_NOTICES.md` (генерирует `tools/third-party-notices.mjs`) |

## Как добавить функцию

1. Реализовать её в `web/` (данные — через `ops.ts` и при необходимости новую версию схемы; интерфейс — в `features/`), с тестами.
2. Если нужна возможность Windows, которой нет в браузере, — добавить метод в `web/src/bridge/protocol.ts`, обработчик в `win32/src/BridgeHost.cs` и строку в [bridge-protocol.md](bridge-protocol.md); в браузерной реализации `Platform` предусмотреть запасной вариант.
3. Новая библиотека — по правилам D-01…D-06; после установки обновить уведомления: `node tools/third-party-notices.mjs`.
