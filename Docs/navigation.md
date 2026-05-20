# Phase 4 — Navigation: How Do Screens Connect?

---

## Overview

Navigation in Compose can be done in several ways. The samples cover the full spectrum — from no navigation at all (single screen) to adaptive navigation that changes its component based on window size.

| App | Navigation approach | Screens | Adaptive |
|---|---|---|---|
| **JetLagged** | None — single screen | 1 | No |
| **Jetchat** | Standard `NavHost` + Fragment interop | 2 | No |
| **Jetsnack** | `NavHost` + custom `JetsnackNavController` wrapper | 3 (home tabs + detail) | No |
| **Reply** | `NavHost` + type-safe routes + `NavigationSuiteScaffold` | 4 | Yes (phone/tablet/foldable) |
| **JetNews** | Custom `NavigationState` (Navigation 3 library) | 2 + detail pane | Yes (drawer/rail) |
| **Jetcaster** | `NavHost` + `AppState` class per form factor | Mobile: 3, TV: 6, Wear: custom | Yes (multi form factor) |

---

## Part 1 — Standard NavHost Pattern

The most common pattern: `rememberNavController()` + `NavHost` + `composable<Route>` blocks.

### Reply — Type-Safe Routes (modern approach)

Reply uses **type-safe routes** with `@Serializable` data objects — no string typos:

```kotlin
// ReplyNavigationActions.kt
sealed interface Route {
    @Serializable data object Inbox          : Route
    @Serializable data object Articles       : Route
    @Serializable data object DirectMessages : Route
    @Serializable data object Groups         : Route
}
```

Navigation is encapsulated in a `ReplyNavigationActions` class — composables don't touch `NavController` directly:

```kotlin
class ReplyNavigationActions(private val navController: NavHostController) {
    fun navigateTo(destination: ReplyTopLevelDestination) {
        navController.navigate(destination.route) {
            popUpTo(navController.graph.findStartDestination().id) {
                saveState = true   // preserve scroll position / form state
            }
            launchSingleTop = true  // no duplicate copies of same screen
            restoreState = true     // restore state on re-selection
        }
    }
}
```

Three flags used together on every bottom-nav tap:
- `popUpTo(...) { saveState = true }` — pop back to start, save the popped screens' state
- `launchSingleTop = true` — don't create a second copy if already on that screen
- `restoreState = true` — reload the saved state when navigating back

The `NavHost` in Reply:

```kotlin
// ReplyApp.kt
NavHost(
    navController = navController,
    startDestination = Route.Inbox,
) {
    composable<Route.Inbox> {
        ReplyInboxScreen(/* ... */)
    }
    composable<Route.DirectMessages> { EmptyComingSoon() }
    composable<Route.Articles>       { EmptyComingSoon() }
    composable<Route.Groups>         { EmptyComingSoon() }
}
```

---

## Part 2 — AppState Class Pattern (Jetcaster / Jetsnack)

Both Jetcaster and Jetsnack wrap `NavHostController` inside their own class so navigation logic is tested independently from composables.

### Jetcaster — AppState with online check + URI encoding

```kotlin
// JetcasterAppState.kt
sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Player : Screen("player/{$ARG_EPISODE_URI}") {
        fun createRoute(episodeUri: String) = "player/$episodeUri"
    }
    object PodcastDetails : Screen("podcast/{$ARG_PODCAST_URI}") {
        fun createRoute(podcastUri: String) = "podcast/$podcastUri"
    }
}

class JetcasterAppState(val navController: NavHostController, private val context: Context) {
    var isOnline by mutableStateOf(checkIfOnline())
        private set

    fun navigateToPlayer(episodeUri: String, from: NavBackStackEntry) {
        // De-duplicate: only navigate if the caller's screen is still RESUMED
        if (from.lifecycleIsResumed()) {
            val encodedUri = Uri.encode(episodeUri)  // handle special chars in URI
            navController.navigate(Screen.Player.createRoute(encodedUri))
        }
    }

    fun navigateBack() { navController.popBackStack() }
}

// Remember pattern — stable across recompositions
@Composable
fun rememberJetcasterAppState(navController: NavHostController = rememberNavController()) =
    remember(navController) { JetcasterAppState(navController, LocalContext.current) }
```

