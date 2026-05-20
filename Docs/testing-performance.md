# Phase 6 — Testing & Performance: How Do They Verify It Works?

---

## Overview

Testing in Compose is split into two layers: UI tests that use the Compose testing APIs (semantic tree-based, no mocking of the UI), and unit tests that test logic in isolation. The samples demonstrate both layers clearly.

| App | UI tests | Unit tests | Fake strategy |
|---|---|---|---|
| **JetLagged** | `createComposeRule` — single screen smoke test | None | Inline fake data |
| **Jetchat** | `createAndroidComposeRule` — swipe, click, keyboard, nav | None | `exampleUiState` inline |
| **Jetsnack** | `createAndroidComposeRule` — full navigation smoke test | None | None |
| **JetNews** | `createAndroidComposeRule` — nav, deep link, snackbar state | None | `BlockingFakePostsRepository`, `FakeInterestsRepository` |
| **Jetcaster** | None | UseCase tests with `runTest` + coroutine test utilities | `TestPodcastStore`, `TestEpisodeStore`, `TestCategoryStore` |

---

## Part 1 — The Two Test Rules

Every test file in these samples uses one of two rules. Choosing the wrong one is the most common mistake.

### 1.1 `createComposeRule` — use when you own the composable

```kotlin
// JetLagged — no Activity context needed, you provide the composable
class AppTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Before
    fun setUp() {
        composeTestRule.setContent {
            JetLaggedTheme {
                JetLaggedScreen()
            }
        }
    }

    @Test
    fun app_launches() {
        composeTestRule.onNodeWithText("JetLagged").assertIsDisplayed()
    }
}
```

**When to use:** You control `setContent {}` yourself — composable-level tests, isolated screen tests.

### 1.2 `createAndroidComposeRule<Activity>` — use when you need a real Activity

```kotlin
// Jetchat — needs an Activity for Fragment + Navigation interop
class NavigationTest {
    @get:Rule
    val composeTestRule = createAndroidComposeRule<NavActivity>()

    @Test
    fun app_launches() {
        assertEquals(getNavController().currentDestination?.id, R.id.nav_home)
    }
}
```

**When to use:** Testing full app navigation, accessing `Activity` context (`activity.getString(...)`), Fragment-hosted Compose.

### Comparison

| | `createComposeRule` | `createAndroidComposeRule<Activity>` |
|---|---|---|
| Controls `setContent` | Yes | No — Activity owns it |
| Needs Activity class | No | Yes |
| Tests full app nav | No | Yes |
| Isolated composable tests | Yes | Possible but overkill |

---

## Part 2 — The Semantic Tree (How Compose Tests Find Things)

Compose tests do **not** use View IDs or XPath. They query the **semantic tree** — an accessibility-friendly representation of your UI.

```kotlin
// Find by text
composeTestRule.onNodeWithText("HOME").assertIsDisplayed()

// Find by content description (for icons with no visible text)
composeTestRule.onNodeWithContentDescription("Open navigation drawer").performClick()

// Find by test tag (explicit — best practice for non-accessible nodes)
composeTestRule.onNodeWithTag(ConversationTestTag).assertIsDisplayed()

// Combined matchers
composeTestRule.onNode(hasText("composers") and isInDrawer()).performClick()

// Multiple matches — use index
composeTestRule.onAllNodes(hasText(manuel.name, substring = true))[0]
    .performScrollTo()
    .performClick()
```

**Key principle:** If a node doesn't appear in the semantic tree, the test can't find it. Use `Modifier.testTag("MyTag")` in production code to expose non-accessible nodes.

### Test tags in production code

```kotlin
// In your composable (production code):
const val ConversationTestTag = "ConversationTest"

LazyColumn(modifier = Modifier.testTag(ConversationTestTag)) { ... }

// In the test:
composeTestRule.onNodeWithTag(ConversationTestTag).assertIsDisplayed()
```

---

## Part 3 — Common UI Interactions

### 3.1 Click, scroll, swipe

