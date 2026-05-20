# Design System in Jetpack Compose Samples

A design system is the collection of reusable decisions — **tokens** (colors, type, spacing, shape), **components** (buttons, cards, surfaces), and **patterns** (how those pieces combine) — that gives a product a consistent visual language and speeds up UI development.

This document covers how each sample in this repo approaches building and organizing its design system, what tokens it defines, how components consume those tokens, and what you can learn from each approach.

---

## Repo Overview (from READMEs)

| App | Complexity | Design System Approach | Key Feature |
|---|---|---|---|
| **JetNews** | Medium | Pure Material 3 | Tonal elevation, adaptive layout |
| **Jetchat** | Low | M3 + Material You dynamic color | Downloadable fonts, GlanceTheme widget |
| **Jetsnack** | Medium | **Fully custom design system** | No M3 color — own palette + component wrappers |
| **Jetcaster** | Advanced | Shared `core/designsystem` module | Multi–form-factor (mobile, TV, Wear) |
| **Reply** | Medium | M3 + contrast tiers | Adaptive navigation (phone → tablet → foldable) |
| **JetLagged** | Medium | CompositionLocal extra tokens | Custom layouts, AGSL shaders, graphs |

---

## Part 1 — Design Tokens

Tokens are the named, reusable values that define the visual language: **color**, **typography**, **shape**, **spacing**.

### 1.1 Color Tokens

#### JetNews — M3 Slot Model (28 named roles)

JetNews uses the standard Material 3 color slot model. Every color is named after its *role*, not its visual appearance:

```kotlin
// Color.kt
val Red700 = Color(0xFFBF0031)

// All 28 M3 roles defined:
val md_theme_light_primary = Red700
val md_theme_light_onPrimary = Color(0xFFFFFFFF)
val md_theme_light_primaryContainer = Color(0xFFFFDAD9)
val md_theme_light_onPrimaryContainer = Color(0xFF40000A)
// ... secondary, tertiary, error, background, surface families
```

**The M3 role system:**
- `primary` / `onPrimary` — main brand color + text on top of it
- `primaryContainer` / `onPrimaryContainer` — tinted container + content inside
- `surface` / `onSurface` — card and sheet backgrounds + content
- `background` / `onBackground` — screen background + content
- `error` / `onError` / `errorContainer` / `onErrorContainer` — error states

#### Jetcaster — M3 Slots + Contrast Variants (3 tiers × 2 modes = 6 schemes)

Jetcaster's shared `core/designsystem` module defines a warm, dark-forward palette:

```kotlin
// core/designsystem/theme/Color.kt
val primaryLight  = Color(0xFFFF792C)   // vivid orange
val secondaryLight = Color(0xFFFFE523)  // bright yellow
val tertiaryLight  = Color(0xFFFF9AD8)  // pink
val surfaceDark    = Color(0xFF261604)  // very dark brown (primary dark bg)
val backgroundDark = Color(0xFF151218)  // near-black purple-tinted
```

Three full contrast tiers per mode (standard / mediumContrast / highContrast) — consumed by `selectSchemeForContrast()`.

#### Jetsnack — Custom Palette: 11-Step Color Ramps

Jetsnack rejects M3 color roles entirely and defines its own semantic color system based on named ramps:

```kotlin
// Color.kt
val Shadow0  = Color(0xFF1B0E00)   // darkest
val Shadow1  = Color(0xFF33180B)
// ... through Shadow11 = Color(0xFFFFF7F2) lightest

val Ocean0   = Color(0xFF003787)
val Ocean11  = Color(0xFFD7E2FF)

val Lavender0 = Color(0xFF2B0080)
val Lavender11 = Color(0xFFEDE7FF)

val Rose0    = Color(0xFF500034)
val Rose11   = Color(0xFFFFE4F3)

val Neutral0 = Color(0xFF1B1B1B)
val Neutral8  = Color(0xFFF5F5F5)
```

