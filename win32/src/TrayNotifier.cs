using System;
using System.Diagnostics;
using Forms = System.Windows.Forms;

namespace TaskTracker;

/// <summary>Tray icon with Windows notifications (balloons are shown as toasts on Windows 10/11).</summary>
sealed class TrayNotifier : IDisposable
{
    readonly Forms.NotifyIcon tray;

    public TrayNotifier(Action onActivate)
    {
        var exe = Process.GetCurrentProcess().MainModule?.FileName;
        tray = new Forms.NotifyIcon
        {
            Icon = exe != null ? System.Drawing.Icon.ExtractAssociatedIcon(exe) : System.Drawing.SystemIcons.Application,
            Text = "Task Tracker",
            Visible = true,
        };
        tray.BalloonTipClicked += (_, _) => onActivate();
        tray.MouseClick += (_, e) =>
        {
            if (e.Button == Forms.MouseButtons.Left) onActivate();
        };
    }

    public void Show(string title, string body) => tray.ShowBalloonTip(6000, title, body, Forms.ToolTipIcon.None);

    public void Dispose()
    {
        // Without this the icon stays in the tray until the mouse moves over it.
        tray.Visible = false;
        tray.Dispose();
    }
}
