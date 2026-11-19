// pages/device.js
const ecUI = require('../../utils/ecUI.js')
const ecBLE = require('../../utils/ecBLE.js')

let ctx
let sendData = ''

Page({
  /**
   * 页面的初始数据
   */
  data: {
    User_ReceveData: [], // 接收设备发送回来的数据
    User_SendData: [], // 准备发送的数据
    User_BinData: [], //处理好的升级包数据
    User_Receve_SEQ: 0, //接收到的SEQ

    Last_SEQ: 9999, //上一次存放的SEQ（用于跟最新的作比较,初始值给大一点）

    send_buffer_count: 0, //发送地址计数，递增

    Last_send_buffer_count: 0, //上一次发送的地址

    send_pack_count: 0, //发送数据包计数 递增

    Last_send_pack_count: 0, //上一次发送的pack

    intervalId: null, // 存储定时器ID，用于停止定时任务

    download_progress: 0, // OTA进度条
    show_ota_mode_button: false, //是否显示进入OTA按钮
    show_start_ota_button: false, //是否显示开始OTA按钮


    Device_Info: {
      Integrator: "等待获取", // 预设集成商信息
      Version: "等待获取", // 预设版本号
      upgrade: "等待获取" // 预设升级信息
    },
    Device_version_dec: [], // 设备版本信息转十进制(用于与服务器版本比对信息)

    KonKe_Standard_Edition_postData: { //控客标准版请求接口
      //"markOne": "background_image",
      "markOne": "firmware_for_the_device",
      "markThree": "Standard",
      "markTwo": "Konke"
    },
    XiaoMi_Standard_Edition_postData: { //小米标准版请求接口
      "markOne": "firmware_for_the_device",
      "markThree": "Standard",
      "markTwo": "XiaoMi"
    },
    Tuya_Standard_Edition_postData: { //涂鸦标准版请求接口
      "markOne": "firmware_for_the_device",
      "markThree": "Standard",
      "markTwo": "Tuya"
    },

    get_cloud_server_version: [], //获取服务器的版本
    cloud_version_dec: [], // 服务器版本信息转十进制
    is_into_ota_mode: false, //是否进入OTA版本
    is_device_update: false, // 设备是否有升级
    is_ento_ota_process: false, // 是否在OTA进程中
  },

  /**加载页面 */
  onLoad() {
    ctx = this
    sendData = ''
    ecBLE.setChineseType(ecBLE.ECBLEChineseTypeGBK)
    /**监听BLE消息 */
    ecBLE.onBLECharacteristicValueChange((str, strHex) => {
      //接收新消息前，清空缓存
      this.setData({
        User_ReceveData: [], // 接收设备发送回来的数据
      });
      let tempdata = 0
      /*将收到的所有十六进制字符存入缓冲器 */
      for (let i = 0; i < strHex.length; i += 2) {
        ctx.data.User_ReceveData[tempdata] = strHex[i] + strHex[i + 1]
        tempdata++
      }
      /*将十六进制字符转为十进制数组 */
      const decimalArray = ctx.data.User_ReceveData.map(hexStr => parseInt(hexStr, 16));
      /*计算CRC结果 */
      const crcResult = ctx.crc16CcittFalse_send(decimalArray, decimalArray.length - 2); // 计算CRC
      console.log("device_接收CRC", crcResult.toString(16));
      /*取接收到的数据包CRC */
      let concatenatedHex = ctx.data.User_ReceveData[ctx.data.User_ReceveData.length - 2] + ctx.data.User_ReceveData[ctx.data.User_ReceveData.length - 1];
      /*CRC字符转十进制 */
      console.log("device_发送CRC", concatenatedHex);
      const hexToDecimal = parseInt(concatenatedHex, 16);
      /**对接收到的数据CRC与数据的CRC比对 */
      if (hexToDecimal == crcResult) {
        ctx.handleArrayByFifthItem(ctx.data.User_ReceveData);
      }
    })
  },

  /**关闭页面 */
  onUnload() {
    console.log('页面被卸载');
    ecBLE.onBLEConnectionStateChange(() => {})
    ecBLE.onBLECharacteristicValueChange(() => {})
    ecBLE.closeBLEConnection()
  },

  /**获取系统版本 */
  get_dev_version: function () {
    const buffer = new Array(9);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x00; //操作码
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


  //打开文件
  chooseAndReadFile: function () {
    wx.showToast({
      title: '非技术人员慎用此功能', // 弹窗提示文字
      icon: 'none', // 不显示图标（可选：'success'/'loading'/'none'）
      duration: 5000, // 显示时长（毫秒），默认1500，这里设为10000=10秒
      mask: true // 是否显示遮罩层（禁止背景点击，可选）
    });
    //选择文件
    let tempcount = 0
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
            const myhexString = ctx.bytesToHex(mybuffer);
            for (let i = 0; i < myhexString.length; i += 2) {
              ctx.data.User_BinData[tempcount] = myhexString[i] + myhexString[i + 1]
              tempcount++
            }
            /*文件加载完毕，显示开始升级按钮 */
            ctx.setData({
              show_ota_mode_button: true,
              show_start_ota_button: true
            });
            // console.log('File content in hex:', that.data.User_BinData[that.data.User_BinData.length - 4]);
            // console.log('File content in hex:', that.data.User_BinData[that.data.User_BinData.length - 3]);
            // console.log('File content in hex:', that.data.User_BinData[that.data.User_BinData.length - 2]);
            // console.log('File content in hex:', that.data.User_BinData[that.data.User_BinData.length - 1]);
          }
        })
      }
    });
  },

  /**发送升级数据包*/
  sendNextPackage: function (seq) {
    let buffer_str; //发送缓存buff
    let send_buffer_count; //发送buffer地址
    let send_pack_count; //发送的总包pack
    let hexParts; //数据包长度转换
    /**检查两次seq是否相等，如果相等则代表终端丢包 */
    if (seq == this.data.Last_SEQ) {
      send_buffer_count = this.data.Last_sensd_buffer_count; //发送地址使用上次发送失败的地址
      send_pack_count = this.data.Last_send_pack_count //总的发送pack使用上次发送失败的pack
    } else {
      send_buffer_count = this.data.send_buffer_count;
      send_pack_count = this.data.send_pack_count + 1;
      /**保存上次发送的数据包地址 */
      this.setData({
        Last_sensd_buffer_count: send_buffer_count,
        Last_send_pack_count: send_pack_count
      });
      const progress = (send_buffer_count / ctx.data.User_BinData.length) * 100;
      this.setData({
        download_progress: progress.toFixed(2)
      });
    }
    if (send_buffer_count == ctx.data.User_BinData.length) {
      ctx.start_update_finsh();
      console.log("发送完毕，总包:", send_pack_count - 1);
    } else {
      this.setData({
        send_pack_count
      });
      /**发送数据前将缓冲区复位 */
      ctx.setData({
        User_SendData: []
      });
      ctx.data.User_SendData[0] = '55' //头
      ctx.data.User_SendData[1] = 'AA' //头
      ctx.data.User_SendData[2] = '00' //序列号
      ctx.data.User_SendData[3] = '00' //序列号
      ctx.data.User_SendData[4] = '01' //拓展（这里参数不影响）
      ctx.data.User_SendData[5] = '04' //操作码(下载数据)
      if ((ctx.data.User_BinData.length - send_buffer_count) >= 200) /**若当前剩余数据大于100*/ {
        ctx.data.User_SendData[6] = '00'
        ctx.data.User_SendData[7] = 'C8'
        for (let i = 0; i < 200; i++) {
          ctx.data.User_SendData[8 + i] = ctx.data.User_BinData[send_buffer_count]; //数据载入发送缓冲区
          send_buffer_count++;
        }
      } else if ((ctx.data.User_BinData.length - send_buffer_count) < 200) /**若当前剩余数据小于100*/ {
        const length = ctx.data.User_BinData.length - send_buffer_count;
        const hexLength = this.lengthToHexString(length);
        if (hexLength.length === 2) {
          hexParts = ['00', hexLength];
        } else {
          hexParts = hexLength.trim().split(' ');
        }
        // 赋值
        ctx.data.User_SendData[6] = hexParts[0]; // '00'（当 hexLength 是 '01' 时）
        ctx.data.User_SendData[7] = hexParts[1]; // '01'（当 hexLength 是 '01' 时）
        for (let i = 0; i < length; i++) {
          ctx.data.User_SendData[8 + i] = ctx.data.User_BinData[send_buffer_count]; //数据载入发送缓冲区
          send_buffer_count++;
        }
      }

      const decimalArray = ctx.data.User_SendData.map(hexStr => parseInt(hexStr, 16));
      const crcResult = ctx.crc16CcittFalse_send(decimalArray, decimalArray.length); // 计算CRC
      decimalArray.push(crcResult >> 8); // 添加CRC高8位
      decimalArray.push(crcResult & 0x00FF); // 添加CRC低8位
      buffer_str = ctx.convertDecimalArrayToHexString(decimalArray);
      console.log(decimalArray.length);
      console.log(ctx.data.User_BinData.length);
      console.log(send_buffer_count);
      console.log("发送成功");
      console.log("总包", send_pack_count);
      ecBLE.writeBLECharacteristicValue(buffer_str, true)
      this.setData({
        send_buffer_count
      });
    }


    /**更新SEQ到data段 */
    this.setData({
      Last_SEQ: seq,
    });
    console.log("Last_SEQ = ", this.data.Last_SEQ);


  },

  /**下载完成通知*/
  start_update_finsh: function () {
    const buffer = new Array(9);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x05; //操作码
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


  /**开始OTA*/
  start_ota: function () {
    const buffer = new Array(9);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x01; //操作码
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

  /**停止OTA*/
  stop_ota: function () {
    const buffer = new Array(9);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x02; //操作码
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


  /**OTA完成*/
  finsh_ota: function () {
    const buffer = new Array(9);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x03; //操作码
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

  /**进入OTA模式*/
  into_ble_ota: function () {
    const buffer = new Array(9);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x07; //操作码
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



  /**向服务器请求，查询当前设备是否需要升级 */
  check_ota_update(postData) {
    //使用微信标准接口
    wx.request({
      url: 'https://iot-ops.ikonke.com/api/ota/findByCcuId', // 这个url是固定url，不要更改，需要更改请与负责服务器同事联系
      method: 'POST',
      data: postData,
      header: {
        'Content-Type': 'application/json' // 声明JSON格式
      },
      success: (res) => {
        console.log('请求成功', res.data);
        const code = res.data.code;
        const message = res.data.message;
        const resultData = res.data.data;
        // 根据状态码处理业务逻辑
        if (code === 200) {

          console.log('接口调用成功，消息：', message);
          console.log('返回的具体数据：', resultData[0]);
          console.log('数据ID：', resultData[0].address);
          const fileName = resultData[0].address.split('/').pop(); //获取文件名称
          console.log('文件名称:', fileName);
          const versionMatch = fileName.match(/sv(\d+\.\d+\.\d+)/); //从文件名称提取版本号
          console.log('版本号:', versionMatch[1]);12
          console.log('转换后版本号:', ctx.convertVersionFormat(versionMatch[1]));
          ctx.data.get_cloud_server_version = ctx.convertVersionFormat(versionMatch[1]);
          ctx.data.cloud_version_dec[0] = parseInt(ctx.data.get_cloud_server_version[0], 10);
          ctx.data.cloud_version_dec[1] = parseInt(ctx.data.get_cloud_server_version[1], 10);
          ctx.data.cloud_version_dec[2] = parseInt(ctx.data.get_cloud_server_version[2], 10);


          console.log(ctx.data.cloud_version_dec[0]);
          console.log(ctx.data.cloud_version_dec[1]);
          console.log(ctx.data.cloud_version_dec[2]);

          console.log(ctx.data.Device_version_dec[0]);
          console.log(ctx.data.Device_version_dec[1]);
          console.log(ctx.data.Device_version_dec[2]);
          // is_device_update:false, // 设备是否有升级
          /*由于版本号格式变更，不再判断主版本号 以后估计也不在变更了*/
          // if (ctx.data.cloud_version_dec[0] > ctx.data.Device_version_dec[0]) {
          //   this.setData({
          //     is_device_update: true
          //   });
          // } else if (ctx.data.cloud_version_dec[0] < ctx.data.Device_version_dec[0]) {
          //   this.setData({
          //     is_device_update: false
          //   });
          // } else 
          
          if (ctx.data.cloud_version_dec[1] > ctx.data.Device_version_dec[1]) {
            this.setData({
              is_device_update: true
            });
          } else if (ctx.data.cloud_version_dec[1] < ctx.data.Device_version_dec[1]) {
            this.setData({
              is_device_update: false
            });
          } else if (ctx.data.cloud_version_dec[2] > ctx.data.Device_version_dec[2]) {
            this.setData({
              is_device_update: true
            });
          } else if (ctx.data.cloud_version_dec[2] < ctx.data.Device_version_dec[2]) {
            this.setData({
              is_device_update: false
            });
          }
          /*根据检查结果展示参数     无新版本*/
          if (ctx.data.is_device_update == false) {
            console.log("没有新版本");
            this.setData({
              Device_Info: {
                ...this.data.Device_Info,
                upgrade: "已经是最新版本"
              }
            });
          }
          /*根据检查结果展示参数     有新版本*/
          if (ctx.data.is_device_update == true) {
            console.log("有新版本");
            this.setData({
              Device_Info: {
                ...this.data.Device_Info,
                upgrade: "有新的版本更新"
              }
            });
            /*检查当前是否已经进入OTA模式，没有进入就显示进入升级按钮 */
            if (ctx.data.is_into_ota_mode == false) {
              this.setData({
                show_ota_mode_button: true /*显示进入升级模式按钮*/
              });
            }
          }
          /*检查当前是否已经进入OTA模式，如果进入了就下载固件*/
          if (ctx.data.is_into_ota_mode == true) {
            ctx.downloadBinFile(resultData[0].address);
          }

        } else {
          console.log('接口调用失败，原因：', message);
          this.setData({
            Device_Info: {
              ...this.data.Device_Info, // 复制原有所有属性
              upgrade: "获取版本超时 01"
            }
          });
        }
      },
      fail: (err) => {
        console.error('请求失败', err);
        this.setData({
          Device_Info: {
            ...this.data.Device_Info, // 复制原有所有属性
            upgrade: "版本获取超时 02"
          }
        });
      },
      complete: () => {}
    });
  },



  /**处理接收到的数据 */
  handleArrayByFifthItem(arr) {
    if (!arr || !Array.isArray(arr)) {}
    if (arr.length < 5) {
      return;
    }
    const seq_high = parseInt(arr[2], 16);
    const seq_low = parseInt(arr[3], 16);
    const seq = seq_high << 8 | seq_low;
    console.log('seq:', seq);
    /**命令索引 */
    const fifthItem = arr[5];
    console.log(arr);
    switch (fifthItem) {
      case "00":
        console.log('系统版本:', arr[9], arr[10],
          [11])
        /*将字符串转成十进制 */
        const version = `${parseInt(arr[9], 16)}.${parseInt(arr[10], 16)}.${parseInt(arr[11], 16)}`;
        /*字符串转十进制 */
        ctx.data.Device_version_dec[0] = parseInt(arr[9], 16);
        ctx.data.Device_version_dec[1] = parseInt(arr[10], 16);
        ctx.data.Device_version_dec[2] = parseInt(arr[11], 16);


        console.log('OTA模式位:', arr[12]);
        /*检查是否进入OTA模式 */
        if (parseInt(arr[12], 16) == 0x80) //已经进入OTA模式
        {
          this.setData({
            is_into_ota_mode: true
          });
        } else {
          this.setData({
            is_into_ota_mode: false
          });
        }
        /**检查集成商 */
        if (parseInt(arr[8], 16) == 0x00) //控客版本
        {
          ctx.check_ota_update(ctx.data.KonKe_Standard_Edition_postData);
          this.setData({
            Device_Info: {
              Integrator: "KonKe",
              Version: version,
              upgrade: "等待获取" // 预设升级信息
            }
          });
        }
        if (parseInt(arr[8], 16) == 0x01) //涂鸦版本
        {
          ctx.check_ota_update();
          this.setData({
            Device_Info: {
              Integrator: "Tuya",
              Version: version,
              upgrade: "等待获取" // 预设升级信息
            }
          });
        }
        if (parseInt(arr[8], 16) == 0x02) //小米版本
        {
          ctx.check_ota_update();
          this.setData({
            Device_Info: {
              ...this.data.Device_Info, // 复制原有所有属性
              Integrator: "XiaoMi",
              Version: version,
              upgrade: "等待获取" // 预设升级信息
            }
          });
        }

        break;
      case "06":
        this.setData({
          show_start_ota_button: false //OTA时隐藏按钮
        });
        this.setData({
          is_ento_ota_process: true // OTA开始时，显示进度条
        });
        console.log('索要数据:', seq);
        ctx.sendNextPackage(seq);
        break;
        case "0D":
          console.log('校验结果:', arr[8]);
  
          break;
      default:
        break;
    }


  },

  /**
   * 通过url下载服务器数据
   * @param fileUrl 文件url
   * @returns 
   */
  downloadBinFile(fileUrl) {
    let tempcount = 0;
    // const fileUrl = "https://kkhz-smarthome.oss-cn-hangzhou.aliyuncs.com/oms/47810c15f9a440d3859c73c096f354ae/%E5%85%B6%E4%BB%96/KonKe/%E6%A0%87%E5%87%86%E7%89%88/%E6%96%87%E4%BB%B6/KK-QP-KS_sv1.1.9_hv1.0_1762419935258.bin";

    // 调用微信下载接口（默认下载到临时缓存目录）
    wx.downloadFile({
      url: fileUrl,
      // 不指定filePath，微信会自动分配临时缓存路径（退出小程序后自动清理）
      header: {
        'Content-Type': 'application/octet-stream', // 适配二进制文件
        'Accept': '*/*' // 兼容不同响应头
      },
      // 监听下载进度（可选）
      progress: (res) => {
        const progress = Math.round(res.progress);
        this.setData({
          downloadStatus: `下载中...${progress}%`
        });
      },
      success: (res) => {
        if (res.statusCode === 200) {
          console.log('文件缓存成功，临时路径：', res.tempFilePath);

          wx.getFileSystemManager().readFile({
            filePath: res.tempFilePath, // 文件路径  

            encoding: 'binary', // 使用二进制编码读取文件 

            success: (res) => { //读取成功
              const mybuffer = res.data
              const myhexString = ctx.bytesToHex(mybuffer);
              for (let i = 0; i < myhexString.length; i += 2) {
                ctx.data.User_BinData[tempcount] = myhexString[i] + myhexString[i + 1]
                tempcount++
              }
              console.log('File content in hex:', ctx.data.User_BinData[ctx.data.User_BinData.length - 4]);
              console.log('File content in hex:', ctx.data.User_BinData[ctx.data.User_BinData.length - 3]);
              console.log('File content in hex:', ctx.data.User_BinData[ctx.data.User_BinData.length - 2]);
              console.log('File content in hex:', ctx.data.User_BinData[ctx.data.User_BinData.length - 1]);
              /*文件加载完毕，显示开始升级按钮 */
              this.setData({
                show_start_ota_button: true
              });
            }


          })


        } else {
          this.setData({
            downloadStatus: `下载失败，状态码：${res.statusCode}`
          });
        }
      },
      fail: (err) => {
        console.error('文件缓存失败：', err);
        let errMsg = '下载失败，请重试';
        if (err.errMsg.includes('不支持')) {
          errMsg = '文件类型不支持，请检查服务器响应头';
        } else if (err.errMsg.includes('域名')) {
          errMsg = '域名未配置，请添加downloadFile合法域名';
        }
        this.setData({
          downloadStatus: errMsg
        });
      },
      complete: () => {
        this.setData({
          isDownloading: false
        });
      }
    });
  },
  test_app_push_check_dev() {
    ctx = this
    const buffer = new Array(16);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x0D; //操作码
    buffer[6] = 0x00; //长度
    buffer[7] = 0x08; //长度低八位
    buffer[8] = 0x10;
    buffer[9] = 0x2C;
    buffer[10] = 0xED;
    buffer[11] = 0xFF;
    buffer[12] = 0xFE;
    buffer[13] = 0x34;
    buffer[14] = 0xC2;
    buffer[15] = 0xB1;
    const crcResult = ctx.crc16CcittFalse_send(buffer, 16); // 计算CRC
    buffer[16] = crcResult >> 8;
    buffer[17] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
  },




















































  /**
   * 将点分隔的版本号（如1.1.9）转换为空格分隔的两位数字格式（如01 01 09）
   * @param {String} version - 点分隔的版本号（如"1.1.9"）
   * @returns {String} 转换后的空格分隔版本号（如"01 01 09"）
   */
  convertVersionFormat(version) {
    if (!version || typeof version !== 'string') {
      console.error('请传入有效的版本号字符串');
      return [];
    }

    // 先转换为 "01 01 09" 格式，再按空格分割为数组
    return version
      .split('.')
      .map(numStr => {
        const num = parseInt(numStr, 10);
        return isNaN(num) ? '00' : num.toString().padStart(2, '0');
      })
      .join(' ') // 先转为 "01 01 09"
      .split(' '); // 再分割为 ["01", "01", "09"]
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