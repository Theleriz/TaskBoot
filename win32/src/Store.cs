using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Threading;

namespace TaskTracker
{
    // Модель данных из ТЗ (базовое, п. 5.1, и расширение 02, п. 5.1).
    // Имена полей совпадают с JSON-форматом веб-версии.
    public class TaskItem
    {
        public string id { get; set; }
        public string title { get; set; }
        public string quadrant { get; set; }
        public string status { get; set; }
        public long createdAt { get; set; }
        public string description { get; set; }
        public List<CheckItem> checklist { get; set; }
        public List<LinkItem> links { get; set; }

        public TaskItem()
        {
            description = "";
            checklist = new List<CheckItem>();
            links = new List<LinkItem>();
        }
    }

    public class CheckItem
    {
        public string id { get; set; }
        public string text { get; set; }
        public bool done { get; set; }
    }

    public class LinkItem
    {
        public string id { get; set; }
        public string url { get; set; }
        public string label { get; set; }
    }

    public class Note
    {
        public string id { get; set; }
        public string title { get; set; }
        public string text { get; set; }
        public long createdAt { get; set; }
        public long updatedAt { get; set; }
    }

    public class Secret
    {
        public string id { get; set; }
        public string name { get; set; }
        public string value { get; set; }
        public long createdAt { get; set; }
    }

    // Тема оформления. mode: system | light | dark | custom | random | saved.
    public class ThemeSettings
    {
        public string mode { get; set; }
        public string customBg { get; set; }
        public string customAccent { get; set; }
        public string randomBg { get; set; }
        public string randomAccent { get; set; }
        public string savedId { get; set; }

        public ThemeSettings()
        {
            mode = "system";
            customBg = "#F3F4F6";
            customAccent = "#3B5BDB";
        }
    }

    public class SavedTheme
    {
        public string id { get; set; }
        public string name { get; set; }
        public string bg { get; set; }
        public string accent { get; set; }
    }

    public class Settings
    {
        public int workMinutes { get; set; }
        public int restMinutes { get; set; }
        public ThemeSettings theme { get; set; }
        public List<SavedTheme> themes { get; set; }

        public Settings()
        {
            workMinutes = 45;
            restMinutes = 15;
            theme = new ThemeSettings();
            themes = new List<SavedTheme>();
        }
    }

    public class AppData
    {
        public List<TaskItem> tasks { get; set; }
        public Settings settings { get; set; }
        public List<Note> notes { get; set; }
        public List<Secret> secrets { get; set; }

        public AppData()
        {
            tasks = new List<TaskItem>();
            settings = new Settings();
            notes = new List<Note>();
            secrets = new List<Secret>();
        }
    }

    // Единственный источник данных: все представления читают отсюда и подписаны на TasksChanged.
    public class Store
    {
        public static readonly string[] QuadrantKeys = { "q1", "q2", "q3", "q4" };
        public static readonly string[] StatusKeys = { "todo", "doing", "done" };

        public const int MaxWorkMinutes = 180;
        public const int MaxRestMinutes = 60;

        readonly string dir;
        readonly string path;
        readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
        readonly AppData data;
        readonly DispatcherTimer deferred;
        bool saveErrorShown;

        public event Action TasksChanged;

        public Store()
        {
            dir = Environment.GetEnvironmentVariable("TASKTRACKER_DATA_DIR");
            if (string.IsNullOrEmpty(dir))
                dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TaskTracker");
            path = Path.Combine(dir, "data.json");
            data = Load();

            // Правки текста (описание, заголовок при вводе) сохраняются пачкой, а не на каждую клавишу.
            deferred = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(350) };
            deferred.Tick += (s, e) =>
            {
                deferred.Stop();
                Commit();
            };
        }

        public string DataPath { get { return path; } }
        public IList<TaskItem> Tasks { get { return data.tasks.AsReadOnly(); } }
        public List<Note> Notes { get { return data.notes; } }
        public List<Secret> Secrets { get { return data.secrets; } }
        public Settings Settings { get { return data.settings; } }
        public int WorkMinutes { get { return data.settings.workMinutes; } }
        public int RestMinutes { get { return data.settings.restMinutes; } }

        public TaskItem Get(string id)
        {
            return data.tasks.FirstOrDefault(t => t.id == id);
        }

        public TaskItem Add(string title)
        {
            title = (title ?? "").Trim();
            if (title.Length == 0) return null;

            var task = new TaskItem
            {
                id = NewId(),
                title = title,
                quadrant = "q2",
                status = "todo",
                createdAt = NowMs()
            };
            data.tasks.Add(task);
            Commit();
            return task;
        }

        // F-96: детали хранятся внутри задачи и удаляются вместе с ней.
        public void Remove(string id)
        {
            if (data.tasks.RemoveAll(t => t.id == id) > 0) Commit();
        }

        public void SetQuadrant(string id, string quadrant)
        {
            var task = Get(id);
            if (task == null || task.quadrant == quadrant || !QuadrantKeys.Contains(quadrant)) return;
            task.quadrant = quadrant;
            Commit();
        }

        public void SetStatus(string id, string status)
        {
            var task = Get(id);
            if (task == null || task.status == status || !StatusKeys.Contains(status)) return;
            task.status = status;
            Commit();
        }

        // Задачу уже изменили на месте (детали, чек-лист, ссылки) — сохранить и перерисовать доски.
        public void TaskEdited()
        {
            deferred.Stop();
            Commit();
        }

        public void TaskEditedDeferred()
        {
            deferred.Stop();
            deferred.Start();
        }

