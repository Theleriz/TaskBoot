using System;
using System.Linq;
using System.Windows;
using System.Windows.Markup;
using System.Windows.Media;
using Microsoft.Win32;

namespace TaskTracker
{
    // Аналог CSS-переменных из :root (N-08): все цвета — именованные ресурсы,
    // элементы ссылаются на них через DynamicResource / SetResourceReference.
    // Палитра целиком выводится из двух цветов — фона и акцента, поэтому любую тему
    // можно задать этой парой и сменить на лету.
    public static class Theme
    {
        public static readonly Color LightBg = Hex("#F3F4F6");
        public static readonly Color LightAccent = Hex("#3B5BDB");
        public static readonly Color DarkBg = Hex("#15171B");
        public static readonly Color DarkAccent = Hex("#7D93F2");

        static ResourceDictionary target;

        public static bool IsDark { get; private set; }
        public static Color Background { get; private set; }
        public static Color Accent { get; private set; }
        public static event Action Changed;

        // Стили подключаются один раз; цвета потом меняются через ApplyColors.
        public static void Init(ResourceDictionary resources)
        {
            target = resources;
            bool dark = SystemIsDark();
            ApplyColors(dark ? DarkBg : LightBg, dark ? DarkAccent : LightAccent);
            target.MergedDictionaries.Add((ResourceDictionary)XamlReader.Parse(StylesXaml));
        }

        public static void ApplyColors(Color bg, Color accent)
        {
            bg.A = 255;
            accent.A = 255;
            bool dark = Luminance(bg) < 0.2;
            Color white = Colors.White, black = Colors.Black;

            Color surface, surface2, card, cardHover, border, hover, text, muted;
            if (dark)
            {
                surface = Mix(bg, white, 0.045);
                surface2 = Mix(bg, white, 0.085);
                card = Mix(bg, white, 0.075);
                cardHover = Mix(bg, white, 0.115);
                border = Mix(bg, white, 0.13);
                hover = Mix(bg, white, 0.10);
                text = Mix(white, bg, 0.08);
                muted = Mix(white, bg, 0.38);
            }
            else
            {
                surface = Mix(bg, white, 0.75);
                surface2 = Mix(bg, black, 0.03);
                card = Mix(bg, white, 0.45);
                cardHover = Mix(bg, black, 0.035);
                border = Mix(bg, black, 0.09);
                hover = Mix(bg, black, 0.055);
                text = Mix(black, bg, 0.1);
                muted = Mix(black, bg, 0.5);
            }

            // Акцент должен читаться на поверхности: при слабом контрасте осветляем или затемняем.
            var acc = accent;
            for (int i = 0; i < 20 && Contrast(acc, surface) < 3.0; i++)
                acc = dark ? Mix(acc, white, 0.07) : Mix(acc, black, 0.07);

            var work = Hex(dark ? "#F06262" : "#E03131");
            var rest = Hex(dark ? "#4CC06A" : "#2B8A3E");
            var idle = Hex("#8A919C");
            var danger = Hex(dark ? "#F06262" : "#D9363E");

            var palette = new[]
            {
                Tuple.Create("Bg", bg),
                Tuple.Create("Surface", surface),
                Tuple.Create("Surface2", surface2),
                Tuple.Create("CardBg", card),
                Tuple.Create("CardHover", cardHover),
                Tuple.Create("Border", border),
                Tuple.Create("Text", text),
                Tuple.Create("TextMuted", muted),
                Tuple.Create("Hover", hover),
                Tuple.Create("Accent", acc),
                Tuple.Create("AccentHover", dark ? Mix(acc, white, 0.15) : Mix(acc, black, 0.15)),
                Tuple.Create("AccentSoft", Mix(bg, acc, dark ? 0.2 : 0.12)),
                Tuple.Create("OnAccent", Luminance(acc) > 0.35 ? Hex("#11131A") : white),
                Tuple.Create("Work", work),
                Tuple.Create("WorkHover", dark ? Mix(work, white, 0.12) : Mix(work, black, 0.12)),
                Tuple.Create("WorkSoft", Mix(bg, work, dark ? 0.2 : 0.1)),
                Tuple.Create("Rest", rest),
                Tuple.Create("RestHover", dark ? Mix(rest, white, 0.12) : Mix(rest, black, 0.12)),
                Tuple.Create("RestSoft", Mix(bg, rest, dark ? 0.2 : 0.1)),
                Tuple.Create("Idle", idle),
                Tuple.Create("IdleSoft", Mix(bg, idle, dark ? 0.14 : 0.12)),
                Tuple.Create("Danger", danger),
                Tuple.Create("DangerSoft", Mix(bg, danger, dark ? 0.18 : 0.1)),
                Tuple.Create("Q1", work),
                Tuple.Create("Q2", acc),
                Tuple.Create("Q3", Hex(dark ? "#F2A93B" : "#E8890C")),
                Tuple.Create("Q4", idle),
                Tuple.Create("WarnBg", Mix(bg, Hex("#F2A93B"), dark ? 0.16 : 0.18)),
                Tuple.Create("WarnText", Hex(dark ? "#F2C66D" : "#7A5200")),
                Tuple.Create("Overlay", dark ? Color.FromArgb(0x80, 0, 0, 0) : Color.FromArgb(0x59, 0x0F, 0x12, 0x19)),
            };
            foreach (var entry in palette)
            {
                var brush = new SolidColorBrush(entry.Item2);
                brush.Freeze();
                target[entry.Item1] = brush;
            }

            IsDark = dark;
            Background = bg;
            Accent = accent;
            if (Changed != null) Changed();
        }

