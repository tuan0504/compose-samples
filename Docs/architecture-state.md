# Phase 3 — Architecture & State: How Does Data Flow?

---

## Overview

All six apps follow **MVVM** (Model-View-ViewModel) using Jetpack ViewModel + Kotlin StateFlow. The differences lie in how complex the state model is, how many flows are combined, and whether a domain (UseCase) layer sits between repository and ViewModel.

| App | UiState style | Flow complexity | Domain layer | DI |
|---|---|---|---|---|
| **JetLagged** | `data class` (static) | None — no flows | No | No |
| **Reply** | `data class` + `.copy()` | Single flow (emails) | No | No |
| **JetNews** | `sealed interface` (NoPosts / HasPosts) | 2 flows combined | No | Manual factory |
| **Jetchat** | Simple `data class` | SharedFlow for events | No | No |
| **Jetsnack** | Local state + `StateFlow` per screen | Medium | No | No |
| **Jetcaster** | `@Immutable data class` + `sealed interface` actions | 7 flows combined | Yes (UseCases) | Hilt |

---

## Part 1 — The Core Pattern (All Apps)

Every app follows the same 4-step data flow:

```
Repository / Data source
        ↓  (Flow / suspend fun)
    ViewModel
        ↓  (StateFlow<UiState>)
  collectAsStateWithLifecycle()
        ↓  (State<UiState>)
   Composable (renders UI)
        ↓  (user event / callback)
   ViewModel event handler
        ↓  (updates MutableStateFlow)
  [cycle repeats]
```

The key rule: **composables never own business logic**. They observe state and fire events upward.

---

## Part 2 — UiState Modelling Patterns

### Pattern 1 — Static data class (JetLagged — simplest)

```kotlin
// JetLaggedHomeScreenViewModel.kt
class JetLaggedHomeScreenViewModel : ViewModel() {
    val uiState: StateFlow<JetLaggedHomeScreenState> =
        MutableStateFlow(JetLaggedHomeScreenState())
}
```

No repository, no flow collection — state is created once and never changes. Good baseline to understand the shape of the pattern before complexity is added.

---

### Pattern 2 — Mutable data class with `.copy()` (Reply — medium)

```kotlin
// ReplyHomeViewModel.kt
private val _uiState = MutableStateFlow(ReplyHomeUIState(loading = true))
val uiState: StateFlow<ReplyHomeUIState> = _uiState

private fun observeEmails() {
    viewModelScope.launch {
        emailsRepository.getAllEmails()
            .catch { ex -> _uiState.value = ReplyHomeUIState(error = ex.message) }
            .collect { emails ->
                _uiState.value = ReplyHomeUIState(
                    emails = emails,
                    openedEmail = emails.first(),
                )
            }
    }
}

// UiState — plain data class, all fields optional/nullable
data class ReplyHomeUIState(
    val emails: List<Email> = emptyList(),
    val selectedEmails: Set<Long> = emptySet(),
    val openedEmail: Email? = null,
    val isDetailOnlyOpen: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
)
```

State updates use `.copy()` to immutably change individual fields:

```kotlin
fun setOpenedEmail(emailId: Long, contentType: ReplyContentType) {
    val email = uiState.value.emails.find { it.id == emailId }
    _uiState.value = _uiState.value.copy(
        openedEmail = email,
        isDetailOnlyOpen = contentType == ReplyContentType.SINGLE_PANE,
    )
}
```

**When to use:** When all screen states share the same fields (loading, error, data all co-exist on the same class).

---

### Pattern 3 — Internal ViewModel state → public sealed UiState (JetNews — advanced)

JetNews separates *internal raw state* from the *public typed state* exposed to the UI:

