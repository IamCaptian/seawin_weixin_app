const regeneratorRuntime = require('./regenerator/runtime.js')
const ecGBK = require('./ecGBK/ecGBK.js')
/**是否开启日志 */
const logEnable = false
/**是否是安卓设备*/
let isAndroid = false

const ECBLEChineseTypeUTF8 = "utf8"
const ECBLEChineseTypeGBK = "gbk"
let ecBLEChineseType = ECBLEChineseTypeGBK


const setChineseType = (typeStr) => {
  if (typeStr === ECBLEChineseTypeGBK) {
    ecBLEChineseType = ECBLEChineseTypeGBK
  } else {
    ecBLEChineseType = ECBLEChineseTypeUTF8
  }
}

let ecBluetoothAdapterStateChangeCallback = () => {}
let ecBLEConnectionStateChangeCallback = () => {}

let ecDeviceId = ''

/**获取到的UUID */
let ecGattServerUUID = ''
/**支持的UUID */
const ecGattServerUUIDOption1 = '0000FA00-0000-1000-8000-00805F9B34FB'
const ecGattServerUUIDOption2 = 'FFF0'
const ecGattServerUUIDOption3 = 'F000FFC0-0451-4000-B000-000000000000'

 /*OM6627 TSPP服务 0000FF01-0000-1000-8000-00805F9B34FB*/
/*OM6627   DFU服务 0000FE59-0000-1000-8000-00805F9B34FB*/
const ecGattServerUUIDOption4 = '0000FF01-0000-1000-8000-00805F9B34FB' /*OM6627 DFU服务 */
const ecGattServerUUIDOption5 = '5833ff01-9b8b-5191-6142-22a4536ef123' /*李工蓝牙透传 DFU服务 */


/**获取到的特征值 */
let ecGattCharacteristicWriteUUID = ''
let ecGattCharacteristicWriteUUIDScore = -1
/**支持的特征值 */
const ecGattCharacteristicWriteUUIDOption1 = '0000EA05-0000-1000-8000-00805F9B34FB'
const ecGattCharacteristicWriteUUIDOption2 = '0000EA05-0000-1000-8000-00805F9B34FB'
 /*OM6627 DFU服务 读写 00000003-0000-1000-8000-00805F9B34FB*/
const ecGattCharacteristicWriteUUIDOption3 = '0000FF02-0000-1000-8000-00805F9B34FB'
const ecGattCharacteristicWriteUUIDOption4 = '5833FF02-9B8B-5191-6142-22A4536EF123'




const log = data => {
  if (logEnable) {
    console.log('[eciot]:' + JSON.stringify(data))
  }
}

