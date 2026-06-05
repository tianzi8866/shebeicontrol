/**
 * PCT-100 化工装置智能控制器 — 上位机
 * Electron 主进程：窗口管理 + 内网/外网 MQTT 双通道
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const mqtt = require('mqtt');
const path = require('path');

// ═══════════════════════════════════════
//  内网 / 外网 双 MQTT 配置
// ═══════════════════════════════════════
const NET_CONFIGS = {
    extranet: {
        label: '外网',
        broker: 'mqtt://47.98.170.180:8081',
        username: 'dzdx_emqx',
        password: 'Jp4!sQ7$'
    },
    intranet: {
        label: '内网',
        broker: 'mqtt://192.168.199.219:1883',
        username: '',
        password: ''
    }
};

let currentNetwork = 'extranet';  // 默认外网
let deviceId = 'PCT_100_017';

function getActiveConfig() {
    const cfg = NET_CONFIGS[currentNetwork];
    return {
        broker: cfg.broker,
        username: cfg.username,
        password: cfg.password,
        deviceId: deviceId,
        network: currentNetwork,
        label: cfg.label,
        statusTopic:  'chemctrl/' + deviceId + '/status',
        commandTopic: 'chemctrl/' + deviceId + '/command'
    };
}

// ═══════════════════════════════════════
// 全局状态
// ═══════════════════════════════════════
let mainWindow = null;
let mqttClient = null;
let deviceStatus = {
    temperature:    0,
    light:          0,
    mode:           'auto',
    key1_lock:      false,
    relay3:         false,
    relay4:         false,
    temp_threshold: 30.5,
    light_threshold:260,
    connected:      false,
    mqtt_connected: false,
    last_update:    null
};

// ═══════════════════════════════════════
// 创建主窗口
// ═══════════════════════════════════════
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 900,
        minHeight: 650,
        title: 'PCT-100 化工装置智能控制器',
        backgroundColor: '#0f1419',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile('index.html');
}

// ═══════════════════════════════════════
// MQTT 连接
// ═══════════════════════════════════════
function connectMQTT() {
    if (mqttClient) { mqttClient.end(true); }

    const cfg = getActiveConfig();
    const clientId = cfg.deviceId + '_pc_' + Math.random().toString(16).slice(2, 8);

    console.log('[MQTT] 连接 [' + cfg.label + '] ' + cfg.broker);

    mqttClient = mqtt.connect(cfg.broker, {
        clientId: clientId,
        username: cfg.username,
        password: cfg.password,
        keepalive: 15,
        clean: true,
        reconnectPeriod: 5000
    });

    mqttClient.on('connect', () => {
        console.log('[MQTT] 已连接 [' + cfg.label + ']');
        deviceStatus.mqtt_connected = true;
        sendToRenderer('mqtt-status', true, currentNetwork);

        mqttClient.subscribe(cfg.statusTopic, { qos: 0 }, (err) => {
            if (!err) {
                console.log('[MQTT] 订阅: ' + cfg.statusTopic);
                publishCommand({ cmd: 'get_status' });
            } else {
                console.error('[MQTT] 订阅失败:', err);
            }
        });
    });

    mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('[MQTT] 收到:', data);
            updateDeviceStatus(data);
        } catch (e) {
            console.error('[MQTT] 解析失败:', e);
        }
    });

    mqttClient.on('error', (err) => {
        console.error('[MQTT] 错误:', err);
        deviceStatus.mqtt_connected = false;
        sendToRenderer('mqtt-status', false, currentNetwork);
    });

    mqttClient.on('close', () => {
        console.log('[MQTT] 断开');
        deviceStatus.mqtt_connected = false;
        sendToRenderer('mqtt-status', false, currentNetwork);
    });

    mqttClient.on('reconnect', () => { console.log('[MQTT] 重连中...'); });
}

// ═══════════════════════════════════════
// 更新设备状态
// ═══════════════════════════════════════
function updateDeviceStatus(data) {
    if (data.temperature !== undefined)    deviceStatus.temperature = data.temperature;
    if (data.light !== undefined)          deviceStatus.light = data.light;
    if (data.mode !== undefined)           deviceStatus.mode = data.mode;
    if (data.key1_lock !== undefined)      deviceStatus.key1_lock = data.key1_lock;
    if (data.relay3 !== undefined)         deviceStatus.relay3 = data.relay3;
    if (data.relay4 !== undefined)         deviceStatus.relay4 = data.relay4;
    if (data.temp_threshold !== undefined) deviceStatus.temp_threshold = data.temp_threshold;
    if (data.light_threshold !== undefined)deviceStatus.light_threshold = data.light_threshold;
    deviceStatus.connected = true;
    deviceStatus.last_update = new Date().toLocaleTimeString();
    sendToRenderer('device-status', deviceStatus);
}

// ═══════════════════════════════════════
// 发送 MQTT 命令
// ═══════════════════════════════════════
function publishCommand(cmd) {
    if (!mqttClient || !mqttClient.connected) {
        sendToRenderer('log', { type: 'error', msg: 'MQTT 未连接' });
        return false;
    }
    const cfg = getActiveConfig();
    const payload = JSON.stringify(cmd);
    mqttClient.publish(cfg.commandTopic, payload, { qos: 0 }, (err) => {
        if (err) { sendToRenderer('log', { type: 'error', msg: '发送失败: ' + err.message }); }
        else     { sendToRenderer('log', { type: 'info',  msg: '已发送: ' + payload }); }
    });
    return true;
}

// ═══════════════════════════════════════
// IPC 处理器
// ═══════════════════════════════════════
function setupIPC() {
    ipcMain.handle('get-status', () => deviceStatus);
    ipcMain.handle('get-mqtt-status', () => deviceStatus.mqtt_connected);

    // ── 获取网络配置 ──
    ipcMain.handle('get-network-config', () => ({
        current: currentNetwork,
        extranet: {...NET_CONFIGS.extranet},
        intranet: {...NET_CONFIGS.intranet},
        deviceId: deviceId
    }));

    // ── 切换内网/外网 ──
    ipcMain.handle('switch-network', (event, network) => {
        if (network !== 'extranet' && network !== 'intranet')
            return { ok: false, msg: '无效的网络类型' };
        currentNetwork = network;
        sendToRenderer('network-changed', { network: currentNetwork, config: getActiveConfig() });
        connectMQTT();
        return { ok: true };
    });

    // ── 更新网络配置 ──
    ipcMain.handle('update-network-config', (event, network, key, value) => {
        if (!NET_CONFIGS[network]) return { ok: false, msg: '无效的网络类型' };
        NET_CONFIGS[network][key] = value;
        if (network === currentNetwork) connectMQTT();
        return { ok: true };
    });

    ipcMain.handle('set-relay', (event, relay, value) => {
        if (relay !== 3 && relay !== 4) return { ok: false, msg: '无效编号' };
        return { ok: publishCommand({ cmd: 'set_relay', relay: relay, value: value }) };
    });
    ipcMain.handle('set-mode', (event, mode) => {
        if (mode !== 'auto' && mode !== 'manual') return { ok: false, msg: '无效模式' };
        return { ok: publishCommand({ cmd: 'set_mode', mode: mode }) };
    });
    ipcMain.handle('set-threshold', (event, type, value) => {
        const cmd = { cmd: 'set_threshold' };
        if (type === 'temp') cmd.temp = parseFloat(value);
        else if (type === 'light') cmd.light = parseInt(value);
        else return { ok: false, msg: '无效类型' };
        return { ok: publishCommand(cmd) };
    });
    ipcMain.handle('refresh-status', () => { publishCommand({ cmd: 'get_status' }); return { ok: true }; });
    ipcMain.handle('reboot', () => { return { ok: publishCommand({ cmd: 'reboot' }) }; });
    ipcMain.handle('set-device-id', (event, newId) => { deviceId = newId; connectMQTT(); return { ok: true }; });
}

function sendToRenderer(channel, data, extra) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data, extra);
    }
}

app.whenReady().then(() => {
    setupIPC();
    createWindow();
    connectMQTT();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => {
    if (mqttClient) mqttClient.end(true);
    if (process.platform !== 'darwin') app.quit();
});
