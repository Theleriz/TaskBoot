using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using System.Windows.Shell;

namespace TaskTracker
{
    public class MainWindow : Window
    {
        const double NarrowWidth = 720;
        const int SettingsTab = 4;
        static readonly string[] TabNames = { "Эйзенхауэр", "Канбан", "Pomodoro", "Пространство" };

        readonly Store store;
        readonly PomodoroController pomo;
        readonly MatrixView matrix;
        readonly KanbanView kanban;
        readonly PomodoroView pomoView;
        readonly WorkspaceView workspace;
        readonly DetailsPanel details;
        readonly ContentControl host = new ContentControl { Focusable = false };
        // Последняя «вкладка» — шестерёнка настроек в правом углу шапки.
        readonly RadioButton[] tabs = new RadioButton[TabNames.Length + 1];
        readonly SettingsView settings;

        Border widget;
        Ellipse widgetDot;
        TextBlock widgetLabel;
        TextBlock widgetTime;
        bool pulsing;

        Border addBar;
        TextBox addBox;
        TextBlock addError;
        TextBlock addHint;

        int tab = -1;
        bool narrow;

        public MainWindow(Store store)
        {
            this.store = store;
            pomo = new PomodoroController(store);
            matrix = new MatrixView(store);
            kanban = new KanbanView(store);
            pomoView = new PomodoroView(pomo);
            workspace = new WorkspaceView(store);
            details = new DetailsPanel(store);
            settings = new SettingsView(store);
            matrix.OpenRequested += details.Open;
            kanban.OpenRequested += details.Open;
            details.Closed += id =>
            {
                // Возвращаем фокус на карточку, с которой открывали детали.
                var board = host.Content as BoardView;
                if (board != null) board.FocusCard(id);
            };

            Title = "Task Tracker";
            Width = 1120;
            Height = 760;
            MinWidth = 480;
            MinHeight = 520;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            FontFamily = new FontFamily("Segoe UI Variable Text, Segoe UI");
            FontSize = 14;
            UseLayoutRounding = true;
            SetResourceReference(BackgroundProperty, "Bg");
            SetResourceReference(ForegroundProperty, "Text");
            Icon = Ui.AppIcon();
            TaskbarItemInfo = new TaskbarItemInfo();

            var root = new Grid();
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition());

            var header = BuildHeader();
            addBar = BuildAddBar();
            host.Margin = new Thickness(10, 4, 10, 10);
            Grid.SetRow(addBar, 1);
            Grid.SetRow(host, 2);
            root.Children.Add(header);
            root.Children.Add(addBar);
            root.Children.Add(host);
            Grid.SetRowSpan(details, 3);
            root.Children.Add(details);
            root.Children.Add(BuildToast());
            Content = root;

            root.SizeChanged += (s, e) => ApplyNarrow(e.NewSize.Width <= NarrowWidth);
            pomo.Changed += RefreshWidget;
            PreviewKeyDown += OnShortcut;
            KeyDown += (s, e) =>
            {
                // Esc закрывает детали задачи, если его не обработал вложенный редактор (N-24).
                if (e.Key == Key.Escape && details.IsOpen) { details.Close(); e.Handled = true; }
            };
            Closing += (s, e) => store.Flush();

            var notifier = new Notifier(this);
            pomo.TimerFinished += notifier.TimerFinished;
            Closed += (s, e) => notifier.Dispose();
            SourceInitialized += (s, e) => ApplyTitleBarTheme();
            Theme.Changed += ApplyTitleBarTheme;
            Closed += (s, e) => Theme.Changed -= ApplyTitleBarTheme;
            ThemeController.FollowSystem(store, this);

            SelectTab(0);
        }

