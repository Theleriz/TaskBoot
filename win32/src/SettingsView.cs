using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Win32;
using Forms = System.Windows.Forms;

namespace TaskTracker
{
    // Выбирает цвета темы по сохранённым настройкам и применяет их.
    public static class ThemeController
    {
        public static void Apply(Store store)
        {
            Color bg, accent;
            Resolve(store, out bg, out accent);
            Theme.ApplyColors(bg, accent);
        }

        static void Resolve(Store store, out Color bg, out Color accent)
        {
            var t = store.Settings.theme;
            bool sysDark = Theme.SystemIsDark();
            bg = sysDark ? Theme.DarkBg : Theme.LightBg;
            accent = sysDark ? Theme.DarkAccent : Theme.LightAccent;

            switch (t.mode)
            {
                case "light":
                    bg = Theme.LightBg; accent = Theme.LightAccent;
                    break;
                case "dark":
                    bg = Theme.DarkBg; accent = Theme.DarkAccent;
                    break;
                case "custom":
                    TryPair(t.customBg, t.customAccent, ref bg, ref accent);
                    break;
                case "random":
                    if (!TryPair(t.randomBg, t.randomAccent, ref bg, ref accent))
                    {
                        Theme.RandomTheme(new Random(), out bg, out accent);
                        t.randomBg = Theme.ToHex(bg);
                        t.randomAccent = Theme.ToHex(accent);
                        store.SaveSettings();
                    }
                    break;
                case "saved":
                    var saved = store.Settings.themes.FirstOrDefault(x => x.id == t.savedId);
                    if (saved != null) TryPair(saved.bg, saved.accent, ref bg, ref accent);
                    break;
            }
        }

        static bool TryPair(string bgHex, string accentHex, ref Color bg, ref Color accent)
        {
            Color b, a;
            if (!Theme.TryParseHex(bgHex, out b) || !Theme.TryParseHex(accentHex, out a)) return false;
            bg = b;
            accent = a;
            return true;
        }

        // Режим «Системная» следует за переключением светлой/тёмной темы Windows.
        public static void FollowSystem(Store store, Window window)
        {
            UserPreferenceChangedEventHandler handler = (s, e) =>
            {
                if (e.Category != UserPreferenceCategory.General) return;
                window.Dispatcher.BeginInvoke(new Action(() =>
                {
                    if (store.Settings.theme.mode == "system") Apply(store);
                }));
            };
            SystemEvents.UserPreferenceChanged += handler;
            window.Closed += (s, e) => SystemEvents.UserPreferenceChanged -= handler;
        }
    }

    // Вкладка «Настройки» (шестерёнка в правом верхнем углу).
    public class SettingsView : ContentControl
    {
        static readonly string[] BackgroundPresets = { "#F3F4F6", "#FFFFFF", "#F5F1E8", "#EDF3EF", "#15171B", "#1B1E2B", "#10161A", "#221A1F" };
        static readonly string[] AccentPresets = { "#3B5BDB", "#7048E8", "#D6336C", "#E8590C", "#2B8A3E", "#0C8599", "#F59F00", "#495057" };

        readonly Store store;
        readonly Random rnd = new Random();
        Random suggestionJitter;
        bool narrow;

        public SettingsView(Store store)
        {
            this.store = store;
            Focusable = false;
            Theme.Changed += Render;
            Render();
        }

        public bool Narrow
        {
            set
            {
                if (narrow == value) return;
                narrow = value;
                Render();
            }
        }

        ThemeSettings T { get { return store.Settings.theme; } }

        void SetMode(string mode)
        {
            T.mode = mode;
            store.SaveSettings();
            ThemeController.Apply(store); // перерисовка придёт через Theme.Changed
        }

        void SetCustom(Color bg, Color accent)
        {
            T.customBg = Theme.ToHex(bg);
            T.customAccent = Theme.ToHex(accent);
            SetMode("custom");
        }

        Color CustomBg
        {
            get
            {
                Color c;
                return Theme.TryParseHex(T.customBg, out c) ? c : Theme.Background;
            }
        }