```kotlin
// Internal — raw, mutable, easy to update
private data class HomeViewModelState(
    val postsFeed: PostsFeed? = null,
    val favorites: Set<String> = emptySet(),
    val isLoading: Boolean = false,
    val errorMessages: List<ErrorMessage> = emptyList(),
    val searchInput: String = "",
) {
    // Converts to the strongly-typed public state
    fun toUiState(): HomeUiState = if (postsFeed == null) {
        HomeUiState.NoPosts(isLoading, errorMessages, searchInput)
    } else {
        HomeUiState.HasPosts(postsFeed, favorites, isLoading, errorMessages, searchInput)
    }
}

// Public — sealed, the UI exhausts all cases with `when`
sealed interface HomeUiState {
    val isLoading: Boolean
    val errorMessages: List<ErrorMessage>
    val searchInput: String

    data class NoPosts(
        override val isLoading: Boolean,
        override val errorMessages: List<ErrorMessage>,
        override val searchInput: String,
    ) : HomeUiState

    data class HasPosts(
        val postsFeed: PostsFeed,
        val favorites: Set<String>,
        override val isLoading: Boolean,
        override val errorMessages: List<ErrorMessage>,
        override val searchInput: String,
    ) : HomeUiState
}

// In ViewModel — map internal → public with stateIn
val uiState = viewModelState
    .map(HomeViewModelState::toUiState)
    .stateIn(viewModelScope, SharingStarted.Eagerly, viewModelState.value.toUiState())
```

The UI then uses:

```kotlin
when (val uiState = viewModel.uiState.collectAsStateWithLifecycle().value) {
    is HomeUiState.NoPosts -> LoadingOrErrorScreen(uiState)
    is HomeUiState.HasPosts -> PostListScreen(uiState.postsFeed)
}
```

**Why:** `HasPosts` guarantees `postsFeed` is non-null at compile time. No `postsFeed?.let { }` defensive coding needed in composables.

---

### Pattern 4 — @Immutable data class + sealed Action interface (Jetcaster — most structured)

```kotlin
// UiState — @Immutable tells the Compose compiler this won't change unexpectedly
@Immutable
data class HomeScreenUiState(
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val featuredPodcasts: ImmutableList<PodcastInfo> = persistentListOf(),
    val selectedHomeCategory: HomeCategory = HomeCategory.Discover,
    val homeCategories: List<HomeCategory> = emptyList(),
    val filterableCategoriesModel: FilterableCategoriesModel = FilterableCategoriesModel(),
    val podcastCategoryFilterResult: PodcastCategoryFilterResult = PodcastCategoryFilterResult(),
    val library: LibraryInfo = LibraryInfo(),
)

// All user events as a sealed interface — one entry point into the ViewModel
@Immutable
sealed interface HomeAction {
    data class CategorySelected(val category: CategoryInfo) : HomeAction
    data class HomeCategorySelected(val category: HomeCategory) : HomeAction
    data class PodcastUnfollowed(val podcast: PodcastInfo) : HomeAction
    data class TogglePodcastFollowed(val podcast: PodcastInfo) : HomeAction
    data class LibraryPodcastSelected(val podcast: PodcastInfo?) : HomeAction
    data class QueueEpisode(val episode: PlayerEpisode) : HomeAction
    data class RemoveEpisode(val episodeInfo: EpisodeInfo) : HomeAction
}

// Single dispatch function — composables call onHomeAction(action)
fun onHomeAction(action: HomeAction) {
    when (action) {
        is HomeAction.CategorySelected     -> onCategorySelected(action.category)
        is HomeAction.HomeCategorySelected -> onHomeCategorySelected(action.category)
        is HomeAction.QueueEpisode         -> onQueueEpisode(action.episode)
        // ...
    }
}
```

**Why `@Immutable`:** Tells the Compose compiler it can skip recomposition when the state reference hasn't changed. Without it, the compiler conservatively recomposes on every emission.

**Why `ImmutableList` (kotlinx.collections.immutable):** Standard `List<T>` is not stable in Compose's eyes (it's an interface). `ImmutableList` has a stable contract — no surprise recompositions.

---

## Part 3 — Flow Combination (Jetcaster)

Jetcaster's ViewModel combines **7 StateFlows** into a single UiState using a custom `combine` utility:

```kotlin
// HomeViewModel.kt
init {
    viewModelScope.launch {
        com.example.jetcaster.core.util.combine(
            homeCategories,            // Flow 1: available tabs
            selectedHomeCategory,      // Flow 2: selected tab
            subscribedPodcasts,        // Flow 3: followed podcasts
            refreshing,                // Flow 4: loading indicator
            _selectedCategory.flatMapLatest { filterableCategoriesUseCase(it) },   // Flow 5: categories
            _selectedCategory.flatMapLatest { podcastCategoryFilterUseCase(it) },  // Flow 6: filtered podcasts
            subscribedPodcasts.flatMapLatest { podcasts ->
                episodeStore.episodesInPodcasts(podcasts.map { it.podcast.uri }, 20)
            },                         // Flow 7: library episodes
        ) { homeCategories, homeCategory, podcasts, refreshing,
            filterableCategories, podcastCategoryFilterResult, libraryEpisodes ->

            HomeScreenUiState(
                isLoading = refreshing,
                featuredPodcasts = podcasts.map { it.asExternalModel() }.toPersistentList(),
                // ...
            )
        }.catch { throwable ->
            emit(HomeScreenUiState(isLoading = false, errorMessage = throwable.message))
        }.collect {
            _state.value = it
        }
    }
}
```