        // F-50 / F-40: вкладки слева, виджет таймера справа.
        UIElement BuildHeader()
        {
            var bar = new DockPanel { LastChildFill = false };

            var gearIcon = new TextBlock { Text = "", FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 16 };
            var gear = new RadioButton { Content = gearIcon, GroupName = "tabs", ToolTip = "Настройки", Margin = new Thickness(8, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
            gear.SetResourceReference(FrameworkElement.StyleProperty, "TabButton");
            gear.Padding = new Thickness(10, 7, 10, 7);
            gear.Checked += (s, e) => SelectTab(SettingsTab);
            tabs[SettingsTab] = gear;
            DockPanel.SetDock(gear, Dock.Right);
            bar.Children.Add(gear);

            widget = BuildWidget();
            DockPanel.SetDock(widget, Dock.Right);
            bar.Children.Add(widget);

            var tabPanel = new StackPanel { Orientation = Orientation.Horizontal };
            for (int i = 0; i < TabNames.Length; i++)
            {
                var rb = new RadioButton { Content = TabNames[i], GroupName = "tabs", ToolTip = "Ctrl+" + (i + 1) };
                rb.SetResourceReference(FrameworkElement.StyleProperty, "TabButton");
                int index = i;
                rb.Checked += (s, e) => SelectTab(index);
                tabs[i] = rb;
                tabPanel.Children.Add(rb);
            }
            DockPanel.SetDock(tabPanel, Dock.Left);
            bar.Children.Add(tabPanel);

            var header = new Border { Padding = new Thickness(12, 10, 12, 10), BorderThickness = new Thickness(0, 0, 0, 1), Child = bar };
            header.SetResourceReference(Border.BackgroundProperty, "Surface");
            header.SetResourceReference(Border.BorderBrushProperty, "Border");
            return header;
        }

        UIElement BuildToast()
        {
            var text = new TextBlock { FontSize = 13 };
            text.SetResourceReference(TextBlock.ForegroundProperty, "Bg");
            var toast = new Border
            {
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(16, 8, 16, 9),
                Margin = new Thickness(0, 0, 0, 24),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Bottom,
                IsHitTestVisible = false,
                Visibility = Visibility.Collapsed,
                Child = text
            };
            toast.SetResourceReference(Border.BackgroundProperty, "Text");
            Grid.SetRowSpan(toast, 3);
            Ui.ToastHost = toast;
            return toast;
        }

        Border BuildWidget()
        {
            widgetDot = new Ellipse { Width = 8, Height = 8, Margin = new Thickness(0, 1, 8, 0), VerticalAlignment = VerticalAlignment.Center };
            widgetLabel = new TextBlock { Margin = new Thickness(0, 0, 8, 0), VerticalAlignment = VerticalAlignment.Center };
            widgetTime = new TextBlock { FontWeight = FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center, MinWidth = 40 };
            Typography.SetNumeralAlignment(widgetTime, FontNumeralAlignment.Tabular);

            var content = new StackPanel { Orientation = Orientation.Horizontal };
            content.Children.Add(widgetDot);
            content.Children.Add(widgetLabel);
            content.Children.Add(widgetTime);

            var b = new Border
            {
                CornerRadius = new CornerRadius(16),
                Padding = new Thickness(12, 6, 14, 7),
                VerticalAlignment = VerticalAlignment.Center,
                Cursor = Cursors.Hand,
                ToolTip = "Открыть Pomodoro",
                Child = content
            };
            b.MouseLeftButtonUp += (s, e) => SelectTab(2);
            b.MouseEnter += (s, e) => b.Opacity = 0.8;
            b.MouseLeave += (s, e) => b.Opacity = 1;
            return b;
        }

        Border BuildAddBar()
        {
            addBox = new TextBox { Tag = "Новая задача…", MaxLength = 200 };
            addBox.SetResourceReference(FrameworkElement.StyleProperty, "Input");
            addBox.KeyDown += (s, e) =>
            {
                if (e.Key == Key.Enter) { AddTask(); e.Handled = true; }
            };
            addBox.TextChanged += (s, e) => ShowAddError(false);

            var addBtn = new Button { Content = "Добавить", Margin = new Thickness(8, 0, 0, 0), Padding = new Thickness(18, 8, 18, 8) };
            addBtn.SetResourceReference(FrameworkElement.StyleProperty, "BtnPrimary");
            addBtn.Click += (s, e) => AddTask();

            addError = Ui.Text("Введите заголовок задачи", 12, "Danger");
            addError.Margin = new Thickness(4, 6, 0, 0);
            addError.Visibility = Visibility.Collapsed;
            addHint = Ui.Text("Щелчок по карточке открывает детали. Карточки можно перетаскивать между зонами.", 12, "TextMuted");
            addHint.Margin = new Thickness(4, 6, 0, 0);
            addHint.TextWrapping = TextWrapping.Wrap;

            var g = new Grid();
            g.ColumnDefinitions.Add(new ColumnDefinition());
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            g.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            g.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            Grid.SetColumn(addBtn, 1);
            Grid.SetRow(addError, 1);
            Grid.SetRow(addHint, 1);
            Grid.SetColumnSpan(addHint, 2);
            g.Children.Add(addBox);
            g.Children.Add(addBtn);
            g.Children.Add(addError);
            g.Children.Add(addHint);

            return new Border { Margin = new Thickness(16, 14, 16, 4), Child = g };
        }

        void AddTask()
        {
            // F-08: пустой заголовок или одни пробелы не принимаются.
            if (store.Add(addBox.Text) == null)
            {
                ShowAddError(true);
                addBox.Focus();
                return;
            }
            addBox.Clear();
            addBox.Focus();
        }

        void ShowAddError(bool on)
        {
            addError.Visibility = on ? Visibility.Visible : Visibility.Collapsed;
            addHint.Visibility = on ? Visibility.Collapsed : Visibility.Visible;
            if (on) addBox.SetResourceReference(Control.BorderBrushProperty, "Danger");
            else addBox.ClearValue(Control.BorderBrushProperty);
        }

        void SelectTab(int index)
        {
            if (tabs[index].IsChecked != true)
            {
                tabs[index].IsChecked = true; // вызовет Checked -> SelectTab ещё раз
                return;
            }
            if (tab == index) return;
            tab = index;
            details.Close();

            // Представления живут всё время работы окна, поэтому переключение не теряет состояние (F-52).
            host.Content = index == 0 ? (UIElement)matrix : index == 1 ? (UIElement)kanban : index == 2 ? (UIElement)pomoView : index == 3 ? (UIElement)workspace : settings;
            addBar.Visibility = index <= 1 ? Visibility.Visible : Visibility.Collapsed;
            ShowAddError(false);
            RefreshWidget();
        }

        void ApplyNarrow(bool value)
        {
            if (narrow == value) return;
            narrow = value;
            matrix.Narrow = value;
            kanban.Narrow = value;
            pomoView.Narrow = value;
            workspace.Narrow = value;
            details.Narrow = value;
            settings.Narrow = value;
            for (int i = 0; i < TabNames.Length; i++) tabs[i].Padding = value ? new Thickness(10, 6, 10, 6) : new Thickness(14, 7, 14, 7);
            RefreshWidget();
        }

        // F-41..F-46: состояние виджета в шапке.
        void RefreshWidget()
        {
            PomodoroTimer shown = null;
            bool running = false;
            string bg = "IdleSoft", fg = "TextMuted", dot = "Idle";

            if (pomo.Work.State == TimerState.Running)
            {
                shown = pomo.Work; running = true;
                bg = "WorkSoft"; fg = "Work"; dot = "Work";
            }
            else if (pomo.Rest.State == TimerState.Running)
            {
                shown = pomo.Rest; running = true;
                bg = "RestSoft"; fg = "Rest"; dot = "Rest";
            }
            else if (pomo.LastActive != null && pomo.LastActive.State == TimerState.Paused) shown = pomo.LastActive;
            else if (pomo.Work.State == TimerState.Paused) shown = pomo.Work;
            else if (pomo.Rest.State == TimerState.Paused) shown = pomo.Rest;

            widget.SetResourceReference(Border.BackgroundProperty, bg);
            widgetLabel.SetResourceReference(TextBlock.ForegroundProperty, fg);
            widgetTime.SetResourceReference(TextBlock.ForegroundProperty, fg);
            widgetDot.SetResourceReference(Shape.FillProperty, dot);

            widgetLabel.Text = shown == null ? "Pomodoro" : running ? shown.Title : shown.Title + " · пауза";
            widgetTime.Text = shown == null ? "—" : Ui.FormatTime(shown.Remaining);
            widgetLabel.Visibility = narrow ? Visibility.Collapsed : Visibility.Visible;
            widget.Visibility = tab == 2 ? Visibility.Collapsed : Visibility.Visible;
            SetPulse(running);

            // Остаток видно и в свёрнутом окне: в заголовке и на кнопке панели задач.
            if (shown == null)
            {
                Title = "Task Tracker";
                TaskbarItemInfo.ProgressState = TaskbarItemProgressState.None;
            }
            else
            {
                Title = Ui.FormatTime(shown.Remaining) + " · " + shown.Title + (running ? "" : " (пауза)") + " — Task Tracker";
                TaskbarItemInfo.ProgressState = running ? TaskbarItemProgressState.Normal : TaskbarItemProgressState.Paused;
                TaskbarItemInfo.ProgressValue = Math.Max(0, Math.Min(1, shown.Progress));
            }
        }

        void SetPulse(bool on)
        {
            if (on == pulsing) return;
            pulsing = on;
            if (on)
            {
                var anim = new DoubleAnimation(1, 0.25, TimeSpan.FromMilliseconds(800))
                {
                    AutoReverse = true,
                    RepeatBehavior = RepeatBehavior.Forever
                };
                widgetDot.BeginAnimation(OpacityProperty, anim);
            }
            else
            {
                widgetDot.BeginAnimation(OpacityProperty, null);
                widgetDot.Opacity = 1;
            }
        }

        void OnShortcut(object sender, KeyEventArgs e)
        {
            if (Keyboard.Modifiers != ModifierKeys.Control) return;
            if (e.Key >= Key.D1 && e.Key <= Key.D4) { SelectTab(e.Key - Key.D1); e.Handled = true; }
            else if (e.Key >= Key.NumPad1 && e.Key <= Key.NumPad4) { SelectTab(e.Key - Key.NumPad1); e.Handled = true; }
            else if (e.Key == Key.N)
            {
                details.Close();
                if (tab > 1) SelectTab(0);
                addBox.Focus();
                e.Handled = true;
            }
        }

        [DllImport("dwmapi.dll")]
        static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

        // Заголовок окна Windows тоже переключается на тёмный, если фон темы тёмный.
        void ApplyTitleBarTheme()
        {
            var hwnd = new WindowInteropHelper(this).Handle;
            if (hwnd == IntPtr.Zero) return;
            try
            {
                int on = Theme.IsDark ? 1 : 0;
                DwmSetWindowAttribute(hwnd, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, ref on, sizeof(int));
            }
            catch { }
        }
    }
}
