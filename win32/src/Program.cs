using System;
using System.Windows;

namespace TaskTracker;

public static class Program
{
    [STAThread]
    public static int Main()
    {
        var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        app.DispatcherUnhandledException += (_, e) =>
        {
            MessageBox.Show(e.Exception.ToString(), "Task Tracker — ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
            e.Handled = true;
        };
        return app.Run(new ShellWindow(new DataFile()));
    }
}