Then mapped to semantic roles in `JetsnackColors`:

```kotlin
data class JetsnackColors(
    val gradient6_1: List<Color>,     // 6-stop gradient for hero surfaces
    val gradient6_2: List<Color>,
    val gradient3_1: List<Color>,     // 3-stop gradient for cards
    val gradient3_2: List<Color>,
    val gradient2_1: List<Color>,     // 2-stop gradient for buttons
    val gradient2_2: List<Color>,
    val brand: Color,                 // primary brand color
    val brandSecondary: Color,
    val uiBackground: Color,
    val uiBorder: Color,
    val uiFloated: Color,
    val interactivePrimary: List<Color>,   // gradient list for primary buttons
    val interactiveSecondary: List<Color>,
    val interactiveMask: List<Color>,
    val textPrimary: Color,
    val textSecondary: Color,
    val textHelp: Color,
    val textInteractive: Color,
    val textLink: Color,
    val tornado1: List<Color>,
    val iconPrimary: Color,
    val iconSecondary: Color,
    val iconInteractive: Color,
    val iconInteractiveInactive: Color,
    val error: Color,
    val notificationBadge: Color,
    val isDark: Boolean
)
```

> **Why ramps?** An 11-step ramp gives you a full tonal range from dark to light for a single hue, similar to how M3's tonal palettes work internally. Jetsnack hand-picks steps from these ramps to assemble gradients.

#### JetLagged — Extra Custom Tokens via CompositionLocal

JetLagged extends M3 with a small set of domain-specific color tokens that have no M3 equivalent:

```kotlin
// In JetLaggedTheme
data class JetLaggedExtraColors(
    val sleepAwake: Color = Color(0xFF1B998B),
    val sleepRem: Color   = Color(0xFF3BCEAC),
    val sleepLight: Color = Color(0xFF8185FC),
    val sleepDeep: Color  = Color(0xFFFC424A),
)

// Accessed anywhere in the tree:
val extraColors = LocalExtraColors.current
Text(color = extraColors.sleepDeep)
```

---

### 1.2 Typography Tokens

#### JetNews — Montserrat + LineBreak Hints

```kotlin
// Type.kt
private val Montserrat = FontFamily(
    Font(R.font.montserrat_regular, FontWeight.Normal),
    Font(R.font.montserrat_medium, FontWeight.Medium),
    Font(R.font.montserrat_semibold, FontWeight.SemiBold),
)

val JetnewsTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = Montserrat,
        lineBreak = LineBreak.Heading,   // smart line-break for titles
    ),
    bodyLarge = TextStyle(
        fontFamily = Montserrat,
        lineBreak = LineBreak.Paragraph, // paragraph-aware breaks
    ),
    // ...
)
```

`LineBreak.Heading` and `LineBreak.Paragraph` are M3 typography hints that tell the text engine *where* it is acceptable to break lines — headings prefer whole-word breaks, paragraphs prefer balanced breaks.

#### Jetchat — Downloadable Fonts (Google Fonts API)

```kotlin
// Type.kt
val provider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs,
)

val KarlaFontFamily = FontFamily(
    Font(googleFont = GoogleFont("Karla"), fontProvider = provider),
)
val MontserratFontFamily = FontFamily(
    Font(googleFont = GoogleFont("Montserrat"), fontProvider = provider),
)
```

No font files bundled in `res/font/` — fonts are fetched at runtime from Google Fonts via GMS. Reduces APK size but requires network access on first use.

#### Jetcaster — Mixed: RobotoFlex (variable) + Montserrat (bundled)

```kotlin
// core/designsystem/theme/Type.kt
val JetcasterTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = RobotoFlex,       // variable font, supports weight axis
        fontWeight = FontWeight(738),  // exact weight on the variable axis
        fontSize = 64.sp,
    ),
    headlineLarge = TextStyle(
        fontFamily = Montserrat,       // static font
        fontWeight = FontWeight.W500,
        fontSize = 32.sp,
    ),
    // ...
)
```

