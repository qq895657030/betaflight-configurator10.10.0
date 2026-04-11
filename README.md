# 基于此分支
Commit: c97deaf7146837b2378e683a7f5b429fea34d5a9
Parents: 9e07b125fdbc85d0f682125c23c3708a4d0968cb
Author: Mark Haslinghuis <mark@numloq.nl>
Committer: GitHub <noreply@github.com>
Date: Sun Apr 28 2024 03:53:13 GMT+0800 (China Standard Time)
Fix Angle Mode positioning (#3914)

# Web仿真
yarn run dev

# BARO 模式兼容说明
- 已补充 BARO(permanentId=3) 在 Modes 页面显示的兼容逻辑。
- 当固件在 MODE_RANGES 中上报了 id=3，但 MSP_BOXNAMES/MSP_BOXIDS 漏报或最后一项被截断时，地面站会自动补出 BARO，可正常查看/编辑 AUX 范围。



# 编译win app
yarn gulp apps --win64
[网络不行解决方法]
下载nwjs-v0.72.0-win-x64.zip
解压到该路径
/f/betaflight/Betaflight-configurator/betaflight-configurator10.10.0/cache/0.72.0-normal/
再yarn gulp apps --win64

# 清除
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force apps
gulp clean