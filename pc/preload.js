/**
 * PCT-100 上位机 — preload 桥接脚本
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pctAPI', {

    // ── 状态查询 ──
    getStatus:      () => ipcRenderer.invoke('get-status'),
    getMqttStatus:  () => ipcRenderer.invoke('get-mqtt-status'),

    // ── 内网/外网 ──
    getNetworkConfig:   () => ipcRenderer.invoke('get-network-config'),
    switchNetwork:      (network) => ipcRenderer.invoke('switch-network', network),
    updateNetworkConfig:(network, key, value) => ipcRenderer.invoke('update-network-config', network, key, value),

    // ── 设备控制 ──
    refreshStatus:  ()              => ipcRenderer.invoke('refresh-status'),
    setRelay:       (relay, value)  => ipcRenderer.invoke('set-relay', relay, value),
    setMode:        (mode)          => ipcRenderer.invoke('set-mode', mode),
    setThreshold:   (type, value)   => ipcRenderer.invoke('set-threshold', type, value),
    reboot:         ()              => ipcRenderer.invoke('reboot'),
    setDeviceId:    (id)            => ipcRenderer.invoke('set-device-id', id),

    // ── 事件监听 ──
    onDeviceStatus:  (cb) => { ipcRenderer.on('device-status',  (e, d) => cb(d)); },
    onMqttStatus:    (cb) => { ipcRenderer.on('mqtt-status',    (e, s, n) => cb(s, n)); },
    onNetworkChanged:(cb) => { ipcRenderer.on('network-changed',(e, d) => cb(d)); },
    onLog:           (cb) => { ipcRenderer.on('log',            (e, d) => cb(d)); }
});
