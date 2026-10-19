using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;

namespace TaskTracker
{
    public class ZoneDef
    {
        public readonly string Key;
        public readonly string Title;
        public readonly string ColorKey;

        public ZoneDef(string key, string title, string colorKey)
        {
            Key = key;
            Title = title;
            ColorKey = colorKey;
        }
    }

    public static class Zones
    {
        public static readonly ZoneDef[] Quadrants =
        {
            new ZoneDef("q1", "Важно · Срочно", "Q1"),
            new ZoneDef("q2", "Важно · Не срочно", "Q2"),
            new ZoneDef("q3", "Не важно · Срочно", "Q3"),
            new ZoneDef("q4", "Не важно · Не срочно", "Q4"),
        };

        public static readonly ZoneDef[] Stages =
        {
            new ZoneDef("todo", "TODO", "TextMuted"),
            new ZoneDef("doing", "В работе", "Accent"),
            new ZoneDef("done", "Готово", "Rest"),
        };

        public static ZoneDef Find(ZoneDef[] defs, string key)
        {
            return defs.FirstOrDefault(d => d.Key == key) ?? defs[0];
        }
    }

    // Общая доска для матрицы и канбана: зоны drop (аналог data-zone) + карточки задач.
    // Перерисовывается целиком на каждое изменение Store — задач немного, это укладывается в N-10.
    public abstract class BoardView : ContentControl
    {
        public const string DragFormat = "TaskTracker.TaskId";

        protected readonly Store Store;
        readonly ZoneDef[] zones;
        readonly int wideColumns;
        bool narrow;

        // F-86: щелчок по карточке открывает детали задачи.
        public event Action<string> OpenRequested;

        protected BoardView(Store store, ZoneDef[] zones, int wideColumns)
        {
            Store = store;
            this.zones = zones;
            this.wideColumns = wideColumns;
            Focusable = false;
            store.TasksChanged += Rebuild;
            Rebuild();
        }

        public bool Narrow
        {
            get { return narrow; }
            set
            {
                if (narrow == value) return;
                narrow = value;
                Rebuild();
            }
        }

        protected abstract bool InZone(TaskItem task, string zoneKey);
        protected abstract void MoveTo(string taskId, string zoneKey);
        // Положение задачи на «другой» оси: стадия в матрице, квадрант в канбане.
        protected abstract ZoneDef OtherAxis(TaskItem task);

        public void FocusCard(string id)
        {
            var card = FindCard(Content as DependencyObject, id);
            if (card != null) card.Focus();
        }

