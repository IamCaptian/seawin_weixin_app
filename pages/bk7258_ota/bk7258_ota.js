const ecUI = require('../../utils/ecUI.js')
const ecBLE = require('../../utils/ecBLE.js')
let ctx
Page({

    /**
     * 页面的初始数据
     */
    data: {
        binHexArray: [], // 存储转换后的hex数组（十六进制字符串）
        binDecimalArray: [], // 存储十进制数组（用于快速发送）
        hasSelectedBinFile: false,
        otaProgress: 0,
    },
    // OTA发送状态
    otaSendIndex: 0, // 当前发送的位置索引
    isOtaSending: false, // 是否正在OTA发送中
    isOtaFinishSent: false,

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
    ctx = this; // 将 ctx 指向当前页面实例
    ecBLE.setChineseType(ecBLE.ECBLEChineseTypeGBK)
    /**监听BLE消息 */
    ecBLE.onBLECharacteristicValueChange((str, strHex) => {
      console.log('有消息回来');
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
        ctx.handleArrayByFifthItem(receiveData);
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


      /**处理接收到的数据 */
  handleArrayByFifthItem(arr) {
    if (!arr || !Array.isArray(arr)) {}
    if (arr.length < 6) {
      return;
    }
    const seq_high = parseInt(arr[2], 16);
    const seq_low = parseInt(arr[3], 16);
    const seq = seq_high << 8 | seq_low;
    console.log('seq:', seq);
    /**命令索引 */
    const fifthItem = arr[5];
    console.log(arr);
    console.log('fifthItem = ', fifthItem);
    switch (fifthItem) {
      case "06":
        console.log('收到6命令，发送BIN文件数据');
        ctx.handleOtaDataSend(ctx.getOtaPacketIndexFromRequest(arr));
        break;
      case "25":

      default:
        break;
    }


  },

  getOtaPacketIndexFromRequest(arr) {
    if (!arr || arr.length < 12) {
      return 0;
    }
    const lenHigh = parseInt(arr[6], 16);
    const lenLow = parseInt(arr[7], 16);
    const dataLen = (lenHigh << 8) | lenLow;
    if (dataLen !== 2) {
      return 0;
    }
    const low = parseInt(arr[8], 16);
    const high = parseInt(arr[9], 16);
    if (Number.isNaN(low) || Number.isNaN(high)) {
      return 0;
    }
    return (high << 8) | low;
  },

  /**
   * 处理OTA数据发送
   */
  handleOtaDataSend(packetNo) {
    const decimalArray = ctx.data.binDecimalArray;
    
    // 检查是否有数据可发送
    if (!decimalArray || decimalArray.length === 0) {
      ctx.setData({
        otaProgress: 0
      });
      wx.showToast({ title: '请先选择BIN文件', icon: 'error' });
      return;
    }

    // 每次发送500字节
    const bytesPerSend = 500;
    const totalPackets = Math.ceil(decimalArray.length / bytesPerSend);
    const safePacketNo = Math.floor(Number(packetNo) || 0);
    if (safePacketNo <= 0) {
      return;
    }

    if (safePacketNo > totalPackets) {
      console.log('BIN文件数据已全部发送完毕');
      ctx.setData({
        otaProgress: 100
      });
      wx.showToast({ title: '固件发送完成', icon: 'success' });
      if (!ctx.isOtaFinishSent) {
        ctx.isOtaFinishSent = true;
        ctx.bk7258_send_ota_done();
      }
      ctx.isOtaSending = false;
      return;
    }

    const safePacketIndex = safePacketNo - 1;
    const startIndex = safePacketIndex * bytesPerSend;
    const endIndex = Math.min(startIndex + bytesPerSend, decimalArray.length);
    const chunkSize = endIndex - startIndex;

    // 构建发送数据包
    const payloadSize = chunkSize + 2;
    const buffer = new Array(10 + payloadSize);
    buffer[0] = 0x55;
    buffer[1] = 0xAA;
    buffer[2] = 0x00;
    buffer[3] = 0x00;
    buffer[4] = 0x00;
    buffer[5] = 4;
    buffer[6] = (payloadSize >> 8) & 0xFF;
    buffer[7] = payloadSize & 0xFF;
    buffer[8] = safePacketNo & 0xFF;
    buffer[9] = (safePacketNo >> 8) & 0xFF;

    // 快速填充数据
    for (let i = 0; i < chunkSize; i++) {
      buffer[10 + i] = decimalArray[startIndex + i];
    }

    // 计算CRC
    const crcResult = ctx.crc16CcittFalse_send(buffer, 8 + payloadSize);
    buffer[8 + payloadSize] = crcResult >> 8;
    buffer[8 + payloadSize + 1] = crcResult & 0x00FF;

    // 直接发送ArrayBuffer
    ecBLE.writeBLECharacteristicValueBuffer(new Uint8Array(buffer).buffer);

    ctx.isOtaSending = true;

    // 每10%显示一次进度
    ctx.otaMaxPacketSent = Math.max(ctx.otaMaxPacketSent || 0, safePacketNo);
    const progress = Math.round((ctx.otaMaxPacketSent / totalPackets) * 100);
    ctx.setData({
      otaProgress: progress
    });
    if (ctx.lastProgressToast === undefined) {
      ctx.lastProgressToast = -1;
    }
    if (progress % 10 === 0 && progress !== ctx.lastProgressToast) {
      ctx.lastProgressToast = progress;
      console.log(`OTA发送进度: ${progress}%`);
      wx.showToast({ title: `已发送 ${progress}%`, icon: 'none', duration: 800 });
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
                
                // 将hex数组和十进制数组都保存到页面数据中
                that.setData({
                    binHexArray: hexArray,
                    binDecimalArray: decimalArray,
                    hasSelectedBinFile: true,
                    otaProgress: 0
                });
                that.otaMaxPacketSent = 0;
                that.lastProgressToast = -1;
                that.isOtaFinishSent = false;
                
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
                that.setData({
                    hasSelectedBinFile: false,
                    otaProgress: 0
                });
                that.otaMaxPacketSent = 0;
                that.lastProgressToast = -1;
                wx.showToast({
                    title: '读取文件失败',
                    icon: 'error'
                });
            }
        });
    },


      bk7258_start_ota: function () {
        ctx.otaSendIndex = 0;
        ctx.isOtaSending = false;
        ctx.otaMaxPacketSent = 0;
        ctx.lastProgressToast = -1;
        ctx.isOtaFinishSent = false;
        ctx.setData({
          otaProgress: 0
        });
        const buffer = new Array(10);
        buffer[0] = 0x55;
        buffer[1] = 0xAA;
        buffer[2] = 0x00;
        buffer[3] = 0x00;
        buffer[4] = 0x00;
        buffer[5] = 7;
        buffer[6] = 0x00;
        buffer[7] = 0x00;
        const crcResult = ctx.crc16CcittFalse_send(buffer, 8);
        buffer[8] = crcResult >> 8;
        buffer[9] = crcResult & 0x00FF;
        const buffer_str = ctx.convertDecimalArrayToHexString(buffer);
        ecBLE.writeBLECharacteristicValue(buffer_str, true);

        setTimeout(() => {
          const startBuffer = new Array(10);
          startBuffer[0] = 0x55;
          startBuffer[1] = 0xAA;
          startBuffer[2] = 0x00;
          startBuffer[3] = 0x00;
          startBuffer[4] = 0x00;
          startBuffer[5] = 1;
          startBuffer[6] = 0x00;
          startBuffer[7] = 0x00;
          const startCrc = ctx.crc16CcittFalse_send(startBuffer, 8);
          startBuffer[8] = startCrc >> 8;
          startBuffer[9] = startCrc & 0x00FF;
          const startStr = ctx.convertDecimalArrayToHexString(startBuffer);
          ecBLE.writeBLECharacteristicValue(startStr, true);
        }, 300);
      },

      bk7258_send_ota_done: function () {
        const buffer = new Array(10); // 修改为10，因为后面用到了索引9
        let buffer_str;
        buffer[0] = 0x55; //帧头1
        buffer[1] = 0xAA; //帧头2
        buffer[2] = 0x00; //SEQ高八位
        buffer[3] = 0x00; //SEQ低八位
        buffer[4] = 0x00; //是否需要回复
        buffer[5] = 5;   //操作码
        buffer[6] = 0x00; //长度高八位
        buffer[7] = 0x00; //长度低八位
        const crcResult = ctx.crc16CcittFalse_send(buffer, 8); // 计算CRC
        buffer[8] = crcResult >> 8;
        buffer[9] = crcResult & 0x00FF;
        console.log(buffer);
        buffer_str = ctx.convertDecimalArrayToHexString(buffer);
        console.log(buffer_str);
        ecBLE.writeBLECharacteristicValue(buffer_str, true)
      },







  /**将普通数组转为字符串 */
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

    /**
     * 手动发送OTA数据
     */
    manualSendOtaData() {
        ctx.handleOtaDataSend();
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
