# 使用 UTF-8（无 BOM）写入提交信息并执行 git commit，避免中文乱码
# 用法: .\scripts\git-commit-utf8.ps1 -Message "提交说明"
param([Parameter(Mandatory = $true)][string]$Message)

$path = Join-Path $env:TEMP "wing_git_commit_msg.txt"
[System.IO.File]::WriteAllText($path, $Message, [System.Text.UTF8Encoding]::new($false))
try {
    git commit -F $path
} finally {
    Remove-Item $path -ErrorAction SilentlyContinue
}