```kotlin
// Click
composeTestRule.onNodeWithText("Chips").performClick()

// Scroll to visible, then click (for items in a LazyColumn)
composeTestRule.onAllNodes(hasText(name, substring = true))[0]
    .performScrollTo()
    .performClick()

// Swipe (Jetchat — scroll up to reveal "jump to bottom" button)
composeTestRule.onNodeWithTag(ConversationTestTag).performTouchInput {
    swipe(
        start = center,
        end = Offset(center.x, center.y + 500),
        durationMillis = 200,
    )
}
```

### 3.2 Text input

```kotlin
// Jetchat UserInputTest — type into a text field
findTextInputField().performTextInput("Some text")

// Then verify send button state changes
findSendButton().assertIsEnabled()
```

### 3.3 Wait for async operations

```kotlin
// JetNews — wait until a node appears after navigation
composeTestRule.waitUntilExactlyOneExists(
    hasText("Use Dagger in Kotlin!", substring = true),
    5000L  // timeout in ms
)

// Wait for at least one match
composeTestRule.waitUntilAtLeastOneExists(hasText("Topics"), 5000L)
```

**Why `waitUntil*`?** Navigation and async data loading mean content doesn't appear instantly. These APIs block until the predicate is true or the timeout expires, avoiding flakiness from race conditions.

---

## Part 4 — Snackbar Testing with `snapshotFlow`

JetNews shows the most sophisticated UI test pattern — verifying a `SnackbarHostState` message via Kotlin Flow:

```kotlin
// HomeScreenTests.kt — JetNews
@Test
fun postsContainError_snackbarShown() {
    val snackbarHostState = SnackbarHostState()

    composeTestRule.setContent {
        JetnewsTheme {
            HomeFeedScreen(
                uiState = HomeUiState.NoPosts(
                    isLoading = false,
                    errorMessages = listOf(ErrorMessage(0L, R.string.load_error)),
                    searchInput = "",
                ),
                snackbarHostState = snackbarHostState,
                // ... other params
            )
        }
    }

    runBlocking {
        // snapshotFlow converts Compose State → Kotlin Flow
        val actualSnackbarText = snapshotFlow { snackbarHostState.currentSnackbarData }
            .filterNotNull()
            .first()           // suspend until first non-null value
            .visuals.message
        assertEquals(expectedText, actualSnackbarText)
    }
}
```

**`snapshotFlow`** is the bridge from Compose's `State<T>` world to Kotlin coroutines. It re-emits whenever the state changes — perfect for asserting that a composable side-effect happened (like showing a snackbar).

---

## Part 5 — Faking Dependencies for UI Tests

### 5.1 `TestAppContainer` pattern — JetNews

JetNews replaces the real `AppContainer` (which uses real network calls) with a `TestAppContainer` that uses synchronous fakes:

```kotlin
// TestAppContainer.kt
class TestAppContainer(private val context: Context) : AppContainer {
    override val postsRepository: PostsRepository by lazy {
        BlockingFakePostsRepository()  // synchronous — no network delay
    }
    override val interestsRepository: InterestsRepository by lazy {
        FakeInterestsRepository()
    }
}

// TestHelper.kt — extension to launch the app with fakes
fun ComposeContentTestRule.launchJetNewsApp(context: Context) {
    setContent {
        JetnewsApp(
            appContainer = TestAppContainer(context),
            isBackEnabled = true,
            initialBackStack = listOf(HomeKey),
        )
    }
}

// In the test:
@Before
fun setUp() {
    composeTestRule.launchJetNewsApp(ApplicationProvider.getApplicationContext())
}
```

**Key design:** `BlockingFakePostsRepository` returns data synchronously (no `delay(800)`) unlike `FakePostsRepository` which simulates network lag. This prevents flaky tests caused by timing differences.

### 5.2 Inline fake data (Jetchat pattern)

For simpler tests without DI, pass state directly:

```kotlin
// ConversationTest.kt — no DI, just pass fake UiState directly
composeTestRule.setContent {
    JetchatTheme {
        ConversationContent(
            uiState = conversationTestUiState,  // inline fake
            navigateToProfile = { },
            onNavIconPressed = { },
        )
    }
}

// Build test data inline:
private val conversationTestUiState = ConversationUiState(
    initialMessages = exampleUiState.messages + exampleUiState.messages,  // double for scroll room
    channelName = "#composers",
    channelMembers = 42,
)
```

