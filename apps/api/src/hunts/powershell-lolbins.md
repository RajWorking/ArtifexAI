# Hunt: Windows Suspicious PowerShell + LOLBins (Splunk MCP)

**Hunt ID:** WIN-HUNT-PS-LOLBIN-001
**Goal:** Find likely malicious PowerShell (encoded/obfuscated) and common LOLBins used for download/exec.
**MCP assumption:** Your agent calls a Splunk MCP tool like `run_splunk_query(spl, earliest, latest)`.
**Default window:** last 24h (start with last 4h for triage).

---

## Hypothesis
Attackers may use PowerShell `-enc` / obfuscation and LOLBins (`rundll32`, `regsvr32`, `mshta`, `certutil`, `bitsadmin`, `wscript/cscript`, `schtasks`) to blend in and execute payloads.

---

## Step A — Suspicious PowerShell

If you have PowerShell ScriptBlock logs (4104), run:

```spl
(index=* sourcetype="WinEventLog:Microsoft-Windows-PowerShell/Operational" EventCode=4104)
| eval script=coalesce(ScriptBlockText, Message)
| where like(lower(script), "%-enc%")
   OR like(lower(script), "%encodedcommand%")
   OR like(lower(script), "%frombase64string%")
   OR like(lower(script), "%iex%")
   OR like(lower(script), "%invoke-expression%")
   OR like(lower(script), "%downloadstring%")
   OR like(lower(script), "%webclient%")
| stats count values(Computer) as hosts values(User) as users values(script) as example min(_time) as first max(_time) as last
| convert ctime(first) ctime(last)
| sort - count
```

Fallback (Sysmon 1 / Security 4688), run:

```spl
(index=* (sourcetype="WinEventLog:Security" EventCode=4688) OR (sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1))
| eval Image=coalesce(NewProcessName, Image), CommandLine=coalesce(Process_Command_Line, CommandLine)
| where like(lower(Image), "%\\powershell.exe") OR like(lower(Image), "%\\pwsh.exe")
| where like(lower(CommandLine), "%-enc%") OR like(lower(CommandLine), "%encodedcommand%")
   OR like(lower(CommandLine), "%frombase64string%") OR like(lower(CommandLine), "%iex%")
   OR like(lower(CommandLine), "%downloadstring%") OR like(lower(CommandLine), "%webclient%")
| stats count values(Computer) as hosts values(AccountName) as users values(ParentProcessName) as parents values(CommandLine) as sample
| sort - count
```

---

## Step B — Suspicious LOLBins

```spl
(index=* (sourcetype="WinEventLog:Security" EventCode=4688) OR (sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1))
| eval Image=lower(coalesce(NewProcessName, Image)), CommandLine=lower(coalesce(Process_Command_Line, CommandLine))
| where match(Image, "\\\\(rundll32|regsvr32|mshta|certutil|bitsadmin|wscript|cscript|installutil|wmic|schtasks)\\.exe$")
| where like(CommandLine, "%http%") OR like(CommandLine, "%https%")
   OR like(CommandLine, "%scrobj.dll%") OR like(CommandLine, "%-urlcache%") OR like(CommandLine, "%-decode%")
   OR like(CommandLine, "%javascript:%") OR like(CommandLine, "%vbscript:%") OR like(CommandLine, "% /create %")
| stats count values(Computer) as hosts values(AccountName) as users values(ParentProcessName) as parents values(CommandLine) as sample
| sort - count
```

---

## Step C — Quick Correlation (same host/user within 10m)

```spl
(index=* (sourcetype="WinEventLog:Security" EventCode=4688) OR (sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1))
| eval Image=lower(coalesce(NewProcessName, Image)), CommandLine=lower(coalesce(Process_Command_Line, CommandLine))
| eval user=coalesce(AccountName, User), host=coalesce(Computer, host)
| eval is_ps=if(match(Image, "\\\\(powershell|pwsh)\\.exe$"),1,0)
| eval is_lol=if(match(Image, "\\\\(rundll32|regsvr32|mshta|certutil|bitsadmin|wscript|cscript|installutil|wmic|schtasks)\\.exe$"),1,0)
| where is_ps=1 OR is_lol=1
| bin _time span=10m
| stats values(Image) as images values(CommandLine) as cmdlines values(ParentProcessName) as parents sum(is_ps) as ps sum(is_lol) as lol count as events
  by host, user, _time
| where ps>0 AND lol>0
| convert ctime(_time)
| sort - events
```

---

## Triage (fast)
- Weird parents (Office/browsers → PowerShell/LOLBin) are high-signal.
- URLs / Base64 blobs / "download+execute" strings are high-signal.
- Reduce noise with allowlists for known admin tools/accounts and maintenance windows.

---

## Analysis Guidance for LLM Agent

When analyzing results:
1. **Severity**: Base on combination of indicators - encoded PowerShell + LOLBin correlation = HIGH, single indicator = MEDIUM
2. **Confidence**: Higher if weird parent processes, URLs, or base64 detected. Lower if only suspicious patterns without context.
3. **Evidence**: Extract top 5 most suspicious command lines with timestamps and hosts
4. **Affected Entities**: List unique hostnames where activity detected
5. **Recommendation**: Tailor to what was found - if active compromise suspected, prioritize isolation and forensics