        Color CustomAccent
        {
            get
            {
                Color c;
                return Theme.TryParseHex(T.customAccent, out c) ? c : Theme.Accent;
            }
        }

        void Render()
        {
            var column = new StackPanel { MaxWidth = 860, Margin = new Thickness(0, 8, 0, 16) };

            var title = Ui.Text("Настройки", 22, null);
            title.FontWeight = FontWeights.SemiBold;
            title.Margin = new Thickness(6, 4, 0, 10);
            column.Children.Add(title);

            column.Children.Add(Box("Тема оформления", "Accent", BuildModes()));
            column.Children.Add(Box("Свои цвета", "Q3", BuildCustom()));
            column.Children.Add(Box("Случайная тема", "Rest", BuildRandom()));
            column.Children.Add(Box("Сохранённые темы", "Q1", BuildSaved()));

            // Перерисовка не должна сбрасывать прокрутку к началу.
            var old = Content as ScrollViewer;
            double offset = old != null ? old.VerticalOffset : 0;
            var scroller = Ui.Scroller(column);
            Content = scroller;
            if (offset > 0)
                Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Loaded,
                    new Action(() => scroller.ScrollToVerticalOffset(offset)));
        }

        /* ---------- Режимы ---------- */

        UIElement BuildModes()
        {
            var modes = new[]
            {
                Tuple.Create("system", "Системная"),
                Tuple.Create("light", "Светлая"),
                Tuple.Create("dark", "Тёмная"),
                Tuple.Create("custom", "Своя"),
                Tuple.Create("random", "Случайная"),
            };
            var chips = new WrapPanel();
            foreach (var m in modes)
            {
                var mode = m.Item1;
                var chip = new RadioButton { Content = m.Item2, GroupName = "themeMode", IsChecked = T.mode == mode };
                chip.SetResourceReference(FrameworkElement.StyleProperty, "Chip");
                chip.Checked += (s, e) => { if (T.mode != mode) SetMode(mode); };
                chips.Children.Add(chip);
            }

            var hint = Ui.Text(ModeHint(), 12, "TextMuted");
            hint.TextWrapping = TextWrapping.Wrap;
            hint.Margin = new Thickness(0, 2, 0, 12);

            var stack = new StackPanel();
            stack.Children.Add(chips);
            stack.Children.Add(hint);
            stack.Children.Add(Preview());
            return stack;
        }

        string ModeHint()
        {
            switch (T.mode)
            {
                case "light": return "Светлая тема.";
                case "dark": return "Тёмная тема.";
                case "custom": return "Цвета задаются ниже, в разделе «Свои цвета».";
                case "random": return "Случайное сочетание. Новое — кнопкой «Сгенерировать» ниже.";
                case "saved":
                    var saved = store.Settings.themes.FirstOrDefault(x => x.id == T.savedId);
                    return saved != null ? "Сохранённая тема «" + saved.name + "»." : "Сохранённая тема.";
                default: return "Светлая или тёмная — как в настройках Windows.";
            }
        }

        // Мини-превью текущей палитры: поверхность, карточка, акцентная кнопка и текст.
        UIElement Preview()
        {
            var keys = new[] { "Bg", "Surface", "CardBg", "Border", "Accent", "AccentSoft", "Text", "TextMuted" };
            var row = new WrapPanel();
            foreach (var key in keys)
            {
                var sw = new Border
                {
                    Width = 30,
                    Height = 30,
                    CornerRadius = new CornerRadius(8),
                    BorderThickness = new Thickness(1),
                    Margin = new Thickness(0, 0, 6, 6),
                    ToolTip = key
                };
                sw.SetResourceReference(Border.BackgroundProperty, key);
                sw.SetResourceReference(Border.BorderBrushProperty, "Border");
                row.Children.Add(sw);
            }
            var label = Ui.Text("Фон " + Theme.ToHex(Theme.Background) + " · акцент " + Theme.ToHex(Theme.Accent), 12, "TextMuted");
            label.Margin = new Thickness(0, 2, 0, 0);
            var stack = new StackPanel();
            stack.Children.Add(row);
            stack.Children.Add(label);
            return stack;
        }

        /* ---------- Свои цвета ---------- */

