using System;
using System.Reflection;
using System.Runtime.Versioning;
using System.Windows;

// Без этого атрибута WPF включает режим совместимости со старыми версиями .NET (в том числе без per-monitor DPI).
[assembly: TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]
[assembly: AssemblyTitle("Task Tracker")]
[assembly: AssemblyProduct("Task Tracker")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace TaskTracker
{
    public static class Program
    {
        [STAThread]
        public static int Main()
        {
            var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
            app.DispatcherUnhandledException += (s, e) =>
            {
                MessageBox.Show(e.Exception.ToString(), "Task Tracker — ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
                e.Handled = true;
            };
            Theme.Init(app.Resources);
            var store = new Store();
            ThemeController.Apply(store);
            return app.Run(new MainWindow(store));
        }
    }
}
