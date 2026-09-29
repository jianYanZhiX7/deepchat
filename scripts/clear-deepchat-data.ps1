#Requires -Version 5.1

[CmdletBinding()]
param(
    [Alias('y')][switch]$Yes,
    [Alias('n')][switch]$DryRun,
    [switch]$Purge,
    [Alias('f')][switch]$Force,
    [Alias('h')][switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$AppName = 'DeepChat'
$BackupRoot = Join-Path $HOME '.deepchat-backups'
$RegistryTargets = @(
    'HKCU:\Software\DeepChat',
    'HKCU:\Software\com.wefonk.deepchat',
    'HKCU:\Software\Classes\deepchat',
    'HKCU:\Software\Classes\com.wefonk.deepchat'
)

function Show-Usage {
    @'
用法: clear-deepchat-data.ps1 [-Yes] [-DryRun] [-Purge] [-Force] [-Help]

清除 DeepChat 的全部本地数据（设置、会话、插件、模型缓存、登录态、协议注册等），
清理完成后 DeepChat 将恢复为首次打开的状态。

清理范围:
  %APPDATA%\DeepChat、%LOCALAPPDATA%\DeepChat（文件数据，仅处理存在的）
  HKCU:\Software\DeepChat、HKCU:\Software\com.wefonk.deepchat、
  HKCU:\Software\Classes\deepchat、HKCU:\Software\Classes\com.wefonk.deepchat（注册表项，仅处理存在的）
  不处理 HKCU 下的 Uninstall 卸载记录，以免破坏卸载入口。

选项（PowerShell 语法，不支持 -- 前缀）:
  -Yes, -y       跳过确认提示
  -DryRun, -n    仅列出将被清理的内容，不执行任何修改
  -Purge         直接删除数据；默认会先备份到 $HOME\.deepchat-backups
  -Force, -f     优雅退出失败时强制结束 DeepChat 进程（可能丢失未保存的会话）
  -Help, -h      显示帮助

示例:
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\clear-deepchat-data.ps1 -DryRun
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\clear-deepchat-data.ps1 -Yes

清理前脚本会先请求 DeepChat 优雅退出；仅当存在可见窗口时才等待退出结果。
若无可见窗口（如开发模式、后台常驻）会立即判定失败，需加 -Force 或手动退出后重试。
'@
}

function Get-AppProcess {
    Get-Process -Name $AppName -ErrorAction SilentlyContinue
}

function Get-Targets {
    $roots = @($env:APPDATA, $env:LOCALAPPDATA) | Where-Object { $_ }
    $paths = foreach ($root in $roots) {
        Join-Path $root $AppName
    }
    $paths |
        Where-Object { Test-Path -LiteralPath $_ } |
        ForEach-Object { (Get-Item -LiteralPath $_ -Force).FullName } |
        Select-Object -Unique
}

function Get-RegistryTargets {
    @($RegistryTargets | Where-Object { Test-Path -LiteralPath $_ })
}

function Stop-AppGracefully {
    $windowed = @()
    foreach ($process in @(Get-AppProcess)) {
        try {
            if ($process.MainWindowHandle -ne 0) { $windowed += $process }
        } catch { }
    }
    if ($windowed.Count -eq 0) {
        return $false
    }
    foreach ($process in $windowed) {
        try { $null = $process.CloseMainWindow() } catch { }
    }
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        if (@(Get-AppProcess).Count -eq 0) {
            return $true
        }
    }
    return $false
}

function Stop-AppForcibly {
    foreach ($process in @(Get-AppProcess)) {
        try { $process.Kill() } catch { }
    }
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        if (@(Get-AppProcess).Count -eq 0) {
            return $true
        }
    }
    return $false
}

function Remove-Target {
    param([string]$Path)
    try {
        if ([System.IO.Directory]::Exists($Path)) {
            [System.IO.Directory]::Delete($Path, $true)
            return
        }
        if ([System.IO.File]::Exists($Path)) {
            [System.IO.File]::Delete($Path)
        }
    } catch {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

function Export-RegistryTarget {
    param([string]$Key, [string]$File)
    & reg.exe export ($Key -replace '^HKCU:', 'HKCU') $File /y | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "注册表导出失败: $Key"
    }
}

function Get-PathSize {
    param([string]$Path)
    $item = Get-Item -LiteralPath $Path -Force
    if (-not $item.PSIsContainer) {
        return [long]$item.Length
    }
    $total = [long]0
    foreach ($file in @(Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue)) {
        $total += $file.Length
    }
    return $total
}

function Format-Size {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N2} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N2} KB' -f ($Bytes / 1KB)) }
    return "$Bytes B"
}

