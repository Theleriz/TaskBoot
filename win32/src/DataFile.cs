using System;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace TaskTracker;

/// <summary>
/// %APPDATA%\TaskTracker\data.json (or the folder from TASKTRACKER_DATA_DIR).
/// The web app owns the format; the shell only stores the text safely.
/// </summary>
public sealed class DataFile
{
    static readonly UTF8Encoding Utf8NoBom = new(false);

    readonly string dir;

    public DataFile()
    {
        var custom = Environment.GetEnvironmentVariable("TASKTRACKER_DATA_DIR");
        dir = string.IsNullOrEmpty(custom)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TaskTracker")
            : custom!;
        FilePath = Path.Combine(dir, "data.json");
    }

    public string FilePath { get; }

    public string? Load() => File.Exists(FilePath) ? File.ReadAllText(FilePath, Encoding.UTF8) : null;

    /// <summary>Writes atomically. Keeps the previous file as data.json.bak, or as data.json.corrupt-* if it was broken.</summary>
    public void Save(string json)
    {
        if (!IsJson(json)) throw new BridgeException("invalid_payload", "The data to save is not valid JSON.");

        Directory.CreateDirectory(dir);
        if (File.Exists(FilePath))
        {
            var previous = File.ReadAllText(FilePath, Encoding.UTF8);
            var backup = IsJson(previous)
                ? FilePath + ".bak"
                : FilePath + ".corrupt-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
            File.Copy(FilePath, backup, overwrite: true);
        }

        var tmp = FilePath + ".tmp";
        File.WriteAllText(tmp, json, Utf8NoBom);
        if (File.Exists(FilePath)) File.Replace(tmp, FilePath, null);
        else File.Move(tmp, FilePath);
    }

    static bool IsJson(string text)
    {
        try
        {
            new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.DeserializeObject(text);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }
}
