document.addEventListener('DOMContentLoaded', () => {
	const params = new URLSearchParams(window.location.search);
	const blockedTitle = params.get('title');
	const blockedUrl = params.get('url');
	const queryMode = params.get('mode');
	const blockedTitleElement = document.getElementById('blocked-title');
	const blockedStatusElement = document.getElementById('blocked-status');
	const goBackButton = document.getElementById('go-back');
	const modeBadge = document.getElementById('mode-badge');
	const modeHeading = document.getElementById('mode-heading');
	const modeMessage = document.getElementById('mode-message');

	const defaultState = {
		mode: 'work',
		timerSeconds: 25 * 60,
		timerRunning: false,
	};
	let currentState = { ...defaultState };

	function formatTime(totalSeconds) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;

		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	function resolveBlockedTitle() {
		if (blockedTitle) {
			return blockedTitle;
		}

		if (blockedUrl) {
			try {
				const parsed = new URL(blockedUrl);
				return parsed.hostname;
			} catch {
				return blockedUrl;
			}
		}

		return 'Unknown tab title';
	}

	function updateStatus(state) {
		const storageMode = state.mode === 'play' ? 'play' : 'work';
		const activeModeKey = queryMode === 'play' || queryMode === 'work'
			? queryMode
			: storageMode;
		const activeMode = activeModeKey === 'play' ? 'Play Mode' : 'Work Mode';
		const blockedGroup = activeModeKey === 'play' ? 'Work' : 'Play';

		modeBadge.textContent = `Blocked during ${activeMode}`;
		modeHeading.textContent = `You're in ${activeMode}.`;
		modeMessage.textContent = `This tab is in your ${blockedGroup} group, so it stays paused while your ${activeMode.toLowerCase()} session is active.`;

		if (!state.timerRunning) {
			blockedStatusElement.textContent = `Timer is paused. Start ${activeMode} from the popup to resume.`;
			return;
		}

		const nextMode = activeModeKey === 'work' ? 'Play Mode' : 'Work Mode';
		blockedStatusElement.textContent = `${nextMode} starts in ${formatTime(state.timerSeconds)}.`;
	}

	function requestState() {
		if (!globalThis.chrome?.runtime?.sendMessage) {
			return;
		}

		chrome.runtime.sendMessage({ type: 'focusTimer:getState' }, (response) => {
			if (response) {
				currentState = { ...defaultState, ...response };
				updateStatus(currentState);
			}
		});
	}

	blockedTitleElement.textContent = resolveBlockedTitle();

	if (globalThis.chrome?.storage?.local) {
		chrome.storage.local.get(defaultState, (state) => {
			currentState = { ...defaultState, ...state };
			updateStatus(currentState);
		});

		chrome.storage.onChanged.addListener((changes, areaName) => {
			if (areaName !== 'local') {
				return;
			}

			Object.keys(changes).forEach((key) => {
				if (Object.prototype.hasOwnProperty.call(currentState, key)) {
					currentState[key] = changes[key].newValue;
				}
			});

			updateStatus(currentState);
		});
	} else {
		blockedStatusElement.textContent = 'Play Mode will begin when the timer ends.';
		requestState();
	}

	goBackButton.addEventListener('click', () => {
		window.history.back();
	});
});
