using System.Diagnostics;
using System.Text;

var root = AppContext.BaseDirectory;
var logPath = Path.Combine(root, "ai-pixel-art.log");

void WriteLog(string message)
{
    File.AppendAllText(
        logPath,
        $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}",
        Encoding.UTF8);
}

try
{
    var packagePath = Path.Combine(root, "package.json");
    if (!File.Exists(packagePath))
    {
        WriteLog("Could not start AI Pixel Art: package.json was not found next to the launcher.");
        return 1;
    }

    var command = $"/d /s /c \"npm run browser >> \"\"{logPath}\"\" 2>&1\"";
    var startInfo = new ProcessStartInfo
    {
        FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
        Arguments = command,
        WorkingDirectory = root,
        CreateNoWindow = true,
        UseShellExecute = false,
        WindowStyle = ProcessWindowStyle.Hidden,
    };

    Process.Start(startInfo);
    return 0;
}
catch (Exception error)
{
    WriteLog($"Could not start AI Pixel Art: {error}");
    return 1;
}
