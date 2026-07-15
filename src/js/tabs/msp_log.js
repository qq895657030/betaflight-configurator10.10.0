import windowWatcherUtil from "../utils/window_watchers";
import "../../css/tabs/msp_log.less";
import $ from 'jquery';

const MAX_RENDERED_ROWS = 1000;
const MSP = opener.MSP;
const cssDark = [
    '/css/dark-theme.css',
];

let paused = false;
let pendingEntries = [];

const entriesElement = $('.msp-log-entries');
const tableWrapElement = $('.msp-log-table-wrap');
const pauseButtonElement = $('.msp-log-pause');
const autoScrollElement = $('.msp-log-autoscroll');

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

function appendEntry(entry) {
    if (entry.clear) {
        entriesElement.empty();
        return;
    }

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
    MSP.clearLogEntries();
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

MSP.enableLog();
MSP.getLogEntries().forEach(appendEntry);
MSP.listenLog(handleLogEntry);
window.addEventListener('beforeunload', function() {
    MSP.removeLogListener(handleLogEntry);
    MSP.disableLog();
});

windowWatcherUtil.bindWatchers(window, watchers);
