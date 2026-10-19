using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Media;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace TaskTracker
{
    public enum TimerState { Idle, Running, Paused }

    public class PomodoroTimer
    {
        // Монотонные часы: перевод системного времени не ломает отсчёт.
        static readonly Stopwatch Clock = Stopwatch.StartNew();

        public readonly string Kind;
        public readonly string Title;
        public readonly int MaxMinutes;
        int minutes;
        TimeSpan remaining;
        TimeSpan endsAt;

        public event Action Finished;

        public PomodoroTimer(string kind, string title, int minutes, int maxMinutes)
        {
            Kind = kind;
            Title = title;
            MaxMinutes = maxMinutes;
            this.minutes = minutes;
            remaining = Full;
            State = TimerState.Idle;
        }

        public TimerState State { get; private set; }
        public int Minutes { get { return minutes; } }
        public TimeSpan Full { get { return TimeSpan.FromMinutes(minutes); } }

        public TimeSpan Remaining
        {
            get
            {
                if (State != TimerState.Running) return remaining;
                var r = endsAt - Clock.Elapsed;
                return r < TimeSpan.Zero ? TimeSpan.Zero : r;
            }
        }

        public double Progress
        {
            get { return 1 - Remaining.TotalSeconds / Full.TotalSeconds; }
        }

        public void Start()
        {
            if (State == TimerState.Running) return;
            if (remaining <= TimeSpan.Zero) remaining = Full;
            endsAt = Clock.Elapsed + remaining;
            State = TimerState.Running;
        }

        public void Pause()
        {
            if (State != TimerState.Running) return;
            remaining = Remaining;
            State = TimerState.Paused;
        }

        public void Reset()
        {
            State = TimerState.Idle;
            remaining = Full;
        }

        public void SetMinutes(int value)
        {
            minutes = value;
            if (State == TimerState.Idle) remaining = Full;
        }

        public void Tick()
        {
            if (State != TimerState.Running || Remaining > TimeSpan.Zero) return;
            Reset();
            if (Finished != null) Finished();
        }
    }

    public class PomodoroController
    {
        public readonly PomodoroTimer Work;
        public readonly PomodoroTimer Rest;
        readonly Store store;

        public event Action Changed;
        // Таймер закончился: (закончившийся, следующий). Для уведомлений.
        public event Action<PomodoroTimer, PomodoroTimer> TimerFinished;

        public PomodoroController(Store store)
        {
            this.store = store;
            Work = new PomodoroTimer("work", "Работа", store.WorkMinutes, Store.MaxWorkMinutes);
            Rest = new PomodoroTimer("rest", "Отдых", store.RestMinutes, Store.MaxRestMinutes);
            Work.Finished += () => OnFinished(Work, Rest);
            Rest.Finished += () => OnFinished(Rest, Work);

            var ticker = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(200) };
            ticker.Tick += (s, e) =>
            {
                bool active = Work.State == TimerState.Running || Rest.State == TimerState.Running;
                Work.Tick();
                Rest.Tick();
                if (active) Raise();
            };
            ticker.Start();
        }

        // Последний таймер, которым управляли — для виджета, когда оба на паузе.
        public PomodoroTimer LastActive { get; private set; }

        public void Start(PomodoroTimer t) { t.Start(); LastActive = t; Raise(); }
        public void Pause(PomodoroTimer t) { t.Pause(); LastActive = t; Raise(); }
        public void Reset(PomodoroTimer t) { t.Reset(); Raise(); }

        public void SetMinutes(PomodoroTimer t, int value)
        {
            t.SetMinutes(Math.Max(1, Math.Min(t.MaxMinutes, value)));
            store.SaveDurations(Work.Minutes, Rest.Minutes);
            Raise();
        }

        // F-36 / F-37: по окончании одного таймера через 400 мс запускается другой.
        void OnFinished(PomodoroTimer finished, PomodoroTimer next)
        {
            Sounds.Play(finished == Work ? Sounds.WorkDone : Sounds.RestDone);
            if (TimerFinished != null) TimerFinished(finished, next);
            var delay = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(400) };
            delay.Tick += (s, e) =>
            {
                delay.Stop();
                next.Reset();
                Start(next);
            };
            delay.Start();
        }

        void Raise()
        {
            if (Changed != null) Changed();
        }
    }

    // F-38: короткие сигналы, синтезируются в WAV в памяти — без внешних файлов.
    static class Sounds
    {
        public static readonly byte[] WorkDone = Melody(new[] { 880.0, 698.46, 523.25 });
        public static readonly byte[] RestDone = Melody(new[] { 523.25, 659.25, 783.99 });
        static SoundPlayer player;

        public static void Play(byte[] wav)
        {
            try
            {
                if (player != null) player.Stop();
                player = new SoundPlayer(new MemoryStream(wav));
                player.Play();
            }
            catch
            {
                SystemSounds.Asterisk.Play();
            }
        }

        static byte[] Melody(double[] freqs)
        {
            const int rate = 44100;
            int note = (int)(rate * 0.2);
            int gap = (int)(rate * 0.05);
            int samples = freqs.Length * (note + gap);

            var ms = new MemoryStream();
            var w = new BinaryWriter(ms);
            w.Write(Encoding.ASCII.GetBytes("RIFF"));
            w.Write(36 + samples * 2);
            w.Write(Encoding.ASCII.GetBytes("WAVEfmt "));
            w.Write(16);
            w.Write((short)1);
            w.Write((short)1);
            w.Write(rate);
            w.Write(rate * 2);
            w.Write((short)2);
            w.Write((short)16);
            w.Write(Encoding.ASCII.GetBytes("data"));
            w.Write(samples * 2);
            foreach (var f in freqs)
            {
                for (int i = 0; i < note; i++)
                {
                    double attack = Math.Min(1.0, i / (rate * 0.008));
                    double env = attack * Math.Exp(-4.0 * i / note);
                    double x = 2 * Math.PI * f * i / rate;
                    double v = (Math.Sin(x) + 0.25 * Math.Sin(2 * x)) * env * 0.3;
                    w.Write((short)(v * short.MaxValue));
                }
                for (int i = 0; i < gap; i++) w.Write((short)0);
            }
            w.Flush();
            return ms.ToArray();
        }
    }

    class TimerCard : Border
    {
        readonly PomodoroController ctl;
        readonly PomodoroTimer timer;
        readonly string colorKey;
        readonly string softKey;
        readonly TextBlock time;
        readonly TextBlock stateText;
        readonly Border statePill;
        readonly TextBlock hint;
        readonly ScaleTransform progress;
        readonly Button start;
        readonly Button pause;
        readonly Button reset;
        readonly TextBox minutes;
        TimerState? shownState;

        public TimerCard(PomodoroController ctl, PomodoroTimer timer, string colorKey, string softKey, string startStyle)
        {
            this.ctl = ctl;
            this.timer = timer;
            this.colorKey = colorKey;
            this.softKey = softKey;

            CornerRadius = new CornerRadius(16);
            BorderThickness = new Thickness(2);
            Padding = new Thickness(28, 22, 28, 24);
            Margin = new Thickness(8);

            stateText = Ui.Text("", 12, null);
            stateText.FontWeight = FontWeights.SemiBold;
            statePill = new Border
            {
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(10, 3, 10, 4),
                VerticalAlignment = VerticalAlignment.Center,
                Child = stateText
            };
            var title = Ui.Text(timer.Title, 20, null);
            title.FontWeight = FontWeights.SemiBold;
            var head = new DockPanel();
            DockPanel.SetDock(statePill, Dock.Right);
            head.Children.Add(statePill);
            head.Children.Add(title);

            time = new TextBlock
            {
                FontSize = 76,
                FontWeight = FontWeights.Light,
                FontFamily = new FontFamily("Segoe UI Variable Display, Segoe UI"),
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 12, 0, 14)
            };
            Typography.SetNumeralAlignment(time, FontNumeralAlignment.Tabular);

            var track = new Border { CornerRadius = new CornerRadius(3) };
            track.SetResourceReference(Border.BackgroundProperty, "Surface2");
            var fill = new Border { CornerRadius = new CornerRadius(3), RenderTransformOrigin = new Point(0, 0.5) };
            fill.SetResourceReference(Border.BackgroundProperty, colorKey);
            progress = new ScaleTransform(0, 1);
            fill.RenderTransform = progress;
            var bar = new Grid { Height = 6 };
            bar.Children.Add(track);
            bar.Children.Add(fill);

            start = MakeButton("Старт", startStyle, () => ctl.Start(timer));
            pause = MakeButton("Пауза", "Btn", () => ctl.Pause(timer));
            reset = MakeButton("Сброс", "Btn", () => ctl.Reset(timer));
            var buttons = new UniformGrid { Columns = 3, Margin = new Thickness(-4, 20, -4, 0) };
            buttons.Children.Add(start);
            buttons.Children.Add(pause);
            buttons.Children.Add(reset);

            var separator = new Border { Height = 1, Margin = new Thickness(0, 22, 0, 16) };
            separator.SetResourceReference(Border.BackgroundProperty, "Border");

            minutes = new TextBox { Width = 84, TextAlignment = TextAlignment.Center, MaxLength = 3, VerticalAlignment = VerticalAlignment.Center };
            minutes.SetResourceReference(FrameworkElement.StyleProperty, "Input");
            WireMinutes();

            var label = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            label.Children.Add(Ui.Text("Длительность, мин", 14, null));
            label.Children.Add(Ui.Text("от 1 до " + timer.MaxMinutes, 12, "TextMuted"));
            var durationRow = new DockPanel();
            DockPanel.SetDock(minutes, Dock.Right);
            durationRow.Children.Add(minutes);
            durationRow.Children.Add(label);

            hint = Ui.Text("Новая длительность применится после сброса", 12, "TextMuted");
            hint.Margin = new Thickness(0, 8, 0, 0);
            hint.TextWrapping = TextWrapping.Wrap;

            var root = new StackPanel();
            root.Children.Add(head);
            root.Children.Add(time);
            root.Children.Add(bar);
            root.Children.Add(buttons);
            root.Children.Add(separator);
            root.Children.Add(durationRow);
            root.Children.Add(hint);
            Child = root;

            Refresh();
        }

        static Button MakeButton(string text, string style, Action onClick)
        {
            var b = new Button { Content = text, Margin = new Thickness(4), Padding = new Thickness(10, 9, 10, 9) };
            b.SetResourceReference(FrameworkElement.StyleProperty, style);
            b.Click += (s, e) => onClick();
            return b;
        }

        void WireMinutes()
        {
            minutes.PreviewTextInput += (s, e) => e.Handled = !e.Text.All(char.IsDigit);
            minutes.PreviewKeyDown += (s, e) =>
            {
                if (e.Key == Key.Space) e.Handled = true;
                else if (e.Key == Key.Enter) { ApplyMinutes(); Keyboard.ClearFocus(); e.Handled = true; }
                else if (e.Key == Key.Escape) { minutes.Text = timer.Minutes.ToString(); Keyboard.ClearFocus(); e.Handled = true; }
            };
            DataObject.AddPastingHandler(minutes, (s, e) =>
            {
                var text = e.DataObject.GetData(typeof(string)) as string;
                if (text == null || !text.Trim().All(char.IsDigit)) e.CancelCommand();
            });
            minutes.LostKeyboardFocus += (s, e) => ApplyMinutes();
        }

        // F-33 / F-34: значение вне диапазона прижимается к границе.
        void ApplyMinutes()
        {
            int value;
            if (int.TryParse(minutes.Text.Trim(), out value) && value != timer.Minutes) ctl.SetMinutes(timer, value);
            minutes.Text = timer.Minutes.ToString();
        }

        public void Refresh()
        {
            var state = timer.State;
            time.Text = Ui.FormatTime(timer.Remaining);
            progress.ScaleX = Math.Max(0, Math.Min(1, timer.Progress));
            if (!minutes.IsKeyboardFocused) minutes.Text = timer.Minutes.ToString();

            if (shownState == state) return;
            shownState = state;

            start.IsEnabled = state != TimerState.Running;
            pause.IsEnabled = state == TimerState.Running;
            reset.IsEnabled = state != TimerState.Idle;
            hint.Visibility = state == TimerState.Idle ? Visibility.Collapsed : Visibility.Visible;

            // F-39: активный таймер подсвечивается рамкой и фоном своего цвета.
            bool running = state == TimerState.Running;
            SetResourceReference(BorderBrushProperty, running ? colorKey : "Border");
            SetResourceReference(BackgroundProperty, running ? softKey : "Surface");
            statePill.SetResourceReference(Border.BackgroundProperty, running ? colorKey : "IdleSoft");
            stateText.SetResourceReference(TextBlock.ForegroundProperty, running ? "OnAccent" : "TextMuted");
            stateText.Text = running ? "Идёт" : state == TimerState.Paused ? "Пауза" : "Остановлен";
        }
    }

    public class PomodoroView : ContentControl
    {
        readonly TimerCard work;
        readonly TimerCard rest;
        Grid grid;
        bool narrow;

        public PomodoroView(PomodoroController ctl)
        {
            Focusable = false;
            work = new TimerCard(ctl, ctl.Work, "Work", "WorkSoft", "BtnWork");
            rest = new TimerCard(ctl, ctl.Rest, "Rest", "RestSoft", "BtnRest");
            ctl.Changed += () =>
            {
                work.Refresh();
                rest.Refresh();
            };
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
            if (grid != null) grid.Children.Clear();

            grid = new Grid();
            if (narrow)
            {
                grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                Grid.SetRow(rest, 1);
                Grid.SetColumn(rest, 0);
            }
            else
            {
                grid.ColumnDefinitions.Add(new ColumnDefinition());
                grid.ColumnDefinitions.Add(new ColumnDefinition());
                Grid.SetRow(rest, 0);
                Grid.SetColumn(rest, 1);
            }
            grid.Children.Add(work);
            grid.Children.Add(rest);

            var note = Ui.Text("Когда заканчивается работа, автоматически начинается отдых, и наоборот.", 13, "TextMuted");
            note.TextWrapping = TextWrapping.Wrap;
            note.Margin = new Thickness(10, 4, 10, 0);

            var column = new StackPanel { MaxWidth = 980, Margin = new Thickness(0, 8, 0, 8) };
            column.Children.Add(grid);
            column.Children.Add(note);
            Content = Ui.Scroller(column);
        }
    }
}