        UIElement BuildCustom()
        {
            var bg = CustomBg;
            var accent = CustomAccent;
            var stack = new StackPanel();

            var note = Ui.Text("Любое изменение здесь включает режим «Своя».", 12, "TextMuted");
            note.Margin = new Thickness(0, 0, 0, 12);
            stack.Children.Add(note);

            stack.Children.Add(ColorRow("Фон", bg, c => SetCustom(c, CustomAccent)));
            stack.Children.Add(SwatchRow(BackgroundPresets.Select(Theme.Hex), bg, c => SetCustom(c, CustomAccent)));

            stack.Children.Add(ColorRow("Акцент", accent, c => SetCustom(CustomBg, c)));
            stack.Children.Add(SwatchRow(AccentPresets.Select(Theme.Hex), accent, c => SetCustom(CustomBg, c)));

            // Подбор под акцент.
            var bgLabel = Label("Фоны, подходящие к акценту");
            var more = Ui.TextButton("Ещё варианты", "Btn", () =>
            {
                suggestionJitter = new Random(rnd.Next());
                Render();
            });
            more.Padding = new Thickness(10, 4, 10, 5);
            more.FontSize = 13;
            var bgHead = new DockPanel { Margin = new Thickness(0, 6, 0, 6) };
            DockPanel.SetDock(more, Dock.Right);
            bgHead.Children.Add(more);
            bgHead.Children.Add(bgLabel);
            stack.Children.Add(bgHead);
            stack.Children.Add(SwatchRow(Theme.SuggestBackgrounds(accent, suggestionJitter), bg, c => SetCustom(c, CustomAccent)));

            var accLabel = Label("Сочетающиеся акценты");
            accLabel.Margin = new Thickness(0, 6, 0, 6);
            stack.Children.Add(accLabel);
            stack.Children.Add(SwatchRow(Theme.SuggestAccents(accent), accent, c => SetCustom(CustomBg, c)));
            return stack;
        }

