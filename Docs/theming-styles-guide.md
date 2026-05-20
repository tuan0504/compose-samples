# Jetpack Compose Theming & Styling Guide

> Based on real source code analysis of all 6 sample apps in this repo.  
> Source: `https://github.com/tuan0504/compose-samples`

---

## Table of Contents

1. [Overview — How Many Styles?](#1-overview--how-many-styles)
2. [Style 1 — JetNews: Pure Material 3](#2-style-1--jetnews-pure-material-3)
3. [Style 2 — JetLagged: M3 + CompositionLocal Extension](#3-style-2--jetlagged-m3--compositionlocal-extension)
4. [Style 3 — Jetcaster: Material Expressive + Shared Design System](#4-style-3--jetcaster-material-expressive--shared-design-system)
5. [Style 4 — Jetchat: M3 + Glance Widget Theme](#5-style-4--jetchat-m3--glance-widget-theme)
6. [Style 5 — Jetsnack: Fully Custom Design System](#6-style-5--jetsnack-fully-custom-design-system)
7. [Style 6 — Reply: M3 + System Contrast Detection](#7-style-6--reply-m3--system-contrast-detection)
8. [Key Differences Compared](#8-key-differences-compared)
9. [What Should You Use?](#9-what-should-you-use)
10. [Core Concepts to Learn First](#10-core-concepts-to-learn-first)

---

## 1. Overview — How Many Styles?

There are **6 distinct theming styles** across the 6 sample apps. They range from the simplest (pure Material 3) to the most complex (fully custom design system that doesn't use Material 3 colors at all).

| # | App | Style Name | Complexity |
|---|-----|-----------|------------|
| 1 | JetNews | Pure Material 3 | ⭐ Beginner |
| 2 | JetLagged | M3 + CompositionLocal Extension | ⭐⭐ Intermediate |
| 3 | Jetcaster | M3 Expressive + Shared Module | ⭐⭐⭐ Advanced |
| 4 | Jetchat | M3 + Glance Widget | ⭐⭐ Intermediate |
| 5 | Jetsnack | Fully Custom Design System | ⭐⭐⭐ Advanced |
| 6 | Reply | M3 + Contrast Accessibility | ⭐⭐ Intermediate |

---

## 2. Style 1 — JetNews: Pure Material 3

**Files:**
- `JetNews/app/src/main/java/com/example/jetnews/ui/theme/Theme.kt`
- `JetNews/app/src/main/java/com/example/jetnews/ui/theme/Color.kt`
- `JetNews/app/src/main/java/com/example/jetnews/ui/theme/Type.kt`
- `JetNews/app/src/main/java/com/example/jetnews/ui/theme/Shape.kt`

### How it works

```kotlin
@Composable
fun JetnewsTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colorScheme =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+: use wallpaper-based dynamic colors
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        } else {
            // Older Android: use hardcoded light/dark palette
            if (darkTheme) DarkColors else LightColors
        }

    MaterialTheme(
        colorScheme = colorScheme,
        shapes = JetnewsShapes,
        typography = JetnewsTypography,
        content = content,
    )
}
```

### Colors

Full M3 color system — 28 color slots, all defined:

```kotlin
val LightColors = lightColorScheme(
    primary = Color(0xFFBF0031),          // Deep red brand color
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFFFDAD9),
    secondary = Color(0xFF775656),
    tertiary = Color(0xFF755A2F),
    background = Color(0xFFFFFBFF),
    surface = Color(0xFFFFFBFF),
    // ... all 28 slots defined
)
```

### Typography

Single Montserrat font family across all styles. Uses `LineBreak.Heading` for headings and `LineBreak.Paragraph` for body text:

```kotlin
private val Montserrat = FontFamily(
    Font(R.font.montserrat_regular),
    Font(R.font.montserrat_medium, FontWeight.W500),
)

val JetnewsTypography = Typography(
    headlineLarge = defaultTextStyle.copy(fontSize = 32.sp, lineBreak = LineBreak.Heading),
    bodyLarge = defaultTextStyle.copy(fontSize = 16.sp, lineBreak = LineBreak.Paragraph),
    // ... all 15 type scale slots
)
```

### Shapes

```kotlin
val JetnewsShapes = Shapes(
    small = RoundedCornerShape(4.dp),
    medium = RoundedCornerShape(4.dp),
    large = RoundedCornerShape(8.dp),
)
```

### Purpose

The **cleanest and most standard** way to implement Material 3. This is what Google recommends for most apps.

### When to use

- Your app follows Material Design guidelines
- You want dynamic wallpaper-based colors (Android 12+)
- You don't have a custom brand design system

---

## 3. Style 2 — JetLagged: M3 + CompositionLocal Extension

**Files:**
- `JetLagged/app/src/main/java/com/example/jetlagged/ui/theme/Theme.kt`
- `JetLagged/app/src/main/java/com/example/jetlagged/ui/theme/Color.kt`
- `JetLagged/app/src/main/java/com/example/jetlagged/ui/theme/Type.kt`

### How it works

M3 base + a custom `JetLaggedExtraColors` data class injected alongside it via `CompositionLocalProvider`:

```kotlin
// Step 1: Define extra colors your domain needs
data class JetLaggedExtraColors(
    val header: Color = Color.Unspecified,
    val cardBackground: Color = Color.Unspecified,
    val bed: Color = Color.Unspecified,       // Sleep stage color
    val sleep: Color = Color.Unspecified,
    val wellness: Color = Color.Unspecified,
    val heart: Color = Color.Unspecified,
    val heartWave: List<Color> = listOf(Color.Unspecified), // Gradient list
    val sleepChartPrimary: Color = Color.Unspecified,
    val sleepAwake: Color = Color.Unspecified,
    val sleepRem: Color = Color.Unspecified,
    val sleepLight: Color = Color.Unspecified,
    val sleepDeep: Color = Color.Unspecified,
)

// Step 2: Create a CompositionLocal for it
val LocalExtraColors = staticCompositionLocalOf { JetLaggedExtraColors() }

// Step 3: Provide it alongside MaterialTheme
@Composable
fun JetLaggedTheme(isDarkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val extraColors = if (isDarkTheme) DarkExtraColors else LightExtraColors

    CompositionLocalProvider(LocalExtraColors provides extraColors) {
        MaterialTheme(
            colorScheme = if (isDarkTheme) DarkColorScheme else LightColorScheme,
            typography = Typography,
            shapes = shapes,
            content = content,
        )
    }
}

// Step 4: Access via companion object for clean API
object JetLaggedTheme {
    val extraColors: JetLaggedExtraColors
        @Composable get() = LocalExtraColors.current
}
```

### Accessing extra colors in composables

```kotlin
// Use standard M3 colors via MaterialTheme
val primary = MaterialTheme.colorScheme.primary

// Use domain colors via JetLaggedTheme
val sleepColor = JetLaggedTheme.extraColors.sleep
val heartWaveColors = JetLaggedTheme.extraColors.heartWave // List<Color> for gradients
```

### Colors defined in Color.kt

```kotlin
// Light palette
val Yellow = Color(0xFFFFCB66)
val MintGreen = Color(0xFFACD6B8)
val Coral = Color(0xFFF3A397)
val Lilac = Color(0xFFCCB6DC)
val LightBlue = Color(0xFFBBDEFB)

// Sleep stage specific colors
val SleepAwake = Color(0xFFFFEAC1)
val SleepRem = Color(0xFFFFDD9A)
val SleepLight = Color(0xFFFFCB66)
val SleepDeep = Color(0xFFFF973C)

// Heart wave gradient colors
val Pink = Color(0xFFEAA8A9)
val Purple = Color(0xFFD2B4D3)
val Green = Color(0xFFADD7B9)
```

### Typography

Uses Google Fonts (downloadable Lato) and defines named text styles directly instead of using the M3 type scale:

```kotlin
val provider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs,
)
val fontFamily = FontFamily(Font(googleFont = GoogleFont("Lato"), fontProvider = provider))

// Named styles — not bound to M3 slots
val TitleBarStyle = TextStyle(fontSize = 22.sp, fontWeight = FontWeight(700), fontFamily = fontFamily)
val HeadingStyle = TextStyle(fontSize = 24.sp, fontWeight = FontWeight(600), fontFamily = fontFamily)
val TitleStyle = TextStyle(fontSize = 36.sp, fontWeight = FontWeight(500), fontFamily = fontFamily)
```

### Purpose

Shows how to **extend M3 without replacing it**. You keep all M3 components working correctly while adding domain-specific colors for data visualization or specialized UI.

### When to use

- App has domain-specific data (health metrics, financial data, map layers, etc.)
- You want M3 components but need colors that don't fit M3 slots
- You want dark/light variants for those extra colors too

---

## 4. Style 3 — Jetcaster: Material Expressive + Shared Design System

**Files:**
- `Jetcaster/core/designsystem/` — shared module used by mobile, TV, and Wear
- `Jetcaster/mobile/src/main/java/com/example/jetcaster/ui/theme/Theme.kt`

### How it works

Design tokens live in a **separate Gradle module** (`core/designsystem`), consumed by all platform targets. Uses the experimental `MaterialExpressiveTheme` which adds a `MotionScheme` for animation theming:

```kotlin
// In mobile/Theme.kt — imports everything from core:designsystem
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun JetcasterTheme(dynamicColor: Boolean = false, content: @Composable () -> Unit) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            dynamicDarkColorScheme(LocalContext.current)
        }
        else -> darkScheme  // imported from core:designsystem
    }

    MaterialExpressiveTheme(
        colorScheme = colorScheme,
        motionScheme = MotionScheme.expressive(), // Animation spring/easing system
        shapes = JetcasterShapes,                 // from core:designsystem
        typography = JetcasterTypography,         // from core:designsystem
        content = content,
    )
}
```

### Three contrast levels per color scheme

The design system module defines 3 full schemes:

```kotlin
// Standard
private val lightScheme = lightColorScheme(primary = primaryLight, ...)
private val darkScheme = darkColorScheme(primary = primaryDark, ...)

// Medium contrast (for accessibility)
private val mediumContrastLightColorScheme = lightColorScheme(primary = primaryLightMediumContrast, ...)
private val mediumContrastDarkColorScheme = darkColorScheme(...)

// High contrast (for accessibility)
private val highContrastLightColorScheme = lightColorScheme(primary = primaryLightHighContrast, ...)
private val highContrastDarkColorScheme = darkColorScheme(...)
```

### Module structure

```
Jetcaster/
├── core/
│   └── designsystem/          ← shared across all platforms
│       └── theme/
│           ├── Color.kt       ← all color tokens (3 contrast levels)
│           ├── Typography.kt  ← Montserrat + RobotoFlex fonts
│           ├── Shape.kt       ← shared shape tokens
│           └── Keylines.kt    ← layout spacing constants
├── mobile/                    ← uses core:designsystem
├── tv/                        ← uses core:designsystem
└── wear/                      ← uses core:designsystem
```

### Purpose

The **enterprise/multi-platform pattern**. Design tokens are defined once and consumed by all form-factor targets. `MaterialExpressiveTheme` adds a motion system on top of Material 3.

### When to use

- Building for multiple form factors (phone, TV, Wear, tablet)
- Team has a shared design system that multiple apps/modules consume
- You want coordinated animation behavior across the entire app via `MotionScheme`

---

## 5. Style 4 — Jetchat: M3 + Glance Widget Theme

**Files:**
- `Jetchat/app/src/main/java/com/example/compose/jetchat/theme/Themes.kt`
- `Jetchat/app/src/main/java/com/example/compose/jetchat/theme/Color.kt`
- `Jetchat/app/src/main/java/com/example/compose/jetchat/theme/Typography.kt`
- `Jetchat/app/src/main/java/com/example/compose/jetchat/widget/theme/Theme.kt`

### How it works

Standard M3 for the app, with a **separate theme for Glance (home screen widgets)**:

```kotlin
// App theme — dynamic color on by default
@Composable
fun JetchatTheme(
    isDarkTheme: Boolean = isSystemInDarkTheme(),
    isDynamicColor: Boolean = true,  // ← enabled by default, unlike other samples
    content: @Composable () -> Unit
) {
    val dynamicColor = isDynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val myColorScheme = when {
        dynamicColor && isDarkTheme -> dynamicDarkColorScheme(LocalContext.current)
        dynamicColor && !isDarkTheme -> dynamicLightColorScheme(LocalContext.current)
        isDarkTheme -> JetchatDarkColorScheme
        else -> JetchatLightColorScheme
    }
    MaterialTheme(colorScheme = myColorScheme, typography = JetchatTypography, content = content)
}
```

### Color naming convention

Uses semantic color names (hue + brightness number) rather than M3 role names:

```kotlin
// Color.kt — named by hue and brightness (10=darkest, 99=lightest)
val Blue80 = Color(...)
val Blue40 = Color(...)
val Blue20 = Color(...)
val DarkBlue80 = Color(...)
val Yellow80 = Color(...)
val Red40 = Color(...)
val Grey10 = Color(...)
val BlueGrey30 = Color(...)
```

### Dual font family

```kotlin
// Typography.kt
val JetchatTypography = Typography(
    // Montserrat for display/headline/title
    displayLarge = TextStyle(fontFamily = Montserrat, ...),
    headlineMedium = TextStyle(fontFamily = Montserrat, ...),
    titleLarge = TextStyle(fontFamily = Montserrat, ...),

    // Karla for body/label text
    bodyLarge = TextStyle(fontFamily = Karla, ...),
    bodyMedium = TextStyle(fontFamily = Karla, ...),
    labelMedium = TextStyle(fontFamily = Karla, ...),
)
```

### Glance widget theme

```kotlin
// widget/theme/Theme.kt — separate theme just for the home screen widget
@Composable
fun JetchatWidgetTheme(content: @Composable () -> Unit) {
    GlanceTheme(
        colors = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            GlanceTheme.colors  // Dynamic colors for widget
        } else {
            ColorProviders(
                light = JetchatLightColorScheme,
                dark = JetchatDarkColorScheme,
            )
        },
        content = content,
    )
}
```

### Purpose

Shows how to **maintain visual consistency between the app and its home screen widget**. The widget lives outside the app's Compose tree and needs its own theme entry point via the Glance API.

### When to use

- Your app ships a home screen widget (AppWidget via Glance)
- You want the widget to match the app's colors including dynamic color

---

## 6. Style 5 — Jetsnack: Fully Custom Design System

**Files:**
- `Jetsnack/app/src/main/java/com/example/jetsnack/ui/theme/Theme.kt`
- `Jetsnack/app/src/main/java/com/example/jetsnack/ui/theme/Color.kt`
- `Jetsnack/app/src/main/java/com/example/jetsnack/ui/theme/Type.kt`
- `Jetsnack/app/src/main/java/com/example/jetsnack/ui/theme/Shape.kt`

### How it works

Completely replaces Material 3's color system. M3 slots are intentionally set to **Magenta** (a debug color) to make any accidental use of `MaterialTheme.colorScheme.*` visually obvious:

```kotlin
// All M3 color slots = Magenta (bright pink) as a debugging signal
fun debugColors(darkTheme: Boolean, debugColor: Color = Color.Magenta) = ColorScheme(
    primary = debugColor,
    onPrimary = debugColor,
    secondary = debugColor,
    // ... ALL 40+ M3 slots = Magenta
)

@Composable
fun JetsnackTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors = if (darkTheme) DarkColorPalette else LightColorPalette

    ProvideJetsnackColors(colors) {
        MaterialTheme(
            colorScheme = debugColors(darkTheme), // ← intentional debug Magenta
            typography = Typography,
            shapes = Shapes,
            content = content,
        )
    }
}
```

### Custom color data class

```kotlin
@Immutable
data class JetsnackColors(
    // Gradient lists for animated backgrounds
    val gradient6_1: List<Color>,  // 5-stop gradient
    val gradient6_2: List<Color>,
    val gradient3_1: List<Color>,  // 3-stop gradient
    val gradient3_2: List<Color>,
    val gradient2_1: List<Color>,  // 2-stop gradient
    val gradient2_2: List<Color>,
    val gradient2_3: List<Color>,
    val tornado1: List<Color>,     // Special tornado animation gradient

    // Brand colors
    val brand: Color,
    val brandSecondary: Color,

    // Semantic UI colors
    val uiBackground: Color,
    val uiBorder: Color,
    val uiFloated: Color,

    // Text colors
    val textPrimary: Color = brand,
    val textSecondary: Color,
    val textHelp: Color,
    val textInteractive: Color,
    val textLink: Color,

    // Icon colors
    val iconPrimary: Color = brand,
    val iconSecondary: Color,
    val iconInteractive: Color,
    val iconInteractiveInactive: Color,

    val error: Color,
    val isDark: Boolean,
)
```

### 11-step color ramps

Each hue has 12 values from 0 (lightest) to 11 (darkest):

```kotlin
// Shadow (blue-purple hue)
val Shadow11 = Color(0xff001787)  // darkest
val Shadow10 = Color(0xff00119e)
// ...
val Shadow1  = Color(0xffded6fe)
val Shadow0  = Color(0xfff4f2ff)  // lightest

// Same pattern for: Ocean, Lavender, Rose, Neutral
val Ocean11 = Color(0xff005687)
val Lavender11 = Color(0xff170085)
val Rose11 = Color(0xff7f0054)
val Neutral8 = Color(0xff121212)  // Neutral only goes 0-8
```

### How to access colors

```kotlin
// Anywhere in the composable tree:
val colors = JetsnackTheme.colors

// Use like:
Box(modifier = Modifier.background(colors.uiBackground))
Text(text = "Hello", color = colors.textPrimary)

// Gradients:
Box(
    modifier = Modifier.background(
        Brush.horizontalGradient(colors.gradient2_1)
    )
)
```

### Shapes

Intentionally opinionated — small is pill-shaped, large is square:

```kotlin
val Shapes = Shapes(
    small = RoundedCornerShape(percent = 50), // ← 50% = pill/circle shape
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(0.dp),         // ← completely square
)
```

### Purpose

Demonstrates a **brand-first design system** that completely overrides Material 3. This is the right pattern when your designer delivers a custom design language (like a branded component library) that doesn't follow Material Design.

### When to use

- Your brand design system is completely custom (not Material-based)
- You need multi-stop gradient colors as first-class theme tokens
- You want to enforce that devs never accidentally use M3 colors
- E-commerce, entertainment, or gaming apps with strong visual identity

---

## 7. Style 6 — Reply: M3 + System Contrast Detection

**Files:**
- `Reply/app/src/main/java/com/example/reply/ui/theme/Theme.kt`
- `Reply/app/src/main/java/com/example/reply/ui/theme/Color.kt`
- `Reply/app/src/main/java/com/example/reply/ui/theme/Shapes.kt`

### How it works

Reads the system-level contrast accessibility setting on Android 14+ via `UiModeManager` and selects from 3 pre-defined color scheme tiers:

```kotlin
fun isContrastAvailable(): Boolean {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE // Android 14
}

@Composable
fun selectSchemeForContrast(isDark: Boolean): ColorScheme {
    val context = LocalContext.current
    val isPreview = LocalInspectionMode.current

    if (!isPreview && isContrastAvailable()) {
        val uiModeManager = context.getSystemService(Context.UI_MODE_SERVICE) as UiModeManager
        val contrastLevel = uiModeManager.contrast  // float: 0.0 to 1.0

        return when (contrastLevel) {
            in 0.0f..0.33f -> if (isDark) darkScheme else lightScheme
            in 0.34f..0.66f -> if (isDark) mediumContrastDarkColorScheme else mediumContrastLightColorScheme
            in 0.67f..1.0f -> if (isDark) highContrastDarkColorScheme else highContrastLightColorScheme
            else -> if (isDark) darkScheme else lightScheme
        }
    }
    return if (isDark) darkScheme else lightScheme
}

@Composable
fun ContrastAwareReplyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable() () -> Unit,
) {
    val replyColorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        else -> selectSchemeForContrast(darkTheme) // ← accessibility-aware selection
    }
    MaterialTheme(colorScheme = replyColorScheme, typography = replyTypography, shapes = shapes, content = content)
}
```

### Three color schemes per mode

```
light  ──────────────────────────── (0.0 - 0.33)   standard
                ──────────────────── (0.34 - 0.66)  mediumContrast
                         ─────────── (0.67 - 1.0)   highContrast
dark   ──────────────────────────── same 3 tiers
```

Result: **6 total color schemes** defined in Color.kt.

### Shapes — full 5-level scale

```kotlin
val shapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),  // ← most complete shape scale
)
```

### Purpose

The **accessibility-first pattern**. Automatically adapts to whatever contrast level the user sets in Android Settings → Accessibility → Color and Motion → Contrast. Users with low vision benefit without needing to do anything special in the app.

### When to use

- Government, healthcare, or public-sector apps (accessibility often required)
- Apps targeting older users or users with visual impairments
- Apps that must comply with WCAG 2.1 AA or AAA contrast ratios

---

## 8. Key Differences Compared

### Color system

| App | Approach | # Color Tokens | Dynamic Color |
|-----|----------|---------------|---------------|
| JetNews | M3 standard | 28 (light+dark) | Yes (12+) |
| JetLagged | M3 + 14 extra | 28 + 14 domain | No |
| Jetcaster | M3 × 3 contrast tiers | 28 × 6 schemes | Yes (12+) |
| Jetchat | M3 standard | 28 (light+dark) | Yes (12+, default on) |
| Jetsnack | Custom 11-step ramps | ~60 + gradients | No |
| Reply | M3 × 3 contrast tiers | 28 × 6 schemes | Yes (12+) |

### Typography

| App | Font(s) | Loading | Named Styles |
|-----|---------|---------|--------------|
| JetNews | Montserrat | Local asset | No (uses M3 scale) |
| JetLagged | Lato | Google Fonts (downloadable) | Yes (custom named) |
| Jetcaster | Montserrat + RobotoFlex | Local asset | No (uses M3 scale) |
| Jetchat | Montserrat + Karla | Google Fonts | No (uses M3 scale) |
| Jetsnack | Montserrat + Karla | Local asset | No (uses M3 scale, mixed fonts) |
| Reply | Default (none) | System default | No (uses M3 scale) |

### Shapes

| App | small | medium | large | extraLarge |
|-----|-------|--------|-------|------------|
| JetNews | 4dp | 4dp | 8dp | — |
| JetLagged | default | default | CircleShape | — |
| Jetcaster | 50% (pill) | 8dp | 16dp | — |
| Jetchat | — | — | — | — |
| Jetsnack | 50% (pill) | 20dp | 0dp (square) | — |
| Reply | 4dp | 8dp | 16dp→24dp | 32dp |

---

## 9. What Should You Use?

### Decision flowchart

```
Does your app need to ship a Glance (home screen) widget?
  └─ YES → Style 4 (Jetchat) — add Glance widget theme

Does your app target multiple form factors (phone + TV + Wear)?
  └─ YES → Style 3 (Jetcaster) — shared designsystem module

Does your brand have a custom design system (not Material)?
  └─ YES → Style 5 (Jetsnack) — full custom design system
     └─ Does it just need extra domain-specific colors?
          └─ YES → Style 2 (JetLagged) — extend M3 with CompositionLocal

Does your app require accessibility compliance (WCAG)?
  └─ YES → Style 6 (Reply) — contrast-aware theming

None of the above?
  └─ Style 1 (JetNews) — pure M3, cleanest starting point
```

### Combinations you can mix

These styles are not mutually exclusive:

| Want to combine | How |
|----------------|-----|
| Custom domain colors + dynamic color | JetLagged pattern + add dynamic color check in `JetLaggedTheme` |
| Custom design system + contrast tiers | Jetsnack pattern + define 3 palette variants like Reply |
| Shared module + Glance widget | Jetcaster module structure + Jetchat widget theme |

---

## 10. Core Concepts to Learn First

Before diving into the samples, make sure you understand these Compose fundamentals:

### MaterialTheme

```kotlin
// The root of all M3 theming. Provides colors, typography, and shapes
// to the entire composition tree below it.
MaterialTheme(
    colorScheme = lightColorScheme(...),
    typography = Typography(...),
    shapes = Shapes(...),
    content = { /* your app */ }
)

// Access anywhere below:
val primary = MaterialTheme.colorScheme.primary
val bodyFont = MaterialTheme.typography.bodyLarge
val cardShape = MaterialTheme.shapes.medium
```

### CompositionLocal

```kotlin
// A way to pass data implicitly through the composition tree
// without threading it through every function parameter.

// Define:
val LocalMyColors = staticCompositionLocalOf { MyColors() }

// Provide:
CompositionLocalProvider(LocalMyColors provides myColors) {
    content()
}

// Consume (anywhere below the provider):
val colors = LocalMyColors.current
```

### lightColorScheme / darkColorScheme

```kotlin
// M3 provides these builders. You only need to specify colors that
// differ from the defaults — unspecified slots get sensible M3 defaults.
val LightColors = lightColorScheme(
    primary = Color(0xFFBF0031),
    // You can omit other slots — they'll use M3's baseline colors
)
```

### dynamicColorScheme

```kotlin
// Available on Android 12+ (API 31).
// Generates a full M3 color scheme from the user's current wallpaper.
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    val context = LocalContext.current
    dynamicLightColorScheme(context)  // light variant from wallpaper
    dynamicDarkColorScheme(context)   // dark variant from wallpaper
}
```

### isSystemInDarkTheme

```kotlin
// Reads the system-level dark mode setting.
// Always use this as your default darkTheme parameter.
@Composable
fun MyTheme(darkTheme: Boolean = isSystemInDarkTheme(), ...) { }
```

---

*Document generated from source code of `https://github.com/tuan0504/compose-samples`*  
*Last updated: 2026-05-20*
