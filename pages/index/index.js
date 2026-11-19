/**导入蓝牙库 */
const ecUI = require('../../utils/ecUI.js')
const ecBLE = require('../../utils/ecBLE.js')

/** 命令码 */
const USER_BLE_GET_VERSION = 0x00 // 获取版本号

let ctx

Page({
  data: {
    deviceListData: [],
    deviceListDataShow: [],
    fileHexContents: [], // 用于存储文件内容的十六进制字符串数组
    Overall_length: 0x00, //总长度
    Remain_length: 0x00, //剩余长度
    Already_length: 0x00, //已经发送的长度  
    DeviceOTAaddr: 0x00000020,
    Frame_seq: 0x00,
    test: 100
  },


  onLoad() {
    ctx = this
    /**定时刷新数据 */
    setInterval(() => {
      ctx.setData({
        deviceListDataShow: ctx.data.deviceListData
      })
    }, 400)
  },

  /**首次开启播报 */
  onShow() {
    wx.showToast({
      title: 'Hooch蓝牙调试',
      icon: 'none',
      duration: 5000
    });


    /**清空蓝牙设备列表信息 */
    ctx.setData({
      deviceListData: []
    })
    ctx.setData({
      deviceListDataShow: []
    })

/**如已经打开蓝牙，持续监听新设备 */
    setTimeout(() => {
      ctx.openBluetoothAdapter()
    }, 400)
  },

/**用户下拉页面时 */
  onPullDownRefresh: function () {
    ctx.setData({
      deviceListData: []
    })
    ctx.setData({
      deviceListDataShow: []
    })
/**清空蓝牙设备列表，重新刷新 */
    setTimeout(() => {
      wx.stopPullDownRefresh()
      ctx.openBluetoothAdapter()
    }, 500)
  },

/**发起蓝牙连接 */
  listViewTap(event) {
    ecUI.showLoading('设备连接中')
    console.log('开始连接')
    ecBLE.onBLEConnectionStateChange(res => {
      ecUI.hideLoading()
      if (res.ok) {
        // ecBLE.stopBluetoothDevicesDiscovery()
        wx.showToast({
          title: '连接成功',
          icon: 'success',
          duration: 3000
        });
        /**连接成功后下发获取版本号命令 */
        ctx.sendGetVersionCommand()
        //    wx.navigateTo({ url: '../device/device' })
      } else {
        ecUI.showModal(
          '提示',
          '连接失败,errCode=' + res.errCode + ',errMsg=' + res.errMsg
        )
      }
    })
    console.log('连接')
    const device = event.currentTarget.dataset.name
    ecBLE.createBLEConnection(device.id)
  },

  /**连接成功后发送获取版本号命令（只发送，不处理回复） */
  sendGetVersionCommand() {
    const buffer = new Array(10)
    buffer[0] = 0x55 // 帧头1
    buffer[1] = 0xAA // 帧头2
    buffer[2] = 0x00 // SEQ高八位
    buffer[3] = 0x00 // SEQ低八位
    buffer[4] = 0x00 // 是否需要回复
    buffer[5] = USER_BLE_GET_VERSION // 操作码
    buffer[6] = 0x00 // 长度高八位
    buffer[7] = 0x00 // 长度低八位
    const crcResult = ctx.crc16CcittFalse(buffer, 8)
    buffer[8] = (crcResult >> 8) & 0xFF
    buffer[9] = crcResult & 0xFF
    const sendHexString = buffer
      .map(num => num.toString(16).toUpperCase().padStart(2, '0'))
      .join('')
    console.log('send_get_version', sendHexString)
    ecBLE.writeBLECharacteristicValue(sendHexString, true)
  },

  /**CRC16-CCITT False */
  crc16CcittFalse(data, len) {
    let crc = 0xFFFF
    const polynomial = 0x1021
    if (!data || len === 0) {
      return crc
    }
    for (let i = 0; i < len; i++) {
      crc ^= (data[i] << 8)
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial
        } else {
          crc = crc << 1
        }
        crc &= 0xFFFF
      }
    }
    return crc
  },

  /**打开蓝牙函数 */
  openBluetoothAdapter() {

    ecBLE.onBluetoothAdapterStateChange(res => {
      if (res.ok) {
        console.log('Bluetooth adapter ok')
        ctx.startBluetoothDevicesDiscovery()
      } else {

        ecUI.showModal(
          '提示',
          '蓝牙设备搜索失败',
          // `Bluetooth adapter error | ${res.errCode} | ${res.errMsg}`,
          () => {
            if (res.errCode === 30001) {
              wx.openSystemBluetoothSetting()
            }
            if (res.errCode === 30003) {
              wx.openAppAuthorizeSetting()
            }
            if (res.errCode === 30004) {
              //跳转到小程序设置界面
              wx.openSetting()
            }
            if (res.errCode === 10001) {
              ecUI.showModal(
                '提示',
                '请打开蓝牙开关'
              )
            }

          }
        )
      }
    })
    ecBLE.openBluetoothAdapter()
  },
  startBluetoothDevicesDiscovery() {
    console.log('start search')
    ecBLE.onBluetoothDeviceFound(res => {
      if (!res.name) return;
      // 2. 只保留以Konke开头的设备（忽略大小写可加 .toLowerCase()）
   //   if (!res.name.startsWith('Konke')) return;

      
      // console.log(`id:${res.id},name:${res.name},rssi:${res.rssi}`)
      for (const item of ctx.data.deviceListData) {
        if (item.id === res.id) {
          item.name = res.name
          item.rssi = res.rssi
          item.addr = res.MacAddr
          return
        }
      }
      let manufacturer = ''
      if (res.name.length === 11 && res.name.startsWith('@')) {
        manufacturer = 'eciot'
      }
      if (res.name.length === 15 && res.name.startsWith('BT_')) {
        manufacturer = 'eciot'
      }
      ctx.data.deviceListData.push({
        id: res.id,
        name: res.name,
        addr: res.MacAddr,
        rssi: res.rssi,
        manufacturer,
      })


    })
    ecBLE.startBluetoothDevicesDiscovery()
  },












  //打开文件
  chooseAndReadFile: function () {
    //选择文件
    const that = this;
    wx.chooseMessageFile({
      count: 1,
      sizeType: ['file'],
      success(res) {
        const tempFilePath = res.tempFiles[0].path; // 获取临时文件路径 
        console.log(tempFilePath) //打印文件路径
        //使用文件管理器打开文件
        wx.getFileSystemManager().readFile({
          filePath: tempFilePath, // 文件路径  
          encoding: 'binary', // 使用二进制编码读取文件 
          success: function (res) { //读取成功
            const mybuffer = res.data
            // const view = new Uint8Array(mybuffer)
            const myhexString = that.bytesToHex(mybuffer);

            that.setData({
              fileHexContents: myhexString // 注意这里将数组替换为了包含单个元素的数组  
            });
            console.log('File content in hex:', that.data.fileHexContents);
          }

        })


      }


    });
  },
  // 辅助函数：将字节数组转换为十六进制字符串  
  bytesToHex: function (bytes) {
    const hexChars = '0123456789abcdef';
    let hex = [];
    for (let i = 0; i < bytes.length; i++) {
      const v = bytes.charCodeAt(i) & 0xFF; // 只取字节的低8位  
      hex.push(hexChars[v >> 4] + hexChars[v & 0x0F]);
    }
    return hex.join('');
  },

  ceshi: function () {
    let aaa = this
    let myyhex = [];
    let reboot = [];
    let tempnum = 0;
    //计算包大小
    aaa.data.Overall_length = aaa.data.fileHexContents.length - 64 //数据包总长度   64为包头
    aaa.data.Remain_length = aaa.data.Overall_length - aaa.data.Already_length //i计算剩余长度
    console.log('Overall_length:', aaa.data.Overall_length);
    console.log('Remain_length:', aaa.data.Remain_length);
    //填入命令
    myyhex[0] = '05' //CMD
    //填入Frame
    let Frame_seqString = aaa.data.Frame_seq.toString(16).toUpperCase();
    Frame_seqString = Frame_seqString.padStart(2, '0');
    myyhex[1] = Frame_seqString; //Frame_seq
    //填入长度
    if (aaa.data.Remain_length < 802) //如果长度不足
    {
      let zhuangtianchangdu = 0;
      zhuangtianchangdu = aaa.data.Remain_length / 2 + 4; //总包长+4
      let Remain_lengthhexString = zhuangtianchangdu.toString(16).toUpperCase();
      Remain_lengthhexString = Remain_lengthhexString.padStart(4, '0');
      myyhex[2] = Remain_lengthhexString[2] + Remain_lengthhexString[3]
      myyhex[3] = Remain_lengthhexString[0] + Remain_lengthhexString[1]
    } else {
      myyhex[2] = '95' //数据长度
      myyhex[3] = '01'
    }

    //填入地址
    let hexString = aaa.data.DeviceOTAaddr.toString(16).toUpperCase();
    hexString = hexString.padStart(8, '0');
    myyhex[7] = hexString[0] + hexString[1]
    myyhex[6] = hexString[2] + hexString[3]
    myyhex[5] = hexString[4] + hexString[5]
    myyhex[4] = hexString[6] + hexString[7]
    //填入数据
    if (aaa.data.Remain_length < 802) //如果长度不足
    {
      for (let i = 0; i < aaa.data.Remain_length; i += 2) {
        myyhex[8 + tempnum] = aaa.data.fileHexContents[64 + aaa.data.Already_length + i] + aaa.data.fileHexContents[64 + aaa.data.Already_length + i + 1]
        tempnum++;
      }
    } else {
      for (let i = 0; i < 802; i += 2) {
        myyhex[8 + tempnum] = aaa.data.fileHexContents[64 + aaa.data.Already_length + i] + aaa.data.fileHexContents[64 + aaa.data.Already_length + i + 1]
        tempnum++;
      }
    }
    //地址自增  
    aaa.data.DeviceOTAaddr += 401;
    aaa.data.Frame_seq++;
    if (aaa.data.Frame_seq == 255) {
      aaa.data.Frame_seq = 0;
    }
    //已经发送地址自增
    if (aaa.data.Remain_length > 802) {
      aaa.data.Already_length += 802
    }

    //过滤数据
    let resultString = myyhex.join("");
    let data = resultString
      .replace(/\s*/g, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '')
    //数据发送
    console.log('File:', data);
    //ecBLE.writeBLECharacteristicValue(data, true)    
    if (aaa.data.Remain_length < 802) {
      console.log('发送完成');
      reboot[0] = '07'
      reboot[1] = '00'
      reboot[2] = '00'
      reboot[3] = '00'
      let rebootresultString = reboot.join("");
      let rebootdata = rebootresultString
        .replace(/\s*/g, '')
        .replace(/\n/g, '')
        .replace(/\r/g, '')
    }
  },

})