        static FrameworkElement FindCard(DependencyObject root, string id)
        {
            if (root == null) return null;
            var fe = root as FrameworkElement;
            if (fe != null && fe.Tag as string == id && fe.Focusable) return fe;
            for (int i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
            {
                var found = FindCard(VisualTreeHelper.GetChild(root, i), id);
                if (found != null) return found;
            }
            return null;
        }

        void Rebuild()
        {
            var grid = new Grid();
            int rows = narrow ? zones.Length : (zones.Length + wideColumns - 1) / wideColumns;
            int cols = narrow ? 1 : wideColumns;
            for (int c = 0; c < cols; c++) grid.ColumnDefinitions.Add(new ColumnDefinition());
            for (int r = 0; r < rows; r++)
                grid.RowDefinitions.Add(new RowDefinition { Height = narrow ? GridLength.Auto : new GridLength(1, GridUnitType.Star) });

            for (int i = 0; i < zones.Length; i++)
            {
                var zone = BuildZone(zones[i]);
                Grid.SetRow(zone, narrow ? i : i / wideColumns);
                Grid.SetColumn(zone, narrow ? 0 : i % wideColumns);
                grid.Children.Add(zone);
            }

            // В широком режиме зоны делят высоту окна и скроллятся сами,
            // в узком — складываются в одну колонку под общим скроллом (N-07).
            Content = narrow ? (UIElement)Ui.Scroller(grid) : grid;
        }

        Border BuildZone(ZoneDef def)
        {
            var items = Store.Tasks.Where(t => InZone(t, def.Key)).OrderBy(t => t.createdAt).ToList();

            var zone = new Border
            {
                CornerRadius = new CornerRadius(12),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(6),
                Padding = new Thickness(12, 12, 6, 6),
                AllowDrop = true,
                MinHeight = narrow ? 110 : 0
            };
            SetHighlight(zone, false);

            var header = Ui.SectionHeader(def.Title, def.ColorKey, 15, items.Count);
            header.Margin = new Thickness(2, 0, 6, 10);

            var list = new StackPanel { Margin = new Thickness(0, 0, 6, 0) };
            if (items.Count == 0) list.Children.Add(Ui.Empty());
            else foreach (var t in items) list.Children.Add(BuildCard(t));

            var dock = new DockPanel();
            DockPanel.SetDock(header, Dock.Top);
            dock.Children.Add(header);
            dock.Children.Add(narrow ? (UIElement)list : Ui.Scroller(list));
            zone.Child = dock;

            WireDrop(zone, def.Key);
            return zone;
        }

        FrameworkElement BuildCard(TaskItem task)
        {
            var card = new Border { Tag = task.id, Focusable = true, FocusVisualStyle = null };
            card.SetResourceReference(FrameworkElement.StyleProperty, "Card");

            bool done = task.status == "done";
            var title = Ui.Text(task.title, 14, done ? "TextMuted" : null);
            title.TextWrapping = TextWrapping.Wrap;
            if (done) title.TextDecorations = TextDecorations.Strikethrough;

            var meta = new WrapPanel { Margin = new Thickness(0, 5, 0, 0) };
            meta.Children.Add(Badge(OtherAxis(task)));
            AddIndicators(meta, task);

            var body = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            body.Children.Add(title);
            body.Children.Add(meta);

            string id = task.id;
            var del = Ui.IconButton("", "Удалить", "BtnIcon", () =>
            {
                var t = Store.Get(id);
                if (t != null && Store.HasDetails(t) &&
                    !Ui.Confirm("Удалить задачу «" + t.title + "» вместе с описанием, чек-листом и ссылками?")) return;
                Later(() => Store.Remove(id));
            });
            del.VerticalAlignment = VerticalAlignment.Top;
            del.Margin = new Thickness(6, -3, 0, 0);

            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition());
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            grid.Children.Add(body);
            Grid.SetColumn(del, 1);
            grid.Children.Add(del);
            card.Child = grid;

            // Фокус с клавиатуры подсвечиваем рамкой акцентного цвета.
            card.GotKeyboardFocus += (s, e) => card.SetResourceReference(Border.BorderBrushProperty, "Accent");
            card.LostKeyboardFocus += (s, e) => card.ClearValue(Border.BorderBrushProperty);
            card.KeyDown += (s, e) =>
            {
                if (e.Key == Key.Enter || e.Key == Key.Space) { RequestOpen(id); e.Handled = true; }
                else if (e.Key == Key.Delete) { del.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent)); e.Handled = true; }
            };