RobotoFlex is a *variable font* — a single `.ttf` file that supports a continuous weight axis (1–1000) instead of discrete weights. This enables precise typographic control.

#### JetLagged — Named Semantic Styles (not M3 slot names)

```kotlin
// Type.kt
val TitleBarStyle = TextStyle(
    fontFamily = Lato,
    fontWeight = FontWeight.Bold,
    fontSize = 22.sp,
)
val HeadingStyle = TextStyle(...)
val TitleStyle   = TextStyle(...)
val BodyStyle    = TextStyle(...)
```

Lato is fetched via `GoogleFont` API. Styles are given *semantic* names (TitleBar, Heading) rather than M3 slot names (headlineLarge), then consumed directly in composables as `TitleBarStyle` — no `MaterialTheme.typography.*` lookup needed.

#### Jetsnack — Mixed Fonts Per Slot

```kotlin
// Two different font families assigned to different scale levels:
val Karla = FontFamily(Font(R.font.karla_regular), Font(R.font.karla_bold))
val Montserrat = FontFamily(...)

val JetsnackTypography = Typography(
    displayLarge  = TextStyle(fontFamily = Montserrat),
    headlineLarge = TextStyle(fontFamily = Montserrat),
    bodyLarge     = TextStyle(fontFamily = Karla),     // body uses Karla
    labelLarge    = TextStyle(fontFamily = Karla),
)
```

---

### 1.3 Shape Tokens

Shape defines corner radii — from sharp (0dp) to fully pill (50%).

| App | extraSmall | small | medium | large | extraLarge | Philosophy |
|---|---|---|---|---|---|---|
| **JetNews** | — | 4dp | 4dp | 8dp | — | Nearly flat — minimal rounding |
| **Jetsnack** | — | 50% pill | 20dp | 0dp square | — | Mix: pill buttons, square overlays |
| **Reply** | 4dp | 8dp | 12dp | 16dp | 32dp | Full 5-level M3 scale |
| **Jetchat** | — | default | default | default | — | All M3 defaults |
| **Jetcaster** | — | circular | default | 16dp | — | Media card rounding |

Jetsnack's approach is notable: `small = RoundedCornerShape(percent = 50)` creates pill-shaped buttons, while `large = RoundedCornerShape(0.dp)` creates sharp-edged hero overlays — reflecting the snack app's bold visual language.

### 1.4 Spacing Tokens

Only Jetcaster explicitly names spacing:

```kotlin
// core/designsystem/theme/Keylines.kt
val Keyline1 = 16.dp   // standard content margin
```

This single named constant is referenced across all screens for consistent left/right padding. Other apps use `16.dp` inline without a named token — Jetcaster formalizes it because it's a shared module used by mobile, TV, and Wear targets simultaneously.

---

## Part 2 — Component Library

A component library wraps primitive Compose building blocks into themed, reusable pieces that automatically consume the design tokens.

### 2.1 JetNews — Minimal Wrappers (Thin Layer)

JetNews uses M3 components almost directly with very little wrapping:

```
components/
├── AppNavRail.kt         — NavigationRail wrapper with Jetnews-specific items
└── JetnewsSnackbarHost.kt — SnackbarHost with branded positioning
```

**Pattern:** Import M3 `Card`, `TopAppBar`, `Button` directly, pass `MaterialTheme.colorScheme.*` as parameters when needed. No custom component class.

**When to use this:** When Material 3 components fit your design exactly. Zero abstraction overhead.

### 2.2 Jetchat — Scaffolding Components (Medium Layer)

