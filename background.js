const defaultState = {
	mode: 'work',
	timerDurationSeconds: 25 * 60,
	timerSeconds: 25 * 60,
	timerRunning: false,
	workTabs: [],
	playTabs: [],
};

const blockedPageUrl = chrome.runtime.getURL('blocked.html');
const notificationIconUrl = 'icons/icon128.png';
let timerIntervalId = null;
let cachedTimerSeconds = null;

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

function normalizeState(items) {
	const timerDurationSeconds = Number.isFinite(items.timerDurationSeconds)
		? items.timerDurationSeconds
		: defaultState.timerDurationSeconds;
	const timerSeconds = Number.isFinite(items.timerSeconds)
		? items.timerSeconds
		: timerDurationSeconds;

	return {
		...defaultState,
		...items,
		mode: items.mode === 'play' ? 'play' : 'work',
		timerDurationSeconds,
		timerSeconds,
		workTabs: Array.isArray(items.workTabs) ? items.workTabs : [],
		playTabs: Array.isArray(items.playTabs) ? items.playTabs : [],
	};
}

function isPlayTab(url, playTabs) {
	return playTabs.some((tab) => {
		const normalizedTab = normalizeTabEntry(tab);
		return normalizedTab.url === url;
	});
}

function stopTimerInterval() {
	if (timerIntervalId !== null) {
		clearInterval(timerIntervalId);
		timerIntervalId = null;
	}
}

function notifyModeChange(nextMode) {
	const message = nextMode === 'play'
		? 'Work session complete. Enjoy your play break.'
		: 'Play session complete. Back to work.';

	chrome.notifications.create({
		type: 'basic',
		iconUrl: notificationIconUrl,
		title: 'Focus Timer',
		message,
	});
}

function handleTimerComplete() {
	stopTimerInterval();

	chrome.storage.local.get(defaultState, (items) => {
		const state = normalizeState(items);
		const nextMode = state.mode === 'work' ? 'play' : 'work';
		const nextTimerSeconds = state.timerDurationSeconds;

		chrome.storage.local.set({
			mode: nextMode,
			timerSeconds: nextTimerSeconds,
			timerRunning: false,
		});

		notifyModeChange(nextMode);
	});
}

function startTimerInterval() {
	if (timerIntervalId !== null) {
		return;
	}

	chrome.storage.local.get(defaultState, (items) => {
		const state = normalizeState(items);
		cachedTimerSeconds = state.timerSeconds > 0 ? state.timerSeconds : state.timerDurationSeconds;

		chrome.storage.local.set({
			timerSeconds: cachedTimerSeconds,
		});

		timerIntervalId = setInterval(() => {
			cachedTimerSeconds = Math.max(0, (cachedTimerSeconds ?? 0) - 1);

			if (cachedTimerSeconds <= 0) {
				handleTimerComplete();
				return;
			}

			chrome.storage.local.set({
				timerSeconds: cachedTimerSeconds,
			});
		}, 1000);
	});
}

function initializeState() {
	chrome.storage.local.get(defaultState, (items) => {
		const state = normalizeState(items);

		chrome.storage.local.set(state, () => {
			if (state.timerRunning) {
				startTimerInterval();
			}
		});
	});
}

chrome.runtime.onInstalled.addListener(() => {
	initializeState();
});

chrome.runtime.onStartup.addListener(() => {
	initializeState();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || typeof message.type !== 'string') {
		return false;
	}

	if (message.type === 'focusTimer:getState') {
		chrome.storage.local.get(defaultState, (items) => {
			sendResponse(normalizeState(items));
		});

		return true;
	}

	if (message.type === 'focusTimer:setState') {
		chrome.storage.local.set(message.state, () => {
			sendResponse({ ok: true });
		});

		return true;
	}

	return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== 'local') {
		return;
	}

	if (changes.timerRunning) {
		if (changes.timerRunning.newValue) {
			startTimerInterval();
		} else {
			stopTimerInterval();
		}
	}

	if (changes.timerSeconds && timerIntervalId === null) {
		cachedTimerSeconds = changes.timerSeconds.newValue;
	}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (!changeInfo || changeInfo.status !== 'loading') {
		return;
	}

	const targetUrl = changeInfo.url || tab?.url;
	if (!targetUrl || targetUrl.startsWith('chrome-extension://')) {
		return;
	}

	chrome.storage.local.get({ mode: 'work', playTabs: [] }, (items) => {
		if (items.mode !== 'work') {
			return;
		}

		if (!isPlayTab(targetUrl, items.playTabs)) {
			return;
		}

		const tabTitle = tab?.title || 'Blocked tab';
		const redirectUrl = `${blockedPageUrl}?title=${encodeURIComponent(tabTitle)}`;

		chrome.tabs.update(tabId, { url: redirectUrl });
	});
});