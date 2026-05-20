# Phase 5 — Reusable Components: What Can I Steal?

---

## Overview

This phase is the most practically valuable — identifying the patterns, Modifier extensions, and utility composables from the samples that can be dropped into any production app today.

| Category | Best source | Why |
|---|---|---|
| Gradient Modifier extensions | Jetsnack `Gradient.kt` | Scroll-aware, animated, covers all gradient use cases |
| Gradient scrim (image overlay) | Jetcaster `GradientScrim.kt` | Vertical + radial, custom decay, production-grade |
| Async image with states | Jetcaster `PodcastImage.kt` | Loading / error / preview-safe in one composable |
| Multi-device `@Preview` | JetNews `MultipreviewAnnotations.kt` | One annotation, 3 devices — copy directly |
| NavController wrapper | Jetsnack/Jetcaster `AppState` | Lifecycle-safe navigation, de-duplication built-in |
| Bottom-nav state preservation | Reply/Jetsnack nav flags | 3-flag pattern, prevents all common nav bugs |
| SnackbarManager (global) | Jetsnack `SnackbarManager.kt` | Decouple snackbar from screens |
| Loading / Error state | Jetcaster TV `ErrorState.kt` | Reusable empty state composable |
| Animated FAB content | Jetchat `AnimatingFabContent.kt` | Text expands on selection |
| Custom baseline Modifier | Jetchat `BaseLineHeightModifier.kt` | Align text baselines across components |

---

## Part 1 — Modifier Extensions (Copy These)

### 1.1 Vertical Gradient Scrim — Jetcaster `GradientScrim.kt`

The most reusable Modifier in the repo. Draws a vertical gradient overlay over any content — used for image overlays on player screens so text remains readable over artwork.

```kotlin
// GradientScrim.kt — Jetcaster/mobile/util/
fun Modifier.verticalGradientScrim(
    color: Color,
    startYPercentage: Float = 0f,   // 0f = top of element
    endYPercentage: Float = 1f,     // 1f = bottom
    decay: Float = 1.0f,            // 1f = linear, >1f = slower fade at start
    numStops: Int = 16,             // quality vs performance tradeoff
): Modifier

fun Modifier.radialGradientScrim(color: Color): Modifier
```

**Usage:**

```kotlin
// Fade image to black at the bottom (for text readability)
Box(modifier = Modifier.fillMaxSize()) {
    Image(...)
    Box(
        modifier = Modifier
            .fillMaxSize()
            .verticalGradientScrim(
                color = Color.Black,
                startYPercentage = 0.3f,   // fade starts 30% from top
                endYPercentage = 1f,
                decay = 3f,                // slow at start, fast at end
            )
    )
    Text(modifier = Modifier.align(Alignment.BottomStart), ...)
}
```

**Why it's production-quality:**
- Uses `ModifierNodeElement` (the modern API, not the deprecated `drawWithContent`)
- Supports non-linear decay via exponential stop calculation
- Supports reversed gradients (decay upwards)
- Exposed in Layout Inspector via `inspectableProperties()`

### 1.2 Gradient Modifiers — Jetsnack `Gradient.kt`

Four Modifier extensions for gradient backgrounds and borders:

```kotlin
// 1. Diagonal gradient tint over existing content (blends with content)
fun Modifier.diagonalGradientTint(colors: List<Color>, blendMode: BlendMode): Modifier

// 2. Horizontal gradient background, scroll-offset aware
//    offset shifts the gradient as the user scrolls — creates parallax effect
fun Modifier.offsetGradientBackground(
    colors: List<Color>,
    width: Density.() -> Float,
    offset: Density.() -> Float = { 0f },
): Modifier

// 3. Simple fixed horizontal gradient background
fun Modifier.offsetGradientBackground(colors: List<Color>, width: Float, offset: Float = 0f): Modifier

// 4. Animated gradient border that fades in/out
fun Modifier.fadeInDiagonalGradientBorder(
    showBorder: Boolean,
    colors: List<Color>,
    borderSize: Dp = 2.dp,
    shape: Shape,
): Modifier
```

**Usage — scroll-parallax gradient:**

```kotlin
// In a LazyColumn item
val scrollOffset = lazyListState.firstVisibleItemScrollOffset.toFloat()

Box(
    modifier = Modifier
        .fillMaxWidth()
        .offsetGradientBackground(
            colors = JetsnackTheme.colors.gradient6_1,
            width = { size.width },
            offset = { scrollOffset },
        )
)
```

**Usage — animated selection border:**

```kotlin
// Chip or card that shows gradient border when selected
Box(
    modifier = Modifier
        .fadeInDiagonalGradientBorder(
            showBorder = isSelected,
            colors = listOf(Color(0xFFFF6B6B), Color(0xFF6B6BFF)),
            shape = RoundedCornerShape(8.dp),
        )
)
```

---

## Part 2 — Composables (Copy These)

### 2.1 PodcastImage — Jetcaster `core/designsystem/component/PodcastImage.kt`

The standard pattern for any async image that needs: preview support, loading state, error fallback.