```
components/
├── JetchatAppBar.kt        — CenterAlignedTopAppBar with chat-specific actions
├── JetchatDrawer.kt        — ModalNavigationDrawer with channel list
├── JetchatScaffold.kt      — Scaffold wrapper with chat layout logic
├── JetchatIcon.kt          — Icon with branded tinting
├── AnimatingFabContent.kt  — FAB with text-expansion animation
└── BaseLineHeightModifier.kt — Custom Modifier for text baseline alignment
```

**Pattern:** Wrap M3 scaffold components to encapsulate layout decisions. The app bar knows about chat-specific actions; the scaffold knows about chat-specific slot positions.

### 2.3 Jetsnack — Full Custom Component Library (Thick Layer)

Jetsnack has the most complete custom component library in the repo. Every M3 component that Jetsnack uses is **wrapped and re-skinned** to use `JetsnackTheme.colors` instead of `MaterialTheme.colorScheme`:

```
components/
├── Button.kt          — JetsnackButton (gradient background, pill shape)
├── Card.kt            — SnackCollection card layout
├── Divider.kt         — JetsnackDivider (uses JetsnackTheme.colors.uiBorder)
├── Gradient.kt        — Modifier extensions: diagonalGradientTint, offsetGradientBackground, fadeInDiagonalGradientBorder
├── GradientTintedIconButton.kt — Icon button with diagonal gradient tint
├── Grid.kt            — Custom staggered grid layout
├── QuantitySelector.kt — +/- quantity control
├── Scaffold.kt        — JetsnackScaffold (custom bottom bar slot)
├── Snackbar.kt        — JetsnackSnackbar (branded notification)
├── Snacks.kt          — SnackItem, SnackCollection composables
└── Surface.kt         — JetsnackSurface (consumes JetsnackTheme colors)
```

**Key design decision:** `JetsnackButton` uses `JetsnackTheme.colors.interactivePrimary` (a gradient list) as its background — impossible with M3's `Button` which only accepts a single `Color`. This is why the wrapper exists.

```kotlin
@Composable
fun JetsnackButton(
    onClick: () -> Unit,
    backgroundGradient: List<Color> = JetsnackTheme.colors.interactivePrimary,
    contentColor: Color = JetsnackTheme.colors.textInteractive,
    content: @Composable RowScope.() -> Unit,
) {
    JetsnackSurface(
        modifier = Modifier
            .background(Brush.horizontalGradient(colors = backgroundGradient))
            .clip(ButtonShape),
        // ...
    ) { /* ... */ }
}
```

**Gradient Modifier library** — Jetsnack's `Gradient.kt` is reusable across the entire app:

```kotlin
// Draw a diagonal gradient tint over any content:
Modifier.diagonalGradientTint(colors = JetsnackTheme.colors.tornado1, blendMode = BlendMode.Darken)

// Scroll-aware horizontal gradient that tiles when content scrolls:
Modifier.offsetGradientBackground(colors = gradient, width = { size.width }, offset = { scroll.toFloat() })

// Animated gradient border (fades in/out):
Modifier.fadeInDiagonalGradientBorder(showBorder = selected, colors = gradient, shape = shape)
```

### 2.4 Jetcaster — Shared Multi-Platform Components

Jetcaster's `core/designsystem/component/` contains components shared across **mobile, TV, and Wear**:

```
component/
├── PodcastImage.kt         — Coil async image with loading/error states + placeholder brush
├── ImageBackground.kt      — Full-bleed background image with gradient overlay
├── HtmlTextContainer.kt    — Renders HTML episode descriptions as styled Compose text
└── thumbnailPlaceholder.kt — Animated shimmer brush for loading placeholders
```

**PodcastImage** is a good example of a well-structured shared component:
- Handles `LocalInspectionMode` (shows colored box in preview)
- Handles loading state (placeholder brush)
- Handles error state (fallback drawable)
- Wraps Coil's `AsyncImagePainter` to standardize image loading across all form factors