const onBluetoothAdapterStateChange = cb => {
  ecBluetoothAdapterStateChangeCallback = cb
}
const getSetting = () => {
  return new Promise(function (resolve, reject) {
    wx.getSetting({
      success(res) {
        log(res)
        if (res.authSetting && res.authSetting['scope.bluetooth']) {
          resolve({
            ok: true,
            errCode: 0,
            errMsg: ''
          })
        } else {
          resolve({
            ok: false,
            errCode: 30001,
            errMsg: 'getSetting fail',
          })
        }
      },
      fail(res) {
        log(res)
        resolve({
          ok: false,
          errCode: res.errCode ? res.errCode : 30000,
          errMsg: res.errMsg ? res.errMsg : 'getSetting fail',
        })
      },
    })
  })
}
const authorize = () => {
  return new Promise(function (resolve, reject) {
    wx.authorize({
      scope: 'scope.bluetooth',
      success(res) {
        log(res)
        resolve({
          ok: true,
          errCode: 0,
          errMsg: ''
        })
      },
      fail(res) {
        log(res)
        // {"errMsg":"authorize:fail:auth deny"}
        resolve({
          ok: false,
          errCode: 30000,
          errMsg: res.errMsg
        })
      },
    })
  })
}
const _openBluetoothAdapter = () => {
  return new Promise(function (resolve, reject) {

    wx.authorize({
      scope: 'scope.bluetooth',
      success() {
        // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
        //   wx.startRecord()
      }
    })
    wx.openBluetoothAdapter({
      success(res) {
        log(res)
        console.log('蓝牙打开成功')
        // {errno: 0, errMsg: "openBluetoothAdapter:ok"}
        resolve({
          ok: true,
          errCode: 0,
          errMsg: ''
        })
      },
      fail(res) {
        console.log(res)
        console.log('蓝牙打开失败')
        resolve({
          ok: false,
          errCode: res.errCode ? res.errCode : 30000,
          errMsg: res.errMsg,
        })
      },
    })
  })
}
const openBluetoothAdapter = async () => {
  await _openBluetoothAdapter()
  const systemInfo = wx.getDeviceInfo()

  console.log(systemInfo)
  console.log(systemInfo.bluetoothEnabled)
  if (systemInfo.platform.toLowerCase() === 'android') {
    isAndroid = true
  }
  // if (!systemInfo.bluetoothEnabled) {
  //     ecBluetoothAdapterStateChangeCallback({
  //         ok: false,
  //         errCode: 30001,
  //         errMsg: '请打开系统蓝牙开关',
  //     })
  //     return
  // }
  // if (isAndroid && !systemInfo.locationEnabled) {
  //     ecBluetoothAdapterStateChangeCallback({
  //         ok: false,
  //         errCode: 30002,
  //         errMsg: '请打开系统定位开关',
  //     })
  //     return
  // }
  // if (isAndroid && !systemInfo.locationAuthorized) {
  //     ecBluetoothAdapterStateChangeCallback({
  //         ok: false,
  //         errCode: 30003,
  //         errMsg: '请打开微信定位权限，允许微信使用您的位置信息',
  //     })
  //     return
  // }
  const setting = await getSetting() //小程序蓝牙权限
  if (!setting.ok) {
    const authRes = await authorize()
    if (!authRes.ok) {
      ecBluetoothAdapterStateChangeCallback({
        ok: false,
        errCode: 30004,
        errMsg: '请打开小程序蓝牙开关，点击右上角三个点，然后点击设置',
      })
      return
    }
  }
  wx.offBluetoothAdapterStateChange()
  wx.onBluetoothAdapterStateChange(res => {
    log(res) // {available: true, discovering: true}
    if (!res.available) {
      ecBluetoothAdapterStateChangeCallback({
        ok: false,
        errCode: 30005,
        errMsg: '蓝牙适配器不可用',
      })
    }
  })
  const openRes = await _openBluetoothAdapter()
  ecBluetoothAdapterStateChangeCallback(openRes)
}

const onBluetoothDeviceFound = cb => {
  wx.offBluetoothDeviceFound()
  wx.onBluetoothDeviceFound(res => {
    // log(res)
    const device = res.devices[0]
    const name = device.name ? device.name : device.localName
    if (!name) {
      return
    }
    let id = device.deviceId
    let rssi = device.RSSI
    let userdeviceId = device.deviceId
    let useradvertisServiceUUIDs = device.advertisServiceUUIDs

    let MacAddr = '';
    let arrayBuffer = device.advertisData; // 创建一个16字节的ArrayBuffer  
    let uint8Array = new Uint8Array(arrayBuffer);
    for (let number of uint8Array) {
      // 确保数字在0-255的范围内（一个字节的大小）  
      if (number < 0 || number > 255) {
        console.log('错误');
      }
      // 将每个数字转换为两位的十六进制字符串，并添加到hexString中  
      let hexByte = number.toString(16).padStart(2, '0');
      MacAddr += hexByte;
    }
    let resultq = MacAddr[2] + MacAddr[3]
    let decimalValue = parseInt(resultq, 16).toString();
    decimalValue = decimalValue - 1
    // console.log(resultq);
    // console.log(decimalValue);
    const hex_1 = decimalValue.toString(16).toUpperCase();
    MacAddr = MacAddr[11] + MacAddr[10] + MacAddr[9] + MacAddr[8] + MacAddr[6] + MacAddr[7] + MacAddr[4] + MacAddr[5] + hex_1 + MacAddr[0] + MacAddr[1];
    let result = '';
    for (let i = 0; i < MacAddr.length; i++) {
      result += MacAddr[i];
      if ((i + 1) % 2 === 0 && i !== MacAddr.length - 1) {
        result += '-';
      }
    }
    MacAddr = result;
    MacAddr = 'MAC:' + MacAddr;




    // console.log(device.name);
    // console.log(device);
    // console.log(MacAdde);  // 如果需要，可以在十六进制字符串中添加分隔符（如冒号、连字符等）  
    // 例如：hexString = hexString.match(/.{1,2}/g)?.join(':') ?? '';  
    // 但在这个例子中，我们直接返回没有分隔符的十六进制字符串  

    cb({
      id,
      name,
      rssi,
      MacAddr
    })
  })



}


