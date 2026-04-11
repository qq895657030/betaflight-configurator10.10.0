import { i18n } from "../localization";
import GUI, { TABS } from '../gui';
import MSP from '../msp';
import MSPCodes from '../msp/MSPCodes';
import FC from '../fc';
import $ from 'jquery';

// ==========================================
// 🔥 全局配置区：只需修改这里 🔥
// ==========================================
// 如果 MSPCodes.js 中定义了 MSP_S_LOOP，则使用它；否则直接填数字 (例如 500)
const TARGET_CODE = MSPCodes.MSP_S_LOOP || 500; 
// ==========================================

// 2. 轮询频率 (单位：毫秒)
// 推荐值：50ms (20Hz) ~ 100ms (10Hz)。
// 警告：不要低于 20ms，否则可能导致串口拥堵和 CRC 校验失败！
const LOOP_INTERVAL_MS = 50; 

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
    GUI.interval_remove(LOOP_INTERVAL_NAME);

    // 更新 UI 上的提示文字
    $('#monitor_code_display').text(`Code: ${TARGET_CODE} (0x${TARGET_CODE.toString(16).toUpperCase()}) @ ${1000/LOOP_INTERVAL_MS}Hz`);

    // 使用配置的频率启动定时器
    GUI.interval_add(LOOP_INTERVAL_NAME, function () {

        // 1. 发送请求
        MSP.send_message(TARGET_CODE, false, false, null);

        // 2. 从全局缓存读取数据
        if (!window.CUSTOM_MSP_CACHE) {
            $('#loop_stream_result').html('<span style="color:yellow">等待缓存初始化...</span>');
            return;
        }

        const cacheItem = window.CUSTOM_MSP_CACHE.find(item => item.code === TARGET_CODE);

        if (!cacheItem) {
            $('#loop_stream_result').html('<span style="color:gray">等待首次数据...</span>');
            return;
        }

        // 检查数据时效性 (超时时间设为轮询间隔的 3 倍，或者固定 1 秒)
        const timeoutThreshold = Math.max(1000, LOOP_INTERVAL_MS * 3);
        if (Date.now() - cacheItem.timestamp > timeoutThreshold) {
            $('#loop_stream_result').html('<span style="color:red">数据超时 (CRC 失败或断连)</span>');
            return;
        }

        const data = cacheItem.data;
        const dataDec = cacheItem.dataDec;

        if (!data || data.length < 8) {
            return;
        }

        // 3. 解析数据
        const v1 = parseInt16(data[0], data[1]);
        const v2 = parseInt16(data[2], data[3]);
        const v3 = parseInt16(data[4], data[5]);
        const v4 = parseInt16(data[6], data[7]);

        // 4. 格式化原始数据 (Hex with 0x prefix)
        const hexStr = dataDec.slice(0, 8).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

        // 5. 更新 UI
        const htmlContent = `
            <div style="font-size: 18px; font-weight: bold;">
                V1: ${v1} &nbsp;|&nbsp; V2: ${v2} &nbsp;|&nbsp; V3: ${v3} &nbsp;|&nbsp; V4: ${v4}
            </div>
            <div style="font-size: 12px; color: #aaa; margin-top: 5px;">
                Raw: [${hexStr}]
            </div>
        `;
        
        $('#loop_stream_result').html(htmlContent);
    }, LOOP_INTERVAL_MS, true); // 🔥 这里使用了配置的变量
}


function stopLoopStream() {
    GUI.interval_remove(LOOP_INTERVAL_NAME);
    $('#loop_stream_result').html("<span style='color:gray'>已停止</span>");
}

const onboard_tuning = {

    initialize: function (callback) {
        if (GUI.active_tab !== 'onboard_tuning')
            GUI.active_tab = 'onboard_tuning';

        $('#content').load("./tabs/onboard_tuning.html", function () {

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
                                "API Version: <strong>" + FC.CONFIG.apiVersion + "</strong>"
                            );
                        } else {
                            $('#msp_result').html("收到响应但未解析到版本信息");
                        }
                    }, 30);
                });
            });

            // ========= 实时数据流开关 =========
            $('#loop_stream_enable').on('change', function () {
                const isChecked = this.checked;
                if (isChecked) {
                    if (!isConnected()) {
                        alert("未连接飞控！请先连接。");
                        this.checked = false;
                        return;
                    }
                    
                    // 提示用户当前监控的 Code (使用全局常量)
                    // 清空旧缓存，避免显示旧数据 (使用全局常量)
                    if(window.CUSTOM_MSP_CACHE) {
                        window.CUSTOM_MSP_CACHE = window.CUSTOM_MSP_CACHE.filter(i => i.code !== TARGET_CODE);
                    }
                    
                    startLoopStream();
                } else {
                    stopLoopStream();
                }
            });

            // ========= 保存 =========
            $('a.save').on('click', function (e) {
                e.preventDefault();
                alert("保存功能暂未实现 (仅演示)");
            });

            if (callback) callback();
        });
    },

    cleanup: function (callback) {
        stopLoopStream();
        if (callback) callback();
    }
};

TABS.onboard_tuning = onboard_tuning;
export { onboard_tuning };