        UIElement ColorRow(string label, Color value, Action<Color> onChange)
        {
            var swatch = Swatch(value, false, null);
            swatch.Width = 36;
            swatch.Height = 36;
            swatch.Margin = new Thickness(0, 0, 10, 0);
            swatch.Cursor = Cursors.Arrow;

            var hex = Ui.Input("#RRGGBB", "Input");
            hex.Text = Theme.ToHex(value);
            hex.Width = 120;
            hex.MaxLength = 7;
            hex.FontFamily = new FontFamily("Cascadia Mono, Consolas");
            Action apply = () =>
            {
                Color c;
                if (Theme.TryParseHex(hex.Text, out c))
                {
                    if (c != value) onChange(c);
                    else hex.ClearValue(Control.BorderBrushProperty);
                }
                else hex.SetResourceReference(Control.BorderBrushProperty, "Danger");
            };
            hex.KeyDown += (s, e) => { if (e.Key == Key.Enter) { apply(); e.Handled = true; } };
            hex.LostKeyboardFocus += (s, e) => apply();

            var pick = Ui.TextButton("Выбрать…", "Btn", () =>
            {
                using (var dialog = new Forms.ColorDialog { FullOpen = true, AnyColor = true })
                {
                    dialog.Color = System.Drawing.Color.FromArgb(value.R, value.G, value.B);
                    if (dialog.ShowDialog() == Forms.DialogResult.OK)
                        onChange(Color.FromRgb(dialog.Color.R, dialog.Color.G, dialog.Color.B));
                }
            });
            pick.Margin = new Thickness(8, 0, 0, 0);

            var name = Ui.Text(label, 14, null);
            name.Width = 70;
            name.VerticalAlignment = VerticalAlignment.Center;

            var row = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 8) };
            row.Children.Add(name);
            row.Children.Add(swatch);
            row.Children.Add(hex);
            row.Children.Add(pick);
            return row;
        }

        WrapPanel SwatchRow(System.Collections.Generic.IEnumerable<Color> colors, Color current, Action<Color> onPick)
        {
            var row = new WrapPanel { Margin = new Thickness(narrow ? 0 : 80, 0, 0, 10) };
            foreach (var c in colors)
            {
                var color = c;
                row.Children.Add(Swatch(color, color == current, () => onPick(color)));
            }
            return row;
        }

        static Border Swatch(Color color, bool selected, Action onClick)
        {
            var b = new Border
            {
                Width = 28,
                Height = 28,
                CornerRadius = new CornerRadius(7),
                BorderThickness = new Thickness(selected ? 2.5 : 1),
                Margin = new Thickness(0, 0, 6, 6),
                Background = new SolidColorBrush(color),
                ToolTip = Theme.ToHex(color),
                Cursor = onClick != null ? Cursors.Hand : Cursors.Arrow
            };
            string normalKey = selected ? "Accent" : "Border";
            b.SetResourceReference(Border.BorderBrushProperty, normalKey);
            if (onClick != null)
            {
                b.MouseEnter += (s, e) => b.SetResourceReference(Border.BorderBrushProperty, selected ? "Accent" : "TextMuted");
                b.MouseLeave += (s, e) => b.SetResourceReference(Border.BorderBrushProperty, normalKey);
                b.MouseLeftButtonUp += (s, e) => onClick();
            }
            return b;
        }

        /* ---------- Случайная тема ---------- */

        UIElement BuildRandom()
        {
            var text = Ui.Text("Случайный акцент и подходящий к нему светлый или тёмный фон.", 13, "TextMuted");
            text.TextWrapping = TextWrapping.Wrap;
            text.Margin = new Thickness(0, 0, 0, 10);

            var generate = Ui.TextButton("Сгенерировать", "BtnPrimary", () =>
            {
                Color bg, accent;
                Theme.RandomTheme(rnd, out bg, out accent);
                T.randomBg = Theme.ToHex(bg);
                T.randomAccent = Theme.ToHex(accent);
                SetMode("random");
            });
            generate.HorizontalAlignment = HorizontalAlignment.Left;

            var stack = new StackPanel();
            stack.Children.Add(text);
            var row = new StackPanel { Orientation = Orientation.Horizontal };
            row.Children.Add(generate);
            Color rb, ra;
            if (Theme.TryParseHex(T.randomBg, out rb) && Theme.TryParseHex(T.randomAccent, out ra))
            {
                var last = Ui.Text("Последняя:", 13, "TextMuted");
                last.VerticalAlignment = VerticalAlignment.Center;
                last.Margin = new Thickness(14, 0, 8, 0);
                row.Children.Add(last);
                var pair = Pair(rb, ra);
                pair.VerticalAlignment = VerticalAlignment.Center;
                row.Children.Add(pair);
            }
            stack.Children.Add(row);
            return stack;
        }

        /* ---------- Сохранённые темы ---------- */

        UIElement BuildSaved()
        {
            var name = Ui.Input("Название темы", "Input");
            name.MaxLength = 60;
            var error = Ui.Error("Введите название темы");
            name.TextChanged += (s, e) => error.Visibility = Visibility.Collapsed;
            Action save = () =>
            {
                var n = name.Text.Trim();
                if (n.Length == 0) { error.Visibility = Visibility.Visible; name.Focus(); return; }
                var theme = new SavedTheme { id = Store.NewId(), name = n, bg = Theme.ToHex(Theme.Background), accent = Theme.ToHex(Theme.Accent) };
                store.Settings.themes.Add(theme);
                T.savedId = theme.id;
                T.mode = "saved";
                store.SaveSettings();
                Ui.Toast("Тема «" + n + "» сохранена");
                Render();
            };
            name.KeyDown += (s, e) => { if (e.Key == Key.Enter) { save(); e.Handled = true; } };
            var saveBtn = Ui.TextButton("Сохранить текущую", "BtnPrimary", save);
            saveBtn.Margin = new Thickness(8, 0, 0, 0);

            var form = new DockPanel();
            DockPanel.SetDock(saveBtn, Dock.Right);
            form.Children.Add(saveBtn);
            form.Children.Add(name);

            var list = new StackPanel { Margin = new Thickness(0, 12, 0, 0) };
            if (store.Settings.themes.Count == 0) list.Children.Add(Ui.Empty());
            foreach (var theme in store.Settings.themes.ToList())
            {
                var t = theme;
                Color bg, accent;
                if (!Theme.TryParseHex(t.bg, out bg) || !Theme.TryParseHex(t.accent, out accent)) continue;
                bool active = T.mode == "saved" && T.savedId == t.id;

                var label = Ui.Text(t.name, 14, null);
                label.FontWeight = active ? FontWeights.SemiBold : FontWeights.Normal;
                label.VerticalAlignment = VerticalAlignment.Center;
                label.TextTrimming = TextTrimming.CharacterEllipsis;
                var pair = Pair(bg, accent);
                pair.Margin = new Thickness(0, 0, 12, 0);
                var content = new DockPanel();
                DockPanel.SetDock(pair, Dock.Left);
                content.Children.Add(pair);
                if (active)
                {
                    var mark = Ui.Text("используется", 12, "Accent");
                    mark.VerticalAlignment = VerticalAlignment.Center;
                    DockPanel.SetDock(mark, Dock.Right);
                    content.Children.Add(mark);
                }
                content.Children.Add(label);

                var apply = new Button { Content = content, ToolTip = "Применить" };
                apply.SetResourceReference(FrameworkElement.StyleProperty, "RowButton");
                if (active) apply.SetResourceReference(Control.BorderBrushProperty, "Accent");
                apply.Margin = new Thickness(0);
                apply.Click += (s, e) =>
                {
                    T.savedId = t.id;
                    SetMode("saved");
                };

                var del = Ui.IconButton("", "Удалить тему", "BtnIcon", () =>
                {
                    if (!Ui.Confirm("Удалить тему «" + t.name + "»?")) return;
                    store.Settings.themes.Remove(t);
                    bool wasActive = T.mode == "saved" && T.savedId == t.id;
                    if (wasActive)
                    {
                        // Удалили активную — оставляем её цвета как «Свою», чтобы оформление не прыгало.
                        T.customBg = t.bg;
                        T.customAccent = t.accent;
                        SetMode("custom");
                    }
                    else
                    {
                        store.SaveSettings();
                        Render();
                    }
                });
                del.Margin = new Thickness(6, 0, 0, 0);

                var row = new DockPanel { Margin = new Thickness(0, 0, 0, 6) };
                DockPanel.SetDock(del, Dock.Right);
                row.Children.Add(del);
                row.Children.Add(apply);
                list.Children.Add(row);
            }

            var stack = new StackPanel();
            stack.Children.Add(form);
            stack.Children.Add(error);
            stack.Children.Add(list);
            return stack;
        }

        // Две плашки: фон и акцент.
        static StackPanel Pair(Color bg, Color accent)
        {
            var sp = new StackPanel { Orientation = Orientation.Horizontal };
            foreach (var c in new[] { bg, accent })
            {
                var b = new Border
                {
                    Width = 22,
                    Height = 22,
                    CornerRadius = new CornerRadius(6),
                    BorderThickness = new Thickness(1),
                    Margin = new Thickness(0, 0, 4, 0),
                    Background = new SolidColorBrush(c),
                    ToolTip = Theme.ToHex(c)
                };
                b.SetResourceReference(Border.BorderBrushProperty, "Border");
                sp.Children.Add(b);
            }
            return sp;
        }

        /* ---------- Общие элементы ---------- */

        static TextBlock Label(string text)
        {
            var tb = Ui.Text(text, 13, "TextMuted");
            tb.VerticalAlignment = VerticalAlignment.Center;
            return tb;
        }

        static Border Box(string title, string colorKey, UIElement content)
        {
            var header = Ui.SectionHeader(title, colorKey, 16, null);
            header.Margin = new Thickness(0, 0, 0, 12);
            var stack = new StackPanel();
            stack.Children.Add(header);
            stack.Children.Add(content);

            var b = new Border
            {
                CornerRadius = new CornerRadius(12),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(18, 16, 18, 16),
                Margin = new Thickness(6, 0, 6, 12),
                Child = stack
            };
            b.SetResourceReference(Border.BackgroundProperty, "Surface");
            b.SetResourceReference(Border.BorderBrushProperty, "Border");
            return b;
        }
    }
}