let scanFlag = false
const startBluetoothDevicesDiscovery = () => {
  if (scanFlag === false) {
    wx.startBluetoothDevicesDiscovery({
      //services: [ecServerId],
      allowDuplicatesKey: true,
      powerLevel: 'high',
      complete(res) {
        log(res)
      },
    })
    scanFlag = true
  }
}
const stopBluetoothDevicesDiscovery = () => {
  if (scanFlag) {
    wx.stopBluetoothDevicesDiscovery({
      complete(res) {
        // {errno: 0, errMsg: "stopBluetoothDevicesDiscovery:ok", isDiscovering: false}
        log(res)
      },
    })
    scanFlag = false
  }
}

const onBLEConnectionStateChange = cb => {
  ecBLEConnectionStateChangeCallback = cb
}
const _createBLEConnection = () => {
  return new Promise(function (resolve, reject) {
    wx.createBLEConnection({

      deviceId: ecDeviceId,

      success(res) {
        console.log(res)
        // {"errno":0,"errCode":0,"errMsg":"createBLEConnection:ok"}
        resolve({
          ok: true,
          errCode: 0,
          errMsg: ''
        })
      },
      fail(res) {
        console.log(res)
        // {"errno":1001,"errMsg":"createBLEConnection:fail parameter error: parameter.deviceId should be String instead of Undefined;"}
        resolve({
          ok: false,
          errCode: res.errCode ? res.errCode : res.errno,
          errMsg: res.errMsg,
        })
      },
    })
  })
}
const getBLEDeviceServices = () => {
  return new Promise(function (resolve, reject) {
    wx.getBLEDeviceServices({
      deviceId: ecDeviceId,
      success(res) {
        log(res)
        //{"services":[{"uuid":"0000FFF0-0000-1000-8000-00805F9B34FB","isPrimary":true}],"errCode":0,"errno":0,"errMsg":"getBLEDeviceServices:ok"}
        // {"errno":0,"deviceId":"7C7E20F2-CB75-6DA8-F8DF-FFF702B0D63F","services":[{"isPrimary":true,"uuid":"0000FFF0-0000-1000-8000-00805F9B34FB"}],"errMsg":"getBLEDeviceServices:ok","errCode":0}
        resolve({
          ok: true,
          errCode: 0,
          errMsg: '',
          services: res.services,
        })
      },
      fail(res) {
        log(res)
        resolve({
          ok: false,
          errCode: res.errCode,
          errMsg: res.errMsg
        })
      },
    })
  })
}
const getBLEDeviceCharacteristics = serviceId => {
  return new Promise(function (resolve, reject) {
    wx.getBLEDeviceCharacteristics({
      deviceId: ecDeviceId,
      serviceId,
      success(res) {
        log(res)
        // {"characteristics":[{"uuid":"0000FFF2-0000-1000-8000-00805F9B34FB","handle":3,"properties":{"read":false,"write":true,"notify":false,"indicate":false,"writeNoResponse":true,"writeDefault":true}},{"uuid":"0000FFF1-0000-1000-8000-00805F9B34FB","handle":5,"properties":{"read":true,"write":true,"notify":true,"indicate":false,"writeNoResponse":true,"writeDefault":true}}],"errCode":0,"errno":0,"errMsg":"getBLEDeviceCharacteristics:ok"}
        // {"characteristics":[{"properties":{"writeDefault":true,"notify":false,"write":true,"indicate":false,"read":false,"writeNoResponse":true},"uuid":"0000FFF2-0000-1000-8000-00805F9B34FB"},{"properties":{"writeDefault":true,"notify":true,"write":true,"indicate":false,"read":true,"writeNoResponse":true},"uuid":"0000FFF1-0000-1000-8000-00805F9B34FB"}],"deviceId":"7C7E20F2-CB75-6DA8-F8DF-FFF702B0D63F","serviceId":"0000FFF0-0000-1000-8000-00805F9B34FB","errno":0,"errMsg":"getBLEDeviceCharacteristics:ok","errCode":0}
        resolve({
          ok: true,
          errCode: 0,
          errMsg: '',
          characteristics: res.characteristics,
        })
      },
      fail(res) {
        log(res)
        resolve({
          ok: false,
          errCode: res.errCode,
          errMsg: res.errMsg
        })
      },
    })
  })
}
const notifyBLECharacteristicValueChange = (serviceId, characteristicId) => {
  return new Promise(function (resolve, reject) {
    wx.notifyBLECharacteristicValueChange({
      state: true,
      deviceId: ecDeviceId,
      serviceId,
      characteristicId,
      success(res) {
        log(res)
        // {"errCode":0,"errno":0,"errMsg":"notifyBLECharacteristicValueChange:ok"}
        resolve({
          ok: true,
          errCode: 0,
          errMsg: ''
        })
      },
      fail(res) {
        log(res)
        resolve({
          ok: false,
          errCode: res.errCode,
          errMsg: res.errMsg
        })
      },
    })
  })
}
const setBLEMTU = mtu => {
  return new Promise(function (resolve, reject) {
    wx.setBLEMTU({
      deviceId: ecDeviceId,
      mtu,
      success(res) {
        log(res)
        // {"errMsg":"setBLEMTU:ok","errno":0,"errCode":0,"mtu":50}
        resolve({
          ok: true,
          errCode: 0,
          errMsg: ''
        })
      },
      fail(res) {
        log(res)
        // {"errCode":-1,"errno":1500104,"errMsg":"setBLEMTU:fail:internal error"}
        resolve({
          ok: false,
          errCode: res.errCode,
          errMsg: res.errMsg
        })
      },
    })
  })
}



