const ecUI = require('../../utils/ecUI.js')
const ecBLE = require('../../utils/ecBLE.js')
let ctx

Page({
  /**
   * 页面的初始数据
   */
  data: {
    scaledImageUrl: '', // 缩放后图片临时路径
    scaledWidth: 0, // 缩放后宽度
    scaledHeight: 0, // 缩放后高度
    download_progress: 0,
    User_ReceveData: [], // 接收设备发送回来的数据
    User_SendData: [], // 准备发送的数据
    User_BinData: [], //处理好的升级包数据
    User_Receve_SEQ: 0, //接收到的SEQ
    Last_SEQ: 9999, //上一次存放的SEQ（用于跟最新的作比较,初始值给大一点）
    send_buffer_count: 0, //发送地址计数，递增
    Last_send_buffer_count: 0, //上一次发送的地址
    send_pack_count: 0, //发送数据包计数 递增
    Last_send_pack_count: 0, //上一次发送的pack
    show_download_button: false, //是否显示开始下载按钮
    is_ento_ota_process: false, // 是否在OTA进程中
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    ctx = this
    /**监听BLE消息 */
    ecBLE.onBLECharacteristicValueChange((str, strHex) => {
      //接收新消息前，清空缓存
      this.setData({
        User_ReceveData: [], // 接收设备发送回来的数据
      });
      let tempdata = 0
      for (let i = 0; i < strHex.length; i += 2) {
        ctx.data.User_ReceveData[tempdata] = strHex[i] + strHex[i + 1]
        tempdata++
      }

      const decimalArray = ctx.data.User_ReceveData.map(hexStr => parseInt(hexStr, 16));
      // console.log("所有数据", decimalArray);
      // console.log("数据总长度", decimalArray.length);
      const crcResult = ctx.crc16CcittFalse_send(decimalArray, decimalArray.length - 2); // 计算CRC
      console.log("wallpaper_接收CRC", crcResult.toString(16));
      let concatenatedHex = ctx.data.User_ReceveData[ctx.data.User_ReceveData.length - 2] + ctx.data.User_ReceveData[ctx.data.User_ReceveData.length - 1];
      console.log("wallpaper_发送CRC", concatenatedHex);
      const hexToDecimal = parseInt(concatenatedHex, 16);
      /**对接收到的数据CRC与数据的CRC比对 */
      if (hexToDecimal == crcResult) {
        ctx.handleArrayByFifthItem(ctx.data.User_ReceveData);
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
    console.log('页面被卸载');

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
      ctx.start_update_finsh(); //通知设备下载完成
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
      ctx.data.User_SendData[4] = '01' //是否需要回复（需要回复）
      ctx.data.User_SendData[5] = '09' //操作码(下载壁纸数据)
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


  /**
   * 处理接收到的数据
   */
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
    switch (fifthItem) {
      case "00":
        break;
      case "0B":
        console.log('索要数据:', seq);
        this.setData({
          is_ento_ota_process: true,
        });
        ctx.sendNextPackage(seq);
        break;
      default:
        break;
    }
  },
  /**
   * 选择用户图片
   */
  chooseAndScaleImage() {
    const that = this;

    // 1. 使用 wx.chooseMedia 选择图片
    wx.chooseMedia({
      count: 1, // 最多选择1个文件
      mediaType: ['image'], // 只选择图片
      sourceType: ['album', 'camera'], // 从相册或相机选择
      success: (chooseRes) => {
        // chooseRes.tempFiles 是一个数组，我们取第一个元素
        const tempFilePath = chooseRes.tempFiles[0].tempFilePath;

        // 2. 获取图片原始尺寸
        wx.getImageInfo({
          src: tempFilePath,
          success: (imageInfo) => {
            const originWidth = imageInfo.width;
            const originHeight = imageInfo.height;
            if (originWidth < 400 || originHeight < 400) {
              wx.showToast({
                title: '图片尺寸过小', // 弹窗提示文字
                icon: 'error', // 不显示图标（可选：'success'/'loading'/'none'）
                duration: 2000, // 显示时长（毫秒），默认1500，这里设为10000=10秒
                mask: true // 是否显示遮罩层（禁止背景点击，可选）
              });
            } else if (originWidth >= 400 && originHeight >= 400) {
              if (originWidth == originHeight) {
                // 需要缩放，计算目标尺寸
                const scale = Math.min(400 / originWidth, 400 / originHeight);
                const targetWidth = Math.round(originWidth * scale);
                const targetHeight = Math.round(originHeight * scale);

                // 4. 调用 Canvas 缩放图片
                that.scaleImageWithCanvas(tempFilePath, targetWidth, targetHeight);
              } else {
                wx.showToast({
                  title: '图片比例有误', // 弹窗提示文字
                  icon: 'error', // 不显示图标（可选：'success'/'loading'/'none'）
                  duration: 2000, // 显示时长（毫秒），默认1500，这里设为10000=10秒
                  mask: true // 是否显示遮罩层（禁止背景点击，可选）
                });
              }

            }








          },
          fail: (err) => {
            wx.showToast({
              title: '获取图片信息失败',
              icon: 'none'
            });
            console.error('getImageInfo 失败：', err);
          }
        });
      },
      fail: (err) => {
        // 如果用户取消选择，err.errMsg 会是 "chooseMedia:fail cancel"
        if (err.errMsg !== "chooseMedia:fail cancel") {
          wx.showToast({
            title: '选择图片失败',
            icon: 'none'
          });
          console.error('chooseMedia 失败：', err);
        }
      }
    });
  },

  /**
   * 使用 Canvas 先裁剪成正方形，再缩放图片
   */
  scaleImageWithCanvas(imgPath, targetWidth, targetHeight) {
    const that = this;
    let tempcount = 0
    const query = wx.createSelectorQuery().in(this);
    query.select('#scaleCanvas')
      .fields({
        node: true,
        size: true
      })
      .exec((res) => {
        const canvas = res[0].node;
        const canvas_ctx = canvas.getContext('2d');

        // 注意：这里的 canvas 尺寸仍然是最终要缩放的尺寸
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const img = canvas.createImage();
        img.src = imgPath;

        img.onload = () => {
          // 1. 计算裁剪区域（从原图中心裁剪出一个最大的正方形）
          const originWidth = img.width;
          const originHeight = img.height;

          // 正方形的边长是原图宽和高中的较小值
          const squareSize = Math.min(originWidth, originHeight);

          // 计算裁剪的起始点 (x, y)，使其位于图片中心
          const offsetX = (originWidth - squareSize) / 2;
          const offsetY = (originHeight - squareSize) / 2;

          // 2. 清空画布
          canvas_ctx.clearRect(0, 0, targetWidth, targetHeight);

          // 3. 绘制并缩放图片
          // drawImage 的参数说明：
          // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
          // - image: 要绘制的图片对象
          // - sx, sy: 从原图的哪个位置开始裁剪
          // - sWidth, sHeight: 裁剪的宽度和高度（这里是正方形的边长）
          // - dx, dy: 绘制到 Canvas 的哪个位置（通常是 0, 0）
          // - dWidth, dHeight: 绘制到 Canvas 的宽度和高度（这里是目标尺寸）
          canvas_ctx.drawImage(
            img,
            offsetX, offsetY, squareSize, squareSize, // 从原图裁剪的区域
            0, 0, targetWidth, targetHeight // 绘制到 Canvas 的区域
          );

          // 4. 将 Canvas 内容导出为临时文件路径
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: (canvasRes) => {
              that.setData({
                scaledImageUrl: canvasRes.tempFilePath,
                scaledWidth: targetWidth,
                scaledHeight: targetHeight
              });
              wx.showToast({
                title: `裁剪并缩放成功：${targetWidth}x${targetHeight}`
              });
              // 2. 读取 Canvas 像素数据（RGB 格式）
              const imageData = canvas_ctx.getImageData(0, 0, targetWidth, targetHeight);
              const pixels = imageData.data; // 格式：[R0, G0, B0, A0, R1, G1, B1, A1, ...]
              const rgb565SwapBytes = []; // 存储转换后的 RGB565 Swap 字节

              // 3. 遍历像素，转换为 RGB565 Swap 格式
              for (let i = 0; i < pixels.length; i += 4) {
                const R = pixels[i]; // 红通道（0-255）
                const G = pixels[i + 1]; // 绿通道（0-255）
                const B = pixels[i + 2]; // 蓝通道（0-255）

                // 3.1 转换为 RGB565 格式（16 位）
                const r5 = (R >> 3) & 0x1F; // 取 R 的前 5 位（0-31）
                const g6 = (G >> 2) & 0x3F; // 取 G 的前 6 位（0-63）
                const b5 = (B >> 3) & 0x1F; // 取 B 的前 5 位（0-31）

                // 组合为 16 位整数：高字节 = R5(5位) + G6(前3位)，低字节 = G6(后3位) + B5(5位)
                const highByte = (r5 << 3) | (g6 >> 3); // 高 8 位
                const lowByte = ((g6 & 0x07) << 5) | b5; // 低 8 位

                rgb565SwapBytes.push(highByte);
                rgb565SwapBytes.push(lowByte);
              }

              // 4. 将字节数组转换为 Uint8Array（二进制格式）
              const continuousHexString = rgb565SwapBytes
                .map(byte => {
                  // 将每个十进制字节转换为两位大写十六进制字符串
                  return byte.toString(16).padStart(2, '0').toUpperCase();
                })
                .join(''); // 使用空字符串连接所有元素
              /*注意，这个操作非常关键，LVGL的前四个字节是图片信息，这里直接生成是没有的，所以需要插入四个无效字节 */
              const prefix = '00000000';
              const newContinuousHexString = prefix + continuousHexString;
              console.log(newContinuousHexString[0]);
              console.log(newContinuousHexString[1]);
              console.log(newContinuousHexString[2]);
              console.log(newContinuousHexString[3]);
              console.log(newContinuousHexString[4]);
              console.log(newContinuousHexString.length);
              for (let i = 0; i < continuousHexString.length; i += 2) {
                ctx.data.User_BinData[tempcount] = continuousHexString[i] + continuousHexString[i + 1]
                tempcount++
              }
              /**显示升级按钮*/
              ctx.setData({
                show_download_button: true,
              });
            },
            fail: (err) => {
              wx.showToast({
                title: 'Canvas 转图片失败',
                icon: 'none'
              });
              console.error('canvasToTempFilePath 失败：', err);
            }
          });
        };

        img.onerror = (err) => {
          wx.showToast({
            title: '图片加载失败',
            icon: 'none'
          });
          console.error('图片加载失败：', err);
        };
      });
  },

  /**
   * 打开文件
   */
  chooseAndReadFile: function () {
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
            /**显示升级按钮*/
            ctx.setData({
              show_download_button: true,
            });

          }
        })
      }
    });
  },

  /**
   * 下载完成通知
   */
  start_update_finsh: function () {
    /**显示升级按钮*/
    ctx.setData({
      show_download_button: false,
    });
    const buffer = new Array(9);
    let buffer_str;
    buffer[0] = 0x55; //帧头1  
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x0A; //操作码
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
  /**
   * 开始升级
   */
  start_download: function () {
    const buffer = new Array(9);
    let buffer_str;
    buffer[0] = 0x55; //帧头1
    buffer[1] = 0xAA; //帧头2
    buffer[2] = 0x00; //SEQ高八位
    buffer[3] = 0x00; //SEQ低八位
    buffer[4] = 0x00; //是否需要回复
    buffer[5] = 0x08; //操作码
    buffer[6] = 0x00; //长度高八位
    buffer[7] = 0x00; //长度低八位
    const crcResult = ctx.crc16CcittFalse_send(buffer, 8); // 计算CRC
    buffer[8] = crcResult >> 8;
    buffer[9] = crcResult & 0x00FF;
    console.log(buffer);
    buffer_str = ctx.convertDecimalArrayToHexString(buffer);
    console.log(buffer_str);
    ecBLE.writeBLECharacteristicValue(buffer_str, true)
    wx.showToast({
      title: '准备升级···', // 弹窗提示文字
      icon: 'loading', // 不显示图标（可选：'success'/'loading'/'none'）
      duration: 10000, // 显示时长（毫秒），默认1500，这里设为10000=10秒
      mask: true // 是否显示遮罩层（禁止背景点击，可选）
    });
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