```kotlin
@Composable
fun PodcastImage(
    podcastImageUrl: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    placeholderBrush: Brush = thumbnailPlaceholderDefaultBrush(),
) {
    // Preview mode: solid color box
    if (LocalInspectionMode.current) {
        Box(modifier = modifier.background(MaterialTheme.colorScheme.primary))
        return
    }
    // Runtime: Coil async load with loading/error states
    // ...
}
```

### 2.5 Reply — M3 Components With Adaptive Slots

Reply uses M3 components directly but structures them with **adaptive slots**:

```
components/
├── ReplyAppBars.kt        — TopAppBar with search, profile actions
├── ReplyEmailListItem.kt  — Email card (surface + typography tokens)
├── ReplyEmailThreadItem.kt — Thread view card
└── ReplyProfileImage.kt   — Avatar composable
```

Reply's real design system work is in navigation — the same content area uses `BottomNavigationBar` on compact, `NavigationRail` on medium, and `PermanentNavigationDrawer` on expanded screens.

---

## Part 3 — Token Access Patterns

How components *consume* tokens determines how easy it is to theme and test.

### Pattern A: MaterialTheme Direct (JetNews, Reply, Jetchat)

```kotlin
@Composable
fun ArticleCard() {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    ) {
        Text(
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
```

**Pros:** Zero extra code, works with dynamic color, works with system dark mode.  
**Cons:** Can't add tokens that M3 doesn't have (no `sleepDeep` color slot in M3).

---

### Pattern B: CompositionLocal Extra Layer (JetLagged)

```kotlin
// Define extra tokens
data class JetLaggedExtraColors(val sleepDeep: Color = Color(0xFFFC424A))

// Provide them at the theme root
val LocalExtraColors = staticCompositionLocalOf { JetLaggedExtraColors() }

@Composable
fun JetLaggedTheme(content: @Composable () -> Unit) {
    val extraColors = if (isSystemInDarkTheme()) JetLaggedExtraColors(...)
                      else JetLaggedExtraColors()
    CompositionLocalProvider(LocalExtraColors provides extraColors) {
        MaterialTheme(content = content)
    }
}

// Consume anywhere:
val colors = LocalExtraColors.current
Box(modifier = Modifier.background(colors.sleepDeep))
```

**Pros:** Extends M3 cleanly without replacing it. Easy to add domain-specific tokens.  
**Cons:** Composables that need extra tokens must remember to read `LocalExtraColors.current` — easy to forget.

---

### Pattern C: Custom Theme Object (Jetsnack)

```kotlin
// Theme object provides type-safe access:
object JetsnackTheme {
    val colors: JetsnackColors
        @Composable get() = LocalJetsnackColors.current
    val typography: Typography
        @Composable get() = MaterialTheme.typography
}

// All components use JetsnackTheme:
val gradient = JetsnackTheme.colors.gradient6_1
val brand    = JetsnackTheme.colors.brand
```

**Pros:** Type-safe, easy to discover all available tokens, impossible to accidentally use M3 colors (debugColors() crashes with magenta if you try).  
**Cons:** More boilerplate upfront. Cannot use Material You dynamic color (hardcoded palette).

---

### Pattern D: Shared Gradle Module (Jetcaster)

```
Jetcaster/
├── core/
│   └── designsystem/         ← Android library module
│       ├── theme/
│       │   ├── Color.kt
│       │   ├── Type.kt
│       │   ├── Shape.kt
│       │   └── Keylines.kt
│       └── component/
│           ├── PodcastImage.kt
│           └── ...
├── mobile/                   ← depends on :core:designsystem
├── tv-app/                   ← depends on :core:designsystem
└── wear/                     ← depends on :core:designsystem
```

All three form-factor apps depend on `core/designsystem`. They share the same color values, typography scale, and `PodcastImage` component. Platform-specific layouts live in their own modules.

**Pros:** Single source of truth for tokens. A color change in `Color.kt` propagates to mobile, TV, and Wear simultaneously.  
**Cons:** Requires multi-module Gradle setup. Overkill for single-target apps.