//和设备建立连接
const createBLEConnection = async id => {
  ecDeviceId = id
  ecGattServerUUID = ''
  ecGattCharacteristicWriteUUID = ''
  ecGattCharacteristicWriteUUIDScore = -1
  wx.offBLEConnectionStateChange()
  wx.onBLEConnectionStateChange(async res => {
    console.log(res)
    // {"deviceId":"EC:22:05:13:78:49","connected":true}
    if (res.connected) {
      console.log('连接成功')
      const servicesResult = await getBLEDeviceServices()
      console.log(servicesResult)
      if (!servicesResult.ok) {
        ecBLEConnectionStateChangeCallback(servicesResult)
        closeBLEConnection()
        return
      }
      for (const service of servicesResult.services) {
        if ((service.uuid.toUpperCase() === ecGattServerUUIDOption1) ||
          (service.uuid.toUpperCase() === ecGattServerUUIDOption2) ||
          (service.uuid.toUpperCase() === ecGattServerUUIDOption3) ||
          (service.uuid.toUpperCase() === ecGattServerUUIDOption4||
          service.uuid.toUpperCase() === ecGattServerUUIDOption5)) {
          ecGattServerUUID = service.uuid
          console.log('成功获取UUID')
          console.log(ecGattServerUUID)
        }

        /**获取蓝牙设备中服务（Service）包含的所有特征值（Characteristic）信息 */
        const characteristicsResult = await getBLEDeviceCharacteristics(
          service.uuid
        )


        if (!characteristicsResult.ok) {
          ecBLEConnectionStateChangeCallback(characteristicsResult)
          closeBLEConnection()
          return
        }

        for (const characteristic of characteristicsResult.characteristics) {
          if (
            characteristic.properties &&
            characteristic.properties.notify
          ) {

            const notifyResult =
              await notifyBLECharacteristicValueChange(
                service.uuid,
                characteristic.uuid
              )
            if (!notifyResult.ok) {
              ecBLEConnectionStateChangeCallback({
                ok: false,
                errCode: 30000,
                errMsg: 'notify error',
              })
              closeBLEConnection()
              return
            }
          }

          const upperCharacteristicUUID = characteristic.uuid.toUpperCase()
          let currentScore = -1
          if (upperCharacteristicUUID === ecGattCharacteristicWriteUUIDOption3) {
            currentScore = 40
          } else if (
            upperCharacteristicUUID === ecGattCharacteristicWriteUUIDOption1 ||
            upperCharacteristicUUID === ecGattCharacteristicWriteUUIDOption2 ||
            upperCharacteristicUUID === ecGattCharacteristicWriteUUIDOption4
          ) {
            currentScore = 10
          }

          if (currentScore >= 0) {
            console.log('支持的特征值')
            console.log(characteristic.uuid)
            if (currentScore > ecGattCharacteristicWriteUUIDScore) {
              ecGattCharacteristicWriteUUIDScore = currentScore
              ecGattCharacteristicWriteUUID = characteristic.uuid
            }
          } else {
            console.log('不支持特征值')
            console.log(characteristic.uuid)
          }

        }
      }
      if (isAndroid) {
        await setBLEMTU(247)
      }
      ecBLEConnectionStateChangeCallback({
        ok: true,
        errCode: 0,
        errMsg: '',
      })
    } else {
      console.log('失败')
      ecBLEConnectionStateChangeCallback({
        ok: false,
        errCode: 0,
        errMsg: 'disconnect',
      })
    }
  })
  console.log('4')
  const res = await _createBLEConnection()
  if (!res.ok) {
    console.log('5')
    ecBLEConnectionStateChangeCallback(res)
  }
}
//关闭当前连接
const closeBLEConnection = () => {
  wx.closeBLEConnection({
    deviceId: ecDeviceId,
    complete(res) {
      log(res)
    },
  })
}

