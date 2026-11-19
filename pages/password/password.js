const ecUI = require('../../utils/ecUI.js')
const ecBLE = require('../../utils/ecBLE.js')
let ctx

Page({
  /**
   * 页面的初始数据
   */
  data: {
    "usingComponents": {},
    "navigationBarTitleText": "密码验证"
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
  // 监听密码输入
  handlePasswordInput(e) {
    const value = e.detail.value
    // 只允许输入数字
    const numberValue = value.replace(/\D/g, '')
    this.setData({
      password: numberValue,
      showError: false  // 输入时隐藏错误提示
    })
  },

  // 验证密码并跳转
  verifyPassword() {
    const { password } = this.data
    const correctPassword = '123456'  // 正确密码（可自行修改）

    // 验证密码长度
    if (password.length !== 6) {
      this.setData({
        showError: true,
        errorMsg: '请输入6位数字密码'
      })
      return
    }

    // 验证密码正确性
    if (password === correctPassword) {
      // 密码正确，跳转到成功页面
      wx.navigateTo({
        url: '/pages/change_wallpaper/change_wallpaper',
        success: () => {
          // 跳转成功后清空密码
          this.setData({ password: '' })
        }
      })
    } else {
      // 密码错误
      this.setData({
        showError: true,
        errorMsg: '密码错误，请重新输入'
      })
      
      // 震动提示
      wx.vibrateShort()
    }
  }
})