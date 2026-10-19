using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media.Imaging;
using Forms = System.Windows.Forms;

namespace TaskTracker
{
    // Уведомление об окончании таймера. Если окно в фоне или свёрнуто — всплывающее
    // уведомление Windows и мигание кнопки на панели задач; если открыто — сообщение внутри окна.
    public class Notifier : IDisposable
    {
        readonly Window window;
        readonly Forms.NotifyIcon tray;

        public Notifier(Window window)
        {
            this.window = window;
            tray = new Forms.NotifyIcon { Icon = CreateIcon(), Text = "Task Tracker", Visible = true };
            tray.BalloonTipClicked += (s, e) => ShowWindow();
            tray.MouseClick += (s, e) => { if (e.Button == Forms.MouseButtons.Left) ShowWindow(); };
        }

        public void TimerFinished(PomodoroTimer finished, PomodoroTimer next)
        {
            string title = finished.Kind == "work" ? "Работа окончена" : "Отдых окончен";
            string body = (next.Kind == "work" ? "Начинается работа" : "Начинается отдых") + ": " + next.Minutes + " мин.";

            if (window.IsActive && window.WindowState != WindowState.Minimized)
            {
                Ui.Toast(title + ". " + body);
                return;
            }
            tray.ShowBalloonTip(6000, title, body, Forms.ToolTipIcon.None);
            Flash();
        }

        void ShowWindow()
        {
            if (window.WindowState == WindowState.Minimized) window.WindowState = WindowState.Normal;
            window.Activate();
        }

        [StructLayout(LayoutKind.Sequential)]
        struct FLASHWINFO
        {
            public uint cbSize;
            public IntPtr hwnd;
            public uint dwFlags;
            public uint uCount;
            public uint dwTimeout;
        }

        [DllImport("user32.dll")]
        static extern bool FlashWindowEx(ref FLASHWINFO info);

        const uint FLASHW_ALL = 3;
        const uint FLASHW_TIMERNOFG = 12;

        // Кнопка мигает, пока окно не окажется на переднем плане.
        void Flash()
        {
            var info = new FLASHWINFO
            {
                hwnd = new WindowInteropHelper(window).Handle,
                dwFlags = FLASHW_ALL | FLASHW_TIMERNOFG
            };
            info.cbSize = (uint)Marshal.SizeOf(info);
            FlashWindowEx(ref info);
        }

        static System.Drawing.Icon CreateIcon()
        {
            var encoder = new PngBitmapEncoder();
            encoder.Frames.Add((BitmapFrame)Ui.AppIcon());
            using (var ms = new MemoryStream())
            {
                encoder.Save(ms);
                ms.Position = 0;
                using (var bmp = new System.Drawing.Bitmap(ms))
                using (var small = new System.Drawing.Bitmap(bmp, 32, 32))
                {
                    return System.Drawing.Icon.FromHandle(small.GetHicon());
                }
            }
        }

        public void Dispose()
        {
            // Без этого значок остаётся в трее до наведения мыши.
            tray.Visible = false;
            tray.Dispose();
        }
    }
}