---

## Part 6 — Unit Tests for Business Logic (Jetcaster)

Jetcaster is the only app with unit tests, and it shows the right way to test UseCases with coroutines.

### 6.1 `runTest` for coroutine-based logic

```kotlin
// PodcastCategoryFilterUseCaseTest.kt
class PodcastCategoryFilterUseCaseTest {

    private val categoriesStore = TestCategoryStore()
    val useCase = PodcastCategoryFilterUseCase(categoryStore = categoriesStore)

    @Test
    fun whenCategoryNull_emptyFlow() = runTest {
        val resultFlow = useCase(null)

        // Emit data into the fake store AFTER collecting
        categoriesStore.setEpisodesFromPodcast(testCategory.id, testEpisodeToPodcast)
        categoriesStore.setPodcastsInCategory(testCategory.id, testPodcasts)

        val result = resultFlow.first()
        assertTrue(result.topPodcasts.isEmpty())
        assertTrue(result.episodes.isEmpty())
    }

    @Test
    fun whenCategoryInfoNotNull_verifyLimitFlow() = runTest {
        val resultFlow = useCase(testCategory.asExternalModel())

        // 8x episodes, 4x podcasts → UseCase should cap at 20 episodes, 10 podcasts
        categoriesStore.setEpisodesFromPodcast(testCategory.id, List(8) { testEpisodeToPodcast }.flatten())
        categoriesStore.setPodcastsInCategory(testCategory.id, List(4) { testPodcasts }.flatten())

        val result = resultFlow.first()
        assertEquals(20, result.episodes.size)
        assertEquals(10, result.topPodcasts.size)
    }
}
```

**`runTest` replaces `runBlocking` for coroutine tests** — it uses a `TestCoroutineScheduler` that makes virtual time advance instantly, so you never have real delays in tests.

### 6.2 Test repositories — `MutableStateFlow` pattern

Jetcaster's test repositories use `MutableStateFlow` to expose controllable data streams:

```kotlin
// TestPodcastStore.kt — in core/data-testing/
class TestPodcastStore : PodcastStore {
    private val podcastFlow = MutableStateFlow<List<Podcast>>(listOf())
    private val followedPodcasts = mutableSetOf<String>()

    override fun podcastsSortedByLastEpisode(limit: Int): Flow<List<PodcastWithExtraInfo>> =
        podcastFlow.map { podcasts ->
            podcasts.map { p ->
                PodcastWithExtraInfo().apply {
                    podcast = p
                    isFollowed = followedPodcasts.contains(p.uri)
                }
            }
        }

    override suspend fun addPodcast(podcast: Podcast) = podcastFlow.update { it + podcast }
    override suspend fun togglePodcastFollowed(podcastUri: String) { /* toggle logic */ }
}
```

**Why `MutableStateFlow` in test repos?**
- Test controls exactly what data the UseCase sees
- Flow-based — matches production interface
- No threading issues (StateFlow is thread-safe)
- `update {}` makes state changes atomic

### 6.3 Testing Flow ordering

```kotlin
// GetLatestFollowedEpisodesUseCaseTest.kt
@Test
fun whenFollowedPodcasts_sortedByPublished() = runTest {
    val result = useCase()

    episodeStore.addEpisodes(testEpisodes)  // dates: MIN, now(), MAX
    testPodcasts.forEach { podcastStore.addPodcast(it.podcast) }
    podcastStore.togglePodcastFollowed(testPodcasts[0].podcast.uri)

    // Verify descending sort
    result.first().zipWithNext { ep1, ep2 ->
        ep1.episode.published > ep2.episode.published
    }.all { it }
}
```

---

## Part 7 — Navigation Testing

### 7.1 Testing Fragment + Compose navigation (Jetchat)

Jetchat uses Fragment-based Navigation with Compose screens inside. Tests interact via both NavController and semantic tree:

