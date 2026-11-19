// pages/child_page/seawin_knx/seawin_knx.js
const ecBLE = require('../../../utils/ecBLE.js')

const COMMAND_OPTIONS = [
  { label: 'USER_BLE_GET_VERSION', value: 0x00 },
  { label: 'USER_BLE_OTA_START', value: 0x01 },
  { label: 'USER_BLE_OTA_STOP', value: 0x02 },
  { label: 'USER_BLE_OTA_FINSH', value: 0x03 },
  { label: 'USER_BLE_OTA_DOWNLOAD', value: 0x04 },
  { label: 'USER_BLE_OTA_DOWNLOAD_FINSH', value: 0x05 },
  { label: 'USER_GET_BLE_OTA_DATA', value: 0x06 },
  { label: 'USER_INTO_BLE_OTA_MODE', value: 0x07 },
  { label: 'USER_BLE_WALLPAPER_START', value: 0x08 },
  { label: 'USER_BLE_WALLPAPER_DOWNLOAD', value: 0x09 },
  { label: 'USER_BLE_WALLPAPER_DOWNLOAD_FINSH', value: 0x0A },
  { label: 'USER_GET_BLE_FLASH_DATA', value: 0x0B },
  { label: 'USER_BLE_APP_PUSH_CCU_ID', value: 0x0C },
  { label: 'USER_BLE_APP_PUSH_CHECK_DEV', value: 0x0D },
  { label: 'USER_BLE_APP_PUSH_CCU_IN_IP', value: 0x0E },
  { label: 'USER_BLE_APP_PUSH_CCU_VERSION', value: 0x0F },
  { label: 'USER_BLE_APP_PUSH_GW_VERSION', value: 0x10 },
  { label: 'USER_BLE_APP_PUSH_GW_MAC', value: 0x11 },
  { label: 'USER_BLE_APP_PUSH_GW_IP', value: 0x12 },
  { label: 'USER_BLE_APP_PUSH_ZIGBEE_VERSION', value: 0x13 },
  { label: 'USER_BLE_APP_PUSH_AC_NAME', value: 0x14 },
  { label: 'USER_BLE_APP_PUSH_AC_ROOM_NAME', value: 0x15 },
  { label: 'USER_BLE_APP_PUSH_FH_NAME', value: 0x16 },
  { label: 'USER_BLE_APP_PUSH_FH_ROOM_NAME', value: 0x17 },
  { label: 'USER_BLE_APP_PUSH_MV_NAME', value: 0x18 },
  { label: 'USER_BLE_APP_PUSH_MV_ROOM_NAME', value: 0x19 },
  { label: 'USER_BLE_APP_PUSH_DONE', value: 0x1A },
  { label: 'USER_BLE_APP_PUSH_AC_MAC', value: 0x1B },
  { label: 'USER_BLE_APP_PUSH_FH_MAC', value: 0x1C },
  { label: 'USER_BLE_APP_PUSH_MV_MAC', value: 0x1D },
  { label: 'USER_BLE_VOICE_OTA_ENTER', value: 0x1E },
  { label: 'USER_BLE_VOICE_OTA_GET_VERSION', value: 0x1F },
  { label: 'USER_BLE_VOICE_OTA_CHECK_VERSION', value: 0x20 },
  { label: 'USER_BLE_VOICE_OTA_START', value: 0x21 },
  { label: 'USER_BLE_VOICE_OTA_GET_PACKET', value: 0x22 },
  { label: 'USER_BLE_VOICE_OTA_SEND_PACKET', value: 0x23 },
  { label: 'USER_BLE_VOICE_OTA_END', value: 0x24 },
  { label: 'USER_BLE_PRIVATE_PROTOCOL_SEAWIN', value: 0x25 },
]

const DEFAULT_COMMAND_INDEX = COMMAND_OPTIONS.findIndex((item) => item.label === 'USER_BLE_PRIVATE_PROTOCOL_SEAWIN')
const FIXED_HEADER_BYTES = [0x55, 0xAA]
const SEAWIN_COMMAND_VALUE = 0x25
const AUTO_REPLY_KNX_BYTES = [0x55, 0xAA, 0xC3, 0xC3]

