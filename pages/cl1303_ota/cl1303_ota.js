const ecUI = require('../../utils/ecUI.js')
const ecBLE = require('../../utils/ecBLE.js')
let ctx

const CMD = {
  ENTER: 30,
  GET_VERSION: 31,
  CHECK_VERSION_RSP: 32,
  START: 33,
  GET_PACKET: 34,
  SEND_PACKET: 35,
  END: 36,
}

const DEFAULT_PACKET_SIZE = 500

Page({

    /**
     * 页面的初始数据
     */
    data: {
        binHexArray: [],
        binDecimalArray: [],
        hasSelectedBinFile: false,
        binSize: 0,
        firmwareVersionText: '-',
        otaStatusText: '未开始',
        otaProgress: 0,
        otaTotalPackets: 0,
        otaConfirmedPackets: 0,
        otaConfirmedBytes: 0,
        isUpgrading: false,
    },
    otaSession: {
      seq: 0,
      totalSize: 0,
      packetSize: DEFAULT_PACKET_SIZE,
      totalPackets: 0,
      versionBytes: [0, 0, 0],
      maxPacketSent: 0,
      versionCheckResolver: null,
      versionCheckRejecter: null,
      versionCheckTimer: null,
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
    ctx = this; // 将 ctx 指向当前页面实例
    ecBLE.setChineseType(ecBLE.ECBLEChineseTypeGBK)
    if (wx && wx.onBLEConnectionStateChange) {
      wx.onBLEConnectionStateChange((res) => {
        if (!this.data.isUpgrading) {
          return;
        }
        if (!res.connected) {
          this._clearVersionCheckWaiter();
          this.setData({
            otaStatusText: '断线，等待重连…',
          });
          return;
        }
        const { totalSize, packetSize, versionBytes } = this.otaSession;
        if (totalSize > 0 && packetSize > 0 && versionBytes) {
          const startPayload = this._buildStartPayload(packetSize, totalSize, versionBytes);
          setTimeout(() => {
            this._sendCmd(CMD.START, startPayload);
          }, 300);
        }
      });
    }
    /**监听BLE消息 */
    ecBLE.onBLECharacteristicValueChange((str, strHex) => {
      // 直接用局部变量处理，不走setData（避免视图层渲染延迟）
      const receiveData = [];
      /*将收到的所有十六进制字符存入缓冲器 */
      for (let i = 0; i < strHex.length; i += 2) {
        receiveData.push(strHex[i] + strHex[i + 1]);
      }
      /*将十六进制字符转为十进制数组 */
      const decimalArray = receiveData.map(hexStr => parseInt(hexStr, 16));
      /*计算CRC结果 */
      const crcResult = ctx.crc16CcittFalse_send(decimalArray, decimalArray.length - 2);
      /*取接收到的数据包CRC */
      let concatenatedHex = receiveData[receiveData.length - 2] + receiveData[receiveData.length - 1];
      const hexToDecimal = parseInt(concatenatedHex, 16);
      /**对接收到的数捪CRC与数据的CRC比对 */
      if (hexToDecimal == crcResult) {
        ctx.handleBleFrame(receiveData);
      }
    })
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {
      this._clearVersionCheckWaiter();
    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },

  _clearVersionCheckWaiter() {
    if (this.otaSession.versionCheckTimer) {
      clearTimeout(this.otaSession.versionCheckTimer);
    }
    this.otaSession.versionCheckTimer = null;
    this.otaSession.versionCheckResolver = null;
    this.otaSession.versionCheckRejecter = null;
  },

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  _nextSeq() {
    this.otaSession.seq = (this.otaSession.seq + 1) & 0xFFFF;
    return this.otaSession.seq;
  },

  _getPayloadBytes(arr) {
    if (!arr || arr.length < 10) {
      return [];
    }
    const lenHigh = parseInt(arr[6], 16);
    const lenLow = parseInt(arr[7], 16);
    const dataLen = (lenHigh << 8) | lenLow;
    if (!dataLen) {
      return [];
    }
    const payload = [];
    for (let i = 0; i < dataLen; i++) {
      const v = parseInt(arr[8 + i], 16);
      if (!Number.isNaN(v)) {
        payload.push(v);
      }
    }
    return payload;
  },

  _getPacketNoFromRequest(arr) {
    const payload = this._getPayloadBytes(arr);
    if (payload.length !== 2) {
      return 0;
    }
    return payload[0] | (payload[1] << 8);
  },

  _waitVersionCheck(timeoutMs) {
    this._clearVersionCheckWaiter();
    return new Promise((resolve, reject) => {
      this.otaSession.versionCheckResolver = resolve;
      this.otaSession.versionCheckRejecter = reject;
      this.otaSession.versionCheckTimer = setTimeout(() => {
        this._clearVersionCheckWaiter();
        reject(new Error('timeout'));
      }, timeoutMs);
    });
  },

  _sendCmd(opcode, payload) {
    const seq = this._nextSeq();
    const dataLen = payload ? payload.length : 0;
    const buffer = new Array(10 + dataLen);
    buffer[0] = 0x55;
    buffer[1] = 0xAA;
    buffer[2] = (seq >> 8) & 0xFF;
    buffer[3] = seq & 0xFF;
    buffer[4] = 0x00;
    buffer[5] = opcode;
    buffer[6] = (dataLen >> 8) & 0xFF;
    buffer[7] = dataLen & 0xFF;
    for (let i = 0; i < dataLen; i++) {
      buffer[8 + i] = payload[i] & 0xFF;
    }
    const crcResult = ctx.crc16CcittFalse_send(buffer, 8 + dataLen);
    buffer[8 + dataLen] = (crcResult >> 8) & 0xFF;
    buffer[9 + dataLen] = crcResult & 0xFF;
    ecBLE.writeBLECharacteristicValueBuffer(new Uint8Array(buffer).buffer);
  },

  handleBleFrame(arr) {
    if (!arr || !Array.isArray(arr) || arr.length < 8) {
      return;
    }
    const cmdHex = (arr[5] || '').toUpperCase();
    switch (cmdHex) {
      case '20': {
        const payload = this._getPayloadBytes(arr);
        if (this.otaSession.versionCheckResolver) {
          this.otaSession.versionCheckResolver(payload);
        }
        if (payload && payload.length > 0) {
          const allowUpgrade = payload[0] === 1;
          const deviceVerText = payload.length >= 4 ? `${payload[1]}.${payload[2]}.${payload[3]}` : '-';
          this.setData({
            otaStatusText: allowUpgrade
              ? `版本校验通过 设备版本:${deviceVerText} 升级中…`
              : `版本校验失败 设备版本:${deviceVerText}`,
          });
        }
        this._clearVersionCheckWaiter();
        break;
      }
      case '22': {
        const packetNo = this._getPacketNoFromRequest(arr);
        if (!this.data.isUpgrading) {
          return;
        }
        if (this.otaSession.totalPackets > 0 && packetNo > 0) {
          const confirmedPackets = Math.min(this.otaSession.totalPackets, Math.max(0, packetNo - 1));
          const confirmedBytes = (confirmedPackets >= this.otaSession.totalPackets)
            ? this.otaSession.totalSize
            : Math.min(this.otaSession.totalSize, confirmedPackets * this.otaSession.packetSize);
          const progress = Math.round((confirmedPackets / this.otaSession.totalPackets) * 100);
          this.setData({
            otaConfirmedPackets: confirmedPackets,
            otaConfirmedBytes: confirmedBytes,
            otaProgress: Math.min(99, Math.max(0, progress)),
          });
        }
        this._sendFirmwarePacket(packetNo);
        break;
      }
      default:
        break;
    }
  },

  _buildStartPayload(packetSize, totalSize, versionBytes) {
    return [
      packetSize & 0xFF,
      (packetSize >> 8) & 0xFF,
      totalSize & 0xFF,
      (totalSize >> 8) & 0xFF,
      (totalSize >> 16) & 0xFF,
      (totalSize >> 24) & 0xFF,
      versionBytes[0] & 0xFF,
      versionBytes[1] & 0xFF,
      versionBytes[2] & 0xFF,
    ];
  },

  _sendFirmwarePacket(packetNo) {
    const decimalArray = this.data.binDecimalArray;
    const totalSize = this.otaSession.totalSize;
    const packetSize = this.otaSession.packetSize;
    const totalPackets = this.otaSession.totalPackets;
    if (!packetNo || packetNo <= 0) {
      return;
    }
    if (packetNo > totalPackets) {
      if (this.data.isUpgrading) {
        this.setData({
          otaProgress: 100,
          otaStatusText: '固件缓存完成，设备开始进入OTA…',
          otaConfirmedPackets: totalPackets,
          otaConfirmedBytes: totalSize,
        });
        this._sendCmd(CMD.END);
        this.setData({
          isUpgrading: false,
          otaStatusText: '固件缓存完成，设备校验版本并启动升级…',
        });
      }
      return;
    }
    const startIndex = (packetNo - 1) * packetSize;
    const endIndex = Math.min(startIndex + packetSize, totalSize);
    const chunkSize = endIndex - startIndex;
    const payload = new Array(chunkSize + 2);
    payload[0] = packetNo & 0xFF;
    payload[1] = (packetNo >> 8) & 0xFF;
    for (let i = 0; i < chunkSize; i++) {
      payload[2 + i] = decimalArray[startIndex + i];
    }
    this._sendCmd(CMD.SEND_PACKET, payload);
  },

  _extractFirmwareVersionBytes(hexArray) {
    const versionOffset = 0x1000 + 0x90;
    if (!hexArray || hexArray.length < versionOffset + 3) {
      return null;
    }
    const v0 = parseInt(hexArray[versionOffset + 2], 16);
    const v1 = parseInt(hexArray[versionOffset + 1], 16);
    const v2 = parseInt(hexArray[versionOffset], 16);
    if ([v0, v1, v2].some(v => Number.isNaN(v))) {
      return null;
    }
    return [v0, v1, v2];
  },

  async startAutoOta() {
    const hexArray = this.getHexArray();
    const decimalArray = this.data.binDecimalArray;
    if (!decimalArray || decimalArray.length === 0 || !hexArray || hexArray.length === 0) {
      wx.showToast({ title: '请先选择BIN文件', icon: 'error' });
      return;
    }
    const versionBytes = this._extractFirmwareVersionBytes(hexArray);
    if (!versionBytes) {
      wx.showToast({ title: '版本解析失败', icon: 'error' });
      return;
    }

    const totalSize = decimalArray.length;
    const packetSize = DEFAULT_PACKET_SIZE;
    const totalPackets = Math.ceil(totalSize / packetSize);

    this.otaSession.totalSize = totalSize;
    this.otaSession.packetSize = packetSize;
    this.otaSession.totalPackets = totalPackets;
    this.otaSession.versionBytes = versionBytes;
    this.otaSession.maxPacketSent = 0;

    this.setData({
      isUpgrading: true,
      otaProgress: 0,
      otaTotalPackets: totalPackets,
      otaConfirmedPackets: 0,
      otaConfirmedBytes: 0,
      otaStatusText: '缓存固件中…',
    });

    try {
      const startPayload = this._buildStartPayload(packetSize, totalSize, versionBytes);
      this._sendCmd(CMD.START, startPayload);
    } catch (e) {
      this.setData({
        isUpgrading: false,
        otaStatusText: '升级失败',
        otaProgress: 0,
      });
      wx.showToast({ title: '升级失败', icon: 'error' });
    }
  },



    /**
     * 打开聊天窗口选择文件
     */
    chooseBinFile() {
        const that = this;
        wx.chooseMessageFile({
            count: 1,
            type: 'file',
            extension: ['bin'],
            success(res) {
                const tempFilePath = res.tempFiles[0].path;
                const fileName = res.tempFiles[0].name;
                
                // 检查文件扩展名是否为 .bin
                if (!that.isBinFile(fileName)) {
                    wx.showToast({
                        title: '请选择.bin文件',
                        icon: 'error'
                    });
                    return;
                }

                // 读取文件并转换为hex数组
                that.readBinFileAndConvertToHex(tempFilePath);
            },
            fail(err) {
                console.error('选择文件失败:', err);
                wx.showToast({
                    title: '选择文件失败',
                    icon: 'error'
                });
            }
        });
    },

    /**
     * 判断是否为bin文件
     */
    isBinFile(fileName) {
        if (!fileName) return false;
        const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
        return ext === '.bin';
    },

    /**
     * 读取bin文件并转换为hex数组
     */
    readBinFileAndConvertToHex(filePath) {
        const that = this;
        
        wx.getFileSystemManager().readFile({
            filePath: filePath,
            success(res) {
                // res.data 是 ArrayBuffer 类型
                const hexArray = that.arrayBufferToHexArray(res.data);
                const decimalArray = that.arrayBufferToDecimalArray(res.data);
                const versionBytes = that._extractFirmwareVersionBytes(hexArray);
                const versionText = versionBytes ? `${versionBytes[0]}.${versionBytes[1]}.${versionBytes[2]}` : '-';
                
                // 将hex数组和十进制数组都保存到页面数据中
                that.setData({
                    binHexArray: hexArray,
                    binDecimalArray: decimalArray,
                    hasSelectedBinFile: true,
                    binSize: decimalArray.length,
                    firmwareVersionText: versionText,
                    otaStatusText: '未开始',
                    otaProgress: 0,
                    otaTotalPackets: 0,
                    otaConfirmedPackets: 0,
                    otaConfirmedBytes: 0,
                    isUpgrading: false,
                });
                
                console.log('BIN文件转换为HEX数组成功:', hexArray.length, '字节');
                console.log('BIN文件转换为十进制数组成功:', decimalArray.length, '字节');
                
                wx.showToast({
                    title: '文件读取成功',
                    icon: 'success'
                });
                
                // 返回hex数组供使用
                return hexArray;
            },
            fail(err) {
                console.error('读取文件失败:', err);
                wx.showToast({
                    title: '读取文件失败',
                    icon: 'error'
                });
            }
        });
    },


      convertDecimalArrayToHexString(arr) {
        if (!Array.isArray(arr)) {
          console.error('请传入数组参数');
          return '';
        }
        return arr.map(num => {
          let hex = Math.floor(num).toString(16);
          hex = hex.padStart(2, '0');
          return hex.toUpperCase();
        }).join('');
      },








    /**
     * 将ArrayBuffer转换为hex数组
     */
    arrayBufferToHexArray(buffer) {
        const uint8Array = new Uint8Array(buffer);
        const hexArray = [];
        
        for (let i = 0; i < uint8Array.length; i++) {
            // 转换为十六进制字符串，不足两位补0
            const hex = uint8Array[i].toString(16).padStart(2, '0').toUpperCase();
            hexArray.push(hex);
        }
        
        return hexArray;
    },

    /**
     * 将ArrayBuffer转换为十进制数组（快速发送用）
     */
    arrayBufferToDecimalArray(buffer) {
        const uint8Array = new Uint8Array(buffer);
        // 直接返回数组副本，无需转换
        return Array.from(uint8Array);
    },

    /**
     * 获取已转换的hex数组
     */
    getHexArray() {
        return this.data.binHexArray || [];
    },

      /**发送消息时CRC */
  crc16CcittFalse_send(data, len) {
    let crc = 0xFFFF; // 初始值，与C代码一致
    const polynomial = 0x1021; // 多项式，与C代码一致
    // 处理空数据（同C代码逻辑）
    if (!data || len === 0) {
      return crc;
    }

    // 遍历每个字节（对应C代码的外层for循环）
    for (let i = 0; i < len; i++) {
      // 高8位与当前字节异或（对应C代码：crc ^= ((unsigned short)data[i] << 8)）
      crc ^= (data[i] << 8);

      // 处理每个比特位（对应C代码的内层for循环）
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) { // 最高位为1
          crc = (crc << 1) ^ polynomial;
        } else { // 最高位为0
          crc = crc << 1;
        }
        crc &= 0xFFFF; // 保持16位（防止溢出，同C代码）
      }
    }

    return crc;
  },
  /**接收消息时CRC */
  crc16CcittFalse(data) {
    let crc = 0xFFFF; // 初始值，与C代码一致
    const polynomial = 0x1021; // 多项式，与C代码一致

    // 处理空数据（同C代码逻辑）
    if (!data || data.length === 0) {
      return crc;
    }
    // 遍历每个字节（对应C代码的外层for循环）
    for (let i = 0; i < data.length - 2; i++) {
      // 高8位与当前字节异或（对应C代码：crc ^= ((unsigned short)data[i] << 8)）
      crc ^= (data[i] << 8);

      // 处理每个比特位（对应C代码的内层for循环）
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) { // 最高位为1
          crc = (crc << 1) ^ polynomial;
        } else { // 最高位为0
          crc = crc << 1;
        }
        crc &= 0xFFFF; // 保持16位（防止溢出，同C代码）
      }
    }

    return crc;
  },
})
