// pages/nor_flash_burn/nor_flash_burn.js
const ecBLE = require('../../utils/ecBLE.js')

/** 外部 QSPI Flash 烧录命令字（桌面艺术旋钮屏 BLE 通信协议 V1.0，操作码严格递增不可插入） */
const CMD = {
  FLASH_BURN_START: 0x27, // 开始烧录：起始地址(4B 小端) + 文件总大小(4B 小端)，应答 1 字节结果码
  FLASH_BURN_DATA: 0x28, // 下发烧录数据：文件内偏移(4B 小端) + 数据，设备逐包回结果码(1B)+已确认字节数(4B 小端)
  FLASH_BURN_END: 0x29, // 烧录结束：无数据域，设备排空写任务并回读校验后回 1 字节结果码
  FLASH_BURN_ABORT: 0x2A, // 中断停止：设备把已收到的缓存写入 flash 后重启（无数据域、无应答；离开页面时也会发）
  FLASH_BURN_FINISH_REBOOT: 0x2B, // 设备侧保留的"烧完自动重启"请求；现在烧录结束本就重启，页面不再使用
}

/** 烧录结果码（ble_flash_result_t） */
const FLASH_RESULT_TEXT = {
  0x00: '成功',
  0x01: '参数非法',
  0x02: '未开始会话',
  0x03: '地址越界',
  0x04: '设备忙',
  0x05: '偏移不连续',
  0x06: '设备超时',
  0x07: '写入校验失败',
}

/** 单次烧录最大文件大小 16MB（起始地址不做限制；超过请分包多次烧录） */
const FLASH_MAX_BURN_SIZE = 16 * 1024 * 1024

/** 单包文件数据长度：0x28 数据域 = 4B 偏移 + 498B 数据 = 502B，整帧 512B，
 * 与 BK7258 OTA 单包大小(10B 帧头尾 + 2B 包号 + 500B 数据 = 512B)一致 */
const DATA_CHUNK_SIZE = 498

/** 0x27 应答超时（设备可能要先排空上一个会话的残留块）；0x29 需等设备排空写任务(最长 30s)并回读校验，超时放宽 */
const START_RESPONSE_TIMEOUT = 10000
const END_RESPONSE_TIMEOUT = 60000
/** 每包数据等待设备确认的超时：设备取不到空闲块时最长会等 5s，故放宽 */
const DATA_ACK_TIMEOUT = 10000
/** 单包无确认时的最大重传次数（设备端 CRC 校验失败的帧会被静默丢弃） */
const DATA_ACK_MAX_RETRY = 3
/** 0x05 偏移不连续：设备会回带自己已确认到的位置，小程序对齐后接着发 */
const FLASH_ERR_OFFSET = 0x05
/** 一次烧录最多允许的对齐次数，防止进度来回跳变时死循环 */
const DATA_RESYNC_MAX = 5
/** 0x29 校验通过后等设备主动重启断开的超时；超时则提示手动重启 */
const REBOOT_WAIT_TIMEOUT = 8000