```kotlin
@Composable
fun PodcastImage(
    podcastImageUrl: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    imageModifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    placeholderBrush: Brush = thumbnailPlaceholderDefaultBrush(),
) {
    // 1. Short-circuit in Compose Preview — no network, no crash
    if (LocalInspectionMode.current) {
        Box(modifier = modifier.background(MaterialTheme.colorScheme.primary))
        return
    }

    var imagePainterState by remember {
        mutableStateOf<AsyncImagePainter.State>(AsyncImagePainter.State.Empty)
    }

    val imageLoader = rememberAsyncImagePainter(
        model = ImageRequest.Builder(LocalContext.current)
            .data(podcastImageUrl)
            .crossfade(true)
            .build(),
        contentScale = contentScale,
        onState = { state -> imagePainterState = state },
    )

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        // 2. Loading / Error → show placeholder brush (shimmer)
        when (imagePainterState) {
            is AsyncImagePainter.State.Loading,
            is AsyncImagePainter.State.Error -> {
                Image(painter = painterResource(R.drawable.img_empty), ...)
            }
            else -> Box(modifier = modifier.background(placeholderBrush).fillMaxSize())
        }

        // 3. Always render the image (Coil handles the transition)
        Image(
            painter = imageLoader,
            contentDescription = contentDescription,
            contentScale = contentScale,
            modifier = modifier.then(imageModifier),
        )
    }
}
```

**Adapt to your project:** Replace `R.drawable.img_empty` with your own placeholder, replace `thumbnailPlaceholderDefaultBrush()` with a shimmer or solid color.

### 2.2 Loading / Error State — Jetcaster TV `ErrorState.kt`

Standard empty-state composable pattern for any screen:

```kotlin
// Collect as state to drive loading/error display
val screenState by viewModel.uiState.collectAsStateWithLifecycle()

when (screenState) {
    is UiState.Loading -> LoadingScreen()
    is UiState.Error   -> ErrorScreen(message = screenState.message, onRetry = viewModel::refresh)
    is UiState.Success -> ContentScreen(data = screenState.data)
}
```

### 2.3 AnimatingFabContent — Jetchat `AnimatingFabContent.kt`

FAB that animates between icon-only and icon+text states. Copy for any expandable FAB:

```kotlin
@Composable
fun AnimatingFabContent(
    icon: @Composable () -> Unit,
    text: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    extended: Boolean = true,
) {
    // AnimatedVisibility drives the width of the text portion
    Row(modifier = modifier) {
        icon()
        AnimatedVisibility(visible = extended) {
            Row {
                Spacer(Modifier.width(12.dp))
                text()
                Spacer(Modifier.width(20.dp))
            }
        }
    }
}
```

---

## Part 3 — Utility Annotations (Copy These)

### 3.1 Multi-device `@Preview` annotations — JetNews `MultipreviewAnnotations.kt`

Eliminates writing 3 `@Preview` annotations on every composable. Copy this file directly:

```kotlin
// MultipreviewAnnotations.kt
@Preview(name = "phone",    device = "spec:width=360dp,height=640dp,dpi=480")
@Preview(name = "foldable", device = "spec:width=673dp,height=841dp,dpi=480")
@Preview(name = "tablet",   device = "spec:width=1280dp,height=800dp,dpi=480")
annotation class DevicePreviews

@Preview(name = "small font", fontScale = 0.5f)
@Preview(name = "large font", fontScale = 1.5f)
annotation class FontScalePreviews

@Preview(name = "dark theme", uiMode = UI_MODE_NIGHT_YES)
@FontScalePreviews
@DevicePreviews
annotation class CompletePreviews
```

**Usage — one annotation instead of many:**

```kotlin
@CompletePreviews
@Composable
private fun MyScreenPreview() {
    MyTheme { MyScreen() }
}
```

This generates previews for dark mode, small font, large font, phone, foldable, and tablet in one annotation.

---

## Part 4 — Navigation Utilities (Copy These)

### 4.1 Lifecycle-safe navigation guard

Copy this extension everywhere navigation is triggered from a list item or tappable card:

```kotlin
// From Jetcaster/Jetsnack
private fun NavBackStackEntry.lifecycleIsResumed() =
    this.lifecycle.currentState == Lifecycle.State.RESUMED

// Usage in composable:
JetsnackButton(
    onClick = {
        if (backStackEntry.lifecycleIsResumed()) {
            navController.navigate(route)
        }
    }
)
```

### 4.2 Bottom-nav state preservation (3-flag pattern)

Copy this exact block into any bottom navigation implementation:

```kotlin
fun navigateToTab(route: Any) {
    navController.navigate(route) {
        popUpTo(navController.graph.findStartDestination().id) {
            saveState = true
        }
        launchSingleTop = true
        restoreState = true
    }
}
```

### 4.3 `rememberAppState` pattern

Wrap `NavController` in a stable class so composables don't hold direct controller references:

```kotlin
@Stable
class MyAppState(val navController: NavHostController) {
    fun navigateToDetail(id: Long, from: NavBackStackEntry) {
        if (from.lifecycleIsResumed()) {
            navController.navigate(DetailRoute(id))
        }
    }
    fun navigateBack() { navController.popBackStack() }
}

@Composable
fun rememberMyAppState(navController: NavHostController = rememberNavController()) =
    remember(navController) { MyAppState(navController) }
```

