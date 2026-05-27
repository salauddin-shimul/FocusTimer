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

	function stopTimer() {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}

		isRunning = false;
		updateToggleButton();
	}

	function startTimer() {
		if (intervalId !== null) {
			return;
		}

		isRunning = true;
		updateToggleButton();

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
	}

	function handleAddTab(event) {
		const mode = event.currentTarget.dataset.mode;
		const list = mode === 'work' ? workTabList : playTabList;
		const item = document.createElement('li');

		item.textContent = `${mode === 'work' ? 'Work' : 'Play'} tab placeholder`;
		item.style.padding = '8px 12px';
		item.style.borderBottom = '1px solid #e5e7eb';

		list.appendChild(item);
	}

	toggleButton.addEventListener('click', handleToggleClick);

	addTabButtons.forEach((button) => {
		button.addEventListener('click', handleAddTab);
	});

	updateTimerDisplay();
	updateModeIndicator();
	updateToggleButton();
});
