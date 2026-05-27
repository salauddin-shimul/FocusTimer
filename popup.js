document.addEventListener('DOMContentLoaded', () => {
	const timerPanel = document.querySelector('.timer-panel');
	const timerDisplay = document.querySelector('.timer-display');
	const timerEditorLabel = document.querySelector('#timer-editor-label');
	const timerMinutesInput = document.querySelector('#timer-minutes');
	const timerSetButton = document.querySelector('.timer-set-button');
	const modeIndicator = document.querySelector('.mode-indicator');
	const startButton = document.querySelector('.timer-action--start');
	const pauseButton = document.querySelector('.timer-action--pause');
	const stopButton = document.querySelector('.timer-action--stop');
	const addTabButtons = document.querySelectorAll('.add-tab-button');
	const workTabSelect = document.querySelector('#work-tab-select');
	const playTabSelect = document.querySelector('#play-tab-select');
	const workTabList = document.querySelector('.tab-group--work .tab-list');
	const playTabList = document.querySelector('.tab-group--play .tab-list');

	const requiredElements = [
		timerPanel,
		timerDisplay,
		timerEditorLabel,
		timerMinutesInput,
		timerSetButton,
		modeIndicator,
		startButton,
		pauseButton,
		stopButton,
		workTabSelect,
		playTabSelect,
		workTabList,
		playTabList,
	];

	if (requiredElements.some((element) => !element)) {
		console.warn('Focus Timer: popup markup is missing required elements.');
		return;
	}

	const defaultWorkDurationSeconds = 25 * 60;
	const defaultPlayDurationSeconds = 5 * 60;
	const maxMinutes = 180;

	let workDurationSeconds = defaultWorkDurationSeconds;
	let playDurationSeconds = defaultPlayDurationSeconds;
	let timerSeconds = defaultWorkDurationSeconds;
	let timerRunning = false;
	let currentMode = 'work';
	let workTabs = [];
	let playTabs = [];
	let availableTabs = [];

	function hasChromeTabsApi() {
		return Boolean(globalThis.chrome?.tabs?.query);
	}

	function normalizeTabEntry(tab) {
		if (typeof tab === 'string') {
			return {
				title: tab,
				url: tab,
			};
		}

		return {
			title: tab?.title || tab?.url || 'Untitled tab',
			url: tab?.url || '',
		};
	}

	function formatTime(totalSeconds) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;

		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	function currentDurationSeconds() {
		return currentMode === 'work' ? workDurationSeconds : playDurationSeconds;
	}

	function updateTimerDisplay() {
		timerDisplay.textContent = formatTime(timerSeconds);
	}

	function updateModeIndicator() {
		const isWorkMode = currentMode === 'work';
		modeIndicator.textContent = isWorkMode ? 'Work Mode' : 'Play Mode';
		modeIndicator.classList.toggle('mode-indicator--work', isWorkMode);
		modeIndicator.classList.toggle('mode-indicator--play', !isWorkMode);
	}

	function updateActionButtons() {
		const actionLabel = currentMode === 'work' ? 'Work' : 'Play';
		startButton.textContent = `Start ${actionLabel}`;
		pauseButton.textContent = `Pause ${actionLabel}`;
		stopButton.textContent = `Stop ${actionLabel}`;
		timerPanel.classList.toggle('timer-panel--running', timerRunning);
	}

	function updateTimerEditor() {
		const minutesValue = Math.max(1, Math.round(currentDurationSeconds() / 60));

		if (document.activeElement !== timerMinutesInput) {
			timerMinutesInput.value = String(minutesValue);
		}

		timerEditorLabel.textContent = `${currentMode === 'work' ? 'Work' : 'Play'} length (minutes)`;
		timerMinutesInput.disabled = timerRunning;
		timerSetButton.disabled = timerRunning;
	}

	function renderTabList(listElement, tabs, mode) {
		listElement.textContent = '';

		if (tabs.length === 0) {
			return;
		}

		tabs.forEach((tabLabel, index) => {
			const item = document.createElement('li');
			const title = document.createElement('span');
			const removeButton = document.createElement('button');

			item.className = `tab-item tab-item--${mode}`;
			title.className = 'tab-item__title';
			title.textContent = tabLabel.title || tabLabel.url || 'Untitled tab';
			removeButton.type = 'button';
			removeButton.className = 'tab-remove-button';
			removeButton.textContent = 'Remove';
			removeButton.dataset.mode = mode;
			removeButton.dataset.index = String(index);
			removeButton.dataset.url = tabLabel.url || '';

			item.appendChild(title);
			item.appendChild(removeButton);
			listElement.appendChild(item);
		});
	}

	function updateTabLists() {
		renderTabList(workTabList, workTabs, 'work');
		renderTabList(playTabList, playTabs, 'play');
	}

	function applyState(state) {
		currentMode = state.mode === 'play' ? 'play' : 'work';
		workDurationSeconds = Number.isFinite(state.workDurationSeconds)
			? state.workDurationSeconds
			: defaultWorkDurationSeconds;
		playDurationSeconds = Number.isFinite(state.playDurationSeconds)
			? state.playDurationSeconds
			: defaultPlayDurationSeconds;
		timerSeconds = Number.isFinite(state.timerSeconds) ? state.timerSeconds : currentDurationSeconds();
		timerRunning = Boolean(state.timerRunning);
		workTabs = Array.isArray(state.workTabs) ? state.workTabs.map(normalizeTabEntry) : [];
		playTabs = Array.isArray(state.playTabs) ? state.playTabs.map(normalizeTabEntry) : [];
		const cleaned = ensureUniqueTabs();

		if (cleaned && globalThis.chrome?.storage?.local) {
			persistTabs();
		}

		updateTimerDisplay();
		updateModeIndicator();
		updateActionButtons();
		updateTimerEditor();
		updateTabLists();
	}

	function persistTabs() {
		if (!globalThis.chrome?.storage?.local) {
			return;
		}

		chrome.storage.local.set({
			workTabs,
			playTabs,
		});
	}

	function ensureUniqueTabs() {
		const playUrls = new Set(playTabs.map((tab) => tab.url).filter((url) => url));
		const nextWorkTabs = workTabs.filter((tab) => !tab.url || !playUrls.has(tab.url));
		const didChange = nextWorkTabs.length !== workTabs.length;
		workTabs = nextWorkTabs;
		return didChange;
	}

	function handleTimerSet() {
		if (timerRunning || !globalThis.chrome?.storage?.local) {
			return;
		}

		const minutesValue = Number.parseInt(timerMinutesInput.value, 10);
		if (!Number.isFinite(minutesValue)) {
			updateTimerEditor();
			return;
		}

		const clampedMinutes = Math.min(Math.max(minutesValue, 1), maxMinutes);
		const nextDurationSeconds = clampedMinutes * 60;

		if (currentMode === 'work') {
			workDurationSeconds = nextDurationSeconds;
		} else {
			playDurationSeconds = nextDurationSeconds;
		}

		timerSeconds = nextDurationSeconds;
		updateTimerDisplay();
		updateTimerEditor();

		chrome.storage.local.set({
			workDurationSeconds,
			playDurationSeconds,
			timerSeconds: nextDurationSeconds,
		});
	}

	function handleStartClick() {
		if (!globalThis.chrome?.storage?.local || timerRunning) {
			return;
		}

		const updates = {
			timerRunning: true,
		};

		if (timerSeconds <= 0) {
			updates.timerSeconds = currentDurationSeconds();
		}

		chrome.storage.local.set(updates);
	}

	function handlePauseClick() {
		if (!globalThis.chrome?.storage?.local || !timerRunning) {
			return;
		}

		chrome.storage.local.set({ timerRunning: false });
	}

	function handleStopClick() {
		if (!globalThis.chrome?.storage?.local) {
			return;
		}

		chrome.storage.local.set({
			timerRunning: false,
			timerSeconds: currentDurationSeconds(),
		});
	}

	function handleModeToggle() {
		if (!globalThis.chrome?.storage?.local) {
			return;
		}

		const nextMode = currentMode === 'work' ? 'play' : 'work';
		const nextDuration = nextMode === 'work' ? workDurationSeconds : playDurationSeconds;

		chrome.storage.local.set({
			mode: nextMode,
			timerRunning: false,
			timerSeconds: nextDuration,
		});
	}

	function handleAddTab(event) {
		const mode = event.currentTarget.dataset.mode;
		const selectElement = mode === 'work' ? workTabSelect : playTabSelect;
		const selectedId = Number.parseInt(selectElement.value, 10);
		const selectedTab = availableTabs.find((tab) => tab.id === selectedId);

		if (!selectedTab) {
			refreshTabOptions();
			return;
		}

		const normalizedTab = normalizeTabEntry(selectedTab);
		if (mode === 'work') {
			const updatedTabs = workTabs.filter((tab) => tab.url !== normalizedTab.url);
			workTabs = [...updatedTabs, normalizedTab];
			playTabs = playTabs.filter((tab) => tab.url !== normalizedTab.url);
		} else {
			const updatedTabs = playTabs.filter((tab) => tab.url !== normalizedTab.url);
			playTabs = [...updatedTabs, normalizedTab];
			workTabs = workTabs.filter((tab) => tab.url !== normalizedTab.url);
		}

		ensureUniqueTabs();
		updateTabLists();
		persistTabs();
		refreshTabOptions();
	}

	function handleRemoveTab(event) {
		const button = event.target.closest('.tab-remove-button');
		if (!button) {
			return;
		}

		const mode = button.dataset.mode;
		const url = button.dataset.url || '';
		const index = Number.parseInt(button.dataset.index, 10);
		const removeByIndex = Number.isFinite(index)
			? (tab, tabIndex) => tabIndex !== index
			: () => true;
		const removeByUrl = url ? (tab) => tab.url !== url : removeByIndex;

		if (mode === 'work') {
			workTabs = workTabs.filter(removeByUrl);
		} else if (mode === 'play') {
			playTabs = playTabs.filter(removeByUrl);
		}

		updateTabLists();
		persistTabs();
		refreshTabOptions();
	}

	function renderTabOptions(selectElement, tabs) {
		const previousValue = selectElement.value;
		selectElement.textContent = '';

		if (tabs.length === 0) {
			const option = document.createElement('option');
			option.value = '';
			option.textContent = 'No tabs available';
			selectElement.appendChild(option);
			selectElement.disabled = true;
			return;
		}

		selectElement.disabled = false;
		tabs.forEach((tab) => {
			const option = document.createElement('option');
			option.value = String(tab.id);
			option.textContent = tab.title || tab.url || 'Untitled tab';
			selectElement.appendChild(option);
		});

		if (previousValue) {
			selectElement.value = previousValue;
		}
	}

	function refreshTabOptions() {
		if (!hasChromeTabsApi()) {
			renderTabOptions(workTabSelect, []);
			renderTabOptions(playTabSelect, []);
			return;
		}

		chrome.tabs.query({ currentWindow: true }, (tabs) => {
			availableTabs = tabs.filter((tab) => Boolean(tab.url) && Number.isFinite(tab.id));
			const workUrls = new Set(workTabs.map((tab) => tab.url).filter((url) => url));
			const playUrls = new Set(playTabs.map((tab) => tab.url).filter((url) => url));
			const workChoices = availableTabs.filter((tab) => !playUrls.has(tab.url));
			const playChoices = availableTabs.filter((tab) => !workUrls.has(tab.url));
			renderTabOptions(workTabSelect, workChoices);
			renderTabOptions(playTabSelect, playChoices);
		});
	}

	startButton.addEventListener('click', handleStartClick);
	pauseButton.addEventListener('click', handlePauseClick);
	stopButton.addEventListener('click', handleStopClick);
	timerSetButton.addEventListener('click', handleTimerSet);
	modeIndicator.addEventListener('click', handleModeToggle);
	timerMinutesInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			handleTimerSet();
		}
	});

	addTabButtons.forEach((button) => {
		button.addEventListener('click', handleAddTab);
	});
	workTabList.addEventListener('click', handleRemoveTab);
	playTabList.addEventListener('click', handleRemoveTab);

	if (globalThis.chrome?.storage?.local) {
		chrome.storage.local.get(
			{
				mode: 'work',
				workDurationSeconds: defaultWorkDurationSeconds,
				playDurationSeconds: defaultPlayDurationSeconds,
				timerSeconds: defaultWorkDurationSeconds,
				timerRunning: false,
				workTabs: [],
				playTabs: [],
			},
			(state) => applyState(state),
		);

		chrome.storage.onChanged.addListener((changes, areaName) => {
			if (areaName !== 'local') {
				return;
			}

			const nextState = {
				mode: currentMode,
				workDurationSeconds,
				playDurationSeconds,
				timerSeconds,
				timerRunning,
				workTabs,
				playTabs,
			};

			Object.keys(changes).forEach((key) => {
				if (Object.prototype.hasOwnProperty.call(nextState, key)) {
					nextState[key] = changes[key].newValue;
				}
			});

			applyState(nextState);
		});

		refreshTabOptions();
	} else {
		updateTimerDisplay();
		updateModeIndicator();
		updateActionButtons();
		updateTimerEditor();
		updateTabLists();
		refreshTabOptions();
	}
});
