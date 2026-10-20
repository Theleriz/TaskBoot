using System;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace TaskTracker;

static class NativeMethods
{
    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

    const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

    public static void SetDarkTitleBar(IntPtr hwnd, bool dark)
    {
        if (hwnd == IntPtr.Zero) return;
        int on = dark ? 1 : 0;
        DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref on, sizeof(int));
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

    /// <summary>Flashes the taskbar button until the window comes to the foreground.</summary>
    public static void FlashUntilForeground(IntPtr hwnd)
    {
        const uint FLASHW_ALL = 3, FLASHW_TIMERNOFG = 12;
        var info = new FLASHWINFO { hwnd = hwnd, dwFlags = FLASHW_ALL | FLASHW_TIMERNOFG };
        info.cbSize = (uint)Marshal.SizeOf(info);
        FlashWindowEx(ref info);
    }

    public static bool SystemUsesDarkTheme()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return key?.GetValue("AppsUseLightTheme") is int v && v == 0;
        }
        catch
        {
            return false;
        }
    }
}
