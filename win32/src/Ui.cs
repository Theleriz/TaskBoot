using System;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Media.Media3D;
using System.Windows.Shapes;
using System.Windows.Threading;

namespace TaskTracker
{
    public static class Ui
    {
        public static TextBlock Text(string text, double size, string colorKey)
        {
            var tb = new TextBlock { Text = text, FontSize = size };
            if (colorKey != null) tb.SetResourceReference(TextBlock.ForegroundProperty, colorKey);
            return tb;
        }

        // Вертикальный скролл; при перетаскивании у края области прокручивает сам.
        public static ScrollViewer Scroller(UIElement content)
        {
            var sv = new ScrollViewer
            {
                Content = content,
                Focusable = false,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            };
            sv.PreviewDragOver += (s, e) =>
            {
                double y = e.GetPosition(sv).Y;
                if (y < 36) sv.ScrollToVerticalOffset(sv.VerticalOffset - 12);
                else if (y > sv.ActualHeight - 36) sv.ScrollToVerticalOffset(sv.VerticalOffset + 12);
            };
            return sv;
        }

        public static bool IsInside<T>(object source, DependencyObject stop) where T : DependencyObject
        {
            var d = source as DependencyObject;
            while (d != null && d != stop)
            {
                if (d is T) return true;
                d = (d is Visual || d is Visual3D) ? VisualTreeHelper.GetParent(d) : LogicalTreeHelper.GetParent(d);
            }
            return false;
        }

        public static Button IconButton(string glyph, string tooltip, string style, Action onClick)
        {
            var b = new Button { Content = glyph, ToolTip = tooltip, VerticalAlignment = VerticalAlignment.Center };
            b.SetResourceReference(FrameworkElement.StyleProperty, style);
            b.Click += (s, e) => onClick();
            return b;
        }

        public static Button TextButton(string text, string style, Action onClick)
        {
            var b = new Button { Content = text };
            b.SetResourceReference(FrameworkElement.StyleProperty, style);
            b.Click += (s, e) => onClick();
            return b;
        }

        public static TextBox Input(string placeholder, string style)
        {
            var tb = new TextBox { Tag = placeholder };
            tb.SetResourceReference(FrameworkElement.StyleProperty, style);
            return tb;
        }

        public static Border Counter(int count)
        {
            var pill = new Border
            {
                CornerRadius = new CornerRadius(9),
                Padding = new Thickness(8, 1, 8, 2),
                Margin = new Thickness(9, 0, 0, 0),
                MinWidth = 24,
                VerticalAlignment = VerticalAlignment.Center
            };
            pill.SetResourceReference(Border.BackgroundProperty, "Surface2");
            var text = Text(count.ToString(), 12, "TextMuted");
            text.FontWeight = FontWeights.SemiBold;
            text.HorizontalAlignment = HorizontalAlignment.Center;
            pill.Child = text;
            return pill;
        }

        // Заголовок секции: цветная полоска, название, счётчик.
        public static StackPanel SectionHeader(string title, string colorKey, double size, int? count)
        {
            var stripe = new Border
            {
                Width = 4,
                Height = 16,
                CornerRadius = new CornerRadius(2),
                Margin = new Thickness(0, 0, 9, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            stripe.SetResourceReference(Border.BackgroundProperty, colorKey);
            var text = Text(title, size, null);
            text.FontWeight = FontWeights.SemiBold;
            text.VerticalAlignment = VerticalAlignment.Center;
            text.TextTrimming = TextTrimming.CharacterEllipsis;

            var header = new StackPanel { Orientation = Orientation.Horizontal };
            header.Children.Add(stripe);
            header.Children.Add(text);
            if (count.HasValue) header.Children.Add(Counter(count.Value));
            return header;
        }

        public static UIElement Empty()
        {
            var frame = new Rectangle
            {
                RadiusX = 8,
                RadiusY = 8,
                StrokeThickness = 1,
                StrokeDashArray = new DoubleCollection { 4, 3 }
            };
            frame.SetResourceReference(Shape.StrokeProperty, "Border");

            var label = Text("пусто", 13, "TextMuted");
            label.FontStyle = FontStyles.Italic;
            label.HorizontalAlignment = HorizontalAlignment.Center;
            label.VerticalAlignment = VerticalAlignment.Center;

            var g = new Grid { Height = 60 };
            g.Children.Add(frame);
            g.Children.Add(label);
            return g;
        }

        public static TextBlock Error(string text)
        {
            var tb = Text(text, 12, "Danger");
            tb.Margin = new Thickness(2, 4, 0, 0);
            tb.TextWrapping = TextWrapping.Wrap;
            tb.Visibility = Visibility.Collapsed;
            return tb;
        }

        static readonly CultureInfo Ru = new CultureInfo("ru-RU");

        public static string FormatDate(long unixMs)
        {
            var local = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddMilliseconds(unixMs).ToLocalTime();
            return local.ToString("d MMM yyyy, HH:mm", Ru);
        }

        public static bool Confirm(string text)
        {
            return MessageBox.Show(Application.Current.MainWindow, text, "Task Tracker",
                MessageBoxButton.YesNo, MessageBoxImage.Question, MessageBoxResult.No) == MessageBoxResult.Yes;
        }

        // Короткое всплывающее сообщение внизу окна. Host задаёт главное окно.
        public static Border ToastHost;
        static DispatcherTimer toastTimer;

        public static void Toast(string text)
        {
            if (ToastHost == null) return;
            ((TextBlock)ToastHost.Child).Text = text;
            ToastHost.Visibility = Visibility.Visible;
            ToastHost.BeginAnimation(UIElement.OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(150)));
            if (toastTimer == null)
            {
                toastTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(2200) };
                toastTimer.Tick += (s, e) =>
                {
                    toastTimer.Stop();
                    ToastHost.Visibility = Visibility.Collapsed;
                };
            }
            toastTimer.Stop();
            toastTimer.Start();
        }

        public static string FormatTime(TimeSpan remaining)
        {
            int s = (int)Math.Ceiling(Math.Max(0, remaining.TotalSeconds));
            return (s / 60).ToString("00") + ":" + (s % 60).ToString("00");
        }

        public static ImageSource AppIcon()
        {
            var visual = new DrawingVisual();
            using (var dc = visual.RenderOpen())
            {
                dc.DrawRoundedRectangle(new SolidColorBrush(Color.FromRgb(0x3B, 0x5B, 0xDB)), null, new Rect(2, 2, 60, 60), 14, 14);
                var pen = new Pen(Brushes.White, 7)
                {
                    StartLineCap = PenLineCap.Round,
                    EndLineCap = PenLineCap.Round,
                    LineJoin = PenLineJoin.Round
                };
                dc.DrawGeometry(null, pen, Geometry.Parse("M18,33 L28,43 L46,22"));
            }
            var bmp = new RenderTargetBitmap(64, 64, 96, 96, PixelFormats.Pbgra32);
            bmp.Render(visual);
            return BitmapFrame.Create(bmp);
        }
    }
}