**Critical technique — `lifecycleIsResumed()` de-duplication:**

```kotlin
private fun NavBackStackEntry.lifecycleIsResumed() =
    this.lifecycle.currentState == Lifecycle.State.RESUMED
```

Without this check, tapping a list item quickly can fire two navigation events before the first completes, pushing the same screen twice onto the back stack. The guard discards the second tap because the `NavBackStackEntry` is already `STARTED` (not `RESUMED`) once navigation begins.

### Jetsnack — Custom controller with bottom-tab state management

```kotlin
// JetsnackNavController.kt
@Stable
class JetsnackNavController(val navController: NavHostController) {

    fun navigateToBottomBarRoute(route: String) {
        if (route != navController.currentDestination?.route) {  // skip if already there
            navController.navigate(route) {
                launchSingleTop = true
                restoreState = true
                popUpTo(findStartDestination(navController.graph).id) {
                    saveState = true
                }
            }
        }
    }

    fun navigateToSnackDetail(snackId: Long, origin: String, from: NavBackStackEntry) {
        if (from.lifecycleIsResumed()) {
            navController.navigate("${MainDestinations.SNACK_DETAIL_ROUTE}/$snackId?origin=$origin")
        }
    }
}
```

`@Stable` annotation on the class tells Compose the wrapper is stable — composables that receive it as a parameter won't recompose unnecessarily.

---

## Part 3 — Adaptive Navigation (Reply)

Reply's biggest navigation feature: the same destinations render different navigation chrome depending on screen size, using `NavigationSuiteScaffold` from Material 3 Adaptive.

```kotlin
// ReplyApp.kt
private fun NavigationSuiteType.toReplyNavType() = when (this) {
    NavigationSuiteType.NavigationBar    -> ReplyNavigationType.BOTTOM_NAVIGATION
    NavigationSuiteType.NavigationRail   -> ReplyNavigationType.NAVIGATION_RAIL
    NavigationSuiteType.NavigationDrawer -> ReplyNavigationType.PERMANENT_NAVIGATION_DRAWER
    else -> ReplyNavigationType.BOTTOM_NAVIGATION
}
```

And the content type changes (single vs dual pane):

```kotlin
val contentType = when (windowSize.widthSizeClass) {
    WindowWidthSizeClass.Compact  -> ReplyContentType.SINGLE_PANE
    WindowWidthSizeClass.Medium   -> if (foldingDevicePosture != DevicePosture.NormalPosture)
                                         ReplyContentType.DUAL_PANE
                                     else ReplyContentType.SINGLE_PANE
    WindowWidthSizeClass.Expanded -> ReplyContentType.DUAL_PANE
    else                          -> ReplyContentType.SINGLE_PANE
}
```

**Result:**
- Compact (phone) → `BottomNavigationBar` + single pane content
- Medium (tablet portrait) → `NavigationRail` + single or dual pane
- Expanded (tablet landscape, desktop) → `PermanentNavigationDrawer` + dual pane (list + detail always visible)

Foldable detection:

```kotlin
val foldingFeature = displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull()

val foldingDevicePosture = when {
    isBookPosture(foldingFeature)  -> DevicePosture.BookPosture(foldingFeature.bounds)
    isSeparating(foldingFeature)   -> DevicePosture.Separating(foldingFeature.bounds, foldingFeature.orientation)
    else                           -> DevicePosture.NormalPosture
}
```

---

## Part 4 — Custom Navigation State (JetNews — Navigation 3)

JetNews uses the experimental **Navigation 3** library instead of `NavHost`. It manages a back-stack of `NavKey` objects rather than string routes:

```kotlin
// JetnewsApp.kt — no NavHost, no NavController
val navigationState = rememberNavigationState(
    primaryTopLevelKey = HomeKey,
    topLevelKeys = setOf(HomeKey, InterestsKey),
    initialBackStack = initialBackStack,
)

val navigator = remember(navigationState) { Navigator(navigationState) }

// Navigate with type-safe keys
navigator.navigate(navKey, PopUpTo(navKey))
navigator.goUp()
```

Adaptive layout: if screen is expanded, `AppNavRail` is shown permanently; otherwise `ModalNavigationDrawer`:

