#nullable disable

using System.Runtime.Serialization.Json;
using System.Text;

namespace MeasurementFramework
{
    internal class Measurements : Logger.MeasurementsBase
    {
        public Measurements(int id) : base(id)
        {
        }

        private const string operation = "Operation";

        internal readonly Logger.Measurement MainElapsed = new Logger.Measurement(table: operation, name: nameof(MainElapsed));

        internal readonly Logger.Measurement CommandIf = new Logger.Measurement(table: operation, name: nameof(CommandIf), validate: true);
        internal readonly Logger.Measurement CommandElseIf = new Logger.Measurement(table: operation, name: nameof(CommandElseIf), validate: true);
        internal readonly Logger.Measurement CommandElse = new Logger.Measurement(table: operation, name: nameof(CommandElse), validate: true);
        internal readonly Logger.Measurement EndIf = new Logger.Measurement(table: operation, name: nameof(EndIf), validate: true);
        internal readonly Logger.Measurement ElseAndEndIfPreprocessorMatch = new Logger.Measurement(table: operation, name: nameof(ElseAndEndIfPreprocessorMatch), validate: true);
        internal readonly Logger.Measurement StartPreprocessorMatch = new Logger.Measurement(table: operation, name: nameof(StartPreprocessorMatch), validate: true);
        internal readonly Logger.Measurement ExitCode = new Logger.Measurement(table: operation, name: nameof(ExitCode));
        internal readonly Logger.Measurement UpdateTaskOutput = new Logger.Measurement(table: operation, name: nameof(UpdateTaskOutput));
        internal readonly Logger.Measurement AllTasks = new Logger.Measurement(table: operation, name: nameof(AllTasks));
        internal readonly Logger.Measurement WriteUpdates = new Logger.Measurement(table: operation, name: nameof(WriteUpdates));
    }

    // logger is a basic logger for measurements.  It can write simple types.  
    // it is designed to be very 'wide' and to collect measurements over time.
    // multiple measurements can be written
    class Logger
    {
        private readonly Dictionary<string, Dictionary<int, Dictionary<string, List<object>>>> store = new();
        private readonly object Measurements;
        private readonly int id;

        public Logger(object measurmentDefs, int id)
        {
            this.id = id;
            this.Measurements = measurmentDefs;

            var measurements = measurmentDefs.GetType().GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).Where(x => x.FieldType == typeof(Measurement));

            foreach (var m in measurements)
            {
                ((Measurement)m.GetValue(this.Measurements)!).SetLogger(this);
            }
        }

        public void Save()
        {
#if old
            DataContractJsonSerializer dcs = new DataContractJsonSerializer(typeof(Dictionary<string, Dictionary<int, Dictionary<string, List<object>>>>), new DataContractJsonSerializerSettings { UseSimpleDictionaryFormat = true });
            using (FileStream fs = new FileStream(@"C:\Users\merlynop\OneDrive - Microsoft\src\MeasurementFramework\MeasurementFramework\Data\store.json", FileMode.Create))
            {
                using (var writer = JsonReaderWriterFactory.CreateJsonWriter(fs, Encoding.UTF8, true, true, "   "))
                {
                    dcs.WriteObject(writer, store);
                }
            }
#else
            DataContractJsonSerializer dcs = new DataContractJsonSerializer(typeof(Dictionary<string, List<object>>), new DataContractJsonSerializerSettings { UseSimpleDictionaryFormat = true });

            foreach (var table in store)
            {
                foreach (var row in table.Value)
                {
                    using (FileStream fs = new FileStream($@"C:\Users\merlynop\OneDrive - Microsoft\src\MeasurementFramework\MeasurementFramework\Data\{table.Key}_{row.Key}.json", FileMode.Create))
                    {
                        using (var writer = JsonReaderWriterFactory.CreateJsonWriter(fs, Encoding.UTF8, true, true, "   "))
                        {
                            dcs.WriteObject(writer, row.Value);
                        }
                    }
                }
            }
#endif
        }

        internal void Collect(MeasurementValue measurement)
        {
            if (!store.TryGetValue(measurement.m.table, out var idTable))
            {
                idTable = new Dictionary<int, Dictionary<string, List<object>>>();
                store.Add(measurement.m.table, idTable);
            }

            if (!idTable.TryGetValue(id, out var tableMeasurements))
            {
                tableMeasurements = new Dictionary<string, List<object>>();
                idTable.Add(id, tableMeasurements);
            }

            if (!tableMeasurements.TryGetValue(measurement.m.name, out var column))
            {
                column = new List<object>();
                tableMeasurements.Add(measurement.m.name, column);
            }

            if (measurement.m.iscount)
            {
                if (column.Any())
                {
                    column[0] = ((int)column[0]) + 1;
                }
                else
                {
                    column.Add(1);
                }
            }
            else if (measurement.m.validate)
            {
                if (column.Any())
                {
                    column[0] = (bool)column[0] && (bool)measurement.value;
                }
                else
                {
                    column.Add(measurement.value);
                }
            }
            else
            {
                column.Add(measurement.value);
            }
        }

        internal void WriteStoreToFile()
        {
            var measurements = Measurements.GetType().GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance); //.Where(x => x.FieldType == typeof(Measurement));

            foreach (var table in store)
            {
                TabFileWriter writer = new TabFileWriter(Path.Combine(@"C:\Users\merlynop\OneDrive - Microsoft\src\MeasurementFramework\MeasurementFramework\Data", table.Key));

                foreach (var row in table.Value)
                {
                    writer.Add("Id", row.Key.ToString());

                    foreach (var measurement in measurements)
                    {
                        if (row.Value.ContainsKey(measurement.Name))
                        {
                            writer.Add(measurement.Name, string.Join(',', row.Value[measurement.Name]));
                        }
                        else
                        {
                            writer.Add(measurement.Name, "");
                        }
                    }
                }

                writer.Flush();
            }
        }


        internal void TryFlush()
        {
            WriteStoreToFile();
            Save();
        }

        internal class Measurement
        {
            internal readonly string table;
            internal readonly string name;
            internal readonly bool iscount;
            internal readonly bool validate;
            private Logger logger;

            internal void SetLogger(Logger logger)
            {
                this.logger = logger;
            }

            public Measurement(string table, string name, bool iscount = false, bool validate = false)
            {
                this.table = table;
                this.name = name;
                this.iscount = iscount;
                this.validate = validate;
            }

            internal void Measure(object value)
            {
                logger.Collect(new MeasurementValue(this, value));
            }

            internal void Measure()
            {
                logger.Collect(new MeasurementValue(this, null));
            }
        }

        internal class MeasurementValue
        {
            public Measurement m;
            public object value;

            public MeasurementValue(Measurement m, object value)
            {
                this.m = m;
                this.value = value;
            }
        }

        public class MeasurementsBase
        {
            private int id;
            public readonly Logger logger;

            public MeasurementsBase(int id)
            {
                this.id = id;
                logger = new Logger(this, id);
            }
        }
    }

    

}