```kotlin
// NavigationTest.kt — Jetchat
@Test
fun profileScreen_back_conversationScreen() {
    val navController = getNavController()
    navigateToProfile("Taylor Brooks")
    assertEquals(navController.currentDestination?.id, R.id.nav_profile)

    Espresso.pressBack()  // Espresso back — works for Fragment nav

    assertEquals(navController.currentDestination?.id, R.id.nav_home)
}

// Custom semantic matcher for drawer items
private fun isInDrawer() = hasAnyAncestor(isDrawer())
private fun isDrawer() = SemanticsMatcher.expectValue(
    SemanticsProperties.PaneTitle,
    activity.getString(androidx.compose.ui.R.string.navigation_menu),
)
```

**`SemanticsMatcher`** lets you build custom predicates over any semantic property — here used to filter clicks to only items inside the navigation drawer, preventing accidental matches with other nodes that have the same text.

### 7.2 Regression test — back stack overflow (Jetchat)

```kotlin
// Regression test for GitHub issue #670
@Test
fun drawer_conversationScreen_backstackPopUp() {
    navigateToProfile("Ali Conors (you)")
    navigateToHome()
    navigateToProfile("Taylor Brooks")
    navigateToHome()

    // Verify we're home and back stack is clean
    assertEquals(getNavController().currentDestination?.id, R.id.nav_home)
}
```

This is the value of navigation tests — they catch back-stack accumulation bugs that only appear after multiple navigation sequences.

---

## Part 8 — Theme Change Persistence Test

```kotlin
// ConversationTest.kt — changeTheme_scrollIsPersisted
private val themeIsDark = MutableStateFlow(false)

@Before
fun setUp() {
    composeTestRule.setContent {
        JetchatTheme(isDarkTheme = themeIsDark.collectAsStateWithLifecycle(false).value) {
            ConversationContent(uiState = conversationTestUiState, ...)
        }
    }
}

@Test
fun changeTheme_scrollIsPersisted() {
    // Scroll up to show "Jump to Bottom" button
    composeTestRule.onNodeWithTag(ConversationTestTag).performTouchInput {
        swipe(start = center, end = Offset(center.x, center.y + 500), durationMillis = 200)
    }
    findJumpToBottom().assertIsDisplayed()

    // Change theme — triggers full recomposition
    themeIsDark.value = true

    // Scroll position should survive recomposition
    findJumpToBottom().assertIsDisplayed()
}
```

**Why this test matters:** Changing `themeIsDark` triggers a full recomposition. If `rememberLazyListState()` wasn't remembered properly, the list would snap to bottom, hiding the button. This test catches state-loss-on-recompose bugs.

---

## Summary — Testing Decision Tree

```
Testing a single composable in isolation?
  → createComposeRule + setContent {}

Testing the full app with navigation?
  → createAndroidComposeRule<MainActivity>

Need to control data the composable receives?
  → Pass UiState directly (Jetchat pattern) or
  → TestAppContainer with blocking fakes (JetNews pattern)

Testing UseCase / repository logic?
  → runTest + TestRepository (MutableStateFlow pattern, Jetcaster)

Waiting for async content to appear?
  → waitUntilExactlyOneExists() / waitUntilAtLeastOneExists()

Testing state survives recomposition?
  → Use a MutableStateFlow to trigger recomposition, assert state unchanged
```

---

## What Each App Contributes

| Pattern | Best source | Key file |
|---|---|---|
| `createComposeRule` smoke test | JetLagged | `AppTest.kt` |
| Navigation smoke test (all tabs) | Jetsnack | `AppTest.kt` |
| Snackbar via `snapshotFlow` | JetNews | `HomeScreenTests.kt` |
| TestAppContainer (DI replacement) | JetNews | `TestAppContainer.kt` |
| Swipe + `waitUntil*` | JetNews | `JetnewsTests.kt` |
| Gesture testing (swipe, emoji) | Jetchat | `ConversationTest.kt`, `UserInputTest.kt` |
| Fragment nav + `SemanticsMatcher` | Jetchat | `NavigationTest.kt` |
| UseCase unit test + `runTest` | Jetcaster | `PodcastCategoryFilterUseCaseTest.kt` |
| `MutableStateFlow` test repos | Jetcaster | `TestPodcastStore.kt`, `TestEpisodeStore.kt` |
| Recomposition persistence | Jetchat | `ConversationTest.changeTheme_scrollIsPersisted` |