```kotlin
Row {
    if (isExpandedScreen) {
        AppNavRail(
            currentTopLevelKey = navigationState.topLevelKey,
            navigate = { navKey -> navigator.navigate(navKey) },
        )
    }
    JetnewsNavDisplay(
        navigationState = navigationState,
        navigator = navigator,
        // ...
    )
}
```

`rememberSizeAwareDrawerState` pattern:

```kotlin
@Composable
private fun rememberSizeAwareDrawerState(isExpandedScreen: Boolean): DrawerState {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    return if (!isExpandedScreen) drawerState
    else DrawerState(DrawerValue.Closed)  // lock closed on expanded — not remembered
}
```

> **Note:** Navigation 3 is not yet stable. Jetsnack/Reply/Jetcaster use the stable `NavHost` API which is the safe production choice today.

---

## Part 5 — Deep Links

JetNews implements deep link handling with a custom matcher — more flexible than NavHost's built-in deep links:

```kotlin
// DeepLinkMatcher.kt — custom route → NavKey mapping
// DeepLinkPattern.kt — URI pattern with {param} placeholders
// DeepLinkRequest.kt — parsed request with extracted params
// KeyDecoder.kt      — maps pattern → NavKey
```

This lets JetNews handle deep links from notifications/widgets without the back-stack complications of NavHost deep links.

---

## Part 6 — Navigation Comparison Table

| Feature | JetNews | Jetsnack | Jetcaster | Reply |
|---|---|---|---|---|
| Library | Navigation 3 (experimental) | NavHost (stable) | NavHost (stable) | NavHost (stable) |
| Route type | `NavKey` objects | String constants | `sealed class Screen` | `@Serializable` data objects |
| Controller wrapper | `Navigator` class | `JetsnackNavController` | `JetcasterAppState` | `ReplyNavigationActions` |
| Back-stack de-duplication | `PopUpTo` | `lifecycleIsResumed()` | `lifecycleIsResumed()` | `launchSingleTop` |
| Adaptive nav | Rail vs Drawer | None | WindowSizeClass (TV) | `NavigationSuiteScaffold` |
| Deep links | Custom matcher | None | None | None |

---

## Part 7 — Key Rules to Follow

### 1. Never put NavController in ViewModel
`NavController` is a UI concern. Putting it in a ViewModel creates lifecycle issues and makes testing harder. Pass navigation callbacks as lambdas from the composable layer.

### 2. Always guard rapid navigation events
```kotlin
// ❌ BAD — double-tap pushes screen twice
onClick = { navController.navigate(route) }

// ✅ GOOD — check lifecycle state before navigating
onClick = { if (backStackEntry.lifecycleIsResumed()) navController.navigate(route) }
```

### 3. Use the three bottom-nav flags together
```kotlin
navController.navigate(route) {
    popUpTo(startDestination) { saveState = true }
    launchSingleTop = true
    restoreState = true
}
```
Missing any one of these creates bugs: accumulating back stack entries, losing scroll position, or creating duplicate screen instances.

### 4. Use type-safe routes (Reply pattern) for new code
String routes (`"home"`, `"snack/{id}"`) have no compile-time safety. `@Serializable data object Inbox : Route` catches typos at compile time and makes refactoring safe.

### 5. Encode URIs for path arguments
```kotlin
// ❌ Breaks if podcastUri contains "/" or special chars
navController.navigate("podcast/$podcastUri")

// ✅ Always encode
navController.navigate("podcast/${Uri.encode(podcastUri)}")
```

---

## Summary

```
Single screen app?
  → No navigation needed (JetLagged)

Standard multi-screen, no adaptive?
  → NavHost + @Serializable routes + NavigationActions class

Need bottom-tab navigation with state preservation?
  → Add the three flags: popUpTo + launchSingleTop + restoreState

Navigation events can fire twice (lists with fast taps)?
  → lifecycleIsResumed() guard on every navigateTo call

Adaptive layout (phone + tablet + foldable)?
  → WindowSizeClass → NavigationSuiteScaffold (Reply pattern)

Multiple form factors (mobile + TV + Wear)?
  → Separate NavHost per form factor, shared AppState class
```