Key techniques:
- `flatMapLatest` — when the selected category changes, cancel the previous inner flow and start a new one
- `.catch { }` — error recovery at the combine level, converts exceptions into error UiState
- `SharingStarted.WhileSubscribed()` — upstream flows only active when UI is collecting

---

## Part 4 — Repository Pattern

### Simple (Reply)

```kotlin
// Interface
interface EmailsRepository {
    fun getAllEmails(): Flow<List<Email>>
}

// Implementation
class EmailsRepositoryImpl : EmailsRepository {
    override fun getAllEmails(): Flow<List<Email>> = flow {
        emit(LocalEmailsDataProvider.allEmails)
    }
}
```

Repository hides the data source. ViewModel doesn't know if data comes from a database, network, or static list.

### Layered with UseCases (Jetcaster)

```kotlin
// UseCase sits between repository and ViewModel
class FilterableCategoriesUseCase @Inject constructor(
    private val categoryStore: CategoryStore,
    private val podcastStore: PodcastStore,
) {
    operator fun invoke(selectedCategory: CategoryInfo?): Flow<FilterableCategoriesModel> =
        combine(
            categoryStore.categoriesSortedByPodcastCount(),
            podcastStore.followedPodcastsSortedByLastEpisode(),
        ) { categories, podcasts -> /* transform */ }
}
```

UseCases let you:
- Unit-test the transformation logic independently
- Reuse the same data-fetching logic in multiple ViewModels (mobile + TV share the same UseCase)

---

## Part 5 — Consuming State in Composables

### The correct way (lifecycle-aware)

```kotlin
// In composable
val uiState by viewModel.uiState.collectAsStateWithLifecycle()
```

`collectAsStateWithLifecycle()` — stops collecting when the composable is not visible (lifecycle below `STARTED`). Prevents background work for off-screen screens.

### Side effects

```kotlin
// LaunchedEffect — run a coroutine tied to the composable lifecycle
LaunchedEffect(key1 = errorMessage) {
    if (errorMessage != null) {
        snackbarHostState.showSnackbar(errorMessage)
        viewModel.errorShown(errorMessage.id)
    }
}

// SideEffect — run after every successful recomposition (no coroutine)
SideEffect {
    systemUiController.setSystemBarsColor(color = backgroundColor)
}
```

**Rule:** Never launch coroutines inside `@Composable` functions directly. Use `LaunchedEffect` or `rememberCoroutineScope`.

---

## Part 6 — Key Questions Answered

| Question | Answer from source |
|---|---|
| How many ViewModels per screen? | One ViewModel per screen, never shared across screens |
| How is state exposed? | Always `StateFlow<UiState>` — never raw `MutableStateFlow` public |
| How does the UI send events? | Via callback lambdas or a sealed `Action` interface |
| How is error handled? | As a field inside UiState (`error: String?`) — not thrown or caught in composables |
| When does collection stop? | `collectAsStateWithLifecycle()` stops at `STARTED` lifecycle — no background leaks |
| How are multiple flows merged? | `combine()` / `flatMapLatest()` inside `viewModelScope.launch {}` |

---

## Summary — Which Pattern to Use

```
Is your screen data static / one-time?
  YES → Simple MutableStateFlow(initialState) — no collection needed (JetLagged)

Do all states share the same fields (loading + data + error all together)?
  YES → data class UiState + .copy() updates (Reply)

Are some fields only valid in certain states?
  YES → sealed interface UiState (JetNews — HasPosts guarantees non-null postsFeed)

Do you have many user events going to one ViewModel?
  YES → sealed interface Action + single dispatch function (Jetcaster)

Do you need to combine 3+ independent data sources?
  YES → combine() inside viewModelScope, flatMapLatest for dependent flows (Jetcaster)

Do you share logic across multiple ViewModels (mobile + TV)?
  YES → Extract to UseCase (Jetcaster's FilterableCategoriesUseCase)
```