const onBLECharacteristicValueChange = cb => {
  wx.offBLECharacteristicValueChange()
  wx.onBLECharacteristicValueChange(res => {
    log(res)
    let x = new Uint8Array(res.value)
    log(x)
    let str
    if (ecBLEChineseType === ECBLEChineseTypeGBK) {
      str = ecGBK.ecGBKBytesToStr(x)
    } else {
      str = utf8BytesToStr(x)
    }
    let strHex = bytesToHexStr(x)
    log(str)
    log(strHex)
    cb(str, strHex)
  })
}

const _writeBLECharacteristicValue = buffer => {
  return new Promise(function (resolve, reject) {
    wx.writeBLECharacteristicValue({
      deviceId: ecDeviceId,
      serviceId: ecGattServerUUID,
      characteristicId: ecGattCharacteristicWriteUUID,
      // characteristicId: 'F000FFC2-0451-4000-B000-000000000000',
      value: buffer,
      writeType: 'write',
      // writeType: 'write',
      success(res) {
        console.log(ecDeviceId)
        console.log(ecGattServerUUID)
        console.log(ecGattCharacteristicWriteUUID)
        console.log('发送成功')
        console.log(res)
        // {"errno":0,"errCode":0,"errMsg":"writeBLECharacteristicValue:ok"}
        resolve({
          ok: true,
          errCode: 0,
          errMsg: ''
        })
        // wx.readBLECharacteristicValue({
        //   deviceId: ecDeviceId, // 必须是已通过 createBLEConnection 连接的设备ID
        //   serviceId: ecGattServerUUID, // 从 getBLEDeviceServices 获取
        //   characteristicId: ecGattCharacteristicWriteUUID, // 从 getBLEDeviceCharacteristics 获取（需支持read属性）
        //   success(res) {
        //     console.log('读取请求发送成功（等待设备返回数据）', res.errCode);
        //     // 注意：这里的 success 不代表“已获取数据”，仅表示“请求已发出”
        //   },
        //   fail(err) {
        //     console.error('读取请求发送失败', err);
        //     // 失败原因可能：设备未连接、特征值不支持read、参数错误等
        //   }
        // });
      },
      fail(res) {
        console.log('发送失败')
        console.log(ecDeviceId)
        console.log(ecGattServerUUID)
        console.log(ecGattCharacteristicWriteUUID)
        console.log(res)
        resolve({
          ok: false,
          errCode: res.errCode,
          errMsg: res.errMsg
        })
      },
    })
  })
}







const writeBLECharacteristicValue = async (str, isHex) => {
  if (str.length === 0)
    return {
      ok: false,
      errCode: 30000,
      errMsg: 'data is null'
    }
  let buffer
  if (isHex) {
    buffer = new Uint8Array(hexStrToBytes(str)).buffer
  } else {
    if (ecBLEChineseType === ECBLEChineseTypeGBK) {
      buffer = new Uint8Array(ecGBK.ecStrToGBKBytes(str)).buffer
    } else {
      buffer = new Uint8Array(strToUTF8Bytes(str)).buffer
    }
  }
  console.log(buffer)
  return await _writeBLECharacteristicValue(buffer)
}

// 直接发送ArrayBuffer（用于OTA快速发送）
const writeBLECharacteristicValueBuffer = async (arrayBuffer) => {
  if (!arrayBuffer)
    return {
      ok: false,
      errCode: 30000,
      errMsg: 'data is null'
    }
  return await _writeBLECharacteristicValue(arrayBuffer)
}

