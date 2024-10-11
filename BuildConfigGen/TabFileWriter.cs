#nullable disable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MeasurementFramework
{
    // writes to a tab delimited file with supplied headers and values.
    // a base file name is specified
    // rows are appended to an existing file
    // one row is constructed at a time by supplying header and value pairs
    // row is written when flush is called
    // if new headers are added, a new file is created with the new row
    // co-authored gh copilot 10/10/24
    class TabFileWriter : IDisposable
    {
        private readonly string baseFileName;
        private string currentFileName;
        private readonly List<string> headers;
        private readonly Dictionary<string, string> values;
        private bool disposed = false;

        public TabFileWriter(string baseFileName)
        {
            this.baseFileName = baseFileName;
            this.currentFileName = GetLastWrittenFileName(baseFileName);
            this.headers = new List<string>();
            this.values = new Dictionary<string, string>();
        }

        public void Add(string header, string value)
        {
            if (!headers.Contains(header))
            {
                headers.Add(header);
            }

            values[header] = EncodeValue(value);
        }

        public void Flush()
        {
            if (headers.Count == 0)
            {
                return;
            }

            if (!File.Exists(currentFileName))
            {
                currentFileName = GetNewFileName(baseFileName);
                File.WriteAllText(currentFileName, string.Join("\t", headers.Select(EncodeValue)) + Environment.NewLine);
            }
            else
            {
                var existingHeaders = File.ReadLines(currentFileName).FirstOrDefault();
                if (existingHeaders != null)
                {
                    var existingHeadersList = existingHeaders.Split('\t').Select(DecodeValue).ToList();
                    var newHeaders = headers.Except(existingHeadersList);
                    if (newHeaders.Any())
                    {
                        currentFileName = GetNewFileName(baseFileName);
                        File.WriteAllText(currentFileName, string.Join("\t", headers.Select(EncodeValue)) + Environment.NewLine);
                    }
                }
            }

            var rowValues = headers.Select(header => values.ContainsKey(header) ? values[header] : "");
            File.AppendAllText(currentFileName, string.Join("\t", rowValues) + Environment.NewLine);
            values.Clear();
        }

        private string EncodeValue(string value)
        {
            return value.Replace("\\", "\\\\").Replace("\t", "\\t").Replace("\r", "\\r").Replace("\n", "\\n");
        }

        private string DecodeValue(string value)
        {
            return value.Replace("\\\\", "\\").Replace("\\t", "\t").Replace("\\n", "\n").Replace("\\r", "\r");
        }

        private string GetLastWrittenFileName(string baseFileName)
        {
            var directory = Path.GetDirectoryName(baseFileName);
            var baseFileNameWithoutExtension = Path.GetFileNameWithoutExtension(baseFileName);
            var extension = Path.GetExtension(baseFileName);

            var files = Directory.GetFiles(directory, $"{baseFileNameWithoutExtension}_*{extension}")
                                 .Select(f => new { FileName = f, Date = GetDateFromFileName(f, baseFileNameWithoutExtension, extension) })
                                 .Where(f => f.Date != null)
                                 .OrderByDescending(f => f.Date)
                                 .ToList();

            return files.Any() ? files.First().FileName : baseFileName;
        }

        private DateTime? GetDateFromFileName(string fileName, string baseFileNameWithoutExtension, string extension)
        {
            var dateString = Path.GetFileNameWithoutExtension(fileName).Substring(baseFileNameWithoutExtension.Length + 1);
            if (DateTime.TryParseExact(dateString, "yyyyMMddHHmmss", null, System.Globalization.DateTimeStyles.None, out var date))
            {
                return date;
            }
            return null;
        }

        private string GetNewFileName(string baseFileName)
        {
            var directory = Path.GetDirectoryName(baseFileName);
            var baseFileNameWithoutExtension = Path.GetFileNameWithoutExtension(baseFileName);
            var extension = Path.GetExtension(baseFileName);

            var newFileName = Path.Combine(directory, $"{baseFileNameWithoutExtension}_{DateTime.Now:yyyyMMddHHmmss}{extension}");
            return newFileName;
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!disposed)
            {
                if (disposing)
                {
                    Flush();
                }

                disposed = true;
            }
        }
    }
}
 