Page({

  /**
   * 页面的初始数据
   */
  data: {
    offsetText: '',
    offsetHint: '',
    binName: '',
    binSize: 0,
    hasSelectedBinFile: false,
    burnTotalPackets: 0,
    burnSentPackets: 0,
    burnSentBytes: 0,
    burnProgress: 0,
    burnStatusText: '未开始',
    isBurning: false,
    /** 已下发"中断停止"，按钮隐藏 */
    stopRequested: false,
  },

  /** 烧录会话状态（文件数据体积大，只挂实例不挂 data，避免进入视图层） */
  burnSession: {
    binData: [],
    seq: 0,
    startAddr: 0,
    totalSize: 0,
    aborted: false,
    disconnected: false,
    resultWaiter: null,
    resultTimer: null,
    lastAckBytes: -1,
    /** 用户点了"中断停止"：设备把已收缓存落盘后会主动重启 */
    stopRequested: false,
    /** 正在等设备重启断开（正常烧完、中断停止后都会进入） */
    waitingReboot: false,
    rebootTimer: null,
  },

  onLoad() {
    ecBLE.setChineseType(ecBLE.ECBLEChineseTypeGBK)
    this.setData({ offsetHint: this._offsetHint('') })

    if (wx && wx.onBLEConnectionStateChange) {
      wx.onBLEConnectionStateChange((res) => {
        if (!this.data.isBurning) {
          return
        }
        if (!res.connected) {
          if (this.burnSession.waitingReboot) {
            // 正常烧完、中断停止后设备都会主动重启，这次断开是预期结果
            const stopped = this.burnSession.aborted
            const text = stopped ? '已停止，设备已重启' : '烧录完成，设备已重启'

            this._clearRebootTimer()
            this.burnSession.waitingReboot = false
            this.setData({
              isBurning: false,
              burnStatusText: text,
            })
            wx.showToast({ title: text, icon: stopped ? 'none' : 'success' })
            return
          }
          this.burnSession.disconnected = true
          this._clearResultWaiter(new Error('disconnected'))
          this.setData({
            isBurning: false,
            burnStatusText: '连接已断开，烧录中断',
          })
          wx.showToast({ title: '连接已断开，烧录中断', icon: 'none' })
        }
      })
    }

    /** 监听 BLE 消息，先校验 CRC 再解析操作码 */
    ecBLE.onBLECharacteristicValueChange((str, strHex) => {
      const receiveData = []
      for (let i = 0; i + 1 < strHex.length; i += 2) {
        receiveData.push(parseInt(strHex.substr(i, 2), 16))
      }
      if (this._checkFrameCrc(receiveData)) {
        this._handleBleFrame(receiveData)
      }
    })
  },

  onUnload() {
    this._clearRebootTimer()
    this._clearResultWaiter(new Error('unloaded'))
    if (this.data.isBurning) {
      this.burnSession.aborted = true
      this._sendCmd(CMD.FLASH_BURN_ABORT)
    }
  },

  /** 偏移地址输入 */
  onOffsetInput(e) {
    const text = e.detail.value
    this.setData({
      offsetText: text,
      offsetHint: this._offsetHint(text),
    })
  },

  /** 打开聊天窗口选择 .bin 文件 */
  chooseBinFile() {
    if (this.data.isBurning) {
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['bin'],
      success: (res) => {
        const file = res.tempFiles[0]
        if (!this._isBinFile(file.name)) {
          wx.showToast({ title: '请选择.bin文件', icon: 'error' })
          return
        }
        this._readBinFile(file.path, file.name)
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) {
          return
        }
        wx.showToast({ title: '选择文件失败', icon: 'error' })
      },
    })
  },

  async startBurn() {
    if (this.data.isBurning) {
      return
    }
    const session = this.burnSession
    const totalSize = session.binData.length
    if (!totalSize) {
      wx.showToast({ title: '请先选择BIN文件', icon: 'error' })
      return
    }
    const startAddr = this._parseOffsetAddress(this.data.offsetText)
    if (startAddr === null) {
      wx.showToast({ title: '偏移地址格式错误', icon: 'error' })
      return
    }
    if (totalSize > FLASH_MAX_BURN_SIZE) {
      wx.showToast({ title: '文件超过16MB，请分包烧录', icon: 'error' })
      return
    }

    session.seq = 0
    session.startAddr = startAddr
    session.totalSize = totalSize
    session.aborted = false
    session.disconnected = false
    session.stopRequested = false
    session.waitingReboot = false
    this._clearRebootTimer()
    this._clearResultWaiter(new Error('restart'))
    this._lastProgressPercent = -1

    this.setData({
      isBurning: true,
      stopRequested: false,
      burnProgress: 0,
      burnSentBytes: 0,
      burnSentPackets: 0,
      burnTotalPackets: Math.ceil(totalSize / DATA_CHUNK_SIZE),
      burnStatusText: '发起烧录会话…',
    })

    // 0x27：起始地址 + 文件总大小（各 4 字节小端），必须收到结果码 0x00 才可下发数据
    const startRes = await this._sendCmdAndWait(
      CMD.FLASH_BURN_START,
      this._buildStartPayload(startAddr, totalSize),
      START_RESPONSE_TIMEOUT
    )
    if (session.aborted) {
      return
    }
    if (!startRes.ok) {
      this._failBurn('设备无应答（0x27 超时）')
      return
    }
    if (startRes.code !== 0x00) {
      this._failBurn(`会话开始失败：${this._resultText(startRes.code)}`)
      return
    }

    await this._sendBinData()
    if (session.aborted || session.disconnected) {
      return
    }
    await this._finishBurn()
  },

  /**
   * 中断停止：立即停止下发，设备把已收到的缓存（含未填满的块）写入 flash 后重启。
   * 不支持续传，剩余未下发的数据直接丢弃；之后的断连按预期结果处理。
   */
  stopBurn() {
    if (!this.data.isBurning || this.burnSession.stopRequested) {
      return
    }
    const session = this.burnSession

    session.stopRequested = true
    session.aborted = true                        // 发送循环据此退出，不再下发新包
    this._clearResultWaiter(new Error('stopped')) // 放掉正在等的那包确认

    // 设备落盘后会主动重启断连，从这一刻起断开即视为预期结果
    session.waitingReboot = true
    this._sendCmd(CMD.FLASH_BURN_ABORT)

    this.setData({
      stopRequested: true,
      burnStatusText: '已停止下发，设备正在写入缓存并重启…',
    })
    this._waitDeviceReboot()
    wx.showToast({ title: '已停止，设备正在重启', icon: 'none' })
  },

  /**
   * 按偏移递增顺序逐包下发，每包都要收到设备确认后才发下一包。
   * 设备若回带"已确认位置"且与本包末尾不符（含 0x05 偏移不连续），
   * 就跳到该位置重发，而不是把整个会话判死。
   */
  async _sendBinData() {
    const session = this.burnSession
    const binData = session.binData
    const totalSize = session.totalSize
    const totalPackets = Math.ceil(totalSize / DATA_CHUNK_SIZE)
    let resyncLeft = DATA_RESYNC_MAX

    let packet = 0
    while (packet < totalPackets) {
      if (session.aborted || session.disconnected) {
        return
      }
      const offset = packet * DATA_CHUNK_SIZE
      const end = Math.min(offset + DATA_CHUNK_SIZE, totalSize)
      const chunkSize = end - offset
      const payload = new Array(4 + chunkSize)
      payload[0] = offset & 0xFF
      payload[1] = (offset >> 8) & 0xFF
      payload[2] = (offset >> 16) & 0xFF
      payload[3] = (offset >> 24) & 0xFF
      for (let i = 0; i < chunkSize; i++) {
        payload[4 + i] = binData[offset + i]
      }

      let confirmed = false
      let resyncTo = -1
      for (let retry = 0; retry <= DATA_ACK_MAX_RETRY; retry++) {
        if (session.aborted || session.disconnected) {
          return
        }
        const ack = await this._sendCmdAndWait(CMD.FLASH_BURN_DATA, payload, DATA_ACK_TIMEOUT)
        if (session.aborted || session.disconnected) {
          return
        }
        if (!ack.ok) {
          // 超时：设备可能没收到（帧 CRC 校验失败会被静默丢弃），重传本包
          console.warn(`burn packet ${packet + 1} ack timeout, retry=${retry}`)
          continue
        }
        if (ack.code === 0x00 && session.lastAckBytes === end) {
          confirmed = true
          break
        }
        if (ack.code === 0x00 || ack.code === FLASH_ERR_OFFSET) {
          // 设备回带了自己的进度，跳到那里重发
          resyncTo = session.lastAckBytes
          break
        }
        this._failBurn(`烧录中断：${this._resultText(ack.code)}`)
        return
      }

      if (resyncTo >= 0) {
        const target = this._packetOfOffset(resyncTo, totalSize, totalPackets)
        if (resyncLeft <= 0 || target < 0) {
          this._failBurn(`烧录中断：设备进度无法对齐（${resyncTo}）`)
          return
        }
        resyncLeft--
        console.warn(`burn resync ${offset} -> ${resyncTo}`)
        this._updateProgress(resyncTo, target, totalPackets)
        packet = target
        continue
      }

      if (!confirmed) {
        this._failBurn(`第 ${packet + 1} 包无确认，烧录中断`)
        return
      }
      this._updateProgress(end, packet + 1, totalPackets)
      packet++
    }
  },

  /** 把设备回带的字节位置换算成包序号；不是包边界则返回 -1 */
  _packetOfOffset(offset, totalSize, totalPackets) {
    if (offset === totalSize) {
      return totalPackets // 设备已收满，直接进收尾
    }
    if (offset < 0 || offset > totalSize || offset % DATA_CHUNK_SIZE !== 0) {
      return -1
    }
    return offset / DATA_CHUNK_SIZE
  },

  /** 0x29：设备提交余数、排空写任务并回读校验；校验通过后设备必定主动重启断连 */
  async _finishBurn() {
    this.setData({ burnStatusText: '等待设备写入并回读校验…' })
    // 校验通过后设备会主动重启，所以从发出 0x29 起，"断开"就按成功处理
    this.burnSession.waitingReboot = true

    const endRes = await this._sendCmdAndWait(CMD.FLASH_BURN_END, null, END_RESPONSE_TIMEOUT)
    if (this.burnSession.aborted || !this.burnSession.waitingReboot) {
      return // 已由断连回调按"设备已重启"收尾
    }
    if (endRes.ok && endRes.code === 0x00) {
      // 设备正在重启，等它断开；等不到就提示手动重启
      this.setData({
        burnProgress: 100,
        burnSentBytes: this.burnSession.totalSize,
        burnStatusText: '烧录完成，等待设备重启…',
      })
      this._waitDeviceReboot()
      return
    }
    // 校验失败 / 无应答：设备不会重启，就此收尾
    this.burnSession.waitingReboot = false
    if (!endRes.ok) {
      this._failBurn('设备校验超时（0x29 无应答）')
      return
    }
    this._failBurn(`烧录失败：${this._resultText(endRes.code)}`)
  },

  _handleBleFrame(bytes) {
    const cmd = bytes[5]
    switch (cmd) {
      case CMD.FLASH_BURN_START:
      case CMD.FLASH_BURN_DATA:
      case CMD.FLASH_BURN_END: {
        // 0x28 数据域带"已确认字节数"，用于核对设备实际收到的位置
        this.burnSession.lastAckBytes = this._getAckBytes(bytes)
        this._resolveResultWaiter(this._getResultCode(bytes))
        break
      }
      default:
        break
    }
  },

  /**
   * 先挂等待再发送，避免设备应答早于 waiter 注册被丢弃。
   * 返回 { ok, code }：ok=false 表示发送失败 / 等待超时 / 被中止。
   */
  async _sendCmdAndWait(cmd, payload, timeoutMs) {
    this._clearResultWaiter(new Error('superseded'))
    this.burnSession.lastAckBytes = -1

    const waiter = new Promise((resolve, reject) => {
      this.burnSession.resultWaiter = { resolve, reject }
    })
    this.burnSession.resultTimer = setTimeout(() => {
      this._clearResultWaiter(new Error('timeout'))
    }, timeoutMs)

    const writeRes = await this._sendCmd(cmd, payload)
    if (!writeRes.ok) {
      // 此处 waiter 还没被 await，不能 reject（会产生未处理的 Promise 异常）
      this._clearResultWaiter()
      return { ok: false, code: -1 }
    }

    try {
      return { ok: true, code: await waiter }
    } catch (err) {
      return { ok: false, code: -1 }
    }
  },

  /** 等设备重启后主动断开；超时未断开就收尾，避免页面一直挂在等待中 */
  _waitDeviceReboot() {
    this._clearRebootTimer()
    this.burnSession.rebootTimer = setTimeout(() => {
      this.burnSession.rebootTimer = null
      if (!this.burnSession.waitingReboot) {
        return
      }
      this.burnSession.waitingReboot = false
      const text = this.burnSession.aborted
        ? '已停止，未检测到设备重启，请手动重启'
        : '烧录完成，未检测到设备重启，请手动重启'

      this.setData({
        isBurning: false,
        burnStatusText: text,
      })
      wx.showToast({ title: text, icon: 'none' })
    }, REBOOT_WAIT_TIMEOUT)
  },

  _clearRebootTimer() {
    if (this.burnSession.rebootTimer) {
      clearTimeout(this.burnSession.rebootTimer)
      this.burnSession.rebootTimer = null
    }
  },

  /** 收起等待；带 err 时会让挂起的 await 立刻以失败结束，避免永久挂死 */
  _clearResultWaiter(err) {
    const waiter = this.burnSession.resultWaiter
    if (this.burnSession.resultTimer) {
      clearTimeout(this.burnSession.resultTimer)
    }
    this.burnSession.resultTimer = null
    this.burnSession.resultWaiter = null
    if (waiter && err) {
      waiter.reject(err)
    }
  },

  _resolveResultWaiter(result) {
    const waiter = this.burnSession.resultWaiter
    this._clearResultWaiter()
    if (waiter) {
      waiter.resolve(result)
    }
  },

  _failBurn(text) {
    this._clearResultWaiter(new Error('failed'))
    this.burnSession.aborted = true
    this.setData({
      isBurning: false,
      burnStatusText: text,
    })
    wx.showToast({ title: text, icon: 'none' })
  },

  _updateProgress(sentBytes, sentPackets, totalPackets) {
    const percent = Math.floor((sentBytes * 100) / this.burnSession.totalSize)
    if (percent === this._lastProgressPercent) {
      return
    }
    this._lastProgressPercent = percent
    this.setData({
      burnProgress: percent,
      burnSentBytes: sentBytes,
      burnSentPackets: sentPackets,
      burnTotalPackets: totalPackets,
      burnStatusText: `烧录中… ${percent}%`,
    })
  },

  /** 0x27 数据域：起始地址 4B 小端 + 文件总大小 4B 小端 */
  _buildStartPayload(startAddr, totalSize) {
    return [
      startAddr & 0xFF,
      (startAddr >> 8) & 0xFF,
      (startAddr >> 16) & 0xFF,
      (startAddr >> 24) & 0xFF,
      totalSize & 0xFF,
      (totalSize >> 8) & 0xFF,
      (totalSize >> 16) & 0xFF,
      (totalSize >> 24) & 0xFF,
    ]
  },

  /** 组帧：0x55 0xAA + SeqH SeqL + Ext + Cmd + LenH LenL(大端) + Data + CRC_H CRC_L(大端) */
  _buildFrame(cmd, payload) {
    const dataLen = payload ? payload.length : 0
    const frame = new Array(10 + dataLen)
    this.burnSession.seq = (this.burnSession.seq + 1) & 0xFFFF
    frame[0] = 0x55
    frame[1] = 0xAA
    frame[2] = (this.burnSession.seq >> 8) & 0xFF
    frame[3] = this.burnSession.seq & 0xFF
    frame[4] = 0x00 // 预留（BLE_NO_RESPONSE）
    frame[5] = cmd
    frame[6] = (dataLen >> 8) & 0xFF
    frame[7] = dataLen & 0xFF
    for (let i = 0; i < dataLen; i++) {
      frame[8 + i] = payload[i] & 0xFF
    }
    const crc = this.crc16CcittFalse_send(frame, 8 + dataLen)
    frame[8 + dataLen] = (crc >> 8) & 0xFF
    frame[9 + dataLen] = crc & 0xFF
    return new Uint8Array(frame).buffer
  },

  _sendCmd(cmd, payload) {
    return ecBLE.writeBLECharacteristicValueBuffer(this._buildFrame(cmd, payload))
  },

  /** 校验帧长度与 CRC16-CCITT-FALSE */
  _checkFrameCrc(bytes) {
    if (bytes.length < 10) {
      return false
    }
    const dataLen = (bytes[6] << 8) | bytes[7]
    if (bytes.length !== dataLen + 10) {
      return false
    }
    const expected = this.crc16CcittFalse_send(bytes, 8 + dataLen)
    const received = (bytes[8 + dataLen] << 8) | bytes[9 + dataLen]
    return expected === received
  },

  _getResultCode(bytes) {
    const dataLen = (bytes[6] << 8) | bytes[7]
    if (dataLen < 1) {
      return -1
    }
    return bytes[8]
  },

  /** 0x28 确认帧：数据域 = 结果码(1B) + 已确认字节数(4B 小端)；无该字段返回 -1 */
  _getAckBytes(bytes) {
    const dataLen = (bytes[6] << 8) | bytes[7]
    if (dataLen < 5) {
      return -1
    }
    return (bytes[9] | (bytes[10] << 8) | (bytes[11] << 16) | (bytes[12] << 24)) >>> 0
  },

  _resultText(code) {
    return FLASH_RESULT_TEXT[code] || `未知结果码(${code < 0 ? '无数据' : '0x' + code.toString(16).toUpperCase()})`
  },

  _isBinFile(fileName) {
    if (!fileName) {
      return false
    }
    return fileName.substring(fileName.lastIndexOf('.')).toLowerCase() === '.bin'
  },

  _readBinFile(filePath, fileName) {
    wx.getFileSystemManager().readFile({
      filePath,
      success: (res) => {
        const binData = new Uint8Array(res.data)
        if (!binData.length) {
          wx.showToast({ title: '文件内容为空', icon: 'error' })
          return
        }
        this.burnSession.binData = binData
        this._lastProgressPercent = -1
        this.setData({
          binName: fileName,
          binSize: binData.length,
          hasSelectedBinFile: true,
          burnTotalPackets: Math.ceil(binData.length / DATA_CHUNK_SIZE),
          burnSentPackets: 0,
          burnSentBytes: 0,
          burnProgress: 0,
          burnStatusText: '未开始',
        })
        console.log('bin file loaded, size:', binData.length)
        wx.showToast({ title: '文件读取成功', icon: 'success' })
      },
      fail: (err) => {
        console.error('read bin file failed:', err)
        wx.showToast({ title: '读取文件失败', icon: 'error' })
      },
    })
  },

  /** 解析十六进制偏移地址，可带 0x 前缀 */
  _parseOffsetAddress(text) {
    const raw = (text || '').trim().replace(/^0x/i, '')
    if (!/^[0-9a-fA-F]{1,8}$/.test(raw)) {
      return null
    }
    return parseInt(raw, 16)
  },

  _offsetHint(text) {
    const raw = (text || '').trim()
    if (!raw) {
      return '十六进制，可带 0x 前缀，如 0x00100000'
    }
    const addr = this._parseOffsetAddress(raw)
    if (addr === null) {
      return '地址格式错误，请输入十六进制，如 0x00100000'
    }
    return `将写入 0x${addr.toString(16).toUpperCase().padStart(8, '0')}`
  },

  /**发送消息时CRC */
  crc16CcittFalse_send(data, len) {
    let crc = 0xFFFF; // 初始值，与C代码一致
    const polynomial = 0x1021; // 多项式，与C代码一致
    if (!data || len === 0) {
      return crc;
    }
    for (let i = 0; i < len; i++) {
      crc ^= (data[i] << 8);
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc = crc << 1;
        }
        crc &= 0xFFFF;
      }
    }
    return crc;
  },
})
