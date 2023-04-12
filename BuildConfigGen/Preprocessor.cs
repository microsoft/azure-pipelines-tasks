using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace BuildConfigGen
{
    internal partial class Preprocessor
    {

        [GeneratedRegex("^(?<spacesBeforeHash>\\s*)#(?<command>\\w+)(?<spacesAfterHash>\\s+)(?<expression>.*)", RegexOptions.Singleline)]
        private static partial Regex startPreprocess();

        [GeneratedRegex("^(?<spacesBeforeHash>\\s*)#(?<command>\\w+)", RegexOptions.Singleline)]
        private static partial Regex elseAndEndIfPreprocess();


        internal static void Preprocess(string file, IEnumerable<string> lines, ISet<string> configreprocessorVariableName, string configName, out string processedOutput, out List<string> validationErrors, out bool madeChanges)
        {
            const string ifCommand = "if";
            const string elseIfCommand = "elseif";
            const string endIfCommand = "endif";
            const string elseCommand = "else";

            madeChanges = false;

            validationErrors = new List<string>();

            StringBuilder output = new StringBuilder();

            bool inIfBlock = false;
            bool inElseBlock = false;

            string? currentExpression = null;
            bool ifBlockMatched = false;
            HashSet<string> expressions = new HashSet<string>();

            int lineNumber = 0;
            foreach (var line in lines)
            {
                lineNumber++;
                Match elseAndEndIfPreprocessMatch = elseAndEndIfPreprocessMatch = elseAndEndIfPreprocess().Match(line);
                var startPreprocessMatch = startPreprocess().Match(line);

                string? command = null;
                string? expression = null;
                bool lineIsDirective = false;

                if (startPreprocessMatch.Success)
                {
                    lineIsDirective = true;

                    if (startPreprocessMatch.Groups["spacesBeforeHash"].Value != "")
                    {
                        validationErrors.Add($"Error {file}:{lineNumber}: # should not be preceeded by spaces");
                    }

                    if (startPreprocessMatch.Groups["command"].Value != ifCommand && startPreprocessMatch.Groups["command"].Value != elseIfCommand)
                    {
                        validationErrors.Add($"Error {file}:{lineNumber}: command after # must be if or elseif (case-sensitive), when followed by a space and expression of 0 or more characters");
                    }

                    if (startPreprocessMatch.Groups["spacesAfterHash"].Value != " ")
                    {
                        validationErrors.Add($"Error {file}:{lineNumber}: there must be a single space after the hash");
                    }

                    if (!configreprocessorVariableName.Contains(startPreprocessMatch.Groups["expression"].Value))
                    {
                        validationErrors.Add($"Error {file}:{lineNumber}: the expression can only be {string.Join(',', configreprocessorVariableName.ToArray())}");
                    }

                    command = startPreprocessMatch.Groups["command"].Value;
                    expression = startPreprocessMatch.Groups["expression"].Value;
                    
                    currentExpression = expression;

                    if (expressions.Contains(expression))
                    {
                        validationErrors.Add($"Error {file}:{lineNumber}: expression already encountered in IF / ELSEIF expression={expression}");
                    }
                    else
                    {
                        expressions.Add(expression);
                    }

                }
                else if (elseAndEndIfPreprocessMatch.Success)
                {
                    lineIsDirective = true;

                    if (elseAndEndIfPreprocessMatch.Groups["spacesBeforeHash"].Value != "")
                    {
                        validationErrors.Add($"Error {file}:{lineNumber}: # should not be preceeded by spaces");
                    }

                    if (elseAndEndIfPreprocessMatch.Groups["command"].Value != elseCommand && elseAndEndIfPreprocessMatch.Groups["command"].Value != endIfCommand)
                    {
                        validationErrors.Add($"Error {file}:{lineNumber}: command after # should be else or endif (case-sensitive), when followed by a space and expression");
                    }

                    command = elseAndEndIfPreprocessMatch.Groups["command"].Value;
                    currentExpression = null;
                }

                if (command is not null)
                {
                    switch (command)
                    {
                        case ifCommand:
                            if (inElseBlock)
                            {
                                validationErrors.Add($"Error {file}:{lineNumber}: nested #if block in #else block detected, not allowed");
                            }

                            if (inIfBlock)
                            {
                                validationErrors.Add($"Error {file}:{lineNumber}: nested #if block in #if or #ifelse block detected, not allowed");
                            }

                            inIfBlock = true;

                            if (currentExpression == configName)
                            {
                                ifBlockMatched = true;
                            }
                            break;
                        case elseIfCommand:
                            if (!inIfBlock)
                            {
                                validationErrors.Add($"Error {file}:{lineNumber}: #elseif detected without matching #if block");
                            }

                            if (currentExpression == configName)
                            {
                                ifBlockMatched = true;
                            }
                            break;
                        case elseCommand:
                            if (!inIfBlock)
                            {
                                validationErrors.Add($"Error {file}:{lineNumber}: #else detected without matching #if or #ifelse block");
                            }

                            inIfBlock = false;
                            inElseBlock = true;
                            currentExpression = null;
                            break;
                        case endIfCommand:
                            if (inIfBlock || inElseBlock)
                            {
                                // do nothing
                            }
                            else
                            {
                                validationErrors.Add($"Error {file}:{lineNumber}: #endif detected without matching #if, #ifelse, or #else block");
                            }

                            inIfBlock = false;
                            currentExpression = null;
                            ifBlockMatched = false;
                            inElseBlock = false;
                            expressions.Clear();
                            break;
                        default:
                            validationErrors.Add($"Error {file}:{lineNumber}: unknown command {command}");
                            currentExpression = null;
                            break;
                    }
                }

                // assert state

                if (inIfBlock && inElseBlock)
                {
                    throw new Exception("BUG: state erorr: both inIfBlock && inElseBlock cannot be true;");
                }


                if (inIfBlock && currentExpression is null)
                {
                    throw new Exception("BUG: state error: currentExpression cannot be null when inIfBlock is true");
                }

                if (!inIfBlock && currentExpression is not null)
                {
                    throw new Exception("BUG: state error: currentExpression must be null when inIfBlock is false");
                }

                /*
                        if (inIfBlock || inElseBlock)
                        {
                            if (ifBlockMatched is null)
                            {
                                throw new Exception($"BUG: state error: ifBlockMatched must be not be null if (inIfBlock={inIfBlock} or inElseBlock={inElseBlock})");
                            }
                        }
                        else
                        {
                            if (ifBlockMatched is not null)
                            {
                                throw new Exception($"BUG: state error: ifBlockMatched must be null if not (inIfBlock={inIfBlock} or inElseBlock={inElseBlock})");
                            }
                        }
                */

                if (lineIsDirective)
                {
                    madeChanges = true;
                }
                else
                {
                    if (inIfBlock)
                    {
                        if (currentExpression == configName)
                        {
                            output.AppendLine(line);
                        }

                        madeChanges = true;
                    }
                    else if (inElseBlock)
                    {
                        if (!ifBlockMatched)
                        {
                            output.AppendLine(line);
                        }

                        madeChanges = true;
                    }
                    else
                    {
                        output.AppendLine(line);
                    }
                }
            }

            if (inIfBlock)
            {
                validationErrors.Add($"Error {file}:{lineNumber}: still in #if block at EOF");
            }

            if (inElseBlock)
            {
                validationErrors.Add($"Error {file}:{lineNumber}: still in #ifelse block at EOF");
            }

            //File.WriteAllText(file, output.ToString());
            processedOutput = output.ToString();
        }
   
    }
}
