using System;
using System.Diagnostics;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace TaskTracker
{
    // F-83 / F-86: панель деталей задачи поверх доски, справа.
    // Закрывается по Esc, крестику и щелчку по затемнённому фону (N-24).
    public class DetailsPanel : Grid
    {
        readonly Store store;
        readonly Border backdrop;
        readonly Border sheet;
        TaskItem task;
        string editingLinkId;
        bool narrow;

        public event Action<string> Closed;

        public DetailsPanel(Store store)
        {
            this.store = store;
            Visibility = Visibility.Collapsed;

            backdrop = new Border();
            backdrop.SetResourceReference(Border.BackgroundProperty, "Overlay");
            backdrop.MouseLeftButtonDown += (s, e) => { Close(); e.Handled = true; };

            sheet = new Border
            {
                HorizontalAlignment = HorizontalAlignment.Right,
                Width = 540,
                BorderThickness = new Thickness(1, 0, 0, 0)
            };
            sheet.SetResourceReference(Border.BackgroundProperty, "Surface");
            sheet.SetResourceReference(Border.BorderBrushProperty, "Border");

            Children.Add(backdrop);
            Children.Add(sheet);

            // Задачу удалили или изменили снаружи (например, с доски) — обновляем или закрываем.
            store.TasksChanged += () =>
            {
                if (task != null && store.Get(task.id) == null) Close();
            };
        }

        public bool IsOpen { get { return task != null; } }

        public bool Narrow
        {
            set
            {
                narrow = value;
                sheet.Width = value ? double.NaN : 540;
                sheet.HorizontalAlignment = value ? HorizontalAlignment.Stretch : HorizontalAlignment.Right;
            }
        }

        public void Open(string id)
        {
            var t = store.Get(id);
            if (t == null) return;
            task = t;
            editingLinkId = null;
            Render();
            Visibility = Visibility.Visible;
            sheet.Focusable = true;
            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => sheet.Focus()));
        }

        public void Close()
        {
            if (task == null) return;
            store.Flush();
            var id = task.id;
            task = null;
            Visibility = Visibility.Collapsed;
            sheet.Child = null;
            if (Closed != null) Closed(id);
        }

        void Render()
        {
            var t = task;

            // Заголовок. F-08: пустой не сохраняется, при потере фокуса возвращается прежний.
            var title = Ui.Input("Заголовок задачи", "InlineInput");
            title.Text = t.title;
            title.FontSize = 19;
            title.FontWeight = FontWeights.SemiBold;
            title.MaxLength = 200;
            title.Margin = new Thickness(-7, 0, 0, 0);
            var titleError = Ui.Error("Заголовок не может быть пустым");
            title.TextChanged += (s, e) =>
            {
                var v = title.Text.Trim();
                titleError.Visibility = v.Length > 0 ? Visibility.Collapsed : Visibility.Visible;
                if (v.Length == 0 || v == t.title) return;
                t.title = v;
                store.TaskEditedDeferred();
            };
            title.LostKeyboardFocus += (s, e) => { title.Text = t.title; titleError.Visibility = Visibility.Collapsed; };
            title.KeyDown += (s, e) => { if (e.Key == Key.Enter) { sheet.Focus(); e.Handled = true; } };

            var titleBox = new StackPanel();
            titleBox.Children.Add(title);
            titleBox.Children.Add(titleError);

            var close = Ui.IconButton("", "Закрыть (Esc)", "BtnPlainIcon", Close);
            close.Margin = new Thickness(8, 2, 0, 0);
            close.VerticalAlignment = VerticalAlignment.Top;

            var head = new DockPanel { Margin = new Thickness(20, 16, 14, 12) };
            DockPanel.SetDock(close, Dock.Right);
            head.Children.Add(close);
            head.Children.Add(titleBox);

            // Положение задачи: квадрант и стадия.
            var position = new StackPanel();
            position.Children.Add(Label("Квадрант"));
            position.Children.Add(Chips(Zones.Quadrants, t.quadrant, "dq", key => store.SetQuadrant(t.id, key)));
            position.Children.Add(Label("Стадия"));
            position.Children.Add(Chips(Zones.Stages, t.status, "ds", key => store.SetStatus(t.id, key)));

            // F-80: описание.
            var description = Ui.Input("Добавьте описание…", "TextArea");
            description.Text = t.description;
            description.MinHeight = 110;
            description.MaxHeight = 320;
            description.TextChanged += (s, e) =>
            {
                t.description = description.Text;
                store.TaskEditedDeferred();
            };
            var descriptionSec = new StackPanel();
            descriptionSec.Children.Add(SecHead("Описание", null));
            descriptionSec.Children.Add(description);

            var checklistSec = new StackPanel();
            var linksSec = new StackPanel();
            RenderChecklist(checklistSec, false);
            RenderLinks(linksSec);

            var body = new StackPanel();
            body.Children.Add(Section(position));
            body.Children.Add(Section(descriptionSec));
            body.Children.Add(Section(checklistSec));
            body.Children.Add(Section(linksSec, true));

            var created = Ui.Text("Создана " + Ui.FormatDate(t.createdAt), 12, "TextMuted");
            created.VerticalAlignment = VerticalAlignment.Center;
            var delete = Ui.TextButton("Удалить задачу", "BtnDangerGhost", () =>
            {
                if (!Ui.Confirm("Удалить задачу «" + t.title + "»?")) return;
                var id = t.id;
                Close();
                store.Remove(id);
            });
            delete.FontSize = 13;
            var foot = new DockPanel { Margin = new Thickness(20, 8, 14, 8) };
            DockPanel.SetDock(delete, Dock.Right);
            foot.Children.Add(delete);
            foot.Children.Add(created);

            var headBorder = new Border { BorderThickness = new Thickness(0, 0, 0, 1), Child = head };
            headBorder.SetResourceReference(Border.BorderBrushProperty, "Border");
            var footBorder = new Border { BorderThickness = new Thickness(0, 1, 0, 0), Child = foot };
            footBorder.SetResourceReference(Border.BorderBrushProperty, "Border");

            var dock = new DockPanel();
            DockPanel.SetDock(headBorder, Dock.Top);
            DockPanel.SetDock(footBorder, Dock.Bottom);
            dock.Children.Add(headBorder);
            dock.Children.Add(footBorder);
            dock.Children.Add(Ui.Scroller(body));
            sheet.Child = dock;
        }

        // F-81: чек-лист.
        void RenderChecklist(StackPanel sec, bool focusAdd)
        {
            var t = task;
            sec.Children.Clear();
            int total = t.checklist.Count;
            int done = t.checklist.Count(i => i.done);
            sec.Children.Add(SecHead("Чек-лист", total > 0 ? "выполнено " + done + " из " + total : null));

            if (total > 0)
            {
                var track = new Border { Height = 4, CornerRadius = new CornerRadius(2), Margin = new Thickness(0, -2, 0, 10) };
                track.SetResourceReference(Border.BackgroundProperty, "Surface2");
                var fill = new Border { CornerRadius = new CornerRadius(2), RenderTransformOrigin = new Point(0, 0.5), RenderTransform = new ScaleTransform((double)done / total, 1) };
                fill.SetResourceReference(Border.BackgroundProperty, "Rest");
                track.Child = fill;
                sec.Children.Add(track);
            }

            foreach (var item in t.checklist.ToList())
            {
                var it = item;
                var box = new CheckBox { IsChecked = it.done, Margin = new Thickness(2, 0, 6, 0), ToolTip = "Выполнено" };
                box.SetResourceReference(FrameworkElement.StyleProperty, "Check");
                box.Click += (s, e) =>
                {
                    it.done = box.IsChecked == true;
                    store.TaskEdited();
                    RenderChecklist(sec, false);
                };

                var text = Ui.Input("", "InlineInput");
                text.Text = it.text;
                text.MaxLength = 300;
                if (it.done) text.SetResourceReference(Control.ForegroundProperty, "TextMuted");
                text.TextChanged += (s, e) =>
                {
                    var v = text.Text.Trim();
                    if (v.Length == 0 || v == it.text) return;
                    it.text = v;
                    store.TaskEditedDeferred();
                };
                text.LostKeyboardFocus += (s, e) => text.Text = it.text;
                text.KeyDown += (s, e) => { if (e.Key == Key.Enter) { sheet.Focus(); e.Handled = true; } };

                var del = Ui.IconButton("", "Удалить пункт", "BtnIcon", () =>
                {
                    t.checklist.Remove(it);
                    store.TaskEdited();
                    RenderChecklist(sec, false);
                });

                var row = new DockPanel { Margin = new Thickness(0, 1, 0, 1) };
                DockPanel.SetDock(box, Dock.Left);
                DockPanel.SetDock(del, Dock.Right);
                row.Children.Add(box);
                row.Children.Add(del);
                row.Children.Add(text);
                sec.Children.Add(row);
            }

            var add = Ui.Input("Новый пункт…", "Input");
            add.MaxLength = 300;
            Action submit = () =>
            {
                var v = add.Text.Trim();
                if (v.Length == 0) { add.Focus(); return; }
                t.checklist.Add(new CheckItem { id = Store.NewId(), text = v, done = false });
                store.TaskEdited();
                RenderChecklist(sec, true);
            };
            add.KeyDown += (s, e) => { if (e.Key == Key.Enter) { submit(); e.Handled = true; } };
            var addBtn = Ui.TextButton("Добавить", "Btn", () => submit());
            addBtn.Margin = new Thickness(8, 0, 0, 0);

            var addRow = new DockPanel { Margin = new Thickness(0, 8, 0, 0) };
            DockPanel.SetDock(addBtn, Dock.Right);
            addRow.Children.Add(addBtn);
            addRow.Children.Add(add);
            sec.Children.Add(addRow);
            if (focusAdd) Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => add.Focus()));
        }

        // F-82: ссылки.
        void RenderLinks(StackPanel sec)
        {
            var t = task;
            sec.Children.Clear();
            sec.Children.Add(SecHead("Ссылки", t.links.Count > 0 ? t.links.Count.ToString() : null));

            foreach (var link in t.links.ToList())
            {
                var l = link;
                if (editingLinkId == l.id)
                {
                    var editor = LinkForm(l.url, l.label, "Сохранить", (url, label) =>
                    {
                        l.url = url;
                        l.label = label;
                        editingLinkId = null;
                        store.TaskEdited();
                        RenderLinks(sec);
                    }, () =>
                    {
                        editingLinkId = null;
                        RenderLinks(sec);
                    });
                    editor.Margin = new Thickness(0, 4, 0, 8);
                    sec.Children.Add(editor);
                    continue;
                }

                var icon = Ui.Text("", 14, "Accent");
                icon.FontFamily = new FontFamily("Segoe MDL2 Assets");
                icon.VerticalAlignment = VerticalAlignment.Center;
                icon.Margin = new Thickness(0, 0, 10, 0);
                var labelText = Ui.Text(string.IsNullOrEmpty(l.label) ? Host(l.url) : l.label, 14, null);
                labelText.TextTrimming = TextTrimming.CharacterEllipsis;
                var urlText = Ui.Text(l.url, 12, "TextMuted");
                urlText.TextTrimming = TextTrimming.CharacterEllipsis;
                var texts = new StackPanel();
                texts.Children.Add(labelText);
                texts.Children.Add(urlText);
                var content = new DockPanel();
                DockPanel.SetDock(icon, Dock.Left);
                content.Children.Add(icon);
                content.Children.Add(texts);

                // F-88: ссылка открывается в браузере по умолчанию, в новой вкладке.
                var open = new Button { Content = content, ToolTip = l.url };
                open.SetResourceReference(FrameworkElement.StyleProperty, "LinkRow");
                open.Click += (s, e) => OpenUrl(l.url);

                var edit = Ui.IconButton("", "Изменить ссылку", "BtnPlainIcon", () =>
                {
                    editingLinkId = l.id;
                    RenderLinks(sec);
                });
                var del = Ui.IconButton("", "Удалить ссылку", "BtnIcon", () =>
                {
                    t.links.Remove(l);
                    store.TaskEdited();
                    RenderLinks(sec);
                });

                var row = new DockPanel { Margin = new Thickness(0, 0, 0, 2) };
                DockPanel.SetDock(del, Dock.Right);
                DockPanel.SetDock(edit, Dock.Right);
                row.Children.Add(del);
                row.Children.Add(edit);
                row.Children.Add(open);
                sec.Children.Add(row);
            }

            var addForm = LinkForm("", "", "Добавить ссылку", (url, label) =>
            {
                t.links.Add(new LinkItem { id = Store.NewId(), url = url, label = label });
                store.TaskEdited();
                RenderLinks(sec);
            }, null);
            addForm.Margin = new Thickness(0, 8, 0, 0);
            sec.Children.Add(addForm);
        }

        FrameworkElement LinkForm(string urlValue, string labelValue, string submitText, Action<string, string> onSubmit, Action onCancel)
        {
            var url = Ui.Input("https://…", "Input");
            url.Text = urlValue;
            var label = Ui.Input("Подпись (необязательно)", "Input");
            label.Text = labelValue;
            label.MaxLength = 200;
            var error = Ui.Error("Введите корректный адрес, например https://example.com");
            url.TextChanged += (s, e) =>
            {
                error.Visibility = Visibility.Collapsed;
                url.ClearValue(Control.BorderBrushProperty);
            };

            Action submit = () =>
            {
                var normalized = Store.NormalizeUrl(url.Text);
                if (normalized == null)
                {
                    error.Visibility = Visibility.Visible;
                    url.SetResourceReference(Control.BorderBrushProperty, "Danger");
                    url.Focus();
                    return;
                }
                onSubmit(normalized, label.Text.Trim());
            };
            KeyEventHandler keys = (s, e) =>
            {
                if (e.Key == Key.Enter) { submit(); e.Handled = true; }
                else if (e.Key == Key.Escape && onCancel != null) { onCancel(); e.Handled = true; }
            };
            url.KeyDown += keys;
            label.KeyDown += keys;

            var fields = new UniformGrid { Columns = narrow ? 1 : 2 };
            url.Margin = narrow ? new Thickness(0, 0, 0, 8) : new Thickness(0, 0, 4, 0);
            label.Margin = narrow ? new Thickness(0) : new Thickness(4, 0, 0, 0);
            fields.Children.Add(url);
            fields.Children.Add(label);

            var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 8, 0, 0) };
            buttons.Children.Add(Ui.TextButton(submitText, "Btn", () => submit()));
            if (onCancel != null)
            {
                var cancel = Ui.TextButton("Отмена", "BtnDangerGhost", onCancel);
                cancel.Margin = new Thickness(8, 0, 0, 0);
                buttons.Children.Add(cancel);
                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => url.Focus()));
            }

            var form = new StackPanel();
            form.Children.Add(fields);
            form.Children.Add(error);
            form.Children.Add(buttons);
            return form;
        }

        static void OpenUrl(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                Ui.Toast("Не удалось открыть ссылку: " + ex.Message);
            }
        }

        static string Host(string url)
        {
            Uri uri;
            if (!Uri.TryCreate(url, UriKind.Absolute, out uri)) return url;
            return uri.Host.StartsWith("www.") ? uri.Host.Substring(4) : uri.Host;
        }

        static WrapPanel Chips(ZoneDef[] defs, string current, string group, Action<string> onSelect)
        {
            var panel = new WrapPanel { Margin = new Thickness(0, 0, 0, 6) };
            foreach (var def in defs)
            {
                var d = def;
                var dot = new System.Windows.Shapes.Ellipse { Width = 7, Height = 7, Margin = new Thickness(0, 1, 7, 0), VerticalAlignment = VerticalAlignment.Center };
                dot.SetResourceReference(System.Windows.Shapes.Shape.FillProperty, d.ColorKey);
                var content = new StackPanel { Orientation = Orientation.Horizontal };
                content.Children.Add(dot);
                content.Children.Add(new TextBlock { Text = d.Title });

                var chip = new RadioButton { Content = content, GroupName = group, IsChecked = d.Key == current };
                chip.SetResourceReference(FrameworkElement.StyleProperty, "Chip");
                chip.Checked += (s, e) => onSelect(d.Key);
                panel.Children.Add(chip);
            }
            return panel;
        }

        static TextBlock Label(string text)
        {
            var tb = Ui.Text(text, 12, "TextMuted");
            tb.Margin = new Thickness(0, 0, 0, 6);
            return tb;
        }

        static DockPanel SecHead(string title, string note)
        {
            var dock = new DockPanel { Margin = new Thickness(0, 0, 0, 10) };
            if (note != null)
            {
                var n = Ui.Text(note, 12, "TextMuted");
                n.VerticalAlignment = VerticalAlignment.Bottom;
                DockPanel.SetDock(n, Dock.Right);
                dock.Children.Add(n);
            }
            var h = Ui.Text(title, 14, null);
            h.FontWeight = FontWeights.SemiBold;
            dock.Children.Add(h);
            return dock;
        }

        static Border Section(UIElement content, bool last = false)
        {
            var b = new Border
            {
                Padding = new Thickness(20, 16, 20, 16),
                BorderThickness = new Thickness(0, 0, 0, last ? 0 : 1),
                Child = content
            };
            b.SetResourceReference(Border.BorderBrushProperty, "Border");
            return b;
        }
    }
}