---

## Part 4 — Decision Guide: Which Approach for Your App?

```
START
  │
  ├─► Does your app need to run on multiple form factors (TV, Wear)?
  │     YES → Pattern D: Shared Gradle Module (Jetcaster)
  │
  ├─► Does your app use a custom visual brand that diverges from Material?
  │     YES, completely custom → Pattern C: Custom Theme Object (Jetsnack)
  │     YES, but extends M3  → Pattern B: CompositionLocal Extra Layer (JetLagged)
  │     NO, follows M3 fully → Pattern A: MaterialTheme Direct (JetNews, Reply)
  │
  ├─► Do you need system contrast tiers (accessibility)?
  │     YES → Reply's UiModeManager approach
  │
  └─► Do you need Material You (wallpaper colors)?
        YES → Jetchat/Reply dynamic color (dynamicColorScheme)
```

---

## Part 5 — What Each App Teaches

| App | Primary Lesson | What to Copy |
|---|---|---|
| **JetNews** | M3 color roles + tonal elevation | `lightColorScheme()` / `darkColorScheme()` setup, `Typography` with `LineBreak` |
| **Jetchat** | Downloadable fonts + widget theming | `GoogleFont.Provider`, `GlanceTheme` for home screen widgets |
| **Jetsnack** | Full custom design system | `JetsnackColors` data class pattern, `debugColors()` enforcement, `Gradient.kt` Modifier extensions |
| **Jetcaster** | Multi-module design system + variable fonts | `core/designsystem` module structure, `RobotoFlex` variable font, `Keyline1` spacing token |
| **Reply** | Contrast accessibility + adaptive navigation | `UiModeManager.contrast` tier switching, `WindowSizeClass`-driven nav |
| **JetLagged** | Named semantic styles + domain tokens | `CompositionLocalProvider` for extra colors, `TitleBarStyle` named typography pattern |

---

## Part 6 — Anti-Patterns to Avoid

### 1. Hardcoding colors inline

```kotlin
// BAD — hardcoded, won't respond to dark mode
Text(color = Color(0xFF333333))

// GOOD — responds to theme
Text(color = MaterialTheme.colorScheme.onSurface)
```

### 2. Using `Color.Unspecified` as a sentinel

Jetsnack uses `debugColors()` with `Color.Magenta` to catch this — any composable that doesn't explicitly set a color gets an obvious magenta tint during development, making it easy to spot.

### 3. Mixing M3 colors with custom system

Once you've adopted a custom system like Jetsnack's, don't mix `MaterialTheme.colorScheme.primary` with `JetsnackTheme.colors.brand` — pick one and enforce it.

### 4. Ignoring the `onX` contract

The `on` prefix (e.g., `onPrimary`, `onSurface`) means "content drawn ON TOP OF that surface." Always pair:
- `primary` background → `onPrimary` text
- `surfaceVariant` background → `onSurfaceVariant` text

Violating this breaks accessibility contrast ratios.

### 5. Skipping `LocalInspectionMode` in shared components

Jetcaster's `PodcastImage` shows the right pattern: check `LocalInspectionMode.current` to short-circuit network loading during Compose Preview. Without this, every preview with a network image either crashes or shows empty.

---

## Summary

The six apps form a spectrum from **zero abstraction** (JetNews using raw M3) to **full custom design system** (Jetsnack replacing M3 colors entirely). The right choice depends on:

- **How close your brand is to Material Design** — close → stay on M3; diverged → wrap or replace
- **How many targets you ship to** — one app → colocate tokens in `ui/theme`; multiple → extract to a Gradle module
- **Whether you need extra tokens** — none → `MaterialTheme` is enough; domain-specific → add `CompositionLocal`
- **Whether you need accessibility tiers** — Reply's contrast detection is the reference implementation

Start with Pattern A and add complexity only when you hit a concrete wall.