            WireDragAndClick(card, id);
            return card;
        }

        static FrameworkElement Badge(ZoneDef def)
        {
            var dot = new Ellipse { Width = 7, Height = 7, Margin = new Thickness(0, 1, 6, 0), VerticalAlignment = VerticalAlignment.Center };
            dot.SetResourceReference(Shape.FillProperty, def.ColorKey);
            var sp = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 12, 0) };
            sp.Children.Add(dot);
            sp.Children.Add(Ui.Text(def.Title, 12, "TextMuted"));
            return sp;
        }

        // F-85: индикаторы деталей — описание, чек-лист (выполнено/всего), ссылки.
        static void AddIndicators(Panel meta, TaskItem task)
        {
            if (task.description.Trim().Length > 0)
                meta.Children.Add(Indicator("", null, "TextMuted", "Есть описание"));
            if (task.checklist.Count > 0)
            {
                int done = task.checklist.Count(i => i.done);
                int total = task.checklist.Count;
                meta.Children.Add(Indicator("", done + "/" + total, done == total ? "Rest" : "TextMuted",
                    "Чек-лист: выполнено " + done + " из " + total));
            }
            if (task.links.Count > 0)
                meta.Children.Add(Indicator("", task.links.Count.ToString(), "TextMuted", "Ссылок: " + task.links.Count));
        }

        static FrameworkElement Indicator(string glyph, string text, string colorKey, string tooltip)
        {
            var sp = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 12, 0), ToolTip = tooltip, Background = Brushes.Transparent };
            var icon = Ui.Text(glyph, 11, colorKey);
            icon.FontFamily = new FontFamily("Segoe MDL2 Assets");
            icon.VerticalAlignment = VerticalAlignment.Center;
            icon.Margin = new Thickness(0, 1, 4, 0);
            sp.Children.Add(icon);
            if (text != null) sp.Children.Add(Ui.Text(text, 12, colorKey));
            return sp;
        }

        // F-90: перетаскивание не открывает детали — щелчком считается только отпускание кнопки без сдвига.
        void WireDragAndClick(Border card, string id)
        {
            var start = new Point();
            bool armed = false;

            card.PreviewMouseLeftButtonDown += (s, e) =>
            {
                if (Ui.IsInside<ButtonBase>(e.OriginalSource, card)) return;
                start = e.GetPosition(card);
                armed = true;
            };
            card.PreviewMouseLeftButtonUp += (s, e) =>
            {
                if (!armed) return;
                armed = false;
                RequestOpen(id);
            };
            card.PreviewMouseMove += (s, e) =>
            {
                if (!armed) return;
                if (e.LeftButton != MouseButtonState.Pressed) { armed = false; return; }
                var p = e.GetPosition(card);
                if (Math.Abs(p.X - start.X) < SystemParameters.MinimumHorizontalDragDistance &&
                    Math.Abs(p.Y - start.Y) < SystemParameters.MinimumVerticalDragDistance) return;

                armed = false;
                card.Opacity = 0.45;
                try { DragDrop.DoDragDrop(card, new DataObject(DragFormat, id), DragDropEffects.Move); }
                finally { card.Opacity = 1; }
            };
        }

        void RequestOpen(string id)
        {
            if (OpenRequested != null) OpenRequested(id);
        }

        void WireDrop(Border zone, string zoneKey)
        {
            DragEventHandler over = (s, e) =>
            {
                bool ok = e.Data.GetDataPresent(DragFormat);
                e.Effects = ok ? DragDropEffects.Move : DragDropEffects.None;
                if (ok) SetHighlight(zone, true);
                e.Handled = true;
            };
            zone.DragEnter += over;
            zone.DragOver += over;
            zone.DragLeave += (s, e) =>
            {
                // DragLeave приходит и при переходе на дочерний элемент — снимаем подсветку, только если курсор вышел из зоны.
                var p = e.GetPosition(zone);
                if (p.X < 0 || p.Y < 0 || p.X >= zone.ActualWidth || p.Y >= zone.ActualHeight) SetHighlight(zone, false);
            };
            zone.Drop += (s, e) =>
            {
                SetHighlight(zone, false);
                var id = e.Data.GetData(DragFormat) as string;
                if (id != null) Later(() => MoveTo(id, zoneKey));
                e.Handled = true;
            };
        }

        static void SetHighlight(Border zone, bool on)
        {
            zone.SetResourceReference(Border.BackgroundProperty, on ? "AccentSoft" : "Surface");
            zone.SetResourceReference(Border.BorderBrushProperty, on ? "Accent" : "Border");
        }

        // Изменения Store перестраивают дерево, поэтому выполняем их вне текущего обработчика ввода.
        void Later(Action action)
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Normal, action);
        }
    }

    public class MatrixView : BoardView
    {
        public MatrixView(Store store) : base(store, Zones.Quadrants, 2) { }

        protected override bool InZone(TaskItem task, string zoneKey) { return task.quadrant == zoneKey; }
        protected override void MoveTo(string taskId, string zoneKey) { Store.SetQuadrant(taskId, zoneKey); }
        protected override ZoneDef OtherAxis(TaskItem task) { return Zones.Find(Zones.Stages, task.status); }
    }

    public class KanbanView : BoardView
    {
        public KanbanView(Store store) : base(store, Zones.Stages, 3) { }

        protected override bool InZone(TaskItem task, string zoneKey) { return task.status == zoneKey; }
        protected override void MoveTo(string taskId, string zoneKey) { Store.SetStatus(taskId, zoneKey); }
        protected override ZoneDef OtherAxis(TaskItem task) { return Zones.Find(Zones.Quadrants, task.quadrant); }
    }
}
