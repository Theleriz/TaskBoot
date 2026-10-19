# Generates app.ico (the Task Tracker icon) in several sizes.
# The drawing matches Ui.AppIcon(): a blue rounded square with a white check mark.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools\make-icon.ps1
Add-Type -AssemblyName PresentationCore, WindowsBase

$out = Join-Path (Split-Path $PSScriptRoot -Parent) "app.ico"
$sizes = 16, 20, 24, 32, 40, 48, 64, 128, 256

function Render-Png([int]$size) {
    $visual = New-Object System.Windows.Media.DrawingVisual
    $dc = $visual.RenderOpen()
    $k = $size / 64.0
    $dc.PushTransform((New-Object System.Windows.Media.ScaleTransform $k, $k))
    $blue = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(0x3B, 0x5B, 0xDB))
    $dc.DrawRoundedRectangle($blue, $null, (New-Object System.Windows.Rect 2, 2, 60, 60), 14, 14)
    $pen = New-Object System.Windows.Media.Pen ([System.Windows.Media.Brushes]::White), 7
    $pen.StartLineCap = 'Round'
    $pen.EndLineCap = 'Round'
    $pen.LineJoin = 'Round'
    $dc.DrawGeometry($null, $pen, [System.Windows.Media.Geometry]::Parse("M18,33 L28,43 L46,22"))
    $dc.Pop()
    $dc.Close()

    $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap $size, $size, 96, 96, ([System.Windows.Media.PixelFormats]::Pbgra32)
    $bmp.Render($visual)
    return $bmp
}

function To-Png($bmp) {
    $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
    $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
    $ms = New-Object System.IO.MemoryStream
    $encoder.Save($ms)
    return , $ms.ToArray()
}

# Classic 32-bit DIB entry: BITMAPINFOHEADER, bottom-up BGRA rows, then a 1-bit AND mask.
function To-Dib($bmp) {
    $size = $bmp.PixelWidth
    $bgra = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap $bmp, ([System.Windows.Media.PixelFormats]::Bgra32), $null, 0
    $stride = $size * 4
    $pixels = New-Object byte[] ($stride * $size)
    $bgra.CopyPixels($pixels, $stride, 0)
    $maskStride = [int]([Math]::Ceiling($size / 32.0)) * 4

    $ms = New-Object System.IO.MemoryStream
    $w = New-Object System.IO.BinaryWriter $ms
    $w.Write([uint32]40)
    $w.Write([int32]$size)
    $w.Write([int32]($size * 2))
    $w.Write([uint16]1)
    $w.Write([uint16]32)
    $w.Write([uint32]0)
    $w.Write([uint32]($stride * $size + $maskStride * $size))
    $w.Write([int32]0); $w.Write([int32]0); $w.Write([uint32]0); $w.Write([uint32]0)
    for ($y = $size - 1; $y -ge 0; $y--) { $w.Write($pixels, $y * $stride, $stride) }
    $w.Write((New-Object byte[] ($maskStride * $size)))
    $w.Flush()
    return , $ms.ToArray()
}

$images = @()
foreach ($s in $sizes) {
    $bmp = Render-Png $s
    if ($s -ge 256) { $images += , (To-Png $bmp) } else { $images += , (To-Dib $bmp) }
}

# ICO container: DIB entries for small sizes, PNG for 256 px (as in standard Windows icons).
$fs = [System.IO.File]::Create($out)
$w = New-Object System.IO.BinaryWriter $fs
$w.Write([uint16]0)
$w.Write([uint16]1)
$w.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    $dim = if ($s -ge 256) { 0 } else { $s }
    $w.Write([byte]$dim)
    $w.Write([byte]$dim)
    $w.Write([byte]0)
    $w.Write([byte]0)
    $w.Write([uint16]1)
    $w.Write([uint16]32)
    $w.Write([uint32]$images[$i].Length)
    $w.Write([uint32]$offset)
    $offset += $images[$i].Length
}
foreach ($img in $images) { $w.Write($img) }
$w.Close()
"Written: $out"
