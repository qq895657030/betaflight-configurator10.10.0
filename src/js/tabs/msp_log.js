import windowWatcherUtil from "../utils/window_watchers";
import MSPCodes from "../msp/MSPCodes";
import $ from 'jquery';

const MAX_RENDERED_ROWS = 1000;
const SUMMARY_WINDOW_MS = 30000;
const cssDark = [
    '/css/dark-theme.css',
];

let paused = false;
let pendingEntries = [];
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

function updateTxSummary(entry) {
    const now = Date.now();

    if (entry?.clear) {
        txSummaryEntries = [];
    } else if (entry?.direction === 'tx') {
        txSummaryEntries.push(entry);
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

function appendEntry(entry) {
    if (entry.clear) {
        entriesElement.empty();
        updateTxSummary(entry);
        return;
    }

    updateTxSummary(entry);

    const row = $('<tr>')
        .addClass(entry.direction === 'tx' ? 'msp-log-tx' : 'msp-log-rx')
        .toggleClass('msp-log-error', entry.checksumOk === false || entry.unsupported === true);

    row.append($('<td>').text(formatTime(entry.time)));
    row.append($('<td>').text(entry.direction.toUpperCase()));
    row.append($('<td>').text(`V${entry.protocol}`));
    row.append($('<td>').text(entry.code));
    row.append($('<td>').text(entry.length));
    row.append($('<td>').text(formatCrc(entry)));
    row.append($('<td class="msp-log-payload">').text(payloadToHex(entry.payload)));

    entriesElement.prepend(row);

    while (entriesElement.children().length > MAX_RENDERED_ROWS) {
        entriesElement.children().last().remove();
    }

    if (autoScrollElement.prop('checked')) {
        tableWrapElement.scrollTop(0);
    }
}

function handleLogEntry(entry) {
    if (paused && !entry.clear) {
        pendingEntries.push(entry);
        pauseButtonElement.text(`Resume (${pendingEntries.length})`);
        return;
    }

    appendEntry(entry);
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

    pendingEntries.forEach(appendEntry);
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
    MSP.getLogEntries().forEach(appendEntry);
    updateTxSummary();
    MSP.listenLog(handleLogEntry);
}

initializeMspLog();

window.addEventListener('beforeunload', function() {
    if (MSP) {
        MSP.removeLogListener(handleLogEntry);
        MSP.disableLog();
    }
});

windowWatcherUtil.bindWatchers(window, watchers);