---

## Part 5 — State Management Utilities (Copy These)

### 5.1 `@Immutable` data class + `ImmutableList`

Use for all UiState classes to prevent unnecessary recompositions:

```kotlin
// Add kotlinx-collections-immutable to deps
// implementation("org.jetbrains.kotlinx:kotlinx-collections-immutable:0.3.7")

@Immutable
data class MyScreenUiState(
    val items: ImmutableList<Item> = persistentListOf(),  // stable list
    val isLoading: Boolean = false,
    val error: String? = null,
)

// In ViewModel:
_state.value = _state.value.copy(
    items = newItems.toPersistentList()
)
```

### 5.2 Sealed `Action` interface for ViewModel events

One entry point for all user events — easier to test and trace:

```kotlin
// Define once per screen
sealed interface MyScreenAction {
    data class ItemClicked(val id: Long) : MyScreenAction
    data object RefreshRequested : MyScreenAction
    data class SearchQueryChanged(val query: String) : MyScreenAction
}

// In ViewModel
fun onAction(action: MyScreenAction) {
    when (action) {
        is MyScreenAction.ItemClicked          -> openDetail(action.id)
        is MyScreenAction.RefreshRequested     -> refresh()
        is MyScreenAction.SearchQueryChanged   -> updateSearch(action.query)
    }
}

// In composable — single callback
MyScreenContent(
    uiState = uiState,
    onAction = viewModel::onAction,
)
```

### 5.3 Internal ViewModel state → sealed public UiState (JetNews pattern)

```kotlin
// Internal raw state (easy to .copy())
private data class MyViewModelState(
    val data: List<Item>? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
) {
    fun toUiState(): MyUiState = when {
        data == null && isLoading -> MyUiState.Loading
        data == null && error != null -> MyUiState.Error(error)
        data != null -> MyUiState.Success(data)
        else -> MyUiState.Loading
    }
}

// Public strongly-typed state
sealed interface MyUiState {
    data object Loading : MyUiState
    data class Error(val message: String) : MyUiState
    data class Success(val data: List<Item>) : MyUiState  // data is non-null guaranteed
}

// Exposed via stateIn
val uiState = viewModelState
    .map(MyViewModelState::toUiState)
    .stateIn(viewModelScope, SharingStarted.Eagerly, viewModelState.value.toUiState())
```

---

## Part 6 — Component Library Blueprint (Jetsnack pattern)

If your app has a custom design system, use Jetsnack's structure as the template:

```
ui/components/
├── Button.kt         — MyAppButton wrapping gradient + custom colors
├── Surface.kt        — MyAppSurface consuming your theme colors
├── Scaffold.kt       — MyAppScaffold with your bottom bar slot
├── Divider.kt        — Branded divider
├── Gradient.kt       — Modifier extensions (copy from Jetsnack)
└── Card.kt           — Themed card wrapper
```

Each wrapper component:
1. Takes the same parameters as the M3 original
2. Defaults to your theme colors (not `MaterialTheme.colorScheme.*`)
3. Has a `@Preview` with both light and dark theme

```kotlin
@Composable
fun MyAppButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    backgroundGradient: List<Color> = MyAppTheme.colors.interactivePrimary,
    contentColor: Color = MyAppTheme.colors.textInteractive,
    content: @Composable RowScope.() -> Unit,
) { /* ... */ }

@Preview("default")
@Preview("dark theme", uiMode = UI_MODE_NIGHT_YES)
@Composable
private fun MyAppButtonPreview() {
    MyAppTheme {
        MyAppButton(onClick = {}) { Text("Click me") }
    }
}
```

---

## Part 7 — What Not to Copy

| File | Why to skip |
|---|---|
| `Jetsnack/ui/components/Snacks.kt` | Domain-specific (snack ordering) — too coupled to Jetsnack model |
| `Jetchat/conversation/UserInput.kt` | Chat-specific input — emoji selector, record button tightly coupled |
| `JetLagged/sleep/JetLaggedTimeGraph.kt` | Custom sleep visualization — highly domain-specific canvas drawing |
| `Jetcaster/mobile/ui/home/HomeViewModel.kt` | Too complex for most apps — 7-flow combine, Hilt, multiple UseCases |
| `Reply/ui/utils/WindowStateUtils.kt` | Only needed for foldable posture detection — most apps don't need this |

---

## Summary — Priority Copy List

Copy these 6 things first — they solve problems in virtually every production app:

1. **`MultipreviewAnnotations.kt`** (JetNews) — multi-device previews in one annotation
2. **`verticalGradientScrim` Modifier** (Jetcaster) — text-over-image readability
3. **`lifecycleIsResumed()` extension** (Jetcaster/Jetsnack) — prevent duplicate navigation
4. **Bottom-nav 3-flag pattern** (Reply/Jetsnack) — correct tab navigation state
5. **`@Immutable` + `ImmutableList` UiState** (Jetcaster) — prevent recomposition issues
6. **Sealed `Action` interface** (Jetcaster) — clean ViewModel event handling
