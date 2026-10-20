using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Shell;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace TaskTracker;

/// <summary>The window: a WebView2 that shows the web app, plus the Windows integrations the bridge asks for.</summary>
public sealed class ShellWindow : Window, IShellHost
{
    const string AppHost = "app.local";
    const string AppOrigin = "https://" + AppHost + "/";
    const string RuntimeDownloadUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

    readonly WebView2 webView = new();
    readonly BridgeHost bridge;
    readonly TrayNotifier tray;
    /// <summary>For development: TASKTRACKER_DEV_URL=http://localhost:5173 loads the Vite dev server instead.</summary>
    readonly string? devUrl = Environment.GetEnvironmentVariable("TASKTRACKER_DEV_URL");

    bool readyToClose;
    DispatcherTimer? closeTimeout;

    public ShellWindow(DataFile data)
    {
        bridge = new BridgeHost(data, this);
        tray = new TrayNotifier(Activate_);

        Title = "Task Tracker";
        Width = 1120;
        Height = 760;
        MinWidth = 480;
        MinHeight = 520;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        TaskbarItemInfo = new TaskbarItemInfo();

        // Matches the theme until the page paints, so there is no white flash on a dark system.
        var dark = NativeMethods.SystemUsesDarkTheme();
        webView.DefaultBackgroundColor = dark
            ? System.Drawing.Color.FromArgb(0x15, 0x17, 0x1B)
            : System.Drawing.Color.FromArgb(0xF3, 0xF4, 0xF6);
        Background = new System.Windows.Media.SolidColorBrush(dark
            ? System.Windows.Media.Color.FromRgb(0x15, 0x17, 0x1B)
            : System.Windows.Media.Color.FromRgb(0xF3, 0xF4, 0xF6));
        Content = webView;

        SourceInitialized += (_, _) => SetDarkTitleBar(dark);
        Loaded += async (_, _) => await InitializeWebViewAsync();
        Closing += OnClosing;
        Closed += (_, _) => tray.Dispose();
    }

    async Task InitializeWebViewAsync()
    {
        var webFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "web");
        if (devUrl == null && !File.Exists(Path.Combine(webFolder, "index.html")))
        {
            MessageBox.Show(this, $"Не найдены файлы приложения:\n{webFolder}\n\nСоберите проект командой win32\\build.cmd.",
                "Task Tracker", MessageBoxButton.OK, MessageBoxImage.Error);
            readyToClose = true;
            Close();
            return;
        }

        try
        {
            // Keep the browser profile in LocalAppData: the program folder may be read-only.
            var userData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TaskTracker", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, userData);
            await webView.EnsureCoreWebView2Async(environment);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            var answer = MessageBox.Show(this,
                "Для работы нужен компонент Microsoft Edge WebView2 Runtime. В Windows 11 он есть всегда, в Windows 10 его можно установить бесплатно.\n\nОткрыть страницу загрузки?",
                "Task Tracker", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (answer == MessageBoxResult.Yes) OpenExternal(RuntimeDownloadUrl);
            readyToClose = true;
            Close();
            return;
        }

        var core = webView.CoreWebView2;
        var debug = devUrl != null || Debugger.IsAttached;
        core.Settings.AreDevToolsEnabled = debug;
        core.Settings.AreDefaultContextMenusEnabled = true;
        core.Settings.IsStatusBarEnabled = false;
        // Notes and secrets must not end up in the browser's autofill or password store.
        core.Settings.IsGeneralAutofillEnabled = false;
        core.Settings.IsPasswordAutosaveEnabled = false;

        core.SetVirtualHostNameToFolderMapping(AppHost, webFolder, CoreWebView2HostResourceAccessKind.DenyCors);
        core.NavigationStarting += (_, e) =>
        {
            if (IsAppUrl(e.Uri)) return;
            e.Cancel = true;
            OpenExternal(e.Uri);
        };
        core.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            OpenExternal(e.Uri);
        };
        core.DocumentTitleChanged += (_, _) => Title = core.DocumentTitle;
        core.WebMessageReceived += OnWebMessage;

        core.Navigate(devUrl ?? AppOrigin + "index.html");
    }

    bool IsAppUrl(string uri) =>
        uri.StartsWith(AppOrigin, StringComparison.OrdinalIgnoreCase) ||
        (devUrl != null && uri.StartsWith(devUrl, StringComparison.OrdinalIgnoreCase));

    void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        // Only our own page may talk to the shell.
        if (!IsAppUrl(e.Source)) return;
        var response = bridge.Handle(e.WebMessageAsJson);
        if (response != null) webView.CoreWebView2?.PostWebMessageAsJson(response);
    }

    void PostEvent(string name) => webView.CoreWebView2?.PostWebMessageAsJson(bridge.Event(name));

    // The page saves with a short delay; closing asks it to flush first (up to 2 s).
    void OnClosing(object? sender, CancelEventArgs e)
    {
        if (readyToClose || webView.CoreWebView2 == null) return;
        e.Cancel = true;
        if (closeTimeout != null) return;
        closeTimeout = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        closeTimeout.Tick += (_, _) => ReadyToClose();
        closeTimeout.Start();
        PostEvent("app.closing");
    }

    void Activate_()
    {
        if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
        Show();
        Activate();
        PostEvent("app.activated");
    }

    /* ---------- IShellHost ---------- */

    public void ShowNotification(string title, string body)
    {
        tray.Show(title, body);
        if (!IsActive) NativeMethods.FlashUntilForeground(new WindowInteropHelper(this).Handle);
    }

    public void SetTaskbarProgress(string state, double value)
    {
        TaskbarItemInfo.ProgressState = state switch
        {
            "normal" => TaskbarItemProgressState.Normal,
            "paused" => TaskbarItemProgressState.Paused,
            _ => TaskbarItemProgressState.None,
        };
        TaskbarItemInfo.ProgressValue = Math.Max(0, Math.Min(1, value));
    }

    public void SetWindowTitle(string title) => Title = title;

    public void SetDarkTitleBar(bool dark) => NativeMethods.SetDarkTitleBar(new WindowInteropHelper(this).Handle, dark);

    public void OpenExternal(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new BridgeException("invalid_payload", "Only http and https links can be opened.");
        }
        Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }

    public void ReadyToClose()
    {
        closeTimeout?.Stop();
        readyToClose = true;
        Dispatcher.BeginInvoke(new Action(Close));
    }
}