Page({

  /**
   * 页面的初始数据
   */
  data: {
    knxInput: '',
    commandOptions: COMMAND_OPTIONS.map((item) => `${item.label} (${item.value.toString(16).toUpperCase().padStart(2, '0')})`),
    commandIndex: DEFAULT_COMMAND_INDEX,
    commandLabel: COMMAND_OPTIONS[DEFAULT_COMMAND_INDEX].label,
    showResultPanel: true,
    normalizedKnxData: '',
    normalizedHeader: '',
    normalizedCommand: '',
    normalizedPayload: '',
    sumHex: '',
    payloadLength: 0,
    lengthHex: '0000',
    crcHex: '',
    fullPacketDisplay: '',
    sendHexString: '',
    receivedMessages: [],
    inputError: '',
    frameRuleText: '格式：输入 KNX 数据后，自动追加 sum 低八位到蓝牙数据包，再拼接帧头、命令、长度和 CRC16。',
  },

  onLoad() {
    this.fillExample()
    ecBLE.onBLECharacteristicValueChange((str, strHex) => {
      const frameInfo = this.extractSeawinPayload(strHex || str || '')

      if (!frameInfo.ok) {
        return
      }

      const nextMessages = [
        frameInfo.payloadHex || '空数据',
        ...this.data.receivedMessages,
      ]

      this.setData({
        receivedMessages: nextMessages,
      })

      if (!this.isAutoReplyPayload(frameInfo.payloadBytes)) {
        const autoReplyPacket = this.buildSeawinReplyPacket()
        console.log('seawin_auto_reply', autoReplyPacket.sendHexString)
        ecBLE.writeBLECharacteristicValue(autoReplyPacket.sendHexString, true)
      }
    })
  },

  onUnload() {
    ecBLE.onBLECharacteristicValueChange(() => {})
  },

  handleKnxInput(event) {
    this.setData({
      knxInput: event.detail.value || '',
    })
    this.updateFrame()
  },

  handleCommandChange(event) {
    const commandIndex = Number(event.detail.value || 0)
    const currentOption = COMMAND_OPTIONS[commandIndex] || COMMAND_OPTIONS[DEFAULT_COMMAND_INDEX]
    this.setData({
      commandIndex,
      commandLabel: currentOption.label,
    })
    this.updateFrame()
  },

  fillExample() {
    this.setData({
      knxInput: '55 AA',
      commandIndex: DEFAULT_COMMAND_INDEX,
      commandLabel: COMMAND_OPTIONS[DEFAULT_COMMAND_INDEX].label,
    })
    this.updateFrame()
  },

  clearInput() {
    this.setData({
      knxInput: '',
      commandIndex: DEFAULT_COMMAND_INDEX,
      commandLabel: COMMAND_OPTIONS[DEFAULT_COMMAND_INDEX].label,
      normalizedKnxData: '',
      normalizedHeader: '',
      normalizedCommand: '',
      normalizedPayload: '',
      sumHex: '',
      payloadLength: 0,
      lengthHex: '0000',
      crcHex: '',
      fullPacketDisplay: '',
      sendHexString: '',
      receivedMessages: [],
      inputError: '',
    })
  },

  clearReceivedMessage() {
    this.setData({
      receivedMessages: [],
    })
  },

  copyReceivedMessage(event) {
    const index = Number(event.currentTarget.dataset.index || 0)
    const message = this.data.receivedMessages[index] || ''
    this.copyText(message, `第${index + 1}条消息`)
  },

  toggleResultPanel() {
    this.setData({
      showResultPanel: !this.data.showResultPanel,
    })
  },

  copyFullResult() {
    this.copyText(this.data.sendHexString, '完整报文')
  },

  sendCurrentData() {
    const frameResult = this.buildFrame()

    if (!frameResult.ok) {
      wx.showToast({
        title: frameResult.message,
        icon: 'none',
      })
      return
    }

    console.log(frameResult.bytes)
    console.log(frameResult.sendHexString)
    ecBLE.writeBLECharacteristicValue(frameResult.sendHexString, true)

    wx.showToast({
      title: '发送成功',
      icon: 'success',
    })
  },

  copyText(text, label) {
    if (!text) {
      wx.showToast({
        title: `没有可复制的${label}`,
        icon: 'none',
      })
      return
    }

    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({
          title: `${label}已复制`,
          icon: 'success',
        })
      },
    })
  },

  updateFrame() {
    const frameResult = this.buildFrame()

    if (!frameResult.ok) {
      this.setData({
        normalizedKnxData: '',
        normalizedHeader: '',
        normalizedCommand: '',
        normalizedPayload: '',
        sumHex: '',
        payloadLength: 0,
        lengthHex: '0000',
        crcHex: '',
        fullPacketDisplay: '',
        sendHexString: '',
        inputError: frameResult.message,
      })
      return
    }

    this.setData({
      normalizedKnxData: frameResult.normalizedKnxData,
      normalizedHeader: frameResult.normalizedHeader,
      normalizedCommand: frameResult.normalizedCommand,
      normalizedPayload: frameResult.normalizedPayload,
      sumHex: frameResult.sumHex,
      payloadLength: frameResult.payloadLength,
      lengthHex: frameResult.lengthHex,
      crcHex: frameResult.crcHex,
      fullPacketDisplay: frameResult.fullPacketDisplay,
      sendHexString: frameResult.sendHexString,
      inputError: '',
    })
  },

  buildFrame() {
    const commandOption = COMMAND_OPTIONS[this.data.commandIndex] || COMMAND_OPTIONS[DEFAULT_COMMAND_INDEX]
    const commandBytes = [commandOption.value]

    const knxResult = this.parseHexInput(this.data.knxInput, {
      allowEmpty: true,
      label: 'KNX数据',
    })

    if (!knxResult.ok) {
      return knxResult
    }

    if (knxResult.bytes.length === 0) {
      return {
        ok: true,
        normalizedKnxData: '',
        normalizedHeader: this.bytesToSpacedHex(FIXED_HEADER_BYTES),
        normalizedCommand: '',
        normalizedPayload: '',
        sumHex: '',
        payloadLength: 0,
        lengthHex: '0000',
        crcHex: '',
        fullPacketDisplay: '',
        sendHexString: '',
        bytes: [],
      }
    }

    const knxBytes = knxResult.bytes
    const sumValue = knxBytes.length > 0 ? (this.sumBytes(knxBytes) & 0xFF) : null
    const payloadBytes = knxBytes.slice()
    if (sumValue !== null) {
      payloadBytes.push(sumValue)
    }

    const lengthHigh = (payloadBytes.length >> 8) & 0xFF
    const lengthLow = payloadBytes.length & 0xFF
    const frameBytes = [
      FIXED_HEADER_BYTES[0],
      FIXED_HEADER_BYTES[1],
      0x00,
      0x00,
      0x00,
      commandBytes[0],
      lengthHigh,
      lengthLow,
      ...payloadBytes,
    ]

    const crcResult = this.crc16CcittFalseSend(frameBytes, frameBytes.length)
    const crcHigh = (crcResult >> 8) & 0xFF
    const crcLow = crcResult & 0xFF
    const fullPacketBytes = frameBytes.concat([crcHigh, crcLow])

    return {
      ok: true,
      normalizedKnxData: this.bytesToSpacedHex(knxBytes),
      normalizedHeader: this.bytesToSpacedHex(FIXED_HEADER_BYTES),
      normalizedCommand: `${commandOption.label} (${this.byteToHex(commandBytes[0])})`,
      normalizedPayload: this.bytesToSpacedHex(payloadBytes),
      sumHex: sumValue === null ? '' : this.byteToHex(sumValue),
      payloadLength: payloadBytes.length,
      lengthHex: `${this.byteToHex(lengthHigh)} ${this.byteToHex(lengthLow)}`,
      crcHex: `${this.byteToHex(crcHigh)} ${this.byteToHex(crcLow)}`,
      fullPacketDisplay: this.bytesToSpacedHex(fullPacketBytes),
      sendHexString: this.convertDecimalArrayToHexString(fullPacketBytes),
      bytes: fullPacketBytes,
    }
  },

  parseHexInput(rawInput, options = {}) {
    const {
      allowEmpty = true,
      exactLength = 0,
      label = '数据',
    } = options

    if (!rawInput || !rawInput.trim()) {
      if (allowEmpty) {
        return {
          ok: true,
          bytes: [],
        }
      }

      return {
        ok: false,
        message: `${label}不能为空。`,
      }
    }

    const compactHex = rawInput
      .toUpperCase()
      .replace(/0X/g, '')
      .replace(/[^0-9A-F]/g, '')

    if (!compactHex) {
      if (allowEmpty) {
        return {
          ok: true,
          bytes: [],
        }
      }

      return {
        ok: false,
        message: `${label}不能为空。`,
      }
    }

    if (compactHex.length % 2 !== 0) {
      return {
        ok: false,
        message: `${label}的十六进制位数必须是偶数。`,
      }
    }

    const bytes = []
    for (let index = 0; index < compactHex.length; index += 2) {
      bytes.push(parseInt(compactHex.slice(index, index + 2), 16))
    }

    if (exactLength > 0 && bytes.length !== exactLength) {
      return {
        ok: false,
        message: `${label}必须输入 ${exactLength} 个字节。`,
      }
    }

    return {
      ok: true,
      bytes,
    }
  },

  sumBytes(bytes) {
    return bytes.reduce((sum, value) => sum + value, 0)
  },

  crc16CcittFalseSend(data, len) {
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

  byteToHex(value) {
    return value.toString(16).toUpperCase().padStart(2, '0')
  },

  bytesToSpacedHex(bytes) {
    return bytes.map((item) => this.byteToHex(item)).join(' ')
  },

  normalizeReceivedHex(value) {
    const compactHex = String(value)
      .toUpperCase()
      .replace(/[^0-9A-F]/g, '')

    if (!compactHex) {
      return ''
    }

    const groups = compactHex.match(/.{1,2}/g)
    return groups ? groups.join(' ') : compactHex
  },

  extractSeawinPayload(rawValue) {
    const compactHex = String(rawValue)
      .toUpperCase()
      .replace(/[^0-9A-F]/g, '')

    if (!compactHex || compactHex.length % 2 !== 0) {
      return { ok: false }
    }

    const bytes = []
    for (let index = 0; index < compactHex.length; index += 2) {
      bytes.push(parseInt(compactHex.slice(index, index + 2), 16))
    }

    if (bytes.length < 10) {
      return { ok: false }
    }

    if (bytes[0] !== FIXED_HEADER_BYTES[0] || bytes[1] !== FIXED_HEADER_BYTES[1]) {
      return { ok: false }
    }

    if (bytes[5] !== SEAWIN_COMMAND_VALUE) {
      return { ok: false }
    }

    const payloadLength = ((bytes[6] << 8) | bytes[7]) >>> 0
    const payloadStart = 8
    const payloadEnd = payloadStart + payloadLength
    const crcLength = 2

    if (bytes.length < payloadEnd + crcLength) {
      return { ok: false }
    }

    const payloadBytes = bytes.slice(payloadStart, payloadEnd)

    return {
      ok: true,
      payloadBytes,
      payloadHex: this.bytesToSpacedHex(payloadBytes),
    }
  },

  isAutoReplyPayload(payloadBytes) {
    const replyPayloadBytes = this.buildAutoReplyPayloadBytes()

    if (!Array.isArray(payloadBytes) || payloadBytes.length !== replyPayloadBytes.length) {
      return false
    }

    return payloadBytes.every((item, index) => item === replyPayloadBytes[index])
  },

  buildAutoReplyPayloadBytes() {
    const payloadBytes = AUTO_REPLY_KNX_BYTES.slice()
    payloadBytes.push(this.sumBytes(payloadBytes) & 0xFF)
    return payloadBytes
  },

  buildSeawinReplyPacket() {
    const payloadBytes = this.buildAutoReplyPayloadBytes()
    const lengthHigh = (payloadBytes.length >> 8) & 0xFF
    const lengthLow = payloadBytes.length & 0xFF
    const frameBytes = [
      FIXED_HEADER_BYTES[0],
      FIXED_HEADER_BYTES[1],
      0x00,
      0x00,
      0x00,
      SEAWIN_COMMAND_VALUE,
      lengthHigh,
      lengthLow,
      ...payloadBytes,
    ]
    const crcResult = this.crc16CcittFalseSend(frameBytes, frameBytes.length)
    const crcHigh = (crcResult >> 8) & 0xFF
    const crcLow = crcResult & 0xFF
    const packetBytes = frameBytes.concat([crcHigh, crcLow])

    return {
      payloadBytes,
      sendHexString: this.convertDecimalArrayToHexString(packetBytes),
      displayHexString: this.bytesToSpacedHex(packetBytes),
    }
  },

  convertDecimalArrayToHexString(arr) {
    if (!Array.isArray(arr)) {
      console.error('请传入数组参数')
      return ''
    }

    return arr.map((num) => this.byteToHex(Math.floor(num))).join('')
  },
})