        public static bool SystemIsDark()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
                {
                    if (key == null) return false;
                    var value = key.GetValue("AppsUseLightTheme");
                    return value is int && (int)value == 0;
                }
            }
            catch
            {
                return false;
            }
        }

        /* ---------- Подбор сочетающихся цветов ---------- */

        // Фоны под акцент: светлые и тёмные оттенки того же тона плюс мягкий дополнительный.
        // jitter != null даёт вариации вокруг базовых значений («Ещё варианты»).
        public static Color[] SuggestBackgrounds(Color accent, Random jitter)
        {
            double h, s, l;
            ToHsl(accent, out h, out s, out l);
            Func<double, double> j = range => jitter == null ? 0 : (jitter.NextDouble() * 2 - 1) * range;
            return new[]
            {
                FromHsl(h + j(10), Clamp01(Math.Min(s, 0.5) * 0.45 + j(0.08)), Clamp01(0.965 + j(0.015))),
                FromHsl(h + j(15), Clamp01(0.18 + j(0.08)), Clamp01(0.915 + j(0.03))),
                FromHsl(h + 180 + j(20), Clamp01(0.16 + j(0.08)), Clamp01(0.94 + j(0.02))),
                FromHsl(h + j(10), Clamp01(0.08 + j(0.05)), Clamp01(0.07 + j(0.02))),
                FromHsl(h + j(10), Clamp01(Math.Min(s, 0.5) * 0.5 + j(0.08)), Clamp01(0.11 + j(0.03))),
                FromHsl(h + j(15), Clamp01(0.32 + j(0.1)), Clamp01(0.16 + j(0.03))),
            };
        }

        // Акценты, сочетающиеся с данным: аналогичные, комплементарный и триада.
        public static Color[] SuggestAccents(Color accent)
        {
            double h, s, l;
            ToHsl(accent, out h, out s, out l);
            return new[] { -30.0, 30.0, 180.0, 120.0, 240.0 }.Select(d => FromHsl(h + d, s, l)).ToArray();
        }

        public static void RandomTheme(Random rnd, out Color bg, out Color accent)
        {
            double h = rnd.NextDouble() * 360;
            accent = FromHsl(h, 0.55 + rnd.NextDouble() * 0.3, 0.5 + rnd.NextDouble() * 0.12);
            double bh = h + (rnd.NextDouble() * 40 - 20);
            bg = rnd.NextDouble() < 0.5
                ? FromHsl(bh, 0.12 + rnd.NextDouble() * 0.25, 0.06 + rnd.NextDouble() * 0.08)
                : FromHsl(bh, 0.1 + rnd.NextDouble() * 0.3, 0.93 + rnd.NextDouble() * 0.04);
        }

        /* ---------- Цветовые утилиты ---------- */

        public static Color Hex(string hex)
        {
            Color c;
            if (!TryParseHex(hex, out c)) throw new ArgumentException(hex);
            return c;
        }

        public static bool TryParseHex(string text, out Color color)
        {
            color = Colors.Black;
            var s = (text ?? "").Trim().TrimStart('#');
            if (s.Length == 3) s = new string(new[] { s[0], s[0], s[1], s[1], s[2], s[2] });
            if (s.Length != 6 || !s.All(Uri.IsHexDigit)) return false;
            color = Color.FromRgb(Convert.ToByte(s.Substring(0, 2), 16), Convert.ToByte(s.Substring(2, 2), 16), Convert.ToByte(s.Substring(4, 2), 16));
            return true;
        }

        public static string ToHex(Color c)
        {
            return "#" + c.R.ToString("X2") + c.G.ToString("X2") + c.B.ToString("X2");
        }

        public static Color Mix(Color a, Color b, double t)
        {
            return Color.FromRgb(
                (byte)Math.Round(a.R + (b.R - a.R) * t),
                (byte)Math.Round(a.G + (b.G - a.G) * t),
                (byte)Math.Round(a.B + (b.B - a.B) * t));
        }

        public static double Luminance(Color c)
        {
            Func<byte, double> ch = v =>
            {
                double x = v / 255.0;
                return x <= 0.03928 ? x / 12.92 : Math.Pow((x + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * ch(c.R) + 0.7152 * ch(c.G) + 0.0722 * ch(c.B);
        }

        public static double Contrast(Color a, Color b)
        {
            double la = Luminance(a), lb = Luminance(b);
            return (Math.Max(la, lb) + 0.05) / (Math.Min(la, lb) + 0.05);
        }

        static double Clamp01(double v)
        {
            return Math.Max(0, Math.Min(1, v));
        }

        public static void ToHsl(Color c, out double h, out double s, out double l)
        {
            double r = c.R / 255.0, g = c.G / 255.0, b = c.B / 255.0;
            double max = Math.Max(r, Math.Max(g, b)), min = Math.Min(r, Math.Min(g, b));
            l = (max + min) / 2;
            if (max == min) { h = 0; s = 0; return; }
            double d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max == r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max == g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }

        public static Color FromHsl(double h, double s, double l)
        {
            h = ((h % 360) + 360) % 360 / 360;
            s = Clamp01(s);
            l = Clamp01(l);
            if (s == 0)
            {
                byte v = (byte)Math.Round(l * 255);
                return Color.FromRgb(v, v, v);
            }
            double q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            double p = 2 * l - q;
            Func<double, double> hue = t =>
            {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1.0 / 6) return p + (q - p) * 6 * t;
                if (t < 0.5) return q;
                if (t < 2.0 / 3) return p + (q - p) * (2.0 / 3 - t) * 6;
                return p;
            };
            return Color.FromRgb(
                (byte)Math.Round(hue(h + 1.0 / 3) * 255),
                (byte)Math.Round(hue(h) * 255),
                (byte)Math.Round(hue(h - 1.0 / 3) * 255));
        }

        const string StylesXaml = @"
<ResourceDictionary xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation'
                    xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'>

  <Style x:Key='TabButton' TargetType='RadioButton'>
    <Setter Property='Foreground' Value='{DynamicResource TextMuted}'/>
    <Setter Property='Background' Value='Transparent'/>
    <Setter Property='Padding' Value='14,7'/>
    <Setter Property='Margin' Value='0,0,4,0'/>
    <Setter Property='Cursor' Value='Hand'/>
    <Setter Property='Template'>
      <Setter.Value>
        <ControlTemplate TargetType='RadioButton'>
          <Border x:Name='Bd' Background='{TemplateBinding Background}' CornerRadius='8' Padding='{TemplateBinding Padding}'>
            <ContentPresenter VerticalAlignment='Center' HorizontalAlignment='Center'/>
          </Border>
          <ControlTemplate.Triggers>
            <Trigger Property='IsMouseOver' Value='True'>
              <Setter TargetName='Bd' Property='Background' Value='{DynamicResource Hover}'/>
              <Setter Property='Foreground' Value='{DynamicResource Text}'/>
            </Trigger>
            <Trigger Property='IsChecked' Value='True'>
              <Setter TargetName='Bd' Property='Background' Value='{DynamicResource AccentSoft}'/>
              <Setter Property='Foreground' Value='{DynamicResource Accent}'/>
              <Setter Property='FontWeight' Value='SemiBold'/>
            </Trigger>
            <MultiTrigger>
              <MultiTrigger.Conditions>
                <Condition Property='IsChecked' Value='True'/>
                <Condition Property='IsMouseOver' Value='True'/>
              </MultiTrigger.Conditions>
              <Setter TargetName='Bd' Property='Opacity' Value='0.8'/>
            </MultiTrigger>
          </ControlTemplate.Triggers>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
  </Style>

  <Style x:Key='Btn' TargetType='Button'>
    <Setter Property='Foreground' Value='{DynamicResource Text}'/>
    <Setter Property='Background' Value='{DynamicResource Surface2}'/>
    <Setter Property='BorderBrush' Value='{DynamicResource Border}'/>
    <Setter Property='BorderThickness' Value='1'/>
    <Setter Property='Padding' Value='14,7'/>
    <Setter Property='Cursor' Value='Hand'/>
    <Setter Property='Template'>
      <Setter.Value>
        <ControlTemplate TargetType='Button'>
          <Border x:Name='Bd' Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}'
                  BorderThickness='{TemplateBinding BorderThickness}' CornerRadius='8'
                  Padding='{TemplateBinding Padding}' SnapsToDevicePixels='True'>
            <ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center'/>
          </Border>
          <ControlTemplate.Triggers>
            <Trigger Property='IsPressed' Value='True'>
              <Setter TargetName='Bd' Property='Opacity' Value='0.8'/>
            </Trigger>
            <Trigger Property='IsEnabled' Value='False'>
              <Setter TargetName='Bd' Property='Opacity' Value='0.4'/>
            </Trigger>
          </ControlTemplate.Triggers>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource Hover}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='BtnPrimary' TargetType='Button' BasedOn='{StaticResource Btn}'>
    <Setter Property='Background' Value='{DynamicResource Accent}'/>
    <Setter Property='Foreground' Value='{DynamicResource OnAccent}'/>
    <Setter Property='BorderThickness' Value='0'/>
    <Setter Property='FontWeight' Value='SemiBold'/>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource AccentHover}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='BtnWork' TargetType='Button' BasedOn='{StaticResource BtnPrimary}'>
    <Setter Property='Background' Value='{DynamicResource Work}'/>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource WorkHover}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='BtnRest' TargetType='Button' BasedOn='{StaticResource BtnPrimary}'>
    <Setter Property='Background' Value='{DynamicResource Rest}'/>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource RestHover}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='BtnIcon' TargetType='Button' BasedOn='{StaticResource Btn}'>
    <Setter Property='Background' Value='Transparent'/>
    <Setter Property='Foreground' Value='{DynamicResource TextMuted}'/>
    <Setter Property='BorderThickness' Value='0'/>
    <Setter Property='Padding' Value='7'/>
    <Setter Property='FontFamily' Value='Segoe MDL2 Assets'/>
    <Setter Property='FontSize' Value='10'/>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource DangerSoft}'/>
        <Setter Property='Foreground' Value='{DynamicResource Danger}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='Input' TargetType='TextBox'>
    <Setter Property='Foreground' Value='{DynamicResource Text}'/>
    <Setter Property='Background' Value='{DynamicResource Surface}'/>
    <Setter Property='BorderBrush' Value='{DynamicResource Border}'/>
    <Setter Property='BorderThickness' Value='1'/>
    <Setter Property='Padding' Value='10,7'/>
    <Setter Property='CaretBrush' Value='{DynamicResource Text}'/>
    <Setter Property='SelectionBrush' Value='{DynamicResource Accent}'/>
    <Setter Property='VerticalContentAlignment' Value='Center'/>
    <Setter Property='Template'>
      <Setter.Value>
        <ControlTemplate TargetType='TextBox'>
          <Border Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}'
                  BorderThickness='{TemplateBinding BorderThickness}' CornerRadius='8'>
            <Grid>
              <TextBlock x:Name='Ph' Text='{Binding Tag, RelativeSource={RelativeSource TemplatedParent}}'
                         Foreground='{DynamicResource TextMuted}' Margin='{TemplateBinding Padding}' Padding='2,0,0,0'
                         VerticalAlignment='{TemplateBinding VerticalContentAlignment}' Visibility='Collapsed' IsHitTestVisible='False'/>
              <ScrollViewer x:Name='PART_ContentHost' Margin='{TemplateBinding Padding}' VerticalAlignment='{TemplateBinding VerticalContentAlignment}'/>
            </Grid>
          </Border>
          <ControlTemplate.Triggers>
            <Trigger Property='Text' Value=''>
              <Setter TargetName='Ph' Property='Visibility' Value='Visible'/>
            </Trigger>
          </ControlTemplate.Triggers>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='BorderBrush' Value='{DynamicResource TextMuted}'/>
      </Trigger>
      <Trigger Property='IsKeyboardFocused' Value='True'>
        <Setter Property='BorderBrush' Value='{DynamicResource Accent}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='Card' TargetType='Border'>
    <Setter Property='Background' Value='{DynamicResource CardBg}'/>
    <Setter Property='BorderBrush' Value='{DynamicResource Border}'/>
    <Setter Property='BorderThickness' Value='1'/>
    <Setter Property='CornerRadius' Value='8'/>
    <Setter Property='Padding' Value='12,9,6,9'/>
    <Setter Property='Margin' Value='0,0,0,6'/>
    <Setter Property='Cursor' Value='Hand'/>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource CardHover}'/>
        <Setter Property='BorderBrush' Value='{DynamicResource TextMuted}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='TextArea' TargetType='TextBox' BasedOn='{StaticResource Input}'>
    <Setter Property='AcceptsReturn' Value='True'/>
    <Setter Property='TextWrapping' Value='Wrap'/>
    <Setter Property='VerticalContentAlignment' Value='Stretch'/>
    <Setter Property='VerticalScrollBarVisibility' Value='Auto'/>
    <Setter Property='MinHeight' Value='90'/>
  </Style>

  <Style x:Key='InlineInput' TargetType='TextBox' BasedOn='{StaticResource Input}'>
    <Setter Property='Background' Value='Transparent'/>
    <Setter Property='BorderBrush' Value='Transparent'/>
    <Setter Property='Padding' Value='6,4'/>
  </Style>

  <Style x:Key='PasswordInput' TargetType='PasswordBox'>
    <Setter Property='Foreground' Value='{DynamicResource Text}'/>
    <Setter Property='Background' Value='{DynamicResource Surface}'/>
    <Setter Property='BorderBrush' Value='{DynamicResource Border}'/>
    <Setter Property='BorderThickness' Value='1'/>
    <Setter Property='Padding' Value='10,7'/>
    <Setter Property='CaretBrush' Value='{DynamicResource Text}'/>
    <Setter Property='SelectionBrush' Value='{DynamicResource Accent}'/>
    <Setter Property='Template'>
      <Setter.Value>
        <ControlTemplate TargetType='PasswordBox'>
          <Border Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}'
                  BorderThickness='{TemplateBinding BorderThickness}' CornerRadius='8'>
            <ScrollViewer x:Name='PART_ContentHost' Margin='{TemplateBinding Padding}' VerticalAlignment='Center'/>
          </Border>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='BorderBrush' Value='{DynamicResource TextMuted}'/>
      </Trigger>
      <Trigger Property='IsKeyboardFocused' Value='True'>
        <Setter Property='BorderBrush' Value='{DynamicResource Accent}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='Chip' TargetType='RadioButton'>
    <Setter Property='Foreground' Value='{DynamicResource Text}'/>
    <Setter Property='Background' Value='{DynamicResource Surface2}'/>
    <Setter Property='BorderBrush' Value='{DynamicResource Border}'/>
    <Setter Property='Padding' Value='10,5'/>
    <Setter Property='Margin' Value='0,0,6,6'/>
    <Setter Property='FontSize' Value='13'/>
    <Setter Property='Cursor' Value='Hand'/>
    <Setter Property='Template'>
      <Setter.Value>
        <ControlTemplate TargetType='RadioButton'>
          <Border x:Name='Bd' Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}'
                  BorderThickness='1' CornerRadius='14' Padding='{TemplateBinding Padding}'>
            <ContentPresenter VerticalAlignment='Center'/>
          </Border>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource Hover}'/>
      </Trigger>
      <Trigger Property='IsChecked' Value='True'>
        <Setter Property='Background' Value='{DynamicResource AccentSoft}'/>
        <Setter Property='BorderBrush' Value='{DynamicResource Accent}'/>
        <Setter Property='Foreground' Value='{DynamicResource Accent}'/>
        <Setter Property='FontWeight' Value='SemiBold'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='Check' TargetType='CheckBox'>
    <Setter Property='Cursor' Value='Hand'/>
    <Setter Property='VerticalAlignment' Value='Center'/>
    <Setter Property='Template'>
      <Setter.Value>
        <ControlTemplate TargetType='CheckBox'>
          <Border x:Name='Box' Width='18' Height='18' CornerRadius='4' BorderThickness='1.5'
                  BorderBrush='{DynamicResource TextMuted}' Background='Transparent'>
            <TextBlock x:Name='Mark' Text='&#xE73E;' FontFamily='Segoe MDL2 Assets' FontSize='11'
                       Foreground='{DynamicResource OnAccent}' HorizontalAlignment='Center' VerticalAlignment='Center' Visibility='Collapsed'/>
          </Border>
          <ControlTemplate.Triggers>
            <Trigger Property='IsMouseOver' Value='True'>
              <Setter TargetName='Box' Property='BorderBrush' Value='{DynamicResource Accent}'/>
            </Trigger>
            <Trigger Property='IsChecked' Value='True'>
              <Setter TargetName='Box' Property='Background' Value='{DynamicResource Accent}'/>
              <Setter TargetName='Box' Property='BorderBrush' Value='{DynamicResource Accent}'/>
              <Setter TargetName='Mark' Property='Visibility' Value='Visible'/>
            </Trigger>
          </ControlTemplate.Triggers>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
  </Style>

  <Style x:Key='BtnDangerGhost' TargetType='Button' BasedOn='{StaticResource Btn}'>
    <Setter Property='Background' Value='Transparent'/>
    <Setter Property='BorderThickness' Value='0'/>
    <Setter Property='Foreground' Value='{DynamicResource Danger}'/>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource DangerSoft}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='BtnPlainIcon' TargetType='Button' BasedOn='{StaticResource BtnIcon}'>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource Hover}'/>
        <Setter Property='Foreground' Value='{DynamicResource Text}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='RowButton' TargetType='Button'>
    <Setter Property='Foreground' Value='{DynamicResource Text}'/>
    <Setter Property='Background' Value='{DynamicResource CardBg}'/>
    <Setter Property='BorderBrush' Value='{DynamicResource Border}'/>
    <Setter Property='BorderThickness' Value='1'/>
    <Setter Property='Padding' Value='12,9'/>
    <Setter Property='Margin' Value='0,0,0,6'/>
    <Setter Property='HorizontalContentAlignment' Value='Stretch'/>
    <Setter Property='Cursor' Value='Hand'/>
    <Setter Property='Template'>
      <Setter.Value>
        <ControlTemplate TargetType='Button'>
          <Border Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}'
                  BorderThickness='{TemplateBinding BorderThickness}' CornerRadius='8' Padding='{TemplateBinding Padding}'>
            <ContentPresenter HorizontalAlignment='Stretch'/>
          </Border>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource CardHover}'/>
        <Setter Property='BorderBrush' Value='{DynamicResource TextMuted}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style x:Key='LinkRow' TargetType='Button' BasedOn='{StaticResource RowButton}'>
    <Setter Property='Background' Value='Transparent'/>
    <Setter Property='BorderThickness' Value='0'/>
    <Setter Property='Padding' Value='8,6'/>
    <Setter Property='Margin' Value='0'/>
    <Style.Triggers>
      <Trigger Property='IsMouseOver' Value='True'>
        <Setter Property='Background' Value='{DynamicResource Hover}'/>
      </Trigger>
    </Style.Triggers>
  </Style>

  <Style TargetType='ScrollBar'>
    <Setter Property='Width' Value='10'/>
    <Setter Property='MinWidth' Value='10'/>
    <Setter Property='Template'>
      <Setter.Value>
        <ControlTemplate TargetType='ScrollBar'>
          <Track x:Name='PART_Track' IsDirectionReversed='True' Margin='2'>
            <Track.Thumb>
              <Thumb>
                <Thumb.Template>
                  <ControlTemplate TargetType='Thumb'>
                    <Border x:Name='T' CornerRadius='3' Background='{DynamicResource Border}'/>
                    <ControlTemplate.Triggers>
                      <Trigger Property='IsMouseOver' Value='True'>
                        <Setter TargetName='T' Property='Background' Value='{DynamicResource TextMuted}'/>
                      </Trigger>
                    </ControlTemplate.Triggers>
                  </ControlTemplate>
                </Thumb.Template>
              </Thumb>
            </Track.Thumb>
          </Track>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
  </Style>
</ResourceDictionary>";
    }
}
