// pages/settingpage/settingpage.js
const ecUI = require('../../utils/ecUI.js')
const ecBLE = require('../../utils/ecBLE.js')
let ctx
let sendData = ''
Page({

    /**
     * 页面的初始数据
     */
    data: {

    },

    navigate_to_change_wallpaper() { 

      wx.navigateTo({  
        url: '/pages/change_wallpaper/change_wallpaper'   
      });  
    },

    navigate_to_seawin_knx() {
      wx.navigateTo({
        url: '/pages/child_page/seawin_knx/seawin_knx'
      })
    },

    navigate_to_nor_flash_burn() {
      wx.navigateTo({
        url: '/pages/nor_flash_burn/nor_flash_burn'
      })
    },

  test_app_push_ccuid() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x0C; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x06; //长度低八位
    buffer[8] = 0x01; //SEQ高八位
    buffer[9] = 0x02; //SEQ低八位
    buffer[10] = 0x03; //是否需要回复
    buffer[11] = 0x04; //操作码
    buffer[12] = 0x05; //长度高八位
    buffer[13] = 0x06; //长度低八位
    const crcResult = ctx.crc16CcittFalse_send(buffer, 14); // 计算CRC
    buffer[14] = crcResult >> 8;
    buffer[15] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },


  test_app_push_dev_check() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x0D; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x08; //长度低八位
    buffer[8] = 0xAA;
    buffer[9] = 0x00;
    buffer[10] = 0x00; 
    buffer[11] = 0x0C;
    buffer[12] = 0x00;
    buffer[13] = 0x4F;
    buffer[14] = 0x00;
    buffer[15] = 0x4F;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 16); // 计算CRC
    buffer[16] = crcResult >> 8;
    buffer[17] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },

  test_app_push_ccu_in_ip() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x0E; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x04; //长度低八位
    buffer[8] = 192;
    buffer[9] = 168;
    buffer[10] = 1; 
    buffer[11] = 1;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 12); // 计算CRC
    buffer[12] = crcResult >> 8;
    buffer[13] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_ccu_version() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x0F; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x03; //长度低八位
    buffer[8] = 1;
    buffer[9] = 1;
    buffer[10] = 1; 
    const crcResult = ctx.crc16CcittFalse_send(buffer, 11); // 计算CRC
    buffer[11] = crcResult >> 8;
    buffer[12] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_gw_version() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x10; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x03; //长度低八位
    buffer[8] = 1;
    buffer[9] = 2;
    buffer[10] = 21; 
    const crcResult = ctx.crc16CcittFalse_send(buffer, 11); // 计算CRC
    buffer[11] = crcResult >> 8;
    buffer[12] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_zigbee_version() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x13; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x03; //长度低八位
    buffer[8] = 3;
    buffer[9] = 2;
    buffer[10] = 2; 
    const crcResult = ctx.crc16CcittFalse_send(buffer, 11); // 计算CRC
    buffer[11] = crcResult >> 8;
    buffer[12] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_gw_ip() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x12; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x04; //长度低八位
    buffer[8] = 192;
    buffer[9] = 168;
    buffer[10] = 1; 
    buffer[11] = 2;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 12); // 计算CRC
    buffer[12] = crcResult >> 8;
    buffer[13] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },

  test_app_push_gw_mac() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x11; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x08; //长度低八位
    buffer[8] = 0xAA;
    buffer[9] = 0x00;
    buffer[10] = 0x00; 
    buffer[11] = 0x0C;
    buffer[12] = 0x00;
    buffer[13] = 0x4F;
    buffer[14] = 0x00;
    buffer[15] = 0x4F;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 16); // 计算CRC
    buffer[16] = crcResult >> 8;
    buffer[17] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },

  test_app_push_ac_name() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x14; //操作码
    buffer[6] = 0x00; //长度
    buffer[7] = 0x07; //长度低八位
    buffer[8] = 6;
    buffer[9] = 0xE7;
    buffer[10] = 0xA9;
    buffer[11] = 0xBA;
    buffer[12] =0xE7;
    buffer[13] = 0x94;
    buffer[14] =0xB0;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 15); // 计算CRC
    buffer[15] = crcResult >> 8;
    buffer[16] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_ac_room_name() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x15; //操作码
    buffer[6] = 0x00; //长度
    buffer[7] = 0x07; //长度低八位
    buffer[8] = 6;
    buffer[9] = 0xE7;
    buffer[10] = 0xA9;
    buffer[11] = 0xBA;
    buffer[12] =0xE7;
    buffer[13] = 0x94;
    buffer[14] =0xB0;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 15); // 计算CRC
    buffer[15] = crcResult >> 8;
    buffer[16] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_fh_name() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x16; //操作码
    buffer[6] = 0x00; //长度
    buffer[7] = 0x07; //长度低八位
    buffer[8] = 6;
    buffer[9] = 0xE7;
    buffer[10] = 0xA9;
    buffer[11] = 0xBA;
    buffer[12] =0xE7;
    buffer[13] = 0x94;
    buffer[14] =0xB0;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 15); // 计算CRC
    buffer[15] = crcResult >> 8;
    buffer[16] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_fh_room_name() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x17; //操作码
    buffer[6] = 0x00; //长度
    buffer[7] = 0x07; //长度低八位
    buffer[8] = 6;
    buffer[9] = 0xE7;
    buffer[10] = 0xA9;
    buffer[11] = 0xBA;
    buffer[12] =0xE7;
    buffer[13] = 0x94;
    buffer[14] =0xB0;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 15); // 计算CRC
    buffer[15] = crcResult >> 8;
    buffer[16] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_mv_name() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x18; //操作码
    buffer[6] = 0x00; //长度
    buffer[7] = 0x07; //长度低八位
    buffer[8] = 6;
    buffer[9] = 0xE7;
    buffer[10] = 0xA9;
    buffer[11] = 0xBA;
    buffer[12] =0xE7;
    buffer[13] = 0x94;
    buffer[14] =0xB0;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 15); // 计算CRC
    buffer[15] = crcResult >> 8;
    buffer[16] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_mv_room_name() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x19; //操作码
    buffer[6] = 0x00; //长度
    buffer[7] = 0x07; //长度低八位
    buffer[8] = 6;
    buffer[9] = 0xE7;
    buffer[10] = 0xA9;
    buffer[11] = 0xBA;
    buffer[12] =0xE7;
    buffer[13] = 0x94;
    buffer[14] =0xB0;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 15); // 计算CRC
    buffer[15] = crcResult >> 8;
    buffer[16] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },

















  test_app_push_done() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x1A; //操作码
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
  test_app_push_ac_mac() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x1B; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x08; //长度低八位
    buffer[8] = 0xAA;
    buffer[9] = 0x00;
    buffer[10] = 0x00; 
    buffer[11] = 0x0C;
    buffer[12] = 0x00;
    buffer[13] = 0x4F;
    buffer[14] = 0x00;
    buffer[15] = 0x4F;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 16); // 计算CRC
    buffer[16] = crcResult >> 8;
    buffer[17] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_mv_mac() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x1C; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x08; //长度低八位
    buffer[8] = 0xAA;
    buffer[9] = 0x00;
    buffer[10] = 0x00; 
    buffer[11] = 0x0C;
    buffer[12] = 0x00;
    buffer[13] = 0x4F;
    buffer[14] = 0x00;
    buffer[15] = 0x4F;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 16); // 计算CRC
    buffer[16] = crcResult >> 8;
    buffer[17] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },
  test_app_push_fh_mac() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x1D; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x08; //长度低八位
    buffer[8] = 0xAA;
    buffer[9] = 0x00;
    buffer[10] = 0x00; 
    buffer[11] = 0x0C;
    buffer[12] = 0x00;
    buffer[13] = 0x4F;
    buffer[14] = 0x00;
    buffer[15] = 0x4F;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 16); // 计算CRC
    buffer[16] = crcResult >> 8;
    buffer[17] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },



    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {


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

    lengthToHexString(length, uppercase = true, minLength = 2) {
      // 校验输入是否为有效数字
      if (typeof length !== 'number' || isNaN(length) || length < 0) {
        console.error('无效的数组长度：', length);
        return '00'; // 默认返回00
      }
  
      // 1. 十进制转十六进制字符串
      let hexStr = Math.floor(length).toString(16);
  
      // 2. 补前导0（确保长度不小于minLength）
      if (minLength > 0) {
        hexStr = hexStr.padStart(minLength, '0');
      }
  
      // 3. 转为大写（默认开启）
      if (uppercase) {
        hexStr = hexStr.toUpperCase();
      }
  
      return hexStr;
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
  
  
    /**将字节数组转为十六进制字符串 */
    bytesToHex: function (bytes) {
      const hexChars = '0123456789abcdef';
      let hex = [];
      for (let i = 0; i < bytes.length; i++) {
        const v = bytes.charCodeAt(i) & 0xFF; // 只取字节的低8位  
        hex.push(hexChars[v >> 4] + hexChars[v & 0x0F]);
      }
      return hex.join('');
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
