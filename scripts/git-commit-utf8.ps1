# 使用 UTF-8（无 BOM）写入提交信息并执行 git commit，避免中文乱码
# 用法: .\scripts\git-commit-utf8.ps1 -Message "提交说明"
#
# 乱码原因：Git 以 UTF-8 输出提交信息，而 Windows 控制台默认用 GBK 解码，
# 导致显示为 鍚屾鏇存柊 等。chcp 65001 将控制台切到 UTF-8，即可正确显示。
param([Parameter(Mandatory = $true)][string]$Message)

# 将控制台代码页设为 UTF-8，使 git commit 的中文输出正确显示
chcp 65001 | Out-Null

$path = Join-Path $env:TEMP "wing_git_commit_msg.txt"
[System.IO.File]::WriteAllText($path, $Message, [System.Text.UTF8Encoding]::new($false))
try {
    git commit -F $path
} finally {
    Remove-Item $path -ErrorAction SilentlyContinue
}
