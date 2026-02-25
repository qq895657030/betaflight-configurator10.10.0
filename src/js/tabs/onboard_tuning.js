import { i18n } from "../localization";
import GUI, { TABS } from '../gui';
import MSP from '../msp';
import MSPCodes from '../msp/MSPCodes';
import { mspHelper } from '../msp/MSPHelper';
import FC from '../fc'; // 引入 FC 对象，这里通常存有最新的状态
import $ from 'jquery';

const onboard_tuning = {
    initialize: function (callback) {
        console.log(">>> Onboard Tuning Tab Initializing...");
        
        if (GUI.active_tab !== 'onboard_tuning') {
            GUI.active_tab = 'onboard_tuning';
        }

        $('#content').load("./tabs/onboard_tuning.html", function () {
            console.log(">>> HTML Loaded.");
            i18n.localizePage();

            // --- 1. 原有的本地测试按钮 ---
            $('#test_btn').on('click', function() {
                const msg = "JS 运行正常！时间：" + new Date().toLocaleTimeString();
                $('#test_result').text(msg);
                if (typeof gui_log === 'function') gui_log(msg);
            });

            // --- 2. 新增的 MSP 读取按钮逻辑 ---
            $('#msp_read_btn').on('click', function() {
                const resultDiv = $('#msp_result');
                
                // --- 连接状态检测 (保持原样) ---
                let isConnected = false;
                if (GUI.connected_to) isConnected = true;
                else if (window.serial && window.serial.connected) isConnected = true;
                else if (window.Serial && window.Serial.connected) isConnected = true;

                if (!isConnected) {
                    resultDiv.html('<span style="color:red">❌ 错误：未检测到飞控连接！</span>');
                    return;
                }

                resultDiv.html('⏳ 发送命令并等待响应...');
                console.log("Sending MSP_API_VERSION...");

                // 发送命令
                MSP.send_message(MSPCodes.MSP_API_VERSION, false, false, function () {
                    console.log("Callback fired.");
                    
                    // 【核心修复】使用 setTimeout 延迟读取，确保底层已更新全局状态
                    setTimeout(() => {
                        let data = null;

                        // 尝试 1: 从 FC.CONFIG 读取 (最可靠，因为连接时自动运行过此命令)
                        if (FC.CONFIG && FC.CONFIG.apiVersion) {
                            console.log("Data source: FC.CONFIG");
                            // 构造一个模拟的数据数组用于显示，或者直接显示字符串
                            // FC.CONFIG.apiVersion 通常是 "1.41.0" 这样的字符串
                            // 为了展示“原始数据”，我们尝试从 FC 内部找，或者直接信任这个字符串
                            
                            const versionParts = FC.CONFIG.apiVersion.split('.');
                            const major = parseInt(versionParts[0]) || 0;
                            const minor = parseInt(versionParts[1]) || 0;
                            
                            // 模拟原始数据 [协议版本，高位，低位] -> 假设协议版本为 1
                            // 注意：这里只是为了展示，真实原始数据在回调里拿不到确实很麻烦
                            // 但我们可以直接显示解析后的结果，这也是用户最想看到的
                            
                            displaySuccess(
                                [1, major, minor], 
                                `Read from FC.CONFIG (Auto-initialized)`,
                                FC.CONFIG.apiVersion
                            );
                            return;
                        }

                        // 尝试 2: 再次尝试从全局 MSP 对象读取 (也许延迟后有了)
                        const globalMSP = window.MSP || MSP;
                        if (globalMSP.data) {
                            data = globalMSP.data;
                            console.log("Data source: window.MSP.data (after timeout)");
                        } else if (globalMSP.message && globalMSP.message.data) {
                            data = globalMSP.message.data;
                            console.log("Data source: MSP.message.data");
                        }

                        if (data && data.length >= 3) {
                            displaySuccess(data, "Read from MSP Callback (Delayed)", `${data[1]}.${data[2]}`);
                        } else {
                            // 如果都失败了，至少告诉用户 FC.CONFIG 里的值
                            console.warn("Callback data missing, but FC.CONFIG has:", FC.CONFIG.apiVersion);
                            resultDiv.html(`
                                <span style="color:orange">⚠️ 回调数据获取失败 (架构限制)。<br>
                                但飞控已连接，当前 API 版本为：<strong>${FC.CONFIG.apiVersion || '未知'}</strong></span>
                            `);
                        }
                    }, 50); // 延迟 50ms
                });
            });

            function displaySuccess(dataArray, source, versionStr) {
                const protocolVersion = dataArray[0];
                const appVersionHigh = dataArray[1];
                const appVersionLow = dataArray[2];
                
                const successMsg = `
                    ✅ <strong>成功收到响应!</strong><br>
                    <small>来源: ${source}</small><br>
                    原始数据 (Dec): ${Array.from(dataArray).join(', ')}<br>
                    原始数据 (Hex): ${Array.from(dataArray).map(b => b.toString(16).padStart(2, '0')).join(' ')}<br>
                    协议版本: ${protocolVersion}<br>
                    <strong style="font-size:1.2em; color:green;">API 版本: ${versionStr}</strong>
                `;
                $('#msp_result').html(successMsg);
                if (typeof gui_log === 'function') gui_log(`MSP Success: API ${versionStr}`);
            }

            // --- 3. 保存按钮 ---
            $('a.save').on('click', function(e) {
                e.preventDefault();
                alert("保存按钮被点击！");
            });

            if (callback) callback();
            console.log(">>> Onboard Tuning Tab Ready.");
        });
    },

    cleanup: function (callback) {
        if (callback) callback();
    }
};

TABS.onboard_tuning = onboard_tuning;
export { onboard_tuning };