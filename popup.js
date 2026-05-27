document.addEventListener('DOMContentLoaded', () => {
	const timerDisplay = document.querySelector('.timer-display');
	const timerMinutesInput = document.querySelector('#timer-minutes');
	const timerSetButton = document.querySelector('.timer-set-button');
	const modeIndicator = document.querySelector('.mode-indicator');
	const toggleButton = document.querySelector('.toggle-button');
	const addTabButtons = document.querySelectorAll('.add-tab-button');
	const workTabList = document.querySelector('.tab-group--work .tab-list');
	const playTabList = document.querySelector('.tab-group--play .tab-list');

	const defaultDurationSeconds = 25 * 60;
	const maxMinutes = 180;
	let timerDurationSeconds = defaultDurationSeconds;
	let timerSeconds = defaultDurationSeconds;
	let timerRunning = false;
	let currentMode = 'work';
	let workTabs = [];
	let playTabs = [];

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

	function updateTimerDisplay() {
		timerDisplay.textContent = formatTime(timerSeconds);
	}

	function updateModeIndicator() {
		const isWorkMode = currentMode === 'work';

		modeIndicator.textContent = isWorkMode ? 'Work Mode' : 'Play Mode';
		modeIndicator.classList.toggle('mode-indicator--work', isWorkMode);
		modeIndicator.classList.toggle('mode-indicator--play', !isWorkMode);
	}

	function updateToggleButton() {
		if (timerRunning) {
			toggleButton.textContent = 'Pause';
			return;
		}

		toggleButton.textContent = currentMode === 'work' ? 'Start Work' : 'Start Play';
	}

	function updateTimerEditor() {
		const minutesValue = Math.max(1, Math.round(timerDurationSeconds / 60));

		if (document.activeElement !== timerMinutesInput) {
			timerMinutesInput.value = String(minutesValue);
		}

		timerMinutesInput.disabled = timerRunning;
		timerSetButton.disabled = timerRunning;
	}

	function renderTabList(listElement, tabs, mode) {
		listElement.textContent = '';

		if (tabs.length === 0) {
			return;
		}

		tabs.forEach((tabLabel) => {
			const item = document.createElement('li');

			item.textContent = tabLabel.title;
			item.className = `tab-item tab-item--${mode}`;
			listElement.appendChild(item);
		});
	}

	function updateTabLists() {
		renderTabList(workTabList, workTabs, 'work');
		renderTabList(playTabList, playTabs, 'play');
	}

	function applyState(state) {
		currentMode = state.mode === 'play' ? 'play' : 'work';
		timerDurationSeconds = Number.isFinite(state.timerDurationSeconds)
			? state.timerDurationSeconds
			: defaultDurationSeconds;
		timerSeconds = Number.isFinite(state.timerSeconds) ? state.timerSeconds : timerDurationSeconds;
		timerRunning = Boolean(state.timerRunning);
		workTabs = Array.isArray(state.workTabs) ? state.workTabs.map(normalizeTabEntry) : [];
		playTabs = Array.isArray(state.playTabs) ? state.playTabs.map(normalizeTabEntry) : [];

		updateTimerDisplay();
		updateModeIndicator();
		updateToggleButton();
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

		timerDurationSeconds = nextDurationSeconds;
		timerSeconds = nextDurationSeconds;
		updateTimerDisplay();
		updateTimerEditor();

		chrome.storage.local.set({
			timerDurationSeconds: nextDurationSeconds,
			timerSeconds: nextDurationSeconds,
		});
	}

	function handleToggleClick() {
		if (!globalThis.chrome?.storage?.local) {
			return;
		}

		const nextRunning = !timerRunning;
		const updates = {
			timerRunning: nextRunning,
		};

		if (nextRunning && timerSeconds <= 0) {
			updates.timerSeconds = timerDurationSeconds;
		}

		chrome.storage.local.set(updates);
	}

	function handleAddTab(event) {
		const mode = event.currentTarget.dataset.mode;
		const pushTab = (tab) => {
			const normalizedTab = normalizeTabEntry(tab);

			if (mode === 'work') {
				workTabs = [...workTabs, normalizedTab];
			} else {
				playTabs = [...playTabs, normalizedTab];
			}

			updateTabLists();
			persistTabs();
		};

		if (hasChromeTabsApi()) {
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				const [activeTab] = tabs;

				if (!activeTab || !activeTab.url) {
					pushTab({ title: `${mode === 'work' ? 'Work' : 'Play'} tab`, url: '' });
					return;
				}

				pushTab(activeTab);
			});
			return;
		}

		pushTab({
			title: `${mode === 'work' ? 'Work' : 'Play'} tab placeholder`,
			url: '',
		});
	}

	toggleButton.addEventListener('click', handleToggleClick);
	timerSetButton.addEventListener('click', handleTimerSet);
	timerMinutesInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			handleTimerSet();
		}
	});

	addTabButtons.forEach((button) => {
		button.addEventListener('click', handleAddTab);
	});

	if (globalThis.chrome?.storage?.local) {
		chrome.storage.local.get(
			{
				mode: 'work',
				timerDurationSeconds: defaultDurationSeconds,
				timerSeconds: defaultDurationSeconds,
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
				timerDurationSeconds,
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
	} else {
		updateTimerDisplay();
		updateModeIndicator();
		updateToggleButton();
		updateTimerEditor();
		updateTabLists();
	}
});
