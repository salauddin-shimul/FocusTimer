const defaultState = {
	mode: 'work',
	workDurationSeconds: 25 * 60,
	playDurationSeconds: 5 * 60,
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
	const mode = items.mode === 'play' ? 'play' : 'work';
	const workDurationSeconds = Number.isFinite(items.workDurationSeconds)
		? items.workDurationSeconds
		: defaultState.workDurationSeconds;
	const playDurationSeconds = Number.isFinite(items.playDurationSeconds)
		? items.playDurationSeconds
		: defaultState.playDurationSeconds;
	const fallbackSeconds = mode === 'work' ? workDurationSeconds : playDurationSeconds;
	const timerSeconds = Number.isFinite(items.timerSeconds)
		? items.timerSeconds
		: fallbackSeconds;

	return {
		...defaultState,
		...items,
		mode,
		workDurationSeconds,
		playDurationSeconds,
		timerSeconds,
		workTabs: Array.isArray(items.workTabs) ? items.workTabs : [],
		playTabs: Array.isArray(items.playTabs) ? items.playTabs : [],
	};
}

function normalizeHostname(url) {
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./i, '').toLowerCase();
	} catch {
		return null;
	}
}

function baseDomain(hostname) {
	if (!hostname) {
		return null;
	}

	if (hostname === 'localhost' || /^[0-9.]+$/.test(hostname) || hostname.includes(':')) {
		return hostname;
	}

	const parts = hostname.split('.').filter(Boolean);
	if (parts.length <= 2) {
		return hostname;
	}

	return parts.slice(-2).join('.');
}

function isTabInList(url, tabs) {
	const targetHost = normalizeHostname(url);
	const targetBase = baseDomain(targetHost);
	if (!targetBase) {
		return false;
	}

	return tabs.some((tab) => {
		const normalizedTab = normalizeTabEntry(tab);
		const blockedHost = normalizeHostname(normalizedTab.url);
		const blockedBase = baseDomain(blockedHost);
		if (!blockedBase) {
			return false;
		}

		return targetBase === blockedBase;
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
		const nextTimerSeconds = nextMode === 'work'
			? state.workDurationSeconds
			: state.playDurationSeconds;

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
		const fallbackSeconds = state.mode === 'work'
			? state.workDurationSeconds
			: state.playDurationSeconds;
		cachedTimerSeconds = state.timerSeconds > 0 ? state.timerSeconds : fallbackSeconds;

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

	chrome.storage.local.get({ mode: 'work', playTabs: [], workTabs: [], timerRunning: false }, (items) => {
		if (!items.timerRunning) {
			return;
		}

		const mode = items.mode === 'play' ? 'play' : 'work';
		const blockedTabs = mode === 'work' ? items.playTabs : items.workTabs;
		if (!isTabInList(targetUrl, blockedTabs)) {
			return;
		}

		let tabTitle = tab?.title || '';
		if (!tabTitle) {
			try {
				const parsed = new URL(targetUrl);
				tabTitle = parsed.hostname;
			} catch {
				tabTitle = 'Blocked tab';
			}
		}

		const redirectUrl = `${blockedPageUrl}?title=${encodeURIComponent(tabTitle)}&url=${encodeURIComponent(targetUrl)}&mode=${mode}`;

		chrome.tabs.update(tabId, { url: redirectUrl });
	});
});