const bytesToHexStr = bytes => {
  let strHex = ''
  for (let i = 0; i < bytes.length; i++) {
    strHex = strHex + bytes[i].toString(16).padStart(2, '0').toUpperCase()
  }
  return strHex
}
const hexStrToBytes = hexStr => {
  let bytes = []
  for (let i = 0; i < (hexStr.length / 2); i++) {
    bytes.push(parseInt(hexStr.substr(2 * i, 2), 16))
  }
  return bytes
}
const utf8BytesToStr = utf8Bytes => {
  let unicodeStr = ''
  for (let pos = 0; pos < utf8Bytes.length;) {
    let flag = utf8Bytes[pos]
    let unicode = 0
    if (flag >>> 7 === 0) {
      unicodeStr += String.fromCharCode(utf8Bytes[pos])
      pos += 1
    }
    // else if ((flag & 0xFC) === 0xFC) {
    //     unicode = (utf8Bytes[pos] & 0x3) << 30
    //     unicode |= (utf8Bytes[pos + 1] & 0x3F) << 24
    //     unicode |= (utf8Bytes[pos + 2] & 0x3F) << 18
    //     unicode |= (utf8Bytes[pos + 3] & 0x3F) << 12
    //     unicode |= (utf8Bytes[pos + 4] & 0x3F) << 6
    //     unicode |= (utf8Bytes[pos + 5] & 0x3F)
    //     unicodeStr += String.fromCharCode(unicode)
    //     pos += 6
    // }
    // else if ((flag & 0xF8) === 0xF8) {
    //     unicode = (utf8Bytes[pos] & 0x7) << 24
    //     unicode |= (utf8Bytes[pos + 1] & 0x3F) << 18
    //     unicode |= (utf8Bytes[pos + 2] & 0x3F) << 12
    //     unicode |= (utf8Bytes[pos + 3] & 0x3F) << 6
    //     unicode |= (utf8Bytes[pos + 4] & 0x3F)
    //     unicodeStr += String.fromCharCode(unicode)
    //     pos += 5
    // }
    else if ((flag & 0xf0) === 0xf0) {
      unicode = (utf8Bytes[pos] & 0xf) << 18
      unicode |= (utf8Bytes[pos + 1] & 0x3f) << 12
      unicode |= (utf8Bytes[pos + 2] & 0x3f) << 6
      unicode |= utf8Bytes[pos + 3] & 0x3f
      unicodeStr += String.fromCharCode(unicode)
      pos += 4
    } else if ((flag & 0xe0) === 0xe0) {
      unicode = (utf8Bytes[pos] & 0x1f) << 12
      unicode |= (utf8Bytes[pos + 1] & 0x3f) << 6
      unicode |= utf8Bytes[pos + 2] & 0x3f
      unicodeStr += String.fromCharCode(unicode)
      pos += 3
    } else if ((flag & 0xc0) === 0xc0) {
      //110
      unicode = (utf8Bytes[pos] & 0x3f) << 6
      unicode |= utf8Bytes[pos + 1] & 0x3f
      unicodeStr += String.fromCharCode(unicode)
      pos += 2
    } else {
      unicodeStr += String.fromCharCode(utf8Bytes[pos])
      pos += 1
    }
  }
  return unicodeStr
}
const strToUTF8Bytes = str => {
  let bytes = []
  for (let i = 0; i < str.length; ++i) {
    let code = str.charCodeAt(i)
    if (code >= 0x10000 && code <= 0x10ffff) {
      bytes.push((code >> 18) | 0xf0) // 第一个字节
      bytes.push(((code >> 12) & 0x3f) | 0x80)
      bytes.push(((code >> 6) & 0x3f) | 0x80)
      bytes.push((code & 0x3f) | 0x80)
    } else if (code >= 0x800 && code <= 0xffff) {
      bytes.push((code >> 12) | 0xe0)
      bytes.push(((code >> 6) & 0x3f) | 0x80)
      bytes.push((code & 0x3f) | 0x80)
    } else if (code >= 0x80 && code <= 0x7ff) {
      bytes.push((code >> 6) | 0xc0)
      bytes.push((code & 0x3f) | 0x80)
    } else {
      bytes.push(code)
    }
  }
  return bytes
}

module.exports = {
  ECBLEChineseTypeUTF8,
  ECBLEChineseTypeGBK,
  setChineseType,
  onBluetoothAdapterStateChange,
  openBluetoothAdapter,
  onBluetoothDeviceFound,
  startBluetoothDevicesDiscovery,
  stopBluetoothDevicesDiscovery,
  onBLEConnectionStateChange,
  createBLEConnection,
  closeBLEConnection,
  onBLECharacteristicValueChange,
  writeBLECharacteristicValue,
  writeBLECharacteristicValueBuffer,
}
