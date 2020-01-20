import path from 'path'
import Midgar from '@midgar/midgar'

const fileName = (type) => type + '-' + path.basename(__filename)

export default {
  up: async (mid, arg1, arg2) => {
    const name = fileName('up')
    if (!(mid instanceof Midgar)) throw new Error('Invalid first arg in ' + name + ' !')
    if (arg1 !== 'test_arg1') throw new Error('Invalid second arg in ' + name + ' !')
    if (arg2 !== 'test_arg2') throw new Error('Invalid third arg in ' + name + ' !')

    const storage = mid.getService('mid:migrate').getStorage('test-storage')
    storage.result.push(name)
  },
  down: async (mid, arg1, arg2) => {
    const name = fileName('down')
    if (!(mid instanceof Midgar)) throw new Error('Invalid first arg in ' + name + ' !')
    if (arg1 !== 'test_arg1') throw new Error('Invalid second arg in ' + name + ' !')
    if (arg2 !== 'test_arg2') throw new Error('Invalid third arg in ' + name + ' !')

    const storage = mid.getService('mid:migrate').getStorage('test-storage')
    storage.result.push(name)
  }
}
