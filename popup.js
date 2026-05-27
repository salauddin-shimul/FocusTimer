document.addEventListener('DOMContentLoaded', () => {
	const timerDisplay = document.querySelector('.timer-display');
	const modeIndicator = document.querySelector('.mode-indicator');
	const toggleButton = document.querySelector('.toggle-button');
	const addTabButtons = document.querySelectorAll('.add-tab-button');
	const workTabList = document.querySelector('.tab-group--work .tab-list');
	const playTabList = document.querySelector('.tab-group--play .tab-list');

	const defaultSeconds = 25 * 60;
	let remainingSeconds = defaultSeconds;
	let currentMode = 'work';
	let isRunning = false;
	let intervalId = null;
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
		timerDisplay.textContent = formatTime(remainingSeconds);
	}

	function updateModeIndicator() {
		const isWorkMode = currentMode === 'work';

		modeIndicator.textContent = isWorkMode ? 'Work Mode' : 'Play Mode';
		modeIndicator.classList.toggle('mode-indicator--work', isWorkMode);
		modeIndicator.classList.toggle('mode-indicator--play', !isWorkMode);
	}

	function updateToggleButton() {
		if (isRunning) {
			toggleButton.textContent = 'Pause';
			return;
		}

		toggleButton.textContent = currentMode === 'work' ? 'Start Work' : 'Start Play';
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

	function saveState() {
		if (!globalThis.chrome?.storage?.local) {
			return;
		}

		chrome.storage.local.set({
			mode: currentMode,
			remainingSeconds,
			isRunning,
			workTabs,
			playTabs,
		});
	}

	function applyState(state) {
		currentMode = state.mode === 'play' ? 'play' : 'work';
		remainingSeconds = Number.isFinite(state.remainingSeconds) ? state.remainingSeconds : defaultSeconds;
		isRunning = Boolean(state.isRunning);
		workTabs = Array.isArray(state.workTabs) ? state.workTabs.map(normalizeTabEntry) : [];
		playTabs = Array.isArray(state.playTabs) ? state.playTabs.map(normalizeTabEntry) : [];

		updateTimerDisplay();
		updateModeIndicator();
		updateToggleButton();
		updateTabLists();
	}

	function stopTimer() {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}

		isRunning = false;
		updateToggleButton();
		saveState();
	}

	function startTimer() {
		if (intervalId !== null) {
			return;
		}

		isRunning = true;
		updateToggleButton();
		saveState();

		intervalId = setInterval(() => {
			if (remainingSeconds <= 0) {
				stopTimer();
				return;
			}

			remainingSeconds -= 1;
			updateTimerDisplay();

			if (remainingSeconds <= 0) {
				remainingSeconds = 0;
				updateTimerDisplay();
				stopTimer();
			}

			saveState();
		}, 1000);
	}

	function handleToggleClick() {
		currentMode = currentMode === 'work' ? 'play' : 'work';
		updateModeIndicator();

		if (isRunning) {
			stopTimer();
		} else {
			startTimer();
		}

		saveState();
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
			saveState();
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

	addTabButtons.forEach((button) => {
		button.addEventListener('click', handleAddTab);
	});

	if (globalThis.chrome?.storage?.local) {
		chrome.storage.local.get(
			{
				mode: 'work',
				remainingSeconds: defaultSeconds,
				isRunning: false,
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
				remainingSeconds,
				isRunning,
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
		updateTabLists();
	}
});
