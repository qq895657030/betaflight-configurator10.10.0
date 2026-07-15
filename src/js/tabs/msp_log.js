import windowWatcherUtil from "../utils/window_watchers";
import MSPCodes from "../msp/MSPCodes";
import $ from 'jquery';

const MAX_RENDERED_ROWS = 300;
const RENDER_INTERVAL_MS = 100;
const SUMMARY_WINDOW_MS = 30000;
const cssDark = [
    '/css/dark-theme.css',
];

let paused = false;
let pendingEntries = [];
let renderEntries = [];
let renderTimer = null;
let txSummaryEntries = [];
let initialized = false;
let MSP = null;

const entriesElement = $('.msp-log-entries');
const tableWrapElement = $('.msp-log-table-wrap');
const pauseButtonElement = $('.msp-log-pause');
const autoScrollElement = $('.msp-log-autoscroll');
const summaryListElement = $('.msp-log-summary-list');
const mspCodeNames = Object.entries(MSPCodes).reduce((codeNames, [name, code]) => {
    if (Number.isInteger(code) && !codeNames[code]) {
        codeNames[code] = name;
    }

    return codeNames;
}, {});

const watchers = {
    darkTheme: (val) => {
        if (val) {
            applyDarkTheme();
        } else {
            applyNormalTheme();
        }
    },
};

function toHex(value, width = 2) {
    return value.toString(16).toUpperCase().padStart(width, '0');
}

function payloadToHex(payload) {
    if (!payload || !payload.length) {
        return '';
    }

    return payload.map((value) => toHex(value)).join(' ');
}

function formatTime(time) {
    const date = new Date(time);
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

    return `${date.toLocaleTimeString()}.${milliseconds}`;
}

function formatCrc(entry) {
    if (entry.direction === 'tx') {
        return entry.retry ? 'retry' : '';
    }

    if (entry.unsupported) {
        return 'unsupported';
    }

    return entry.checksumOk ? 'ok' : 'bad';
}

function getCodeName(code) {
    return mspCodeNames[code] || 'UNKNOWN';
}

function updateTxSummary(entryOrEntries) {
    const now = Date.now();
    const entries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries];

    if (entries.some((entry) => entry?.clear)) {
        txSummaryEntries = [];
    } else {
        txSummaryEntries.push(...entries.filter((entry) => entry?.direction === 'tx'));
    }

    txSummaryEntries = txSummaryEntries.filter((txEntry) => now - txEntry.time <= SUMMARY_WINDOW_MS);

    const summaryItems = [...new Set(txSummaryEntries.map((txEntry) => txEntry.code))]
        .sort((left, right) => left - right);

    summaryListElement.empty();

    if (!summaryItems.length) {
        summaryListElement.append($('<span class="msp-log-summary-empty">').text('No TX yet'));
        return;
    }

    summaryItems.forEach((code) => {
        summaryListElement.append($('<span class="msp-log-summary-item">').text(`${code} ${getCodeName(code)}`));
    });
}

function entryToRowHtml(entry) {
    const rowClasses = [
        entry.direction === 'tx' ? 'msp-log-tx' : 'msp-log-rx',
        entry.checksumOk === false || entry.unsupported === true ? 'msp-log-error' : '',
    ].filter(Boolean).join(' ');

    return `<tr class="${rowClasses}">` +
        `<td>${formatTime(entry.time)}</td>` +
        `<td>${entry.direction.toUpperCase()}</td>` +
        `<td>V${entry.protocol}</td>` +
        `<td>${entry.code}</td>` +
        `<td>${entry.length}</td>` +
        `<td>${formatCrc(entry)}</td>` +
        `<td class="msp-log-payload">${payloadToHex(entry.payload)}</td>` +
    '</tr>';
}

function appendEntry(entry) {
    if (entry.clear) {
        entriesElement.empty();
        updateTxSummary(entry);
        return;
    }

    appendEntries([entry]);
}

function appendEntries(entries) {
    if (!entries.length) {
        return;
    }

    updateTxSummary(entries);
    entriesElement.prepend(entries.slice().reverse().map(entryToRowHtml).join(''));

    while (entriesElement.children().length > MAX_RENDERED_ROWS) {
        entriesElement.children().last().remove();
    }

    if (autoScrollElement.prop('checked')) {
        tableWrapElement.scrollTop(0);
    }
}

function scheduleRender() {
    if (renderTimer) {
        return;
    }

    renderTimer = setTimeout(() => {
        const entries = renderEntries.splice(0);
        renderTimer = null;

        appendEntries(entries);

        if (renderEntries.length) {
            scheduleRender();
        }
    }, RENDER_INTERVAL_MS);
}

function handleLogEntry(entryOrEntries) {
    const entries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries];

    if (entries.some((entry) => entry.clear)) {
        renderEntries = [];
        appendEntry({clear: true});
        return;
    }

    if (paused) {
        pendingEntries.push(...entries);
        pauseButtonElement.text(`Resume (${pendingEntries.length})`);
        return;
    }

    renderEntries.push(...entries);
    scheduleRender();
}

function applyDarkTheme() {
    cssDark.forEach((el) => $(`link[href="${el}"]`).prop('disabled', false));
    $('body').addClass('dark-theme');
}

function applyNormalTheme() {
    cssDark.forEach((el) => $(`link[href="${el}"]`).prop('disabled', true));
    $('body').removeClass('dark-theme');
}

$('.msp-log-clear').on('click', function() {
    pendingEntries = [];

    if (MSP) {
        MSP.clearLogEntries();
    }
});

pauseButtonElement.on('click', function() {
    paused = !paused;

    if (paused) {
        pauseButtonElement.text('Resume');
        return;
    }

    appendEntries(pendingEntries);
    pendingEntries = [];
    pauseButtonElement.text('Pause');
});

function getMspSource() {
    return window.mspLogSource || window.opener?.MSP;
}

function initializeMspLog() {
    if (initialized) {
        return;
    }

    MSP = getMspSource();

    if (!MSP) {
        summaryListElement.empty();
        summaryListElement.append($('<span class="msp-log-summary-empty">').text('Waiting for MSP source'));
        setTimeout(initializeMspLog, 100);
        return;
    }

    initialized = true;
    MSP.enableLog();
    appendEntries(MSP.getLogEntries());
    updateTxSummary();
    MSP.listenLog(handleLogEntry);
}

initializeMspLog();

window.addEventListener('beforeunload', function() {
    if (MSP) {
        MSP.removeLogListener(handleLogEntry);
        MSP.disableLog();
    }

    if (renderTimer) {
        clearTimeout(renderTimer);
    }
});

windowWatcherUtil.bindWatchers(window, watchers);
