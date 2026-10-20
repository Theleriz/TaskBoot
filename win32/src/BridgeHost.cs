using System;
using System.Collections.Generic;
using System.Reflection;
using System.Web.Script.Serialization;

namespace TaskTracker;

/// <summary>An error reported back to the page as { ok: false, error: { code, message } }.</summary>
public sealed class BridgeException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>What the bridge needs from the window.</summary>
public interface IShellHost
{
    void ShowNotification(string title, string body);
    void SetTaskbarProgress(string state, double value);
    void SetWindowTitle(string title);
    void SetDarkTitleBar(bool dark);
    void OpenExternal(string url);
    void ReadyToClose();
}

/// <summary>
/// Page ↔ shell messages. Contract: docs/bridge-protocol.md and web/src/bridge/protocol.ts.
/// </summary>
public sealed class BridgeHost(DataFile data, IShellHost host)
{
    readonly JavaScriptSerializer json = new() { MaxJsonLength = int.MaxValue };

    /// <summary>Handles one message from the page; returns the response JSON, or null if there is nothing to answer.</summary>
    public string? Handle(string messageJson)
    {
        if (json.DeserializeObject(messageJson) is not Dictionary<string, object> message) return null;
        if (!Equals(message.Get("kind"), "request") || message.Get("id") is not string id) return null;
        var method = message.Get("method") as string ?? "";
        var payload = message.Get("payload") as Dictionary<string, object>;

        try
        {
            return Respond(id, true, Invoke(method, payload), null);
        }
        catch (BridgeException e)
        {
            return Respond(id, false, null, new { code = e.Code, message = e.Message });
        }
        catch (Exception e) when (e is System.IO.IOException or UnauthorizedAccessException)
        {
            return Respond(id, false, null, new { code = "io_error", message = e.Message });
        }
    }

    public string Event(string name) =>
        json.Serialize(new Dictionary<string, object?> { ["kind"] = "event", ["event"] = name, ["payload"] = null });

    object? Invoke(string method, Dictionary<string, object>? p)
    {
        switch (method)
        {
            case "storage.load":
                return new Dictionary<string, object?> { ["json"] = data.Load() };
            case "storage.save":
                data.Save(Str(p, "json"));
                return null;
            case "notify.show":
                host.ShowNotification(Str(p, "title"), Str(p, "body"));
                return null;
            case "taskbar.progress":
                host.SetTaskbarProgress(Str(p, "state"), Convert.ToDouble(p.Get("value") ?? 0));
                return null;
            case "window.title":
                host.SetWindowTitle(Str(p, "title"));
                return null;
            case "window.theme":
                host.SetDarkTitleBar(p.Get("dark") is true);
                return null;
            case "shell.openExternal":
                host.OpenExternal(Str(p, "url"));
                return null;
            case "app.readyToClose":
                host.ReadyToClose();
                return null;
            case "app.info":
                var version = Assembly.GetExecutingAssembly().GetName().Version;
                return new { version = $"{version.Major}.{version.Minor}.{version.Build}", platform = "windows" };
            default:
                throw new BridgeException("unknown_method", $"Unknown method \"{method}\".");
        }
    }

    static string Str(Dictionary<string, object>? p, string key) =>
        p.Get(key) as string ?? throw new BridgeException("invalid_payload", $"\"{key}\" is required.");

    string Respond(string id, bool ok, object? result, object? error)
    {
        var response = new Dictionary<string, object?> { ["kind"] = "response", ["id"] = id, ["ok"] = ok };
        if (ok) response["result"] = result;
        else response["error"] = error;
        return json.Serialize(response);
    }
}

static class DictionaryExtensions
{
    public static object? Get(this Dictionary<string, object>? d, string key) =>
        d != null && d.TryGetValue(key, out var v) ? v : null;
}
