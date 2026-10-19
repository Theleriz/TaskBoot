using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace TaskTracker
{
    // F-60..F-70: вкладка «Пространство» — заметки и секреты.
    public class WorkspaceView : ContentControl
    {
        readonly Store store;
        readonly StackPanel notesList = new StackPanel();
        readonly StackPanel secretsList = new StackPanel();
        readonly Border notesCounterHost = new Border();
        readonly Border secretsCounterHost = new Border();
        readonly Border notesBox;
        readonly Border secretsBox;
        readonly System.Collections.Generic.HashSet<string> revealed = new System.Collections.Generic.HashSet<string>();
        string openNoteId;
        string editSecretId;
        bool narrow;

        public WorkspaceView(Store store)
        {
            this.store = store;
            Focusable = false;
            notesBox = Box(BuildNotes());
            secretsBox = Box(BuildSecrets());
            RenderNotes();
            RenderSecrets();
            Layout();
        }

        public bool Narrow
        {
            get { return narrow; }
            set
            {
                if (narrow == value) return;
                narrow = value;
                Layout();
            }
        }

        void Layout()
        {
            var old = Content as ScrollViewer;
            if (old != null) ((Grid)old.Content).Children.Clear();

            var grid = new Grid { MaxWidth = 1200, Margin = new Thickness(0, 8, 0, 8), VerticalAlignment = VerticalAlignment.Top };
            if (narrow)
            {
                grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                Grid.SetColumn(secretsBox, 0);
                Grid.SetRow(secretsBox, 1);
            }
            else
            {
                grid.ColumnDefinitions.Add(new ColumnDefinition());
                grid.ColumnDefinitions.Add(new ColumnDefinition());
                Grid.SetColumn(secretsBox, 1);
                Grid.SetRow(secretsBox, 0);
            }
            grid.Children.Add(notesBox);
            grid.Children.Add(secretsBox);
            Content = Ui.Scroller(grid);
        }

        static Border Box(UIElement content)
        {
            var b = new Border
            {
                CornerRadius = new CornerRadius(12),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(16),
                Margin = new Thickness(6),
                VerticalAlignment = VerticalAlignment.Top,
                Child = content
            };
            b.SetResourceReference(Border.BackgroundProperty, "Surface");
            b.SetResourceReference(Border.BorderBrushProperty, "Border");
            return b;
        }

        static Border Separator()
        {
            var s = new Border { Height = 1, Margin = new Thickness(0, 14, 0, 14) };
            s.SetResourceReference(Border.BackgroundProperty, "Border");
            return s;
        }

        /* ---------------- Заметки ---------------- */

        UIElement BuildNotes()
        {
            var title = Ui.Input("Заголовок заметки", "Input");
            title.MaxLength = 200;
            var text = Ui.Input("Текст заметки", "TextArea");
            text.Margin = new Thickness(0, 8, 0, 0);
            text.MaxHeight = 260;
            var error = Ui.Error("Введите заголовок заметки");
            title.TextChanged += (s, e) =>
            {
                error.Visibility = Visibility.Collapsed;
                title.ClearValue(Control.BorderBrushProperty);
            };

            Action add = () =>
            {
                var v = title.Text.Trim();
                if (v.Length == 0)
                {
                    error.Visibility = Visibility.Visible;
                    title.SetResourceReference(Control.BorderBrushProperty, "Danger");
                    title.Focus();
                    return;
                }
                long now = Store.NowMs();
                store.Notes.Add(new Note { id = Store.NewId(), title = v, text = text.Text, createdAt = now, updatedAt = now });
                store.SaveWorkspace();
                title.Clear();
                text.Clear();
                RenderNotes();
                title.Focus();
            };
            title.KeyDown += (s, e) => { if (e.Key == Key.Enter) { text.Focus(); e.Handled = true; } };
            var addBtn = Ui.TextButton("Добавить заметку", "BtnPrimary", add);
            addBtn.HorizontalAlignment = HorizontalAlignment.Left;
            addBtn.Margin = new Thickness(0, 8, 0, 0);

            var header = Ui.SectionHeader("Заметки", "Accent", 17, null);
            header.Children.Add(notesCounterHost);
            header.Margin = new Thickness(0, 0, 0, 12);

            var root = new StackPanel();
            root.Children.Add(header);
            root.Children.Add(title);
            root.Children.Add(text);
            root.Children.Add(error);
            root.Children.Add(addBtn);
            root.Children.Add(Separator());
            root.Children.Add(notesList);
            return root;
        }

        void RenderNotes()
        {
            notesCounterHost.Child = Ui.Counter(store.Notes.Count);
            notesList.Children.Clear();
            if (store.Notes.Count == 0)
            {
                notesList.Children.Add(Ui.Empty()); // F-69
                return;
            }
            foreach (var note in store.Notes.OrderByDescending(n => n.updatedAt).ToList())
                notesList.Children.Add(note.id == openNoteId ? NoteEditor(note) : NoteRow(note));
        }

        // F-63: по щелчку заметка раскрывается для просмотра и редактирования.
        UIElement NoteRow(Note note)
        {
            var title = Ui.Text(note.title, 14, null);
            title.FontWeight = FontWeights.SemiBold;
            title.TextTrimming = TextTrimming.CharacterEllipsis;
            var date = Ui.Text(Ui.FormatDate(note.updatedAt), 12, "TextMuted");
            date.Margin = new Thickness(12, 0, 0, 0);
            var top = new DockPanel();
            DockPanel.SetDock(date, Dock.Right);
            top.Children.Add(date);
            top.Children.Add(title);

            var content = new StackPanel();
            content.Children.Add(top);
            var firstLine = (note.text ?? "").Split('\n').Select(l => l.Trim()).FirstOrDefault(l => l.Length > 0);
            if (firstLine != null)
            {
                var preview = Ui.Text(firstLine, 13, "TextMuted");
                preview.TextTrimming = TextTrimming.CharacterEllipsis;
                preview.Margin = new Thickness(0, 2, 0, 0);
                content.Children.Add(preview);
            }

            var row = new Button { Content = content };
            row.SetResourceReference(FrameworkElement.StyleProperty, "RowButton");
            row.Click += (s, e) =>
            {
                openNoteId = note.id;
                RenderNotes();
            };
            return row;
        }

        // F-64: редактирование и удаление.
        UIElement NoteEditor(Note note)
        {
            var title = Ui.Input("Заголовок заметки", "Input");
            title.Text = note.title;
            title.MaxLength = 200;
            var text = Ui.Input("Текст заметки", "TextArea");
            text.Text = note.text;
            text.MinHeight = 150;
            text.MaxHeight = 400;
            text.Margin = new Thickness(0, 8, 0, 0);
            var error = Ui.Error("Введите заголовок заметки");
            title.TextChanged += (s, e) => error.Visibility = Visibility.Collapsed;

            Action collapse = () =>
            {
                openNoteId = null;
                RenderNotes();
            };
            Action save = () =>
            {
                var v = title.Text.Trim();
                if (v.Length == 0) { error.Visibility = Visibility.Visible; title.Focus(); return; }
                note.title = v;
                note.text = text.Text;
                note.updatedAt = Store.NowMs();
                store.SaveWorkspace();
                collapse();
                Ui.Toast("Заметка сохранена");
            };

            var saveBtn = Ui.TextButton("Сохранить", "BtnPrimary", save);
            var collapseBtn = Ui.TextButton("Свернуть", "Btn", collapse);
            collapseBtn.Margin = new Thickness(8, 0, 0, 0);
            var deleteBtn = Ui.TextButton("Удалить", "BtnDangerGhost", () =>
            {
                if (!Ui.Confirm("Удалить заметку «" + note.title + "»?")) return;
                store.Notes.Remove(note);
                store.SaveWorkspace();
                collapse();
            });
            var buttons = new DockPanel { Margin = new Thickness(0, 10, 0, 0), LastChildFill = false };
            DockPanel.SetDock(deleteBtn, Dock.Right);
            buttons.Children.Add(deleteBtn);
            buttons.Children.Add(saveBtn);
            buttons.Children.Add(collapseBtn);

            var hint = Ui.Text("Изменена " + Ui.FormatDate(note.updatedAt) + ". «Свернуть» закрывает заметку без сохранения правок.", 12, "TextMuted");
            hint.TextWrapping = TextWrapping.Wrap;
            hint.Margin = new Thickness(0, 8, 0, 0);

            var stack = new StackPanel();
            stack.Children.Add(title);
            stack.Children.Add(text);
            stack.Children.Add(error);
            stack.Children.Add(buttons);
            stack.Children.Add(hint);
            stack.KeyDown += (s, e) => { if (e.Key == Key.Escape) { collapse(); e.Handled = true; } };

            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => text.Focus()));
            return Editor(stack);
        }

        static Border Editor(UIElement content)
        {
            var b = new Border
            {
                CornerRadius = new CornerRadius(8),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(10),
                Margin = new Thickness(0, 0, 0, 6),
                Child = content
            };
            b.SetResourceReference(Border.BackgroundProperty, "CardBg");
            b.SetResourceReference(Border.BorderBrushProperty, "Accent");
            return b;
        }

        /* ---------------- Секреты ---------------- */

        UIElement BuildSecrets()
        {
            var header = Ui.SectionHeader("Секреты", "Q3", 17, null);
            header.Children.Add(secretsCounterHost);
            header.Margin = new Thickness(0, 0, 0, 12);

            // Обязательное предупреждение из ТЗ: значения не шифруются.
            var warningText = Ui.Text("Значения хранятся в файле data.json в открытом виде, без шифрования. Это не менеджер паролей: не храните здесь ничего критичного.", 13, "WarnText");
            warningText.TextWrapping = TextWrapping.Wrap;
            var warning = new Border { CornerRadius = new CornerRadius(8), Padding = new Thickness(12, 8, 12, 8), Margin = new Thickness(0, 0, 0, 12), Child = warningText };
            warning.SetResourceReference(Border.BackgroundProperty, "WarnBg");

            var name = Ui.Input("Название, например «API-токен GitHub»", "Input");
            name.MaxLength = 200;
            var value = new PasswordBox { Margin = new Thickness(0, 8, 0, 0), ToolTip = "Значение" };
            value.SetResourceReference(FrameworkElement.StyleProperty, "PasswordInput");
            var valueHint = Ui.Text("Значение", 14, "TextMuted");
            valueHint.IsHitTestVisible = false;
            valueHint.Margin = new Thickness(13, 8, 0, 0);
            valueHint.VerticalAlignment = VerticalAlignment.Center;
            var valueHost = new Grid();
            valueHost.Children.Add(value);
            valueHost.Children.Add(valueHint);
            var error = Ui.Error("Заполните название и значение");

            Action add = () =>
            {
                var n = name.Text.Trim();
                if (n.Length == 0 || value.Password.Length == 0)
                {
                    error.Visibility = Visibility.Visible;
                    if (n.Length == 0) name.Focus(); else value.Focus();
                    return;
                }
                store.Secrets.Add(new Secret { id = Store.NewId(), name = n, value = value.Password, createdAt = Store.NowMs() });
                store.SaveWorkspace();
                name.Clear();
                value.Clear();
                RenderSecrets();
                name.Focus();
            };
            name.TextChanged += (s, e) => error.Visibility = Visibility.Collapsed;
            value.PasswordChanged += (s, e) =>
            {
                error.Visibility = Visibility.Collapsed;
                valueHint.Visibility = value.Password.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
            };
            name.KeyDown += (s, e) => { if (e.Key == Key.Enter) { value.Focus(); e.Handled = true; } };
            value.KeyDown += (s, e) => { if (e.Key == Key.Enter) { add(); e.Handled = true; } };

            var addBtn = Ui.TextButton("Добавить секрет", "BtnPrimary", add);
            addBtn.HorizontalAlignment = HorizontalAlignment.Left;
            addBtn.Margin = new Thickness(0, 8, 0, 0);

            var root = new StackPanel();
            root.Children.Add(header);
            root.Children.Add(warning);
            root.Children.Add(name);
            root.Children.Add(valueHost);
            root.Children.Add(error);
            root.Children.Add(addBtn);
            root.Children.Add(Separator());
            root.Children.Add(secretsList);
            return root;
        }

        void RenderSecrets()
        {
            secretsCounterHost.Child = Ui.Counter(store.Secrets.Count);
            secretsList.Children.Clear();
            if (store.Secrets.Count == 0)
            {
                secretsList.Children.Add(Ui.Empty());
                return;
            }
            foreach (var secret in store.Secrets.ToList())
                secretsList.Children.Add(secret.id == editSecretId ? SecretEditor(secret) : SecretRow(secret));
        }

        // F-66: значение скрыто по умолчанию; маска фиксированной длины не выдаёт длину значения.
        UIElement SecretRow(Secret secret)
        {
            bool shown = revealed.Contains(secret.id);

            var name = Ui.Text(secret.name, 14, null);
            name.FontWeight = FontWeights.SemiBold;
            name.TextWrapping = TextWrapping.Wrap;
            var value = Ui.Text(shown ? secret.value : "••••••••••", 13, "TextMuted");
            value.FontFamily = new FontFamily("Cascadia Mono, Consolas");
            value.TextWrapping = TextWrapping.Wrap;
            var main = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            main.Children.Add(name);
            main.Children.Add(value);

            var toggle = Ui.TextButton(shown ? "Скрыть" : "Показать", "Btn", () =>
            {
                if (shown) revealed.Remove(secret.id); else revealed.Add(secret.id);
                RenderSecrets();
            });
            toggle.Padding = new Thickness(10, 4, 10, 5);
            toggle.FontSize = 13;
            toggle.Margin = new Thickness(0, 0, 4, 0);

            var actions = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0, 0, 0) };
            actions.Children.Add(toggle);
            actions.Children.Add(Ui.IconButton("", "Копировать значение", "BtnPlainIcon", () => Copy(secret.value)));
            actions.Children.Add(Ui.IconButton("", "Изменить", "BtnPlainIcon", () =>
            {
                editSecretId = secret.id;
                RenderSecrets();
            }));
            actions.Children.Add(Ui.IconButton("", "Удалить", "BtnIcon", () =>
            {
                if (!Ui.Confirm("Удалить секрет «" + secret.name + "»?")) return;
                store.Secrets.Remove(secret);
                revealed.Remove(secret.id);
                store.SaveWorkspace();
                RenderSecrets();
            }));

            var dock = new DockPanel();
            DockPanel.SetDock(actions, Dock.Right);
            dock.Children.Add(actions);
            dock.Children.Add(main);

            var row = new Border { CornerRadius = new CornerRadius(8), BorderThickness = new Thickness(1), Padding = new Thickness(12, 8, 8, 8), Margin = new Thickness(0, 0, 0, 6), Child = dock };
            row.SetResourceReference(Border.BackgroundProperty, "CardBg");
            row.SetResourceReference(Border.BorderBrushProperty, "Border");
            row.MouseEnter += (s, e) => row.SetResourceReference(Border.BorderBrushProperty, "TextMuted");
            row.MouseLeave += (s, e) => row.SetResourceReference(Border.BorderBrushProperty, "Border");
            return row;
        }

        // F-67: редактирование секрета.
        UIElement SecretEditor(Secret secret)
        {
            var name = Ui.Input("Название", "Input");
            name.Text = secret.name;
            name.MaxLength = 200;
            var value = Ui.Input("Значение", "Input");
            value.Text = secret.value;
            value.FontFamily = new FontFamily("Cascadia Mono, Consolas");
            value.Margin = new Thickness(0, 8, 0, 0);
            var error = Ui.Error("Заполните название и значение");

            Action cancel = () =>
            {
                editSecretId = null;
                RenderSecrets();
            };
            Action save = () =>
            {
                var n = name.Text.Trim();
                if (n.Length == 0 || value.Text.Length == 0) { error.Visibility = Visibility.Visible; return; }
                secret.name = n;
                secret.value = value.Text;
                store.SaveWorkspace();
                cancel();
                Ui.Toast("Секрет сохранён");
            };
            KeyEventHandler keys = (s, e) =>
            {
                if (e.Key == Key.Enter) { save(); e.Handled = true; }
                else if (e.Key == Key.Escape) { cancel(); e.Handled = true; }
            };
            name.KeyDown += keys;
            value.KeyDown += keys;

            var saveBtn = Ui.TextButton("Сохранить", "BtnPrimary", save);
            var cancelBtn = Ui.TextButton("Отмена", "Btn", cancel);
            cancelBtn.Margin = new Thickness(8, 0, 0, 0);
            var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 10, 0, 0) };
            buttons.Children.Add(saveBtn);
            buttons.Children.Add(cancelBtn);

            var stack = new StackPanel();
            stack.Children.Add(name);
            stack.Children.Add(value);
            stack.Children.Add(error);
            stack.Children.Add(buttons);
            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => name.Focus()));
            return Editor(stack);
        }

        // F-70: копирование одной кнопкой.
        static void Copy(string text)
        {
            try
            {
                Clipboard.SetText(text);
                Ui.Toast("Значение скопировано");
            }
            catch (Exception)
            {
                Ui.Toast("Не удалось скопировать: буфер обмена занят другой программой");
            }
        }
    }
}
