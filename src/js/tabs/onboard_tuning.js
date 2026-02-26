import { i18n } from "../localization";
import GUI, { TABS } from '../gui';
import MSP from '../msp';
import MSPCodes from '../msp/MSPCodes';
import FC from '../fc';
import $ from 'jquery';

const LOOP_INTERVAL_NAME = 'onboard_loop_stream';

function isConnected() {
    if (GUI.connected_to) return true;
    if (window.serial && window.serial.connected) return true;
    if (window.Serial && window.Serial.connected) return true;
    return false;
}

function parseInt16(lo, hi) {
    let v = (hi << 8) | lo;
    if (v & 0x8000) v = v - 0x10000;
    return v;
}

function startLoopStream() {

    console.log(">>> startLoopStream");

    GUI.interval_remove(LOOP_INTERVAL_NAME);

    GUI.interval_add(LOOP_INTERVAL_NAME, function () {

        MSP.send_message(MSPCodes.MSP_S_LOOP, false, false, function () {

            const globalMSP = window.MSP || MSP;
            const data = globalMSP.data || (globalMSP.message && globalMSP.message.data);

            if (!data || data.length < 8) return;

            const v1 = parseInt16(data[0], data[1]);
            const v2 = parseInt16(data[2], data[3]);
            const v3 = parseInt16(data[4], data[5]);
            const v4 = parseInt16(data[6], data[7]);

            $('#loop_stream_result').html(
                `V1: ${v1} | V2: ${v2} | V3: ${v3} | V4: ${v4}`
            );
        });

    }, 5, true); // 5ms 更稳定
}

function stopLoopStream() {
    console.log(">>> stopLoopStream");
    GUI.interval_remove(LOOP_INTERVAL_NAME);
    $('#loop_stream_result').html("已停止");
}

const onboard_tuning = {

    initialize: function (callback) {

        console.log(">>> Onboard Tuning Tab Initializing");

        if (GUI.active_tab !== 'onboard_tuning')
            GUI.active_tab = 'onboard_tuning';

        $('#content').load("./tabs/onboard_tuning.html", function () {

            console.log(">>> HTML Loaded");
            i18n.localizePage();

            // ========= 本地测试 =========
            $('#test_btn').on('click', function () {
                $('#test_result').text("JS OK " + new Date().toLocaleTimeString());
            });

            // ========= MSP API VERSION =========
            $('#msp_read_btn').on('click', function () {

                if (!isConnected()) {
                    $('#msp_result').html('<span style="color:red">未连接飞控</span>');
                    return;
                }

                $('#msp_result').html("发送 MSP_API_VERSION...");

                MSP.send_message(MSPCodes.MSP_API_VERSION, false, false, function () {

                    setTimeout(() => {

                        if (FC.CONFIG && FC.CONFIG.apiVersion) {
                            $('#msp_result').html(
                                "API Version: " + FC.CONFIG.apiVersion
                            );
                            return;
                        }

                        $('#msp_result').html("收到响应但未解析");
                    }, 30);
                });
            });

            // ========= 500Hz LOOP =========
            $('#loop_stream_enable').on('change', function () {

                console.log("checkbox change", this.checked);

                if (this.checked) {

                    if (!isConnected()) {
                        alert("未连接飞控");
                        this.checked = false;
                        return;
                    }

                    if (!MSPCodes.MSP_S_LOOP) {
                        alert("MSP_S_LOOP 未定义");
                        this.checked = false;
                        return;
                    }

                    startLoopStream();

                } else {
                    stopLoopStream();
                }
            });

            // ========= 保存 =========
            $('a.save').on('click', function (e) {
                e.preventDefault();
                alert("保存点击");
            });

            console.log(">>> Onboard Tuning Ready");

            if (callback) callback();
        });
    },

    cleanup: function (callback) {

        console.log(">>> Onboard Tuning Cleanup");
        stopLoopStream();

        if (callback) callback();
    }
};

TABS.onboard_tuning = onboard_tuning;
export { onboard_tuning };