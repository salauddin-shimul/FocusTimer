const defaultState = {
	mode: 'work',
	remainingSeconds: 25 * 60,
	isRunning: false,
	workTabs: [],
	playTabs: [],
};

const blockedPageUrl = chrome.runtime.getURL('blocked.html');

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

function getDefaultState() {
	return {
		...defaultState,
		workTabs: [...defaultState.workTabs],
		playTabs: [...defaultState.playTabs],
	};
}

function isPlayTab(url, playTabs) {
	return playTabs.some((tab) => {
		const normalizedTab = normalizeTabEntry(tab);
		return normalizedTab.url === url;
	});
}

chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.local.get(defaultState, (items) => {
		chrome.storage.local.set({
			...getDefaultState(),
			...items,
		});
	});
});

chrome.runtime.onStartup.addListener(() => {
	chrome.storage.local.get(defaultState, (items) => {
		chrome.storage.local.set({
			...getDefaultState(),
			...items,
		});
	});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || typeof message.type !== 'string') {
		return false;
	}

	if (message.type === 'focusTimer:getState') {
		chrome.storage.local.get(defaultState, (items) => {
			sendResponse({
				...getDefaultState(),
				...items,
			});
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

chrome.tabs.onCreated.addListener((tab) => {
	if (tab && tab.id !== undefined) {
		console.log('Focus Timer observed new tab:', tab.id);
	}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (changeInfo && changeInfo.status === 'complete') {
		console.log('Focus Timer tab updated:', tabId);
	}
});

chrome.tabs.onRemoved.addListener((tabId) => {
	console.log('Focus Timer tab removed:', tabId);
});

chrome.webNavigation.onCommitted.addListener((details) => {
	if (details.frameId !== 0) {
		return;
	}

	if (!details.url || details.url.startsWith('chrome-extension://')) {
		return;
	}

	chrome.storage.local.get(defaultState, (items) => {
		const state = {
			...getDefaultState(),
			...items,
			playTabs: Array.isArray(items.playTabs) ? items.playTabs : [],
		};

		if (state.mode !== 'work') {
			return;
		}

		if (!isPlayTab(details.url, state.playTabs)) {
			return;
		}

		const redirectUrl = `${blockedPageUrl}?url=${encodeURIComponent(details.url)}`;

		chrome.tabs.update(details.tabId, { url: redirectUrl });
	});
});