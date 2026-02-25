import { i18n } from "../localization";
import GUI, { TABS } from '../gui';
import $ from 'jquery';

const onboard_tuning = {
    initialize: function (callback) {
        console.log(">>> Onboard Tuning Tab Initializing...");
        
        if (GUI.active_tab !== 'onboard_tuning') {
            GUI.active_tab = 'onboard_tuning';
        }

        // 加载 HTML
        $('#content').load("./tabs/onboard_tuning.html", function () {
            console.log(">>> HTML Loaded.");

            // 尝试运行翻译 (如果失败也不会影响显示，因为 HTML 里写了死文字)
            i18n.localizePage();

            // 绑定测试按钮
            $('#test_btn').on('click', function() {
                const msg = "JS 运行正常！时间：" + new Date().toLocaleTimeString();
                $('#test_result').text(msg);
                console.log(msg);
                // 尝试调用全局 gui_log (如果存在)
                if (typeof gui_log === 'function') {
                    gui_log(msg);
                }
            });

            // 绑定保存按钮
            $('a.save').on('click', function(e) {
                e.preventDefault();
                alert("保存按钮被点击！");
            });

            // 完成加载
            if (callback) {
                callback();
            }
            console.log(">>> Onboard Tuning Tab Ready.");
        });
    },

    cleanup: function (callback) {
        if (callback) callback();
    }
};

TABS.onboard_tuning = onboard_tuning;

export { onboard_tuning };