        public void SaveWorkspace()
        {
            Save();
        }

        public void SaveSettings()
        {
            Save();
        }

        public void SaveDurations(int workMinutes, int restMinutes)
        {
            data.settings.workMinutes = workMinutes;
            data.settings.restMinutes = restMinutes;
            Save();
        }

        public void Flush()
        {
            if (!deferred.IsEnabled) return;
            deferred.Stop();
            Commit();
        }

        public static bool HasDetails(TaskItem t)
        {
            return t.description.Trim().Length > 0 || t.checklist.Count > 0 || t.links.Count > 0;
        }

        // F-89: только http(s)-адреса с доменом; схему https:// подставляем, если её не ввели.
        public static string NormalizeUrl(string input)
        {
            var s = (input ?? "").Trim();
            if (s.Length == 0 || s.Any(char.IsWhiteSpace)) return null;
            if (s.IndexOf("://", StringComparison.Ordinal) < 0) s = "https://" + s;
            Uri uri;
            if (!Uri.TryCreate(s, UriKind.Absolute, out uri)) return null;
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return null;
            if (uri.Host.Length == 0 || (uri.Host.IndexOf('.') < 0 && uri.Host != "localhost")) return null;
            return uri.AbsoluteUri;
        }

        public static string NewId()
        {
            return Guid.NewGuid().ToString();
        }

        public static long NowMs()
        {
            return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
        }

        void Commit()
        {
            Save();
            if (TasksChanged != null) TasksChanged();
        }

        void Save()
        {
            try
            {
                Directory.CreateDirectory(dir);
                var tmp = path + ".tmp";
                File.WriteAllText(tmp, json.Serialize(data), new UTF8Encoding(false));
                if (File.Exists(path)) File.Replace(tmp, path, null);
                else File.Move(tmp, path);
            }
            catch (Exception ex)
            {
                if (saveErrorShown) return;
                saveErrorShown = true;
                MessageBox.Show("Не удалось сохранить данные в\n" + path + "\n\n" + ex.Message,
                    "Task Tracker", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        AppData Load()
        {
            if (!File.Exists(path)) return new AppData();

            AppData loaded;
            try
            {
                loaded = json.Deserialize<AppData>(File.ReadAllText(path, Encoding.UTF8)) ?? new AppData();
            }
            catch
            {
                // Повреждённый файл не перезаписываем молча: откладываем копию рядом.
                try { File.Copy(path, path + ".corrupt-" + DateTime.Now.ToString("yyyyMMdd-HHmmss")); }
                catch { }
                return new AppData();
            }

            if (loaded.tasks == null) loaded.tasks = new List<TaskItem>();
            if (loaded.settings == null) loaded.settings = new Settings();
            if (loaded.notes == null) loaded.notes = new List<Note>();
            if (loaded.secrets == null) loaded.secrets = new List<Secret>();

            // N-23: недостающие поля старых задач инициализируются пустыми значениями.
            loaded.tasks.RemoveAll(t => t == null || string.IsNullOrWhiteSpace(t.title));
            foreach (var t in loaded.tasks)
            {
                if (string.IsNullOrEmpty(t.id)) t.id = NewId();
                t.title = t.title.Trim();
                if (!QuadrantKeys.Contains(t.quadrant)) t.quadrant = "q2";
                if (!StatusKeys.Contains(t.status)) t.status = "todo";
                if (t.description == null) t.description = "";
                t.checklist = (t.checklist ?? new List<CheckItem>())
                    .Where(i => i != null && !string.IsNullOrWhiteSpace(i.text)).ToList();
                foreach (var i in t.checklist)
                {
                    if (string.IsNullOrEmpty(i.id)) i.id = NewId();
                    i.text = i.text.Trim();
                }
                t.links = (t.links ?? new List<LinkItem>())
                    .Where(l => l != null && NormalizeUrl(l.url) != null).ToList();
                foreach (var l in t.links)
                {
                    if (string.IsNullOrEmpty(l.id)) l.id = NewId();
                    l.url = NormalizeUrl(l.url);
                    l.label = (l.label ?? "").Trim();
                }
            }

            loaded.notes.RemoveAll(n => n == null || string.IsNullOrWhiteSpace(n.title));
            foreach (var n in loaded.notes)
            {
                if (string.IsNullOrEmpty(n.id)) n.id = NewId();
                if (n.text == null) n.text = "";
            }
            loaded.secrets.RemoveAll(s => s == null || string.IsNullOrWhiteSpace(s.name));
            foreach (var s in loaded.secrets)
            {
                if (string.IsNullOrEmpty(s.id)) s.id = NewId();
                if (s.value == null) s.value = "";
            }

            var st = loaded.settings;
            if (st.theme == null) st.theme = new ThemeSettings();
            if (string.IsNullOrEmpty(st.theme.mode)) st.theme.mode = "system";
            if (st.themes == null) st.themes = new List<SavedTheme>();
            st.themes.RemoveAll(t => t == null || string.IsNullOrWhiteSpace(t.name) || string.IsNullOrEmpty(t.bg) || string.IsNullOrEmpty(t.accent));
            foreach (var t in st.themes) if (string.IsNullOrEmpty(t.id)) t.id = NewId();
            st.workMinutes = Clamp(st.workMinutes, 1, MaxWorkMinutes, 45);
            st.restMinutes = Clamp(st.restMinutes, 1, MaxRestMinutes, 15);
            return loaded;
        }

        static int Clamp(int value, int min, int max, int fallback)
        {
            if (value <= 0) return fallback;
            return Math.Max(min, Math.Min(max, value));
        }
    }
}