function Show-Targets {
    param([string[]]$Targets, [string[]]$RegistryTargets)
    foreach ($path in $Targets) {
        Write-Output ('  {0}  ({1})' -f $path, (Format-Size (Get-PathSize $path)))
    }
    foreach ($key in $RegistryTargets) {
        Write-Output ('  {0}  (注册表项)' -f $key)
    }
}

if ($Help) {
    Show-Usage
    exit 0
}

$targets = @(Get-Targets)
$registryTargets = @(Get-RegistryTargets)

if ($targets.Count -eq 0 -and $registryTargets.Count -eq 0) {
    Write-Output '未找到 DeepChat 的本地数据，无需清理。'
    exit 0
}

if ($DryRun) {
    Write-Output '将清理以下内容（当前未做任何修改）:'
    Show-Targets -Targets $targets -RegistryTargets $registryTargets
    if (@(Get-AppProcess).Count -gt 0) {
        Write-Output ''
        Write-Output '注意: DeepChat 正在运行，正式清理前请先退出它。'
    }
    exit 0
}

if (@(Get-AppProcess).Count -gt 0) {
    Write-Output '检测到 DeepChat 正在运行，正在尝试退出...'
    if (Stop-AppGracefully) {
        Write-Output 'DeepChat 已退出。'
    } elseif ($Force) {
        Write-Output '优雅退出失败，正在强制结束进程...'
        if (-not (Stop-AppForcibly)) {
            [Console]::Error.WriteLine('无法结束 DeepChat 进程，请手动退出后重试。')
            exit 1
        }
        Write-Output 'DeepChat 进程已结束。'
    } else {
        [Console]::Error.WriteLine('无法自动退出 DeepChat（无可见窗口或退出超时），请使用 -Force 强制结束进程，或手动退出后重试。')
        exit 1
    }
}

if ($Purge) {
    Write-Output '此操作将直接删除以下内容:'
} else {
    Write-Output '将清理以下内容（默认先备份）:'
}
Show-Targets -Targets $targets -RegistryTargets $registryTargets

if (-not $Yes) {
    $answer = Read-Host '确认继续？（输入 yes 取消其他输入均为放弃）'
    if ($answer -ne 'yes') {
        Write-Output '已取消。'
        exit 0
    }
}

$backupDir = $null
if ($Purge) {
    foreach ($key in $registryTargets) {
        Remove-Item -LiteralPath $key -Recurse -Force
    }
    foreach ($target in $targets) {
        Remove-Target -Path $target
    }
} else {
    $backupDir = Join-Path $BackupRoot (Get-Date -Format 'yyyyMMdd-HHmmss')
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $manifest = Join-Path $backupDir 'MANIFEST.tsv'
    for ($index = 0; $index -lt $registryTargets.Count; $index++) {
        $key = $registryTargets[$index]
        $entry = Join-Path $backupDir "reg$index.reg"
        Export-RegistryTarget -Key $key -File $entry
        ("{0}`t{1}" -f $entry, $key) | Add-Content -LiteralPath $manifest -Encoding UTF8
        Remove-Item -LiteralPath $key -Recurse -Force
    }
    for ($index = 0; $index -lt $targets.Count; $index++) {
        $target = $targets[$index]
        ("{0}`t{1}" -f (Join-Path $backupDir $index), $target) | Add-Content -LiteralPath $manifest -Encoding UTF8
        Move-Item -LiteralPath $target -Destination (Join-Path $backupDir $index)
    }
}

Write-Output ''
Write-Output '清理完成。DeepChat 下次启动将恢复为首次打开的状态。'
if ($null -ne $backupDir) {
    Write-Output "原数据已备份到: $backupDir"
    Write-Output '文件按 MANIFEST.tsv 记录的路径移回原位；注册表项用 reg import 导入对应的 .reg 文件。'
}
